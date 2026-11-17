import { useEffect, useRef, useState } from 'react';
import { Fingerprint, Languages } from 'lucide-react';
import type {
  CaptureRecord,
  Decision,
  ExtractionRequest,
  ForgetProposal,
  HudEvent,
  Language,
  Tab,
} from './types';
import { settings } from './lib/config';
import { initFirebase, getServices, syncCaptureMetadata } from './lib/firebase';
import { initializeDeviceModel, extractCapture } from './lib/ai';
import { embed } from './lib/embeddings';
import {
  addHudEvent,
  getCaptures,
  getHudEvents,
  getMeta,
  getProposals,
  saveCapture,
  saveProposal,
  seedDemoCaptures,
  setMeta,
} from './lib/store';
import { buildAnswer } from './lib/answer';
import { applyDecision, scanForProposals } from './lib/forget';
import { t } from './lib/i18n';
import Onboarding from './components/Onboarding';
import BottomNav from './components/BottomNav';
import Memories from './components/Memories';
import Ask from './components/Ask';
import Forget from './components/Forget';
import DetailSheet from './components/DetailSheet';
import Hud from './components/Hud';
import Toast from './components/Toast';

interface ToastState {
  message: string;
  undo?: () => void;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [tab, setTab] = useState<Tab>('memories');
  const [captures, setCaptures] = useState<CaptureRecord[]>([]);
  const [proposals, setProposals] = useState<ForgetProposal[]>([]);
  const [hudEvents, setHudEvents] = useState<HudEvent[]>([]);
  const [selected, setSelected] = useState<CaptureRecord | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [busy, setBusy] = useState(false);
  const [askSeed, setAskSeed] = useState<string | undefined>(undefined);
  const [askNonce, setAskNonce] = useState(0);
  const booted = useRef(false);

  const log = (label: string, source: HudEvent['source'], latencyMs: number, detail?: string) => {
    const event: HudEvent = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      label,
      source,
      latencyMs,
      detail,
    };
    setHudEvents((prev) => [event, ...prev].slice(0, 30));
    void addHudEvent(event);
  };

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      await initFirebase();
      await seedDemoCaptures();
      const [loadedCaptures, loadedProposals, loadedHud, savedLang, savedOnboarding] = await Promise.all([
        getCaptures(),
        getProposals(),
        getHudEvents(),
        getMeta<Language>('language', 'en'),
        getMeta<boolean>('onboardingDone', false),
      ]);
      setCaptures(loadedCaptures);
      setProposals(loadedProposals);
      setHudEvents(loadedHud);
      setLanguage(savedLang);
      setOnboardingDone(savedOnboarding);

      const fresh = scanForProposals(loadedCaptures, settings.duplicateThreshold, loadedProposals);
      for (const proposal of fresh) await saveProposal(proposal);
      if (fresh.length) setProposals((prev) => [...prev, ...fresh]);

      setReady(true);
    })();
  }, []);

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    void setMeta('language', next);
  };

  const completeOnboarding = () => {
    setOnboardingDone(true);
    void setMeta('onboardingDone', true);
  };

  const handleCapture = async (request: ExtractionRequest) => {
    setBusy(true);
    try {
      const result = await extractCapture(request);
      const extraction = result.extraction;
      const unextracted = Boolean(result.error);
      const searchable = [
        extraction?.summary || '',
        ...(extraction?.entities || []),
        request.text || '',
      ].join(' ');
      const capture: CaptureRecord = {
        id: `cap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: request.type,
        capturedAt: new Date().toISOString(),
        summary: unextracted ? 'Unextracted capture — original kept on device' : extraction?.summary || 'Capture',
        entities: extraction?.entities || [],
        expiryDate: extraction?.expiryDate || null,
        language,
        inferenceSource: result.source,
        retentionState: 'active',
        originalRef: request.imageDataUrl,
        derivedText: request.text,
        embedding: await embed(searchable || 'capture'),
      };
      await saveCapture(capture);
      setCaptures((prev) => [capture, ...prev]);
      void syncCaptureMetadata(await getCaptures());
      log(t(language, 'capturedOnDevice'), result.source, result.latencyMs, extractErrorText(result.error));
    } finally {
      setBusy(false);
    }
  };

  const handleAsk = async (question: string) => {
    setBusy(true);
    try {
      const result = await buildAnswer(question, captures, settings.retrievalThreshold);
      if (result.sources.length) {
        for (const source of result.sources) await saveCapture(source);
        setCaptures((prev) => prev.map((c) => result.sources.find((s) => s.id === c.id) || c));
      }
      log(t(language, 'answered'), result.inferenceSource, result.latencyMs, question.slice(0, 60));
      return result;
    } finally {
      setBusy(false);
    }
  };

  const handleDecide = (proposal: ForgetProposal, decision: Decision) => {
    const previousCapture = captures.find((c) => c.id === proposal.captureId);
    if (!previousCapture) return;
    const updatedCapture = applyDecision(previousCapture, decision, settings.trashRetentionDays);
    const updatedProposal: ForgetProposal = { ...proposal, decided: decision };
    void saveCapture(updatedCapture);
    void saveProposal(updatedProposal);
    setCaptures((prev) => prev.map((c) => (c.id === updatedCapture.id ? updatedCapture : c)));
    setProposals((prev) => prev.map((p) => (p.id === updatedProposal.id ? updatedProposal : p)));
    setToast({
      message:
        decision === 'approve'
          ? t(language, 'movedToTrash', { n: settings.trashRetentionDays })
          : t(language, 'keptPreference'),
      undo: () => {
        void saveCapture(previousCapture);
        void saveProposal(proposal);
        setCaptures((prev) => prev.map((c) => (c.id === previousCapture.id ? previousCapture : c)));
        setProposals((prev) => prev.map((p) => (p.id === proposal.id ? proposal : p)));
        setToast(null);
      },
    });
  };

  const handleRestore = (capture: CaptureRecord) => {
    const restored: CaptureRecord = { ...capture, retentionState: 'active', trashedAt: undefined };
    void saveCapture(restored);
    setCaptures((prev) => prev.map((c) => (c.id === restored.id ? restored : c)));
    setToast({ message: language === 'vi' ? 'Đã khôi phục.' : 'Restored to your memories.' });
  };

  const askAbout = (capture: CaptureRecord) => {
    setSelected(null);
    const question =
      language === 'vi'
        ? `Chi tiết trong capture này: ${capture.summary}`
        : `What details are in this capture: ${capture.summary}`;
    setAskSeed(question);
    setAskNonce((n) => n + 1);
    setTab('ask');
  };

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <div className="flex flex-col items-center gap-3 text-ink2">
          <Fingerprint size={34} className="text-accent" />
          <span className="text-[13px] font-semibold">{t(language, 'appName')}</span>
        </div>
      </div>
    );
  }

  const pendingCount = proposals.filter((p) => !p.decided).length;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-bg">
      <header className="flex items-center justify-between px-5 pt-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-white">
            <Fingerprint size={18} />
          </span>
          <span className="text-[13px] font-black tracking-tight">{t(language, 'appName')}</span>
        </div>
        <button
          type="button"
          onClick={() => changeLanguage(language === 'en' ? 'vi' : 'en')}
          className="inline-flex items-center gap-1.5 rounded-full border border-line2 bg-canvas px-3 py-1.5 text-[11px] font-bold uppercase text-ink2"
        >
          <Languages size={14} /> {language}
        </button>
      </header>

      <main className="no-scrollbar flex-1 overflow-y-auto px-5 pb-6 pt-5">
        {tab === 'memories' && (
          <Memories
            captures={captures}
            language={language}
            onCapture={handleCapture}
            onOpenDetail={setSelected}
            busy={busy}
          />
        )}
        {tab === 'ask' && (
          <Ask
            key={askNonce}
            language={language}
            onAsk={handleAsk}
            onOpenDetail={setSelected}
            busy={busy}
            seedQuestion={askSeed}
          />
        )}
        {tab === 'forget' && (
          <Forget
            proposals={proposals}
            captures={captures}
            language={language}
            onDecide={handleDecide}
            onRestore={handleRestore}
            trashDays={settings.trashRetentionDays}
          />
        )}
        <div className="mt-6">
          <Hud events={hudEvents} language={language} demoMode={!getServices().ai} />
        </div>
      </main>

      <BottomNav active={tab} onChange={setTab} language={language} reviewCount={pendingCount} />

      {selected && (
        <DetailSheet capture={selected} language={language} onClose={() => setSelected(null)} onAskAbout={askAbout} />
      )}
      {toast && (
        <Toast message={toast.message} onUndo={toast.undo} onDismiss={() => setToast(null)} />
      )}
      {!onboardingDone && (
        <div className="fixed inset-0 z-50 bg-bg">
          <Onboarding
            language={language}
            onLanguageChange={changeLanguage}
            onComplete={completeOnboarding}
            onPrepareDevice={async () => {
              await initializeDeviceModel();
            }}
          />
        </div>
      )}
    </div>
  );
}

function extractErrorText(error?: string): string | undefined {
  if (!error) return undefined;
  return error.length > 80 ? `${error.slice(0, 77)}…` : error;
}

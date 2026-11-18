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
  TagGroupProposal,
} from './types';
import { settings } from './lib/config';
import { initFirebase, getServices, syncCaptureMetadata } from './lib/firebase';
import { initializeDeviceModel, extractCapture, probeNanoAvailability, type NanoAvailability } from './lib/ai';
import { embed, normalize } from './lib/embeddings';
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
import { computeTagGroups, rebuildSearchText } from './lib/tags';
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
  const [askCaptureId, setAskCaptureId] = useState<string | undefined>(undefined);
  const [askNonce, setAskNonce] = useState(0);
  const [nanoStatus, setNanoStatus] = useState<NanoAvailability>('unsupported');
  const [dismissedTagGroups, setDismissedTagGroups] = useState<string[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroupProposal[]>([]);
  const booted = useRef(false);

  const syncTagSuggestions = async (currentCaptures: CaptureRecord[], dismissed: string[]) => {
    const { groups, suggestedByCapture } = computeTagGroups(currentCaptures, settings, dismissed);
    setTagGroups(groups);
    const updatedCaptures: CaptureRecord[] = [];
    for (const capture of currentCaptures) {
      const nextSuggested = suggestedByCapture.get(capture.id) || [];
      const prevSuggested = capture.suggestedTags || [];
      const changed =
        nextSuggested.length !== prevSuggested.length ||
        nextSuggested.some((item, idx) => item !== prevSuggested[idx]);
      if (changed) {
        const nextRecord: CaptureRecord = {
          ...capture,
          suggestedTags: nextSuggested.length ? nextSuggested : undefined,
        };
        updatedCaptures.push(nextRecord);
        await saveCapture(nextRecord).catch((err) => console.warn('[store] save suggestedTags failed', err));
      }
    }
    if (updatedCaptures.length) {
      setCaptures((prev) => prev.map((c) => updatedCaptures.find((u) => u.id === c.id) || c));
    }
  };

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
    void addHudEvent(event).catch((err) => console.warn('[store] addHudEvent failed', err));
  };

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      try {
        await initFirebase();
        await seedDemoCaptures();
        const [loadedCaptures, loadedProposals, loadedHud, savedLang, savedOnboarding, probedNano, savedDismissed] = await Promise.all([
          getCaptures(),
          getProposals(),
          getHudEvents(),
          getMeta<Language>('language', 'en'),
          getMeta<boolean>('onboardingDone', false),
          probeNanoAvailability(),
          getMeta<string[]>('dismissedTagGroups', []),
        ]);
        setCaptures(loadedCaptures);
        setProposals(loadedProposals);
        setHudEvents(loadedHud);
        setLanguage(savedLang);
        setOnboardingDone(savedOnboarding);
        setNanoStatus(probedNano);
        setDismissedTagGroups(savedDismissed);

        const fresh = scanForProposals(loadedCaptures, settings.duplicateThreshold, loadedProposals);
        for (const proposal of fresh) await saveProposal(proposal);
        if (fresh.length) setProposals((prev) => [...prev, ...fresh]);

        await syncTagSuggestions(loadedCaptures, savedDismissed);
      } catch (error) {
        console.error('[app] boot initialization failed', error);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    void setMeta('language', next).catch((err) => console.warn('[store] setMeta(language) failed', err));
  };

  const completeOnboarding = () => {
    setOnboardingDone(true);
    void setMeta('onboardingDone', true).catch((err) => console.warn('[store] setMeta(onboardingDone) failed', err));
  };

  const handleCapture = async (request: ExtractionRequest) => {
    setBusy(true);
    try {
      const result = await extractCapture(request);
      const extraction = result.extraction;
      const unextracted = Boolean(result.error);
      const trimmedText = request.text?.trim() || '';
      const fallbackNoteSummary =
        request.type === 'note' && trimmedText
          ? extraction?.summary ||
            trimmedText.replace(/^[.!?\s]+/, '').split(/[.!?]/)[0]?.trim().slice(0, 80) ||
            trimmedText.slice(0, 80)
          : 'Unextracted capture — original kept on device';
      const searchable = [
        extraction?.summary || '',
        ...(extraction?.entities || []),
        request.text || '',
      ].join(' ');
      const capture: CaptureRecord = {
        id: `cap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: request.type,
        capturedAt: request.capturedAt || new Date().toISOString(),
        summary: unextracted ? fallbackNoteSummary : extraction?.summary || 'Capture',
        entities: extraction?.entities || [],
        expiryDate: extraction?.expiryDate || null,
        language,
        inferenceSource: result.source,
        retentionState: 'active',
        originalRef: request.imageDataUrl,
        audioBlob: request.audioBlob,
        audioMimeType: request.audioMimeType,
        derivedText: trimmedText || undefined,
        embedding: await embed(searchable || 'capture'),
      };
      await saveCapture(capture);
      const [allCaptures, allProposals] = await Promise.all([getCaptures(), getProposals()]);
      setCaptures(allCaptures);
      const fresh = scanForProposals(allCaptures, settings.duplicateThreshold, allProposals);
      if (fresh.length) {
        for (const proposal of fresh) await saveProposal(proposal);
        setProposals([...allProposals, ...fresh]);
      }
      await syncTagSuggestions(allCaptures, dismissedTagGroups);
      void syncCaptureMetadata([capture]);
      log(t(language, 'capturedOnDevice'), result.source, result.latencyMs, extractErrorText(result.error));
    } finally {
      setBusy(false);
    }
  };

  const handleAsk = async (question: string, captureId?: string) => {
    setBusy(true);
    try {
      const targetCapture = captureId
        ? captures.find((c) => c.id === captureId && c.retentionState !== 'trashed')
        : undefined;
      const result = captureId
        ? await buildAnswer(question, targetCapture ? [targetCapture] : [], 0)
        : await buildAnswer(question, captures, settings.retrievalThreshold);
      if (result.sources.length) {
        for (const source of result.sources) await saveCapture(source);
        setCaptures((prev) => prev.map((c) => result.sources.find((s) => s.id === c.id) || c));
      }
      log(
        t(language, 'answered'),
        result.inferenceSource,
        result.latencyMs,
        result.error ? `${question.slice(0, 40)} — ${result.error}` : question.slice(0, 60),
      );
      return result;
    } finally {
      setBusy(false);
    }
  };

  const handleDecide = async (proposal: ForgetProposal, decision: Decision) => {
    const previousCapture = captures.find((c) => c.id === proposal.captureId);
    if (!previousCapture) return;
    const updatedCapture = applyDecision(previousCapture, decision, settings.trashRetentionDays);
    const updatedProposal: ForgetProposal = { ...proposal, decided: decision };
    await Promise.all([
      saveCapture(updatedCapture).catch((err) => console.warn('[store] saveCapture failed', err)),
      saveProposal(updatedProposal).catch((err) => console.warn('[store] saveProposal failed', err)),
    ]);
    setCaptures((prev) => prev.map((c) => (c.id === updatedCapture.id ? updatedCapture : c)));
    setProposals((prev) => prev.map((p) => (p.id === updatedProposal.id ? updatedProposal : p)));
    setToast({
      message:
        decision === 'approve'
          ? t(language, 'movedToTrash', { n: settings.trashRetentionDays })
          : t(language, 'keptPreference'),
      undo: async () => {
        await Promise.all([
          saveCapture(previousCapture).catch((err) => console.warn('[store] saveCapture undo failed', err)),
          saveProposal(proposal).catch((err) => console.warn('[store] saveProposal undo failed', err)),
        ]);
        setCaptures((prev) => prev.map((c) => (c.id === previousCapture.id ? previousCapture : c)));
        setProposals((prev) => prev.map((p) => (p.id === proposal.id ? proposal : p)));
        setToast(null);
      },
    });
  };

  const handleRestore = async (capture: CaptureRecord) => {
    const restored: CaptureRecord = {
      ...capture,
      retentionState: 'active',
      trashedAt: undefined,
      purgeAt: undefined,
    };
    const affected = proposals.filter((p) => p.captureId === capture.id && p.decided === 'approve');
    const updatedProposals = affected.map((p) => ({ ...p, decided: 'keep' as const }));
    await Promise.all([
      saveCapture(restored).catch((err) => console.warn('[store] saveCapture restore failed', err)),
      ...updatedProposals.map((proposal) =>
        saveProposal(proposal).catch((err) => console.warn('[store] saveProposal restore failed', err)),
      ),
    ]);
    setCaptures((prev) => prev.map((c) => (c.id === restored.id ? restored : c)));
    if (updatedProposals.length) {
      setProposals((prev) => prev.map((p) => updatedProposals.find((u) => u.id === p.id) || p));
    }

    const nextCaptures = captures.map((c) => (c.id === restored.id ? restored : c));
    await syncTagSuggestions(nextCaptures, dismissedTagGroups);
    setToast({ message: language === 'vi' ? 'Đã khôi phục.' : 'Restored to your memories.' });
  };

  const handleUpdateTags = async (capture: CaptureRecord, nextTags: string[]) => {
    const updated: CaptureRecord = {
      ...capture,
      tags: nextTags.length ? nextTags : undefined,
      embedding: await embed(rebuildSearchText({ ...capture, tags: nextTags }) || 'capture'),
    };
    await saveCapture(updated).catch((err) => console.warn('[store] saveCapture tags failed', err));
    const nextCaptures = captures.map((c) => (c.id === updated.id ? updated : c));
    setCaptures(nextCaptures);
    setSelected((prev) => (prev?.id === updated.id ? updated : prev));
    await syncTagSuggestions(nextCaptures, dismissedTagGroups);
  };

  const handleAcceptTagGroup = async (
    group: TagGroupProposal,
    selectedIds: string[],
    labelOverride?: string,
  ) => {
    const label = (labelOverride || group.label).trim().replace(/^#+/, '');
    if (!label || !selectedIds.length) return;
    const normLabel = normalize(label);
    const selectedSet = new Set(selectedIds);
    const updatedMap = new Map<string, CaptureRecord>();

    for (const capture of captures) {
      if (!selectedSet.has(capture.id)) continue;
      const existing = capture.tags || [];
      const nextTags = existing.some((tag) => normalize(tag) === normLabel)
        ? existing
        : [...existing, label];
      const nextSuggested = (capture.suggestedTags || []).filter((s) => normalize(s) !== normalize(group.label));
      const updated: CaptureRecord = {
        ...capture,
        tags: nextTags,
        suggestedTags: nextSuggested.length ? nextSuggested : undefined,
        embedding: await embed(rebuildSearchText({ ...capture, tags: nextTags }) || 'capture'),
      };
      await saveCapture(updated).catch((err) => console.warn('[store] accept tag group failed', err));
      updatedMap.set(updated.id, updated);
    }

    const nextCaptures = captures.map((c) => updatedMap.get(c.id) || c);
    setCaptures(nextCaptures);
    await syncTagSuggestions(nextCaptures, dismissedTagGroups);
  };

  const handleDismissTagGroup = async (group: TagGroupProposal) => {
    const nextDismissed = Array.from(new Set([...dismissedTagGroups, group.fingerprint]));
    setDismissedTagGroups(nextDismissed);
    await setMeta('dismissedTagGroups', nextDismissed).catch((err) =>
      console.warn('[store] save dismissedTagGroups failed', err),
    );
    await syncTagSuggestions(captures, nextDismissed);
  };

  const askAbout = (capture: CaptureRecord, question?: string) => {
    setSelected(null);
    const resolved =
      question?.trim() ||
      (language === 'vi'
        ? `Chi tiết trong capture này: ${capture.summary}`
        : `What details are in this capture: ${capture.summary}`);
    setAskSeed(resolved);
    setAskCaptureId(capture.id);
    setAskNonce((n) => n + 1);
    setTab('ask');
  };

  const handleTabChange = (nextTab: Tab) => {
    if (nextTab !== 'ask') {
      setAskSeed(undefined);
      setAskCaptureId(undefined);
    }
    setTab(nextTab);
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
            tagGroups={tagGroups}
            onAcceptTagGroup={handleAcceptTagGroup}
            onDismissTagGroup={handleDismissTagGroup}
            onRefreshTagGroups={() => {
              void syncTagSuggestions(captures, dismissedTagGroups);
            }}
          />
        )}
        {tab === 'ask' && (
          <Ask
            key={askNonce}
            language={language}
            nanoStatus={nanoStatus}
            onAsk={handleAsk}
            onOpenDetail={setSelected}
            busy={busy}
            seedQuestion={askSeed}
            seedCaptureId={askCaptureId}
            onSeedConsumed={() => {
              setAskSeed(undefined);
              setAskCaptureId(undefined);
            }}
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

      <BottomNav active={tab} onChange={handleTabChange} language={language} reviewCount={pendingCount} />

      {selected && (
        <DetailSheet
          capture={selected}
          language={language}
          onClose={() => setSelected(null)}
          onAskAbout={askAbout}
          onUpdateTags={handleUpdateTags}
        />
      )}
      {toast && (
        <Toast message={toast.message} language={language} onUndo={toast.undo} onDismiss={() => setToast(null)} />
      )}
      {!onboardingDone && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
          <Onboarding
            language={language}
            nanoStatus={nanoStatus}
            onLanguageChange={changeLanguage}
            onComplete={completeOnboarding}
            onPrepareDevice={async () => {
              await initializeDeviceModel();
              setNanoStatus(await probeNanoAvailability());
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

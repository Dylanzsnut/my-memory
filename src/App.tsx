import { useEffect, useRef, useState } from 'react';
import { Fingerprint, Languages, LogOut, Trash2, User } from 'lucide-react';
import type {
  AuthSession,
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
import {
  initFirebase,
  getServices,
  syncCaptureMetadata,
  deleteCaptureMetadata,
  deleteAllUserMetadata,
  signOutFirebase,
} from './lib/firebase';
import { initializeDeviceModel, extractCapture, probeNanoAvailability, type NanoAvailability } from './lib/ai';
import { embed, normalize } from './lib/embeddings';
import {
  addHudEvent,
  cleanupDemoRecordsForUser,
  deleteCapture,
  deleteProposal,
  deleteUserAccountData,
  getCaptures,
  getHudEvents,
  getMeta,
  getProposals,
  getUserMeta,
  saveCapture,
  saveProposal,
  seedDemoCaptures,
  setMeta,
  setUserMeta,
} from './lib/store';
import { buildAnswer } from './lib/answer';
import { applyDecision, moveToTrash, purgeExpiredTrash, scanForProposals } from './lib/forget';
import { computeTagGroups, rebuildSearchText } from './lib/tags';
import { t } from './lib/i18n';
import Onboarding from './components/Onboarding';
import SignInGate from './components/SignInGate';
import BottomNav from './components/BottomNav';
import Memories from './components/Memories';
import Ask from './components/Ask';
import Forget from './components/Forget';
import Trash from './components/Trash';
import DetailSheet from './components/DetailSheet';
import Hud from './components/Hud';
import Toast from './components/Toast';

interface ToastState {
  message: string;
  undo?: () => void;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);
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
  const [trashReturnTab, setTrashReturnTab] = useState<Tab>('forget');
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

  const log = (
    label: string,
    source: HudEvent['source'],
    latencyMs: number,
    detail?: string,
    ownerUidOverride?: string,
  ) => {
    const ownerUid = ownerUidOverride ?? session?.uid;
    const event: HudEvent = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      label,
      source,
      latencyMs,
      detail,
      ...(ownerUid ? { ownerUid } : {}),
    };
    setHudEvents((prev) => [event, ...prev].slice(0, 30));
    void addHudEvent(event).catch((err) => console.warn('[store] addHudEvent failed', err));
  };

  const loadWorkspaceForSession = async (activeSession: AuthSession) => {
    const uid = activeSession.uid;
    if (activeSession.mode === 'google') {
      await cleanupDemoRecordsForUser(uid);
    } else {
      await seedDemoCaptures(true);
    }
    const [
      loadedCaptures,
      loadedProposals,
      loadedHud,
      savedLang,
      savedOnboarding,
      probedNano,
      savedDismissed,
    ] = await Promise.all([
      getCaptures(uid),
      getProposals(uid),
      getHudEvents(uid),
      getUserMeta<Language>(uid, 'language', language),
      getUserMeta<boolean>(uid, 'onboardingDone', false),
      probeNanoAvailability(),
      getUserMeta<string[]>(uid, 'dismissedTagGroups', []),
    ]);

    const syncUid = activeSession.mode === 'google' ? uid : undefined;
    const { active: activeCaptures, purged } = purgeExpiredTrash(loadedCaptures);
    let currentProposals = loadedProposals;
    if (purged.length) {
      const purgedIds = new Set(purged.map((c) => c.id));
      const staleProposals = loadedProposals.filter((p) => purgedIds.has(p.captureId));
      await Promise.all([
        ...purged.map((c) => deleteCapture(c.id).catch((err) => console.warn('[store] purge deleteCapture failed', err))),
        ...staleProposals.map((p) => deleteProposal(p.id).catch((err) => console.warn('[store] purge deleteProposal failed', err))),
        ...purged.map((c) => deleteCaptureMetadata(c.id, syncUid)),
      ]);
      currentProposals = loadedProposals.filter((p) => !purgedIds.has(p.captureId));
    }

    setSession(activeSession);
    setCaptures(activeCaptures);
    setProposals(currentProposals);
    setHudEvents(loadedHud);
    setLanguage(savedLang);
    setOnboardingDone(savedOnboarding);
    setNanoStatus(probedNano);
    setDismissedTagGroups(savedDismissed);

    const fresh = scanForProposals(activeCaptures, settings.duplicateThreshold, currentProposals).map((p) => ({
      ...p,
      ownerUid: uid,
    }));
    for (const proposal of fresh) await saveProposal(proposal);
    if (fresh.length) setProposals([...currentProposals, ...fresh]);

    await syncTagSuggestions(activeCaptures, savedDismissed);
    if (purged.length) {
      setToast({ message: t(savedLang, 'purgedExpiredCount', { n: purged.length }) });
    }
  };

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      try {
        await initFirebase();
        const [savedGlobalLang, cachedSession] = await Promise.all([
          getMeta<Language>('language', 'en'),
          getMeta<AuthSession | null>('activeAuthSession', null),
        ]);
        setLanguage(savedGlobalLang);
        if (cachedSession?.uid) {
          await loadWorkspaceForSession(cachedSession);
        } else {
          setNanoStatus(await probeNanoAvailability());
        }
      } catch (error) {
        console.error('[app] boot initialization failed', error);
      } finally {
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    void setMeta('language', next).catch((err) => console.warn('[store] setMeta(language) failed', err));
    if (session?.uid) {
      void setUserMeta(session.uid, 'language', next).catch((err) =>
        console.warn('[store] setUserMeta(language) failed', err),
      );
    }
  };

  const completeOnboarding = () => {
    setOnboardingDone(true);
    if (session?.uid) {
      void setUserMeta(session.uid, 'onboardingDone', true).catch((err) =>
        console.warn('[store] setUserMeta(onboardingDone) failed', err),
      );
    }
  };

  const handleAuthenticated = async (nextSession: AuthSession) => {
    await setMeta('activeAuthSession', nextSession).catch((err) =>
      console.warn('[store] save activeAuthSession failed', err),
    );
    setTab('memories');
    setSelected(null);
    setToast(null);
    setAccountMenuOpen(false);
    setDeleteAccountConfirm(false);
    await loadWorkspaceForSession(nextSession);
  };

  const handleSignOut = async () => {
    setAccountMenuOpen(false);
    setDeleteAccountConfirm(false);
    await setMeta('activeAuthSession', null).catch(() => undefined);
    await signOutFirebase();
    setSession(null);
    setCaptures([]);
    setProposals([]);
    setHudEvents([]);
    setTagGroups([]);
    setSelected(null);
    setToast(null);
  };

  const handleDeleteAccount = async () => {
    if (!session) return;
    const uid = session.uid;
    const isGoogle = session.mode === 'google';
    const deletedIds = await deleteUserAccountData(uid);
    if (isGoogle) {
      await deleteAllUserMetadata(uid, deletedIds);
    }
    await handleSignOut();
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
      const uid = session?.uid;
      const syncUid = session?.mode === 'google' ? uid : undefined;
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
        ...(session?.mode === 'demo' ? { demo: true } : {}),
        ...(uid ? { ownerUid: uid } : {}),
      };
      await saveCapture(capture);
      const [allCaptures, allProposals] = await Promise.all([getCaptures(uid), getProposals(uid)]);
      setCaptures(allCaptures);
      const fresh = scanForProposals(allCaptures, settings.duplicateThreshold, allProposals).map((p) => ({
        ...p,
        ...(uid ? { ownerUid: uid } : {}),
      }));
      if (fresh.length) {
        for (const proposal of fresh) await saveProposal(proposal);
        setProposals([...allProposals, ...fresh]);
      }
      await syncTagSuggestions(allCaptures, dismissedTagGroups);
      void syncCaptureMetadata([capture], syncUid);
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

  const syncUid = session?.mode === 'google' ? session.uid : undefined;

  const handleDecide = async (proposal: ForgetProposal, decision: Decision) => {
    const previousCapture = captures.find((c) => c.id === proposal.captureId);
    if (!previousCapture) return;
    const updatedCapture = applyDecision(previousCapture, decision, settings.trashRetentionDays);
    const updatedProposal: ForgetProposal = { ...proposal, decided: decision };
    await Promise.all([
      saveCapture(updatedCapture).catch((err) => console.warn('[store] saveCapture failed', err)),
      saveProposal(updatedProposal).catch((err) => console.warn('[store] saveProposal failed', err)),
    ]);
    const nextCaptures = captures.map((c) => (c.id === updatedCapture.id ? updatedCapture : c));
    setCaptures(nextCaptures);
    setProposals((prev) => prev.map((p) => (p.id === updatedProposal.id ? updatedProposal : p)));
    if (decision === 'approve') {
      void syncCaptureMetadata([updatedCapture], syncUid);
      await syncTagSuggestions(nextCaptures, dismissedTagGroups);
    }
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
        const restoredCaptures = nextCaptures.map((c) => (c.id === previousCapture.id ? previousCapture : c));
        setCaptures(restoredCaptures);
        setProposals((prev) => prev.map((p) => (p.id === proposal.id ? proposal : p)));
        if (decision === 'approve') {
          void syncCaptureMetadata([previousCapture], syncUid);
          await syncTagSuggestions(restoredCaptures, dismissedTagGroups);
        }
        setToast(null);
      },
    });
  };

  const handleManualTrash = async (capture: CaptureRecord) => {
    const trashedCapture = moveToTrash(capture, settings.trashRetentionDays, 'manual');
    const pendingForCapture = proposals.filter((p) => p.captureId === capture.id && !p.decided);
    const closedProposals = pendingForCapture.map((p) => ({ ...p, decided: 'manual' as const }));

    await Promise.all([
      saveCapture(trashedCapture).catch((err) => console.warn('[store] manual trash saveCapture failed', err)),
      ...closedProposals.map((p) =>
        saveProposal(p).catch((err) => console.warn('[store] manual trash closeProposal failed', err)),
      ),
    ]);

    const nextCaptures = captures.map((c) => (c.id === trashedCapture.id ? trashedCapture : c));
    const nextProposals = proposals.map((p) => closedProposals.find((u) => u.id === p.id) || p);
    setCaptures(nextCaptures);
    setProposals(nextProposals);
    setSelected((prev) => (prev?.id === trashedCapture.id ? null : prev));
    void syncCaptureMetadata([trashedCapture], syncUid);
    await syncTagSuggestions(nextCaptures, dismissedTagGroups);
    log(t(language, 'sourceManual'), capture.inferenceSource, 0, capture.summary.slice(0, 60));

    setToast({
      message: t(language, 'movedToTrash', { n: settings.trashRetentionDays }),
      undo: async () => {
        await Promise.all([
          saveCapture(capture).catch((err) => console.warn('[store] manual trash undo failed', err)),
          ...pendingForCapture.map((p) =>
            saveProposal(p).catch((err) => console.warn('[store] manual trash undo proposal failed', err)),
          ),
        ]);
        const restoredCaptures = nextCaptures.map((c) => (c.id === capture.id ? capture : c));
        setCaptures(restoredCaptures);
        setProposals((prev) => prev.map((p) => pendingForCapture.find((u) => u.id === p.id) || p));
        void syncCaptureMetadata([capture], syncUid);
        await syncTagSuggestions(restoredCaptures, dismissedTagGroups);
        setToast(null);
      },
    });
  };

  const handlePermanentDelete = async (capture: CaptureRecord) => {
    const relatedProposals = proposals.filter((p) => p.captureId === capture.id);
    await Promise.all([
      deleteCapture(capture.id).catch((err) => console.warn('[store] deleteCapture failed', err)),
      ...relatedProposals.map((p) =>
        deleteProposal(p.id).catch((err) => console.warn('[store] deleteProposal failed', err)),
      ),
      deleteCaptureMetadata(capture.id, syncUid),
    ]);
    const nextCaptures = captures.filter((c) => c.id !== capture.id);
    setCaptures(nextCaptures);
    setProposals((prev) => prev.filter((p) => p.captureId !== capture.id));
    setSelected((prev) => (prev?.id === capture.id ? null : prev));
    await syncTagSuggestions(nextCaptures, dismissedTagGroups);
    log(t(language, 'deletePerm'), capture.inferenceSource, 0, capture.summary.slice(0, 60));
  };

  const handleRestore = async (capture: CaptureRecord) => {
    const restored: CaptureRecord = {
      ...capture,
      retentionState: capture.protectedReason ? 'protected' : 'active',
      trashedAt: undefined,
      purgeAt: undefined,
      trashSource: undefined,
    };
    const affected = proposals.filter(
      (p) => p.captureId === capture.id && (p.decided === 'approve' || p.decided === 'manual'),
    );
    const updatedProposals = affected.map((p) => ({ ...p, decided: 'keep' as const }));
    await Promise.all([
      saveCapture(restored).catch((err) => console.warn('[store] saveCapture restore failed', err)),
      ...updatedProposals.map((proposal) =>
        saveProposal(proposal).catch((err) => console.warn('[store] saveProposal restore failed', err)),
      ),
    ]);
    const nextCaptures = captures.map((c) => (c.id === restored.id ? restored : c));
    setCaptures(nextCaptures);
    if (updatedProposals.length) {
      setProposals((prev) => prev.map((p) => updatedProposals.find((u) => u.id === p.id) || p));
    }
    void syncCaptureMetadata([restored], syncUid);
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
    if (session?.uid) {
      await setUserMeta(session.uid, 'dismissedTagGroups', nextDismissed).catch((err) =>
        console.warn('[store] save dismissedTagGroups failed', err),
      );
    }
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

  if (!session) {
    return (
      <SignInGate
        language={language}
        onLanguageChange={changeLanguage}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  const pendingCount = proposals.filter((p) => !p.decided).length;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-bg">
      <header className="relative flex items-center justify-between px-5 pt-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-white">
            <Fingerprint size={18} />
          </span>
          <span className="text-[13px] font-black tracking-tight">{t(language, 'appName')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeLanguage(language === 'en' ? 'vi' : 'en')}
            aria-label="Toggle language"
            className="inline-flex items-center gap-1.5 rounded-full border border-line2 bg-canvas px-3 py-1.5 text-[11px] font-bold uppercase text-ink2"
          >
            <Languages size={14} /> {language}
          </button>
          <button
            type="button"
            onClick={() => {
              setAccountMenuOpen((open) => !open);
              setDeleteAccountConfirm(false);
            }}
            aria-label="Account menu"
            className="inline-flex max-w-36 items-center gap-1.5 rounded-full border border-line2 bg-canvas px-3 py-1.5 text-[11px] font-bold text-ink2"
          >
            <User size={13} className="shrink-0" />
            <span className="truncate">
              {session.mode === 'demo' ? t(language, 'demoBadge') : session.email || session.uid.slice(0, 8)}
            </span>
          </button>
        </div>

        {accountMenuOpen && (
          <div className="absolute right-5 top-14 z-50 w-64 rounded-2xl border border-line bg-canvas p-3 shadow-xl">
            <p className="truncate text-[11.5px] font-bold text-ink">
              {session.mode === 'demo' ? t(language, 'demoBadge') : session.email || session.uid}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-ink3">uid: {session.uid}</p>
            <div className="mt-2.5 space-y-1.5 border-t border-line pt-2.5">
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex w-full items-center gap-2 rounded-xl bg-surface2 px-3 py-2 text-left text-[12px] font-semibold text-ink hover:bg-line/40"
              >
                <LogOut size={14} /> {t(language, 'signOut')}
              </button>
              {deleteAccountConfirm ? (
                <div className="rounded-xl border border-danger/30 bg-danger-soft p-2">
                  <p className="text-[11px] font-semibold text-danger">{t(language, 'deleteAccountConfirm')}</p>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDeleteAccountConfirm(false)}
                      className="flex-1 rounded-full border border-line bg-canvas py-1 text-[11px] font-bold text-ink2"
                    >
                      {t(language, 'cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAccount()}
                      className="flex-1 rounded-full bg-danger py-1 text-[11px] font-bold text-white"
                    >
                      {t(language, 'deletePerm')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteAccountConfirm(true)}
                  className="flex w-full items-center gap-2 rounded-xl bg-danger-soft/50 px-3 py-2 text-left text-[12px] font-semibold text-danger hover:bg-danger-soft"
                >
                  <Trash2 size={14} /> {t(language, 'deleteAccount')}
                </button>
              )}
            </div>
          </div>
        )}
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
            onManualTrash={handleManualTrash}
            onOpenTrash={() => {
              setTrashReturnTab('memories');
              setTab('trash');
            }}
            trashDays={settings.trashRetentionDays}
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
            onOpenTrash={() => {
              setTrashReturnTab('forget');
              setTab('trash');
            }}
            trashDays={settings.trashRetentionDays}
          />
        )}
        {tab === 'trash' && (
          <Trash
            captures={captures}
            language={language}
            trashDays={settings.trashRetentionDays}
            onBack={() => setTab(trashReturnTab)}
            onRestore={handleRestore}
            onPermanentDelete={handlePermanentDelete}
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
          onManualTrash={handleManualTrash}
          onPermanentDelete={handlePermanentDelete}
          trashDays={settings.trashRetentionDays}
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

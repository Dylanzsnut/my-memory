import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Image,
  Mic,
  MoreVertical,
  NotepadText,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { CaptureRecord, CaptureType, ExtractionRequest, Language, TagGroupProposal } from '../types';
import { extractPhotoCapturedAt } from '../lib/exif';
import { countByType, matchesDateFilter, paginate, type DateFilter, type TypeFilter } from '../lib/dateFilter';
import { tagCollections, recentCaptures, pickInspected, type TagCollection } from '../lib/collections';
import { formatBytes } from '../lib/storage';
import { t } from '../lib/i18n';
import { useDialog } from '../lib/useDialog';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { useMediaQuery } from '../lib/useMediaQuery';
import { SourceBadge } from './Hud';
import TagFilterBar from './TagFilterBar';
import CaptureInspector from './CaptureInspector';

interface Props {
  captures: CaptureRecord[];
  language: Language;
  onCapture: (request: ExtractionRequest) => Promise<void>;
  onOpenDetail: (capture: CaptureRecord, order?: string[]) => void;
  busy: boolean;
  tagGroups?: TagGroupProposal[];
  onAcceptTagGroup?: (group: TagGroupProposal, selectedIds: string[], labelOverride?: string) => Promise<void> | void;
  onDismissTagGroup?: (group: TagGroupProposal) => Promise<void> | void;
  onRefreshTagGroups?: () => void;
  onRenameTagGroup?: (group: TagGroupProposal, label: string) => Promise<void> | void;
  onManualTrash?: (capture: CaptureRecord) => Promise<void> | void;
  onOpenTrash?: () => void;
  trashDays?: number;
  activeTag?: string | null;
  onActiveTagChange?: (tag: string | null) => void;
  captureRequest?: { kind: 'photo' | 'voice' | 'note'; nonce: number };
  displayName?: string | null;
  storageUsage?: number | null;
  technical?: boolean;
  onAskAbout?: (capture: CaptureRecord, question?: string) => void;
  inspectedId?: string | null;
  onInspect?: (id: string) => void;
  previewEnabled?: boolean;
  onTogglePreview?: () => void;
}

const TYPE_STYLE: Record<CaptureType, string> = {
  photo: 'bg-accent-soft text-accent',
  voice: 'bg-teal-soft text-teal',
  note: 'bg-gold-soft text-gold',
};

function typeLabel(language: Language, type: CaptureType): string {
  const key = type === 'photo' ? 'photo' : type === 'voice' ? 'voice' : 'noteType';
  return t(language, key);
}

function greeting(language: Language): string {
  const hour = new Date().getHours();
  const key = hour < 12 ? 'goodMorning' : hour < 18 ? 'goodAfternoon' : 'goodEvening';
  return t(language, key);
}

interface VoiceDraft {
  blob?: Blob;
  mimeType?: string;
  url?: string;
  error?: string;
}

interface ImportProgress {
  active: boolean;
  done: number;
  total: number;
  failed: number;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Unexpected non-string FileReader result'));
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export default function Memories({
  captures,
  language,
  onCapture,
  onOpenDetail,
  busy,
  tagGroups = [],
  onAcceptTagGroup,
  onDismissTagGroup,
  onRefreshTagGroups,
  onRenameTagGroup,
  onManualTrash,
  onOpenTrash,
  trashDays = 30,
  activeTag: sharedActiveTag = null,
  onActiveTagChange,
  captureRequest,
  displayName,
  storageUsage,
  technical = false,
  onAskAbout,
  inspectedId,
  onInspect,
  previewEnabled = false,
  onTogglePreview,
}: Props) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const draftUrlRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(true);
  const recordingPendingRef = useRef(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [recording, setRecording] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [localActiveTag, setLocalActiveTag] = useState<string | null>(null);
  const activeTag = onActiveTagChange ? sharedActiveTag : localActiveTag;
  const setActiveTag = (tag: string | null) => {
    setLocalActiveTag(tag);
    onActiveTagChange?.(tag);
  };
  const [groupSelections, setGroupSelections] = useState<Record<string, string[]>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmTrash, setConfirmTrash] = useState<CaptureRecord | null>(null);
  const [activeDateFilter, setActiveDateFilter] = useState<DateFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [view, setView] = useState<'overview' | 'all' | 'collection'>('overview');
  const [collectionTag, setCollectionTag] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const trashConfirmRef = useRef<HTMLDivElement>(null);
  useDialog(suggestionsRef, suggestionsOpen, () => setSuggestionsOpen(false));
  useDialog(trashConfirmRef, Boolean(confirmTrash), () => setConfirmTrash(null));
  const [groupByTag, setGroupByTag] = useState(false);
  const online = useOnlineStatus();
  // Must match Tailwind's xl breakpoint (80rem).
  const wide = useMediaQuery('(min-width: 80rem)');
  const UNTAGGED = '__untagged__';

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearDraft = () => {
    if (draftUrlRef.current) {
      URL.revokeObjectURL(draftUrlRef.current);
      draftUrlRef.current = undefined;
    }
    setVoiceDraft(null);
    setVoiceText('');
  };

  useEffect(() => {
    if (!openMenuId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest('[data-card-menu]')) setOpenMenuId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenuId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      stopTracks();
      if (draftUrlRef.current) {
        URL.revokeObjectURL(draftUrlRef.current);
        draftUrlRef.current = undefined;
      }
    };
  }, []);

  useEffect(() => {
    if (!captureRequest) return;
    if (captureRequest.kind === 'photo') photoInputRef.current?.click();
    else if (captureRequest.kind === 'voice') void toggleRecording();
    else { clearDraft(); setNoteOpen(true); }
    // Respond only to a new request, not to unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureRequest?.nonce]);

  const handlePhotoBatch = async (files: FileList | null) => {
    if (!files?.length || busy || importProgress?.active) return;
    const queue = Array.from(files);
    if (queue.length === 1) {
      try {
        const [imageDataUrl, capturedAt] = await Promise.all([
          readFileAsDataUrl(queue[0]),
          extractPhotoCapturedAt(queue[0]),
        ]);
        await onCapture({ type: 'photo', imageDataUrl, capturedAt });
      } catch (err) {
        console.warn('[memories] photo capture failed', err);
        if (mountedRef.current) setImportProgress({ active: false, done: 1, total: 1, failed: 1 });
      }
      return;
    }
    let failed = 0;
    setImportProgress({ active: true, done: 0, total: queue.length, failed: 0 });
    for (let i = 0; i < queue.length; i++) {
      try {
        const [imageDataUrl, capturedAt] = await Promise.all([
          readFileAsDataUrl(queue[i]),
          extractPhotoCapturedAt(queue[i]),
        ]);
        await onCapture({ type: 'photo', imageDataUrl, capturedAt });
      } catch (err) {
        failed += 1;
        console.warn('[memories] gallery import item failed', err);
      }
      if (mountedRef.current) {
        setImportProgress({ active: i + 1 < queue.length, done: i + 1, total: queue.length, failed });
      }
    }
    if (mountedRef.current && failed === 0) setImportProgress(null);
  };

  const toggleRecording = async () => {
    if (recording) {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      else { stopTracks(); setRecording(false); }
      return;
    }
    if (recordingPendingRef.current || busy) return;
    recordingPendingRef.current = true;
    clearDraft();
    setNoteOpen(false);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      recordingPendingRef.current = false;
      setVoiceDraft({ error: t(language, 'voiceUnavailable') });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      chunksRef.current = [];
      const preferredMime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((mime) =>
        MediaRecorder.isTypeSupported(mime),
      );
      const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopTracks();
        recorderRef.current = null;
        if (!mountedRef.current) return;
        const mimeType = recorder.mimeType || preferredMime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        const url = URL.createObjectURL(blob);
        draftUrlRef.current = url;
        setRecording(false);
        setVoiceDraft({ blob, mimeType, url });
      };
      recorder.start();
      setRecording(true);
    } catch {
      stopTracks();
      if (mountedRef.current) {
        setRecording(false);
        setVoiceDraft({ error: t(language, 'voiceUnavailable') });
      }
    } finally {
      recordingPendingRef.current = false;
    }
  };

  const visibleCaptures = captures.filter((c) => c.retentionState !== 'trashed');
  const trashedCount = captures.length - visibleCaptures.length;
  const allTags = Array.from(new Set(visibleCaptures.flatMap((c) => c.tags || []))).sort((a, b) =>
    a.localeCompare(b),
  );
  const hasUntagged = visibleCaptures.some((c) => !(c.tags || []).length);
  const untaggedCount = visibleCaptures.filter((c) => !(c.tags || []).length).length;
  const tagCounts = new Map<string, number>();
  visibleCaptures.forEach((capture) => {
    (capture.tags || []).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
  });
  const tagOptions = Array.from(tagCounts, ([tag, count]) => ({ tag, count }));
  const typeCounts = countByType(visibleCaptures);
  const selectedTag = activeTag && (activeTag === UNTAGGED || allTags.includes(activeTag)) ? activeTag : null;
  const tagFiltered = !selectedTag
    ? visibleCaptures
    : selectedTag === UNTAGGED
      ? visibleCaptures.filter((c) => !(c.tags || []).length)
      : visibleCaptures.filter((c) => (c.tags || []).includes(selectedTag));
  const typeFiltered = typeFilter === 'all' ? tagFiltered : tagFiltered.filter((c) => c.type === typeFilter);
  const dateFiltered = typeFiltered.filter((c) => matchesDateFilter(c.capturedAt, activeDateFilter));
  const collections: TagCollection[] = tagCollections(visibleCaptures);
  const recent = recentCaptures(visibleCaptures);
  const collectionItems = collectionTag
    ? dateFiltered.filter((c) => (c.tags || []).includes(collectionTag))
    : dateFiltered;
  const gridItems = (view === 'collection' ? collectionItems : view === 'all' ? dateFiltered : []);
  const pagedItems = paginate(gridItems, page, 60);
  const hasMore = pagedItems.length < gridItems.length;
  const visibleIds = gridItems.length ? gridItems.map((capture) => capture.id) : visibleCaptures.map((capture) => capture.id);
  const previewSource = view === 'overview' ? visibleCaptures : gridItems;
  const inspectedCapture = wide && previewEnabled
    ? pickInspected(previewSource, inspectedId ?? null)
    : null;
  const resetPaging = () => setPage(0);

  // Group-by-tag is a view only: each capture appears once, under its first tag.
  const tagSections: { tag: string; items: CaptureRecord[] }[] = [];
  if (groupByTag) {
    for (const tag of [...allTags, ...(hasUntagged ? [UNTAGGED] : [])]) {
      const items = dateFiltered.filter((c) =>
        tag === UNTAGGED ? !(c.tags || []).length : (c.tags || [])[0] === tag,
      );
      if (items.length) tagSections.push({ tag, items });
    }
  }

  const renderCardMenu = (capture: CaptureRecord) =>
    onManualTrash ? (
      <div className="relative shrink-0" data-card-menu>
        <button
          type="button"
          onClick={() => setOpenMenuId((id) => (id === capture.id ? null : capture.id))}
          aria-label={t(language, 'cardActions')}
          aria-expanded={openMenuId === capture.id}
          className="grid min-h-11 min-w-11 place-items-center rounded-full p-1 text-ink2 transition-colors hover:bg-surface2"
        >
          <MoreVertical size={16} />
        </button>
        {openMenuId === capture.id && (
          <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-line bg-canvas p-1 shadow-lg">
            <button
              type="button"
              onClick={() => { setOpenMenuId(null); setConfirmTrash(capture); }}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-[12px] font-semibold text-danger hover:bg-danger-soft"
            >
              <Trash2 size={14} /> {t(language, 'moveToTrash')}
            </button>
          </div>
        )}
      </div>
    ) : null;

  const openCapture = (capture: CaptureRecord) => {
    if (wide && previewEnabled && onInspect) onInspect(capture.id);
    else onOpenDetail(capture, visibleIds);
  };

  const renderCaptureCard = (capture: CaptureRecord) => (
    <div
      key={capture.id}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-canvas shadow-sm transition-all hover:border-line2 hover:shadow-md ${
        wide && previewEnabled && inspectedId === capture.id ? 'xl:ring-2 xl:ring-accent/40' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => openCapture(capture)}
        aria-label={capture.summary}
        className="block w-full text-left"
      >
        {capture.originalRef && capture.type === 'photo' ? (
          <img
            src={capture.originalRef}
            alt=""
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full bg-surface2 object-cover"
          />
        ) : (
          <div className={`flex aspect-[4/3] w-full items-center justify-center ${TYPE_STYLE[capture.type]}`}>
            {capture.type === 'voice' ? <Mic size={48} /> : <NotepadText size={48} />}
          </div>
        )}
        <div className="flex flex-col gap-1.5 p-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TYPE_STYLE[capture.type]}`}>
              {typeLabel(language, capture.type)}
            </span>
            {capture.protectedReason && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2 py-0.5 text-[10px] font-bold text-teal">
                <ShieldCheck size={11} /> {t(language, 'alwaysProtected')}
              </span>
            )}
            {capture.demo && (
              <span className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-semibold text-ink3">
                {t(language, 'demoData')}
              </span>
            )}
          </div>
          <p className="line-clamp-2 break-words text-[14px] font-bold leading-snug">{capture.summary}</p>
          {capture.derivedText && (
            <p className="line-clamp-2 text-[12px] leading-snug text-ink2">{capture.derivedText}</p>
          )}
          {capture.tags && capture.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {capture.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-teal-soft px-2 py-0.5 text-[10px] font-bold text-teal">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <SourceBadge source={capture.inferenceSource} language={language} plain={!technical} />
            <span className="text-[11px] text-ink3">
              {new Date(capture.capturedAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
                day: 'numeric', month: 'short',
              })}
            </span>
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1 border-t border-line px-3 py-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onOpenDetail(capture, visibleIds)}
          aria-label={t(language, 'viewEvidence')}
          className="grid min-h-11 min-w-11 place-items-center rounded-full text-accent hover:bg-accent-soft"
        >
          <Sparkles size={15} />
        </button>
        {onAskAbout && (
          <button
            type="button"
            onClick={() => onAskAbout(capture)}
            aria-label={t(language, 'askAboutCapture')}
            className="grid min-h-11 min-w-11 place-items-center rounded-full text-teal hover:bg-teal-soft"
          >
            <Image size={15} />
          </button>
        )}
        <div className="ml-auto">{renderCardMenu(capture)}</div>
      </div>
    </div>
  );

  const cardGrid = 'grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(17.5rem,1fr))] items-start';

  const renderGrid = (items: CaptureRecord[]) => (
    <div className={cardGrid}>
      {items.map(renderCaptureCard)}
    </div>
  );

  const renderSection = (title: string, items: CaptureRecord[], badge?: string) => (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2 className="font-serif text-[17px] font-bold tracking-tight">{title}</h2>
        <span className="shrink-0 rounded-full border border-line bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink2">
          {badge || `${items.length} ${t(language, 'groupEntries')}`}
        </span>
      </div>
      {renderGrid(items)}
    </section>
  );

  const dateOptions: { value: DateFilter; key: 'anyTime' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'older' }[] = [
    { value: 'all', key: 'anyTime' },
    { value: 'week', key: 'thisWeek' },
    { value: 'month', key: 'thisMonth' },
    { value: 'year', key: 'thisYear' },
    { value: 'older', key: 'older' },
  ];
  const typeOptions: TypeFilter[] = ['all', 'photo', 'voice', 'note'];
  const typeLabelFor = (value: TypeFilter) =>
    value === 'all' ? t(language, 'allMemoriesCount') : t(language, value === 'photo' ? 'photosCount' : value === 'voice' ? 'voiceCount' : 'notesCount');

  const filtersActive = activeDateFilter !== 'all' || typeFilter !== 'all' || Boolean(selectedTag);

  return (
    <div className={`flex flex-col gap-5 ${previewEnabled && wide && inspectedCapture ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start xl:gap-8' : ''}`}>
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3 md:rounded-3xl md:border md:border-line md:bg-canvas md:p-5 md:shadow-sm">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-ink3">
              {greeting(language)}
              {displayName ? `, ${displayName.trim().split(/\s+/)[0]}` : ''}
            </p>
            <h1 className="font-serif text-[26px] font-bold leading-tight tracking-tight">
              {view === 'collection' && collectionTag
                ? `#${collectionTag}`
                : view === 'all'
                  ? t(language, 'allMemoriesView')
                  : t(language, 'overview')}
            </h1>
            <p className="mt-1 text-[12px] text-ink2">
              {t(language, 'momentsRemembered', { n: visibleCaptures.length })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setView('overview'); setActiveTag(null); resetPaging(); }}
              aria-pressed={view === 'overview'}
              className={`inline-flex min-h-11 items-center rounded-full border px-3 text-[11px] font-bold ${view === 'overview' ? 'border-teal bg-teal text-white' : 'border-line bg-canvas text-ink2'}`}
            >
              {t(language, 'overview')}
            </button>
            <button
              type="button"
              onClick={() => { setView('all'); setActiveTag(null); resetPaging(); }}
              aria-pressed={view === 'all'}
              className={`inline-flex min-h-11 items-center rounded-full border px-3 text-[11px] font-bold ${view === 'all' ? 'border-teal bg-teal text-white' : 'border-line bg-canvas text-ink2'}`}
            >
              {t(language, 'allMemoriesView')}
            </button>
            {onTogglePreview && (
              <button
                type="button"
                onClick={onTogglePreview}
                aria-label={t(language, 'ariaTogglePreview')}
                aria-pressed={previewEnabled}
                className="hidden min-h-11 items-center gap-1 rounded-full border border-line bg-canvas px-3 text-[11px] font-bold text-ink2 xl:inline-flex"
              >
                <Image size={13} /> {previewEnabled ? t(language, 'hidePreviewPanel') : t(language, 'showPreviewPanel')}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={busy || Boolean(importProgress?.active)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent-soft px-3.5 text-[11.5px] font-bold text-accent disabled:opacity-50"
          >
            <Image size={14} /> {t(language, 'photo')}
          </button>
          <button
            type="button"
            onClick={toggleRecording}
            disabled={(busy || Boolean(importProgress?.active)) && !recording}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[11.5px] font-bold disabled:opacity-50 ${recording ? 'bg-danger-soft text-danger' : 'bg-teal-soft text-teal'}`}
          >
            <Mic size={14} /> {recording ? t(language, 'recording') : t(language, 'record')}
          </button>
          <button
            type="button"
            onClick={() => { if (!noteOpen) clearDraft(); setNoteOpen(!noteOpen); }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-gold-soft px-3.5 text-[11.5px] font-bold text-gold"
          >
            <NotepadText size={14} /> {t(language, 'note')}
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => { void handlePhotoBatch(event.target.files); event.target.value = ''; }}
          />
          <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10.5px] font-bold uppercase ${online ? 'bg-teal-soft text-teal' : 'bg-gold-soft text-gold'}`}>
            <span className={`h-1.5 w-1.5 animate-pulse-dot rounded-full ${online ? 'bg-teal' : 'bg-gold'}`} />
            {t(language, online ? 'onlineLive' : 'offlineLive')}
          </span>
          {technical && storageUsage != null && (
            <span className="rounded-full bg-surface2 px-3 py-1.5 text-[10.5px] font-bold text-ink2">
              {formatBytes(storageUsage)}
            </span>
          )}
        </div>

        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-canvas/95 px-3 py-2 shadow-sm backdrop-blur">
          <div className="relative">
            <button
              type="button"
              onClick={() => { setTypesOpen(!typesOpen); setTagsOpen(false); setDatesOpen(false); }}
              aria-expanded={typesOpen}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface2 px-3 text-[11px] font-bold text-ink2"
            >
              {typeLabelFor(typeFilter)} <span className="rounded-full bg-canvas px-1.5">{typeCounts[typeFilter]}</span>
            </button>
            {typesOpen && (
              <div className="absolute left-0 top-12 z-30 w-44 rounded-xl border border-line bg-canvas p-1 shadow-lg">
                {typeOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setTypeFilter(value); resetPaging(); setTypesOpen(false); }}
                    className="flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 text-[12px] font-semibold text-ink2 hover:bg-surface2"
                  >
                    {typeLabelFor(value)} <span className="text-ink3">{typeCounts[value]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => { setDatesOpen(!datesOpen); setTagsOpen(false); setTypesOpen(false); }}
              aria-expanded={datesOpen}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface2 px-3 text-[11px] font-bold text-ink2"
            >
              {t(language, dateOptions.find((option) => option.value === activeDateFilter)!.key)}
            </button>
            {datesOpen && (
              <div className="absolute left-0 top-12 z-30 w-44 rounded-xl border border-line bg-canvas p-1 shadow-lg">
                {dateOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => { setActiveDateFilter(option.value); resetPaging(); setDatesOpen(false); }}
                    className="flex min-h-11 w-full items-center rounded-lg px-2.5 text-[12px] font-semibold text-ink2 hover:bg-surface2"
                  >
                    {t(language, option.key)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => { setTagsOpen(!tagsOpen); setDatesOpen(false); setTypesOpen(false); }}
              aria-expanded={tagsOpen}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface2 px-3 text-[11px] font-bold text-ink2"
            >
              <Tag size={13} /> {selectedTag && selectedTag !== UNTAGGED ? `#${selectedTag}` : selectedTag === UNTAGGED ? t(language, 'untagged') : t(language, 'allTags')}
            </button>
            {tagsOpen && (
              <div className="absolute left-0 top-12 z-30 w-64 rounded-xl border border-line bg-canvas p-2 shadow-lg">
                <div className="max-h-72 overflow-y-auto">
                  <TagFilterBar
                    language={language}
                    tags={tagOptions}
                    activeTag={selectedTag}
                    onSelect={(tag) => { setActiveTag(tag); resetPaging(); setTagsOpen(false); }}
                    showUntagged={hasUntagged}
                    untaggedValue={UNTAGGED}
                    untaggedCount={untaggedCount}
                    collapsedCount={50}
                  />
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setGroupByTag(!groupByTag)}
            aria-pressed={groupByTag}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold ${groupByTag ? 'border-teal bg-teal text-white' : 'border-line bg-canvas text-ink2'}`}
          >
            <Tag size={13} /> {t(language, 'groupByTag')}
          </button>
          {tagGroups.length > 0 && (
            <button
              type="button"
              onClick={() => setSuggestionsOpen(true)}
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-accent-soft px-3 text-[11px] font-bold text-accent"
            >
              <Sparkles size={13} /> {t(language, 'suggestedTagsPill', { n: tagGroups.length })}
            </button>
          )}
          {onOpenTrash && trashedCount > 0 && (
            <button
              type="button"
              onClick={onOpenTrash}
              aria-label={t(language, 'openTrash', { n: trashedCount })}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-canvas px-3 text-[11px] font-bold text-ink2"
            >
              <Trash2 size={13} /> {trashedCount}
            </button>
          )}
          {onRefreshTagGroups && tagGroups.length > 0 && (
            <button
              type="button"
              onClick={onRefreshTagGroups}
              aria-label={t(language, 'refreshGroups')}
              className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line bg-canvas text-ink2"
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>

        {filtersActive && view !== 'overview' && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink2">
            <span className="font-bold">{t(language, 'activeFilters')}:</span>
            {typeFilter !== 'all' && <span className="rounded-full bg-surface2 px-2 py-0.5">{typeLabelFor(typeFilter)}</span>}
            {activeDateFilter !== 'all' && <span className="rounded-full bg-surface2 px-2 py-0.5">{t(language, dateOptions.find((option) => option.value === activeDateFilter)!.key)}</span>}
            {selectedTag && <span className="rounded-full bg-surface2 px-2 py-0.5">#{selectedTag === UNTAGGED ? t(language, 'untagged') : selectedTag}</span>}
            <button
              type="button"
              onClick={() => { setActiveTag(null); setActiveDateFilter('all'); setTypeFilter('all'); resetPaging(); }}
              className="min-h-11 rounded-full px-2 font-bold text-accent"
            >
              {t(language, 'clearAll')}
            </button>
          </div>
        )}

        {importProgress && (
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface2 px-3 py-2 text-[11.5px]">
            <span className={importProgress.failed > 0 && !importProgress.active ? 'font-semibold text-danger' : 'font-semibold text-ink2'}>
              {importProgress.active
                ? t(language, 'importingPhotos', { done: importProgress.done, total: importProgress.total })
                : t(language, 'importFailed', { n: importProgress.failed })}
            </span>
            {!importProgress.active && (
              <button type="button" onClick={() => setImportProgress(null)} aria-label={t(language, 'cancel')} className="grid min-h-11 min-w-11 place-items-center rounded-full text-ink3 hover:bg-surface2 hover:text-ink">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {busy && !importProgress?.active && (
          <div className="flex items-center gap-2 rounded-xl border border-teal/30 bg-teal-soft px-3 py-2 text-[11.5px] font-semibold text-teal">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-teal" />
            {t(language, 'extractingCapture')}
          </div>
        )}

        {voiceDraft && (
          <div className="animate-sheet rounded-2xl border border-line bg-canvas p-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold">{t(language, 'newVoiceMemo')}</span>
              <button type="button" onClick={clearDraft} aria-label={t(language, 'cancel')} className="grid min-h-11 min-w-11 place-items-center rounded-full text-ink3 hover:bg-surface2 hover:text-ink">
                <X size={16} />
              </button>
            </div>
            {voiceDraft.error ? (
              <p className="mt-2 rounded-xl bg-accent-soft px-3 py-2 text-[11.5px] leading-snug text-accent">{voiceDraft.error}</p>
            ) : (
              <>
                <p className="mt-1.5 text-[11px] text-ink2">{t(language, 'voiceRecordHint')}</p>
                {voiceDraft.url && <audio controls src={voiceDraft.url} className="mt-2 w-full" />}
                <textarea
                  value={voiceText}
                  onChange={(event) => setVoiceText(event.target.value)}
                  placeholder={t(language, 'voiceMemoPlaceholder')}
                  className="mt-2 min-h-16 w-full rounded-xl border border-line bg-surface2 p-2 text-base outline-none"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await onCapture({ type: 'voice', audioBlob: voiceDraft.blob, audioMimeType: voiceDraft.mimeType, text: voiceText.trim() });
                      clearDraft();
                    } catch (err) { console.warn('[memories] voice capture failed', err); }
                  }}
                  className="mt-2 w-full rounded-full bg-accent py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
                >
                  {t(language, 'save')}
                </button>
              </>
            )}
          </div>
        )}

        {noteOpen && (
          <div className="animate-sheet rounded-2xl border border-line bg-canvas p-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold">{t(language, 'newNote')}</span>
              <button type="button" onClick={() => setNoteOpen(false)} aria-label={t(language, 'cancel')} className="grid min-h-11 min-w-11 place-items-center rounded-full text-ink3 hover:bg-surface2 hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <textarea
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder={t(language, 'notePlaceholder')}
              className="mt-2 min-h-20 w-full rounded-xl border border-line bg-surface2 p-2 text-base outline-none"
            />
            <button
              type="button"
              disabled={busy || !noteText.trim()}
              onClick={async () => {
                try {
                  await onCapture({ type: 'note', text: noteText.trim() });
                  setNoteText('');
                  setNoteOpen(false);
                } catch (err) { console.warn('[memories] note capture failed', err); }
              }}
              className="mt-2 w-full rounded-full bg-accent py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
            >
              {t(language, 'save')}
            </button>
          </div>
        )}

        {visibleCaptures.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line2 bg-canvas/60 px-5 py-8 text-center">
            <p className="font-serif text-[17px] font-bold">{t(language, 'emptyMemoryTitle')}</p>
            <p className="mx-auto mt-1 max-w-xs text-[11.5px] leading-snug text-ink2">{t(language, 'emptyMemoryBody')}</p>
          </div>
        )}

        {view === 'overview' && visibleCaptures.length > 0 && (
          <>
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-[17px] font-bold">{t(language, 'recent')}</h2>
                <button
                  type="button"
                  onClick={() => { setView('all'); resetPaging(); }}
                  className="min-h-11 rounded-full px-3 text-[11px] font-bold text-accent"
                >
                  {t(language, 'seeAll')} →
                </button>
              </div>
              {renderGrid(recent)}
            </section>
            <section className="space-y-2.5">
              <h2 className="font-serif text-[17px] font-bold">{t(language, 'collections')}</h2>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))]">
                {collections.map((collection) => (
                  <button
                    key={collection.tag}
                    type="button"
                    onClick={() => { setCollectionTag(collection.tag); setActiveTag(collection.tag); setView('collection'); resetPaging(); }}
                    className="flex min-h-28 flex-col justify-between overflow-hidden rounded-2xl border border-line bg-canvas p-3 text-left shadow-sm hover:border-accent"
                  >
                    {collection.cover && <img src={collection.cover} alt="" loading="lazy" className="h-20 w-full rounded-xl object-cover" />}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="truncate text-[13px] font-bold">#{collection.tag}</span>
                      <span className="rounded-full bg-surface2 px-2 text-[11px] font-bold text-ink2">{collection.count}</span>
                    </div>
                  </button>
                ))}
                {hasUntagged && (
                  <button
                    type="button"
                    onClick={() => { setView('all'); setActiveTag(UNTAGGED); resetPaging(); }}
                    className="flex min-h-28 flex-col justify-between rounded-2xl border border-dashed border-line2 bg-canvas/60 p-3 text-left"
                  >
                    <span className="text-[13px] font-bold">{t(language, 'untagged')}</span>
                    <span className="text-[11px] text-ink2">{untaggedCount} {t(language, 'untaggedHint')}</span>
                  </button>
                )}
              </div>
            </section>
          </>
        )}

        {view !== 'overview' && groupByTag && tagSections.map(({ tag, items }) =>
          renderSection(tag === UNTAGGED ? t(language, 'untagged') : `#${tag}`, items),
        )}

        {view !== 'overview' && !groupByTag && gridItems.length > 0 && (
          <section className="space-y-3">
            {view === 'collection' && (
              <button
                type="button"
                onClick={() => { setView('overview'); setActiveTag(null); }}
                className="min-h-11 rounded-full px-3 text-[11px] font-bold text-accent"
              >
                ← {t(language, 'backToOverview')}
              </button>
            )}
            {renderGrid(pagedItems)}
            {hasMore && (
              <button
                type="button"
                onClick={() => setPage((value) => value + 1)}
                className="mx-auto flex min-h-11 items-center rounded-full border border-line bg-canvas px-5 text-[12px] font-bold text-ink2"
              >
                {t(language, 'showMore')} ({gridItems.length - pagedItems.length})
              </button>
            )}
          </section>
        )}

        {gridItems.length === 0 && visibleCaptures.length > 0 && (
          <div className="rounded-2xl border border-dashed border-line2 bg-canvas/60 px-5 py-6 text-center">
            <p className="text-[13px] font-bold">{t(language, 'emptyFilterTitle')}</p>
            <p className="mt-1 text-[11.5px] text-ink2">{t(language, 'emptyFilterBody')}</p>
            <button
              type="button"
              onClick={() => { setActiveTag(null); setActiveDateFilter('all'); setTypeFilter('all'); resetPaging(); }}
              className="mt-3 inline-flex min-h-11 items-center rounded-full bg-accent-soft px-4 text-[11.5px] font-bold text-accent"
            >
              {t(language, 'clearFilters')}
            </button>
          </div>
        )}
      </div>

      {previewEnabled && wide && inspectedCapture && (
        <CaptureInspector
          capture={inspectedCapture}
          language={language}
          onExpand={() => onOpenDetail(inspectedCapture, visibleIds)}
          onAskAbout={(question) => onAskAbout?.(inspectedCapture, question)}
          onAskPinned={() => onAskAbout?.(inspectedCapture)}
          technical={technical}
        />
      )}
      {suggestionsOpen && tagGroups.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onClick={() => setSuggestionsOpen(false)}>
          <div ref={suggestionsRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t(language, 'groupsTitle')} className="animate-sheet flex max-h-[82dvh] w-full max-w-lg flex-col rounded-t-3xl border border-line bg-canvas p-4 shadow-xl outline-none sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2">
              <h2 className="flex items-center gap-1.5 text-[14px] font-bold">
                <Sparkles size={14} className="text-accent" /> {t(language, 'groupsTitle')}
              </h2>
              <button type="button" onClick={() => setSuggestionsOpen(false)} aria-label={t(language, 'cancel')} className="grid min-h-11 min-w-11 place-items-center rounded-full text-ink3 hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2.5 overflow-y-auto pr-0.5">
              {tagGroups.map((group) => {
                const members = group.captureIds.map((id) => visibleCaptures.find((c) => c.id === id)).filter(Boolean) as CaptureRecord[];
                if (members.length < 2) return null;
                const selectedIds = groupSelections[group.id] ?? members.map((m) => m.id);
                const isRenaming = renamingId === group.id;
                const commitSuggestedRename = () => {
                  const next = renameValue.trim().replace(/^#+/, '');
                  setRenamingId(null);
                  if (next && next !== group.label) onRenameTagGroup?.(group, next);
                };
                return (
                  <div key={group.id} className="rounded-xl border border-line bg-surface2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={13} className="text-accent" />
                        {isRenaming ? (
                          <input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitSuggestedRename(); }}
                            onBlur={commitSuggestedRename}
                            aria-label={t(language, 'renameGroup')}
                            className="min-h-11 w-36 rounded-lg border border-accent bg-canvas px-2 py-0.5 text-base font-bold outline-none"
                          />
                        ) : (
                          <span className="rounded-full border border-dashed border-accent bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent">
                            #{group.label}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-ink3">{t(language, 'match')} {group.meanSimilarity.toFixed(2)}</span>
                    </div>
                    <div className="mt-2.5 space-y-1.5">
                      {members.map((member) => {
                        const checked = selectedIds.includes(member.id);
                        return (
                          <label key={member.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[11.5px]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = checked ? selectedIds.filter((id) => id !== member.id) : [...selectedIds, member.id];
                                setGroupSelections((prev) => ({ ...prev, [group.id]: next }));
                              }}
                              className="accent-teal"
                            />
                            {member.originalRef && member.type === 'photo' ? (
                              <img src={member.originalRef} alt="" loading="lazy" decoding="async" className="h-7 w-7 shrink-0 rounded object-cover" />
                            ) : null}
                            <span className="min-w-0 flex-1 truncate font-medium text-ink">{member.summary}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-2.5 flex items-center gap-1.5">
                      {onAcceptTagGroup && (
                        <button
                          type="button"
                          disabled={selectedIds.length === 0}
                          onClick={() => { void onAcceptTagGroup(group, selectedIds); setRenamingId(null); }}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full bg-teal py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
                        >
                          <Check size={13} /> {t(language, 'acceptGroup')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isRenaming) setRenamingId(null);
                          else { setRenamingId(group.id); setRenameValue(group.label); }
                        }}
                        className="inline-flex min-h-11 items-center justify-center gap-1 rounded-full border border-line bg-canvas px-3 py-1.5 text-[11px] font-bold text-ink2"
                      >
                        <Pencil size={12} /> {t(language, 'renameGroup')}
                      </button>
                      {onDismissTagGroup && (
                        <button
                          type="button"
                          onClick={() => { setRenamingId(null); void onDismissTagGroup(group); }}
                          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-full border border-line bg-canvas px-3 py-1.5 text-[11px] font-bold text-ink3 hover:text-ink"
                        >
                          {t(language, 'dismissGroup')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {confirmTrash && onManualTrash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={() => setConfirmTrash(null)}>
          <div ref={trashConfirmRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t(language, 'deleteConfirmTitle')} className="animate-sheet w-full max-w-sm rounded-2xl border border-line bg-canvas p-4 shadow-xl outline-none" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[14px] font-bold text-ink">{t(language, 'deleteConfirmTitle')}</h2>
            <p className="mt-1 truncate text-[12px] font-semibold text-ink2">{confirmTrash.summary}</p>
            <p className={`mt-2 rounded-xl p-2.5 text-[11.5px] leading-snug ${confirmTrash.protectedReason ? 'bg-danger-soft text-danger font-semibold' : 'bg-surface2 text-ink2'}`}>
              {confirmTrash.protectedReason
                ? t(language, 'deleteConfirmProtected', { reason: confirmTrash.protectedReason, days: trashDays })
                : t(language, 'deleteConfirmBody', { days: trashDays })}
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setConfirmTrash(null)} className="min-h-11 flex-1 rounded-full border border-line bg-canvas py-1.5 text-[11.5px] font-bold text-ink2">
                {t(language, 'cancel')}
              </button>
              <button
                type="button"
                onClick={() => { const target = confirmTrash; setConfirmTrash(null); void onManualTrash(target); }}
                className="min-h-11 flex-1 rounded-full bg-danger py-1.5 text-[11.5px] font-bold text-white"
              >
                {t(language, 'confirmMoveToTrash')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

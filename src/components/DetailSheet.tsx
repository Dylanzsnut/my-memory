import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { CaptureRecord, CaptureType, Language } from '../types';
import { normalize } from '../lib/embeddings';
import { t } from '../lib/i18n';
import { prepareEntityTag, type EntityTagProposal } from '../lib/tags';
import { buildCopyText, askSuggestions } from '../lib/captureView';
import { navTarget } from '../lib/dateFilter';
import { useDialog } from '../lib/useDialog';
import { SourceBadge } from './Hud';
import CaptureMedia from './capture/CaptureMedia';

// < md: bottom sheet · md–lg: right drawer · >= lg: centred window.
// Kept as arrays so each breakpoint's overrides are easy to review.
const OVERLAY = [
  'fixed inset-0 z-40 flex bg-ink/50 items-end justify-center',
  'md:items-stretch md:justify-end',
  'lg:items-center lg:justify-center lg:p-8 lg:backdrop-blur-sm',
].join(' ');
const PANEL = [
  'animate-sheet flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-canvas shadow-2xl outline-none',
  'md:animate-drawer md:h-dvh md:max-h-none md:max-w-md md:rounded-none md:rounded-l-3xl md:border-y-0 md:border-r-0',
  'lg:animate-sheet lg:h-auto lg:max-h-[90dvh] lg:max-w-[90vw] lg:rounded-3xl lg:border xl:max-w-[1400px]',
].join(' ');

function typeLabel(language: Language, type: CaptureType): string {
  const key = type === 'photo' ? 'photo' : type === 'voice' ? 'voice' : 'noteType';
  return t(language, key);
}

interface Props {
  capture: CaptureRecord;
  order?: string[];
  onNavigate?: (id: string) => void;
  language: Language;
  onClose: () => void;
  onAskAbout: (capture: CaptureRecord, question?: string) => void;
  onUpdateTags?: (capture: CaptureRecord, nextTags: string[]) => Promise<void> | void;
  onManualTrash?: (capture: CaptureRecord) => Promise<void> | void;
  onToast?: (message: string) => void;
  technical?: boolean;
  trashDays?: number;
}

interface ContentProps extends Omit<Props, 'order' | 'onNavigate' | 'onClose' | 'onToast'> {
  setLightboxOpen: (open: boolean) => void;
  confirmTrash: boolean;
  setConfirmTrash: (open: boolean) => void;
}

function DetailContent({
  capture,
  language,
  onAskAbout,
  onUpdateTags,
  onManualTrash,
  trashDays = 30,
  setLightboxOpen,
  confirmTrash,
  setConfirmTrash,
}: ContentProps) {
  const [tagInput, setTagInput] = useState('');
  const [askInput, setAskInput] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [tagEditValue, setTagEditValue] = useState('');

  const suggestedTags = capture.suggestedTags || [];
  const userTags = capture.tags || [];

  const entityChipsMap = new Map<string, EntityTagProposal>();
  for (const entity of capture.entities) {
    const proposal = prepareEntityTag(entity, userTags, capture);
    if (!proposal) continue;
    const key = normalize(proposal.label);
    const existing = entityChipsMap.get(key);
    if (!existing || (existing.state !== 'tagged' && proposal.state === 'tagged')) {
      entityChipsMap.set(key, proposal);
    }
  }
  const entityChips = Array.from(entityChipsMap.values());

  const addTag = () => {
    const proposal = prepareEntityTag(tagInput, userTags, capture);
    setTagInput('');
    if (!proposal || proposal.state !== 'add' || !onUpdateTags) return;
    void onUpdateTags(capture, [...userTags, proposal.label]);
  };

  const removeTag = (target: string) => {
    if (!onUpdateTags) return;
    const normTarget = normalize(target);
    void onUpdateTags(capture, userTags.filter((existing) => normalize(existing) !== normTarget));
  };

  const commitTagRename = (target: string) => {
    const next = tagEditValue.trim().replace(/^#+/, '');
    setEditingTag(null);
    if (!onUpdateTags || !next || normalize(next) === normalize(target)) return;
    if (userTags.some((tag) => normalize(tag) === normalize(next))) return;
    void onUpdateTags(capture, userTags.map((tag) => (tag === target ? next : tag)));
  };

  return (
    <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6 lg:space-y-0">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink2">
          <span>{t(language, 'captured')}: {new Date(capture.capturedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}</span>
          <span>·</span>
          <span>{typeLabel(language, capture.type)}</span>
          {capture.protectedReason && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-bold text-teal">
              <ShieldCheck size={11} /> {t(language, 'alwaysProtected')}
            </span>
          )}
        </div>
        <CaptureMedia
          capture={capture}
          language={language}
          fit="contain"
          onExpand={capture.originalRef && capture.type === 'photo' ? () => setLightboxOpen(true) : undefined}
        />
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-line bg-surface2 p-4">
          <h2 className="text-[13px] font-bold">{t(language, 'whatWeFound')}</h2>
          <p className="mt-2 font-serif text-[14px] font-semibold leading-snug">“{capture.summary}”</p>
          {capture.derivedText && (
            <p className="mt-2 border-t border-line pt-2 font-mono text-[11px] leading-relaxed text-ink2">
              {capture.derivedText}
            </p>
          )}
          {entityChips.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-ink2">
                  {t(language, 'tapWordToTag')}
                </span>
                <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink3">
                  {t(language, 'autoBadge')}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {entityChips.map(({ label, state }) => {
                  const canAdd = state === 'add' && Boolean(onUpdateTags);
                  const hint =
                    state === 'tagged'
                      ? t(language, 'entityTagged')
                      : state === 'sensitive'
                        ? t(language, 'entitySensitive')
                        : state === 'unusable'
                          ? t(language, 'entityUnusable')
                          : t(language, 'entityTapToTag');
                  const tone =
                    state === 'add'
                      ? 'border-dashed border-accent bg-accent-soft text-accent hover:bg-accent hover:text-white'
                      : state === 'tagged'
                        ? 'border-teal bg-teal-soft text-teal'
                        : 'cursor-not-allowed border-line bg-surface2 text-ink3 opacity-75';
                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={!canAdd}
                      onClick={() => { if (canAdd) void onUpdateTags?.(capture, [...userTags, label]); }}
                      title={hint}
                      aria-label={state === 'tagged' ? t(language, 'ariaEntityTagged', { tag: label }) : t(language, 'ariaAddEntityTag', { tag: label })}
                      className={`inline-flex min-h-11 max-w-full items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${tone}`}
                    >
                      {state === 'add' ? <Plus size={11} /> : state === 'tagged' ? <Check size={11} /> : <Lock size={11} />}
                      <span className="truncate">#{label}</span>
                    </button>
                  );
                })}
              </div>
              {entityChips.some((chip) => chip.state === 'sensitive') && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-ink3">
                  <Lock size={11} /> {t(language, 'lockedReason')}
                </p>
              )}
            </div>
          )}
          {capture.expiryDate && (
            <p className="mt-3 text-[11px] font-bold text-gold">
              {language === 'vi' ? 'Hạn dùng' : 'Expiry'}: {capture.expiryDate}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-canvas p-4">
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold">
            <Tag size={14} className="text-teal" /> {t(language, 'yourTags')}
          </h3>
          {userTags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {userTags.map((tag) => (
                editingTag === tag ? (
                  <input
                    key={tag}
                    autoFocus
                    value={tagEditValue}
                    onChange={(event) => setTagEditValue(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') commitTagRename(tag); }}
                    onBlur={() => commitTagRename(tag)}
                    aria-label={t(language, 'renameTagAria', { tag })}
                    className="min-h-11 w-32 rounded-full border border-teal bg-canvas px-2.5 text-base font-bold outline-none"
                  />
                ) : (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2.5 py-1 text-[11px] font-bold text-teal">
                    <button
                      type="button"
                      onClick={() => { setEditingTag(tag); setTagEditValue(tag); }}
                      aria-label={t(language, 'renameTagAria', { tag })}
                      title={t(language, 'renameTagHint')}
                      className="min-h-11"
                    >
                      #{tag}
                    </button>
                    {onUpdateTags && (
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        aria-label={t(language, 'removeTagAria', { tag })}
                        className="grid min-h-11 min-w-11 place-items-center rounded-full hover:bg-teal/15"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </span>
                )
              ))}
            </div>
          )}
          {suggestedTags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-accent">{t(language, 'suggestedTagLabel')}:</span>
              {suggestedTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-dashed border-accent bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent">
                  <Sparkles size={10} /> #{tag}
                </span>
              ))}
            </div>
          )}
          {onUpdateTags && (
            <form
              onSubmit={(event) => { event.preventDefault(); addTag(); }}
              className="mt-3 flex items-center gap-2"
            >
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder={t(language, 'addTagPlaceholder')}
                className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-surface2 px-3 py-1.5 text-base outline-none focus:border-teal"
              />
              <button
                type="submit"
                disabled={!tagInput.trim()}
                className="inline-flex min-h-11 items-center gap-1 rounded-full bg-teal px-3.5 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-40"
              >
                <Plus size={13} /> {t(language, 'addTag')}
              </button>
            </form>
          )}
        </div>

        <div className="rounded-2xl border border-accent/20 bg-accent-soft/40 p-4">
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold">
            <ArrowUpRight size={15} className="text-accent" /> {t(language, 'askAbout')}
          </h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {askSuggestions(language, capture).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onAskAbout(capture, suggestion)}
                className="min-h-11 rounded-full border border-line bg-canvas px-3 text-[11px] font-semibold text-ink2 hover:border-accent"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => { event.preventDefault(); if (askInput.trim()) onAskAbout(capture, askInput.trim()); }}
            className="mt-3 flex items-center gap-2 rounded-full border border-line bg-canvas p-1 pl-3"
          >
            <input
              value={askInput}
              onChange={(event) => setAskInput(event.target.value)}
              placeholder={t(language, 'followUpPlaceholder')}
              aria-label={t(language, 'followUpPlaceholder')}
              className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none"
            />
            <button
              type="submit"
              disabled={!askInput.trim()}
              aria-label={t(language, 'askAbout')}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-40"
            >
              <ArrowUpRight size={16} />
            </button>
          </form>
        </div>
      </div>

      {confirmTrash && onManualTrash && (
        <div data-trash-confirm className="rounded-xl border border-danger/30 bg-danger-soft/50 p-3 lg:col-span-2">
          <p className="text-[11.5px] font-semibold text-ink">
            {capture.protectedReason
              ? t(language, 'deleteConfirmProtected', { reason: capture.protectedReason, days: trashDays })
              : t(language, 'deleteConfirmBody', { days: trashDays })}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmTrash(false)}
              className="min-h-11 flex-1 rounded-full border border-line bg-canvas py-1.5 text-[11.5px] font-bold text-ink2"
            >
              {t(language, 'cancel')}
            </button>
            <button
              type="button"
              onClick={() => { setConfirmTrash(false); void onManualTrash(capture); }}
              className="min-h-11 flex-1 rounded-full bg-danger py-1.5 text-[11.5px] font-bold text-white"
            >
              {t(language, 'confirmMoveToTrash')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DetailSheet({
  capture,
  order = [],
  onNavigate,
  language,
  onClose,
  onAskAbout,
  onUpdateTags,
  onManualTrash,
  onToast,
  technical = false,
  trashDays = 30,
}: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);

  useDialog(sheetRef, true, onClose, {
    focusRootRef: lightboxOpen ? lightboxRef : sheetRef,
    focusKey: lightboxOpen ? 'lightbox' : 'sheet',
    onEscape: () => {
      if (!lightboxOpen) return false;
      setLightboxOpen(false);
      return true;
    },
  });

  useEffect(() => {
    setLightboxOpen(false);
    setConfirmTrash(false);
    sheetRef.current?.focus();
  }, [capture.id]);

  const index = order.indexOf(capture.id);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (lightboxOpen || confirmTrash || !onNavigate || order.length < 2) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, audio, [contenteditable="true"], [data-trash-confirm]')) return;
      if (window.getSelection()?.toString()) return;
      const next = navTarget(order, capture.id, event.key === 'ArrowLeft' ? -1 : 1);
      if (next) {
        event.preventDefault();
        onNavigate(next);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [capture.id, confirmTrash, lightboxOpen, onNavigate, order]);

  const copyDetails = () => {
    void navigator.clipboard
      ?.writeText(buildCopyText(capture))
      .then(() => onToast?.(t(language, 'copied')))
      .catch(() => onToast?.(t(language, 'copyFailed')));
  };

  return (
    <div className={OVERLAY} onClick={onClose}>
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t(language, 'detail')}
        className={PANEL}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-line bg-canvas/95 px-4 py-3 lg:px-6">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line2 md:hidden" />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label={t(language, 'dismiss')}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface2 px-3.5 py-1.5 text-[12px] font-semibold"
            >
              <ArrowLeft size={15} /> {t(language, 'back')}
            </button>
            <div className="flex items-center gap-2">
              {order.length > 1 && (
                <div className="hidden items-center gap-1 lg:flex" aria-live="polite">
                  <button
                    type="button"
                    onClick={() => { const id = navTarget(order, capture.id, -1); if (id) onNavigate?.(id); }}
                    disabled={index <= 0}
                    aria-label={t(language, 'back')}
                    className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line text-ink2 disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-[11px] font-bold text-ink2">{index + 1} / {order.length}</span>
                  <button
                    type="button"
                    onClick={() => { const id = navTarget(order, capture.id, 1); if (id) onNavigate?.(id); }}
                    disabled={index < 0 || index >= order.length - 1}
                    aria-label={t(language, 'continue')}
                    className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line text-ink2 disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
              <span className="text-[13px] font-bold">
                {technical ? t(language, 'memoryNumber', { n: capture.id.slice(-4) }) : t(language, 'savedCapture', { type: typeLabel(language, capture.type) })}
              </span>
              <SourceBadge source={capture.inferenceSource} language={language} plain={!technical} />
            </div>
          </div>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto p-4 pb-6 lg:p-6">
          <DetailContent
            key={capture.id}
            capture={capture}
            language={language}
            onAskAbout={onAskAbout}
            onUpdateTags={onUpdateTags}
            onManualTrash={onManualTrash}
            trashDays={trashDays}
            setLightboxOpen={setLightboxOpen}
            confirmTrash={confirmTrash}
            setConfirmTrash={setConfirmTrash}
          />
        </div>

        <div className="shrink-0 space-y-2 border-t border-line bg-canvas/95 p-4 lg:p-6">
          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            {onManualTrash && !confirmTrash && (
              <button
                type="button"
                onClick={() => setConfirmTrash(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-danger/40 bg-canvas px-4 text-[12px] font-bold text-danger"
              >
                <Trash2 size={14} /> {t(language, 'moveToTrash')}
              </button>
            )}
            <button
              type="button"
              onClick={copyDetails}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-canvas px-4 text-[12px] font-bold text-ink2"
            >
              <Copy size={14} /> {t(language, 'copyDetails')}
            </button>
            <button
              type="button"
              onClick={() => onAskAbout(capture)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-canvas px-4 text-[12px] font-bold text-ink2"
            >
              <ArrowUpRight size={14} /> {t(language, 'askAbout')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-[12px] font-bold text-white"
            >
              {t(language, 'done')} (Esc)
            </button>
          </div>

          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => onAskAbout(capture)}
              className="flex w-full min-h-11 items-center justify-center gap-2 rounded-full bg-accent py-3 text-[13px] font-bold text-white shadow-md active:scale-[0.98]"
            >
              {t(language, 'askAbout')} <ArrowUpRight size={16} />
            </button>
            {onManualTrash && !confirmTrash && (
              <button
                type="button"
                onClick={() => setConfirmTrash(true)}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-line bg-surface2 py-2 text-[11.5px] font-bold text-ink2 hover:border-danger hover:text-danger"
              >
                <Trash2 size={13} /> {t(language, 'confirmMoveToTrash')}
              </button>
            )}
          </div>

          <p className="flex items-center justify-center gap-1 text-[10px] text-ink3">
            <Lock size={11} /> {t(language, 'originalStaysLocal')}
          </p>
        </div>
      </div>

      {lightboxOpen && capture.originalRef && (
        <div
          ref={lightboxRef}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 outline-none"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label={t(language, 'cancel')}
            className="absolute right-4 top-4 grid min-h-11 min-w-11 place-items-center rounded-full bg-canvas/90 text-ink"
          >
            <X size={20} />
          </button>
          <img
            src={capture.originalRef}
            alt={t(language, 'openOriginal')}
            className="max-h-full max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

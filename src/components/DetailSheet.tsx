import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Image, Lock, Mic, NotepadText, Plus, ShieldCheck, Sparkles, Tag, Trash2, X } from 'lucide-react';
import type { CaptureRecord, CaptureType, Language } from '../types';
import { normalize } from '../lib/embeddings';
import { t } from '../lib/i18n';
import { useDialog } from '../lib/useDialog';
import { SourceBadge } from './Hud';

function typeLabel(language: Language, type: CaptureType): string {
  const key = type === 'photo' ? 'photo' : type === 'voice' ? 'voice' : 'noteType';
  return t(language, key);
}

interface Props {
  capture: CaptureRecord;
  language: Language;
  onClose: () => void;
  onAskAbout: (capture: CaptureRecord, question?: string) => void;
  onUpdateTags?: (capture: CaptureRecord, nextTags: string[]) => Promise<void> | void;
  onManualTrash?: (capture: CaptureRecord) => Promise<void> | void;
  trashDays?: number;
}

export default function DetailSheet({
  capture,
  language,
  onClose,
  onAskAbout,
  onUpdateTags,
  onManualTrash,
  trashDays = 30,
}: Props) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [tagEditValue, setTagEditValue] = useState('');
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

  const suggestedTags = capture.suggestedTags || [];
  const userTags = capture.tags || [];

  const addTag = () => {
    const cleaned = tagInput.trim().replace(/^#+/, '');
    if (!cleaned || !onUpdateTags) return;
    const norm = normalize(cleaned);
    if (!norm || userTags.some((existing) => normalize(existing) === norm)) {
      setTagInput('');
      return;
    }
    void onUpdateTags(capture, [...userTags, cleaned]);
    setTagInput('');
  };

  const removeTag = (target: string) => {
    if (!onUpdateTags) return;
    const normTarget = normalize(target);
    void onUpdateTags(
      capture,
      userTags.filter((existing) => normalize(existing) !== normTarget),
    );
  };

  // Rename is deliberately scoped to THIS capture only: other captures sharing
  // the old tag are left untouched.
  const commitTagRename = (target: string) => {
    const next = tagEditValue.trim().replace(/^#+/, '');
    setEditingTag(null);
    if (!onUpdateTags || !next || normalize(next) === normalize(target)) return;
    if (userTags.some((t) => normalize(t) === normalize(next))) return;
    void onUpdateTags(capture, userTags.map((t) => (t === target ? next : t)));
  };

  useEffect(() => {
    if (capture.type !== 'voice') {
      setAudioUrl(null);
      return;
    }
    if (capture.audioBlob) {
      const objectUrl = URL.createObjectURL(capture.audioBlob);
      setAudioUrl(objectUrl);
      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }
    setAudioUrl(capture.originalRef || null);
  }, [capture.audioBlob, capture.originalRef, capture.type]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50" onClick={onClose}>
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t(language, 'detail')}
        className="animate-sheet flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-canvas shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-line bg-canvas/95 px-4 py-3">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line2" />
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={onClose} aria-label={t(language, 'dismiss')} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface2 px-3.5 py-1.5 text-[12px] font-semibold">
              <ArrowLeft size={15} /> {t(language, 'back')}
            </button>
            <span className="text-[13px] font-bold">{t(language, 'memoryNumber', { n: capture.id.slice(-4) })}</span>
            <SourceBadge source={capture.inferenceSource} language={language} />
          </div>
        </div>

        <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto p-4 pb-6">
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

          {capture.originalRef && capture.type === 'photo' ? (
            <div className="relative overflow-hidden rounded-2xl border border-line">
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label={t(language, 'openOriginal')}
                className="block w-full"
              >
                <img src={capture.originalRef} alt={t(language, 'originalProof')} className="w-full object-cover" />
              </button>
              <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-canvas/90 px-2.5 py-1 text-[11px] font-bold text-teal shadow-sm">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal" /> {t(language, 'originalProof')}
              </span>
            </div>
          ) : capture.type === 'voice' ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-teal-soft p-4 text-teal">
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-canvas/90 px-2.5 py-1 text-[11px] font-bold text-teal shadow-sm">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal" /> {t(language, 'originalAudioProof')}
              </span>
              <Mic size={36} className="mt-3" />
              {audioUrl && (
                <audio controls src={audioUrl} preload="metadata" className="mt-3 w-full" />
              )}
            </div>
          ) : (
            <div className="grid h-40 place-items-center rounded-2xl bg-teal-soft text-teal">
              {capture.type === 'note' ? <NotepadText size={44} /> : <Image size={44} />}
            </div>
          )}

          <div className="rounded-2xl border border-line bg-surface2 p-4">
            <h2 className="text-[13px] font-bold">{t(language, 'extracted')}</h2>
            <p className="mt-2 font-serif text-[14px] font-semibold leading-snug">“{capture.summary}”</p>
            {capture.derivedText && (
              <p className="mt-2 border-t border-line pt-2 font-mono text-[11px] leading-relaxed text-ink2">
                {capture.derivedText}
              </p>
            )}
            {capture.entities.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-ink2">{t(language, 'autoEntities')}</span>
                  <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink3 border border-line">
                    {t(language, 'autoBadge')}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {capture.entities.slice(0, 6).map((entity, index) => (
                    <span key={`${entity}-${index}`} className="truncate rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-[11px] font-semibold text-ink2">
                      {entity}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {capture.expiryDate && (
              <p className="mt-3 text-[11px] font-bold text-gold">
                {language === 'vi' ? 'Hạn dùng' : 'Expiry'}: {capture.expiryDate}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-canvas p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[13px] font-bold">
                <Tag size={14} className="text-teal" /> {t(language, 'yourTags')}
              </h3>
            </div>
            {userTags.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {userTags.map((tag) => (
                  editingTag === tag ? (
                    <input
                      key={tag}
                      autoFocus
                      value={tagEditValue}
                      onChange={(e) => setTagEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitTagRename(tag); }}
                      onBlur={() => commitTagRename(tag)}
                      aria-label={t(language, 'renameTagAria', { tag })}
                      className="min-h-11 w-32 rounded-full border border-teal bg-canvas px-2.5 text-base font-bold outline-none"
                    />
                  ) : (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2.5 py-1 text-[11px] font-bold text-teal"
                    >
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
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-accent bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent"
                  >
                    <Sparkles size={10} /> #{tag}
                  </span>
                ))}
              </div>
            )}
            {onUpdateTags && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addTag();
                }}
                className="mt-3 flex items-center gap-2"
              >
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
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
            <div className="mt-3 space-y-2">
              {[
                language === 'vi' ? 'Hạn dùng là khi nào?' : 'When does it expire?',
                language === 'vi' ? 'Chi tiết trong capture này?' : 'What details are in this capture?',
                language === 'vi' ? 'Tôi đã lưu cái gì thế?' : 'What did I save here?',
              ].map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => onAskAbout(capture, question)}
                  className="flex w-full items-center justify-between rounded-xl border border-line bg-canvas px-3 py-2 text-left text-[12px] font-semibold transition-colors hover:border-accent"
                >
                  {question} <ArrowUpRight size={14} className="text-accent" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-line bg-canvas/95 p-4">
          {confirmTrash && onManualTrash && (
            <div className="rounded-xl border border-danger/30 bg-danger-soft/50 p-3">
              <p className="text-[11.5px] font-semibold text-ink">
                {capture.protectedReason
                  ? t(language, 'deleteConfirmProtected', {
                      reason: capture.protectedReason,
                      days: trashDays,
                    })
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
                  onClick={() => {
                    setConfirmTrash(false);
                    void onManualTrash(capture);
                    onClose();
                  }}
                  className="min-h-11 flex-1 rounded-full bg-danger py-1.5 text-[11.5px] font-bold text-white"
                >
                  {t(language, 'confirmMoveToTrash')}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onAskAbout(capture)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-[13px] font-bold text-white shadow-md active:scale-[0.98]"
          >
            {t(language, 'askAbout')} <ArrowUpRight size={16} />
          </button>

          {onManualTrash && !confirmTrash && (
            <button
              type="button"
              onClick={() => setConfirmTrash(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-line bg-surface2 py-2 text-[11.5px] font-bold text-ink2 hover:border-danger hover:text-danger"
            >
              <Trash2 size={13} /> {t(language, 'confirmMoveToTrash')}
            </button>
          )}

          <p className="flex items-center justify-center gap-1 text-[11px] text-ink3">
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
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

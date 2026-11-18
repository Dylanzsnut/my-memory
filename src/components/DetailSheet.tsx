import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Image, Lock, Mic, NotepadText, Plus, ShieldCheck, Tag, Trash2, X } from 'lucide-react';
import type { CaptureRecord, Language } from '../types';
import { normalize } from '../lib/embeddings';
import { t } from '../lib/i18n';
import { SourceBadge } from './Hud';

interface Props {
  capture: CaptureRecord;
  language: Language;
  onClose: () => void;
  onAskAbout: (capture: CaptureRecord, question?: string) => void;
  onUpdateTags?: (capture: CaptureRecord, nextTags: string[]) => Promise<void> | void;
  onManualTrash?: (capture: CaptureRecord) => Promise<void> | void;
  onPermanentDelete?: (capture: CaptureRecord) => Promise<void> | void;
  trashDays?: number;
}

export default function DetailSheet({
  capture,
  language,
  onClose,
  onAskAbout,
  onUpdateTags,
  onManualTrash,
  onPermanentDelete,
  trashDays = 30,
}: Props) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [deleteStep, setDeleteStep] = useState<'none' | 'trash' | 'perm1' | 'perm2'>('none');

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
        role="dialog"
        aria-modal="true"
        aria-label={t(language, 'detail')}
        className="animate-sheet flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-canvas shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-line bg-canvas/95 px-4 py-3">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line2" />
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface2 px-3 py-1.5 text-[12px] font-semibold">
              <ArrowLeft size={15} /> {t(language, 'back')}
            </button>
            <span className="text-[13px] font-bold">Memory #{capture.id.slice(-4)}</span>
            <SourceBadge source={capture.inferenceSource} language={language} />
          </div>
        </div>

        <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto p-4 pb-6">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink2">
            <span>{t(language, 'captured')}: {new Date(capture.capturedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}</span>
            <span>·</span>
            <span>{capture.type}</span>
            {capture.protectedReason && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2 py-0.5 text-[10px] font-bold text-teal">
                <ShieldCheck size={11} /> {t(language, 'alwaysProtected')}
              </span>
            )}
          </div>

          {capture.originalRef && capture.type === 'photo' ? (
            <div className="relative overflow-hidden rounded-2xl border border-line">
              <img src={capture.originalRef} alt="Original capture" className="w-full object-cover" />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-canvas/90 px-2.5 py-1 text-[10px] font-bold text-teal shadow-sm">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal" /> Original proof · on-device
              </span>
            </div>
          ) : capture.type === 'voice' ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-teal-soft p-4 text-teal">
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-canvas/90 px-2.5 py-1 text-[10px] font-bold text-teal shadow-sm">
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
                  <span className="rounded-full bg-surface2 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink3 border border-line">
                    {t(language, 'autoBadge')}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {capture.entities.slice(0, 6).map((entity, index) => (
                    <span key={`${entity}-${index}`} className="truncate rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-[10.5px] font-semibold text-ink2">
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
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2.5 py-1 text-[11px] font-bold text-teal"
                  >
                    #{tag}
                    {onUpdateTags && (
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                        className="rounded-full p-0.5 hover:bg-teal/15"
                      >
                        <X size={11} />
                      </button>
                    )}
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
                  className="min-w-0 flex-1 rounded-full border border-line bg-surface2 px-3 py-1.5 text-[12px] outline-none focus:border-teal"
                />
                <button
                  type="submit"
                  disabled={!tagInput.trim()}
                  className="inline-flex items-center gap-1 rounded-full bg-teal px-3 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-40"
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
          {deleteStep === 'trash' && onManualTrash && (
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
                  onClick={() => setDeleteStep('none')}
                  className="flex-1 rounded-full border border-line bg-canvas py-1.5 text-[11.5px] font-bold text-ink2"
                >
                  {t(language, 'cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteStep('none');
                    void onManualTrash(capture);
                    onClose();
                  }}
                  className="flex-1 rounded-full bg-danger py-1.5 text-[11.5px] font-bold text-white"
                >
                  {t(language, 'confirmMoveToTrash')}
                </button>
              </div>
            </div>
          )}

          {(deleteStep === 'perm1' || deleteStep === 'perm2') && onPermanentDelete && (
            <div className="rounded-xl border border-danger bg-danger-soft p-3">
              <p className="text-[11.5px] font-bold text-danger">
                {deleteStep === 'perm1' ? t(language, 'deletePermNow') : t(language, 'deletePermStep2')}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteStep('none')}
                  className="flex-1 rounded-full border border-line bg-canvas py-1.5 text-[11.5px] font-bold text-ink2"
                >
                  {t(language, 'cancel')}
                </button>
                {deleteStep === 'perm1' ? (
                  <button
                    type="button"
                    onClick={() => setDeleteStep('perm2')}
                    className="flex-1 rounded-full bg-danger py-1.5 text-[11.5px] font-bold text-white"
                  >
                    {t(language, 'continue')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteStep('none');
                      void onPermanentDelete(capture);
                      onClose();
                    }}
                    className="flex-1 rounded-full bg-danger py-1.5 text-[11.5px] font-bold text-white"
                  >
                    {t(language, 'deletePerm')}
                  </button>
                )}
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

          {(onManualTrash || onPermanentDelete) && deleteStep === 'none' && (
            <div className="flex gap-2">
              {onManualTrash && (
                <button
                  type="button"
                  onClick={() => setDeleteStep('trash')}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-line bg-surface2 py-2 text-[11.5px] font-bold text-ink2 hover:border-danger hover:text-danger"
                >
                  <Trash2 size={13} /> {t(language, 'confirmMoveToTrash')}
                </button>
              )}
              {onPermanentDelete && (
                <button
                  type="button"
                  onClick={() => setDeleteStep('perm1')}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-danger/30 bg-danger-soft/60 py-2 text-[11.5px] font-bold text-danger"
                >
                  {t(language, 'deletePermNow')}
                </button>
              )}
            </div>
          )}

          <p className="flex items-center justify-center gap-1 text-[10px] text-ink3">
            <Lock size={11} /> {language === 'vi' ? 'Bản gốc ở lại trên máy.' : 'The original stays on this device.'}
          </p>
        </div>
      </div>
    </div>
  );
}

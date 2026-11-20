import { useState } from 'react';
import { ArrowLeft, Clock3, Image, Mic, NotepadText, RotateCcw, Trash2 } from 'lucide-react';
import type { CaptureRecord, Language } from '../types';
import { t } from '../lib/i18n';

interface Props {
  captures: CaptureRecord[];
  language: Language;
  trashDays: number;
  onBack: () => void;
  onRestore: (capture: CaptureRecord) => Promise<void> | void;
  onPermanentDelete: (capture: CaptureRecord) => Promise<void> | void;
}

function daysRemaining(capture: CaptureRecord, fallbackDays: number): number {
  if (!capture.purgeAt) return fallbackDays;
  const diff = new Date(capture.purgeAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export default function Trash({
  captures,
  language,
  trashDays,
  onBack,
  onRestore,
  onPermanentDelete,
}: Props) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const trashed = captures.filter((c) => c.retentionState === 'trashed');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={t(language, 'back')}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-canvas px-3.5 py-1.5 text-[12px] font-semibold text-ink2 hover:border-accent"
        >
          <ArrowLeft size={14} /> {t(language, 'back')}
        </button>
        <span className="rounded-full bg-surface2 px-3 py-1 text-[11px] font-bold text-ink2">
          {trashed.length} {t(language, 'inTrash')}
        </span>
      </div>

      <div>
        <h1 className="font-serif text-[26px] font-bold tracking-tight">{t(language, 'trash')}</h1>
        <p className="mt-1 flex items-start gap-1.5 text-[12px] text-ink2">
          <Clock3 size={14} className="mt-0.5 shrink-0 text-teal" />
          <span>{t(language, 'trashInfo', { n: trashDays })}</span>
        </p>
      </div>

      {trashed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line2 bg-canvas/50 px-5 py-10 text-center text-[13px] text-ink2">
          {t(language, 'trashEmpty')}
        </div>
      ) : (
        <div className="space-y-3">
          {trashed.map((capture) => {
            const left = daysRemaining(capture, trashDays);
            const isConfirming = confirmingId === capture.id;
            return (
              <div key={capture.id} className="rounded-2xl border border-line bg-canvas p-3.5 shadow-sm">
                <div className="flex items-start gap-3">
                  {capture.originalRef && capture.type === 'photo' ? (
                    <img src={capture.originalRef} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-line object-cover" />
                  ) : (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-surface2 text-ink2">
                      {capture.type === 'voice' ? <Mic size={20} /> : capture.type === 'note' ? <NotepadText size={20} /> : <Image size={20} />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
                        {t(language, 'daysLeft', { n: left })}
                      </span>
                      <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-ink2">
                        {capture.trashSource === 'manual' ? t(language, 'sourceManual') : t(language, 'sourceProposal')}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-[13px] font-bold">{capture.summary}</p>
                  </div>
                </div>

                {isConfirming ? (
                  <div className="mt-3 rounded-xl border border-danger/30 bg-danger-soft p-3">
                    <p className="text-[11.5px] font-semibold text-danger">{t(language, 'deletePermStep2')}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="min-h-11 flex-1 rounded-full border border-line bg-canvas py-1.5 text-[11.5px] font-bold text-ink2"
                      >
                        {t(language, 'cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingId(null);
                          void onPermanentDelete(capture);
                        }}
                        className="min-h-11 flex-1 rounded-full bg-danger py-1.5 text-[11.5px] font-bold text-white"
                      >
                        {t(language, 'deletePerm')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void onRestore(capture)}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-teal-soft py-2 text-[11.5px] font-bold text-teal"
                    >
                      <RotateCcw size={13} /> {t(language, 'restore')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(capture.id)}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-danger/30 bg-danger-soft/60 py-2 text-[11.5px] font-bold text-danger"
                    >
                      <Trash2 size={13} /> {t(language, 'deletePerm')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

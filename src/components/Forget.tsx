import { useState } from 'react';
import { CheckCircle2, Clock3, Image, Mic, NotepadText, RotateCcw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import type { CaptureRecord, Decision, ForgetProposal, Language } from '../types';
import { t } from '../lib/i18n';

interface Props {
  proposals: ForgetProposal[];
  captures: CaptureRecord[];
  language: Language;
  onDecide: (proposal: ForgetProposal, decision: Decision) => void;
  onOpenTrash: () => void;
  onRestore: (capture: CaptureRecord) => Promise<void> | void;
  trashDays: number;
}

function daysLeft(capture: CaptureRecord, fallback: number): number {
  if (!capture.purgeAt) return fallback;
  return Math.max(0, Math.ceil((new Date(capture.purgeAt).getTime() - Date.now()) / 86_400_000));
}

export default function Forget({ proposals, captures, language, onDecide, onOpenTrash, onRestore, trashDays }: Props) {
  const pending = proposals.filter((p) => !p.decided);
  const kept = proposals.filter((p) => p.decided === 'keep').length;
  const trashedCaptures = captures.filter((c) => c.retentionState === 'trashed');
  const protectedCaptures = captures.filter((c) => c.retentionState === 'protected');
  const [protectedOpen, setProtectedOpen] = useState(false);
  const nextPurgeDays = trashedCaptures
    .map((capture) => daysLeft(capture, trashDays))
    .sort((a, b) => a - b)[0];

  return (
    <div className="mx-auto flex w-full max-w-none flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start xl:gap-8">
      <div className="xl:col-span-2 md:rounded-3xl md:border md:border-line md:bg-canvas md:p-6 md:shadow-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
          <Sparkles size={13} /> {language === 'vi' ? 'Dọn dẹp chánh niệm' : 'Mindful tidying'}
        </span>
        <h1 className="mt-3 font-serif text-[26px] font-bold tracking-tight md:text-[34px]">{t(language, 'forget')}</h1>
        <p className="mt-1 text-[12px] text-ink2">
          {language === 'vi' ? 'Chúng tôi đề xuất · Bạn quyết định.' : 'We suggest · You decide.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:col-span-2">
        {[
          { value: pending.length, label: t(language, 'toReview'), cls: 'bg-accent-soft text-accent' },
          { value: kept, label: t(language, 'keptSafe'), cls: 'bg-teal-soft text-teal' },
          {
            value: trashedCaptures.length,
            label: nextPurgeDays !== undefined ? t(language, 'nextPurge', { n: nextPurgeDays }) : t(language, 'inTrash'),
            cls: 'bg-surface2 text-ink2',
          },
          { value: '✓', label: t(language, 'nothingDeleted'), cls: 'bg-canvas text-teal' },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl p-3 shadow-sm ${stat.cls}`}>
            <span className="block text-[22px] font-black leading-none">{stat.value}</span>
            <span className="mt-1.5 block text-[11px] font-semibold opacity-80">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[14px] font-bold">
              <Sparkles size={16} className="text-accent" /> {t(language, 'reviewQueue')}
            </h2>
            <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-ink2">
              {pending.length} {language === 'vi' ? 'mục' : 'items'}
            </span>
          </div>

          {pending.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line2 bg-canvas/50 px-5 py-8 text-center text-[13px] text-ink2">
              {t(language, 'noProposals')}
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            {pending.map((proposal, index) => {
              const capture = captures.find((item) => item.id === proposal.captureId);
              const related = captures.find((item) => item.id === proposal.relatedCaptureId);
              const reasonKey =
                proposal.reason !== 'duplicate'
                  ? 'proposalExpired'
                  : capture?.type === 'note'
                    ? 'proposalDuplicateNote'
                    : capture?.type === 'voice'
                      ? 'proposalDuplicateVoice'
                      : 'proposalDuplicatePhoto';
              return (
                <div key={proposal.id} className="animate-sheet rounded-2xl border border-line bg-canvas p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-ink3">{t(language, reasonKey)}</span>
                      <h3 className="mt-0.5 truncate text-[14px] font-bold">{capture?.summary || proposal.captureId}</h3>
                    </div>
                    <span className="shrink-0 rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-ink2">
                      {index + 1} / {pending.length}
                    </span>
                  </div>
                  {related?.originalRef && capture?.originalRef && related.type === 'photo' && capture.type === 'photo' ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <img src={related.originalRef} alt="" loading="lazy" decoding="async" className="h-24 w-full rounded-xl border border-line object-cover" />
                      <img src={capture.originalRef} alt="" loading="lazy" decoding="async" className="h-24 w-full rounded-xl border border-line object-cover" />
                      <span className="text-center text-[11px] font-bold text-teal">{t(language, 'keptOriginal')}</span>
                      <span className="text-center text-[11px] font-bold text-accent">{t(language, 'proposedForTrash')}</span>
                    </div>
                  ) : capture?.originalRef && capture.type === 'photo' ? (
                    <img src={capture.originalRef} alt="" loading="lazy" decoding="async" className="mt-3 h-24 w-full rounded-xl border border-line object-cover" />
                  ) : null}
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface2 p-2.5">
                    <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
                    <p className="text-[11.5px] leading-snug text-ink2">{proposal.evidence}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onDecide(proposal, 'keep')}
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-teal text-[12px] font-bold text-white transition-colors hover:bg-teal/90"
                    >
                      <CheckCircle2 size={15} /> {t(language, 'keep')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDecide(proposal, 'approve')}
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-danger/40 bg-canvas text-[12px] font-bold text-danger transition-colors hover:bg-danger-soft"
                    >
                      <Trash2 size={15} /> {t(language, 'moveToTrash')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {protectedCaptures.length > 0 && (
          <section className="rounded-2xl border border-teal/20 bg-gold-soft p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gold">
                <ShieldCheck size={16} /> {t(language, 'alwaysProtected')}
              </span>
              <button
                type="button"
                onClick={() => setProtectedOpen((open) => !open)}
                aria-expanded={protectedOpen}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-canvas/70 px-3 text-[11px] font-bold text-gold"
              >
                {t(language, 'protectedCount', { n: protectedCaptures.length })} ·{' '}
                {t(language, protectedOpen ? 'protectedHide' : 'protectedShow')}
              </button>
            </div>
            {protectedOpen && (
              <div className="mt-3 space-y-2">
                {protectedCaptures.map((capture) => {
                  const TypeIcon = capture.type === 'voice' ? Mic : capture.type === 'note' ? NotepadText : Image;
                  return (
                    <div key={capture.id} className="flex items-center gap-3 rounded-xl bg-canvas/70 p-2.5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold">
                        <TypeIcon size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-bold">{capture.summary}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink2">{capture.protectedReason}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface2 p-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-soft text-teal">
              <Clock3 size={17} />
            </span>
            <div>
              <p className="text-[12px] font-bold">{t(language, 'safetyNet', { n: trashDays })}</p>
              <p className="text-[11px] text-ink2">{t(language, 'safetyNetBody')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenTrash}
            className="min-h-11 shrink-0 rounded-full border border-line2 bg-canvas px-3 py-1.5 text-[11px] font-bold text-ink hover:border-accent"
          >
            {t(language, 'openTrash', { n: trashedCaptures.length })}
          </button>
        </div>
      </div>

      <aside className="hidden flex-col gap-4 xl:flex">
        <section className="rounded-3xl bg-ink p-5 text-canvas">
          <h2 className="flex items-center gap-2 font-serif text-[17px] font-bold">
            <ShieldCheck size={16} /> {t(language, 'forgetRulesTitle')}
          </h2>
          <ol className="mt-4 space-y-3">
            {(['forgetRule1', 'forgetRule2', 'forgetRule3', 'forgetRule4'] as const).map((key, index) => (
              <li key={key} className="flex gap-2 text-[11.5px] leading-snug text-canvas/80">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
                  {index + 1}
                </span>
                {t(language, key)}
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-canvas/20 pt-3 text-[11px] font-bold">{t(language, 'privacyPromise')}</p>
        </section>

        <section className="rounded-3xl border border-line bg-canvas p-4">
          <h2 className="text-[13px] font-bold">{t(language, 'recentlyTrashed')}</h2>
          {trashedCaptures.length === 0 ? (
            <p className="mt-2 text-[11px] text-ink2">{t(language, 'trashEmpty')}</p>
          ) : (
            <div className="mt-2 space-y-2">
              {trashedCaptures.slice(0, 3).map((capture) => {
                const TypeIcon = capture.type === 'voice' ? Mic : capture.type === 'note' ? NotepadText : Image;
                return (
                  <div key={capture.id} className="flex items-center gap-2 rounded-xl bg-surface2 p-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-canvas text-ink2">
                      <TypeIcon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-bold">{capture.summary}</p>
                      <p className="text-[10px] text-ink3">{t(language, 'daysLeft', { n: daysLeft(capture, trashDays) })}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onRestore(capture)}
                      aria-label={t(language, 'restore')}
                      className="inline-flex min-h-11 items-center gap-1 rounded-full bg-teal-soft px-2.5 text-[11px] font-bold text-teal"
                    >
                      <RotateCcw size={12} /> {t(language, 'restore')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={onOpenTrash}
            className="mt-3 min-h-11 w-full rounded-full border border-line text-[11px] font-bold text-ink2"
          >
            {t(language, 'openTrash', { n: trashedCaptures.length })}
          </button>
        </section>
      </aside>

      <p className="flex items-center justify-center gap-1.5 pb-2 text-[10.5px] text-ink3 xl:col-span-2">
        <ShieldCheck size={13} className="text-teal" /> {t(language, 'zeroDeletions')}
      </p>
    </div>
  );
}

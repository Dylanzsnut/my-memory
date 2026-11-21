import { ArrowUpRight, BookOpen } from 'lucide-react';
import type { AnswerResult, Language } from '../types';
import { t } from '../lib/i18n';

interface Props {
  answer: AnswerResult;
  language: Language;
  onOpenDetail: (capture: AnswerResult['sources'][number]) => void;
  onOpenInTimeline: (captureId: string) => void;
  technical?: boolean;
}

export default function AnswerProof({ answer, language, onOpenDetail, onOpenInTimeline, technical = false }: Props) {
  const capture = answer.sources[0];
  if (!capture) return null;

  return (
    <aside className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] space-y-3 overflow-y-auto rounded-3xl border border-line bg-canvas p-4 shadow-sm xl:block">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-bold">{t(language, 'whereAnswerCameFrom')}</h2>
        {technical && (
          <span className="text-[11px] font-bold text-teal">
            {t(language, 'match')} {capture.sourceMatch?.score?.toFixed(2) ?? '—'}
          </span>
        )}
      </div>
      {capture.originalRef && capture.type === 'photo' ? (
        <img src={capture.originalRef} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-2xl border border-line object-cover" />
      ) : (
        <div className="grid h-32 place-items-center rounded-2xl bg-teal-soft text-teal">
          <BookOpen size={36} />
        </div>
      )}
      <div className="rounded-2xl border border-line bg-surface2 p-3">
        <p className="text-[12px] font-bold">{capture.summary}</p>
        {capture.derivedText && (
          <p className="mt-2 border-t border-line pt-2 font-mono text-[11px] leading-relaxed text-ink2">
            {capture.derivedText}
          </p>
        )}
        {capture.entities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {capture.entities.slice(0, 6).map((entity, index) => (
              <span key={`${entity}-${index}`} className="rounded-lg border border-line bg-canvas px-2 py-1 text-[11px] font-semibold text-ink2">
                {entity}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onOpenDetail(capture)}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full border border-line bg-surface2 text-[11.5px] font-bold text-ink2"
        >
          <ArrowUpRight size={13} /> {t(language, 'viewEvidence')}
        </button>
        <button
          type="button"
          onClick={() => onOpenInTimeline(capture.id)}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-accent text-[11.5px] font-bold text-white"
        >
          {t(language, 'openInTimeline')}
        </button>
      </div>
    </aside>
  );
}

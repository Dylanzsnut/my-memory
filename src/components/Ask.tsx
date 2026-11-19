import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpRight, BookOpen, CheckCircle2, Cloud, Search, ShieldCheck, Sparkles } from 'lucide-react';
import type { AnswerResult, CaptureRecord, Language } from '../types';
import type { NanoAvailability } from '../lib/ai';
import { t } from '../lib/i18n';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { SourceBadge } from './Hud';

interface Props {
  language: Language;
  nanoStatus: NanoAvailability;
  onAsk: (question: string, captureId?: string, tag?: string | null) => Promise<AnswerResult>;
  onOpenDetail: (capture: CaptureRecord) => void;
  busy: boolean;
  tags?: string[];
  activeTag?: string | null;
  onActiveTagChange?: (tag: string | null) => void;
  onTagNavigate?: (tag: string) => void;
  seedQuestion?: string;
  seedCaptureId?: string;
  onSeedConsumed?: () => void;
}

const CHIPS: { en: string; vi: string }[] = [
  { en: "When does mum's medicine expire?", vi: 'Hộp thuốc của mẹ hạn dùng khi nào?' },
  { en: 'lunch receipt', vi: 'hóa đơn bữa trưa' },
  { en: 'wifi password', vi: 'mật khẩu wifi' },
  { en: 'license plate', vi: 'biển số xe' },
  { en: 'total my lunch spending', vi: 'tổng chi phí ăn trưa' },
];

export default function Ask({
  language,
  nanoStatus,
  onAsk,
  onOpenDetail,
  busy,
  tags = [],
  activeTag = null,
  onActiveTagChange,
  onTagNavigate,
  seedQuestion,
  seedCaptureId,
  onSeedConsumed,
}: Props) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [asked, setAsked] = useState('');
  const [error, setError] = useState<string | null>(null);
  const online = useOnlineStatus();

  useEffect(() => {
    if (seedQuestion) {
      setQuery(seedQuestion);
      void submit(seedQuestion, seedCaptureId);
      onSeedConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedQuestion, seedCaptureId]);

  const submit = async (question: string, captureId?: string, tag?: string | null) => {
    if (!question.trim() || busy) return;
    setError(null);
    try {
      const result = await onAsk(question, captureId, tag !== undefined ? tag : activeTag);
      setAsked(question);
      setAnswer(result);
    } catch (err) {
      setAsked(question);
      setAnswer(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-[26px] font-bold tracking-tight">{t(language, 'ask')}</h1>
        <p className="mt-1 text-[12px] text-ink2">{t(language, 'askSubtitle')}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className="flex items-center gap-2 rounded-full border border-line2 bg-canvas p-1.5 pl-4 shadow-sm focus-within:border-accent"
      >
        <Search size={18} className="shrink-0 text-accent" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(language, 'askPlaceholder')}
          aria-label={t(language, 'askPlaceholder')}
          className="min-h-11 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink3"
        />
        <button
          type="submit"
          disabled={busy || !query.trim()}
          aria-label={t(language, 'search')}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-40"
        >
          <Sparkles size={16} />
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => {
          const label = language === 'vi' ? chip.vi : chip.en;
          return (
            <button
              key={chip.en}
              type="button"
              onClick={() => {
                setQuery(label);
                submit(label);
              }}
              className="min-h-11 rounded-full border border-line2 bg-canvas px-3.5 py-2 text-[11.5px] font-semibold text-ink2 transition-colors hover:border-accent hover:text-accent"
            >
              {label}
            </button>
          );
        })}
      </div>

      {tags.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink3">{t(language, 'askTagsTitle')}</p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const question = t(language, 'askTagQuestion', { tag });
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    onActiveTagChange?.(tag);
                    setQuery(question);
                    void submit(question, undefined, tag);
                  }}
                  className="min-h-11 rounded-full border border-teal/40 bg-teal-soft px-3.5 py-2 text-[11.5px] font-bold text-teal transition-colors hover:border-teal"
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeTag && (
        <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2 text-[11.5px] font-bold text-accent">
          <span className="min-w-0 flex-1 truncate">{t(language, 'askScopedTo', { tag: activeTag })}</span>
          <button
            type="button"
            onClick={() => onActiveTagChange?.(null)}
            aria-label={t(language, 'clearScope')}
            className="min-h-11 rounded-full px-3 text-[11px] font-bold"
          >
            {t(language, 'clearScope')}
          </button>
        </div>
      )}

      <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-teal-soft px-3 py-1.5">
        <span className={`h-1.5 w-1.5 animate-pulse-dot rounded-full ${online ? 'bg-teal' : 'bg-gold'}`} />
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-teal">
          {t(language, online ? 'onlineLive' : 'offlineLive')}
        </span>
      </div>

      {nanoStatus !== 'readily' && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-gold/30 bg-gold-soft p-3 text-ink">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-gold" />
          <div className="text-[11.5px] leading-snug">
            <p className="font-bold text-gold">{t(language, 'flow7Title')}</p>
            <p className="mt-0.5 text-ink2">{t(language, 'flow7Body')}</p>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft p-3 text-[12px] text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {busy && (
        <div
          role="status"
          aria-live="polite"
          className="animate-pulse rounded-2xl border border-line bg-canvas p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 text-[11.5px] font-bold text-ink2">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-teal" />
            {t(language, 'searchingMemory')}
          </div>
          <div className="mt-3 h-3 w-3/4 rounded-full bg-surface2" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-surface2" />
          <div className="mt-3 h-10 rounded-xl bg-surface2" />
        </div>
      )}

      {answer ? (
        <article className="animate-sheet overflow-hidden rounded-2xl border border-line bg-canvas shadow-sm">
          <div className="flex items-center justify-between bg-teal px-4 py-2.5 text-white">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={16} />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {answer.notFound ? t(language, 'notFound') : t(language, 'verified')}
              </span>
            </div>
            <SourceBadge source={answer.inferenceSource} language={language} />
          </div>
          <div className="space-y-3 p-4">
            {asked && (
              <p className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-sm bg-ink px-3 py-2 text-[12.5px] text-canvas">
                {asked}
              </p>
            )}
            {answer.inferenceSource === 'IN_CLOUD' && (
              <div className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold-soft px-3 py-2 text-[11px] font-semibold text-gold">
                <Cloud size={14} className="shrink-0" />
                <span>{t(language, 'cloudFallbackNotice')}</span>
              </div>
            )}
            <p className="font-serif text-[19px] font-bold leading-snug">{answer.text}</p>

            {answer.sources.map((capture) => {
              const match = capture.sourceMatch?.score;
              return (
                <div
                  key={capture.id}
                  className="rounded-xl border border-line bg-surface2 p-2.5 transition-colors hover:border-accent"
                >
                  <button
                    type="button"
                    onClick={() => onOpenDetail(capture)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    {capture.originalRef && capture.type === 'photo' ? (
                      <img src={capture.originalRef} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-teal-soft text-teal">
                        <BookOpen size={22} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold">{capture.summary}</span>
                      <span className="mt-0.5 block text-[10.5px] text-ink3">
                        {new Date(capture.capturedAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')} ·{' '}
                        {t(language, 'match')} {match !== undefined ? match.toFixed(2) : '—'}
                      </span>
                    </span>
                    <ArrowUpRight size={16} className="shrink-0 text-accent" />
                  </button>
                  {capture.tags && capture.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
                      {capture.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => onTagNavigate?.(tag)}
                          aria-label={`#${tag}`}
                          className="min-h-11 rounded-full bg-teal-soft px-2.5 py-0.5 text-[10px] font-bold text-teal hover:bg-teal hover:text-white"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between border-t border-line pt-3 text-[10.5px] text-ink3">
              <span>
                {answer.latencyMs} ms ·{' '}
                {!answer.notFound && answer.intent === 'long'
                  ? t(language, 'crossCaptureSynthesis')
                  : t(language, 'localLookup')}
              </span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck size={12} className="text-teal" /> {t(language, 'zeroDeletions')}
              </span>
            </div>
          </div>
        </article>
      ) : (
        <div className="rounded-2xl border border-dashed border-line2 bg-canvas/50 px-5 py-10 text-center">
          <Sparkles size={26} className="mx-auto text-line2" />
          <p className="mt-3 text-[13px] text-ink2">{t(language, 'askEmptyHint')}</p>
        </div>
      )}
    </div>
  );
}

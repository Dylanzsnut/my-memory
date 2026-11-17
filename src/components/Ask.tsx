import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, CheckCircle2, Search, ShieldCheck, Sparkles } from 'lucide-react';
import type { AnswerResult, CaptureRecord, Language } from '../types';
import { t } from '../lib/i18n';
import { SourceBadge } from './Hud';

interface Props {
  language: Language;
  onAsk: (question: string) => Promise<AnswerResult>;
  onOpenDetail: (capture: CaptureRecord) => void;
  busy: boolean;
  seedQuestion?: string;
}

const CHIPS: { en: string; vi: string }[] = [
  { en: "When does mum's medicine expire?", vi: 'Hộp thuốc của mẹ hạn dùng khi nào?' },
  { en: 'lunch receipt', vi: 'hóa đơn bữa trưa' },
  { en: 'wifi password', vi: 'mật khẩu wifi' },
  { en: 'license plate', vi: 'biển số xe' },
  { en: 'total my lunch spending', vi: 'tổng chi phí ăn trưa' },
];

export default function Ask({ language, onAsk, onOpenDetail, busy, seedQuestion }: Props) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [asked, setAsked] = useState('');

  useEffect(() => {
    if (seedQuestion) {
      setQuery(seedQuestion);
      submit(seedQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedQuestion]);

  const submit = async (question: string) => {
    if (!question.trim() || busy) return;
    setAsked(question);
    setAnswer(await onAsk(question));
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-[26px] font-bold tracking-tight">{t(language, 'ask')}</h1>
        <p className="mt-1 text-[12px] text-ink2">
          {language === 'vi' ? 'Hỏi bằng lời của bạn — nhận lại bằng chứng gốc.' : 'Ask in your own words — get the original back as proof.'}
        </p>
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
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink3"
        />
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-40"
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
              className="rounded-full border border-line2 bg-canvas px-3 py-1.5 text-[11.5px] font-semibold text-ink2 transition-colors hover:border-accent hover:text-accent"
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-teal-soft px-3 py-1.5">
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal" />
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-teal">
          {t(language, 'offline')}
        </span>
      </div>

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
            <p className="font-serif text-[19px] font-bold leading-snug">{answer.text}</p>

            {answer.sources.map((capture) => {
              const match = capture.sourceMatch?.score;
              return (
                <button
                  key={capture.id}
                  type="button"
                  onClick={() => onOpenDetail(capture)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-line bg-surface2 p-2.5 text-left transition-colors hover:border-accent"
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
                      {t(language, 'match')} {match ? match.toFixed(2) : '—'}
                    </span>
                  </span>
                  <ArrowUpRight size={16} className="shrink-0 text-accent" />
                </button>
              );
            })}

            <div className="flex items-center justify-between border-t border-line pt-3 text-[10.5px] text-ink3">
              <span>{answer.latencyMs} ms · {answer.intent === 'long' ? 'cross-capture synthesis' : 'local lookup'}</span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck size={12} className="text-teal" /> {t(language, 'zeroDeletions')}
              </span>
            </div>
          </div>
        </article>
      ) : (
        <div className="rounded-2xl border border-dashed border-line2 bg-canvas/50 px-5 py-10 text-center">
          <Sparkles size={26} className="mx-auto text-line2" />
          <p className="mt-3 text-[13px] text-ink2">
            {language === 'vi' ? 'Câu trả lời sẽ xuất hiện ở đây, kèm bản gốc.' : 'Answers appear here, with the original capture attached.'}
          </p>
        </div>
      )}
    </div>
  );
}

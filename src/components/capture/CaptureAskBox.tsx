import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { CaptureRecord, Language } from '../../types';
import { askSuggestions } from '../../lib/captureView';
import { t } from '../../lib/i18n';

interface Props {
  language: Language;
  onAsk: (question: string) => void;
  capture?: CaptureRecord;
}

export default function CaptureAskBox({ language, onAsk, capture }: Props) {
  const [question, setQuestion] = useState('');
  const submit = (value: string) => {
    if (!value.trim()) return;
    onAsk(value.trim());
    setQuestion('');
  };

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent-soft/40 p-4">
      <h3 className="flex items-center gap-1.5 text-[13px] font-bold">
        <ArrowUpRight size={15} className="text-accent" /> {t(language, 'askAbout')}
      </h3>
      <div className="mt-3 space-y-2">
        {askSuggestions(language, capture).map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => submit(suggestion)}
            className="flex min-h-11 w-full items-center justify-between rounded-xl border border-line bg-canvas px-3 py-2 text-left text-[12px] font-semibold transition-colors hover:border-accent"
          >
            {suggestion} <ArrowUpRight size={14} className="shrink-0 text-accent" />
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => { event.preventDefault(); submit(question); }}
        className="mt-3 flex items-center gap-2 rounded-full border border-line bg-canvas p-1 pl-3"
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t(language, 'followUpPlaceholder')}
          aria-label={t(language, 'followUpPlaceholder')}
          className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none"
        />
        <button
          type="submit"
          disabled={!question.trim()}
          aria-label={t(language, 'askAbout')}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-40"
        >
          <ArrowUpRight size={16} />
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';
import type { Language } from '../types';
import { t } from '../lib/i18n';

interface Props {
  message: string;
  language?: Language;
  onUndo?: () => void;
  onDismiss: () => void;
}

export default function Toast({ message, language = 'en', onUndo, onDismiss }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    setSecondsLeft(5);
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [message, onUndo, onDismiss]);

  return (
    <div role="status" aria-live="polite" className="animate-toast fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 md:bottom-6 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-line bg-ink px-4 py-3 text-canvas shadow-xl">
      <span className="text-[12.5px] font-medium">{message}</span>
      <div className="flex shrink-0 items-center gap-3">
        {onUndo && (
          <button type="button" onClick={onUndo} className="inline-flex min-h-11 items-center gap-1 px-1 text-[12px] font-bold text-teal-soft">
            <Undo2 size={14} /> {t(language, 'undo')} ({secondsLeft}s)
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t(language, 'dismiss')}
          className="grid min-h-11 min-w-11 place-items-center text-[12px] text-canvas/60 hover:text-canvas"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

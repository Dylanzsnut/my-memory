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
  return (
    <div className="animate-toast fixed bottom-20 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-line bg-ink px-4 py-3 text-canvas shadow-xl">
      <span className="text-[12.5px] font-medium">{message}</span>
      <div className="flex shrink-0 items-center gap-3">
        {onUndo && (
          <button type="button" onClick={onUndo} className="inline-flex items-center gap-1 text-[12px] font-bold text-teal-soft">
            <Undo2 size={14} /> {t(language, 'undo')}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label={language === 'vi' ? 'Đóng' : 'Dismiss'}
          className="text-[12px] text-canvas/60 hover:text-canvas"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

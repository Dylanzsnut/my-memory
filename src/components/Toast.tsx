import { Undo2 } from 'lucide-react';

interface Props {
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
}

export default function Toast({ message, onUndo, onDismiss }: Props) {
  return (
    <div className="animate-toast fixed bottom-20 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-line bg-ink px-4 py-3 text-canvas shadow-xl">
      <span className="text-[12.5px] font-medium">{message}</span>
      <div className="flex shrink-0 items-center gap-3">
        {onUndo && (
          <button type="button" onClick={onUndo} className="inline-flex items-center gap-1 text-[12px] font-bold text-teal-soft">
            <Undo2 size={14} /> Undo
          </button>
        )}
        <button type="button" onClick={onDismiss} className="text-[12px] text-canvas/60 hover:text-canvas">
          ✕
        </button>
      </div>
    </div>
  );
}

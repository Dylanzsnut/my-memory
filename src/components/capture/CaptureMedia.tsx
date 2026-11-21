import { Image, Mic, NotepadText } from 'lucide-react';
import type { CaptureRecord, Language } from '../../types';
import { useCaptureAudioUrl } from '../../lib/captureView';
import { t } from '../../lib/i18n';

interface Props {
  capture: CaptureRecord;
  language: Language;
  onExpand?: () => void;
  fit?: 'cover' | 'contain';
}

const TYPE_STYLE = {
  photo: 'bg-accent-soft text-accent',
  voice: 'bg-teal-soft text-teal',
  note: 'bg-gold-soft text-gold',
};

export default function CaptureMedia({ capture, language, onExpand, fit = 'cover' }: Props) {
  const audioUrl = useCaptureAudioUrl(capture);
  const imageClass =
    fit === 'contain'
      ? 'max-h-[60dvh] w-full bg-surface2 object-contain'
      : 'aspect-[4/3] w-full object-cover';

  if (capture.originalRef && capture.type === 'photo') {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-line">
        {onExpand ? (
          <button type="button" onClick={onExpand} aria-label={t(language, 'openOriginal')} className="block w-full">
            <img src={capture.originalRef} alt={t(language, 'originalProof')} className={imageClass} />
          </button>
        ) : (
          <img src={capture.originalRef} alt={t(language, 'originalProof')} className={imageClass} />
        )}
        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-canvas/90 px-2.5 py-1 text-[11px] font-bold text-teal shadow-sm">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal" /> {t(language, 'originalProof')}
        </span>
      </div>
    );
  }

  if (capture.type === 'voice') {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-teal-soft p-4 text-teal">
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-canvas/90 px-2.5 py-1 text-[11px] font-bold text-teal shadow-sm">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal" /> {t(language, 'originalAudioProof')}
        </span>
        <Mic size={36} className="mt-3" />
        {audioUrl && <audio controls src={audioUrl} preload="metadata" className="mt-3 w-full" />}
      </div>
    );
  }

  return (
    <div className={`grid h-40 place-items-center rounded-2xl ${TYPE_STYLE[capture.type]}`}>
      {capture.type === 'note' ? <NotepadText size={44} /> : <Image size={44} />}
    </div>
  );
}

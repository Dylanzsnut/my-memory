import type { CaptureRecord, Language } from '../types';
import { t } from '../lib/i18n';
import { SourceBadge } from './Hud';
import CaptureMedia from './capture/CaptureMedia';
import CaptureFacts from './capture/CaptureFacts';
import CaptureAskBox from './capture/CaptureAskBox';

interface Props {
  capture: CaptureRecord;
  language: Language;
  onExpand: () => void;
  onAskAbout: (question: string) => void;
  onAskPinned: () => void;
  technical?: boolean;
}

export default function CaptureInspector({ capture, language, onExpand, onAskAbout, onAskPinned, technical = false }: Props) {
  return (
    <aside
      id="capture-inspector"
      className="no-scrollbar max-h-[calc(100dvh-6rem)] space-y-3 overflow-y-auto rounded-3xl border border-line bg-canvas p-4 shadow-sm xl:sticky xl:top-20"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-accent">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-accent" />
          {t(language, 'selected')}
        </span>
        <SourceBadge source={capture.inferenceSource} language={language} plain={!technical} />
      </div>
      <div>
        <h2 className="font-serif text-[20px] font-bold leading-snug">{capture.summary}</h2>
        <p className="mt-1 text-[11px] text-ink3">
          {new Date(capture.capturedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
        </p>
      </div>
      <CaptureMedia capture={capture} language={language} onExpand={onExpand} />
      <button
        type="button"
        onClick={onExpand}
        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-line bg-surface2 text-[11.5px] font-bold text-ink2"
      >
        {t(language, 'openFullView')}
      </button>
      <CaptureFacts capture={capture} language={language} />
      <CaptureAskBox language={language} onAsk={onAskAbout} capture={capture} />
      <button
        type="button"
        onClick={onAskPinned}
        className="min-h-11 w-full rounded-full bg-accent text-[12px] font-bold text-white"
      >
        {t(language, 'askAbout')} · #{capture.id.slice(-4)}
      </button>
      <p className="flex items-center justify-center gap-1 text-[10px] text-ink3">
        {t(language, 'privacyPromise')}
      </p>
    </aside>
  );
}

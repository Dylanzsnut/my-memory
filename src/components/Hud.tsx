import { Cpu, Cloud, FlaskConical, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { HudEvent, InferenceSource, Language } from '../types';
import { t } from '../lib/i18n';

interface Props {
  events: HudEvent[];
  language: Language;
  demoMode: boolean;
}

const SOURCE_STYLE: Record<InferenceSource, string> = {
  ON_DEVICE: 'bg-teal-soft text-teal',
  IN_CLOUD: 'bg-gold-soft text-gold',
  SIMULATED: 'bg-accent-soft text-accent',
};

function SourceIcon({ source }: { source: InferenceSource }) {
  if (source === 'IN_CLOUD') return <Cloud size={13} />;
  if (source === 'SIMULATED') return <FlaskConical size={13} />;
  return <Cpu size={13} />;
}

export function SourceBadge({ source, language }: { source: InferenceSource; language: Language }) {
  const label = source === 'IN_CLOUD' ? t(language, 'inCloud') : source === 'SIMULATED' ? t(language, 'simulated') : t(language, 'onDevice');
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${SOURCE_STYLE[source]}`}>
      <SourceIcon source={source} /> {label}
    </span>
  );
}

export default function Hud({ events, language, demoMode }: Props) {
  const [open, setOpen] = useState(false);
  const onDeviceCalls = events.filter((e) => e.source === 'ON_DEVICE').length;
  const cloudCalls = events.filter((e) => e.source === 'IN_CLOUD').length;
  const simulatedCalls = events.filter((e) => e.source === 'SIMULATED').length;

  return (
    <div className="rounded-2xl border border-line bg-canvas p-3 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t(language, 'ariaToggleHud')}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-teal" />
          <span className="text-xs font-bold uppercase tracking-wider text-ink2">{t(language, 'hud')}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5 text-[11px] font-semibold text-ink2">
          <span className={onDeviceCalls ? 'text-teal' : ''}>
            {onDeviceCalls} {t(language, 'hudOnDevice')}
          </span>
          <span className={cloudCalls ? 'text-gold' : ''}>
            {cloudCalls} {t(language, 'hudCloud')}
          </span>
          <span className={simulatedCalls ? 'text-accent' : ''}>
            {simulatedCalls} {t(language, 'hudSimulated')}
          </span>
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {demoMode && (
        <p className="mt-2 rounded-lg bg-accent-soft px-2 py-1.5 text-[11px] leading-snug text-accent">
          {t(language, 'demoBanner')}
        </p>
      )}
      {open && (
        <div className="no-scrollbar mt-3 max-h-52 space-y-1.5 overflow-y-auto border-t border-line pt-2">
          {events.length === 0 && <p className="text-[11px] text-ink3">—</p>}
          {events.map((event) => (
            <div key={event.id} className="rounded-lg bg-surface2 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <SourceIcon source={event.source} />
                  <span className="truncate text-[11px] font-semibold text-ink2">{event.label}</span>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-ink3">{event.latencyMs} ms</span>
              </div>
              {event.detail && (
                <p className="mt-0.5 truncate pl-5 text-[11px] text-ink3" title={event.detail}>
                  {event.detail}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { ShieldCheck } from 'lucide-react';
import type { CaptureRecord, Language } from '../../types';
import { t } from '../../lib/i18n';

interface Props {
  capture: CaptureRecord;
  language: Language;
}

/** Read-only extracted facts. Entity approval stays in the detail view. */
export default function CaptureFacts({ capture, language }: Props) {
  return (
    <div className="rounded-2xl border border-line bg-surface2 p-4">
      <h2 className="text-[13px] font-bold">{t(language, 'whatWeFound')}</h2>
      <p className="mt-2 font-serif text-[14px] font-semibold leading-snug">“{capture.summary}”</p>
      {capture.derivedText && (
        <p className="mt-2 border-t border-line pt-2 font-mono text-[11px] leading-relaxed text-ink2">
          {capture.derivedText}
        </p>
      )}
      {capture.entities.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-ink2">{t(language, 'tapWordToTag')}</span>
            <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink3">
              {t(language, 'autoBadge')}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {capture.entities.map((entity, index) => (
              <span
                key={`${entity}-${index}`}
                className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-[11px] font-semibold text-ink2"
              >
                {entity}
              </span>
            ))}
          </div>
        </div>
      )}
      {capture.expiryDate && (
        <p className="mt-3 text-[11px] font-bold text-gold">
          {language === 'vi' ? 'Hạn dùng' : 'Expiry'}: {capture.expiryDate}
        </p>
      )}
      {capture.protectedReason && (
        <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-teal">
          <ShieldCheck size={12} /> {t(language, 'alwaysProtected')} · {capture.protectedReason}
        </p>
      )}
    </div>
  );
}

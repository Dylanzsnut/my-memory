import { ArrowLeft, ArrowUpRight, Image, Lock, Mic, NotepadText, ShieldCheck } from 'lucide-react';
import type { CaptureRecord, Language } from '../types';
import { t } from '../lib/i18n';
import { SourceBadge } from './Hud';

interface Props {
  capture: CaptureRecord;
  language: Language;
  onClose: () => void;
  onAskAbout: (capture: CaptureRecord) => void;
}

export default function DetailSheet({ capture, language, onClose, onAskAbout }: Props) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50" onClick={onClose}>
      <div
        className="animate-sheet flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-canvas shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-line bg-canvas/95 px-4 py-3">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line2" />
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface2 px-3 py-1.5 text-[12px] font-semibold">
              <ArrowLeft size={15} /> {t(language, 'back')}
            </button>
            <span className="text-[13px] font-bold">Memory #{capture.id.slice(-4)}</span>
            <SourceBadge source={capture.inferenceSource} language={language} />
          </div>
        </div>

        <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto p-4 pb-6">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink2">
            <span>{t(language, 'captured')}: {new Date(capture.capturedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}</span>
            <span>·</span>
            <span>{capture.type}</span>
            {capture.protectedReason && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2 py-0.5 text-[10px] font-bold text-teal">
                <ShieldCheck size={11} /> {t(language, 'alwaysProtected')}
              </span>
            )}
          </div>

          {capture.originalRef && capture.type === 'photo' ? (
            <div className="relative overflow-hidden rounded-2xl border border-line">
              <img src={capture.originalRef} alt="Original capture" className="w-full object-cover" />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-canvas/90 px-2.5 py-1 text-[10px] font-bold text-teal shadow-sm">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal" /> Original proof · on-device
              </span>
            </div>
          ) : (
            <div className="grid h-40 place-items-center rounded-2xl bg-teal-soft text-teal">
              {capture.type === 'voice' ? <Mic size={44} /> : capture.type === 'note' ? <NotepadText size={44} /> : <Image size={44} />}
            </div>
          )}

          <div className="rounded-2xl border border-line bg-surface2 p-4">
            <h2 className="text-[13px] font-bold">{t(language, 'extracted')}</h2>
            <p className="mt-2 font-serif text-[14px] font-semibold leading-snug">“{capture.summary}”</p>
            {capture.derivedText && (
              <p className="mt-2 border-t border-line pt-2 font-mono text-[11px] leading-relaxed text-ink2">
                {capture.derivedText}
              </p>
            )}
            {capture.entities.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {capture.entities.slice(0, 6).map((entity) => (
                  <span key={entity} className="truncate rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-[10.5px] font-semibold text-ink2">
                    {entity}
                  </span>
                ))}
              </div>
            )}
            {capture.expiryDate && (
              <p className="mt-3 text-[11px] font-bold text-gold">
                {language === 'vi' ? 'Hạn dùng' : 'Expiry'}: {capture.expiryDate}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-accent/20 bg-accent-soft/40 p-4">
            <h3 className="flex items-center gap-1.5 text-[13px] font-bold">
              <ArrowUpRight size={15} className="text-accent" /> {t(language, 'askAbout')}
            </h3>
            <div className="mt-3 space-y-2">
              {[
                language === 'vi' ? 'Hạn dùng là khi nào?' : 'When does it expire?',
                language === 'vi' ? 'Chi tiết trong capture này?' : 'What details are in this capture?',
                language === 'vi' ? 'Tôi đã lưu cái gì thế?' : 'What did I save here?',
              ].map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => onAskAbout(capture)}
                  className="flex w-full items-center justify-between rounded-xl border border-line bg-canvas px-3 py-2 text-left text-[12px] font-semibold transition-colors hover:border-accent"
                >
                  {question} <ArrowUpRight size={14} className="text-accent" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-line bg-canvas/95 p-4">
          <button
            type="button"
            onClick={() => onAskAbout(capture)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-[13px] font-bold text-white shadow-md active:scale-[0.98]"
          >
            {t(language, 'askAbout')} <ArrowUpRight size={16} />
          </button>
          <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-ink3">
            <Lock size={11} /> {language === 'vi' ? 'Bản gốc ở lại trên máy.' : 'The original stays on this device.'}
          </p>
        </div>
      </div>
    </div>
  );
}

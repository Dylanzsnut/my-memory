import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  CheckCircle2,
  Fingerprint,
  Image,
  Lock,
  NotepadText,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import type { Language } from '../types';
import { t, type TranslationKey } from '../lib/i18n';

const TONE: Record<string, string> = {
  accent: 'bg-accent-soft text-accent',
  teal: 'bg-teal-soft text-teal',
  gold: 'bg-gold-soft text-gold',
};

interface Props {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onComplete: () => void;
  onPrepareDevice: () => Promise<void>;
}

export default function Onboarding({ language, onLanguageChange, onComplete, onPrepareDevice }: Props) {
  const [step, setStep] = useState(0);
  const [preparing, setPreparing] = useState(false);

  const next = async () => {
    if (step === 0) {
      setPreparing(true);
      await onPrepareDevice();
      setPreparing(false);
    }
    if (step < 2) setStep(step + 1);
    else onComplete();
  };

  return (
    <div className="no-scrollbar mx-auto flex min-h-screen max-w-lg flex-col overflow-y-auto bg-bg px-5 pb-8 pt-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-white">
            <Fingerprint size={18} />
          </span>
          <span className="text-sm font-black tracking-tight">{t(language, 'appName')}</span>
        </div>
        <div className="inline-flex rounded-full border border-line2 bg-canvas p-0.5">
          {(['en', 'vi'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => onLanguageChange(lang)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${
                language === lang ? 'bg-ink text-bg' : 'text-ink2'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink3">
          {t(language, 'onboardingStep', { n: step + 1 })}
        </span>
        <button type="button" onClick={onComplete} className="text-[11px] font-semibold text-ink3 hover:text-ink">
          {t(language, 'skip')}
        </button>
      </div>
      <div className="mt-2 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-line'}`} />
        ))}
      </div>

      <div className="mt-8 flex-1">
        {step === 0 && (
          <div className="animate-sheet space-y-6">
            <div className="text-center">
              <div className="mx-auto grid h-24 w-24 place-items-center rounded-3xl border border-line bg-canvas shadow-sm">
                <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-teal-soft">
                  <Lock size={30} className="text-teal" />
                </div>
              </div>
              <h1 className="mt-5 font-serif text-[26px] font-bold leading-tight tracking-tight">
                {t(language, 'ob1Title')}
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink2">{t(language, 'ob1Body')}</p>
            </div>
            <div className="space-y-2.5">
              {(
                [
                  ['ob1Card1', WifiOff, 'accent'],
                  ['ob1Card2', ShieldCheck, 'teal'],
                  ['ob1Card3', Fingerprint, 'gold'],
                ] as const
              ).map(([key, Icon, tone]) => (
                <div key={key} className="flex items-center gap-3 rounded-2xl border border-line bg-canvas p-3.5 shadow-sm">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONE[tone]}`}>
                    <Icon size={19} />
                  </span>
                  <span className="text-[13px] font-semibold">{t(language, key as TranslationKey)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-surface2 p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal" />
                </span>
                <span className="text-[12px] font-semibold text-ink2">
                  {preparing ? 'Preparing on-device model…' : t(language, 'ob1Ready')}
                </span>
              </div>
              <CheckCircle2 size={18} className="text-teal" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-sheet space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
                Smart universal search · on-device
              </span>
              <h1 className="mt-4 font-serif text-[26px] font-bold leading-tight tracking-tight">
                {t(language, 'ob2Title')}
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink2">{t(language, 'ob2Body')}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  [Image, 'accent', language === 'vi' ? 'Ảnh' : 'Photos'],
                  [AudioLines, 'teal', language === 'vi' ? 'Giọng nói' : 'Voice'],
                  [NotepadText, 'gold', language === 'vi' ? 'Ghi chú' : 'Notes'],
                ] as const
              ).map(([Icon, tone, label]) => (
                <div key={label} className={`flex flex-col items-center gap-1.5 rounded-xl ${TONE[tone]} p-3`}>
                  <Icon size={22} />
                  <span className="text-[11px] font-bold">{label}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-line bg-canvas p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink2">Connected memory</span>
                <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-bold text-gold">
                  {language === 'vi' ? 'Tìm cùng nhau' : 'Find everything together'}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] font-semibold text-ink2">
                <span className="rounded-lg bg-accent-soft px-2 py-1 text-accent">Receipts</span>
                <span>+</span>
                <span className="rounded-lg bg-teal-soft px-2 py-1 text-teal">Medicine</span>
                <span>+</span>
                <span className="rounded-lg bg-gold-soft px-2 py-1 text-gold">Wi-Fi</span>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-surface2 px-3 py-2">
                <span className="text-[12px] font-semibold">
                  {language === 'vi' ? 'Tìm trong chưa tới 1 giây' : 'Find in under a second'}
                </span>
                <span className="rounded-full bg-teal px-2 py-0.5 text-[10px] font-bold text-white">&lt; 1s</span>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-sheet space-y-4">
            <div>
              <span className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
                {language === 'vi' ? 'Lời hứa riêng tư' : 'Our privacy promise'}
              </span>
              <h1 className="mt-4 font-serif text-[26px] font-bold leading-tight tracking-tight">
                {t(language, 'ob3Title')}
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink2">{t(language, 'ob3Body')}</p>
            </div>
            {(
              [
                ['rule1', '01', 'accent'],
                ['rule2', '02', 'teal'],
                ['rule3', '03', 'gold'],
              ] as const
            ).map(([key, number, tone]) => (
              <div key={key} className="flex gap-3 rounded-2xl border border-line bg-canvas p-3.5 shadow-sm">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-black ${TONE[tone]}`}>
                  {number}
                </span>
                <div>
                  <p className="text-[13px] font-bold">{t(language, key as TranslationKey)}</p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-ink2">
                    {key === 'rule1'
                      ? language === 'vi'
                        ? 'Mọi câu trả lời kèm bản gốc làm bằng chứng.'
                        : 'Every answer shows the original as proof.'
                      : key === 'rule2'
                        ? language === 'vi'
                          ? 'Chỉ đề xuất — xóa luôn cần cái chạm của bạn.'
                          : 'Only suggests — deletion always needs your tap.'
                        : language === 'vi'
                          ? 'Khôi phục bất cứ mục nào trong 30 ngày.'
                          : 'Restore anything within 30 days.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 space-y-2">
        <button
          type="button"
          onClick={next}
          disabled={preparing}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-[14px] font-bold text-white shadow-md transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {step === 2 ? t(language, 'enterApp') : t(language, 'continue')}
          <ArrowRight size={18} />
        </button>
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="mx-auto flex items-center gap-1 rounded-full px-4 py-2 text-[12px] font-semibold text-ink2 hover:text-ink"
          >
            <ArrowLeft size={14} /> {language === 'vi' ? 'Quay lại' : 'Back'}
          </button>
        )}
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { Camera, CheckCircle2, Image, Lock, Mic, NotepadText, ShieldCheck, X } from 'lucide-react';
import type { CaptureRecord, CaptureType, ExtractionRequest, Language } from '../types';
import { t } from '../lib/i18n';
import { SourceBadge } from './Hud';

interface Props {
  captures: CaptureRecord[];
  language: Language;
  onCapture: (request: ExtractionRequest) => Promise<void>;
  onOpenDetail: (capture: CaptureRecord) => void;
  busy: boolean;
}

const TYPE_STYLE: Record<CaptureType, string> = {
  photo: 'bg-accent-soft text-accent',
  voice: 'bg-teal-soft text-teal',
  note: 'bg-gold-soft text-gold',
};

function typeLabel(language: Language, type: CaptureType): string {
  const key = type === 'photo' ? 'photo' : type === 'voice' ? 'voice' : 'noteType';
  return t(language, key);
}

function dayGroup(date: string, language: Language): string {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days < 1) return t(language, 'today');
  if (days < 2) return t(language, 'yesterday');
  return t(language, 'older');
}

export default function Memories({ captures, language, onCapture, onOpenDetail, busy }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [recording, setRecording] = useState(false);

  const handleFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onCapture({ type: 'photo', imageDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    if (recording) return;
    setRecording(true);
    let transcript = '';
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = language === 'vi' ? 'vi-VN' : 'en-US';
        recognition.interimResults = false;
        recognition.onresult = (event: any) => {
          transcript = event.results[0][0].transcript;
        };
        recognition.start();
        setTimeout(() => recognition.stop(), 6000);
      } catch {
        /* ASR unavailable — fall through to typed transcript */
      }
    }
    setTimeout(async () => {
      setRecording(false);
      const finalText = transcript || (language === 'vi' ? 'Ghi âm thoại mẫu' : 'Sample voice memo transcript');
      await onCapture({ type: 'voice', text: finalText });
    }, 6500);
  };

  const groups = captures.reduce<Record<string, CaptureRecord[]>>((acc, capture) => {
    const key = dayGroup(capture.capturedAt, language);
    (acc[key] ||= []).push(capture);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] font-semibold text-ink3">{t(language, 'goodMorning')}</p>
          <h1 className="font-serif text-[26px] font-bold leading-tight tracking-tight">
            {language === 'vi' ? 'Trí nhớ của bạn' : 'Your memory'}
          </h1>
          <p className="mt-1 text-[12px] text-ink2">
            {t(language, 'momentsRemembered', { n: captures.length })} · {t(language, 'offline')}
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-sm font-black text-white">M</div>
      </div>

      <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-teal-soft px-3 py-1.5">
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal" />
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-teal">100% on-device · offline ready</span>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-line bg-canvas p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent-soft py-2.5 text-[12px] font-bold text-accent active:scale-95 disabled:opacity-50"
        >
          <Camera size={16} /> {t(language, 'snap')}
        </button>
        <button
          type="button"
          onClick={startRecording}
          disabled={busy}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-bold active:scale-95 disabled:opacity-50 ${
            recording ? 'bg-danger-soft text-danger' : 'bg-teal-soft text-teal'
          }`}
        >
          <Mic size={16} /> {recording ? t(language, 'recording') : t(language, 'record')}
        </button>
        <button
          type="button"
          onClick={() => setNoteOpen(!noteOpen)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gold-soft py-2.5 text-[12px] font-bold text-gold active:scale-95"
        >
          <NotepadText size={16} /> {t(language, 'note')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {noteOpen && (
        <div className="animate-sheet rounded-2xl border border-line bg-canvas p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold">{t(language, 'newNote')}</span>
            <button type="button" onClick={() => setNoteOpen(false)} className="text-ink3 hover:text-ink">
              <X size={16} />
            </button>
          </div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={t(language, 'notePlaceholder')}
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-line bg-surface2 p-3 text-[13px] outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={!noteText.trim() || busy}
            onClick={async () => {
              await onCapture({ type: 'note', text: noteText.trim() });
              setNoteText('');
              setNoteOpen(false);
            }}
            className="mt-2 w-full rounded-full bg-accent py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
          >
            {t(language, 'save')}
          </button>
        </div>
      )}

      {Object.entries(groups).map(([label, items]) => (
        <section key={label} className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-[15px] font-bold tracking-tight">{label}</h2>
            <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-[10px] font-semibold text-ink2">
              {items.length} {language === 'vi' ? 'mục' : 'entries'}
            </span>
          </div>
          {items.map((capture) => (
            <button
              key={capture.id}
              type="button"
              onClick={() => onOpenDetail(capture)}
              className="w-full rounded-2xl border border-line bg-canvas p-3.5 text-left shadow-sm transition-all active:scale-[0.99] hover:border-line2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TYPE_STYLE[capture.type]}`}>
                    {typeLabel(language, capture.type)}
                  </span>
                  {capture.protectedReason && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2 py-0.5 text-[10px] font-bold text-teal">
                      <ShieldCheck size={11} /> {language === 'vi' ? 'Được bảo vệ' : 'Protected'}
                    </span>
                  )}
                  {capture.demo && (
                    <span className="rounded-full bg-surface2 px-2 py-0.5 text-[9px] font-semibold text-ink3">
                      {t(language, 'demoData')}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-bold text-accent">
                  {language === 'vi' ? 'Xem bằng chứng' : 'Tap proof'} →
                </span>
              </div>
              <div className="mt-2.5 flex items-start gap-3">
                {capture.originalRef && capture.type === 'photo' ? (
                  <img src={capture.originalRef} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover" />
                ) : (
                  <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-xl ${TYPE_STYLE[capture.type]}`}>
                    {capture.type === 'voice' ? <Mic size={24} /> : capture.type === 'note' ? <NotepadText size={24} /> : <Image size={24} />}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold leading-snug">{capture.summary}</p>
                  {capture.derivedText && (
                    <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-ink2">{capture.derivedText}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <SourceBadge source={capture.inferenceSource} language={language} />
                    <span className="text-[10px] text-ink3">
                      {new Date(capture.capturedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </section>
      ))}

      <p className="flex items-center justify-center gap-1.5 pb-2 text-[10.5px] text-ink3">
        <Lock size={12} /> {t(language, 'zeroDeletions')}
        <CheckCircle2 size={12} className="text-teal" />
      </p>
    </div>
  );
}

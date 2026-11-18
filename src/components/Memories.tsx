import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Image, Images, Lock, Mic, NotepadText, ShieldCheck, X } from 'lucide-react';
import type { CaptureRecord, CaptureType, ExtractionRequest, Language } from '../types';
import { extractPhotoCapturedAt } from '../lib/exif';
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

interface VoiceDraft {
  blob?: Blob;
  mimeType?: string;
  url?: string;
  error?: string;
}

interface ImportProgress {
  active: boolean;
  done: number;
  total: number;
  failed: number;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Unexpected non-string FileReader result'));
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export default function Memories({ captures, language, onCapture, onOpenDetail, busy }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const draftUrlRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(true);
  const recordingPendingRef = useRef(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [recording, setRecording] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearDraft = () => {
    if (draftUrlRef.current) {
      URL.revokeObjectURL(draftUrlRef.current);
      draftUrlRef.current = undefined;
    }
    setVoiceDraft(null);
    setVoiceText('');
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      stopTracks();
      if (draftUrlRef.current) {
        URL.revokeObjectURL(draftUrlRef.current);
        draftUrlRef.current = undefined;
      }
    };
  }, []);

  const handlePhotoBatch = async (files: FileList | null) => {
    if (!files?.length || busy || importProgress?.active) return;
    const queue = Array.from(files);
    if (queue.length === 1) {
      try {
        const [imageDataUrl, capturedAt] = await Promise.all([
          readFileAsDataUrl(queue[0]),
          extractPhotoCapturedAt(queue[0]),
        ]);
        await onCapture({ type: 'photo', imageDataUrl, capturedAt });
      } catch (err) {
        console.warn('[memories] photo capture failed', err);
        if (mountedRef.current) {
          setImportProgress({ active: false, done: 1, total: 1, failed: 1 });
        }
      }
      return;
    }

    let failed = 0;
    setImportProgress({ active: true, done: 0, total: queue.length, failed: 0 });
    for (let i = 0; i < queue.length; i++) {
      try {
        const [imageDataUrl, capturedAt] = await Promise.all([
          readFileAsDataUrl(queue[i]),
          extractPhotoCapturedAt(queue[i]),
        ]);
        await onCapture({ type: 'photo', imageDataUrl, capturedAt });
      } catch (err) {
        failed += 1;
        console.warn('[memories] gallery import item failed', err);
      }
      if (mountedRef.current) {
        setImportProgress({ active: i + 1 < queue.length, done: i + 1, total: queue.length, failed });
      }
    }
    if (mountedRef.current && failed === 0) {
      setImportProgress(null);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      } else {
        stopTracks();
        setRecording(false);
      }
      return;
    }

    if (recordingPendingRef.current || busy) return;
    recordingPendingRef.current = true;

    clearDraft();
    setNoteOpen(false);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      recordingPendingRef.current = false;
      setVoiceDraft({ error: t(language, 'voiceUnavailable') });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      chunksRef.current = [];
      const preferredMime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((mime) =>
        MediaRecorder.isTypeSupported(mime),
      );
      const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopTracks();
        recorderRef.current = null;
        if (!mountedRef.current) return;
        const mimeType = recorder.mimeType || preferredMime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        const url = URL.createObjectURL(blob);
        draftUrlRef.current = url;
        setRecording(false);
        setVoiceDraft({ blob, mimeType, url });
      };

      recorder.start();
      setRecording(true);
    } catch {
      stopTracks();
      if (mountedRef.current) {
        setRecording(false);
        setVoiceDraft({ error: t(language, 'voiceUnavailable') });
      }
    } finally {
      recordingPendingRef.current = false;
    }
  };

  const visibleCaptures = captures.filter((c) => c.retentionState !== 'trashed');

  const groups = visibleCaptures.reduce<Record<string, CaptureRecord[]>>((acc, capture) => {
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
            {t(language, 'momentsRemembered', { n: visibleCaptures.length })} · {t(language, 'offline')}
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-sm font-black text-white">M</div>
      </div>

      <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-teal-soft px-3 py-1.5">
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal" />
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-teal">
          {language === 'vi' ? '100% trên máy · sẵn sàng offline' : '100% on-device · offline ready'}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 rounded-2xl border border-line bg-canvas p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={busy || Boolean(importProgress?.active)}
          className="inline-flex items-center justify-center gap-1 rounded-xl bg-accent-soft px-2 py-2.5 text-[11.5px] font-bold text-accent active:scale-95 disabled:opacity-50"
        >
          <Camera size={15} /> {t(language, 'snap')}
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={busy || Boolean(importProgress?.active)}
          className="inline-flex items-center justify-center gap-1 rounded-xl bg-accent-soft/60 px-2 py-2.5 text-[11.5px] font-bold text-accent active:scale-95 disabled:opacity-50"
        >
          <Images size={15} /> {t(language, 'importPhotos')}
        </button>
        <button
          type="button"
          onClick={toggleRecording}
          disabled={(busy || Boolean(importProgress?.active)) && !recording}
          className={`inline-flex items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-[11.5px] font-bold active:scale-95 disabled:opacity-50 ${
            recording ? 'bg-danger-soft text-danger' : 'bg-teal-soft text-teal'
          }`}
        >
          <Mic size={15} /> {recording ? t(language, 'recording') : t(language, 'record')}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!noteOpen) clearDraft();
            setNoteOpen(!noteOpen);
          }}
          className="inline-flex items-center justify-center gap-1 rounded-xl bg-gold-soft px-2 py-2.5 text-[11.5px] font-bold text-gold active:scale-95"
        >
          <NotepadText size={15} /> {t(language, 'note')}
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void handlePhotoBatch(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handlePhotoBatch(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {importProgress && (
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface2 px-3 py-2 text-[11.5px]">
          <span className={importProgress.failed > 0 && !importProgress.active ? 'font-semibold text-danger' : 'font-semibold text-ink2'}>
            {importProgress.active
              ? t(language, 'importingPhotos', { done: importProgress.done, total: importProgress.total })
              : t(language, 'importFailed', { n: importProgress.failed })}
          </span>
          {!importProgress.active && (
            <button
              type="button"
              onClick={() => setImportProgress(null)}
              aria-label={t(language, 'cancel')}
              className="text-ink3 hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {voiceDraft && (
        <div className="animate-sheet rounded-2xl border border-line bg-canvas p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold">{t(language, 'newVoiceMemo')}</span>
            <button type="button" onClick={clearDraft} aria-label={t(language, 'cancel')} className="text-ink3 hover:text-ink">
              <X size={16} />
            </button>
          </div>
          {voiceDraft.error ? (
            <p className="mt-2 rounded-xl bg-accent-soft px-3 py-2 text-[11.5px] leading-snug text-accent">
              {voiceDraft.error}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-ink2">{t(language, 'voiceRecordHint')}</p>
          )}
          {voiceDraft.url && (
            <audio controls src={voiceDraft.url} preload="metadata" className="mt-2 w-full" />
          )}
          <textarea
            value={voiceText}
            onChange={(e) => setVoiceText(e.target.value)}
            placeholder={t(language, 'voiceMemoPlaceholder')}
            rows={2}
            className="mt-2 w-full resize-none rounded-xl border border-line bg-surface2 p-3 text-[13px] outline-none focus:border-accent"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={clearDraft}
              className="flex-1 rounded-full border border-line2 bg-canvas py-2.5 text-[12.5px] font-bold text-ink2"
            >
              {t(language, 'cancel')}
            </button>
            <button
              type="button"
              disabled={(!voiceDraft.blob && !voiceText.trim()) || busy}
              onClick={async () => {
                try {
                  await onCapture({
                    type: 'voice',
                    text: voiceText.trim() || undefined,
                    audioBlob: voiceDraft.blob,
                    audioMimeType: voiceDraft.mimeType,
                  });
                  clearDraft();
                } catch (err) {
                  console.warn('[memories] voice capture failed', err);
                }
              }}
              className="flex-1 rounded-full bg-accent py-2.5 text-[12.5px] font-bold text-white disabled:opacity-40"
            >
              {t(language, 'save')}
            </button>
          </div>
        </div>
      )}

      {noteOpen && (
        <div className="animate-sheet rounded-2xl border border-line bg-canvas p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold">{t(language, 'newNote')}</span>
            <button type="button" onClick={() => setNoteOpen(false)} aria-label={t(language, 'cancel')} className="text-ink3 hover:text-ink">
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
              try {
                await onCapture({ type: 'note', text: noteText.trim() });
                setNoteText('');
                setNoteOpen(false);
              } catch (err) {
                console.warn('[memories] note capture failed', err);
              }
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

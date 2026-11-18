import { useState } from 'react';
import { Fingerprint, FlaskConical, Languages, Lock, ShieldCheck } from 'lucide-react';
import type { AuthSession, Language } from '../types';
import { isFirebaseConfigured } from '../lib/config';
import { signInWithGoogle } from '../lib/firebase';
import { DEMO_UID } from '../lib/store';
import { t } from '../lib/i18n';

interface Props {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onAuthenticated: (session: AuthSession) => Promise<void> | void;
}

export default function SignInGate({ language, onLanguageChange, onAuthenticated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    if (loading) return;
    setError(null);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError(t(language, 'authOffline'));
      return;
    }
    setLoading(true);
    try {
      const session = await signInWithGoogle();
      await onAuthenticated(session);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const raw = err instanceof Error ? err.message : String(err);
      if (raw === 'offline' || code === 'auth/network-request-failed') {
        setError(t(language, 'authOffline'));
      } else if (code === 'auth/popup-blocked') {
        setError(t(language, 'authPopupBlocked'));
      } else {
        setError(t(language, 'authFailed', { msg: raw.slice(0, 120) }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    if (loading) return;
    setError(null);
    await onAuthenticated({
      mode: 'demo',
      uid: DEMO_UID,
      email: null,
      displayName: t(language, 'demoBadge'),
    });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-between bg-bg px-5 pb-8 pt-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-white">
            <Fingerprint size={18} />
          </span>
          <span className="text-sm font-black tracking-tight">{t(language, 'appName')}</span>
        </div>
        <button
          type="button"
          onClick={() => onLanguageChange(language === 'en' ? 'vi' : 'en')}
          aria-label={t(language, 'ariaToggleLanguage')}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line2 bg-canvas px-3 py-1.5 text-[11px] font-bold uppercase text-ink2"
        >
          <Languages size={14} /> {language}
        </button>
      </header>

      <div className="my-auto py-8">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-line bg-canvas shadow-sm">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-soft">
            <Lock size={28} className="text-teal" />
          </div>
        </div>
        <h1 className="mt-6 text-center font-serif text-[26px] font-bold leading-tight tracking-tight">
          {t(language, 'signInTitle')}
        </h1>
        <p className="mt-3 text-center text-[13px] leading-relaxed text-ink2">
          {t(language, 'signInBody')}
        </p>

        {error && (
          <div className="mt-4 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-[12px] font-medium text-danger">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={loading || !isFirebaseConfigured}
            onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-[13.5px] font-bold text-white shadow-md transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            <ShieldCheck size={17} />
            {loading ? t(language, 'signingIn') : t(language, 'signInGoogle')}
          </button>

          {!isFirebaseConfigured && (
            <p className="text-center text-[11px] text-ink3">
              {language === 'vi'
                ? 'Chưa cấu hình Firebase trong .env — dùng Chế độ Demo tại chỗ.'
                : 'Firebase config not present in .env — use local Demo mode below.'}
            </p>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={handleDemo}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-line2 bg-canvas py-3 text-[13px] font-bold text-ink transition-colors hover:border-accent"
          >
            <FlaskConical size={16} className="text-accent" />
            {t(language, 'enterDemoMode')}
          </button>
        </div>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-ink3">
        <Lock size={12} /> {t(language, 'authOffline')}
      </p>
    </div>
  );
}

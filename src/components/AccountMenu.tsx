import { useRef, useState } from 'react';
import { ChevronUp, LogOut, Trash2, User } from 'lucide-react';
import type { AuthSession, Language } from '../types';
import { t } from '../lib/i18n';
import { useOutsideDismiss } from '../lib/useDialog';

interface Props {
  session: AuthSession;
  language: Language;
  onSignOut: () => Promise<void> | void;
  onDeleteAccount: () => Promise<void> | void;
  variant?: 'pill' | 'card';
  technical?: boolean;
  onToggleTechnical?: () => void;
}

export default function AccountMenu({
  session,
  language,
  onSignOut,
  onDeleteAccount,
  variant = 'pill',
  technical = false,
  onToggleTechnical,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutsideDismiss(menuRef, open, () => {
    setOpen(false);
    setConfirmDelete(false);
  });

  const display = session.mode === 'demo' ? t(language, 'demoBadge') : session.email || session.uid.slice(0, 8);

  return (
    <div ref={menuRef} className={variant === 'pill' ? 'relative' : 'relative w-full'}>
      {variant === 'pill' ? (
        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value);
            setConfirmDelete(false);
          }}
          aria-label={t(language, 'ariaAccountMenu')}
          aria-expanded={open}
          className="inline-flex min-h-11 max-w-36 items-center gap-1.5 rounded-full border border-line2 bg-canvas px-3 py-1.5 text-[11px] font-bold text-ink2"
        >
          <User size={13} className="shrink-0" />
          <span className="truncate">{display}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value);
            setConfirmDelete(false);
          }}
          aria-label={t(language, 'ariaAccountMenu')}
          aria-expanded={open}
          className="flex w-full min-h-11 items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface2"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-black text-white">
            {(session.displayName || display).slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-bold text-ink">{display}</span>
            <span className="block truncate text-[11px] text-ink3">
              {session.mode === 'demo' ? t(language, 'demoBadge') : t(language, 'personalVault')}
            </span>
          </span>
          <ChevronUp size={14} className={`shrink-0 text-ink3 transition-transform ${open ? '' : 'rotate-180'}`} />
        </button>
      )}

      {open && (
        <div
          className={`absolute z-50 w-64 rounded-2xl border border-line bg-canvas p-3 shadow-xl ${
            variant === 'pill' ? 'right-0 top-12' : 'bottom-full left-0 mb-2'
          }`}
        >
          <p className="truncate text-[11.5px] font-bold text-ink">{display}</p>
          {technical && <p className="mt-0.5 truncate font-mono text-[11px] text-ink3">uid: {session.uid}</p>}
          <div className="mt-2.5 space-y-1.5 border-t border-line pt-2.5">
            {onToggleTechnical && (
              <button
                type="button"
                onClick={onToggleTechnical}
                aria-label={t(language, 'ariaToggleTechnical')}
                aria-pressed={technical}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-surface2 px-3 py-2 text-left text-[12px] font-semibold text-ink2 hover:bg-line/40"
              >
                <User size={14} /> {technical ? t(language, 'technicalDetailsOff') : t(language, 'technicalDetails')}
              </button>
            )}
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-surface2 px-3 py-2 text-left text-[12px] font-semibold text-ink hover:bg-line/40"
            >
              <LogOut size={14} /> {t(language, 'signOut')}
            </button>
            {confirmDelete ? (
              <div className="rounded-xl border border-danger/30 bg-danger-soft p-2">
                <p className="text-[11px] font-semibold text-danger">{t(language, 'deleteAccountConfirm')}</p>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="min-h-11 flex-1 rounded-full border border-line bg-canvas py-1 text-[11px] font-bold text-ink2"
                  >
                    {t(language, 'cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteAccount()}
                    className="min-h-11 flex-1 rounded-full bg-danger py-1 text-[11px] font-bold text-white"
                  >
                    {t(language, 'deletePerm')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-danger-soft/50 px-3 py-2 text-left text-[12px] font-semibold text-danger hover:bg-danger-soft"
              >
                <Trash2 size={14} /> {t(language, 'deleteAccount')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

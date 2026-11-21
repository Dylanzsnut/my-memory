import { Fingerprint } from 'lucide-react';
import type { AuthSession, Language, Tab } from '../types';
import { t } from '../lib/i18n';
import { formatBytes, useStorageEstimate } from '../lib/storage';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { NAV_ITEMS } from './BottomNav';
import AccountMenu from './AccountMenu';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  language: Language;
  reviewCount: number;
  memoriesCount: number;
  session: AuthSession;
  onSignOut: () => Promise<void> | void;
  onDeleteAccount: () => Promise<void> | void;
  technical?: boolean;
  onToggleTechnical?: () => void;
}

export default function SideNav({
  active,
  onChange,
  language,
  reviewCount,
  memoriesCount,
  session,
  onSignOut,
  onDeleteAccount,
  technical = false,
  onToggleTechnical,
}: Props) {
  const online = useOnlineStatus();
  const storageUsage = useStorageEstimate();

  return (
    <nav
      aria-label={t(language, 'ariaMainNav')}
      className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-canvas px-3 py-5 md:flex"
    >
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent text-white">
          <Fingerprint size={18} />
        </span>
        <span>
          <span className="block text-[13px] font-black tracking-tight">{t(language, 'appName')}</span>

        </span>
      </div>

      {NAV_ITEMS.map(({ id, icon: Icon, key }) => {
        const isActive = active === id || (id === 'forget' && active === 'trash');
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold ${
              isActive ? 'bg-accent-soft text-accent' : 'text-ink2 hover:bg-surface2'
            }`}
          >
            <Icon size={18} strokeWidth={isActive ? 2.6 : 2} />
            <span className="flex-1 text-left">{t(language, key)}</span>
            {id === 'memories' && memoriesCount > 0 && (
              <span className="rounded-full bg-surface2 px-2 text-[11px] font-bold text-ink2">
                {memoriesCount}
              </span>
            )}
            {id === 'forget' && reviewCount > 0 && (
              <span className="rounded-full bg-accent px-2 text-[11px] font-bold text-white">
                {reviewCount}
              </span>
            )}
          </button>
        );
      })}

      <div className="mt-auto space-y-2 pt-4">
        <div className="rounded-xl border border-line bg-bg px-3 py-2">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${online ? 'bg-teal' : 'bg-gold'}`} />
            <span className="truncate text-[11px] font-bold text-ink2">
              {t(language, online ? 'onlineLive' : 'offlineLive')}
            </span>
          </div>
          {technical && storageUsage !== null && (
            <p className="mt-1 truncate text-[10px] text-ink3">
              {formatBytes(storageUsage)} {t(language, 'localStorage')}
            </p>
          )}
        </div>
        <AccountMenu
          session={session}
          language={language}
          onSignOut={onSignOut}
          onDeleteAccount={onDeleteAccount}
          variant="card"
          technical={technical}
          onToggleTechnical={onToggleTechnical}
        />
      </div>
    </nav>
  );
}

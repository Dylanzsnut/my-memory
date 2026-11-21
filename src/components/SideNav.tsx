import { Fingerprint } from 'lucide-react';
import type { Language, Tab } from '../types';
import { t } from '../lib/i18n';
import { NAV_ITEMS } from './BottomNav';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  language: Language;
  reviewCount: number;
}

export default function SideNav({ active, onChange, language, reviewCount }: Props) {
  return (
    <nav
      aria-label={t(language, 'ariaMainNav')}
      className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-line bg-canvas px-3 py-5 md:flex"
    >
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-white">
          <Fingerprint size={18} />
        </span>
        <span className="text-[13px] font-black tracking-tight">{t(language, 'appName')}</span>
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
            {id === 'forget' && reviewCount > 0 && (
              <span className="rounded-full bg-accent px-2 text-[11px] font-bold text-white">
                {reviewCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

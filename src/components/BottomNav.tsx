import { BookOpen, MessageCircle, Sparkles } from 'lucide-react';
import type { Language, Tab } from '../types';
import { t } from '../lib/i18n';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  language: Language;
  reviewCount: number;
}

export const NAV_ITEMS: { id: Tab; icon: typeof BookOpen; key: 'memories' | 'ask' | 'forget' }[] = [
  { id: 'memories', icon: BookOpen, key: 'memories' },
  { id: 'ask', icon: MessageCircle, key: 'ask' },
  { id: 'forget', icon: Sparkles, key: 'forget' },
];

export default function BottomNav({ active, onChange, language, reviewCount }: Props) {
  return (
    <nav className="sticky bottom-0 z-30 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-4">
        {NAV_ITEMS.map(({ id, icon: Icon, key }) => {
          const isActive = active === id || (id === 'forget' && active === 'trash');
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 py-1 ${
                isActive ? 'text-accent' : 'text-ink2 hover:text-ink'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.6 : 2} />
              <span className={`text-[11px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {t(language, key)}
              </span>
              {id === 'forget' && reviewCount > 0 && (
                <span className="absolute -top-1 right-2 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
                  {reviewCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

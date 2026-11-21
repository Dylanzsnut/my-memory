import { FormEvent, useEffect, useRef, useState } from 'react';
import { Image, Languages, Mic, NotepadText, Search } from 'lucide-react';
import type { Language } from '../types';
import { t } from '../lib/i18n';

export type QuickCapture = 'photo' | 'voice' | 'note';

interface Props {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onSearch: (query: string) => void;
  onQuickCapture: (kind: QuickCapture) => void;
}

export default function DesktopTopBar({ language, onLanguageChange, onSearch, onQuickCapture }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim());
  };

  return (
    <div className="sticky top-0 z-20 hidden items-center gap-3 border-b border-line bg-canvas/90 px-8 py-3 backdrop-blur md:flex">
      <form onSubmit={submit} className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-line2 bg-bg px-4">
        <Search size={16} className="shrink-0 text-accent" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t(language, 'topSearchPlaceholder')}
          aria-label={t(language, 'topSearchPlaceholder')}
          className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink3"
        />
      </form>
      <button
        type="button"
        onClick={() => onQuickCapture('photo')}
        aria-label={t(language, 'photo')}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent-soft px-4 text-[12px] font-bold text-accent"
      >
        <Image size={15} /> + {t(language, 'photo')}
      </button>
      <button
        type="button"
        onClick={() => onQuickCapture('voice')}
        aria-label={t(language, 'record')}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-teal-soft px-4 text-[12px] font-bold text-teal"
      >
        <Mic size={15} /> + {t(language, 'record')}
      </button>
      <button
        type="button"
        onClick={() => onQuickCapture('note')}
        aria-label={t(language, 'note')}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-gold-soft px-4 text-[12px] font-bold text-gold"
      >
        <NotepadText size={15} /> + {t(language, 'note')}
      </button>
      <button
        type="button"
        onClick={() => onLanguageChange(language === 'en' ? 'vi' : 'en')}
        aria-label={t(language, 'ariaToggleLanguage')}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line2 bg-canvas px-3 text-[11px] font-bold uppercase text-ink2"
      >
        <Languages size={14} /> {language}
      </button>
    </div>
  );
}

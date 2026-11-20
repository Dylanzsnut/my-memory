import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import type { Language } from '../types';
import { t } from '../lib/i18n';
import { sortTagOptions, type TagOption } from '../lib/tagOptions';

interface Props {
  language: Language;
  tags: TagOption[];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
  showUntagged?: boolean;
  untaggedValue?: string;
  untaggedCount?: number;
  collapsedCount?: number;
  searchThreshold?: number;
}

const DEFAULT_UNTAGGED = '__untagged__';

export default function TagFilterBar({
  language,
  tags,
  activeTag,
  onSelect,
  showUntagged = false,
  untaggedValue = DEFAULT_UNTAGGED,
  untaggedCount,
  collapsedCount = 5,
  searchThreshold = 12,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase();
  const sorted = useMemo(
    () => sortTagOptions(tags, activeTag, untaggedValue, language === 'vi' ? 'vi' : 'en'),
    [tags, activeTag, untaggedValue, language],
  );
  const matching = query ? sorted.filter((option) => option.tag.toLocaleLowerCase().includes(query)) : sorted;
  const collapsed = !expanded && !query;
  const visible = collapsed ? matching.slice(0, collapsedCount) : matching;
  const hiddenCount = collapsed ? sorted.length - visible.length : 0;
  const showSearch = tags.length >= searchThreshold;
  const untaggedLabel = t(language, 'untagged');
  const showUntaggedChip =
    showUntagged && (!query || untaggedLabel.toLocaleLowerCase().includes(query));

  const chipClass = (selected: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
      selected ? 'border-teal bg-teal text-white' : 'border-line bg-canvas text-ink2 hover:border-teal'
    }`;

  const countBadge = (count?: number, selected = false) =>
    count !== undefined ? (
      <span
        aria-hidden="true"
        className={`rounded-full px-1.5 text-[11px] font-bold ${selected ? 'bg-white/20 text-white' : 'bg-surface2 text-ink2'}`}
      >
        {count}
      </span>
    ) : null;

  return (
    <div className="space-y-2">
      {expanded && showSearch && (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3">
          <Search size={14} className="shrink-0 text-ink3" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t(language, 'tagFilterSearch')}
            aria-label={t(language, 'tagFilterSearch')}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink3"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={!activeTag}
          className={chipClass(!activeTag)}
        >
          {t(language, 'allTags')}
        </button>

        {visible.map(({ tag, count }) => {
          const selected = activeTag === tag;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onSelect(selected ? null : tag)}
              aria-pressed={selected}
              aria-label={count !== undefined ? `#${tag} — ${t(language, 'tagFilterCount', { n: count })}` : `#${tag}`}
              className={chipClass(selected)}
            >
              #{tag}
              {countBadge(count, selected)}
            </button>
          );
        })}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded={false}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-[11px] font-bold text-accent"
          >
            {t(language, 'tagFilterMore', { n: hiddenCount })} <ChevronDown size={12} />
          </button>
        )}

        {showUntaggedChip && (
          <button
            type="button"
            onClick={() => onSelect(activeTag === untaggedValue ? null : untaggedValue)}
            aria-pressed={activeTag === untaggedValue}
            aria-label={
              untaggedCount !== undefined
                ? `${untaggedLabel} — ${t(language, 'tagFilterCount', { n: untaggedCount })}`
                : untaggedLabel
            }
            className={chipClass(activeTag === untaggedValue)}
          >
            {untaggedLabel}
            {countBadge(untaggedCount, activeTag === untaggedValue)}
          </button>
        )}

        {expanded && sorted.length > collapsedCount && (
          <button
            type="button"
            onClick={() => { setExpanded(false); setSearch(''); }}
            aria-expanded
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-line bg-canvas px-3 py-1 text-[11px] font-bold text-ink2"
          >
            {t(language, 'tagFilterLess')} <ChevronUp size={12} />
          </button>
        )}

        {query && matching.length === 0 && (
          <span className="text-[11px] text-ink2">{t(language, 'tagFilterNoMatches')}</span>
        )}
      </div>
    </div>
  );
}

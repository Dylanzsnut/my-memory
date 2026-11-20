export interface TagOption {
  tag: string;
  count?: number;
}

/** Most-used tags first; alphabetical tie-break; selected tag always pinned. */
export function sortTagOptions(
  options: TagOption[],
  activeTag: string | null,
  untaggedValue: string = '__untagged__',
  locale = 'en',
): TagOption[] {
  const sorted = [...options].sort((a, b) => {
    const byCount = (b.count ?? 0) - (a.count ?? 0);
    if (byCount !== 0) return byCount;
    return a.tag.localeCompare(b.tag, locale, { sensitivity: 'base' });
  });
  if (!activeTag || activeTag === untaggedValue) return sorted;
  const index = sorted.findIndex((option) => option.tag === activeTag);
  if (index > 0) sorted.unshift(sorted.splice(index, 1)[0]);
  return sorted;
}

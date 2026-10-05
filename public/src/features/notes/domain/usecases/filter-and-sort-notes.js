export function filterAndSortNotes(notes, { search = '', filter = 'all', now = Date.now() } = {}) {
  const needle = search.trim().toLowerCase();
  const recentAfter = now - 7 * 24 * 60 * 60 * 1000;
  return [...notes]
    .filter(note => filter !== 'pinned' || note.pinned)
    .filter(note => filter !== 'recent' || note.updatedAt > recentAfter)
    .filter(note => !needle || note.title.toLowerCase().includes(needle)
      || (note.content || '').toLowerCase().includes(needle)
      || (note.tags || []).some(tag => tag.toLowerCase().includes(needle)))
    .sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.updatedAt - left.updatedAt);
}

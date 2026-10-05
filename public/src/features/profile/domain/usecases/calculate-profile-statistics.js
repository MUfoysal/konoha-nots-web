export function calculateProfileStatistics(notes, now = Date.now()) {
  const noteCount = notes.length;
  const thresholds = [0, 3, 10, 25, 50, 100];
  const rankOrder = ['Academy', 'Genin', 'Chunin', 'Jonin', 'Anbu', 'Kage'];
  const rankNames = ['Academy Student', ...rankOrder.slice(1)];
  let rankIndex = 0;
  for (let index = thresholds.length - 1; index >= 0; index -= 1) if (noteCount >= thresholds[index]) { rankIndex = index; break; }
  const pinnedCount = notes.filter(note => note.pinned).length;
  const totalWords = notes.reduce((total, note) => {
    const text = String(note.content || '').replace(/<[^>]*>/g, ' ').trim();
    return total + (text ? text.split(/\s+/).length : 0);
  }, 0);
  const tags = new Set(notes.flatMap(note => note.tags || []));
  const lastNote = notes.reduce((latest, note) => !latest || note.updatedAt > latest.updatedAt ? note : latest, null);
  const nextThreshold = thresholds[rankIndex + 1] || null;
  const rankProgress = nextThreshold ? Math.round(((noteCount - thresholds[rankIndex]) / (nextThreshold - thresholds[rankIndex])) * 100) : 100;
  return {
    noteCount, pinnedCount, totalWords, tags, lastNote, rankIndex, rank: rankNames[rankIndex],
    rankIcon: ['🎓', '🥷', '⚡', '🔥', '🎭', '👑'][rankIndex], rankProgress, rankOrder,
    nextRank: rankOrder[rankIndex + 1] || null,
    notesThisWeek: notes.filter(note => note.createdAt > now - 7 * 24 * 60 * 60 * 1000).length,
  };
}

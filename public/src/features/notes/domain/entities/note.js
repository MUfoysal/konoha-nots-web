const MAX_TITLE = 255;
// Match the existing Firestore rule limit so rejected writes are caught locally.
export const MAX_NOTE_CONTENT_LENGTH = 180_000;
const MAX_TAGS = 20;

export function normalizeNoteId(id) {
  if (typeof id !== 'string' && typeof id !== 'number') return '';
  const normalized = String(id).trim();
  return !normalized || normalized === 'undefined' || normalized === 'null' ? '' : normalized;
}

export function validateNote(input) {
  if (typeof input.title !== 'string' || input.title.trim().length > MAX_TITLE) throw new Error('Invalid note title.');
  if (typeof input.content !== 'string' || input.content.length > MAX_NOTE_CONTENT_LENGTH) throw new Error('Invalid note content. Keep the scroll under 180,000 characters so it can be sealed safely.');
  if (!Array.isArray(input.tags) || input.tags.length > MAX_TAGS || input.tags.some(tag => typeof tag !== 'string' || tag.length > 40)) throw new Error('Invalid note tags.');
  if (typeof input.pinned !== 'boolean') throw new Error('Invalid pin state.');
  return { title: input.title.trim() || 'Untitled', content: input.content, tags: [...new Set(input.tags.map(tag => tag.trim()).filter(Boolean))], pinned: input.pinned, color: 'default' };
}

export function noteFromDocument(id, data) {
  return { id, title: data.title, content: data.content, tags: data.tags || [], pinned: !!data.isPinned, color: data.color || 'default', createdAt: data.createdAt?.toMillis?.() ?? null, updatedAt: data.updatedAt?.toMillis?.() ?? null };
}

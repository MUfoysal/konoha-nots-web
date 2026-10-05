const MAX_TITLE = 255;
const MAX_CONTENT = 180_000;
const MAX_TAGS = 20;

export function validateNote(input) {
  if (typeof input.title !== 'string' || input.title.trim().length > MAX_TITLE) throw new Error('Invalid note title.');
  if (typeof input.content !== 'string' || input.content.length > MAX_CONTENT) throw new Error('Invalid note content.');
  if (!Array.isArray(input.tags) || input.tags.length > MAX_TAGS || input.tags.some(tag => typeof tag !== 'string' || tag.length > 40)) throw new Error('Invalid note tags.');
  if (typeof input.pinned !== 'boolean') throw new Error('Invalid pin state.');
  return { title: input.title.trim() || 'Untitled', content: input.content, tags: [...new Set(input.tags.map(tag => tag.trim()).filter(Boolean))], pinned: input.pinned, color: 'default' };
}

export function noteFromDocument(id, data) {
  return { id, title: data.title, content: data.content, tags: data.tags || [], pinned: !!data.isPinned, color: data.color || 'default', createdAt: data.createdAt?.toMillis?.() ?? Date.now(), updatedAt: data.updatedAt?.toMillis?.() ?? Date.now() };
}

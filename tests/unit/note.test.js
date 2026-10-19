import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_NOTE_CONTENT_LENGTH, normalizeNoteId, noteFromDocument, validateNote } from '../../public/src/features/notes/domain/entities/note.js';
import { createNote } from '../../public/src/features/notes/domain/usecases/note-use-cases.js';
import { calculateProfileStatistics } from '../../public/src/features/profile/domain/usecases/calculate-profile-statistics.js';
import { filterAndSortNotes } from '../../public/src/features/notes/domain/usecases/filter-and-sort-notes.js';

test('valid note input is normalized without losing tags or pin state', () => {
  assert.deepEqual(validateNote({ title: '  Plan  ', content: '<p>Idea</p>', tags: ['work', 'work', ' '], pinned: true }), {
    title: 'Plan', content: '<p>Idea</p>', tags: ['work'], pinned: true, color: 'default',
  });
});

test('invalid note payloads are rejected before reaching Firestore', () => {
  assert.throws(() => validateNote({ title: 'x'.repeat(256), content: '', tags: [], pinned: false }), /title/);
  assert.throws(() => validateNote({ title: 'x', content: '', tags: Array(21).fill('tag'), pinned: false }), /tags/);
  assert.throws(() => validateNote({ title: 'x', content: '', tags: [], pinned: 'yes' }), /pin state/);
});

test('note content validation matches the deployed Firestore rule limit', () => {
  assert.equal(validateNote({ title: 'x', content: 'a'.repeat(MAX_NOTE_CONTENT_LENGTH), tags: [], pinned: false }).content.length, MAX_NOTE_CONTENT_LENGTH);
  assert.throws(() => validateNote({ title: 'x', content: 'a'.repeat(MAX_NOTE_CONTENT_LENGTH + 1), tags: [], pinned: false }), /180,000 characters/);
});

test('note creation forwards a stable retry ID and owner context to the repository', async () => {
  let created;
  const repository = { create: async (input, options) => { created = { input, options }; return { id: input.id }; } };
  const result = await createNote(repository, { id: 'stable-id', title: 'New Scroll', content: '', tags: [], pinned: false }, { retry: true, ownerUid: 'owner-a' });
  assert.deepEqual(created, {
    input: { id: 'stable-id', title: 'New Scroll', content: '', tags: [], pinned: false, color: 'default' },
    options: { retry: true, ownerUid: 'owner-a' },
  });
  assert.deepEqual(result, { id: 'stable-id' });
});

test('Firestore timestamps map to the legacy UI millisecond model', () => {
  const note = noteFromDocument('id-1', { title: 'N', content: '', tags: [], isPinned: true, createdAt: { toMillis: () => 10 }, updatedAt: { toMillis: () => 20 } });
  assert.equal(note.id, 'id-1');
  assert.equal(note.pinned, true);
  assert.equal(note.createdAt, 10);
  assert.equal(note.updatedAt, 20);
});

test('missing Firestore timestamps remain unavailable instead of being invented', () => {
  const note = noteFromDocument('id-2', { title: 'N', content: '', tags: [], isPinned: false });
  assert.equal(note.createdAt, null);
  assert.equal(note.updatedAt, null);
});

test('note IDs reject absent and stringified sentinel values', () => {
  for (const invalid of [undefined, null, '', '  ', 'undefined', 'null']) assert.equal(normalizeNoteId(invalid), '');
  assert.equal(normalizeNoteId('  note-id  '), 'note-id');
  assert.equal(normalizeNoteId(42), '42');
});

test('profile ranks and statistics are derived from the signed-in user notes', () => {
  const stats = calculateProfileStatistics([
    { title: 'one', content: '<p>two words</p>', pinned: true, tags: ['writing'], createdAt: 95, updatedAt: 100 },
    { title: 'two', content: 'three more words', pinned: false, tags: ['writing', 'ideas'], createdAt: 98, updatedAt: 120 },
    { title: 'three', content: '', pinned: false, tags: [], createdAt: 99, updatedAt: 110 },
  ], 100);
  assert.equal(stats.rank, 'Genin');
  assert.equal(stats.pinnedCount, 1);
  assert.equal(stats.totalWords, 5);
  assert.equal(stats.tags.size, 2);
  assert.equal(stats.lastNote.title, 'two');
  assert.equal(stats.notesThisWeek, 3);
});

test('note search includes title, formatted content, and tags; pinned notes sort first', () => {
  const notes = [
    { id: 'old', title: 'Older', content: '', tags: ['fire'], pinned: false, updatedAt: 100 },
    { id: 'pinned', title: 'Pinned scroll', content: '', tags: [], pinned: true, updatedAt: 50 },
    { id: 'new', title: 'Newer', content: '<p>Rasengan</p>', tags: [], pinned: false, updatedAt: 200 },
  ];
  assert.deepEqual(filterAndSortNotes(notes, { search: 'FIRE' }).map(note => note.id), ['old']);
  assert.deepEqual(filterAndSortNotes(notes, { search: 'rasengan' }).map(note => note.id), ['new']);
  assert.deepEqual(filterAndSortNotes(notes, {}).map(note => note.id), ['pinned', 'new', 'old']);
});

test('recent and pinned filters keep the existing seven-day window', () => {
  const now = 10 * 24 * 60 * 60 * 1000;
  const notes = [
    { id: 'recent', title: 'A', content: '', tags: [], pinned: false, updatedAt: now - 2 * 24 * 60 * 60 * 1000 },
    { id: 'old', title: 'B', content: '', tags: [], pinned: true, updatedAt: now - 9 * 24 * 60 * 60 * 1000 },
  ];
  assert.deepEqual(filterAndSortNotes(notes, { filter: 'recent', now }).map(note => note.id), ['recent']);
  assert.deepEqual(filterAndSortNotes(notes, { filter: 'pinned', now }).map(note => note.id), ['old']);
});

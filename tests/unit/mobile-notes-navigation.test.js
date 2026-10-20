import test from 'node:test';
import assert from 'node:assert/strict';
import { returnToNotesList } from '../../public/src/features/notes/presentation/mobile-notes-navigation.js';

test('mobile navigation reveals the archive immediately when a pending scroll has a recovery draft', async () => {
  let resolveSave;
  let closed = false;
  let saveStarted = false;
  const saveTask = new Promise(resolve => { resolveSave = resolve; });

  const resultTask = returnToNotesList({
    save: () => { saveStarted = true; return saveTask; },
    hasPendingChanges: () => true,
    backupDraft: () => true,
    closeDrawer: () => { closed = true; },
    confirmLeave: () => false,
  });

  assert.equal(saveStarted, true);
  assert.equal(closed, true, 'the list is available without waiting for the remote save');
  resolveSave(false);
  assert.deepEqual(await resultTask, { closed: true, saved: false, hasRecoveryDraft: true });
});

test('mobile navigation waits for a save when no pending local backup is needed', async () => {
  let closed = false;
  const result = await returnToNotesList({
    save: async () => true,
    hasPendingChanges: () => false,
    backupDraft: () => false,
    closeDrawer: () => { closed = true; },
    confirmLeave: () => false,
  });

  assert.deepEqual(result, { closed: true, saved: true, hasRecoveryDraft: false });
  assert.equal(closed, true);
});

test('mobile navigation stays in the editor after a failed save without a backup when the user cancels', async () => {
  let closed = false;
  let confirmed = false;
  const result = await returnToNotesList({
    save: async () => false,
    hasPendingChanges: () => true,
    backupDraft: () => false,
    closeDrawer: () => { closed = true; },
    confirmLeave: () => { confirmed = true; return false; },
  });

  assert.deepEqual(result, { closed: false, saved: false, hasRecoveryDraft: false });
  assert.equal(confirmed, true);
  assert.equal(closed, false);
});

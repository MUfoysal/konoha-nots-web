export function startNoteSaveWithRecovery({ save, hasPendingChanges, backupDraft }) {
  let saveTask;
  try {
    // Start the save first so it can capture the current editor snapshot before the drawer moves.
    saveTask = Promise.resolve(save()).catch(() => false);
  } catch {
    saveTask = Promise.resolve(false);
  }

  const hasRecoveryDraft = Boolean(hasPendingChanges() && backupDraft());
  return { saveTask, hasRecoveryDraft };
}

export async function returnToNotesList({ save, hasPendingChanges, backupDraft, closeDrawer, confirmLeave }) {
  const { saveTask, hasRecoveryDraft: backedUpBeforeSave } = startNoteSaveWithRecovery({ save, hasPendingChanges, backupDraft });
  let hasRecoveryDraft = backedUpBeforeSave;
  if (hasRecoveryDraft) closeDrawer();

  let saved = false;
  try {
    saved = await saveTask;
  } catch {
    saved = false;
  }

  if (saved !== false) {
    closeDrawer();
    return { closed: true, saved: true, hasRecoveryDraft };
  }

  if (!hasRecoveryDraft) hasRecoveryDraft = Boolean(backupDraft());
  if (hasRecoveryDraft) {
    closeDrawer();
    return { closed: true, saved: false, hasRecoveryDraft: true };
  }

  if (confirmLeave()) {
    closeDrawer();
    return { closed: true, saved: false, hasRecoveryDraft: false };
  }

  return { closed: false, saved: false, hasRecoveryDraft: false };
}

import { firebaseServices } from '../../core/services/firebase.js';
import { userMessage, reportError } from '../../core/errors/app-error.js?v=20261019-7';
import { FirebaseAuthDataSource } from '../../features/auth/data/datasources/firebase-auth-data-source.js';
import { FirebaseAuthRepository } from '../../features/auth/data/repositories/firebase-auth-repository.js';
import { AuthController } from '../../features/auth/presentation/controllers/auth-controller.js';
import { FirestoreNotesDataSource } from '../../features/notes/data/datasources/firestore-notes-data-source.js?v=20261020-1';
import { FirestoreNotesRepository } from '../../features/notes/data/repositories/firestore-notes-repository.js';
import { NotesController } from '../../features/notes/presentation/controllers/notes-controller.js?v=20261020-1';
import { sanitizeNoteHtml } from '../../core/utils/sanitize-note-html.js?v=20261013-1';
import { calculateProfileStatistics } from '../../features/profile/domain/usecases/calculate-profile-statistics.js';
import { filterAndSortNotes } from '../../features/notes/domain/usecases/filter-and-sort-notes.js';
import { MAX_NOTE_CONTENT_LENGTH, normalizeNoteId } from '../../features/notes/domain/entities/note.js?v=20261020-8';
import { FirebaseSettingsDataSource } from '../../features/settings/data/datasources/firebase-settings-data-source.js?v=20261013-2';
import { FirebaseSettingsRepository } from '../../features/settings/data/repositories/firebase-settings-repository.js';
import { SettingsController } from '../../features/settings/presentation/controllers/settings-controller.js';
import { SHINOBI_AVATARS, parseShinobiAvatar } from '../../features/settings/presentation/avatar-catalog.js?v=20261013-1';
import { returnToNotesList, startNoteSaveWithRecovery } from '../../features/notes/presentation/mobile-notes-navigation.js?v=20261020-1';

let deleteModalTrigger = null;
let authController;
let notesController;
let settingsController;
let authState = 'loading';
let lastUser = null;
const noteRevisions = new Map();
const savedNoteRevisions = new Map();
const noteSaveTasks = new Map();
const pendingNoteSaves = new Set();
const localNoteDraftTimers = new Map();
const MAX_RECOVERY_DRAFT_LENGTH = 700_000;
let noteSaveFailureMessage = '';
let activeNoteModel = null;
let activeNoteOwnerUid = null;
let noteCreateTask = null;
const pendingNoteCreateIds = new Map();
const noteDraftStorageKey = uid => `konoha-notes-drafts:v1:${uid}`;
const pendingNoteCreateStorageKey = uid => `konoha-notes-pending-create:v1:${uid}`;
function acquirePendingNoteCreate(uid) {
  let id = pendingNoteCreateIds.get(uid);
  let retry = Boolean(id);
  if (!id) {
    try { id = sessionStorage.getItem(pendingNoteCreateStorageKey(uid)); retry = Boolean(id); } catch {}
  }
  if (!id) id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  pendingNoteCreateIds.set(uid, id);
  try { sessionStorage.setItem(pendingNoteCreateStorageKey(uid), id); } catch {}
  return { id, retry };
}
function clearPendingNoteCreate(uid) {
  pendingNoteCreateIds.delete(uid);
  try { sessionStorage.removeItem(pendingNoteCreateStorageKey(uid)); } catch {}
}
function readLocalNoteDrafts(uid) {
  if (!uid) return {};
  try {
    const value = JSON.parse(localStorage.getItem(noteDraftStorageKey(uid)) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
function writeLocalNoteDraft(uid, note) {
  if (!uid || !note?.id) return false;
  try {
    const drafts = readLocalNoteDrafts(uid);
    drafts[String(note.id)] = { title: note.title || 'Untitled', content: note.content || '', tags: Array.isArray(note.tags) ? note.tags : [], pinned: !!note.pinned, baseUpdatedAt: Number.isFinite(Number(note.updatedAt)) ? Number(note.updatedAt) : null, updatedAt: Date.now() };
    localStorage.setItem(noteDraftStorageKey(uid), JSON.stringify(drafts));
    return true;
  } catch (error) {
    reportError('backup pending scroll locally', error);
    return false;
  }
}
function scheduleLocalNoteDraft(uid, note) {
  if (!uid || !note?.id) return;
  const id = String(note.id);
  if (localNoteDraftTimers.has(id)) return;
  localNoteDraftTimers.set(id, setTimeout(() => {
    localNoteDraftTimers.delete(id);
    writeLocalNoteDraft(uid, note);
  }, 1000));
}
function cancelScheduledLocalNoteDraft(id) {
  id = String(id);
  clearTimeout(localNoteDraftTimers.get(id));
  localNoteDraftTimers.delete(id);
}
function clearLocalNoteDraft(uid, id) {
  if (!uid) return;
  try {
    const drafts = readLocalNoteDrafts(uid);
    delete drafts[String(id)];
    if (Object.keys(drafts).length) localStorage.setItem(noteDraftStorageKey(uid), JSON.stringify(drafts));
    else localStorage.removeItem(noteDraftStorageKey(uid));
  } catch (error) { reportError('clear saved local scroll draft', error); }
}
let resendCooldownUntil = 0;
let resendCooldownTimer = null;
const RESEND_COOLDOWN_MS = 30_000;
window.getProfileStatistics = calculateProfileStatistics;
window.filterAndSortNotes = filterAndSortNotes;
window.getKonohaAuthState = () => authState;
window.canOpenSettings = () => ['authenticated', 'unverified'].includes(authState) && Boolean(lastUser);

const byId = id => document.getElementById(id);
const inputError = message => Object.assign(new Error(message), { name: 'KonohaInputError' });
const validEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const setBusy = (element, busy) => { if (element) { element.disabled = busy; element.classList.toggle('loading', busy); } };
const notifyError = (context, error, targetId) => {
  if (error?.name !== 'KonohaInputError') reportError(context, error);
  const message = userMessage(error);
  if (targetId && byId(targetId)) { byId(targetId).textContent = message; byId(targetId).style.display = 'block'; }
  else window.showToast?.(message, 'error');
};
const hideError = id => { const element = byId(id); if (element) { element.textContent = ''; element.style.display = 'none'; } };
const refreshProfile = () => { if (lastUser) window.updateProfileData?.(); };
const refreshNav = () => window.updateNav?.();
function clearSettingsState() {
  ['settingsDisplayName','settingsClan','settingsUsername','settingsNewEmail','settingsEmailCurrentPassword','settingsCurrentPassword','settingsNewPassword','settingsConfirmPassword']
    .forEach(id => { const input = byId(id); if (input) input.value = ''; });
  ['settingsProfileFeedback','settingsEmailFeedback','settingsPasswordFeedback','settingsResetFeedback','settingsVerifyFeedback']
    .forEach(id => { const feedback = byId(id); if (feedback) { feedback.textContent = ''; feedback.className = 'settings-feedback'; } });
}
window.clearSettingsState = clearSettingsState;
function maskEmail(email) {
  const separator = String(email || '').lastIndexOf('@');
  if (separator < 1) return '••••';
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  return `${local[0]}${'•'.repeat(Math.max(3, Math.min(5, local.length - 1)))}@${domain}`;
}
function updateResendCooldown() {
  const remaining = Math.max(0, Math.ceil((resendCooldownUntil - Date.now()) / 1000));
  const message = remaining ? `Resend available in ${remaining}s` : '';
  ['verificationResendButton', 'resendVerificationButton', 'settingsResendVerificationButton'].forEach(id => {
    const button = byId(id);
    if (!button) return;
    button.disabled = remaining > 0;
    button.textContent = message || 'Resend verification email';
  });
  ['verificationCooldownStatus', 'authResendCooldownStatus'].forEach(id => {
    const status = byId(id);
    if (status) status.textContent = message;
  });
  if (!remaining && resendCooldownTimer) {
    clearInterval(resendCooldownTimer);
    resendCooldownTimer = null;
  }
}
function startResendCooldown() {
  resendCooldownUntil = Date.now() + RESEND_COOLDOWN_MS;
  updateResendCooldown();
  if (resendCooldownTimer) clearInterval(resendCooldownTimer);
  resendCooldownTimer = setInterval(updateResendCooldown, 1000);
}
function showVerificationPanel(email, feedback = '') {
  byId('verificationEmail').textContent = maskEmail(email);
  const feedbackElement = byId('verificationFeedback');
  feedbackElement.textContent = feedback;
  feedbackElement.style.color = feedback ? 'var(--red3)' : '';
  byId('authMtog').style.display = 'none';
  byId('authLoginForm').style.display = 'none';
  byId('authRegForm').style.display = 'none';
  byId('verificationPanel').style.display = 'flex';
  updateResendCooldown();
}
function showVerificationFeedback(message, type = 'error') {
  const feedback = byId('verificationFeedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.style.color = type === 'success' ? '#8bcf9d' : 'var(--red3)';
}
function verificationErrorMessage(error) {
  if (error?.code === 'auth/user-not-found') return 'Your sign-in session expired. Sign in again to request a verification email.';
  return userMessage(error);
}
async function resendVerification(button, feedbackTarget) {
  if (resendCooldownUntil > Date.now()) return;
  let request;
  try {
    request = authController.resendVerification();
    startResendCooldown();
    await request;
    if (feedbackTarget) showVerificationFeedback('Verification email sent again. Please check your Inbox or Spam folder.', 'success');
    else window.showToast?.('Verification email sent again. Please check your Inbox or Spam folder.', 'success');
  } catch (error) {
    reportError('resend verification email', error);
    if (feedbackTarget) showVerificationFeedback(verificationErrorMessage(error));
    else {
      const message = verificationErrorMessage(error);
      if (byId('loginError')) { byId('loginError').textContent = message; byId('loginError').style.display = 'block'; }
      else window.showToast?.(message, 'error');
    }
  } finally {
    if (button) button.disabled = resendCooldownUntil > Date.now();
  }
}
const requirePrivateAccess = () => {
  if (authState === 'authenticated') return true;
  const message = authState === 'loading'
    ? 'Checking your sign-in status. Try again in a moment.'
    : 'Sign in or register to use My Scrolls.';
  window.showToast?.(message, authState === 'loading' ? '' : 'error');
  return false;
};
window.transitionTo = (name, sub) => window.showView?.(name, sub);

function setAuthState(status, user = null) {
  if (status === 'unauthenticated') status = 'guest';
  const previousStatus = authState;
  const previousUid = lastUser?.uid || null;
  const userChanged = previousUid !== (user?.uid || null);
  if ((userChanged || status !== 'authenticated') && previousUid) {
    const active = window.activeNoteId ? updateActiveNoteFromEditor() : null;
    if (active?.changed) markNoteDirty(active.note);
    for (const id of pendingNoteSaves) {
      let note = findNoteById(id);
      if (note) writeLocalNoteDraft(previousUid, note);
      cancelScheduledLocalNoteDraft(id);
    }
  }
  authState = status;
  lastUser = user;
  window.settingsUser = ['authenticated','unverified'].includes(status) ? user : null;
  const resendButton = byId('resendVerificationButton');
  if (resendButton) resendButton.style.display = status === 'unverified' ? '' : 'none';
  const resendHelp = byId('unverifiedLoginHelp');
  if (resendHelp) resendHelp.style.display = status === 'unverified' ? '' : 'none';
  window.currentUser = status === 'authenticated' ? user : null;
  if (status !== 'authenticated' || userChanged) { window.notes = []; activeNoteModel = null; activeNoteOwnerUid = null; }
  if (status !== 'authenticated' || userChanged) {
    noteRevisions.clear(); savedNoteRevisions.clear(); pendingNoteSaves.clear();
  }
  if (status !== 'authenticated') {
    window.activeNoteId = null;
    clearTimeout(window.autoSaveTimer);
  }
  if (userChanged) {
    window.activeNoteId = null;
    clearTimeout(window.autoSaveTimer);
    window.deleteTargetId = null;
    byId('deleteModal')?.classList.remove('open');
    if (byId('editorActive')) byId('editorActive').style.display = 'none';
    if (byId('editorEmpty')) byId('editorEmpty').style.display = 'flex';
  }
  refreshNav();
  window.renderSettingsView?.(user, status);
  if (status === 'authenticated') {
    if (previousStatus !== 'authenticated' || userChanged) void loadNotes(user?.uid);
    if ((userChanged && window.location.search.includes('oauth=success')) || byId('view-auth')?.classList.contains('active')) window.transitionTo?.('notes');
  } else if (status === 'unverified') {
    // An unverified session cannot use private features, but public pages stay available.
    window.activeNoteId = null;
    if (byId('view-notes')?.classList.contains('active')) {
      byId('editorActive').style.display = 'none';
      byId('editorEmpty').style.display = 'flex';
      window.renderNotesList?.();
      window.transitionTo?.('auth', 'login');
    }
    if (byId('view-profile')?.classList.contains('active')) window.transitionTo?.('auth', 'login');
  } else if (status === 'guest' && ['authenticated','unverified'].includes(previousStatus)) {
    window.activeNoteId = null;
    clearTimeout(window.autoSaveTimer);
    clearSettingsState();
    if (byId('view-notes')?.classList.contains('active') || byId('view-profile')?.classList.contains('active') || byId('view-settings')?.classList.contains('active')) {
      window.transitionTo?.('home');
    }
  } else if (status === 'error') {
    window.activeNoteId = null;
    clearSettingsState();
    if (byId('view-notes')?.classList.contains('active') || byId('view-profile')?.classList.contains('active') || byId('view-settings')?.classList.contains('active')) window.transitionTo?.('home');
    window.showToast?.('Could not check your sign-in status. Refresh the page or try again.', 'error');
  }
}

async function loadNotes(uid = lastUser?.uid) {
  if (authState !== 'authenticated' || !uid) return;
  if (window.activeNoteId && pendingNoteSaves.has(String(window.activeNoteId))) updateActiveNoteFromEditor();
  const list = byId('notesList');
  if (list) { list.innerHTML = `<div class="notes-empty-state"><div class="empty-icon">${window.shinobiIcon('scroll','ui-icon shinobi-icon empty-scroll-icon')}</div><p>Opening your scroll archive…</p></div>`; window.renderLucideIcons?.(list); }
  try {
    const notes = await notesController.load();
    if (authState !== 'authenticated' || lastUser?.uid !== uid) return;
    // The archive request can finish after a scroll was created or edited.
    // Capture the active editor now (after the await) so a stale response cannot
    // replace it with an archive snapshot that predates that scroll.
    const activeId = String(window.activeNoteId || '');
    const activeSnapshot = activeId
      ? updateActiveNoteFromEditor()?.note || restoreActiveNoteModel(activeId)
      : null;
    const drafts = readLocalNoteDrafts(uid);
    const preservedPending = new Set(pendingNoteSaves);
    window.notes = notes.map(note => {
      const draft = drafts[String(note.id)];
      if (!draft || typeof draft.content !== 'string' || draft.content.length > MAX_RECOVERY_DRAFT_LENGTH || typeof draft.title !== 'string') return note;
      const baseUpdatedAt = Number(draft.baseUpdatedAt);
      const cloudUpdatedAt = Number(note.updatedAt);
      const draftDiffers = draft.title !== note.title || draft.content !== note.content || JSON.stringify(draft.tags || []) !== JSON.stringify(note.tags || []) || Boolean(draft.pinned) !== Boolean(note.pinned);
      if (Number.isFinite(baseUpdatedAt) && baseUpdatedAt > 0 && Number.isFinite(cloudUpdatedAt) && cloudUpdatedAt > baseUpdatedAt && draftDiffers) {
        return { ...note, hasRecoveryConflict: true, recoveryDraft: draft };
      }
      return { ...note, title: draft.title.slice(0,255) || 'Untitled', content: sanitizeNoteHtml(draft.content), tags: Array.isArray(draft.tags) ? draft.tags.filter(tag => typeof tag === 'string').slice(0,20) : note.tags, pinned: !!draft.pinned, hasLocalDraft: true };
    });
    if (activeId && activeSnapshot && (preservedPending.has(activeId) || !window.notes.some(note => String(note.id) === activeId))) {
      const existingIndex = window.notes.findIndex(note => String(note.id) === activeId);
      const preserved = { ...(existingIndex >= 0 ? window.notes[existingIndex] : {}), ...activeSnapshot, hasLocalDraft: true };
      if (existingIndex >= 0) window.notes[existingIndex] = preserved;
      else window.notes.unshift(preserved);
      activeNoteModel = preserved;
      activeNoteOwnerUid = uid;
      writeLocalNoteDraft(uid, preserved);
    } else if (activeId) {
      const loadedActive = window.notes.find(note => String(note.id) === activeId);
      if (loadedActive && activeNoteOwnerUid === uid) activeNoteModel = loadedActive;
    }
    noteRevisions.clear(); savedNoteRevisions.clear(); pendingNoteSaves.clear();
    notes.forEach(note => { noteRevisions.set(String(note.id), 0); savedNoteRevisions.set(String(note.id), 0); });
    window.notes.forEach(note => {
      if (!note.hasLocalDraft) return;
      noteRevisions.set(String(note.id), 1); savedNoteRevisions.set(String(note.id), 0); pendingNoteSaves.add(String(note.id));
    });
    window.renderNotesList?.(); refreshProfile();
  }
  catch (error) {
    if (authState !== 'authenticated' || lastUser?.uid !== uid) return;
    notifyError('loading notes', error);
    if (list) { list.innerHTML = `<div class="notes-empty-state"><div class="empty-icon">${window.shinobiIcon('seal-warning','ui-icon shinobi-icon empty-scroll-icon')}</div><p>${userMessage(error)}</p></div>`; window.renderLucideIcons?.(list); }
  }
}

function normalizeNote(note) {
  return { title: note.title || 'Untitled', content: sanitizeNoteHtml(note.content || ''), tags: Array.isArray(note.tags) ? note.tags : [], pinned: !!note.pinned, color: note.color || 'default' };
}
function storeNote(note) {
  const existing = window.notes.findIndex(item => String(item.id) === String(note.id));
  if (existing < 0) window.notes.unshift(note); else window.notes[existing] = note;
  window.renderNotesList?.(); refreshProfile();
}

window.doLogin = async () => {
  hideError('loginError');
  const login = byId('loginUser')?.value.trim() || '';
  const password = byId('loginPass')?.value || '';
  if (!login) return notifyError('login validation', inputError('Please enter your email address.'), 'loginError');
  if (!validEmail(login)) return notifyError('login validation', inputError('Please enter a valid email address.'), 'loginError');
  if (!password) return notifyError('login validation', inputError('Please enter your password.'), 'loginError');
  const button = byId('lbtn'); setBusy(button, true);
  try { await authController.login({ email: login, password }); byId('loginPass').value = ''; }
  catch (error) { notifyError('sign in', error, 'loginError'); }
  finally { setBusy(button, false); }
};

window.doRegister = async () => {
  hideError('regError');
  const name = byId('regName')?.value.trim() || '';
  const username = byId('regUser')?.value.trim() || '';
  const email = byId('regEmail')?.value.trim() || '';
  const clan = (byId('regClan')?.value.trim() || 'Ronin').slice(0, 80);
  const password = byId('regPass')?.value || '';
  const confirmation = byId('regPass2')?.value || '';
  if (!email) return notifyError('registration validation', inputError('Please enter your email address.'), 'regError');
  if (!validEmail(email)) return notifyError('registration validation', inputError('Please enter a valid email address.'), 'regError');
  if (!password) return notifyError('registration validation', inputError('Please enter a password.'), 'regError');
  if (password !== confirmation) return notifyError('registration validation', inputError('Passwords do not match.'), 'regError');
  if (!name || username.length < 3 || password.length < 10) return notifyError('registration validation', inputError('Enter your name, a username with at least 3 characters, and a password with at least 10 characters.'), 'regError');
  const button = byId('rbtn'); setBusy(button, true);
  try {
    if (name.length < 2 || name.length > 120) throw inputError('Enter a name between 2 and 120 characters.');
    if (!/^[A-Za-z0-9_]{3,40}$/.test(username)) throw inputError('Use a username with 3–40 letters, numbers, or underscores.');
    await authController.register({ name, username, email, clan, password });
    byId('regPass').value = ''; byId('regPass2').value = '';
    showVerificationPanel(email);
  } catch (error) {
    if (error?.code === 'konoha/verification-send-failed') {
      byId('regPass').value = ''; byId('regPass2').value = '';
      showVerificationPanel(email, userMessage(error));
    } else notifyError('registration', error, 'regError');
  }
  finally { setBusy(button, false); }
};

window.logout = async () => {
  try {
    clearTimeout(window.autoSaveTimer);
    if (!await window.flushAllNoteSaves?.()) return false;
    await authController.logout(); window.showToast?.('Chakra sealed. Goodbye.', '');
    return true;
  }
  catch (error) { notifyError('sign out', error); return false; }
};

window.createNote = async () => {
  if (noteCreateTask) return noteCreateTask;
  if (!requirePrivateAccess()) return;
  const task = (async () => {
    try {
      if (window.activeNoteId) {
        clearTimeout(window.autoSaveTimer);
        if (!await window.saveNote()) return;
      }
      const ownerUid = lastUser?.uid;
      if (!ownerUid || firebaseServices().auth.currentUser?.uid !== ownerUid) return;
      const pendingCreate = acquirePendingNoteCreate(ownerUid);
      const note = await notesController.create({ id: pendingCreate.id, title: 'New Scroll', content: '', tags: [], pinned: false }, { retry: pendingCreate.retry, ownerUid });
      clearPendingNoteCreate(ownerUid);
      if (lastUser?.uid !== ownerUid || firebaseServices().auth.currentUser?.uid !== ownerUid) return note;
      storeNote(note); window.openNote?.(note.id); window.showToast?.('New scroll created', 'success');
      return note;
    } catch (error) { notifyError('create note', error); }
  })();
  noteCreateTask = task;
  try { return await task; }
  finally { if (noteCreateTask === task) noteCreateTask = null; }
};

window.openNote = async id => {
  if (!requirePrivateAccess()) return false;
  let note = window.notes.find(item => String(item.id) === String(id)); if (!note) return false;
  if (window.activeNoteId && String(window.activeNoteId) !== String(id)) {
    clearTimeout(window.autoSaveTimer);
    const pendingSave = startNoteSaveWithRecovery({
      save: () => window.saveNote({ manual: false }),
      hasPendingChanges: () => Boolean(window.hasPendingNoteSaves?.()),
      backupDraft: () => Boolean(window.backupActiveNoteDraft?.()),
    });
    if (!pendingSave.hasRecoveryDraft) {
      const saved = await pendingSave.saveTask;
      if (saved === false) {
        const backedUp = Boolean(window.backupActiveNoteDraft?.());
        const reason = noteSaveFailureMessage ? ` Save error: ${noteSaveFailureMessage.replace(/[.!?]+$/, '')}.` : '';
        const recovery = backedUp ? 'A local recovery copy is saved on this browser.' : 'A local recovery copy could not be confirmed.';
        if (!window.confirm(`This scroll could not be saved to your account.${reason} ${recovery} Continue opening the other scroll?`)) return false;
      }
    }
  }
  if (note.hasRecoveryConflict && note.recoveryDraft) {
    const restoreLocal = window.confirm('A local recovery copy and a newer cloud copy are different. OK restores the local copy for this scroll. Cancel keeps the cloud copy and discards the local recovery copy.');
    const index = window.notes.findIndex(item => String(item.id) === String(id));
    if (restoreLocal) {
      const draft = note.recoveryDraft;
      note = { ...note, title: draft.title || 'Untitled', content: sanitizeNoteHtml(draft.content), tags: Array.isArray(draft.tags) ? draft.tags.filter(tag => typeof tag === 'string').slice(0,20) : note.tags, pinned: !!draft.pinned, hasLocalDraft: true };
      delete note.hasRecoveryConflict; delete note.recoveryDraft;
      noteRevisions.set(String(id), 0); savedNoteRevisions.set(String(id), 0); pendingNoteSaves.delete(String(id));
      markNoteDirty(note);
    } else {
      clearLocalNoteDraft(lastUser?.uid, id);
      note = { ...note }; delete note.hasRecoveryConflict; delete note.recoveryDraft;
    }
    if (index >= 0) window.notes[index] = note;
    window.renderNotesList?.();
  }
  window.activeNoteId = id; window.isReadMode = false;
  activeNoteModel = note;
  activeNoteOwnerUid = lastUser?.uid || null;
  if (!noteRevisions.has(String(id))) { noteRevisions.set(String(id), 0); savedNoteRevisions.set(String(id), 0); }
  if (byId('editorEmpty')) byId('editorEmpty').style.display = 'none';
  const active = byId('editorActive'); if (active) { active.style.display = 'flex'; active.style.flexDirection = 'column'; active.style.height = '100%'; }
  if (byId('noteTitleInput')) byId('noteTitleInput').value = note.title;
  if (byId('note-content-editor')) {
    byId('note-content-editor').innerHTML = sanitizeNoteHtml(note.content || '');
    window.enableEditorBlockReorder?.();
  }
  window.renderTags?.(note.tags || []); window.updatePinBtn?.(note.pinned); window.updateReadBtn?.(); window.updateWordCount?.();
  const savedLabel = Number.isFinite(note.updatedAt) && note.updatedAt > 0 ? `Sealed: ${new Date(note.updatedAt).toLocaleTimeString()}` : 'Saved';
  if (pendingNoteSaves.has(String(id))) window.setNoteSaveStatus?.('failed', 'Local draft restored — retry save');
  else window.setNoteSaveStatus?.('saved', savedLabel);
  document.querySelectorAll('.note-item').forEach(element => element.classList.toggle('active', element.dataset.id === String(id)));
  byId('editorBodyDiv')?.classList.remove('read-mode'); if (byId('note-content-editor')) byId('note-content-editor').contentEditable = 'true';
  window.syncNotesAppBarBehavior?.();
  const formatBar = document.querySelector('.format-bar'); const tags = document.querySelector('.editor-tags');
  if (formatBar) formatBar.style.display = ''; if (tags) tags.style.display = '';
  if (window.innerWidth <= 1023) {
    byId('notesEditor')?.classList.add('drawer-open');
    const sidebar = document.querySelector('.notes-sidebar');
    sidebar?.classList.remove('list-open');
    sidebar?.classList.add('drawer-hidden');
    window.enterNotesEditorHistory?.(id);
  }
  return true;
};
window.promptDelete = () => { if (!requirePrivateAccess()) return; deleteModalTrigger = document.activeElement; window.deleteTargetId = window.activeNoteId; byId('deleteModal')?.classList.add('open'); byId('deleteModal')?.querySelector('button')?.focus(); };
window.deleteNoteById = (id, event) => { event?.stopPropagation(); if (!requirePrivateAccess()) return; deleteModalTrigger = event?.currentTarget || document.activeElement; window.deleteTargetId = id; byId('deleteModal')?.classList.add('open'); byId('deleteModal')?.querySelector('button')?.focus(); };
window.closeDeleteModal = () => { byId('deleteModal')?.classList.remove('open'); window.deleteTargetId = null; deleteModalTrigger?.focus?.(); deleteModalTrigger = null; };
window.updatePinBtn = pinned => { const button = byId('pinBtn'); if (button) { button.innerHTML = `${window.shinobiIcon(pinned ? 'seal-pin-open' : 'seal-pin')} <span>${pinned ? 'Unpin' : 'Pin'}</span>`; button.classList.toggle('active', pinned); } };
window.updateReadBtn = () => { const button = byId('readBtn'); if (button) { const readMode = !!window.isReadMode; button.innerHTML = `${readMode ? window.shinobiIcon('kunai-edit') : '<i class="ui-icon" data-lucide="eye" aria-hidden="true" width="14" height="14"></i>'} <span>${readMode ? 'Edit' : 'Read'}</span>`; button.classList.toggle('active', readMode); window.renderLucideIcons?.(button); } };
window.toggleReadMode = () => {
  window.isReadMode = !window.isReadMode;
  byId('editorBodyDiv')?.classList.toggle('read-mode', window.isReadMode);
  if (byId('note-content-editor')) byId('note-content-editor').contentEditable = String(!window.isReadMode);
  const bar = document.querySelector('.format-bar'); const tags = document.querySelector('.editor-tags');
  if (bar) bar.style.display = window.isReadMode ? 'none' : ''; if (tags) tags.style.display = window.isReadMode ? 'none' : '';
  window.syncNotesAppBarBehavior?.();
  if (window.isReadMode) void window.saveNote(); window.updateReadBtn();
};

function setNoteSaveStatus(state, message) {
  const status = byId('lastSaved');
  if (status) { status.textContent = message; status.dataset.state = state; }
  const retry = byId('retrySaveBtn');
  if (retry) retry.hidden = state !== 'failed';
}
window.setNoteSaveStatus = setNoteSaveStatus;
window.isNotePendingSave = id => pendingNoteSaves.has(String(id));
window.hasPendingNoteSaves = () => pendingNoteSaves.size > 0;
window.getNoteSaveFailureMessage = () => noteSaveFailureMessage;
window.retryNoteSave = async (id, event) => {
  event?.stopPropagation();
  const saved = await flushNoteSave(id);
  if (saved) window.showToast?.('Scroll sealed!', 'success');
  return saved;
};
window.addEventListener('beforeunload', event => {
  const active = window.activeNoteId ? updateActiveNoteFromEditor() : null;
  if (active?.changed) markNoteDirty(active.note);
  const missingBackup = [...pendingNoteSaves].some(id => {
    const note = window.notes.find(item => String(item.id) === id);
    cancelScheduledLocalNoteDraft(id);
    return !note || !writeLocalNoteDraft(lastUser?.uid, note);
  });
  if (!missingBackup) return;
  event.preventDefault();
  event.returnValue = '';
});



function markNoteDirty(note) {
  const id = normalizeNoteId(note?.id);
  if (!id) return false;
  noteRevisions.set(id, (noteRevisions.get(id) || 0) + 1);
  pendingNoteSaves.add(id);
  scheduleLocalNoteDraft(lastUser?.uid, note);
  if (String(window.activeNoteId) === id) setNoteSaveStatus('unsaved', 'Unsaved changes');
  window.renderNotesList?.();
  return true;
}

function restoreActiveNoteModel(id) {
  id = normalizeNoteId(id);
  const uid = lastUser?.uid;
  // Reconstructing an editor model is local-only. Firebase's currentUser can
  // briefly be null while Auth restores persistence, so defer that check until
  // flushNoteSave rather than misreporting the scroll as absent from the archive.
  if (!id || !uid || authState !== 'authenticated' || normalizeNoteId(window.activeNoteId) !== id) return null;

  const existing = activeNoteModel && activeNoteOwnerUid === uid && String(activeNoteModel.id) === id ? activeNoteModel : null;
  const draft = readLocalNoteDrafts(uid)[id];
  const editor = byId('note-content-editor');
  const titleInput = byId('noteTitleInput');
  if (!existing && !draft && !editor) return null;

  const tags = Array.isArray(draft?.tags) ? draft.tags : [...(byId('tagsList')?.querySelectorAll('.tag-chip') || [])].map(tag => tag.firstChild?.textContent?.trim()).filter(Boolean);
  const recovered = {
    ...(draft ? { id, title: draft.title || 'Untitled', content: sanitizeNoteHtml(draft.content || ''), tags, pinned: !!draft.pinned, color: 'default', updatedAt: Number(draft.baseUpdatedAt) || null } : {}),
    ...(existing || {}),
    id,
    title: titleInput?.value || existing?.title || draft?.title || 'Untitled',
    content: sanitizeNoteHtml(editor?.innerHTML ?? existing?.content ?? draft?.content ?? ''),
    tags: existing?.tags || tags,
    pinned: existing?.pinned ?? (byId('pinBtn')?.classList.contains('active') || !!draft?.pinned),
    color: existing?.color || 'default',
    hasLocalDraft: true,
  };
  activeNoteModel = recovered;
  activeNoteOwnerUid = uid;
  preserveActiveNoteForSave(recovered, uid);
  return recovered;
}

function preserveActiveNoteForSave(note, uid = lastUser?.uid) {
  const id = normalizeNoteId(note?.id);
  if (!id) return null;
  const revision = noteRevisions.get(id);
  if (!pendingNoteSaves.has(id) && (revision === undefined || (savedNoteRevisions.get(id) || 0) >= revision)) {
    noteRevisions.set(id, (revision || 0) + 1);
    savedNoteRevisions.set(id, revision || 0);
  }
  pendingNoteSaves.add(id);
  activeNoteModel = note;
  activeNoteOwnerUid = uid;
  window.notes.unshift(note);
  writeLocalNoteDraft(uid, note);
}

function findNoteById(id) {
  id = normalizeNoteId(id);
  if (!id) return null;
  const note = window.notes.find(item => String(item.id) === id);
  if (note) return note;
  if (activeNoteModel && activeNoteOwnerUid === lastUser?.uid && String(activeNoteModel.id) === id) {
    preserveActiveNoteForSave(activeNoteModel);
    return activeNoteModel;
  }
  return restoreActiveNoteModel(id);
}

function updateActiveNoteFromEditor() {
  const activeId = normalizeNoteId(window.activeNoteId);
  if (!activeId) return null;
  const note = findNoteById(activeId);
  if (!note) return null;
  const previousTitle = note.title;
  const previousContent = note.content;
  note.title = byId('noteTitleInput')?.value || 'Untitled';
  note.content = sanitizeNoteHtml(byId('note-content-editor')?.innerHTML ?? note.content ?? '');
  return { note, changed: previousTitle !== note.title || previousContent !== note.content };
}

function flushNoteSave(id) {
  id = normalizeNoteId(id);
  if (!id) {
    noteSaveFailureMessage = 'This scroll is missing its archive ID, so it was not sent to Firestore.';
    return Promise.resolve(false);
  }
  const currentTask = noteSaveTasks.get(id);
  if (currentTask) return currentTask.then(() => flushNoteSave(id));
  const task = (async () => {
    while ((savedNoteRevisions.get(id) || 0) < (noteRevisions.get(id) || 0)) {
      if (authState !== 'authenticated' || !lastUser?.uid || firebaseServices().auth.currentUser?.uid !== lastUser.uid) {
        noteSaveFailureMessage = 'Your sign-in session is unavailable. Sign in again before saving this scroll.';
        return false;
      }
      const note = findNoteById(id);
      if (!note) {
        try {
          const remote = await notesController.get(id);
          if (!remote) {
            noteSaveFailureMessage = 'This scroll could not be found in your cloud archive. Your recovery draft is kept on this browser.';
            return false;
          }
          const draft = readLocalNoteDrafts(lastUser.uid)[id];
          const isActive = String(window.activeNoteId) === id;
          const tags = Array.isArray(draft?.tags) ? draft.tags : [...(byId('tagsList')?.querySelectorAll('.tag-chip') || [])].map(tag => tag.firstChild?.textContent?.trim()).filter(Boolean);
          const recovered = {
            ...remote,
            ...(draft ? { title: draft.title || remote.title, content: sanitizeNoteHtml(draft.content || ''), tags, pinned: !!draft.pinned } : {}),
            ...(isActive ? {
              title: byId('noteTitleInput')?.value || draft?.title || remote.title,
              content: sanitizeNoteHtml(byId('note-content-editor')?.innerHTML ?? draft?.content ?? remote.content),
              tags,
              pinned: byId('pinBtn')?.classList.contains('active') ?? remote.pinned,
            } : {}),
            hasLocalDraft: true,
          };
          const existingIndex = window.notes.findIndex(item => String(item.id) === id);
          if (existingIndex >= 0) window.notes[existingIndex] = recovered;
          else window.notes.unshift(recovered);
          if (isActive) { activeNoteModel = recovered; activeNoteOwnerUid = lastUser.uid; }
          writeLocalNoteDraft(lastUser.uid, recovered);
          window.renderNotesList?.();
          note = recovered;
        } catch (error) {
          noteSaveFailureMessage = error?.code ? `${userMessage(error)} (${error.code})` : userMessage(error);
          return false;
        }
      }
      const revision = noteRevisions.get(id) || 0;
      const uid = lastUser.uid;
      if (String(window.activeNoteId) === id) setNoteSaveStatus('saving', 'Sealing…');
      try {
        let saved;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (lastUser?.uid !== uid || authState !== 'authenticated' || firebaseServices().auth.currentUser?.uid !== uid) {
            noteSaveFailureMessage = 'Your sign-in session changed before the save completed. Sign in again and retry.';
            return false;
          }
          try {
            const snapshot = normalizeNote({ ...note, tags: [...(note.tags || [])] });
            saved = await notesController.update(id, snapshot);
            break;
          } catch (error) {
            const transient = ['unavailable', 'deadline-exceeded', 'aborted'].includes(error?.code);
            if (!transient || attempt === 2) throw error;
            await new Promise(resolve => setTimeout(resolve, 350 * (2 ** attempt)));
          }
        }
        if (lastUser?.uid !== uid || authState !== 'authenticated' || firebaseServices().auth.currentUser?.uid !== uid) {
          noteSaveFailureMessage = 'Your sign-in session changed before the save completed. Sign in again and retry.';
          return false;
        }
        noteSaveFailureMessage = '';
        savedNoteRevisions.set(id, revision);
        if ((noteRevisions.get(id) || 0) === revision) {
          pendingNoteSaves.delete(id);
          cancelScheduledLocalNoteDraft(id);
          clearLocalNoteDraft(uid, id);
          if (!pendingNoteSaves.size) window.notesLeaveFailureAcknowledged = false;
        }
        const latest = window.notes.find(item => String(item.id) === id);
        if (latest) { latest.updatedAt = saved.updatedAt; if ((noteRevisions.get(id) || 0) === revision) delete latest.hasLocalDraft; }
        window.renderNotesList?.();
        refreshProfile();
        if (String(window.activeNoteId) === id && (noteRevisions.get(id) || 0) === revision) {
          setNoteSaveStatus('saved', `Sealed: ${new Date(saved.updatedAt).toLocaleTimeString()}`);
        }
      } catch (error) {
        noteSaveFailureMessage = error?.code ? `${userMessage(error)} (${error.code})` : userMessage(error);
        writeLocalNoteDraft(uid, note);
        if (String(window.activeNoteId) === id) {
          setNoteSaveStatus('failed', `Save failed: ${userMessage(error)}`);
          const status = byId('lastSaved');
          if (status) status.title = error?.code ? `Error: ${error.code}` : 'Save failed; a local draft was kept when browser storage is available.';
        }
        reportError('save note', error);
        window.showToast?.('Could not seal this scroll. Your changes are still in the editor; retry when ready.', 'error');
        return false;
      }
    }
    return true;
  })();
  noteSaveTasks.set(id, task);
  return task.finally(() => { if (noteSaveTasks.get(id) === task) noteSaveTasks.delete(id); });
}

window.backupActiveNoteDraft = () => {
  const active = updateActiveNoteFromEditor();
  if (!active) return false;
  if (active.changed) markNoteDirty(active.note);
  cancelScheduledLocalNoteDraft(active.note.id);
  return writeLocalNoteDraft(lastUser?.uid, active.note);
};

window.returnMobileNotesToList = async () => {
  const result = await returnToNotesList({
    save: () => window.activeNoteId ? window.saveNote?.({ manual: false }) : true,
    hasPendingChanges: () => Boolean(window.hasPendingNoteSaves?.()),
    backupDraft: () => Boolean(window.backupActiveNoteDraft?.()),
    closeDrawer: () => {
      document.getElementById('notesEditor')?.classList.remove('drawer-open');
      document.querySelector('.notes-sidebar')?.classList.remove('drawer-hidden', 'list-open');
    },
    confirmLeave: () => window.confirm('This scroll could not be saved, and a local backup could not be created. Leave the editor anyway?'),
  });
  if (result.closed && !result.saved && result.hasRecoveryDraft) {
    window.showToast?.('Cloud save failed. Your local draft is kept on this browser; retry when connected.', 'error');
  }
  return result;
};

window.saveNote = async (options = {}) => {
  if (!requirePrivateAccess()) return false;
  clearTimeout(window.autoSaveTimer);
  const id = normalizeNoteId(window.activeNoteId);
  if (!id) {
    if (byId('editorActive')?.style.display === 'none') return true;
    noteSaveFailureMessage = 'This scroll is missing its archive ID, so it was not sent to Firestore.';
    setNoteSaveStatus('failed', 'Scroll reference missing; save was not confirmed');
    return false;
  }
  const snapshot = updateActiveNoteFromEditor();
  if (!snapshot) return true;
  if (snapshot.changed && (savedNoteRevisions.get(id) || 0) >= (noteRevisions.get(id) || 0)) markNoteDirty(snapshot.note);
  if (!pendingNoteSaves.has(id) && !noteSaveTasks.has(id)) {
    if (options.manual) window.showToast?.('This scroll is already sealed.', 'success');
    return true;
  }
  const saved = await flushNoteSave(id);
  if (saved && options.manual) window.showToast?.('Scroll sealed!', 'success');
  return saved;
};

window.flushAllNoteSaves = async () => {
  if (window.activeNoteId) {
    const active = updateActiveNoteFromEditor();
    if (active?.changed && (savedNoteRevisions.get(String(active.note.id)) || 0) >= (noteRevisions.get(String(active.note.id)) || 0)) markNoteDirty(active.note);
  }
  clearTimeout(window.autoSaveTimer);
  const ids = [...pendingNoteSaves];
  for (const id of ids) if (!await flushNoteSave(id)) return false;
  return true;
};

function scheduleActiveNoteSave() {
  const note = updateActiveNoteFromEditor();
  if (!note) return;
  markNoteDirty(note);
  clearTimeout(window.autoSaveTimer);
  window.autoSaveTimer = setTimeout(() => void window.saveNote({ manual: false }), 1000);
}

window.updateNoteTitle = () => scheduleActiveNoteSave();
window.onContentChange = () => { window.updateWordCount?.(); scheduleActiveNoteSave(); };
byId('note-content-editor')?.addEventListener('paste', event => {
  const clipboard = event.clipboardData;
  if (!clipboard) return;
  event.preventDefault();

  let pastedHtml = clipboard.getData('text/html');
  if (pastedHtml) {
    const parsed = new DOMParser().parseFromString(pastedHtml, 'text/html');
    parsed.querySelectorAll('script,style,meta,link,iframe,object,embed').forEach(node => node.remove());
    parsed.querySelectorAll('[style]').forEach(node => {
      node.style.removeProperty('color');
      node.style.removeProperty('background');
      node.style.removeProperty('background-color');
      if (!node.getAttribute('style')?.trim()) node.removeAttribute('style');
    });
    pastedHtml = sanitizeNoteHtml(parsed.body.innerHTML);
  } else {
    const plainText = clipboard.getData('text/plain');
    const textNode = document.createElement('div');
    textNode.textContent = plainText;
    pastedHtml = textNode.innerHTML.replace(/\r\n?|\n/g, '<br>');
  }

  if (!pastedHtml) return;
  document.execCommand('insertHTML', false, pastedHtml);
  window.onContentChange();
});
window.togglePin = async () => {
  const note = window.notes.find(item => String(item.id) === String(window.activeNoteId)); if (!note) return;
  note.pinned = !note.pinned; markNoteDirty(note); window.updatePinBtn?.(note.pinned);
  await flushNoteSave(note.id);
};
window.pinNoteById = async (id, event) => {
  event?.stopPropagation();
  const note = window.notes.find(item => String(item.id) === String(id)); if (!note) return;
  note.pinned = !note.pinned; markNoteDirty(note);
  await flushNoteSave(id);
};
window.confirmDelete = async () => {
  if (!requirePrivateAccess()) return;
  if (!window.deleteTargetId) return;
  const id = String(window.deleteTargetId);
  const ownerUid = lastUser?.uid;
  const deletedActiveNote = String(window.activeNoteId || '') === id;
  if (!findNoteById(id)) return notifyError('delete note', Object.assign(new Error('This scroll is no longer in your loaded archive. Refresh the archive and try again.'), { code: 'not-found' }));
  try {
    if (pendingNoteSaves.has(id) && !await flushNoteSave(id)) return;
    if (!ownerUid || lastUser?.uid !== ownerUid || firebaseServices().auth.currentUser?.uid !== ownerUid || !findNoteById(id)) return;
    await notesController.remove(id);
    if (lastUser?.uid !== ownerUid || firebaseServices().auth.currentUser?.uid !== ownerUid) return;
    window.notes = window.notes.filter(note => String(note.id) !== id);
    noteRevisions.delete(id); savedNoteRevisions.delete(id); pendingNoteSaves.delete(id);
    if (deletedActiveNote) { window.activeNoteId = null; activeNoteModel = null; activeNoteOwnerUid = null; if (byId('editorEmpty')) byId('editorEmpty').style.display = 'flex'; if (byId('editorActive')) byId('editorActive').style.display = 'none'; }
    window.closeDeleteModal?.(); window.renderNotesList?.(); refreshProfile(); window.showToast?.('Scroll destroyed', 'success');
    if (deletedActiveNote && window.innerWidth <= 1023) {
      byId('notesEditor')?.classList.remove('drawer-open');
      document.querySelector('.notes-sidebar')?.classList.remove('drawer-hidden', 'list-open');
    }
  } catch (error) { notifyError('delete note', error); }
};
window.handleTagInput = event => {
  if (!['Enter', ','].includes(event.key)) return;
  event.preventDefault(); const note = window.notes.find(item => String(item.id) === String(window.activeNoteId));
  const value = event.target.value.trim().replace(',', '');
  if (value && note && !note.tags.includes(value) && note.tags.length < 20 && value.length <= 40) {
    note.tags.push(value); window.renderTags?.(note.tags); markNoteDirty(note); clearTimeout(window.autoSaveTimer); window.autoSaveTimer = setTimeout(() => void window.saveNote({ manual: false }), 1000);
  }
  event.target.value = '';
};
window.removeTag = index => {
  const note = window.notes.find(item => String(item.id) === String(window.activeNoteId)); if (!note) return;
  note.tags.splice(index, 1); window.renderTags?.(note.tags); markNoteDirty(note);
  clearTimeout(window.autoSaveTimer); window.autoSaveTimer = setTimeout(() => void window.saveNote({ manual: false }), 1000);
};

function setSettingsFeedback(id, message, type = '') {
  const element = byId(id);
  if (!element) return;
  element.textContent = message;
  element.className = `settings-feedback${type ? ` ${type}` : ''}`;
}

function setSettingsBusy(button, busy, loadingLabel) {
  if (!button) return;
  if (busy) {
    if (!button.dataset.settingsIdleLabel) button.dataset.settingsIdleLabel = button.textContent;
    if (loadingLabel) button.textContent = loadingLabel;
  } else if (button.dataset.settingsIdleLabel) {
    button.textContent = button.dataset.settingsIdleLabel;
    delete button.dataset.settingsIdleLabel;
  }
  setBusy(button, busy);
}

window.renderSettingsView = (user, status) => {
  const full = byId('settingsFullContent');
  const verificationOnly = byId('settingsVerificationOnly');
  if (!user || !['authenticated','unverified'].includes(status)) {
    if (full) full.style.display = 'none';
    if (verificationOnly) verificationOnly.style.display = 'none';
    return;
  }
  const verified = status === 'authenticated' && Boolean(user.emailVerified);
  if (full) full.style.display = verified ? '' : 'none';
  if (verificationOnly) verificationOnly.style.display = verified ? 'none' : '';
  ['settingsCurrentEmail','settingsVerifyEmail'].forEach(id => { if (byId(id)) byId(id).textContent = maskEmail(user.email); });
  const labels = ['settingsVerificationStatus','settingsVerifyStatus'];
  labels.forEach(id => {
    const element = byId(id);
    if (!element) return;
    element.textContent = user.emailVerified ? 'Verified' : 'Not verified';
    element.classList.toggle('verified', Boolean(user.emailVerified));
    element.classList.toggle('unverified', !user.emailVerified);
  });
  if (byId('settingsDisplayName')) byId('settingsDisplayName').value = user.name || '';
  if (byId('settingsClan')) byId('settingsClan').value = user.clan || '';
  if (byId('settingsUsername')) byId('settingsUsername').value = user.username || '';
  if (settingsController) {
    const { hasPassword, hasGoogle } = settingsController.getCapabilities();
    if (byId('settingsPasswordForm')) byId('settingsPasswordForm').style.display = hasPassword ? '' : 'none';
    if (byId('settingsProviderMessage')) byId('settingsProviderMessage').style.display = hasPassword ? 'none' : '';
    if (byId('settingsResetRow')) byId('settingsResetRow').style.display = hasPassword ? '' : 'none';
    if (byId('settingsEmailCurrentPasswordField')) byId('settingsEmailCurrentPasswordField').style.display = hasPassword ? '' : 'none';
    if (byId('settingsProviderMessage') && hasGoogle && !hasPassword) byId('settingsProviderMessage').textContent = 'Your password and email are managed through Google. Reauthenticate with Google before changing your email.';
  }
  if (byId('settingsVerifiedActions')) byId('settingsVerifiedActions').style.display = verified ? '' : 'none';
};
window.loadSettingsPage = () => window.renderSettingsView?.(lastUser, authState);
window.promptSettingsLogout = () => {
  setSettingsFeedback('settingsLogoutFeedback', '');
  byId('settingsLogoutModal')?.classList.add('open');
  byId('settingsLogoutCancelButton')?.focus();
};
window.closeSettingsLogout = () => byId('settingsLogoutModal')?.classList.remove('open');
window.confirmSettingsLogout = async () => {
  const button = byId('settingsLogoutConfirmButton');
  setBusy(button, true);
  if (byId('settingsLogoutFeedback')) byId('settingsLogoutFeedback').textContent = 'Signing out…';
  const success = await window.logout?.();
  if (success) window.closeSettingsLogout();
  else setSettingsFeedback('settingsLogoutFeedback', 'Unable to sign out. Please try again.', 'error');
  setBusy(button, false);
};

function addGoogleButtons() {
  document.querySelectorAll('#authLoginForm,#authRegForm').forEach(form => {
    if (form.querySelector('.google-auth-button')) return;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'auth-altbtn google-auth-button';
    button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 18 18" width="16" height="16"><path fill="#EA4335" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.909c1.702-1.567 2.683-3.874 2.683-6.615z"/><path fill="#4285F4" d="M9 18c2.43 0 4.468-.806 5.957-2.18l-2.909-2.258c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.035-3.71H.957v2.332A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.965 10.712A5.41 5.41 0 0 1 3.682 9c0-.594.102-1.172.283-1.712V4.956H.957A9 9 0 0 0 0 9c0 1.452.348 2.827.957 4.044l3.008-2.332z"/><path fill="#34A853" d="M9 3.58c1.322 0 2.508.455 3.442 1.346l2.583-2.583C13.464.891 11.426 0 9 0A9 9 0 0 0 .957 4.956l3.008 2.332C4.672 5.164 6.656 3.58 9 3.58z"/></svg><span>Continue with Google</span>';
    button.addEventListener('click', async () => { setBusy(button, true); try { await authController.loginWithGoogle(); } catch (error) { notifyError('Google sign in', error, form.id === 'authLoginForm' ? 'loginError' : 'regError'); } finally { setBusy(button, false); } });
    const divider = form.querySelector('#lodiv .auth-otxt'); if (divider) divider.textContent = 'Or continue with';
    const anchor = form.querySelector('#lfoot,#rfoot'); if (anchor) anchor.before(button); else form.appendChild(button);
  });
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && byId('deleteModal')?.classList.contains('open')) window.closeDeleteModal();
});

document.addEventListener('DOMContentLoaded', () => {
  window.initStoryCards?.();
  try {
    const { auth, db } = firebaseServices();
    const authSource = new FirebaseAuthDataSource(auth, db);
    authController = new AuthController(new FirebaseAuthRepository(authSource));
    const notesSource = new FirestoreNotesDataSource(db, () => auth.currentUser?.uid);
    notesController = new NotesController(new FirestoreNotesRepository(notesSource));
    const settingsSource = new FirebaseSettingsDataSource(auth, db);
    settingsController = new SettingsController(new FirebaseSettingsRepository(settingsSource));
    addGoogleButtons();
    authController.observe(state => { setAuthState(state.status, state.user); if (state.error) notifyError('authentication state', state.error); });
    byId('forgotPasswordButton')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const email = byId('loginUser')?.value.trim() || '';
      hideError('loginError');
      if (!email) return notifyError('password reset validation', inputError('Please enter your email address.'), 'loginError');
      if (!validEmail(email)) return notifyError('password reset validation', inputError('Please enter a valid email address.'), 'loginError');
      setBusy(button, true);
      try { await authController.resetPassword(email); window.showToast?.('Password reset email sent. Check your inbox and Spam/Junk folder if you do not see it.', 'success'); }
      catch (error) { notifyError('password reset', error, 'loginError'); }
      finally { setBusy(button, false); }
    });
    const verifyButton = document.createElement('button'); verifyButton.id = 'resendVerificationButton'; verifyButton.type = 'button'; verifyButton.className = 'auth-altbtn'; verifyButton.textContent = 'Resend verification email'; verifyButton.style.display = 'none';
    verifyButton.addEventListener('click', () => { void resendVerification(verifyButton, false); });
    byId('authLoginForm')?.append(verifyButton);
    const cooldownStatus = document.createElement('p'); cooldownStatus.id = 'authResendCooldownStatus'; cooldownStatus.className = 'auth-fhnt'; cooldownStatus.setAttribute('aria-live', 'polite');
    byId('authLoginForm')?.append(cooldownStatus);
    byId('verificationResendButton')?.addEventListener('click', event => { void resendVerification(event.currentTarget, true); });
    byId('verificationCheckButton')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      setBusy(button, true);
      try {
        const user = await authController.reloadCurrentUser();
        if (!authController.checkEmailVerification(user)) {
          showVerificationFeedback("Your email hasn't been verified yet. Please check your Inbox or Spam folder and click the verification link.");
          return;
        }
        setAuthState('authenticated', user);
        window.showToast?.('Email verified. Welcome to your scroll archive.', 'success');
      } catch (error) {
        reportError('check email verification', error);
        showVerificationFeedback(verificationErrorMessage(error));
      } finally { setBusy(button, false); }
    });
    byId('verificationBackToLogin')?.addEventListener('click', event => {
      window.switchAuthMode?.('login');
    });
    byId('settingsSaveProfileButton')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      setSettingsFeedback('settingsProfileFeedback', '');
      setSettingsBusy(button, true, 'Saving…');
      try {
        const profile = await settingsController.updateProfile({
          displayName: byId('settingsDisplayName')?.value,
          clan: byId('settingsClan')?.value,
        });
        setAuthState('authenticated', { ...lastUser, name: profile.displayName, clan: profile.clan });
        setSettingsFeedback('settingsProfileFeedback', 'Profile updated successfully.', 'success');
      } catch (error) {
        reportError('update profile', error);
        setSettingsFeedback('settingsProfileFeedback', userMessage(error), 'error');
      } finally { setSettingsBusy(button, false); }
    });
    const avatarChooseButton = byId('profileAvatarChooseButton');
    const avatarResetButton = byId('profileAvatarResetButton');
    const avatarPicker = byId('profileAvatarPicker');
    const avatarPickerClose = byId('profileAvatarPickerClose');
    const avatarGalleryView = byId('profileAvatarGalleryView');
    const avatarCropView = byId('profileAvatarCropView');
    const avatarGrid = byId('profileAvatarGrid');
    const avatarCropPreview = byId('profileAvatarCropPreview');
    const avatarCropImage = byId('profileAvatarCropImage');
    const avatarZoom = byId('profileAvatarZoom');
    const avatarPositionX = byId('profileAvatarPositionX');
    const avatarPositionY = byId('profileAvatarPositionY');
    const avatarApplyButton = byId('profileAvatarApply');
    let selectedAvatar = null;

    const setCropValues = (zoom, x, y) => {
      avatarZoom.value = String(zoom);
      avatarPositionX.value = String(x);
      avatarPositionY.value = String(y);
      byId('profileAvatarZoomValue').textContent = `${Number(zoom).toFixed(2)}×`;
      byId('profileAvatarPositionXValue').textContent = `${Math.round(x)}%`;
      byId('profileAvatarPositionYValue').textContent = `${Math.round(y)}%`;
      avatarCropImage.style.objectPosition = `${x}% ${y}%`;
      const shiftX = ((50 - x) / 50) * (zoom - 1) * 50;
      const shiftY = ((50 - y) / 50) * (zoom - 1) * 50;
      avatarCropImage.style.transform = `translate(${shiftX}%, ${shiftY}%) scale(${zoom})`;
    };

    const renderAvatarGrid = () => {
      if (avatarGrid.childElementCount) return;
      const fragment = document.createDocumentFragment();
      SHINOBI_AVATARS.forEach(avatar => {
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.className = 'profile-avatar-choice';
        choice.dataset.avatarFilename = avatar.filename;
        choice.setAttribute('aria-label', `Adjust ${avatar.label} avatar`);
        const image = document.createElement('img');
        image.src = avatar.src;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        const label = document.createElement('span');
        label.textContent = avatar.label;
        choice.append(image, label);
        fragment.append(choice);
      });
      avatarGrid.append(fragment);
    };

    avatarChooseButton?.addEventListener('click', () => {
      renderAvatarGrid();
      avatarGalleryView.hidden = false;
      avatarCropView.hidden = true;
      setSettingsFeedback('profileAvatarPickerFeedback', '');
      avatarPicker.showModal();
      avatarPickerClose.focus();
    });
    avatarPickerClose?.addEventListener('click', () => avatarPicker.close());
    avatarPicker?.addEventListener('click', event => {
      if (event.target === avatarPicker) avatarPicker.close();
    });
    avatarGrid?.addEventListener('click', event => {
      const choice = event.target.closest('[data-avatar-filename]');
      if (!choice) return;
      selectedAvatar = SHINOBI_AVATARS.find(avatar => avatar.filename === choice.dataset.avatarFilename);
      if (!selectedAvatar) return;
      const previous = parseShinobiAvatar(lastUser?.avatar);
      avatarCropImage.src = selectedAvatar.src;
      avatarCropImage.alt = `${selectedAvatar.label} crop preview`;
      setCropValues(previous?.filename === selectedAvatar.filename ? previous.zoom : 1,
        previous?.filename === selectedAvatar.filename ? previous.x : 50,
        previous?.filename === selectedAvatar.filename ? previous.y : 50);
      avatarGalleryView.hidden = true;
      avatarCropView.hidden = false;
      setSettingsFeedback('profileAvatarPickerFeedback', '');
      byId('profileAvatarZoom').focus();
    });
    byId('profileAvatarBack')?.addEventListener('click', () => {
      avatarGalleryView.hidden = false;
      avatarCropView.hidden = true;
      setSettingsFeedback('profileAvatarPickerFeedback', '');
    });
    [avatarZoom, avatarPositionX, avatarPositionY].forEach(control => control?.addEventListener('input', () => {
      setCropValues(Number(avatarZoom.value), Number(avatarPositionX.value), Number(avatarPositionY.value));
    }));

    let cropDrag = null;
    avatarCropPreview?.addEventListener('pointerdown', event => {
      if (!selectedAvatar) return;
      const bounds = avatarCropPreview.getBoundingClientRect();
      cropDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: Number(avatarPositionX.value), startY: Number(avatarPositionY.value), width: bounds.width, height: bounds.height };
      avatarCropPreview.setPointerCapture(event.pointerId);
    });
    avatarCropPreview?.addEventListener('pointermove', event => {
      if (!cropDrag || cropDrag.pointerId !== event.pointerId) return;
      const x = Math.min(100, Math.max(0, cropDrag.startX - ((event.clientX - cropDrag.x) / cropDrag.width) * 100));
      const y = Math.min(100, Math.max(0, cropDrag.startY - ((event.clientY - cropDrag.y) / cropDrag.height) * 100));
      setCropValues(Number(avatarZoom.value), x, y);
    });
    const endCropDrag = event => { if (cropDrag?.pointerId === event.pointerId) cropDrag = null; };
    avatarCropPreview?.addEventListener('pointerup', endCropDrag);
    avatarCropPreview?.addEventListener('pointercancel', endCropDrag);

    avatarApplyButton?.addEventListener('click', async () => {
      if (!selectedAvatar) return;
      setSettingsFeedback('profileAvatarPickerFeedback', 'Saving portrait selection…');
      setSettingsBusy(avatarApplyButton, true, 'Saving…');
      if (avatarResetButton) avatarResetButton.disabled = true;
      try {
        const avatar = await settingsController.selectAvatar({
          filename: selectedAvatar.filename,
          zoom: Number(avatarZoom.value),
          x: Number(avatarPositionX.value),
          y: Number(avatarPositionY.value),
        });
        setAuthState('authenticated', { ...lastUser, avatar });
        window.updateProfileData?.();
        avatarPicker.close();
        setSettingsFeedback('profileAvatarFeedback', 'Profile portrait updated.', 'success');
      } catch (error) {
        reportError('save profile avatar choice', error);
        const code = error?.code ? ` Error: ${error.code}.` : '';
        setSettingsFeedback('profileAvatarPickerFeedback', `${userMessage(error)}${code}`, 'error');
      } finally {
        setSettingsBusy(avatarApplyButton, false);
        if (avatarResetButton) avatarResetButton.disabled = false;
      }
    });

    avatarResetButton?.addEventListener('click', async () => {
      setSettingsFeedback('profileAvatarFeedback', 'Restoring generated avatar…');
      setSettingsBusy(avatarResetButton, true, 'Restoring…');
      if (avatarChooseButton) avatarChooseButton.disabled = true;
      try {
        await settingsController.removeAvatar();
        setAuthState('authenticated', { ...lastUser, avatar: null });
        window.updateProfileData?.();
        setSettingsFeedback('profileAvatarFeedback', 'Generated avatar restored.', 'success');
      } catch (error) {
        reportError('remove profile photo', error);
        setSettingsFeedback('profileAvatarFeedback', userMessage(error), 'error');
      } finally {
        setSettingsBusy(avatarResetButton, false);
        if (avatarChooseButton) avatarChooseButton.disabled = false;
      }
    });
    byId('settingsChangePasswordButton')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      setSettingsFeedback('settingsPasswordFeedback', '');
      setSettingsBusy(button, true, 'Changing password…');
      try {
        await settingsController.changePassword({
          currentPassword: byId('settingsCurrentPassword')?.value,
          newPassword: byId('settingsNewPassword')?.value,
          confirmPassword: byId('settingsConfirmPassword')?.value,
        });
        ['settingsCurrentPassword','settingsNewPassword','settingsConfirmPassword'].forEach(id => { if (byId(id)) byId(id).value = ''; });
        setSettingsFeedback('settingsPasswordFeedback', 'Your password has been changed successfully.', 'success');
      } catch (error) {
        reportError('change password', error);
        setSettingsFeedback('settingsPasswordFeedback', userMessage(error), 'error');
      } finally { setSettingsBusy(button, false); }
    });
    byId('settingsResetPasswordButton')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      setSettingsFeedback('settingsResetFeedback', '');
      setSettingsBusy(button, true, 'Sending…');
      try {
        if (!lastUser?.email) throw inputError('This account does not have a resettable email address.');
        await authController.resetPassword(lastUser.email);
        setSettingsFeedback('settingsResetFeedback', 'Password reset email sent. Check your Inbox and Spam/Junk folder.', 'success');
      } catch (error) {
        reportError('send settings password reset', error);
        const message = ['auth/network-request-failed','auth/too-many-requests'].includes(error?.code)
          ? userMessage(error)
          : 'Unable to send the password reset email. Please try again.';
        setSettingsFeedback('settingsResetFeedback', message, 'error');
      } finally { setSettingsBusy(button, false); }
    });
    byId('settingsChangeEmailButton')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      setSettingsFeedback('settingsEmailFeedback', '');
      setSettingsBusy(button, true, 'Sending verification link…');
      try {
        const email = byId('settingsNewEmail')?.value;
        const password = byId('settingsEmailCurrentPassword')?.value || '';
        await settingsController.requestEmailChange(email, password);
        if (byId('settingsNewEmail')) byId('settingsNewEmail').value = '';
        if (byId('settingsEmailCurrentPassword')) byId('settingsEmailCurrentPassword').value = '';
        setSettingsFeedback('settingsEmailFeedback', 'Verification link sent. Your account email changes after you verify the new address.', 'success');
      } catch (error) {
        reportError('request email change', error);
        setSettingsFeedback('settingsEmailFeedback', userMessage(error), 'error');
      } finally { setSettingsBusy(button, false); }
    });
    async function refreshSettingsAccount(button, feedbackId) {
      setSettingsFeedback(feedbackId, '');
      setSettingsBusy(button, true, 'Refreshing…');
      try {
        const user = await settingsController.refreshAccount();
        setAuthState(user.emailVerified ? 'authenticated' : 'unverified', user);
        setSettingsFeedback(feedbackId, user.emailVerified ? 'Account status is up to date.' : 'Your email is not verified yet. Check the verification link in your inbox.', user.emailVerified ? 'success' : '');
      } catch (error) {
        reportError('refresh account settings', error);
        setSettingsFeedback(feedbackId, userMessage(error), 'error');
      } finally { setSettingsBusy(button, false); }
    }
    async function sendSettingsVerification(button, feedbackId) {
      if (resendCooldownUntil > Date.now()) return;
      setSettingsFeedback(feedbackId, 'Sending verification email…');
      setSettingsBusy(button, true, 'Sending…');
      try {
        await authController.resendVerification();
        startResendCooldown();
        setSettingsFeedback(feedbackId, 'Verification email sent. Check your Inbox or Spam folder.', 'success');
      } catch (error) {
        reportError('resend settings verification email', error);
        setSettingsFeedback(feedbackId, verificationErrorMessage(error), 'error');
      } finally {
        setSettingsBusy(button, false);
        button.disabled = resendCooldownUntil > Date.now();
      }
    }
    byId('settingsResendVerificationButton')?.addEventListener('click', event => { void sendSettingsVerification(event.currentTarget, 'settingsVerifyFeedback'); });
    byId('settingsCheckVerificationButton')?.addEventListener('click', event => { void refreshSettingsAccount(event.currentTarget, 'settingsVerifyFeedback'); });
    byId('settingsRefreshEmailButton')?.addEventListener('click', event => { void refreshSettingsAccount(event.currentTarget, 'settingsEmailFeedback'); });
    updateResendCooldown();
  } catch (error) {
    authState = 'error'; reportError('Firebase startup', error);
    window.updateNav?.();
    window.showToast?.('Firebase is not configured. Follow the setup instructions in README.md.', 'error');
  }
});

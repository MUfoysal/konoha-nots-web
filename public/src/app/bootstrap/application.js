import { firebaseServices } from '../../core/services/firebase.js';
import { userMessage, reportError } from '../../core/errors/app-error.js';
import { FirebaseAuthDataSource } from '../../features/auth/data/datasources/firebase-auth-data-source.js';
import { FirebaseAuthRepository } from '../../features/auth/data/repositories/firebase-auth-repository.js';
import { AuthController } from '../../features/auth/presentation/controllers/auth-controller.js';
import { FirestoreNotesDataSource } from '../../features/notes/data/datasources/firestore-notes-data-source.js';
import { FirestoreNotesRepository } from '../../features/notes/data/repositories/firestore-notes-repository.js';
import { NotesController } from '../../features/notes/presentation/controllers/notes-controller.js';
import { sanitizeNoteHtml } from '../../core/utils/sanitize-note-html.js';
import { calculateProfileStatistics } from '../../features/profile/domain/usecases/calculate-profile-statistics.js';
import { filterAndSortNotes } from '../../features/notes/domain/usecases/filter-and-sort-notes.js';
import { FirebaseSettingsDataSource } from '../../features/settings/data/datasources/firebase-settings-data-source.js';
import { FirebaseSettingsRepository } from '../../features/settings/data/repositories/firebase-settings-repository.js';
import { SettingsController } from '../../features/settings/presentation/controllers/settings-controller.js';

let authController;
let notesController;
let settingsController;
let authState = 'loading';
let lastUser = null;
let saveQueue = Promise.resolve();
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
  authState = status;
  lastUser = user;
  window.settingsUser = ['authenticated','unverified'].includes(status) ? user : null;
  const resendButton = byId('resendVerificationButton');
  if (resendButton) resendButton.style.display = status === 'unverified' ? '' : 'none';
  const resendHelp = byId('unverifiedLoginHelp');
  if (resendHelp) resendHelp.style.display = status === 'unverified' ? '' : 'none';
  window.currentUser = status === 'authenticated' ? user : null;
  if (status !== 'authenticated' || userChanged) window.notes = [];
  if (status !== 'authenticated') {
    window.activeNoteId = null;
    clearTimeout(window.autoSaveTimer);
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
  const list = byId('notesList');
  if (list) list.innerHTML = '<div class="notes-empty-state"><div class="empty-icon">📜</div><p>Opening your scroll archive…</p></div>';
  try {
    const notes = await notesController.load();
    if (authState !== 'authenticated' || lastUser?.uid !== uid) return;
    window.notes = notes; window.renderNotesList?.(); refreshProfile();
  }
  catch (error) {
    if (authState !== 'authenticated' || lastUser?.uid !== uid) return;
    notifyError('loading notes', error);
    if (list) list.innerHTML = `<div class="notes-empty-state"><div class="empty-icon">📜</div><p>${userMessage(error)}</p></div>`;
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
    if (window.activeNoteId) { clearTimeout(window.autoSaveTimer); if (!await window.saveNote()) return false; }
    await authController.logout(); window.showToast?.('Chakra sealed. Goodbye.', '');
    return true;
  }
  catch (error) { notifyError('sign out', error); return false; }
};

window.createNote = async () => {
  if (!requirePrivateAccess()) return;
  try {
    if (window.activeNoteId) {
      clearTimeout(window.autoSaveTimer);
      if (!await window.saveNote()) return;
    }
    const note = await notesController.create({ title: 'New Scroll', content: '', tags: [], pinned: false });
    storeNote(note); window.openNote?.(note.id); window.showToast?.('New scroll created', 'success');
  } catch (error) { notifyError('create note', error); }
};

window.openNote = id => {
  if (!requirePrivateAccess()) return;
  const note = window.notes.find(item => String(item.id) === String(id)); if (!note) return;
  window.activeNoteId = id; window.isReadMode = false;
  if (byId('editorEmpty')) byId('editorEmpty').style.display = 'none';
  const active = byId('editorActive'); if (active) { active.style.display = 'flex'; active.style.flexDirection = 'column'; active.style.height = '100%'; }
  if (byId('noteTitleInput')) byId('noteTitleInput').value = note.title;
  if (byId('note-content-editor')) byId('note-content-editor').innerHTML = sanitizeNoteHtml(note.content || '');
  window.renderTags?.(note.tags || []); window.updatePinBtn?.(note.pinned); window.updateReadBtn?.(); window.updateWordCount?.();
  if (byId('lastSaved')) byId('lastSaved').textContent = `Sealed: ${new Date(note.updatedAt).toLocaleTimeString()}`;
  document.querySelectorAll('.note-item').forEach(element => element.classList.toggle('active', element.dataset.id === String(id)));
  byId('editorBodyDiv')?.classList.remove('read-mode'); if (byId('note-content-editor')) byId('note-content-editor').contentEditable = 'true';
  const formatBar = document.querySelector('.format-bar'); const tags = document.querySelector('.editor-tags');
  if (formatBar) formatBar.style.display = ''; if (tags) tags.style.display = '';
  if (window.innerWidth <= 768) {
    byId('notesEditor')?.classList.add('drawer-open');
    const sidebar = document.querySelector('.notes-sidebar');
    sidebar?.classList.remove('list-open');
    sidebar?.classList.add('drawer-hidden');
  }
};
window.promptDelete = () => { if (!requirePrivateAccess()) return; window.deleteTargetId = window.activeNoteId; byId('deleteModal')?.classList.add('open'); };
window.deleteNoteById = (id, event) => { event?.stopPropagation(); if (!requirePrivateAccess()) return; window.deleteTargetId = id; byId('deleteModal')?.classList.add('open'); };
window.closeDeleteModal = () => { byId('deleteModal')?.classList.remove('open'); window.deleteTargetId = null; };
window.updatePinBtn = pinned => { const button = byId('pinBtn'); if (button) { button.textContent = pinned ? '📌 Unpin' : '📌 Pin'; button.classList.toggle('active', pinned); } };
window.updateReadBtn = () => { const button = byId('readBtn'); if (button) { button.textContent = window.isReadMode ? '✏️ Edit' : '👁 Read'; button.classList.toggle('active', !!window.isReadMode); } };
window.toggleReadMode = () => {
  window.isReadMode = !window.isReadMode;
  byId('editorBodyDiv')?.classList.toggle('read-mode', window.isReadMode);
  if (byId('note-content-editor')) byId('note-content-editor').contentEditable = String(!window.isReadMode);
  const bar = document.querySelector('.format-bar'); const tags = document.querySelector('.editor-tags');
  if (bar) bar.style.display = window.isReadMode ? 'none' : ''; if (tags) tags.style.display = window.isReadMode ? 'none' : '';
  if (window.isReadMode) void window.saveNote(); window.updateReadBtn();
};

function persistNote(note) {
  const payload = normalizeNote(note);
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    const saved = await notesController.update(note.id, payload);
    storeNote(saved);
    return saved;
  });
  return saveQueue;
}
window.saveNote = async () => {
  if (!requirePrivateAccess()) return false;
  const id = window.activeNoteId;
  const note = window.notes.find(item => String(item.id) === String(id));
  if (!note) return true;
  note.title = byId('noteTitleInput')?.value || note.title || 'Untitled';
  note.content = sanitizeNoteHtml(byId('note-content-editor')?.innerHTML ?? note.content ?? '');
  try {
    if (byId('lastSaved')) byId('lastSaved').textContent = 'Sealing…';
    const saved = await persistNote(note);
    if (byId('lastSaved')) byId('lastSaved').textContent = `Sealed: ${new Date(saved.updatedAt).toLocaleTimeString()}`;
    window.showToast?.('Scroll sealed!', 'success');
    return true;
  } catch (error) { notifyError('save note', error); return false; }
};
window.updateNoteTitle = () => {
  const note = window.notes.find(item => String(item.id) === String(window.activeNoteId));
  if (!note) return;
  note.title = byId('noteTitleInput')?.value || 'Untitled';
  clearTimeout(window.autoSaveTimer);
  window.autoSaveTimer = setTimeout(() => void window.saveNote(), 1200);
};
window.onContentChange = () => { window.updateWordCount?.(); clearTimeout(window.autoSaveTimer); window.autoSaveTimer = setTimeout(() => void window.saveNote(), 1200); };
window.togglePin = async () => { const note = window.notes.find(item => String(item.id) === String(window.activeNoteId)); if (!note) return; note.pinned = !note.pinned; await window.saveNote(); window.updatePinBtn?.(note.pinned); };
window.pinNoteById = async (id, event) => {
  event?.stopPropagation();
  const note = window.notes.find(item => String(item.id) === String(id));
  if (!note) return;
  note.pinned = !note.pinned;
  try { storeNote(await persistNote(note)); }
  catch (error) { note.pinned = !note.pinned; notifyError('pin note', error); window.renderNotesList?.(); }
};
window.confirmDelete = async () => {
  if (!requirePrivateAccess()) return;
  if (!window.deleteTargetId) return;
  const id = window.deleteTargetId;
  try {
    await saveQueue.catch(() => {});
    await notesController.remove(id); window.notes = window.notes.filter(note => String(note.id) !== String(id));
    if (String(window.activeNoteId) === String(id)) { window.activeNoteId = null; if (byId('editorEmpty')) byId('editorEmpty').style.display = 'flex'; if (byId('editorActive')) byId('editorActive').style.display = 'none'; }
    window.closeDeleteModal?.(); window.renderNotesList?.(); refreshProfile(); window.showToast?.('Scroll destroyed', 'success');
  } catch (error) { notifyError('delete note', error); }
};
window.handleTagInput = event => {
  if (!['Enter', ','].includes(event.key)) return;
  event.preventDefault(); const note = window.notes.find(item => String(item.id) === String(window.activeNoteId));
  const value = event.target.value.trim().replace(',', '');
  if (value && note && !note.tags.includes(value)) { note.tags.push(value); window.renderTags?.(note.tags); void window.saveNote(); }
  event.target.value = '';
};
window.removeTag = index => { const note = window.notes.find(item => String(item.id) === String(window.activeNoteId)); if (!note) return; note.tags.splice(index, 1); window.renderTags?.(note.tags); void window.saveNote(); };

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

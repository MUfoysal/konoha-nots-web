import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, reload, updatePassword, updateProfile, verifyBeforeUpdateEmail } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { doc, getDoc, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { userFromAuth } from '../../../auth/domain/entities/user.js?v=20261013-2';

function noUserError() {
  return Object.assign(new Error('Your sign-in session expired. Sign in again to continue.'), { code: 'konoha/no-current-user' });
}

export class FirebaseSettingsDataSource {
  constructor(auth, db) { this.auth = auth; this.db = db; }

  currentUser() {
    if (!this.auth.currentUser) throw noUserError();
    return this.auth.currentUser;
  }

  async getProfile() {
    const user = this.currentUser();
    const snapshot = await getDoc(doc(this.db, 'users', user.uid));
    return snapshot.exists() ? snapshot.data() : null;
  }

  getCapabilities() {
    const user = this.currentUser();
    const providers = user.providerData.map(provider => provider.providerId);
    return { hasPassword: providers.includes('password'), hasGoogle: providers.includes('google.com') };
  }

  async refreshAccount() {
    const user = this.currentUser();
    await reload(user);
    if (user.emailVerified) await user.getIdToken(true);
    const profileRef = doc(this.db, 'users', user.uid);
    const snapshot = await getDoc(profileRef);
    const profile = snapshot.exists() ? snapshot.data() : {};
    if (snapshot.exists() && user.email && profile.email !== user.email) {
      await updateDoc(profileRef, { email: user.email, updatedAt: serverTimestamp() });
      profile.email = user.email;
    }
    return userFromAuth(user, profile);
  }

  async updateProfile({ displayName, clan }) {
    const user = this.currentUser();
    const profileRef = doc(this.db, 'users', user.uid);
    const snapshot = await getDoc(profileRef);
    if (!snapshot.exists()) throw Object.assign(new Error('Your profile could not be found. Sign out and sign in again.'), { code: 'konoha/profile-not-found' });
    const previousName = user.displayName || '';
    await updateProfile(user, { displayName });
    try {
      await updateDoc(profileRef, { displayName, clan, updatedAt: serverTimestamp() });
    } catch (error) {
      try { await updateProfile(user, { displayName: previousName }); } catch {}
      throw error;
    }
    return { ...snapshot.data(), displayName, clan };
  }

  async selectAvatar({ filename, zoom = 1, x = 50, y = 50 }) {
    if (typeof filename !== 'string' || !/^[a-z0-9-]+\.webp$/.test(filename)) {
      throw Object.assign(new Error('Choose an avatar from the gallery.'), { name: 'KonohaInputError' });
    }
    const safeZoom = Math.min(2.5, Math.max(1, Number(zoom) || 1));
    const safeX = Math.round(Math.min(100, Math.max(0, Number(x) || 0)));
    const safeY = Math.round(Math.min(100, Math.max(0, Number(y) || 0)));
    const photoURL = `konoha-avatar:v1:${filename}|${safeZoom.toFixed(2)}|${safeX}|${safeY}`;
    const user = this.currentUser();
    const profileRef = doc(this.db, 'users', user.uid);
    const snapshot = await getDoc(profileRef);
    if (!snapshot.exists()) throw Object.assign(new Error('Your profile could not be found. Sign out and sign in again.'), { code: 'konoha/profile-not-found' });

    try {
      await updateDoc(profileRef, { photoURL, updatedAt: serverTimestamp() });
      return photoURL;
    } catch (error) {
      if (error?.name === 'KonohaInputError' || error?.code?.startsWith('konoha/')) throw error;
      throw Object.assign(new Error(error?.message || 'The profile photo could not be saved.'), {
        code: error?.code || 'profile-photo/unknown',
        profilePhotoStage: 'saving the avatar choice to your Firestore profile',
        cause: error,
      });
    }
  }

  async removeAvatar() {
    const user = this.currentUser();
    const profileRef = doc(this.db, 'users', user.uid);
    const snapshot = await getDoc(profileRef);
    if (!snapshot.exists()) throw Object.assign(new Error('Your profile could not be found. Sign out and sign in again.'), { code: 'konoha/profile-not-found' });
    await updateDoc(profileRef, { photoURL: null, updatedAt: serverTimestamp() });
  }

  async reauthenticate(user, currentPassword = '') {
    const providers = user.providerData.map(provider => provider.providerId);
    if (providers.includes('password')) {
      if (!currentPassword) throw Object.assign(new Error('Enter your current password.'), { name: 'KonohaInputError' });
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      try { await reauthenticateWithCredential(user, credential); }
      catch (error) {
        if (['auth/wrong-password','auth/invalid-credential'].includes(error?.code)) {
          throw Object.assign(new Error('Your current password is incorrect.'), { code: 'konoha/current-password-incorrect', cause: error });
        }
        throw error;
      }
      return;
    }
    if (providers.includes('google.com')) {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
      return;
    }
    throw Object.assign(new Error('This security action is not available for the sign-in provider on this account.'), { code: 'konoha/unsupported-provider' });
  }

  async changePassword({ currentPassword, newPassword }) {
    const user = this.currentUser();
    if (!user.providerData.some(provider => provider.providerId === 'password')) {
      throw Object.assign(new Error('Password changes are available for email and password accounts.'), { code: 'konoha/password-provider-required' });
    }
    await this.reauthenticate(user, currentPassword);
    await updatePassword(user, newPassword);
  }

  async requestEmailChange(email, currentPassword = '') {
    const user = this.currentUser();
    if (email.toLowerCase() === String(user.email || '').toLowerCase()) {
      throw Object.assign(new Error('That is already the email address on your account.'), { name: 'KonohaInputError' });
    }
    await this.reauthenticate(user, currentPassword);
    await verifyBeforeUpdateEmail(user, email);
  }
}

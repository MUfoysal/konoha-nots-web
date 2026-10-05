import {
  createUserWithEmailAndPassword, deleteUser, GoogleAuthProvider, onAuthStateChanged, sendEmailVerification,
  reload, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { userFromAuth } from '../../domain/entities/user.js';

export class FirebaseAuthDataSource {
  constructor(auth, db) { this.auth = auth; this.db = db; }
  observe(callback) {
    let observation = 0;
    return onAuthStateChanged(this.auth, async firebaseUser => {
      const currentObservation = ++observation;
      if (!firebaseUser) return callback({ status: 'unauthenticated', user: null });
      const status = firebaseUser.emailVerified ? 'authenticated' : 'unverified';
      const fallbackUser = userFromAuth(firebaseUser);

      // Firebase Auth is authoritative for whether the user is signed in. Do not
      // make the app wait for a separate profile document before establishing
      // the authenticated UI state.
      callback({ status, user: fallbackUser, firebaseUser });
      try {
        const snapshot = await getDoc(doc(this.db, 'users', firebaseUser.uid));
        if (currentObservation !== observation || this.auth.currentUser?.uid !== firebaseUser.uid) return;
        const profile = snapshot.exists() ? snapshot.data() : {};
        const latestStatus = firebaseUser.emailVerified ? 'authenticated' : 'unverified';
        callback({ status: latestStatus, user: userFromAuth(firebaseUser, profile), firebaseUser });
      } catch (error) {
        if (currentObservation === observation && this.auth.currentUser?.uid === firebaseUser.uid) {
          const latestStatus = firebaseUser.emailVerified ? 'authenticated' : 'unverified';
          callback({ status: latestStatus, user: fallbackUser, firebaseUser, error });
        }
      }
    }, error => callback({ status: 'error', user: null, error }));
  }
  async register({ name, username, email, clan, password }) {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    const normalizedUsername = username.toLowerCase();
    const claim = doc(this.db, 'usernames', normalizedUsername);
    let profileCreated = false;
    try {
      if (!/^[a-z0-9_]{3,40}$/.test(normalizedUsername)) throw new Error('Invalid username. Use 3–40 letters, numbers, or underscores.');
      await setDoc(claim, { uid: credential.user.uid });
      await updateProfile(credential.user, { displayName: name });
      await setDoc(doc(this.db, 'users', credential.user.uid), {
        uid: credential.user.uid, displayName: name, username: normalizedUsername, email: credential.user.email,
        photoURL: null, clan: clan || 'Ronin', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      profileCreated = true;
      await sendEmailVerification(credential.user);
    } catch (error) {
      if (!profileCreated) {
        try { await deleteDoc(claim); } catch {}
        try { await deleteUser(credential.user); } catch {}
      } else {
        throw Object.assign(new Error('Your account was created, but the verification email could not be sent. Use “Resend verification email” to try again.', { cause: error }), { code: 'konoha/verification-send-failed' });
      }
      if (error?.code === 'permission-denied') throw Object.assign(
        new Error('Could not reserve this username. It may already be taken, or Firestore Security Rules may be blocking registration.'),
        { code: 'konoha/username-reservation-denied' },
      );
      throw error;
    }
    return credential.user;
  }
  async login({ email, password }) {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    if (!credential.user.emailVerified) throw Object.assign(new Error('Please verify your email before signing in.'), { code: 'konoha/email-not-verified' });
    return credential.user;
  }
  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await signInWithPopup(this.auth, provider);
    const user = credential.user;
    const profileRef = doc(this.db, 'users', user.uid);
    const existing = await getDoc(profileRef);
    if (!existing.exists()) {
      const base = (user.email?.split('@')[0] || 'shinobi').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30) || 'shinobi';
      const username = `${base}_${user.uid.slice(0, 6).toLowerCase()}`;
      await setDoc(doc(this.db, 'usernames', username), { uid: user.uid });
      await setDoc(profileRef, {
        uid: user.uid, displayName: user.displayName || 'Shinobi', username,
        email: user.email, photoURL: user.photoURL || null, clan: 'Ronin', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
    return user;
  }
  logout() { return signOut(this.auth); }
  sendPasswordReset(email) { return sendPasswordResetEmail(this.auth, email); }
  resendVerification() {
    const user = this.auth.currentUser;
    if (!user) throw Object.assign(new Error('Your sign-in session has expired. Sign in again to request a verification email.'), { code: 'konoha/no-current-user' });
    if (user.emailVerified) throw Object.assign(new Error('Your email is already verified. Choose “I’ve verified my email” to continue.'), { code: 'konoha/email-already-verified' });
    return sendEmailVerification(user);
  }
  async reloadCurrentUser() {
    const user = this.auth.currentUser;
    if (!user) throw Object.assign(new Error('Your sign-in session has expired. Sign in again to continue.'), { code: 'konoha/no-current-user' });
    await reload(user);
    if (user.emailVerified) await user.getIdToken(true);
    return userFromAuth(user);
  }
  getCurrentUser() { return this.auth.currentUser ? userFromAuth(this.auth.currentUser) : null; }
}

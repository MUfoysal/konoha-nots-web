import { getFirebaseConfig } from '../config/firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { connectAuthEmulator, getAuth } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { connectFirestoreEmulator, getFirestore } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js';

let services;

export function firebaseServices() {
  if (services) return services;
  const app = initializeApp(getFirebaseConfig());
  const auth = getAuth(app);
  const db = getFirestore(app);
  const emulator = globalThis.KONOHA_USE_EMULATORS;
  if (emulator) {
    connectAuthEmulator(auth, `http://${emulator.host || '127.0.0.1'}:${emulator.authPort || 9099}`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulator.host || '127.0.0.1', emulator.firestorePort || 8080);
  } else if (getFirebaseConfig().appCheckSiteKey) {
    initializeAppCheck(app, { provider: new ReCaptchaV3Provider(getFirebaseConfig().appCheckSiteKey), isTokenAutoRefreshEnabled: true });
  }
  services = { app, auth, db };
  return services;
}

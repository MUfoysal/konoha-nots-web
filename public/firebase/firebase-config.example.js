// Copy to firebase-config.js and replace values from Firebase Console > Project settings.
// These are Firebase Web App identifiers, not service-account credentials.
globalThis.KONOHA_FIREBASE_CONFIG = {
  apiKey: 'YOUR_FIREBASE_WEB_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_FIREBASE_WEB_APP_ID',
  appCheckSiteKey: '',
};

// Uncomment for local Firebase Emulator Suite use.
// globalThis.KONOHA_USE_EMULATORS = { host: '127.0.0.1', authPort: 9099, firestorePort: 8080 };

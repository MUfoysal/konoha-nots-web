/**
 * Public Firebase Web configuration is loaded from public/firebase/firebase-config.js.
 * Firebase web config identifies the project; it is not an Admin/service-account secret.
 */
export function getFirebaseConfig() {
  const config = globalThis.KONOHA_FIREBASE_CONFIG;
  if (!config || !config.apiKey || !config.projectId || !config.appId || config.apiKey.startsWith('YOUR_')) {
    throw new Error('Firebase is not configured. Copy firebase-config.example.js to firebase-config.js and add your Firebase web app settings.');
  }
  return config;
}

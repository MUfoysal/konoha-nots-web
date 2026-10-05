# Firebase setup and model

## Services

- **Authentication:** email/password, verification and reset email, Google popup, `onAuthStateChanged`.
- **Cloud Firestore:** user profile documents and user-owned note subcollections.
- **Hosting:** static `public/` content; PHP and private directories stay outside the hosted root.
- **App Check:** optional reCAPTCHA v3 provider is initialized when an App Check site key is supplied. Configure the provider and monitor valid traffic before enabling enforcement in Firebase Console.
- **Storage/Functions:** intentionally not used. The current product has no uploads or trusted server-only jobs.

## Configuration

`public/firebase/firebase-config.js` contains public Firebase Web App settings, which browsers must receive. Replace its placeholders from Firebase Console. Never add Admin credentials, a service-account JSON file, or private API keys to the frontend. Google sign-in additionally requires enabling the Google provider and authorized domains.

For emulators, uncomment `KONOHA_USE_EMULATORS` in the config. The application connects to Auth on 9099 and Firestore on 8080. Hosting runs on 5000. Do not point emulator-enabled builds at production resources.

## Firestore documents

```text
users/{uid}
  uid, displayName, username, email, photoURL, clan, createdAt, updatedAt

usernames/{lowercaseUsername}
  uid

users/{uid}/notes/{noteId}
  title, content, tags[], isPinned, color, createdAt, updatedAt
```

Notes use a per-user subcollection so rules can bind every operation to the path UID. Timestamps are written using Firestore server timestamps. Color remains `default` because the current UI does not expose note colors. Profile statistics are derived from the current notes, not stored as duplicate counters.

Username claims are separate, lowercase reservation documents. Clients cannot read the username-to-UID mapping; create/update rules prevent another account from claiming the same name. This preserves registration uniqueness without exposing emails or adding a Cloud Function.

## Query behavior

The notes datasource fetches only `users/{currentUid}/notes`, ordered by `updatedAt`. Existing client behavior performs pinned-first sorting, seven-day recent filtering, and text/tag search in memory. This keeps behavior aligned with the previous app and avoids global queries, but reads the full personal collection. Add pagination or a dedicated search design only if observed usage needs it.

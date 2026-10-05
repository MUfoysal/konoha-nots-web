# Konoha Notes migration audit

## Starting point

- The UI was a single static `public/index.html` page with one large CSS file and a global-function JavaScript UI.
- `legacy-ui.js` originally implemented localStorage credentials and note persistence. `storage-guard.js` blocked the old `kn_` keys, and `app.js` overrode many legacy functions to call `api.js`.
- The active backend was a custom PHP API, PDO repositories, PHP sessions/CSRF, and MySQL tables for users, notes, and verification tokens.
- The current repository has Firebase Web configuration, restrictive Firestore rules, emulator setup, a package manifest, automated test sources, and a Git baseline.
- Remaining risks: Firebase Auth/Firestore browser flows and deployed rules need live verification; the frontend still uses global UI handlers and the PHP backend remains as rollback material.

## Target architecture

The browser loads source modules under `public/src/` because Firebase Hosting serves only `public/`. `core/` owns Firebase initialization and error/sanitization helpers. `features/auth` and `features/notes` each have domain contracts/use cases and Firebase-backed data adapters, plus small presentation controllers. `features/profile` keeps note-derived statistics in a domain use case while the existing legacy visual renderer paints them. `app/bootstrap` wires concrete repositories and connects event handlers to the existing UI.

## Firebase data model

- `users/{uid}` stores the signed-in user's display name, username, email, photo URL, clan, and timestamps.
- `users/{uid}/notes/{noteId}` stores title, sanitized rich-text content, tags, pin status (`isPinned`), default color, and timestamps.
- No Storage bucket operations or Cloud Functions are needed: the current product has no uploads or trusted server-side jobs.
- Search, tag filters, pinned filter, recent filter, and sorting operate on the signed-in user's fetched notes, matching the existing UI behavior. This is appropriate for personal-scale lists, but it is not a paginated large-dataset search design.

## Migration sequence and status

1. Audit and preserve the existing HTML/CSS and visual helpers — done.
2. Add Firebase configuration, Auth/Firestore adapters, use cases, hosting/emulator setup, and restrictive rules — implemented in source. The Web config identifies project `konoha-nots`; provider settings and deployed rules still require external verification.
3. Switch UI actions to Firebase email/password, verification, Google popup, reset, resend, note CRUD, and profile-derived statistics — implemented but not cloud-verified.
4. Remove localStorage authentication/notes and the old active PHP API client from the page — done. The PHP backend remains in the repository as a rollback reference because replacement equivalence has not yet been verified.
5. Add domain tests and emulator rule tests — test sources are present. Domain tests can run with Node.js and installed npm packages; Firestore emulator execution requires Firebase CLI and Java.
6. Configure a real Firebase project, run emulator and browser QA, then remove obsolete PHP/MySQL files only after successful verification — pending.

## Explicit limitations

The Firebase Web configuration targets `konoha-nots`; Google OAuth provider status, authorized domains, deployed Firestore rules, and App Check configuration are not verified by repository contents. App Check cannot be enforced until a site key is configured and valid traffic is observed. No Storage rules are needed unless uploads are added. Firebase Auth owns its own browser persistence; the app does not store passwords or note documents in localStorage.

Existing database/browser data was not imported: no MySQL server or actual user dataset was available, and old password hashes cannot be transferred as Firebase Auth credentials. Existing note content needs an explicit, authenticated migration before the old database is retired.

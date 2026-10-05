# Konoha Notes

Naruto-themed personal notes app with the original visual design, Firebase Authentication, and private Cloud Firestore notes. The frontend is plain HTML, CSS, and modular JavaScript; no UI framework or application server is required.

> **Verification status:** `public/firebase/firebase-config.js` is configured for the `konoha-nots` Firebase Web App. Firebase App, Auth, and Firestore initialization passed an SDK check, but browser authentication, Firestore CRUD, security-rule enforcement, and deployment remain **unverified**.

## Features

- Email/password registration, email verification, sign-in, password reset, verification resend, and Google popup sign-in.
- Private note creation, reading, editing, deletion, formatted content, tags, pinning, search, pinned/recent filters, and pinned-first/recent sorting.
- Profile statistics derived from the current user's note documents.
- Registration uses unique usernames; Firebase email/password sign-in uses the account email.
- Firebase Auth persistence and Firestore rules that scope access to the authenticated UID; note operations require a verified email.
- Firebase Hosting and Auth/Firestore/Hosting Emulator Suite configuration.

## Technology

- HTML, CSS, vanilla JavaScript modules.
- Firebase JavaScript SDK modular CDN imports (12.19.0).
- Firebase Authentication, Cloud Firestore, optional App Check, and Firebase Hosting.
- Node's built-in test runner for domain tests; Firebase Rules Unit Testing and Firebase CLI for emulator tests.

## Architecture and folders

```text
public/
├── index.html                 Existing page and view markup
├── assets/css/app.css         Existing visual system
├── assets/js/legacy-ui.js     Retained shared visual/editor behaviors; no localStorage auth or note persistence
├── firebase/                  Public Web config and example
└── src/
    ├── core/                  Firebase initialization, errors, HTML sanitization
    ├── features/
    │   ├── auth/               Domain contract/use cases, Firebase adapter, UI controller
    │   ├── notes/              Note rules, repository, Firestore adapter, UI controller
    │   └── profile/            Pure note-derived statistics
    └── app/bootstrap/          Composition root and bindings to existing UI
firestore.rules                UID ownership, verified-email and field validation
firebase.json                  Hosting, headers, emulator and deploy configuration
tests/                          Domain and Firestore-rules tests
documentation/                  Audit, architecture, Firebase, security, deployment
```

Dependency direction is presentation → domain → data. Firebase SDK imports are limited to Firebase initialization and data sources. The profile retains the existing visual renderer while its statistics calculation is a pure domain use case.

## Firebase model and data flow

- `users/{uid}` contains `uid`, `displayName`, `username`, `email`, `photoURL`, `clan`, `createdAt`, `updatedAt`; `usernames/{lowercaseUsername}` reserves unique names without exposing email addresses.
- `users/{uid}/notes/{noteId}` contains `title`, sanitized `content`, `tags`, `isPinned`, `color`, `createdAt`, `updatedAt`.
- A note event flows through the existing HTML event handler → `NotesController` → domain use case and validation → `FirestoreNotesRepository` → `FirestoreNotesDataSource` → Firestore. Results update the same note list/editor.
- Authentication flows through `AuthController` → auth use case/repository → `FirebaseAuthDataSource` → Firebase Auth and profile document.

## Authentication flow

Email/password registration creates a Firebase Auth user, reserves the lowercase username, writes the user's profile document, and sends the Firebase verification email. Login requires a verified email. Google uses Firebase Auth's popup provider and creates a profile/unique username reservation on first sign-in. The Auth state listener controls navigation and loads the user's notes. Password reset and verification resend use Firebase's built-in email actions. Firebase Auth's browser persistence is used; no application password/session storage is implemented.

Full details and security rationale are in [architecture.md](documentation/architecture.md), [firebase.md](documentation/firebase.md), [security.md](documentation/security.md), and [deployment.md](documentation/deployment.md).

## Local development

1. Install Node.js 20 or later, Java JDK 11 or later, and the Firebase CLI (`npm install --global firebase-tools`). Install the project test dependencies with `npm install`.
2. Create a Firebase project and Web App. Enable Email/Password and Google providers in Firebase Authentication.
3. Use the existing public Web App configuration in `public/firebase/firebase-config.js`; verify provider settings and authorized domains in Firebase Console. Firebase Web config values are public identifiers; never put Admin SDK keys or service-account JSON here.
4. For emulators, enable `KONOHA_USE_EMULATORS` in that file and set a local emulator-only Firebase config. Run `npm run emulators` in one terminal.
5. Serve the project from its root with Firebase Hosting Emulator (`http://127.0.0.1:5000`) so module imports and Auth authorized-domain behavior are consistent.
6. Run `npm test` for pure domain tests. Run `npm run test:rules` for Firestore Security Rules tests against the emulator.

The Firebase CLI is installed separately because it is a developer/deployment tool, not an application dependency. Emulator setup requires Node.js 20+ and Java JDK 11+; emulator installation may download local binaries. See the official [Firebase Emulator setup guide](https://firebase.google.com/docs/emulator-suite/install_and_configure).

## Hosting deployment

Select the Firebase project with `firebase use --add`, enable providers, review rules, and deploy `firebase deploy --only firestore:rules,firestore:indexes,hosting`. The Hosting root is `public/`; PHP files, dotfiles, and private project folders are not deployed. Set authorized domains and test email verification/reset templates before launch. See [deployment.md](documentation/deployment.md).

## Testing and QA

`npm test` currently covers note validation/mapping, search/filter/sort, and derived profile stats. The emulator rule suite covers owner CRUD, cross-user denial, unverified users, username reservations, unauthenticated reads, and invalid fields. It has not been run here because the Firebase CLI and Java are unavailable in this environment. Use the manual QA checklist in `documentation/deployment.md` for Google OAuth, email actions, responsive layout, and browser behavior.

## Known limitations

- Firebase Web configuration targets `konoha-nots`; provider settings, authorized domains, browser E2E flows, deployed rules, and production deployment are not verified here.
- Existing MySQL accounts/notes and any browser localStorage data have not been imported. Legacy password hashes cannot be reused as Firebase passwords; users must create Firebase accounts. Export and explicitly reassign existing note content before retiring the old database.
- Search and filters load the signed-in user's notes and operate in memory, matching the existing behavior. This is not a paginated strategy for very large note collections.
- The existing profile activity list is derived from note timestamps, not a separately stored audit/event history.
- Note color remains `default`; there is no color UI, so no new design control was introduced.
- Rich-text sanitization is client-side because there is no trusted PHP API after migration. Firestore rules also require bounded note fields; rules cannot replace thorough client-side sanitization.
- No Firebase Storage or Cloud Functions are used because the app currently has no uploads or trusted server-only workflow.
- PHP/MySQL files remain temporarily as rollback/reference code until Firebase emulator and project-backed browser verification succeeds. The active frontend no longer calls the PHP API.

## Screenshots

Screenshots are not included yet. Add authentic desktop and mobile captures here after recording them from the running app.

## Legacy backend status

The PHP/MySQL API and schema remain in the repository as rollback/reference material. The active browser frontend does not call the PHP API; `deployment.md` still documents that backend. Keep it until Firebase migration equivalence and data-retention decisions are confirmed.

## License

No license file is currently present. For a public portfolio repository, consider MIT if you intend to allow reuse and modification; choose only after confirming rights to all included code and assets.

## Future improvements

After Firebase project verification: enforce App Check after monitoring valid traffic, add pagination if real note volume requires it, and remove PHP/MySQL rollback files after an approved migration checkpoint. Avoid introducing a server-side layer unless a real trusted operation requires it.

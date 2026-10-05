# Local QA and deployment

## Prerequisites

- Node.js 20+ for current project tooling and Firebase Emulator Suite.
- Java JDK 11+ for Auth/Firestore emulators.
- Firebase CLI and a Firebase project for deploy.
- A configured Firebase Web App and provider settings.

## Local setup

1. Install Firebase CLI separately with `npm install --global firebase-tools`; run `npm install` in the project root for test dependencies.
2. Set the Firebase Web config in `public/firebase/firebase-config.js`.
3. Enable Auth and Firestore emulators in that file for local work.
4. Run `npm run emulators`; open `http://127.0.0.1:5000`.
5. In another terminal, run `npm test`, then `npm run test:rules`.

The rules tests use Auth test contexts and the Firestore emulator; they do not need production accounts. Emulator binaries may be downloaded on first use.

## Production setup and deploy

1. Create the Firebase project/Web App, enable Email/Password and Google providers, and configure authorized production domains.
2. Replace Web App placeholders and optionally set the reCAPTCHA v3 App Check site key.
3. Review `firestore.rules`, then deploy with `firebase use --add` and `firebase deploy --only firestore:rules,firestore:indexes,hosting`.
4. Verify auth action URLs, sender templates, reset and verification emails, and Google popup behavior on the deployed domain.
5. After valid App Check traffic is observed, enable Auth/Firestore App Check enforcement in Firebase Console.

Firebase Hosting serves only `public/`; `**/*.php` and dotfiles are ignored. The existing `app/`, `config/`, `database/`, `storage/`, `.env`, and Composer files remain outside Hosting's public root. They are retained only as migration rollback material and are not needed by the deployed frontend.

## Manual QA checklist

- Register; confirm duplicate/invalid email, password mismatch, and password minimum feedback.
- Receive and complete email verification; resend verification when needed.
- Sign in with email/password and Google; confirm Auth persists after refresh.
- Reset password; sign out, then sign in again in the same page session.
- Create, edit, format, tag, pin, search, filter, sort, and delete notes; reload to confirm persistence.
- Confirm user A cannot read/update/delete user B notes, and an unverified/anonymous user cannot access notes.
- Try unsafe note markup and confirm it is reduced to allowed safe formatting.
- Check profile counts, recent notes, and tags after each mutation.
- Check home/auth/profile/notes navigation and desktop/tablet/mobile layout including the mobile drawer.
- Check empty, loading, permission-denied, offline, and service-error states.

Production QA remains unverified until a real project is configured and this checklist is run.

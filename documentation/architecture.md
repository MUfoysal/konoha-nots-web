# Architecture

## Before

The original browser had one large HTML page and global `legacy-ui.js`. It contained localStorage accounts and note persistence. A later `api.js`/`app.js` layer overrode some global functions and sent requests to a custom PHP API. PHP controllers called PDO repositories backed by MySQL. A storage guard attempted to block old `kn_` keys. This left two generations active in one page.

## After

The page and stylesheet remain in place to preserve the existing visual design. The client code is modular and feature-based under `public/src/`; placing browser modules under `public/` is necessary for static Firebase Hosting to serve them without a build step.

- `core`: shared Firebase setup, user-safe error mapping, and note HTML sanitization.
- `features/auth/domain`: user mapping, repository contract, and auth use cases.
- `features/auth/data`: Firebase Auth/Firestore adapter and repository implementation.
- `features/auth/presentation`: controller consumed by the app composition root.
- `features/notes/domain`: note validation/model mapping, repository contract, and CRUD use cases.
- `features/notes/data`: Firestore subcollection adapter and repository implementation.
- `features/notes/presentation`: async operation state controller.
- `features/profile/domain`: deterministic statistics derived from note entities; existing markup renderer remains in the visual helper.
- `app/bootstrap`: explicit construction of adapters/controllers and binding to the existing interface.
- `legacy-ui.js`: shared visual effects, navigation, editor formatting, rendering, and profile painting only. LocalStorage accounts/notes, PHP API calls, and PHP CSRF client are removed from the active page.

## Data flow

```text
User action
  → existing HTML event
  → app/bootstrap/application.js
  → feature presentation controller
  → domain use case and validation
  → repository contract
  → Firebase repository implementation
  → Firebase Auth or Firestore data source
  → Firebase
  → mapped domain entity
  → existing notes/profile UI updated
```

## State

Firebase Auth is the authentication source of truth; its state observer sets `initializing`, `authenticated`, `unverified`, `unauthenticated`, or `error`. `NotesController` tracks `loading`, `loaded`, `empty`, `saving`, `saved`, `deleting`, or `error`. Firebase Auth uses its browser persistence behavior; the application does not directly store passwords, sessions, or notes in localStorage. Firestore persistent offline cache is not enabled; this avoids durable note data on shared browsers until a deliberate product decision is made.

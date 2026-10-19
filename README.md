# 🍃 Konoha Notes

Konoha Notes is a Naruto-themed personal notes application built with HTML, CSS, JavaScript, Firebase Authentication, and Cloud Firestore.

I built this project to practice frontend development, Firebase integration, application architecture, and secure data handling. The interface uses a custom cinematic design inspired by the Naruto universe, while the notes and account features are connected to Firebase.

The application uses plain HTML, CSS, and modular JavaScript without a frontend framework.

**Project status:** The project includes authentication, note management, a rich-text editor, profile settings, and Firestore integration. Unit tests and Firestore Security Rules tests pass locally. The complete browser save-and-reload workflow is still being verified.

## ✨ Features

### Authentication

- Email and password registration
- Email verification
- Login for verified email accounts
- Password reset and verification email resend
- Google sign-in
- Firebase Authentication persistence
- Protected application routes
- Guest navigation and logout
- Unique username registration

### Notes

- Create, read, edit, and delete notes
- Rich-text editor with formatting toolbar
- Headings, lists, text colors, highlights, and text alignment
- Strikethrough, subscript, and superscript
- Checklists, tables, callouts, and collapsible sections
- Code blocks with lightweight syntax highlighting
- Slash commands and Markdown shortcuts
- Insert images, links, and simple link cards
- Undo, redo, and drag-and-drop block reordering
- Tags, pinned notes, search, and recent-note filters
- Pinned-first and recent-first sorting
- Read mode and focus mode
- Local recovery drafts for unsaved changes, when browser storage is available
- Firestore-based note storage with user-specific access

**Quick Snippets** are also available for reusable text. They are stored in the current browser and are not synchronized between devices.

### Profile

- Firebase account information
- Username and clan information
- Naruto-themed portrait selection
- Portrait zoom and crop positioning
- Profile statistics derived from notes
- Note-based activity information

### Settings

- Account management
- Password reset and email verification
- Profile portrait and crop controls
- Authentication-related actions
- Logout

## 🖥️ Screenshots

The following screenshots show the current interface. They are stored in the `documentation/screenshots/` directory.

| Home | Features |
|---|---|
| ![Home page](documentation/screenshots/home-current.png) | ![Feature cards](documentation/screenshots/features-current.png) |

| Notes Editor | Empty Notes |
|---|---|
| ![Notes editor](documentation/screenshots/notes-editor.png) | ![Empty notes state](documentation/screenshots/notes-empty.png) |

| Settings | Profile |
|---|---|
| ![Settings](documentation/screenshots/settings-current.png) | ![Profile account](documentation/screenshots/profile-account.png) |

| Sign In | Registration |
|---|---|
| ![Sign in](documentation/screenshots/login-current.png) | ![Registration](documentation/screenshots/register-current.png) |

## 🧰 Technology Stack

| Area | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Architecture | Feature-based structure inspired by Clean Architecture |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| Firebase SDK | JavaScript SDK 12.19.0 |
| Hosting | Firebase Hosting |
| Unit Testing | Node.js test runner |
| Security Testing | Firebase Rules Unit Testing |
| Local Testing | Firebase Emulator Suite |
| Package Management | npm |
| Version Control | Git and GitHub |

No frontend UI framework is used.

## 🏗️ Project Structure

The project is organized by feature, with separate areas for presentation, business logic, and data access.

```text
konoha_nots/
├── public/
│   ├── index.html
│   ├── assets/
│   │   ├── css/
│   │   │   └── app.css
│   │   ├── js/
│   │   │   └── legacy-ui.js
│   │   └── images/
│   ├── firebase/
│   │   ├── firebase-config.js
│   │   └── firebase-config.example.js
│   └── src/
│       ├── core/
│       │   ├── config/
│       │   ├── errors/
│       │   ├── services/
│       │   └── utils/
│       ├── features/
│       │   ├── auth/
│       │   │   ├── data/
│       │   │   ├── domain/
│       │   │   └── presentation/
│       │   ├── notes/
│       │   │   ├── data/
│       │   │   ├── domain/
│       │   │   └── presentation/
│       │   ├── settings/
│       │   │   ├── data/
│       │   │   ├── domain/
│       │   │   └── presentation/
│       │   └── profile/
│       │       └── domain/
│       └── app/
│           └── bootstrap/
├── documentation/
│   ├── architecture.md
│   ├── deployment.md
│   ├── firebase.md
│   ├── migration-audit.md
│   ├── security.md
│   └── screenshots/
├── tests/
│   ├── unit/
│   └── rules/
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── package.json
└── README.md
```

Some legacy PHP/MySQL files remain in the repository for reference and possible rollback. The active frontend uses Firebase for authentication and note storage rather than the legacy PHP API.

### Architecture Overview

The application follows a feature-based structure inspired by Clean Architecture.

**Presentation:** Handles UI events, navigation, forms, and rendering.

**Domain:** Contains entities, validation, repository contracts, filtering, sorting, and business rules.

**Data:** Contains Firebase-specific implementations, repositories, and data sources.

This separation helps keep business logic independent of Firebase implementation details.

## 🔥 Firebase Integration

The application uses Firebase Authentication for user accounts and Cloud Firestore for private user data.

### Firestore Structure

```text
users/
└── {uid}/
    └── notes/
        └── {noteId}

usernames/
└── {lowercaseUsername}
```

The user profile document is stored at `users/{uid}` and includes fields such as:

- `uid`
- `displayName`
- `username`
- `email`
- `photoURL`
- `clan`
- `createdAt`
- `updatedAt`

A note document is stored at `users/{uid}/notes/{noteId}` and includes fields such as:

- `title`
- `content`
- `tags`
- `isPinned`
- `color`
- `createdAt`
- `updatedAt`

Username reservations are stored separately using normalized lowercase usernames.

### Data Flow

Authentication:

```text
UI
 ↓
Auth Controller
 ↓
Auth Use Case
 ↓
Auth Repository
 ↓
Firebase Auth Data Source
 ↓
Firebase Authentication
```

Notes:

```text
Editor / UI Event
 ↓
Notes Controller
 ↓
Note Use Case
 ↓
Notes Repository
 ↓
Firestore Data Source
 ↓
Cloud Firestore
```

## 🔐 Security

The project uses Firebase Authentication and Firestore Security Rules to protect user data.

The security rules are designed to enforce:

- Authentication requirements for private data
- User-specific access to profiles and notes
- Email verification requirements for note operations
- Ownership restrictions and UID immutability
- Username reservation constraints
- Validation of allowed note fields
- Creation and update timestamp restrictions
- Rejection of unauthorized and cross-user access

The frontend also sanitizes rich-text content before storage and rendering.

Client-side sanitization is not a replacement for server-side or database security. Firestore Rules validate permitted data operations but do not replace proper HTML sanitization.

The application does not store account passwords in its own browser storage or Firestore documents. Firebase Authentication manages the authentication credentials.

See [`documentation/security.md`](documentation/security.md) for more details.

## 🧪 Testing and Current Status

I use unit tests and Firebase Emulator Suite tests to check the application's logic and Firestore access rules.

### Latest Recorded Results

| Check | Result |
|---|---|
| Unit tests | 16/16 passed |
| Firestore Security Rules tests | 8/8 passed |
| JavaScript syntax checks | Passed |
| `git diff --check` | Passed |
| Complete browser acceptance flow | Not fully verified |
| Production Hosting deployment | Not verified in the latest QA cycle |

Run the unit tests:

```bash
npm test
```

Run the Firestore Security Rules tests:

```bash
npm run test:rules
```

### Current QA Limitation

The complete signed-in browser workflow has not yet been verified end to end. In particular, note creation or editing followed by navigation, page reload, and confirmation of the latest cloud-saved content still requires testing.

A guard for invalid note IDs such as `undefined` and `null` has been added with corresponding unit tests. However, the full browser save flow remains under investigation. Passing unit tests and Security Rules tests alone does not establish that every note-saving scenario works correctly.

## 🚀 Local Development

### Requirements

- Node.js 20 or later
- Java JDK 11 or later
- Firebase CLI
- npm

Install dependencies:

```bash
npm install
```

### Firebase Configuration

Create a Firebase project and register a Firebase Web App. Enable the authentication providers required by the application, including Email/Password and Google sign-in if Google login is being used.

The frontend configuration is located at:

```text
public/firebase/firebase-config.js
```

Firebase Web configuration is intended for client-side use. Never commit Firebase Admin SDK service-account credentials, private keys, or other server secrets to the frontend or a public repository.

### Start the Local Emulators

```bash
npm run emulators
```

The project uses the Firebase Hosting emulator for local browser testing, along with the relevant Firebase emulators.

Default local addresses are configured as follows:

| Service | Address |
|---|---|
| Hosting | `http://127.0.0.1:5000` |
| Firestore | `http://127.0.0.1:8080` |
| Authentication | `http://127.0.0.1:9099` |
| Emulator UI | `http://127.0.0.1:4000` |

Check `firebase.json` and the npm scripts for the actual emulator configuration before starting the services.

## ☁️ Firebase Hosting Deployment

The project is configured to use `public/` as the Firebase Hosting directory.

The deployment command is:

```bash
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

Before deploying, verify:

1. The selected Firebase project is correct.
2. Authentication providers and authorized domains are configured.
3. Firestore Security Rules and indexes are correct.
4. Email verification and password reset flows work.
5. Google sign-in works if enabled.
6. The complete note save, navigation, and reload flow passes in the intended environment.

**Production deployment and the complete production browser workflow have not been verified in the latest QA cycle.**

## ⚠️ Known Limitations

**Existing data migration:** Existing MySQL accounts, notes, and browser-local data have not been automatically migrated. Firebase accounts must be established separately unless a dedicated migration process is implemented.

**Large note collections:** Search and filtering currently operate on the signed-in user's loaded notes in memory. Pagination may be needed as collections grow.

**Local recovery drafts:** Recovery drafts depend on browser storage being available. They should not be treated as a replacement for a successful cloud save.

**Quick Snippets:** Snippets are stored in the current browser and are not synchronized across devices.

**Profile activity:** Profile activity is derived from note timestamps rather than a separate event or audit system.

**Note colors:** The data model supports a `color` field, but the current UI uses the default value and does not provide a separate color-selection interface.

**Images and cloud services:** Profile portraits are bundled with the site. The selected portrait and crop settings are stored in the user's profile. Firebase Storage and Cloud Functions are not currently used.

**Legacy backend:** The previous PHP/MySQL implementation remains in the repository for reference and possible rollback. It should only be removed after the migration and rollback requirements have been reviewed.

## 📁 Documentation

Additional documentation is available in the `documentation/` directory:

- [`architecture.md`](documentation/architecture.md) — application structure and design
- [`deployment.md`](documentation/deployment.md) — deployment instructions
- [`firebase.md`](documentation/firebase.md) — Firebase setup and integration
- [`migration-audit.md`](documentation/migration-audit.md) — migration-related findings
- [`security.md`](documentation/security.md) — security rules and related considerations

## 🔮 Future Improvements

- Complete the browser-based save, navigation, and reload tests.
- Verify Firebase Hosting deployment and production authentication flows.
- Improve recovery and save-failure handling based on test results.
- Add pagination if the size of note collections requires it.
- Plan a migration if existing MySQL data needs to be retained.
- Add mobile screenshots to the documentation.
- Review and remove legacy backend files when rollback is no longer required.
- Consider Firebase App Check after validating the deployment and monitoring requirements.

## 📄 License

No license file is currently included. A license can be added after confirming the rights to the project's code, images, fonts, and other assets.

## 👨‍💻 Author

**Mohib Ullah Foysal**

Computer Science & Technology Student | App & Web Developer

- GitHub: [@MUfoysal](https://github.com/MUfoysal)
- Project repository: [Konoha Notes](https://github.com/MUfoysal/konoha-nots-web)

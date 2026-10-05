# Security model

- Firebase Auth is the identity source. Passwords are handled only by Firebase Authentication.
- Every private document lives under `users/{uid}`. Firestore rules require the authenticated UID to match the path UID; notes additionally require a verified email claim.
- Usernames are normalized lowercase and reserved in `usernames/{username}`. Reservation documents contain only a UID, are not client-readable, and rules deny a second owner. Profile creation requires a matching owner reservation.
- Profile documents are owner-readable and owner-writable with field allowlists. Notes are owner-readable/creatable/updatable/deletable with field allowlists, content/title/tag bounds, immutable creation time, and server-time update checks.
- Client note HTML is rebuilt from an allowlist of tags and safe link protocols before it is stored or rendered. Arbitrary attributes, event handlers, script/iframe/image elements, and dangerous URLs are discarded.
- Auth/session/note data are not written by application code to localStorage. Firebase Auth may use its SDK-managed browser persistence; Firestore durable offline cache is disabled.
- No Storage service is used, therefore no Storage rules are deployed. If uploads are added, owner-scoped rules and MIME/size validation become mandatory.
- App Check is wired as an optional ReCAPTCHA v3 provider. Configure it and observe valid requests before enabling enforcement; no site key was available in this workspace.
- Hosting deploys only `public/` and ignores PHP files. Firestore rules are deployed with the project; frontend checks are not treated as authorization.

## Review limitations

Rules are written but emulator execution and a Firebase Console review are still pending. Rich-text safety has domain/source coverage but needs browser test cases against malformed HTML. Production App Check enforcement, provider/domain settings, and abuse controls depend on the real Firebase project.

## Content Security Policy

No enforcing CSP is configured yet. The current page uses inline event-handler attributes and inline style attributes, loads Firebase SDK modules from `www.gstatic.com`, fonts from Google Fonts, and story imagery through external proxy URLs. A policy that allows inline scripts/styles with `unsafe-inline` would weaken the protection CSP is meant to provide. Add an enforcing policy only after replacing inline handlers/styles with bound modules and documenting the required Firebase, font, and image origins. No CSP workaround is enabled in Hosting or Apache headers.

# Konoha Notes icon inventory — superseded in current icon pass

> **Current implementation:** The initial inventory below describes the earlier Lucide-only audit and is superseded by this update. The actual UI now uses an original project-owned SVG family in `public/assets/images/icons/shinobi.svg` across navigation, homepage cards, authentication, clan/legend areas, profile/settings, Notes, and dynamic feedback.

## Current custom icon family

The sprite contains original `scroll`, `scroll-add`, `archive-scroll`, `search-scroll`, `scroll-save`, `tag-seal`, `seal-pin`, `seal-pin-open`, `chakra`, `chakra-focus`, `shuriken`, `ninja`, `leaf-mark`, `spiral-seal`, `seal-lock`, `kunai-edit`, `seal-settings`, `clan-mark`, `rank-seal`, `flame-seal`, `story-seal`, `seal-check`, and `seal-warning` symbols. Artwork is project-authored and uses a shared 24×24 viewBox, currentColor primary strokes, and selective red detail; no downloaded artwork or new runtime dependency is used. The sprite is loaded using a page-relative URL and inserted inline once, so icon instances reference local symbol fragments instead of relying on cross-file SVG `<use>` rendering.

## Current coverage and retained utilities

- **Navigation:** custom shuriken, scroll, clan, flame, ninja, and settings marks appear in desktop and mobile navigation. The existing logo and kunai menu decoration stay as they are.
- **Home and story content:** custom scroll, tag, pin, chakra, lock, leaf, spiral, clan, and flame symbols cover calls to action, feature cards, and thematic section motifs.
- **Authentication, profile, and settings:** ninja identity, lock, clan, rank, flame, edit, settings, check, and account seals replace generic imagery; Google retains its recognizable provider logo.
- **Notes and editor:** scroll archive/search/empty/error states, tag seals, pin/unpin, focus chakra, save scroll, and kunai edit/read-mode controls use the project sprite. Dynamic note cards, toast feedback, and profile rank selection use the same family.
- **Lucide retained for clarity:** close/back, password visibility and read mode, email, retry, trash, simple status check/cross, and standard editor typography actions. Existing accessible labels and event handlers remain in place.

SVGs are hidden from assistive technology and icon-only buttons keep accessible labels. Existing colors, fonts, layout, responsive breakpoints, backend behavior, and stored note content are unchanged.

Audit scope: the complete single-page interface in `public/index.html`, its visual renderer in `public/assets/js/legacy-ui.js`, and the Firebase feature modules in `public/src/`. There are no separate HTML pages or shared component framework. The app uses vanilla JavaScript and npm. Lucide 1.55.0 is already present in the working tree and its local browser build is `public/assets/js/lucide.min.js` (ISC license). No icon package needs to be installed.

Lucide is the consistent source for functional UI icons. The existing inline Konoha/tomoe logo, kunai mobile-menu artwork, editor empty-state seal, and CSS tomoe are intentional original themed decoration, so they remain. The homepage's narrative text, Japanese text, user note content, and typographic formatting controls are content or typography rather than iconography; they remain untouched. No Naruto character or clan marks are added.

| Page/component | Existing icon or artwork | Purpose | Selected source / name | Size and color | Reason |
| --- | --- | --- | --- | --- | --- |
| Global navigation | Inline tomoe logo; custom kunai menu artwork; Lucide `x` for close | Brand and mobile menu state | Existing original SVG/CSS + Lucide `x` | Logo 28–36px; close 20px; inherit theme color / existing red artwork | Preserve recognizable brand decoration; use a standard close icon. |
| Home hero and calls to action | Lucide `plus`, `clock-3`; text-only section navigation | Begin, scroll, feature navigation | Lucide `plus`, `clock-3`; navigation remains text | 16px; surrounding text color | Semantically clear actions; text labels already provide navigation context. |
| Home feature cards | Lucide `notebook-text`, `tags`, `pin`, `zap`, `lock-keyhole`, `user-round` | Notes, organization, pinning, autosave, privacy, profile | Existing Lucide icons | 32–38px by card style; inherit current text/accent colors | Functional concepts use consistent outline icons without changing card layout. |
| Home history, clans, legends, story cards/modal | CSS tomoe and existing story imagery; Lucide `x` in modal | Theme decoration and closing story details | Existing original artwork + Lucide `x` | Decorative artwork follows current CSS; modal close 18px | Keep existing Naruto-inspired visual identity; standardize the control. |
| Authentication | Lucide `user-round`, `mail`, `lock-keyhole`, `eye`, `check`, `circle-check`, `circle-x`; Google brand SVG | Field meaning, password visibility, feedback, provider identity | Existing Lucide + provider's own brand mark | 13–16px; semantic state colors already defined | UI controls stay consistent; Google brand mark is intentionally not replaced by a generic icon. |
| Profile | Lucide `zap`, `sparkles`, `notebook-text`, `pin`, `flame`, `tags`, `target`, `circle-check`, `mail`, `settings`; generated initials avatar SVG | Rank, stats, activity, account metadata | Existing Lucide + initials avatar | 10–20px per current component; palette variables | Reuse the current semantic icon mappings and retain user initials. |
| Settings | Lucide `mail-check`, `user-round-pen`, `lock-keyhole`, `shield` | Verification, profile, password, account actions | Existing Lucide | 16–18px; inherited text and semantic status colors | Existing icons match each section purpose. |
| Notes archive / dynamic note cards | Lucide `notebook-text`, `pin`, `pin-off`, `trash-2`, `refresh-cw`; new Lucide `x` on each tag removal button | Empty state, pin/unpin, delete, retry, remove tag | Existing and updated Lucide | 12–16px; muted default, red on destructive hover/active state | Dynamic cards use the same icon renderer as static markup; tag removal now uses a labeled button rather than a Unicode multiplication glyph. |
| Notes toolbar and editor | Lucide `menu`, `pin`, `pin-off`, `eye`, `pencil`, `focus`, `save`, `trash-2`, `list`, `quote`, `link`, `minus`; B/I/U, H1–H3, `1.`, `{ }` text controls | Archive, reading/editing, focus, save, delete, formatting | Existing Lucide; conventional text formatting marks retained | 14px toolbar icons; inherit current component color | Text marks communicate exact formatting actions and are established editor affordances, not decorative emoji. |
| Modals, toast, empty/loading/error feedback | Lucide `x`, `notebook-text`, `circle-check`, `circle-x`, `refresh-cw` where rendered | Close, empty state, success/error, retry | Existing Lucide | 12–18px; existing semantic colors | Standardize controls and feedback while preserving current feedback text and behavior. |

## Source and dependency decisions

- **Lucide:** reused from the existing `lucide` 1.55.0 npm dependency and local browser build; no installation command is needed. Upstream vanilla-JavaScript guidance supports the current `data-lucide` approach: https://lucide.dev/guide/lucide.
- **Material Design Icons:** no second runtime package is added. The official MDI catalog has a `ninja` icon, but adding the full `@mdi/js` or webfont distribution only to render a single decorative symbol would duplicate the existing local SVG system. The existing kunai/tomoe artwork already fills that decorative role. MDI's official license information is Apache 2.0 for its icon packages: https://pictogrammers.com/docs/general/license/.
- **SVG Repo:** no downloaded SVG is added. The existing custom tomoe, kunai, chakra seal, and story illustrations already provide selective theme artwork. SVG Repo assigns licenses per asset, so there is no general asset license assumption; its licensing guidance is https://www.svgrepo.com/page/licensing/.

## Dynamic rendering and accessibility

`window.renderLucideIcons(root)` is the shared renderer. Call it after creating or replacing markup that contains `data-lucide`; dynamic note cards already do this. Decorative SVG/icon nodes are `aria-hidden="true"`. Icon-only actions require an accessible label on the button. Tag removal now has a tag-specific `aria-label`, and its icon is decorative.

## Theme and responsive rules

Keep `--void`, `--surf1`, `--surf2`, `--surf3`, `--red`, `--text1`–`--text4`, and `--border` unchanged. Lucide icons inherit `currentColor`; the shared `.ui-icon` uses `1.8` stroke width and component-relative sizing. Existing responsive icon sizing and focus styles remain in place.

# Mail Preferences (General)

- **Screenshots:** 10-15-Catalina-Light-Mail-Preferences.png, 10-15-Catalina-Dark-Mail-Preferences.png
- **Window:** 550 x 541 pt (frame x 112..1211, y 76..1157 px); preferences window with toolbar; title "General"; close enabled, minimize and zoom disabled [M]

Shared measurements: `components/preferences-window.md`, `components/preferences-toolbar.md` (this
window is the primary evidence for the toolbar).

## Layout

| Region | px (light) | Size pt | Light | Dark |
|---|---|---|---|---|
| Title bar + toolbar (8 items) | y 76..231 | 550 x 78 | gradient | dark gradient |
| Content | y 232..1157 | 550 x 463 | `#ececec` | `#303132` |

Content rows (label right edge x 563, control column x 583..1026 = 222 pt, row pitch 31 pt) [M]:

| Row | y px (control top) | Control |
|---|---|---|
| Default email reader: | 273 | pop-up, Mail icon + "Mail" |
| Check for new messages: | 335 | pop-up "Automatically" |
| New messages sound: | 397 | pop-up "New Messages Sound" |
| (indented under the pop-up) | 454 | checkbox (on) "Play sounds for other mail actions" at x 582 |
| Dock unread count: | 523 | pop-up "Inbox Only" |
| New message notifications: | 585 | pop-up "Inbox Only" |
| Downloads folder: | 647 | narrow pop-up (x 583..820, 119 pt), folder icon + "Downloads" |
| Remove unedited downloads: | 709 | pop-up "After Message is Deleted" |
| checkbox group at x 192 (40 pt from the left edge), 20 pt pitch | 782, 822, 862, 902 | "Archive or delete muted messages" (off), "Add invitations to Calendar automatically" (off), "Automatically try sending later if outgoing server is unavailable" (off), "Prefer opening messages in split view when in full screen" (on) |
| label | 968 | "When searching all mailboxes, include results from:" at x 193 |
| checkbox group indented to x 228 (58 pt), 20 pt pitch | 1010, 1050, 1090 | "Trash" (on), "Junk" (off), "Encrypted Messages" (off) |
| Help button | 1085 | x 1139..1178 |

## Components used

`preferences-window`, `preferences-toolbar`, `pop-up-button` (with and without icon), `checkbox`,
`label`, `help-button`, `window-controls`, `title-bar`.

## App-specific elements

Toolbar icons: General, Accounts, Junk Mail (bin with x), Fonts & Colors (colour wheel with "A"),
Viewing (glasses over an envelope), Composing (pencil on paper), Signatures (signature), Rules
(envelope with arrows).

## Content in the screenshot

As listed. Toolbar labels: "General", "Accounts", "Junk Mail", "Fonts & Colors", "Viewing", "Composing",
"Signatures", "Rules".

## Not reproducible / assets needed

Eight toolbar icons (32 pt), Mail app icon and Downloads folder icon (16 pt).

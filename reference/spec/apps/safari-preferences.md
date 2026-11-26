# Safari 13 Preferences (General)

- **Screenshots:** 10-15-Catalina-Light-Safari-v13-Preferences.png, 10-15-Catalina-Dark-Safari-v13-Preferences.png
- **Window:** 774 x 508 pt (frame x 112..1659, y 76..1091 px); preferences window with a 10-item toolbar; title "General"; close enabled, minimize and zoom disabled [M]

Shared measurements: `components/preferences-window.md`, `components/preferences-toolbar.md`.

## Layout

| Region | px (light) | Size pt | Light | Dark |
|---|---|---|---|---|
| Title bar + toolbar | y 76..231 | 774 x 78 | gradient | dark gradient |
| Content | y 232..1091 | 774 x 430 | `#ececec` | `#2f3031` |

Content rows (label right edge x 757, control column x 777..1354 = 289 pt, row pitch 30 pt) [M]:

| Row | y px (control top) | Control |
|---|---|---|
| Safari opens with: | 269 | pop-up "A new window" |
| New windows open with: | 329 | pop-up "Favorites" |
| New tabs open with: | 389 | pop-up "Favorites" |
| Homepage: | 449 | text field (focused, focus ring, all text selected in light; caret only in dark) "https://www.apple.com/startpage/" |
| (button) | 511 | "Set to Current Page" push button x 777..1070 (147 pt); disabled in the dark capture |
| Remove history items: | 599 | pop-up "After one year" (44 pt group gap above) |
| Favorites shows: | 659 | pop-up, star glyph + "Favorites" |
| Top Sites shows: | 719 | pop-up "12 sites" |
| File download location: | 807 | pop-up, folder icon + "Downloads" |
| Remove download list items: | 867 | pop-up "After one day" |
| checkbox (on) | 936 | `Open "safe" files after downloading` at x 776 |
| small text, 3 lines, 11 pt, x 813 | 981, 1009, 1037 | `"Safe" files include movies, pictures, sounds, PDF and text documents, and archives.` |
| Help button | 1019 | x 1585..1624 |

## Components used

`preferences-window`, `preferences-toolbar`, `pop-up-button`, `text-field`, `focus-ring`,
`highlight-color` (selected text), `push-button` (normal and disabled), `checkbox`, `label`,
`help-button`.

## App-specific elements

Toolbar icons: General, Tabs, AutoFill (pencil on a form), Passwords (key), Search (magnifier),
Security (padlock on hazard stripes), Privacy (hand in a blue disc), Websites (globe), Extensions
(puzzle piece), Advanced (gear).

## Content in the screenshot

As listed. Toolbar labels: "General", "Tabs", "AutoFill", "Passwords", "Search", "Security", "Privacy",
"Websites", "Extensions", "Advanced".

## Not reproducible / assets needed

Ten toolbar icons (32 pt), Downloads folder icon (16 pt), star glyph.

# Music Preferences (General)

- **Screenshots:** 10-15-Catalina-Light-Music-Preferences.png, 10-15-Catalina-Dark-Music-Preferences.png
- **Window:** 533 x 292 pt (frame x 112..1177, y 76..659 px); app-modal dialog with a centred preferences toolbar, **no window controls**, title "General"; OK / Cancel row [M]

Shared measurements: `components/preferences-window.md`, `components/preferences-toolbar.md`,
`components/dialog.md` (button row).

## Layout

| Region | px (light) | Size pt | Light | Dark |
|---|---|---|---|---|
| Title bar + toolbar (General, Playback, Files, Restrictions, Advanced; centred) | y 76..231 | 533 x 78 | gradient | dark gradient |
| Options | y 232..539 | 533 x 154 | `#ececec` | dark window grey |
| Separator (full width) | y 540..541 | 1 | `#d5d5d5` | dark separator |
| Button row | y 542..659 | 533 x 59 | `#ececec` | dark window grey |

Rows [M]: label "Show:" right-aligned ending x ~453 with three checkboxes at x 472 (y 276 "iTunes
Store" on, 324 "Star ratings" off, 368 "Songs list checkboxes" off; 22..24 pt pitch); "List Size:"
with a narrow pop-up "Medium" (x 473..633, 80 pt) at y 413; separator inset (x 152..1137) at y 470;
"Notifications:" with checkbox "When song changes" (on) at y 492. Button row: help button x 153..192,
Cancel x 835..972, OK (default) x 999..1136, all at y 579..618.

## Components used

`preferences-window` (modal kind), `preferences-toolbar` (centred), `dialog`, `checkbox`,
`pop-up-button`, `label`, `separator`, `help-button`, `push-button`, `default-button`.

## App-specific elements

Toolbar icons: General (light switch), Playback (play triangle in a white disc), Files (blue folder),
Restrictions (yellow parental-controls disc), Advanced (gear).

## Content in the screenshot

Title "General"; toolbar labels "General", "Playback", "Files", "Restrictions", "Advanced"; "Show:",
"iTunes Store", "Star ratings", "Songs list checkboxes", "List Size:", "Medium", "Notifications:",
"When song changes"; buttons "?", "Cancel", "OK".

## Not reproducible / assets needed

Five toolbar icons (32 pt).

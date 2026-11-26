# TV Preferences (General)

- **Screenshots:** 10-15-Catalina-Light-TV-Preferences.png, 10-15-Catalina-Dark-TV-Preferences.png
- **Window:** 640 x 360 pt (frame x 112..1391, y 76..795 px); app-modal dialog with a centred preferences toolbar, no window controls, title "General"; OK / Cancel row [M]

Shared measurements: `components/preferences-window.md`, `components/preferences-toolbar.md`,
`components/dialog.md`.

## Layout

| Region | px (light) | Size pt | Light | Dark |
|---|---|---|---|---|
| Title bar + toolbar (General, Playback, Files, Restrictions, Advanced; centred) | y 76..231 | 640 x 78 | gradient | dark gradient |
| Options | y 232..675 | 640 x 222 | `#ececec` | dark window grey |
| Separator (full width) | y 676..677 | 1 | `#d5d5d5` | dark separator |
| Button row | y 678..795 | 640 x 59 | `#ececec` | dark window grey |

Rows [M: lay boxes of 10-15-Catalina-Light-TV-Preferences.png]: control column x 512 (200 pt from the
left edge):

| y px | Element |
|---|---|
| 272 | checkbox (on) "Always check for available downloads" |
| 322 | label "Automatic Downloads" (13 pt) |
| 369, 397 | 11 pt text, 2 lines: "Automatically download TV shows and movies you add to your Library and purchases you make on other devices" |
| 436 | disabled checkboxes "Movies" (x 512) and "TV Shows" (x 734), text `#b1b1b1` |
| 508..509 | separator inset (x 152..1351) |
| 528 | "Show:" label + checkbox (off) "Checkboxes in library" |
| 579 | 11 pt text "Only checked items will be automatically synced" |
| 619 | "List Size:" + narrow pop-up "Medium" (x 513..673, 80 pt) |
| 715..754 | help button x 153..192; Cancel x 1049..1186; OK (default) x 1213..1350 |

## Components used

`preferences-window` (modal kind), `preferences-toolbar` (centred), `dialog`, `checkbox` (on, off,
disabled), `pop-up-button`, `label` (regular, small, disabled), `separator`, `help-button`,
`push-button`, `default-button`.

## App-specific elements

Toolbar icons as in Music Preferences.

## Content in the screenshot

As listed; buttons "?", "Cancel", "OK".

## Not reproducible / assets needed

Five toolbar icons (32 pt).

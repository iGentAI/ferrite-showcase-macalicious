# Force Quit Applications

- **Screenshots:** 10-15-Catalina-Light-Force-Quit.png, 10-15-Catalina-Dark-Force-Quit.png
- **Window:** 338 x 307 pt (frame x 112..787, y 76..689 px); standard title bar, title "Force Quit Applications"; close and zoom enabled, minimize disabled; floats above all apps [M]

## Layout

| Region | px (light) | Size pt | Light | Dark | Evidence |
|---|---|---|---|---|---|
| Title bar | y 76..119 | 338 x 22 | gradient | dark gradient | [M] col 152 |
| Instruction text (2 lines, 13 pt) | x 153, y 166..222 (first line box y 166..190) | 20.5 pt left margin | `#242424` on `#ececec` | light text on `#313437 (sRGB #303437)` | [M] @ 154,166,563,25 |
| App list (bordered) | x 152..747, y 240..575 | 298 x 168 | border `#c5c5c5`, fill `#ffffff` | border `#565656`, fill `#1f2225 (sRGB #1e2225)` | [M] 10-15-Catalina-Light-Force-Quit.png @ 152,400 `#c5c5c6`, @ 400,400 `#ffffff`; 10-15-Catalina-Dark-Force-Quit.png @ 152,400 `#565656`, @ 400,400 `#1f2225 (sRGB #1e2225)` |
| - rows | 21 pt each from y 242: 242..283 (selected), 284..325, 326..367 | | selected `#2365d9 (sRGB #0062e1)`, text white | selected `#1e5ac8 (sRGB #0057cf)` | [M] @ 400,262 |
| - row content | 16 pt app icon at x 160..199, name at x 210, 13 pt | `#272727` | white | [M] @ 209,294,67,21 |
| Hint text (2 lines, 11 pt) | x 153, y 608..653 | | `#242424` | light | [M] @ 152,608,366,46 |
| Force Quit (default button) | x 565..746, y 608..647 | 91 x 20 | accent | accent | [M] row 630, col 660 |
| Margins | list sides 20 pt; right of button 20.5 pt; bottom 20 pt | | | | [M] |

```
+ (o)(-)(o)   Force Quit Applications  +
| If an app doesn't respond for a      |
| while, select its name and click ... |
| +----------------------------------+ |
| | [icon] Mail            (selected)| |
| | [icon] Safari                    | |
| | [icon] Finder                    | |
| |                                  | |
| +----------------------------------+ |
| You can open this window  [Force Quit]|
+--------------------------------------+
```

## Components used

`dialog` (modeless system window), `title-bar`, `window-controls`, `label`, `table-view` (single column,
no header, no alternating rows), `highlight-color` (emphasised row), `default-button`, `scroll-view`.

## App-specific elements

None beyond the list. The dark window background `#313437 (sRGB #303437)` is a tinted dark grey (desktop tinting).

## Content in the screenshot

- Text: "If an app doesn't respond for a while, select its name and click Force Quit."
- Rows: "Mail" (selected), "Safari", "Finder" with their app icons.
- Hint: "You can open this window by pressing Command-Option-Escape."
- Button: "Force Quit" (default). When Finder is selected the button reads "Relaunch" [D/I].

## Not reproducible / assets needed

Mail, Safari and Finder icons at 16 pt.

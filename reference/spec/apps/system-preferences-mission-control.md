# System Preferences — Mission Control

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Mission-Control.png`; `10-15-Catalina-Dark-System-Preferences-Mission-Control.png` [M].
- **Window:** 668 × 480 pt, both appearances [M], opaque frame `@ 112,76,1336,960`. Title “Mission Control” [M]. Unified shell reuses `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` [I: shared navigation arrangement].
- **State:** same settings/content in both [M]: automatic Space rearrangement on, switching Space on, application grouping off, separate display Spaces on. Shortcuts are Control-Up, Control-Down and F11 [M].

## Layout

```text
+ navigation / Mission Control / Search -------------+
| [icon] Mission Control gives you an overview ...    |
| + settings ---------------------------------------+|
| | ☑ Automatically rearrange Spaces ...             ||
| | ☑ When switching to an application ...           ||
| | □ Group windows by application                  ||
| | ☑ Displays have separate Spaces                 ||
| +-------------------------------------------------+|
| Keyboard and Mouse Shortcuts                       |
| +-------------------------------------------------+|
| | With a single keystroke ...                      ||
| |      Mission Control: [⌃↑        ↕]              ||
| | Application windows: [⌃↓        ↕]              ||
| |        Show Desktop: [F11       ↕]              ||
| |       (for additional choices ...)              ||
| +-------------------------------------------------+|
| [Hot Corners...]                              (?)  |
+----------------------------------------------------+
```

Positions are window-relative pt [C: subtract 112,76 and divide image px by 2]. Stored colour samples [M].

| Region | Rect (x,y,w,h) pt [M] | Light / dark fill [M] | Evidence |
|---|---|---|---|
| Pane/header/footer | (0,38,668,442) | #ececec / #303031 | both named screenshots `@ 112,152,1336,884`; samples `10-15-Catalina-Light-System-Preferences-Mission-Control.png @ 120,180`, `10-15-Catalina-Dark-System-Preferences-Mission-Control.png @ 120,180` |
| Space settings group | (20,117,628,118) | #e3e3e3 / #363637 | both `@ 152,310,1256,236`; fill `@ 200,330`; column x=160 gives y=310..545 |
| Shortcut group | (20,263,628,166) | #e3e3e3 / #363637 | both `@ 152,602,1256,332`; fill `@ 160,620`; column x=160 gives y=602..933 |

Use `box` tabless geometry/edge recipe for both groups [I: matching visual treatment]; no tab strip or sidebar is present [M].

### Layout grid

Outer group margins 20 pt [M]. Checkbox column x=36 pt, first glyph x=54.5–55 pt [M]. Checkbox row pitches 27.5,27.5,26 pt [C: image tops 334,389,444,496]. Shortcut label right edge x=209 pt; popup left x=218.5 pt, gap 9.5 pt [C]. Popup pitch 28 pt [C: image tops 701,757,813]. Shortcut description and group heading begin x=36.5 and 32 pt respectively [M]. Hot Corners footer starts x=20.5 pt and y=439.5 pt; help starts x=628 pt, y=441 pt [M]. Footer button bottom margin 20.5 pt and help bottom margin 19 pt [C]. No lock [M].

## Components used

`image-view`, `label`, `box`, `checkbox`, `pop-up-button`, `push-button`, `help-button`, shared chrome [M].

### Complete control and label table

All rects are pt [M]; labels use visible ink bounds; `b` is the raster baseline excluding descenders [M]. R=13 pt regular, S=11 pt regular [C from measured 18/16 image-px capitals, CONVENTIONS]. Every row cites `10-15-Catalina-Light-System-Preferences-Mission-Control.png @ (112+2x),(76+2y),(2w),(2h)`; the corresponding dark screenshot confirms positions [M]. Dark painted popup/push-button edges are inset 0.5 pt relative to the light bezel [M].

| Component / variant / state | Rect (x,y,w,h); ink / b | Exact visible text |
|---|---|---|
| image-view / Mission Control icon | (23,59.5,46,39.5) | — |
| label / R line one | (81,63,530,12.5); b=72 | Mission Control gives you an overview of all your open windows, thumbnails of your full- |
| label / R line two | (80.5,79,298.5,12.5); b=88 | screen applications, all arranged in a unified view. |
| checkbox / regular on | (36,129,14,14); ink (54.5,131,351.5,12.5), b=140 | Automatically rearrange Spaces based on most recent use |
| checkbox / regular on | (36,156.5,14,14); ink (54.5,158.5,545,12.5), b=167.5 | When switching to an application, switch to a Space with open windows for the application |
| checkbox / regular off | (36,184,14,14); ink (54.5,186,180,12.5), b=195 | Group windows by application |
| checkbox / regular on | (36,210,14,14); ink (55,212,185.5,12.5), b=221 | Displays have separate Spaces |
| label / S group heading | (32,252,163.5,10); b=259.5 | Keyboard and Mouse Shortcuts |
| label / S line one | (36.5,276.5,586.5,10.5); b=284 | With a single keystroke, view all open windows, windows of the current application, or hide windows to locate an |
| label / S line two | (36.5,290.5,241,10.5); b=298 | item on the desktop that might be covered up. |
| label / R right-aligned | (113,317.5,96,10); b=327 | Mission Control: |
| pop-up-button / regular normal | light (218.5,312.5,161,20), dark (219,313,160,19); glyphs (228,317.5,19,9.5), b=326.5 | ⌃↑ |
| label / R right-aligned | (82.5,345,126,12.5); b=354 | Application windows: |
| pop-up-button / regular normal | light (218.5,340.5,161,20), dark (219,341,160,19); glyphs (228,345.5,19,9.5), b=354.5 | ⌃↓ |
| label / R right-aligned | (119.5,374,89.5,12); b=383 | Show Desktop: |
| pop-up-button / regular normal | light (218.5,368.5,161,20), dark (219,369,160,19); ink (228,373.5,16.5,9.5), b=382.5 | F11 |
| label / S centered hint | (164.5,408.5,339,10.5); b=416 | (for additional choices press Shift, Control, Option, or Command) |
| push-button / regular normal | (20.5,439.5,111,20); ink (35,444.5,82,9.5), b=453.5 | Hot Corners... |
| help-button / normal | (628,441,20,20) | ? |

Popup evidence: light row `@ 549,704,322,1`, column x=555 y=701..740; dark row `@ 550,704,320,1`, column x=555 y=702..739 [M]. Help light evidence `@ 1368,958,42,42`, dark painted disc `@ 1370,960,38,38` [M]. Checkbox column x=185 spans the four settings and confirms each boundary [M].

## App-specific elements

Mission Control pane icon is a miniature black-framed multiwindow display [M], both `@ 158,195,92,79`. It is separate from the `mission-control` overview surface component [I: this pane configures that surface, it does not render it]. Shortcut strings use the Control modifier symbol “⌃”, not a circumflex text substitute [M]. The popups show shortcut choices, not keycap controls [M].

## Content in the screenshot

All copy and current values are transcribed above [M]. There is a visible hyphen at the first description line ending “full-”; preserve that line break [M]. Hot Corners dialog, shortcut menus, disabled states, keyboard-focus, pressed and inactive-window states are not shown [M].

## Not reproducible / assets needed

Needs the pane’s Mission Control icon asset [I]. System-wide window/Space management and shortcut interception are not reproducible within a normal web page [I]; only the captured settings UI is specified. Native SF glyph widths/rasterization vary on non-Apple hosts [I].

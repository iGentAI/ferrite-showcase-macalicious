# Alert (`alert`)

- **Status:** present
- **AppKit:** `NSAlert` (`messageText`, `informativeText`, `icon`, `addButton(withTitle:)`, `showsSuppressionButton`, `showsHelp`, `alertStyle` `.warning`/`.informational`/`.critical`, `accessoryView`), run app-modal with `runModal()` or as a sheet with `beginSheetModal(for:)`
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/alerts/
- **Appearances shown:** light, dark

## Purpose and behaviour

An alert warns about an error or a hazardous consequence. It is modal within the app unless it relates
to one document or window, in which case it is shown as a sheet. It always has a message (short
summary), usually informative text, up to three buttons of which one may be the default, the app icon
(optionally badged with a caution symbol), an optional suppression checkbox, optional accessory view
and optional Help button. The HIG asks for alerts to be rare, for the message to be a clear statement
or question, and for button titles to be verbs that name the action; the default button is the
rightmost, Cancel sits to its left (HIG Alerts) [D].

## Anatomy

```
+--------------------------------------------------------------+  <- 22 pt title bar, no title, no window controls
|--------------------------------------------------------------|
|        +------+   Message text (bold 13 pt, wraps)           |
|  24 pt | icon |   second line of message                     |
|        | 64pt |   Informative text (regular 11 pt)           |
|        +------+                                              |
|                              [  Cancel  ]  [ Default action ]|
+--------------------------------------------------------------+
```

Drawing order: window frame and shadow (see `window`, `window-shadow`), title bar gradient, content
background, icon, message, informative text, optional suppression checkbox, button row.

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| presentation | app-modal window, sheet | window | `runModal()` / `beginSheetModal` | window (Empty Trash) |
| style | warning, informational, critical | warning | `alertStyle` | warning; a caution badge on the icon appears in Finder's Replace dialog (not an `NSAlert`, see `apps/finder-dialogs.md`) |
| buttons | 1 to 3 | "OK" | `addButton(withTitle:)` | 2 |
| informative text | optional | none | `informativeText` | yes |
| suppression checkbox | optional | off | `showsSuppressionButton` | not shown |
| help button | optional | off | `showsHelp` | not shown |
| accessory view | optional | none | `accessoryView` | not shown |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| Key window, default button with accent | yes | 10-15-Catalina-Light-Finder-Empty-Trash.png, 10-15-Catalina-Dark-Finder-Empty-Trash.png |
| Inactive (another app in front) | no | [I] default button loses the accent and draws like a normal push button; title bar uses the inactive gradient from `title-bar` |
| As a sheet | no | [I] same content layout, no title bar; the sheet rules in `sheet` apply |
| With suppression checkbox | no | [D/I] a small-size checkbox ("Do not show this message again") under the informative text, left-aligned with the text column, 8 pt below it |
| Critical (caution badge) | no in NSAlert | [I] 32 pt caution triangle over the icon's lower-right quadrant |

## Measurements

All from the Empty Trash alert. Frame: opaque x 112..951, y 76..377 px = **420 x 151 pt** in both
appearances [M: `info`].

### Geometry (pt)

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Window width | 420 pt (fixed NSAlert width for a 2-line message) | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png frame x 112..951 |
| Title bar | 22 pt tall (y 76..119), empty: no title, no close/minimize/zoom | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png col 530: gradient 76..117, separator rows 118 and 119 |
| Content area | 129 pt tall (y 120..377) | [M] | same |
| Icon artwork bounds | 46 x 60.5 pt (92 x 121 px) at x 178..269, y 155..275 | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 178,155,92,121 (Trash icon; the art is narrower than its canvas) |
| Icon canvas | 64 x 64 pt at 24 pt from the left edge, 15.5 pt below the title bar (px 160..287, 151..278) | [C] | centred on the measured artwork (centre x 223.5, y 215); 24 + 64 + 18 = 106 pt reproduces the measured text left edge |
| Text column left edge | 106 pt from the window's left edge (px 324 - 112 = 212) | [M] | message and informative text both start at x 324 |
| Text column right limit | 20 pt from the right edge [C]; the longest measured line ends at x 890 (30.5 pt from the edge) | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 324,158,567,53 |
| Message first baseline | 51 pt below the window top (px 177 - 76 = 101; 29 pt below the title bar) | [M] | cap of "A" y 159..177 |
| Message line pitch | 16 pt (baselines y 177 and 209) | [M] | same |
| Gap message last baseline -> informative first baseline | 22 pt (y 209 -> 253) | [M] | "Y" of "You" y 238..253 |
| Button row top | 112.5 pt below the window top (px 301 - 76) ; 24 pt below the informative baseline (253 -> 301) | [M] | buttons y 301..340 |
| Button height | 20 pt between top and bottom edge rows (y 301..340) + 1 pt shadow below | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png col 560 |
| Cancel button width | 83 pt (x 489..654) | [M] | row 320 |
| Default button width | 113 pt (x 685..910): title width + 2 x 19.5 pt (title x 724..871) | [M] | row 320 |
| Gap between buttons | 15 pt (px 655..684) | [M] | row 320 |
| Right margin (default button edge -> window edge) | 20.5 pt (px 910 -> 951) | [M] | row 320 |
| Bottom margin (button bottom edge -> window edge) | 18.5 pt (px 340 -> 377) | [M] | col 560 |

Window height rule [C]: 22 (title bar) + 29 (to first baseline) + 16 x (message lines - 1) + 22 +
14 x (informative lines - 1) + 24 (to buttons) + 20 (buttons) + 18.5 (bottom) = 151.5 for 2 + 1 lines,
matching the measured 151 pt. Width is fixed; the alert grows downward. Informative line pitch 14 pt is
[I] (single line shown; 11 pt system text sets at 14 pt).

### Colours and fills

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Content background | `#ececec` | `#303031` | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 530,200 `#ececec`; 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 530,200 `#303031` |
| Title bar, top highlight row | `#f5f5f5` | `#878787` | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 530,76 `#f5f5f5`; 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 530,76 `#878787` |
| Title bar, mid | `#d8d8d8` | `#3c3c3d` | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 530,100 `#d8d8d8`; 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 530,100 `#3c3c3d` |
| Title bar gradient | `#e5e5e5` (y 78) -> `#cdcdcd` (y 117) | `#424243` (y 78) -> `#363637` (y 117) | [M] | col 530 of the two files |
| Title bar bottom lines (2 px) | `#bebebe` then `#a8a8a8` | `#2b2c2c` then `#000000` | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 530,118 `#bebebe`, @ 530,119 `#a8a8a8`; 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 530,118 `#2b2c2c`, @ 530,119 `#000000` |
| Push button (Cancel) fill | `#ffffff` | `#646465` | [M] | row 320 of each file, x 490..653 |
| Push button edges | top `#c8c8c8`, sides `#c1c1c1`, bottom `#aeaeae`, shadow `#d0d0d0`/`#e3e3e3` | top highlight `#838383`, outer `#2c2c2d`/`#2a2a2b`/`#262627` | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 560,301 `#c8c8c8`, @ 489,320 `#c1c1c1`, @ 560,340 `#aeaeae`, @ 560,341 `#d0d0d0`, @ 560,342 `#e3e3e3`; 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 560,301 `#2c2c2d`, @ 489,320 `#2a2a2b`, @ 560,340 `#262627` |
| Default button | accent gradient, see `accent-colors` "Default button" | same | [M] | col 800 of each file |

### Text and icons

| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Message text | SF Pro Text Bold 13 pt [C: cap 19 px, x-height 15 px, stem 4 px], `#242424`, left-aligned, wraps at the text column | same, `#dfdfdf` | [M] colour, [C] size | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 325,159,17,19 ("A"); Dark same rectangle |
| Informative text | SF Pro Text Regular 11 pt [C: cap 16 px, x-height 12 px, stem 2 px], `#242424` | same, `#dfdfdf` | [M], [C] | @ 325,238,24,16 ("Y") in both files |
| Button title | SF Pro Text Regular 13 pt [C: cap 19 px incl. overshoot of "C"], `#262626`; default button `#ffffff` | `#e8e8e8`; default `#e0e8f8 (sRGB #dee8fa)` | [M], [C] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 531,311,16,19; row 320 |
| Button title baseline | 14 pt below the button's top edge (px 329 - 301) | same | [M] | same |
| Icon | the app's or subject's 64 pt icon (here the full Trash), unbadged | dark-appearance Trash artwork | [M] | @ 178,155,92,121 |

### Shadows and effects

Standard key-window shadow (shadow margins in the capture: 112 px left/right, 76 px top, 148 px bottom;
see `window-shadow`). The dark alert has the dark window's 1 pt (2 px, x 112..113 and 950..951) inner light rim (`#59595a`, 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 112,230,2,1) and a 1 px black outer line at alpha 0.965 (x 111 and 952) [M].

## Layout and spacing

- Buttons are right-aligned in creation order from the right: default (first) button rightmost, second
  to its left, a third button is separated and placed at the left of the button row, aligned with the
  text column [D: HIG Alerts; NSAlert].
- Buttons size to their titles with a minimum of 83 pt (Cancel measures exactly 83 pt and matches the
  83 pt "Cancel"/"Go" buttons of other Finder dialogs) [M/C].
- Message and informative text share the left edge at 106 pt.

## Keyboard and accessibility

Return activates the default button; Escape (and Command-period) activates Cancel; with full keyboard
access Tab moves between buttons and Space presses the focused one; a button titled "Don't Save" gets
Command-D [D: HIG Alerts, AppKit `NSAlert`]. AppKit exposes the alert as a dialog window (AXWindow,
subrole AXDialog) whose static texts are the message and informative text. ARIA: `role="alertdialog"`,
`aria-modal="true"`, `aria-labelledby` = message, `aria-describedby` = informative text; focus starts
on the default button (or Cancel for destructive defaults) and is trapped inside.

## Browser notes

- The window shadow and title-bar gradient come from `window`; nothing alert-specific is hard.
- The default button's accent gradient animates ("pulses") in older macOS but is static in 10.15; no
  animation is needed.
- App-modal behaviour: cover the app with an invisible click blocker; macOS does not dim other windows.

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Finder-Empty-Trash.png | 112,76,840,302 | complete alert, 2-line message, informative text, Cancel + default |
| dark | 10-15-Catalina-Dark-Finder-Empty-Trash.png | 112,76,840,302 | same, dark |
| light | 10-15-Catalina-Light-Finder-Copy-Replace.png | 112,76,798,200 | Finder's compact three-button conflict dialog with caution badge (related, small controls) |
| dark | 10-15-Catalina-Dark-Finder-Copy-Replace.png | 112,76,798,200 | same, dark |

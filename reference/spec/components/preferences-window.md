# Preferences window (`preferences-window`)

- **Status:** present (Calendar, Mail, Music, Podcasts, Safari, TV; light and dark)
- **AppKit:** `NSWindow` (`styleMask` `.titled`, `.closable`, usually `.miniaturizable`; not resizable) + `NSToolbar` with selectable items (see `preferences-toolbar`); often an `NSTabViewController` with `tabStyle = .toolbar`
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/app-architecture/preferences/
- **Appearances shown:** light, dark

## Purpose and behaviour

App-level settings opened with Command-comma from the app menu. The HIG calls for a modeless,
non-resizable window with the minimize and zoom buttons disabled, a non-customisable toolbar that
switches panes, the window title set to the current pane, changes applied immediately (no OK/Cancel),
and the last viewed pane restored on reopening (HIG Preferences) [D]. Music and TV in 10.15 are
exceptions carried over from iTunes: an app-modal dialog with no window controls and an OK/Cancel row.

## Anatomy

```
+ title bar 22 pt: window controls, title = pane name (centred) +
+ toolbar 56 pt: pane items (see preferences-toolbar)            +
+================================================================+
|   right-aligned labels :  [controls column]                   |
|   ------------------ separator ---------------------          |
|   [x] checkbox rows                                        (?) |
+----------------------------------------------------------------+
```

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| kind | modeless window (apply immediately); modal dialog with OK/Cancel | modeless | - | modeless: Calendar, Mail, Podcasts, Safari; modal: Music, TV |
| help button | bottom-right; bottom-left (modal kind); none | - | `NSButton` `.helpButton` | all three |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| Key window | yes | all 12 captures |
| Inactive | no | [I] see `title-bar` and `toolbar` inactive rules |
| Window controls | yes | close enabled; minimize and zoom drawn disabled (grey) in Calendar, Mail, Safari; Podcasts shows zoom enabled (10-15-Catalina-Light-Podcasts-Preferences.png @ 128,86,104,24); Music/TV have none |

## Measurements

### Geometry (pt)

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Window widths (frames) | Calendar 537, Mail 550, Music 533, Podcasts 383, Safari 774, TV 640 | [M] | `info` on the six light files |
| Window heights (frames, General pane) | Calendar 542, Mail 541, Music 292, Podcasts 176, Safari 508, TV 360 | [M] | same |
| Title bar + toolbar | 78 pt | [M] | 10-15-Catalina-Light-Mail-Preferences.png col 400 |
| Content top margin (toolbar line -> first control edge) | 20.5 pt (Calendar, Mail: y 232 -> 273); 18.5 pt (Safari: -> 269); 25.5 pt (Podcasts: -> 283) | [M] | first pop-up top edge in each file |
| Form row pitch | 30 pt (Calendar: pop-up tops y 273, 333, 393, 453; Safari: 269, 329, 389); 31 pt (Mail: 273, 335, 397) | [M] | 10-15-Catalina-Light-Calendar-Preferences.png col 800; 10-15-Catalina-Light-Mail-Preferences.png col 800 |
| Pop-up button height | 20 pt (38 px fill + 2 edge rows) + 1 pt shadow | [M] | 10-15-Catalina-Light-Calendar-Preferences.png col 800: 274..311 fill |
| Label -> control gap | 9.5 pt (Calendar: label ends x 594, pop-up edge 614; Mail: 563 -> 583; Safari: 757 -> 777) | [M] | 10-15-Catalina-Light-Calendar-Preferences.png @ 544,287,51,20; row 293 |
| Control column x | Calendar 251 pt from the left frame edge (x 614), width 180 pt (x 614..973); Mail 235.5 pt (x 583), width 222 pt (x 583..1026); Safari 332.5 pt (x 777), width 289 pt (x 777..1354) | [M] | row 293 (Calendar, Mail) and row 289 (Safari) of the light files |
| Section separator | 1 pt (2 px) line, inset 36 pt each side in Calendar (x 184..1113 in a frame 112..1185) | [M] | 10-15-Catalina-Light-Calendar-Preferences.png @ 184,534,930,2 |
| Space around a separator | 20.5 pt above (control bottom 493 -> 534) and 21 pt below (536 -> 577) | [M] | same, col 800 |
| Checkbox row pitch | 20 pt (Calendar: y 936, 976; Mail: 782, 822, 862, 902) | [M] | lay boxes of the two files |
| Help button | 20 pt circle; right margin 20.5 pt, bottom margin 19.5..20 pt (Calendar: x 1105..1144, y 1079..1118, frame ends 1185/1159) | [M] | 10-15-Catalina-Light-Calendar-Preferences.png @ 1105,1079,40,41 |
| Bottom margin under the last control | 20 pt | [M] | same |

### Colours and fills

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Content background | `#ececec` | `#303132` | [M] | 10-15-Catalina-Light-Mail-Preferences.png @ 1100,260 `#ececec`; 10-15-Catalina-Dark-Mail-Preferences.png @ 1100,260 `#303132` |
| Separator | `#d5d5d5` | `#444446` | [M] | 10-15-Catalina-Light-Calendar-Preferences.png @ 600,534 `#d5d5d5`; 10-15-Catalina-Dark-Calendar-Preferences.png @ 600,534 `#444446` |

### Text and icons

| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Form labels | SF Pro Text Regular 13 pt, right-aligned, colon-terminated, `#242424` | `#dfdfdf`-class | [M] colour (lay extreme), [C] size | 10-15-Catalina-Light-Calendar-Preferences.png @ 339,273,260,41 |
| Checkbox titles | 13 pt, `#232323` | same class | [M] | @ 184,936,336,29 |
| Small explanatory text | 11 pt, `#242424` (Safari ""Safe" files include ..."), 14 pt line pitch (y 981, 1009, 1037) | - | [M] | 10-15-Catalina-Light-Safari-v13-Preferences.png @ 813,981,396,74 |

### Shadows and effects

Standard window shadow.

## Layout and spacing

- One label column, right-aligned to a common x; controls left-aligned on a second common x; the pair
  is centred in the window as a block rather than pinned to the margins.
- Groups are separated by a 1 pt separator with about 20 pt of space on each side, or by 14..18 pt of
  extra space (Safari).
- When the pane changes, the window keeps its top-left corner and animates its height (and width, if
  panes differ) [D].

## Keyboard and accessibility

Command-comma opens, Command-W closes, Escape closes only the modal kind (Cancel). AX: standard
AXWindow; the title announces the pane. ARIA: see `preferences-toolbar` (tabs) with a labelled form in
the tab panel.

## Browser notes

Animating window height between panes needs explicit height measurement (FLIP); CSS cannot transition
`height: auto`.

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Calendar-Preferences.png | 112,76,1074,1084 | modeless, label/control columns, separators, help at bottom right |
| dark | 10-15-Catalina-Dark-Calendar-Preferences.png | 112,76,1074,1084 | same, dark |
| light | 10-15-Catalina-Light-TV-Preferences.png | 112,76,1280,720 | modal kind with ? / Cancel / OK |
| dark | 10-15-Catalina-Dark-TV-Preferences.png | 112,76,1280,720 | same, dark |
| light | 10-15-Catalina-Light-Safari-v13-Preferences.png | 112,76,1548,1016 | widest toolbar, focused text field |
| light | 10-15-Catalina-Light-Podcasts-Preferences.png | 112,76,766,352 | smallest pane |

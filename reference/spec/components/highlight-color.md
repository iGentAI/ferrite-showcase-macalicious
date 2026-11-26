# Highlight / selection colour (`highlight-color`)

- **Status:** present
- **AppKit:** `NSColor.selectedTextBackgroundColor`, `NSColor.selectedContentBackgroundColor` (10.14+), `NSColor.unemphasizedSelectedContentBackgroundColor` (10.14+), `NSColor.unemphasizedSelectedTextBackgroundColor` (10.14+), `NSColor.selectedTextColor`, `NSColor.alternateSelectedControlTextColor`; user default `AppleHighlightColor` [D]
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/visual-design/color/
- **Appearances shown:** light, dark

## Purpose and behaviour

"Highlight color" in System Preferences > General sets the background of selected text. It follows the
accent automatically (choosing an accent switches the pop-up to the preset of the same name) but can be
set independently to any preset or "Other...". Separately from that preference, selected rows in
lists, tables, sidebars and column views use the **selected content background**, which derives from
the accent, not from the Highlight colour: emphasised (saturated accent, white text) when the view has
keyboard focus in the key window, unemphasised (neutral grey, normal text) otherwise [D: AppKit
`selectedContentBackgroundColor` documentation; HIG Color "Dynamic System Colors"].

## Anatomy

| Token | Used for | Follows |
|---|---|---|
| selected text background | text selection in fields and text views (focused) | Highlight colour preference |
| unemphasised selected text background | text selection in a view without focus | fixed grey |
| selected content background (emphasised) | selected row/cell in a focused list, table, outline, column view | accent |
| unemphasised selected content background | selected row when the view is not first responder or the window is inactive | fixed grey |
| sidebar selection | selected source-list row | fixed grey (vibrant); accent in some apps' own sidebars |

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| preset | Blue, Purple, Pink, Red, Orange, Yellow, Green, Graphite, Other | Blue | `AppleHighlightColor` | all 8 presets as the swatch in the closed pop-up; the open pop-up list is never shown |
| emphasis | emphasised, unemphasised | - | `NSTableRowView.isEmphasized` | both |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| Selected text, focused field, blue, light | yes | 10-15-Catalina-Light-Safari-v13-Preferences.png @ 784,452,570,32 |
| Selected text, other presets, light and dark | swatch only | Highlight pop-up swatch in the 32 Theme files (table below); the swatch is the selection colour: its blue value `#bad7fb (sRGB #b4d7ff)` equals the measured Safari selection |
| Selected text in dark mode on real text | no | [C] from the dark swatch |
| Selected row, emphasised, blue | yes | Force Quit, Open panel (light and dark) |
| Selected row, emphasised, other accents | no | [I] the accent's swatch moved by the offset measured between the blue swatch and the blue row (see below) |
| Selected row, unemphasised | yes | Open panel sidebar (light and dark) |
| Inactive window | no | [D] same as unemphasised |

## Measurements

### Geometry (pt)

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Text selection rect height in a regular text field (13 pt text) | 16 pt (32 px, y 452..483), inside a 22 pt field (20 pt between borders) | [M] | 10-15-Catalina-Light-Safari-v13-Preferences.png col 900: 452..483 selection, field border rows 449 and 488 |
| Text selection starts/ends | flush with the first and last glyph advance; 2 pt inside the field's inner edge | [M] | same file row 468: border 777, selection from 784 |
| Emphasised row, table with 16 pt icons | 21 pt (42 px, y 242..283), full list width, square corners | [M] | 10-15-Catalina-Light-Force-Quit.png col 400 |
| Emphasised row, column view | 17 pt (34 px, y 212..245), full column width | [M] | 10-15-Catalina-Light-Finder-Open.png col 600 |
| Unemphasised sidebar row | 24 pt (48 px, y 366..413), full sidebar width | [M] | 10-15-Catalina-Light-Finder-Open.png col 200 |
| Sidebar row with accent selection (Storage Management) | 28 pt (56 px, y 120..175), full sidebar width | [M] | 10-15-Catalina-Light-Storage-Management.png col 300 |

### Colours and fills

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Selected text background, Blue | `#bad7fb (sRGB #b4d7ff)` | `#476388 (sRGB #40638b)` (swatch) | [M] | 10-15-Catalina-Light-Safari-v13-Preferences.png @ 900,453 `#bad7fb (sRGB #b4d7ff)`; 10-15-Catalina-Theme-Dark-Blue.png @ 1510,680 `#476388 (sRGB #40638b)` |
| Selected text colour | unchanged (`#000000` stems in the Safari URL) | unchanged [I] | [M] light | 10-15-Catalina-Light-Safari-v13-Preferences.png @ 787,468 `#000000` |
| Selected row, emphasised (blue accent) | `#2365d9 (sRGB #0062e1)` | `#1e5ac8 (sRGB #0057cf)` | [M] | 10-15-Catalina-Light-Force-Quit.png @ 400,262 `#2365d9 (sRGB #0062e1)`; 10-15-Catalina-Dark-Force-Quit.png @ 400,262 `#1e5ac8 (sRGB #0057cf)` |
| same, second instance (column view) | `#2365d9 (sRGB #0062e1)` | `#1e5ac8 (sRGB #0057cf)` | [M] | 10-15-Catalina-Light-Finder-Open.png @ 600,227 `#2365d9 (sRGB #0062e1)`; 10-15-Catalina-Dark-Finder-Open.png @ 600,227 `#1e5ac8 (sRGB #0057cf)` |
| Text on emphasised row | `#ffffff` | `#ffffff` | [M] | 10-15-Catalina-Light-Force-Quit.png @ 212,260,40,12 (stems of "Mail") |
| Selected row, unemphasised (sidebar, source list) | `#c8c8c7` on sidebar `#e8e8e7` | `#505152` on `#2c2d2e` | [M] | 10-15-Catalina-Light-Finder-Open.png @ 200,389 `#c8c8c7`, @ 200,300 `#e8e8e7`; 10-15-Catalina-Dark-Finder-Open.png @ 200,389 `#505152`, @ 200,300 `#2c2d2e` |
| Sidebar row, accent-coloured selection (Storage Management sidebar) | `#2f70dd (sRGB #146ee5)` | `#2d73e2 (sRGB #0971ea)` | [M] | 10-15-Catalina-Light-Storage-Management.png @ 300,130 `#2f70dd (sRGB #146ee5)`; 10-15-Catalina-Dark-Stroage-Management.png @ 300,130 `#2d73e2 (sRGB #0971ea)` |

The unemphasised sidebar selection is a darkening of the vibrant sidebar: light = sidebar x 0.862
(`#e8e8e7` -> `#c8c8c7`), which is black at 0.14 alpha; dark = white at about 0.17 alpha over
`#2c2d2e` [C].

### The eight Highlight colour presets

Read from the swatch inside the closed "Highlight color" pop-up (fill @ 1510,680, border @ 1496,680 in
`10-15-Catalina-Theme-Light-<Accent>.png` and `10-15-Catalina-Theme-Dark-<Accent>.png`). The swatch has
a 0.5 pt border that is the fill darkened by about 25% (light) or lightened (dark).

| Preset | Light: selected text background | Light: swatch border | Dark: selected text background | Dark: swatch border | Tag |
|---|---|---|---|---|---|
| Blue | `#bad7fb (sRGB #b4d7ff)` | `#8ba2bd (sRGB #86a2c0)` | `#476388 (sRGB #40638b)` | `#738aa5 (sRGB #6e8aa8)` | [M] |
| Purple | `#dbc7dd (sRGB #dfc6df)` | `#a596a6 (sRGB #a895a7)` | `#6c586e (sRGB #705770)` | `#908292 (sRGB #938193)` | [M] |
| Pink | `#f5cde1 (sRGB #fdcbe2)` | `#b89ba9 (sRGB #be99aa)` | `#81596d (sRGB #88566e)` | `#a08391 (sRGB #a68192)` | [M] |
| Red | `#eec5c6 (sRGB #f6c3c5)` | `#b39594 (sRGB #b99493)` | `#845a59 (sRGB #8b5858)` | `#a28382 (sRGB #a88281)` | [M] |
| Orange | `#f7dabf (sRGB #fcd9bb)` | `#baa58f (sRGB #bea48c)` | `#83664b (sRGB #886547)` | `#a28d77 (sRGB #a68c74)` | [M] |
| Yellow | `#fbe9c3 (sRGB #fee9be)` | `#bcb092 (sRGB #beb08e)` | `#877550 (sRGB #8a754a)` | `#a5987b (sRGB #a79877)` | [M] |
| Green | `#d5e9ca (sRGB #d0eac7)` | `#a0af98 (sRGB #9cb096)` | `#627556 (sRGB #5d7653)` | `#889880 (sRGB #84997e)` | [M] |
| Graphite | `#e0e0e0` | `#a9aaa8` | `#686868` | `#8c8e8d` | [M] |

Relationship to the accent swatch [C]: light preset = accent swatch at about 0.33 alpha over white
(blue: `#2f7cf7 (sRGB #027aff)` at 0.33 over `#ffffff` = `#bad4fc (sRGB #b4d4ff)`, measured `#bad7fb (sRGB #b4d7ff)`); dark preset = accent swatch at
about 0.30 alpha over the control fill `#646465` plus darkening. Use the measured values.

### Emphasised selection for the other accents (not shown)

Blue: swatch `#2f7cf7 (sRGB #027aff)`, menu selection (Day) `#3f7ee7 (sRGB #2a7cef)`, emphasised row `#2365d9 (sRGB #0062e1)`. The row colour is the
swatch with each channel multiplied by about 0.76/0.81/0.88 (a darker, slightly less saturated blue).
For other accents the emphasised row is not shown in any screenshot, so it is [I]: apply to the accent's
swatch the same offset that takes the blue swatch to the measured blue row (in stored values, light
`#2f7cf7 (sRGB #027aff)` to `#2365d9 (sRGB #0062e1)`: channels multiplied by 0.745 / 0.815 / 0.879; dark `#2f7cf7 (sRGB #027aff)` to `#1e5ac8 (sRGB #0057cf)`: 0.64 /
0.73 / 0.81). The library implements this as an oklch offset fitted to the same blue pair. An earlier
recipe in this file (pop-up cap 75% stop darkened 10%) is withdrawn: for blue it gives sRGB `#196ae6 (sRGB #0067ee)`,
24 levels of red away from the measured sRGB `#0062e1 (sRGB #005fe9)`.

### Text and icons

| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Row text on emphasised selection | `#ffffff`, same size/weight as unselected | `#ffffff` | [M] | Force Quit "Mail" row |
| Row text on unemphasised selection | unchanged `#353534` | unchanged `#ffffff` | [M] | 10-15-Catalina-Light-Finder-Open.png @ 194,366,120,48 ("Documents") |
| Icons on emphasised selection | template (monochrome) icons turn white; full-colour icons unchanged | same | [M] | 10-15-Catalina-Light-Storage-Management.png @ 132,124,50,48 (white lightbulb glyph on blue disc); 10-15-Catalina-Light-Force-Quit.png @ 160,244,40,38 (Mail icon unchanged) |

### Shadows and effects

None.

## Layout and spacing

Selection rectangles are edge to edge in their container (no inset, no rounding) in Catalina tables,
sidebars and column views [M: evidence above]. Text selection covers the line height, not the glyph box.

## Keyboard and accessibility

Selection must remain visible when focus leaves the view (unemphasised grey), and text on the
emphasised colour must be white to keep contrast. ARIA: `aria-selected="true"` on the row or option;
text selection uses the platform `::selection`.

## Browser notes

- `::selection { background: var(--selected-text-background); color: inherit; }`; browsers ignore
  alpha-less colours on some platforms, so set an explicit opaque hex.
- Emphasised vs unemphasised needs `:focus-within` on the list plus a window-active flag (blur/focus
  events on `window`); CSS alone cannot see whether the browser window is key.
- Sidebar selections are drawn on a vibrant material; the measured values are composites over this
  wallpaper. Use them as the opaque fallback.

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Safari-v13-Preferences.png | 766,436,600,66 | selected text in a focused field, focus ring |
| light | 10-15-Catalina-Light-Force-Quit.png | 152,240,596,90 | emphasised row with white text, unselected rows |
| dark | 10-15-Catalina-Dark-Force-Quit.png | 152,240,596,90 | same, dark |
| light | 10-15-Catalina-Light-Finder-Open.png | 112,340,720,100 | unemphasised sidebar row next to an emphasised column row |
| dark | 10-15-Catalina-Dark-Finder-Open.png | 112,340,720,100 | same, dark |
| light | 10-15-Catalina-Theme-Light-Pink.png | 1479,661,298,40 | Highlight pop-up with the Pink preset swatch |
| dark | 10-15-Catalina-Theme-Dark-Pink.png | 1479,661,298,40 | same, dark |

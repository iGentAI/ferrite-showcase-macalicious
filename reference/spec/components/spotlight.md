# Spotlight search window (`spotlight`)

- **Status:** present
- **AppKit:** Spotlight.app panel (borderless `NSPanel` with `NSVisualEffectView`, a large `NSTextField`, an `NSTableView` result list with group rows and a preview pane)
- **HIG:** https://web.archive.org/web/20200503193417/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/search-and-spotlight/
- **Appearances shown:** light (full-screen capture over the Day picture), dark (window capture with shadow)

## Purpose and behaviour
Spotlight is the system-wide search: Command-Space (or the magnifier menu bar extra) opens a floating field in the upper middle of the screen; typing expands it into a result list grouped by category on the left and a preview of the selected result on the right. The field shows an inline completion of the top hit ("OS X - macOS") and the top hit's icon at the trailing end. Return opens the selection; Command-Return reveals it in Finder; Esc clears, then closes [D].

## Anatomy
```
+----------------------------------------------------------------------+
| (Q)  OS X| - completion text                               [app icon] |  56 pt search row
+--------------------------------+-------------------------------------+  1 pt divider
| CATEGORY (16 pt header)        |                                     |
| [i] result (26 pt row)  <- sel |          preview pane               |
| [i] result                     |          (390 pt wide)              |
| CATEGORY                       |                                     |
| ...                 (289 pt)   |                                     |
+--------------------------------+-------------------------------------+
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| state | collapsed (field only, 56 pt), expanded (results) | collapsed | - | expanded |
| preview content | dictionary definition, Quick Look text/image preview, app info, calculation, etc. | - | - | dictionary definition (light), XML text preview (dark) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| expanded with results | yes | 10-15-Catalina-Light-Spotlight.png @ 1000,420,1360,860; 10-15-Catalina-Dark-Spotlight.png @ 112,76,1360,860 |
| collapsed (empty field, placeholder "Spotlight Search") | no | [I] same window width, height 56 pt, placeholder in the secondary text colour at the query font |
| selected row | yes | 10-15-Catalina-Light-Spotlight.png @ 1000,566,580,52; 10-15-Catalina-Dark-Spotlight.png @ 114,222,576,52 |
| "Show all in Finder" target | yes (result of that action) | 10-15-Catalina-Light-Spotlight-More.png, 10-15-Catalina-Dark-Spotlight-More.png (a Finder search window; specified by the chrome and views groups) |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Window size | 680 x 430 | [M] | 10-15-Catalina-Dark-Spotlight.png opaque frame x 112..1471, y 76..935; 10-15-Catalina-Light-Spotlight.png @ 1000,420,1360,860 |
| Window position | horizontally centred (x=500 pt on the 1680 pt screen); top edge 210 pt from the screen top | [M] | 10-15-Catalina-Light-Spotlight.png @ 995,900,20,1 (edge at 1000) and 1010,415,1,10 (edge at 420) |
| Corner radius | 6 | [M] | 10-15-Catalina-Dark-Spotlight.png @ 108,72,16,14 |
| Search row height | 56 including the divider below it (px y=76..187, divider 188..189) | [M] | 10-15-Catalina-Dark-Spotlight.png @ 1300,76,1,116 |
| Magnifier glyph | 21.5 x 21.5 ink (px 147..190 x 110..153), left inset 17.5 | [M] | 10-15-Catalina-Dark-Spotlight.png @ 147,110,44,44 |
| Query text | starts 52 pt from the window's left edge (px 216); cap height 38-39 px (rows 112..150); insertion point 30 pt tall (px y=100..159) | [M] | 10-15-Catalina-Dark-Spotlight.png @ 216,112,64,39; 295,100,33,60 |
| Top-hit icon | 28.5 x 28.5 ink (px 1371..1428 x 103..160), right inset 21.5 | [M] | 10-15-Catalina-Dark-Spotlight.png @ 1371,103,58,58 |
| List width | 289 (px 112..689) | [M] | 10-15-Catalina-Dark-Spotlight.png @ 100,600,600,1 |
| List / preview divider | 1 (px 690..691) | [M] | 10-15-Catalina-Dark-Spotlight.png @ 688,600,6,1; 10-15-Catalina-Light-Spotlight.png @ 1572,1100,16,1 (1578..1579) |
| Preview width | 390 (px 692..1471) | [M] | 10-15-Catalina-Dark-Spotlight.png @ 692,600,780,1 |
| Category header height | 16 (px y=190..221, 482..513, 566..597, 858..889) | [M] | 10-15-Catalina-Dark-Spotlight.png @ 140,188,1,750 |
| Result row height | 26 (selected row px y=222..273; five rows fill 274..481 less one) | [M] | 10-15-Catalina-Dark-Spotlight.png @ 140,222,1,52 |
| Row icon | 16 pt box at x=20 pt (document glyph ink px 157..178 x 233..261) | [M] ink, [C] box | 10-15-Catalina-Dark-Spotlight.png @ 157,233,22,29 |
| Row text inset | 52.5 from the window's left edge (px 217) | [M] | 10-15-Catalina-Dark-Spotlight.png @ 217,291,428,23 |
| Header text inset | 20.5 (px 153) | [M] | 10-15-Catalina-Dark-Spotlight.png @ 153,200,105,13 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Panel material, observed | `#a8a692 (sRGB #a8a690)`..`#d7c8b2 (sRGB #dac8af)` over the island/sky (mean `#c3b9a5 (sRGB #c5b9a3)`); search row `#c3ced4 (sRGB #c1ced5)` at the left, `#c4bba9 (sRGB #c6bba7)` mid | `#2b2c2d` (window capture: no backdrop, so this is the material's opaque base) | [M] | 10-15-Catalina-Light-Spotlight.png @ 1640,820,680,440; 1010,421,1,110; 10-15-Catalina-Dark-Spotlight.png @ 140,78,1,110 |
| Panel recipe | `backdrop-filter: blur(30px) saturate(1.8)` + `rgba(224,222,218,0.65)` | `backdrop-filter: blur(30px) saturate(1.8)` + `rgba(43,44,45,0.80)` | [C] light (fit of 891 pixels against 10-15-Catalina-Light-Desktop.png: sigma 60 px, alpha 0.65, rms 1.9); [I] dark alpha | fit; dark base colour [M] |
| Opaque fallback | `#e9e7e3` | `#2b2c2d` | [C] / [M] | tint over white; dark capture |
| Inner border | not distinguishable | 1 pt `#555657` | [M] | 10-15-Catalina-Dark-Spotlight.png @ 140,76,1,2; 112,600,2,1 |
| Outer hairline | - | 0.5 pt black at alpha 0.96 (x=111) | [M] | 10-15-Catalina-Dark-Spotlight.png @ 111,600 |
| Search-row divider | 1 pt `#a49c8a (sRGB #a59c88)` on `#bbb3a2 (sRGB #bcb3a0)` = `rgba(0,0,0,0.12)` | 1 pt `#4e4f50` on `#2b2c2d` = `rgba(255,255,255,0.165)` | [M] composite, [C] alpha | 10-15-Catalina-Light-Spotlight.png @ 2000,532,1,2; 10-15-Catalina-Dark-Spotlight.png @ 1300,188,1,2 |
| List/preview divider | `#aa9e91 (sRGB #ac9e8f)` on `#b6ad9d (sRGB #b8ad9b)` = `rgba(0,0,0,0.07)` | `#404142` | [M] | 10-15-Catalina-Light-Spotlight.png @ 1578,1100,2,1; 10-15-Catalina-Dark-Spotlight.png @ 690,600,2,1 |
| Category header band | `#a4a5a2` on rows `#bab4a7 (sRGB #bbb4a5)` = `rgba(0,0,0,0.12)` | `#4e4f50` on `#2b2c2d` = `rgba(255,255,255,0.165)` | [M] composite, [C] alpha | 10-15-Catalina-Light-Spotlight.png @ 1010,532,1,34; 10-15-Catalina-Dark-Spotlight.png @ 140,190,1,32 |
| Selected row | `#3272dd (sRGB #1970e5)` (`#3170db (sRGB #196ee3)`) | `#2d73e2 (sRGB #0971ea)` | [M] | 10-15-Catalina-Light-Spotlight.png @ 1010,566,1,52; 10-15-Catalina-Dark-Spotlight.png @ 140,222,1,52 |
| Preview background | same material as the list | `#1e1e1e` (the dark text preview's own background) | [M] | 10-15-Catalina-Light-Spotlight.png @ 1700,1200,8,8 `#b9b1a2 (sRGB #bbb1a0)`; 10-15-Catalina-Dark-Spotlight.png @ 1000,205 |
| Query text | `#000000` | `#ffffff` | [M] | 10-15-Catalina-Light-Spotlight.png @ 1104,456,64,39; 10-15-Catalina-Dark-Spotlight.png @ 216,112,64,39 |
| Completion text, magnifier | `#3b3328 (sRGB #3c3327)` on `#bdbbb8` (about `rgba(0,0,0,0.75)` vibrant) | `#a7a8a9` | [M] | 10-15-Catalina-Light-Spotlight.png @ 1263,467,84,19; 10-15-Catalina-Dark-Spotlight.png @ 374,122,748,25; 147,110,44,44 |
| Header text | `#030200` | `#ffffff` | [M] | 10-15-Catalina-Light-Spotlight.png @ 1042,544,100,13; 10-15-Catalina-Dark-Spotlight.png @ 153,200,105,13 |
| Row text | `#000000`; selected `#ffffff` | `#ffffff` | [M] | 10-15-Catalina-Light-Spotlight.png @ 1105,667,418,22; 1106,583,78,18; 10-15-Catalina-Dark-Spotlight.png @ 217,291,428,23 |
| Preview link text (dictionary) | `#0020e4 (sRGB #1400ee)` | - | [M] | 10-15-Catalina-Light-Spotlight.png @ 2126,750 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Query font | SF Pro Display Light about 27 pt (cap height 38-39 px including the O/S overshoot) | same | [C] | 10-15-Catalina-Dark-Spotlight.png @ 216,112,64,39; 10-15-Catalina-Light-Spotlight.png @ 1104,456,64,39 |
| Completion font | 13 pt Regular after an em dash, same baseline region (cap rows 467..485 = 19 px with overshoot) | same | [C] | 10-15-Catalina-Light-Spotlight.png @ 1263,467,84,19 |
| Category header font | 9 pt Semibold, upper case (cap height 13 px: rows 200..212 dark, 544..556 light) | same | [C] | 10-15-Catalina-Dark-Spotlight.png @ 153,200,105,13 |
| Row font | 12 pt Regular (ascender-to-descender 22-23 px; "macOS" 18 px) | same | [C] | 10-15-Catalina-Light-Spotlight.png @ 1105,667,418,22; 1106,583,78,18 |
| Preview title (dictionary) | about 24 pt Regular (34 px, "macOS") | - | [C] | 10-15-Catalina-Light-Spotlight.png @ 1634,602,142,34 |
| Preview body | 12 pt Regular, 17 pt line pitch (ink rows 682..706, 716..740, 750..774: 34 px top-to-top) | - | [C] size and pitch from measured ink rows | 10-15-Catalina-Light-Spotlight.png @ 1668,640,512,162 |

### Shadows and effects
Measured alpha of the window shadow in the dark window capture [M] 10-15-Catalina-Dark-Spotlight.png @ 0,600,112,1 and 800,936,1,140:

| Distance outside the frame (px) | 1 | 10 | 20 | 30 | 40 | 60 | 80 | 100 | 130 |
|---|---|---|---|---|---|---|---|---|---|
| Left side (y=600), alpha | 0.35 | 0.28 | 0.22 | 0.15 | 0.10 | 0.05 | 0.02 | 0.00 | 0 |
| Below (x=800), alpha | 0.56 | 0.53 | 0.45 | 0.39 | 0.31 | 0.19 | 0.08 | 0.05 | 0.00 |

Shadow margins of the capture: left 112, top 76, right 112, bottom 148 px (the standard key-window shadow; see the chrome group's `window-shadow`). Fitted CSS [C]: `box-shadow: 0 18px 50px rgba(0,0,0,0.55)`.

## Layout and spacing
List rows and headers run the full list width; the selection has square corners and spans the list width. The window does not move or resize while results change; the list scrolls (the last row is cut by the bottom edge in both captures).

## Keyboard and accessibility
Command-Space toggles; Up/Down move the selection, Command-Up/Down jump between categories, Return opens, Command-Return shows in Finder, Tab moves to the preview, Esc clears then closes [D] (Apple Support, Spotlight keyboard shortcuts). ARIA: `combobox` (the field, `aria-expanded`, `aria-controls`) with a `listbox` whose groups are `role="group"` with labels.

## Browser notes
The light material is strongly backdrop dependent (it reads warm beige over the island and blue-grey over the sky); `backdrop-filter` with the recipe above reproduces it. The 27 pt light query font needs SF Pro Display; `font-weight: 300` on the system font is the nearest fallback.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Spotlight.png | 1000,420,1360,860 | expanded window over the desktop, dictionary preview |
| dark | 10-15-Catalina-Dark-Spotlight.png | 112,76,1360,860 | expanded window (window capture with shadow), text preview |

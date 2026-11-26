# Calculator keys and display (`calculator-keypad`)

- **Status:** present
- **AppKit:** custom views in Calculator.app (no public class). Keys behave like borderless momentary `NSButton`s; the display is a right-aligned, non-editable label.
- **HIG:** none (app-specific). Window anatomy: https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/
- **Appearances shown:** light, dark. The keypad is dark-styled in both; only the three neutral greys shift (see Colours).

## Purpose and behaviour
A fixed-size calculator: a numeric display on top of a 4-column key grid. Clicking a key (or typing its key equivalent) enters a digit, an operator or a function. The window has no title text and no visible title bar: the traffic lights float over the display, and the whole display area drags the window [I] (standard for full-size-content windows). The clear key reads `AC` when the display is cleared and `C` once a number has been entered [M] (dark capture shows `AC` with display `0`; light capture shows `C` with display `42`).

## Anatomy
Back to front:
1. Window body filled with the **display colour** (this colour also shows through the 1 pt gaps between keys, so the key separators are not drawn lines).
2. Key cells: flat rectangles in three colour roles (function, digit, operator).
3. Key labels, centred in each cell.
4. Display text, right-aligned, bottom of the display area.
5. Window controls (`window-controls`) at the top left.
6. A 1 pt inner edge highlight around the whole window (white at about 0.2 alpha), the standard dark-window rim (see `window`).

```
+----------------------------------------+  y=0
| (o)(o)(o)                              |
|                                    42  |  display, 81 pt
+---------+---------+---------+----------+  y=81
|   C     |  +/-    |   %     |    ÷     |  47 pt
+---------+---------+---------+----------+  1 pt gap
|   7     |   8     |   9     |    ×     |  47
|   4     |   5     |   6     |    −     |  47
|   1     |   2     |   3     |    +     |  47
|        0          |   .     |    =     |  48 (last row absorbs the rounding)
+-------------------+---------+----------+  y=321
   56 pt     57 pt     57 pt     59 pt
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| mode | basic, scientific, programmer | basic | View menu (Cmd-1/2/3) | basic only. Scientific and Programmer are **not shown** |
| key role | function (`AC`/`C`, `+/-`, `%`), digit (`0`-`9`, `.`), operator (`÷ × − + =`) | - | - | all three |
| key span | 1 column; `0` spans 2 columns | 1 | - | both |
| clear label | `AC` (nothing entered), `C` (entry in progress) | `AC` | - | both (`AC` dark, `C` light) |
| RPN mode, thousands separators, paper tape | off | off | View / Window menus | not shown |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes | both captures |
| pressed | no | [I] function and digit keys lighten while the mouse is down, operator keys darken; see Colours for the suggested values |
| operator armed (after pressing an operator, before the next digit) | no | [I] Catalina draws a 1 pt darker inset outline on the armed operator key; not in the screenshots |
| disabled | n/a | keys are never disabled in basic mode |
| focused | n/a | no focus ring; the keypad is not in the key view loop |
| inactive window | no | [I] unchanged except the window controls (see `window-controls`) |

## Measurements
All coordinates below are in pt relative to the window's top-left corner; the window frame starts at image px (112, 76) in both captures, so image px = 2 x pt + (112, 76). Evidence shorthand: a bare `@ x,y[,w,h]`, `row y=` or `col x=` refers to `10-15-Catalina-Light-Calculator.png` (and to `10-15-Catalina-Dark-Calculator.png` at the same coordinates where a Dark value is given); `Light @` / `Dark @` name those two files.

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Window frame | 232 x 321 | [M] | `10-15-Catalina-Light-Calculator.png @ 112,76,464,642` (also Dark) |
| Display area | x 0, y 0, 232 x 81 | [M] | col x=170: display colour from y=78 to 237, keys start at y=238 |
| Column x / width | 0 / 56, 57 / 57, 115 / 57, 173 / 59 | [M] | row y=300: key runs 112..223, 226..339, 342..455, 458..575 |
| Row y / height | 81 / 47, 129 / 47, 177 / 47, 225 / 47, 273 / 48 | [M] | col x=170: key runs 238..331, 334..427, 430..523, 526..619, 622..717 |
| Gap between keys | 1 (2 px), filled with the display colour | [M] | row y=300 @ x=224..225, 340..341, 456..457; col x=170 @ y=332..333, 428..429, 524..525, 620..621 |
| Gap between display and first key row | 0 (no line) | [M] | col x=170: `#37393c` ends at y=237, `#4a4c4e` starts at y=238 |
| `0` key | x 0, y 273, 114 x 48 (no gap at x=56) | [M] | row y=640: one run 114..339 |
| Window corner radius | about 5 (10 px), all four corners | [M] | grid `@ 110,74,12,12` and `@ 110,706,14,14`; see `window` |
| Inner rim | 1 pt (2 px) on left, right, bottom; top row 1 px brighter + 1 px | [M] | col x=112 and x=113; row y=76, y=77 |
| Close / minimise / zoom | 12 pt circles at x 8, 28, 48; y 5 | [M] | row y=98: 128..151, 168..191, 208..231; col x=138: 86..109 |

### Key matrix (label, rect in pt, role)
| Key | Label | x | y | w | h | Role | Label glyph box (image px, light), provenance |
|---|---|---|---|---|---|---|---|
| clear | `C` / `AC` | 0 | 81 | 56 | 47 | function | C: 157..178 x 271..298; AC (dark file): 145..189 x 271..298 [M] |
| negate | `⁺∕₋` (plus, slash, minus drawn as one glyph) | 57 | 81 | 57 | 47 | function | 267..297 x 272..297 [M] |
| percent | `%` | 115 | 81 | 57 | 47 | function | 384..412 x 271..297 [M] |
| divide | `÷` | 173 | 81 | 59 | 47 | operator | 503..528 x 277..303 [M] |
| 7 | `7` | 0 | 129 | 56 | 47 | digit | 156..177 x 365..396 [M] |
| 8 | `8` | 57 | 129 | 57 | 47 | digit | 270..293 x 365..397 [M] |
| 9 | `9` | 115 | 129 | 57 | 47 | digit | 386..409 x 365..397 [M] |
| multiply | `×` | 173 | 129 | 59 | 47 | operator | 504..527 x 374..397 [M] |
| 4 | `4` | 0 | 177 | 56 | 47 | digit | 155..179 x 461..492 [M] |
| 5 | `5` | 57 | 177 | 57 | 47 | digit | 271..293 x 461..493 [M] |
| 6 | `6` | 115 | 177 | 57 | 47 | digit | 386..409 x 461..493 [M] |
| subtract | `−` | 173 | 177 | 59 | 47 | operator | 504..527 x 480..484 [M] |
| 1 | `1` | 0 | 225 | 56 | 47 | digit | 159..171 x 557..588 [M] |
| 2 | `2` | 57 | 225 | 57 | 47 | digit | 272..292 x 557..588 [M] |
| 3 | `3` | 115 | 225 | 57 | 47 | digit | 387..408 x 557..589 [M] |
| add | `+` | 173 | 225 | 59 | 47 | operator | 503..528 x 565..591 [M] |
| 0 | `0` | 0 | 273 | 114 | 48 | digit | 213..236 x 654..686 [M] |
| decimal | `.` | 115 | 273 | 57 | 48 | digit | 396..400 x 681..685 [M] |
| equals | `=` | 173 | 273 | 59 | 48 | operator | 503..527 x 667..682 [M] |

All label boxes [M] from `10-15-Catalina-Light-Calculator.png` (the Dark file gives the same boxes within 1 px). Digit and function labels are centred in their key in both axes [C] (for `7`: key centre 167.5, 380.5 px; label centre 166.5, 380.5). Operator glyphs are centred horizontally and sit 2.5 pt below the key's vertical centre [C] (`÷` centre y 289.5 vs key centre 284.5; `×` 385.5 vs 380.5); the `=` and `.` sit on the same baseline as the digits (bottom at y=685/686).

### Colours and fills
| Part / state | Light capture | Dark capture | Tag | Evidence |
|---|---|---|---|---|
| Display / window body / key gaps | `#37393c` | `#2e3134 (sRGB #2d3134)` | [M] | `10-15-Catalina-Light-Calculator.png @ 170,150`; Dark same coordinate; palette @ 114,110,400,30 |
| Function key fill | `#4a4c4e` | `#424447` | [M] | `10-15-Catalina-Light-Calculator.png @ 170,250` (dither within 1); Dark same coordinate |
| Digit key fill | `#68696b` | `#616365` | [M] | `10-15-Catalina-Light-Calculator.png @ 170,350` (dither within 2); Dark same coordinate |
| Operator key fill | `#f2a23c (sRGB #ff9f0b)` | `#f2a23c (sRGB #ff9f0b)` | [M] | `10-15-Catalina-Light-Calculator.png @ 520,350` (dither within 1); Dark same coordinate |
| Display text | `#ffffff` | `#ffffff` | [M] | `10-15-Catalina-Light-Calculator.png @ 441,190`; Dark @ 495,180 |
| Digit key label | `#e8e8e9` | `#e7e7e8` | [M] | `10-15-Catalina-Light-Calculator.png @ 170,366`; Dark same coordinate; = white at 0.85 over the key [C] |
| Function key label | `#e3e4e4` | `#e3e3e4` | [M] | `10-15-Catalina-Light-Calculator.png @ 170,272`; Dark @ 170,277; = white at 0.85 [C] |
| Operator key label | `#fef0e2 (sRGB #fff0e0)` | `#fef0e2 (sRGB #fff0e0)` | [M] | `10-15-Catalina-Light-Calculator.png @ 520,289` (Dark same coordinate; dithered +-1: `#fdf1e2 (sRGB #fff1e0)` at 520,290); = white at 0.85 [C] |
| Inner rim over display | `#5f6063` | `#585a5c` | [M] | `10-15-Catalina-Light-Calculator.png @ 112,150`; Dark same coordinate (white at 0.20 over `#37393c` [C]) |
| Inner rim over digit key | `#868788` | `#818284` | [M] | `10-15-Catalina-Light-Calculator.png @ 112,400`; Dark same coordinate; bottom rows y=716..717 |
| Inner rim over operator key | `#f6b663 (sRGB #ffb451)` | `#f4b463 (sRGB #ffb251)` | [M] | `10-15-Catalina-Light-Calculator.png @ 575,300`; Dark same coordinate |
| Top edge highlight | `#7f8182` then `#6e7172 (sRGB #6d7172)` | `#797a7d` then `#686a6c` | [M] | `10-15-Catalina-Light-Calculator.png @ 170,76`; L/D @ 170,77 |
| Function / digit key, pressed | `#6f7173` / `#a5a6a7` | same | [I] | not shown; Catalina lightens neutral keys while pressed. Derived as white 0.2 and 0.4 over the fill |
| Operator key, pressed | `#c2812f (sRGB #cc7e0a)` | same | [I] | not shown; operator keys darken (black 0.2 over the fill) |

The neutral greys differ between the two captures by a constant step (about -8 per channel in dark) while the orange and the white text do not change. Each fill carries a faint regular dither (alternate values differ by 1, e.g. `#4a4c4e`/`#494b4e` every 32 px, row y=300), so the fills are composited materials, not plain colours. The lead should treat the two columns as the light-appearance and dark-appearance values [I].

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Display font | SF Pro Display, 50 pt, Thin (CSS weight 200), tabular lining figures | [C] | digit height 70 px (`@ 440,142,103,70`) / 0.705 = 49.6 pt; stem 4-5 px = 2-2.5 pt (row y=190: 441..444, 475..478) |
| Display text position | right edge of the last digit 16.5 pt from the window's right edge; baseline 68 pt below the window top (13 pt above the keys) | [M] | "42" box 440..542 x 142..211; Dark "0" box 494..543 x 142..212 |
| Digit label font | SF Pro Display 23 pt Regular | [C] | digit height 32-33 px / 0.705 = 23 pt; stem of `1` 4-5 px (row y=575: 167..171) |
| Function label font | SF Pro Text 18 pt Medium | [C] | cap height 26 px (`A` in Dark file 145..166 x 272..297; `%` 27 px); stem 4 px (row y=285: 157..160) |
| Operator glyphs | drawn shapes, 2.5 pt stroke, 12-13 pt wide | [M] | see below |
| `+` | 13 x 13.5 pt; bars 2.5 pt thick | [M] | row y=578: 503..527; col x=515: 565..591 |
| `−` | 12 x 2.5 pt | [M] | box 504..527 x 480..484 |
| `×` | 12 x 12 pt, two 2.5 pt diagonals with round ends | [M] | box 504..527 x 374..397 |
| `÷` | 13 x 13 pt: bar 13 x 2.5 pt, dots 3 pt diameter, 2 pt gap above and below the bar | [M] | col x=515: dot 277..283, bar 288..292, dot 297..303 |
| `=` | 12.5 x 8 pt: two bars 2.5 pt thick, 3 pt apart | [M] | col x=515: 667..671, 678..682 |
| `.` | 2.5 pt dot | [M] | box 396..400 x 681..685 |

### Shadows and effects
Standard window shadow (see `window-shadow`). No shadows or gradients inside the keypad. Key fills are flat; there are no bevels.

## Layout and spacing
- The grid is `56 | 57 | 57 | 59` pt wide with 1 pt gaps, and five rows of 47 pt (last row 48 pt) with 1 pt gaps; the outer keys run to the window edge and are clipped by the window's rounded bottom corners.
- CSS: `display:grid; grid-template-columns:56px 57px 57px 59px; grid-template-rows:81px repeat(4,47px) 48px; gap:1px; background:<display colour>` with the display spanning all four columns (the 1 px row gap between display and first key row must be removed: the first key row starts at exactly y = 81).
- The window is not resizable in basic mode [I] (the zoom button is enabled but only toggles the same size).

## Keyboard and accessibility
- Digits, `.`, `+ - * / =`, Return (=), Escape or `C` (clear), `%`, Option-minus (negate), Delete (remove last digit) [D, Calculator Help "Keyboard shortcuts"; not visible in the screenshots].
- Each key is exposed as a button with its spoken name ("seven", "divide", "all clear"); the display is static text with the current value [I]. ARIA: `role="application"` wrapper is not needed; use a `role="grid"` or plain group of `button`s plus an `output` element with `aria-live="polite"`.

## Browser notes
- The thin 50 pt display digits need SF Pro Display Thin; with the `-apple-system` stack use `font-weight:200`. On non-Apple systems fall back to Helvetica Neue Thin or Inter 200.
- The operator glyphs should be drawn as SVG (sizes above) rather than typed, because font glyphs for `÷ × −` differ in size and position between fonts.
- The 1 pt white 0.2 inner rim is a `box-shadow: inset 0 0 0 1px rgba(255,255,255,.2)` on the window (0.5 pt on the top row is brighter; see `window`).

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Calculator.png` | 112,76,464,642 | whole calculator, display `42`, clear key `C` |
| dark | `10-15-Catalina-Dark-Calculator.png` | 112,76,464,642 | whole calculator, display `0`, clear key `AC` |
| light | `10-15-Catalina-Light-Calculator.png` | 400,120,176,110 | display digits |
| light | `10-15-Catalina-Light-Calculator.png` | 458,238,118,480 | operator column |

# Calculator
- **Screenshots:** `10-15-Catalina-Light-Calculator.png`, `10-15-Catalina-Dark-Calculator.png` (window captures with shadow, transparent background)
- **Window:** 232 x 321 pt [M] (`@ 112,76,464,642` in both files). No title, no visible title bar (full-size content; traffic lights float over the display). Fixed size. Dark-styled in both appearances.

## Layout
Evidence shorthand: a bare `@ x,y[,w,h]`, `row y=` or `col x=` refers to `10-15-Catalina-Light-Calculator.png` and holds at the same coordinates in `10-15-Catalina-Dark-Calculator.png`.

| Region | x, y, w, h (pt, from window top-left) | Light capture | Dark capture | Tag |
|---|---|---|---|---|
| Display | 0, 0, 232, 81 | `#37393c` | `#2e3134 (sRGB #2d3134)` | [M] `@ 114,110,400,30` |
| Function row (`C`/`AC`, `+/-`, `%`) | 0, 81, 172, 47 | `#4a4c4e` | `#424447` | [M] `@ 114,240,108,90` |
| Digit keys (`7`..`0`, `.`) | 0, 129, 172, 192 | `#68696b` | `#616365` | [M] `@ 114,336,108,90` |
| Operator column (`÷ × − + =`) | 173, 81, 59, 240 | `#f2a23c (sRGB #ff9f0b)` | `#f2a23c (sRGB #ff9f0b)` | [M] `@ 460,336,110,90` |
| Gaps between keys | 1 pt | display colour | display colour | [M] |

```
  0        56 57      114 115     172 173      232
  +----------------------------------------------+ 0
  | (o)(o)(o)                                    |
  |                                         42   | display
  +----------+----------+----------+-------------+ 81
  |    C     |   +/-    |    %     |      ÷      |
  +----------+----------+----------+-------------+ 128/129
  |    7     |    8     |    9     |      ×      |
  +----------+----------+----------+-------------+ 176/177
  |    4     |    5     |    6     |      −      |
  +----------+----------+----------+-------------+ 224/225
  |    1     |    2     |    3     |      +      |
  +----------+----------+----------+-------------+ 272/273
  |          0          |    .     |      =      |
  +---------------------+----------+-------------+ 321
```

The complete key matrix (label, rect and role of all 19 keys, with the pixel box of every label) is in `components/calculator-keypad.md`, section "Key matrix". Summary of rects (x, y, w, h in pt):

| | col 1 | col 2 | col 3 | col 4 |
|---|---|---|---|---|
| row 1 | `C`/`AC` 0,81,56,47 | `+/-` 57,81,57,47 | `%` 115,81,57,47 | `÷` 173,81,59,47 |
| row 2 | `7` 0,129,56,47 | `8` 57,129,57,47 | `9` 115,129,57,47 | `×` 173,129,59,47 |
| row 3 | `4` 0,177,56,47 | `5` 57,177,57,47 | `6` 115,177,57,47 | `−` 173,177,59,47 |
| row 4 | `1` 0,225,56,47 | `2` 57,225,57,47 | `3` 115,225,57,47 | `+` 173,225,59,47 |
| row 5 | `0` 0,273,114,48 (spans 2) | - | `.` 115,273,57,48 | `=` 173,273,59,48 |

All [M], from row y=300, row y=640 and col x=170 of `10-15-Catalina-Light-Calculator.png`.

## Components used
- `calculator-keypad`: everything inside the window.
- `window`, `window-shadow`: 5 pt corner radius, dark-window inner rim, standard key-window shadow (shadow margins 112/76/112/148 px around the frame in both files).
- `window-controls`: close, minimise, zoom at x 8/28/48, y 5 (12 pt circles) [M] row y=98, col x=138. Colours in this dark window: `#ed655a (sRGB #ff5a53)`, `#e0c04c (sRGB #e5c029)`, `#72be47 (sRGB #53c22c)` [M] `@ 140,98`, `@ 180,98`, `@ 220,98`.

## App-specific elements
- Display text: SF Pro Display Thin 50 pt, `#ffffff`, right-aligned with the last digit's right edge 16.5 pt from the window edge, baseline at y = 68 pt [M]/[C] (`Light @ 440,142,103,70`).
- Key labels: digits 23 pt Regular; function keys 18 pt Medium; operators drawn 2.5 pt strokes; all white at 0.85 [C].
- No other chrome: no menus inside the window, no status text.

## Content in the screenshot
| Element | Light | Dark |
|---|---|---|
| Display | `42` | `0` |
| Clear key | `C` | `AC` |
| Other keys | `+/-` `%` `÷` `7` `8` `9` `×` `4` `5` `6` `−` `1` `2` `3` `+` `0` `.` `=` | same |

Menu bar (not in the capture) [D]: Calculator, File, Edit, View, Convert, Speech, Window, Help.

## Light vs dark
The captures differ in pixels, not geometry: display `42` / `0`, clear key `C` / `AC`, neutral fills and rim composites. Neutral samples [M] at `@ 170,150`, `@ 170,250`, `@ 170,350` are light `#37393c`, `#494b4e`, `#686a6c` and dark `#2e3134 (sRGB #2d3134)`, `#414346`, `#616366` (within 2 channels of the representative fills above). Orange is unchanged [M] (`@ 520,350`: `#f2a23b (sRGB #ff9f06)` in both); label stems are equal or differ by 1 channel [M] (`@ 170,366`: `#e8e8e9` / `#e7e7e8`). Treat the two neutral palettes as capture-specific light/dark values; their cause is not established by still screenshots [I].

## Not reproducible / assets needed
None. The whole app is flat colour and text. Scientific and Programmer layouts are not in the reference set and would have to be built from documentation.

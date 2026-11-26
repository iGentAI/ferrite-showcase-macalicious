# App Store offer button (`store-pill-button`)

- **Status:** present
- **AppKit:** custom, app-drawn control in App Store.app (no public class; the store calls it the offer button). Closest standard control: borderless `NSButton` with a custom capsule layer.
- **HIG:** none specific. Related: push buttons https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/push-buttons/
- **Appearances shown:** light, dark (the fill is the same light colour in both; only the label blue and the caption grey change)

## Purpose and behaviour
The capsule at the trailing edge of every app lockup in the App Store. Its label is the offer: `GET` for a free app, the price (`$14.99`) for a paid app. Clicking starts the purchase: the label changes to a confirmation (`INSTALL` / `BUY APP`), then to a circular progress indicator, then to `OPEN` [I] (none of the later steps is captured). A one-line caption `In-App Purchases` hangs under the capsule when the app offers them [M]. The HIG push-button rules that still apply: a text title, a verb, and a width that fits the title [D, HIG Push Buttons]; unlike a push button the title is upper case for words and the width is fixed.

## Anatomy
```
          66 pt
  +----------------------+
 (          GET           )   21 pt, radius 10.5 (capsule)
  +----------------------+
       In-App Purchases       7 pt caption, cap top 7 pt below the capsule
```
Back to front: (1) capsule fill, no border, no shadow; (2) label, centred on both axes; (3) optional caption below, centred on the capsule.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| label | `GET`, price string, `OPEN`, `UPDATE`, `INSTALL`, `BUY APP` | `GET` | - | `GET` (3 instances), price (6 instances: `$14.99`, `$49.99`, `$89.99`, `$19.99`, `$59.99`, `$44.99`) per appearance |
| caption | none, `In-App Purchases` | none | - | both |
| width | fixed 66 pt for every label shown, including 6-character prices | 66 | - | fixed only |
| progress | idle, downloading (circular) | idle | `NSProgressIndicator` circular, custom | idle only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, `GET` | yes | `10-15-Catalina-Light-Mac-App-Store.png @ 1102,1465,132,42`; `10-15-Catalina-Dark-Mac-App-Store.png @ 1102,1465,132,42` |
| normal, price | yes | `10-15-Catalina-Light-Mac-App-Store.png @ 1744,1465,132,42`; same box in the Dark file |
| hover | no | [I] no change on macOS 10.15 (the store has no hover treatment for the pill) |
| pressed | no | [I] the whole pill dims to about 0.5 opacity while the mouse is down (iOS-style highlight) |
| confirm (`INSTALL` / `BUY APP`) | no | [I] same height; fill becomes the label blue and the label white; width grows to fit |
| downloading | no | [I] the capsule is replaced by a 21 pt circular progress ring (2 pt stroke, label blue) with a 6 pt stop square |
| `OPEN` / `UPDATE` | no | [I] same as normal with the other word |
| disabled | no | [I] label at 0.35 opacity |
| focused (full keyboard access) | no | [I] standard focus ring following the capsule, see `focus-ring` |

## Measurements
Evidence shorthand: `Light @` = `10-15-Catalina-Light-Mac-App-Store.png`, `Dark @` = `10-15-Catalina-Dark-Mac-App-Store.png`; a bare `@`, `row y=` or `col x=` refers to the Light file and gives the same geometry in the Dark file. Window origin is image px (112, 76).

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Capsule size | 66 x 21 (132 x 42 px) | [M] | row y=1486: fill 1102..1233; col x=1170: fill 1465..1506. Same in columns 2 and 3: 1744..1875, 2386..2517 (row y=1485) |
| Corner radius | 10.5 (half the height: true capsule) | [M] | grid `@ 1100,1463,16,24`: left edge starts at x=1116 on row 1466 and reaches the straight edge x=1102 on row 1484 (the vertical middle is rows 1485/1486) |
| Border | none | [M] | row y=1486: `#ffffff` at x=1101, `#f2f2f7` at x=1102 with no intermediate line (Dark: `#1f2023` at 1101) |
| Label box, `GET` | 24 x 9 (ink 1144..1191 x 1477..1495), centred: label centre x 1167.5 = capsule centre 1167.5 | [M] | `@ 1144,1477,48,19`; glyph boxes G 1144..1160, E 1163..1174, T 1177..1191 |
| Label box, `$14.99` | 40 wide (ink 1770..1849), centred on the capsule centre 1809.5 | [M] | `@ 1770,1476,80,21` |
| Label vertical position | cap top 6 pt below the capsule top, baseline 6 pt above the bottom (12 px each side of an 18 px cap) | [M] | `E` 1477..1494 inside 1465..1506 |
| Side padding actually used | 21 pt each side for `GET`, 13 pt for `$14.99` | [C] | (132 - 48) / 2 and (132 - 80) / 2 px |
| Caption | cap top 7 pt below the capsule bottom; ink 57.5 x 6.5; centred on the capsule | [M] | `@ 1110,1521,115,13` (capsule ends y=1506; caption centre x 1167) |
| Position in a lockup row | right edge 1 pt inside the column's right edge; vertically centred on the 50 pt icon | [M] | row separator ends x=1235, capsule ends x=1233; icon 1436..1535 (centre 1485.5), capsule centre 1485.5 |
| Row pitch | 69 (capsule tops y=1465, 1603, 1741) | [M] | col x=1110: 1469.., 1607.., 1745.. (first full-width rows) |
| Column pitch | 321 (capsules at x=1102, 1744, 2386) | [M] | rows above |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Capsule fill | `#f2f2f7` flat (82.8% of the box is this one value) | `#f2f2f7` flat: **unchanged in dark** | [M] | palette `Light @ 1102,1465,132,42`; palette `Dark @ 1744,1465,132,42`; `@ 1110,1486` in both |
| Label | `#2f7cf6 (sRGB #027aff)` | `#3686f7 (sRGB #0885ff)` | [M] | `Light @ 1146,1486`, `@ 1184,1480`; `Dark @ 1146,1486`, `@ 1775,1486`, `@ 2433,1486` |
| Caption text | `#808080` | `#9a9a9b` | [M] | darkest / lightest ink in `@ 1110,1521,115,13` (both files); second sample `@ 1752,1659,115,13` gives the same two values |
| Page behind | `#ffffff` | `#1e1f22` | [M] | `Light @ 1098,1486`; `Dark @ 1098,1486` |
| Pressed | whole pill at opacity 0.5 | same | [I] | not shown |
| Confirm state | fill = label blue, label `#ffffff` | same | [I] | not shown |

The fill equals iOS `systemGray6` in its light variant (`#f2f2f7`), and the label blues equal iOS `systemBlue`-like link colours stored in the display profile (`#2f7cf6 (sRGB #027aff)` is also the `See All` link colour, see `card-grid`). The dark capture keeping the light fill is what the pixels show; it is not a transcription error [M].

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Label font | SF Pro Text 13 pt Bold | same | [C] | cap height 18 px (`E` 1477..1494, `T` 1477..1494); vertical stems 3 px solid + 1 px anti-aliased on each side (`G` 1145..1147, `T` 1183..1185 on row y=1486) |
| Label case | upper case for words (`GET`); prices as formatted by the store (`$14.99`) | same | [M] | crops above |
| Price digits | proportional lining figures (advance of `1` is 12 px, of `4` and `9` 16 px); `$` is 21 px tall (descends 1 px above and below the digits) | same | [M] | glyph boxes `$` 1770..1782 x 1476..1496, `1` 1785..1793, `4` 1797..1811, `.` 1814..1817, `9` 1820..1833, `9` 1836..1849 |
| Label alignment | centred | same | [M] | above |
| Caption font | SF Pro Text 7 pt Regular, sentence case with capitals as written (`In-App Purchases`) | same | [C] | cap height 10 px (`I` 1521..1530, `P` 1521..1530); x-height 7 px |
| Icons | none | none | - | - |

### Shadows and effects
None. No shadow, border, gradient or material [M] (the rows above and below the capsule are the flat page colour: col x=1170 `#ffffff` to y=1464 and from y=1507).

## Layout and spacing
- Fixed 66 x 21 pt; the label is centred, so the capsule does not grow for the labels in the reference set (up to 6 characters). Longer labels (`UPDATE`, `INSTALL`) keep a minimum of about 12 pt side padding and widen the capsule [I].
- In a lockup row (301 pt column, 69 pt pitch): the capsule's right edge is 1 pt inside the column's right edge and its centre line is the icon's centre line; lockup text is truncated before it (title and subtitle end at least 8 pt before the capsule) [M] (subtitle ink ends x=1045 at the widest, capsule starts 1102).
- Caption: horizontally centred on the capsule, 7 pt gap, never wider than the capsule (57.5 pt ink for `In-App Purchases`).
- Hit target: the capsule only [I].

## Keyboard and accessibility
Not in the key view loop unless Full Keyboard Access is on; then Tab reaches it and Space activates it [I]. AppKit role: `AXButton`; the accessibility label combines the offer and the app name (for example "Get, Homescapes" / "$14.99, Overflow 3"), and the caption is exposed as help text [I]. ARIA: a native `<button>`; put the caption in an element referenced by `aria-describedby`; while downloading use `role="progressbar"` with `aria-valuenow`.

## Browser notes
Fully reproducible: `width:66px; height:21px; border-radius:10.5px; background:<fill>; font:700 13px/21px -apple-system; text-align:center`. Do not bind the fill to a dark-mode surface token: it stays light. The 7 pt caption is below most browsers' minimum font size setting (Chrome's default minimum is 0 but some locales enforce 10 px); if the minimum applies, render the caption at 10 px with `transform: scale(0.7)`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Mac-App-Store.png` | 1102,1465,132,42 | `GET`, with caption below (1110,1521,115,13) |
| light | `10-15-Catalina-Light-Mac-App-Store.png` | 1744,1465,132,42 | price `$14.99` |
| light | `10-15-Catalina-Light-Mac-App-Store.png` | 2386,1603,132,42 | price `$59.99` with caption |
| dark | `10-15-Catalina-Dark-Mac-App-Store.png` | 1102,1465,132,42 | `GET` on the dark page: fill still `#f2f2f7` |
| dark | `10-15-Catalina-Dark-Mac-App-Store.png` | 1744,1465,132,42 | price, dark |
| light | `10-15-Catalina-Light-Mac-App-Store.png` | 634,1436,1890,350 | all nine pills in the 3 x 3 lockup list |

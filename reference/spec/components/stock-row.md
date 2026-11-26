# Stocks watchlist row (`stock-row`)

- **Status:** present
- **AppKit:** none: a `UITableViewCell` drawn by Stocks.app through Mac Catalyst (iOS metrics scaled to 77%, see `catalyst-chrome`). No public class.
- **HIG:** none specific. Related: table views https://web.archive.org/web/20200503153039/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/table-views/ ; Mac Catalyst scaling https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/ios/overview/mac-catalyst/
- **Appearances shown:** light, dark

## Purpose and behaviour
One row of the watchlist in the Stocks sidebar: ticker symbol and company name at the left, an intraday sparkline in the middle, the last price over a coloured change badge at the right. Clicking a row shows that ticker's chart and news in the content pane; clicking the badge cycles its value between price change, percentage change and market capitalisation [D, Stocks User Guide; not visible]. The list is a single-column table in the HIG's sense ("a scrolling list of cells") [D, HIG Table Views]; rows can be reordered or removed in the watchlist editor [D] (not shown).

## Anatomy
```
|<12.5>Dow Jones                    ~~~~/\~~   26,201.04 <13>|   symbol / price share one baseline (21)
|      Dow Jones Industrial Ave..  ._._._._._  [ +122.42 ]<12>|   name baseline 37.5; badge 26..43.5
|      ------------------------------------------------------|   hairline, inset 12.5 at the left only
 0     13.5                        194    249  259.5     318  330 pt          row pitch 48.25
```
Back to front: (1) sidebar background (no row fill); (2) bottom hairline; (3) symbol, name; (4) sparkline: gradient fill, dashed previous-close line, data line; (5) price; (6) badge capsule with white text.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| direction | gain (green), loss (red) | - | - | both, in both appearances |
| badge value | change, percent change, market cap | change | - | change only |
| session progress | 0..1 (the data line stops at the current time; the dashed line always spans the full width) | - | - | 1.0 (Light, market closed), 0.44 (Dark) |
| selected | false, true | false | - | false only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, gain | yes | `10-15-Catalina-Light-Stocks.png @ 112,327,660,96`; `10-15-Catalina-Dark-Stocks.png @ 112,328,660,95` |
| normal, loss | yes | `10-15-Catalina-Light-Stocks.png @ 112,809,660,96` (DIS); `10-15-Catalina-Dark-Stocks.png @ 112,905,660,97` (GE) |
| selected | no | [I] row fill as the selected `Business News` cell above the list: `#f2f2f3` light, `#575858` dark (`@ 600,280` in each file [M]); text unchanged |
| pressed / highlighted | no | [I] same fill as selected while the mouse is down |
| badge pressed | no | [I] badge at 0.7 opacity |
| no data / market closed | partly | Light shows full-width sparklines; a missing quote would show `--` in the price and a grey badge [I] |
| inactive window | no | [I] unchanged |

## Measurements
Evidence shorthand: `L @` = `10-15-Catalina-Light-Stocks.png`, `D @` = `10-15-Catalina-Dark-Stocks.png`; a bare `@`, `row y=` or `col x=` is the Light file. Window origin (112, 76); the sidebar is x=112..771. The first row's top is y=327 (the bottom of the `Business News` cell); "row top" below means that edge for row 1 and the pixel after the separator for other rows.

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Row width | 330 (the sidebar) | [M] | row y=422: 112..771 |
| Row pitch | 48.25 (868 px over nine rows; separators fall on half pixels) | [M] | col x=300: separators at y=422, 519, 616, 712, 808, 904, 1001, 1098, 1194, 1290 |
| Separator | 0.5 (1 px, or 2 fainter px where it straddles a pixel row); from 12.5 pt after the left edge to the sidebar's right edge | [M] | row y=422: 137..770; col x=300: y=422 `#dcdcdd`, 423 `#e1e2e2` |
| Symbol | x 13.5; cap top 11 below the row top; baseline at 21 | [M] | `@ 139,349,140,20` (row top 327) |
| Company name | x 13; cap top 28.5 below the row top; baseline at 37.5; truncated at least 12.5 pt before the sparkline | [M] | `@ 138,384,338,18` (ink ends x=475, sparkline starts 500) |
| Sparkline box | x 194 from the sidebar edge, 55 wide; top 14 and bottom 39 below the row top (25 tall) | [M] | ink x=500..609 in all four rows measured; fill reaches the background at y=404 (row top 327); loss rows put the dashed line at the box top: `L` y=838 (row top 809), `D` y=931 (row top 905) |
| Sparkline data line | 1.5 thick, round joins | [M] | col x=580: anti-aliased 372, solid 373..375, anti-aliased 376 |
| Previous-close line | 1 thick, dashed: 2.3 on, 1.5 off (pitch 3.85 = 5 iOS pt x 0.77), full box width | [M] | `L` row y=381: dashes at 500..504, 508..511, 516..519, 524..528; `D` row y=401 the same x positions |
| Price | right edge 13 before the sidebar's right edge (x 317 from the sidebar edge); digit top 11.5 below the row top; shares the symbol's baseline | [M] | `@ 619,350,127,19` (sidebar ends 771) |
| Badge | 58.5 x 17.5; right edge 12 before the sidebar's right edge; top 26 below the row top; 4 above the separator | [M] | row y=396: fill 631..747; col x=640: partial 378, fill 379..413 (separator 422) |
| Badge corner radius | 2.5 | [M] | grid `@ 629,378,10,10`: edge at x=633 on row 379, 632 on 380, straight (631) from row 383 |
| Badge text | right-aligned, ink ends 4.5 before the badge's right edge; digit top 5 below the badge top | [M] | `@ 647,389,92,16` (badge 631..747 x 378..413) |
| Badge to price gap | 5 (price baseline 368 to badge top 378) | [C] | from the boxes above |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Row background (sidebar) | `#e7e8e9` | `#2c2d2f` | [M] | `@ 300,340` in both files |
| Separator | `#dcdcdd` | `#333436` | [M] | `L @ 300,422`; `D @ 300,422` |
| Symbol | `#000000` | `#e9e9ea` | [M] | `@ 139,349,140,20` (darkest / lightest ink) |
| Company name | `#808080` | `#98989d` in stems (lightest pixel `#9c9ca2 (sRGB #9c9ca3)`) | [M] | `L` col x=300: y=396..399; `D` col x=300: y=396..399, 769..786 |
| Price | `#000000` | `#ededed` | [M] | `@ 619,350,127,19` in both files |
| Badge, gain | `#65c366 (sRGB #35c759)` | `#65c366 (sRGB #35c759)` | [M] | `@ 745,395` in both files |
| Badge, loss | `#ec4d3d (sRGB #ff3b30)` | `#ec4d3d (sRGB #ff3b30)` | [M] | `L @ 745,877`; `D @ 745,975` |
| Badge text | `#ffffff` | `#ffffff` | [M] | row y=396: `@ 653,396`, `@ 668,396`; `D @ 715,396` |
| Data line, gain | `#76d472 (sRGB #4cd864)` | `#76d371 (sRGB #4dd763)` | [M] | `L @ 560,376`; `D @ 520,386` |
| Data line, loss | `#ec4d3d (sRGB #ff3b30)` | `#ec4d3d (sRGB #ff3b30)` | [M] | `L @ 560,856`; `D @ 520,964` |
| Dashed line, gain | `#8be087 (sRGB #6be47c)` (line colour at about 0.85) | `#6ec16a (sRGB #4ac55e)` | [M] | `L @ 509,381`; `D @ 502,401` |
| Dashed line, loss | `#ed594a (sRGB #ff4b40)` | `#db4b3c (sRGB #ed3c31)` | [M] | `L @ 502,839`; `D @ 502,932` |
| Fill under the line, gain | `#cee4cd (sRGB #c8e5cb)` just under the line -> `#e7e8e9` at the box bottom | `#374739 (sRGB #334838)` -> `#2c2d2f` | [M] | `L` col x=560: y=380..404; `D` col x=520: y=389..403 |
| Fill under the line, loss | `#e8c2bf (sRGB #efc0be)` -> `#e7e8e9` | `#433031 (sRGB #462f31)` -> `#2c2d2f` | [M] | `L` col x=560: y=860..886; `D` col x=520: y=970..982 |
| Fill as a gradient | line colour at 0.22 (light) / 0.16 (dark) at the line, falling linearly to 0 at the box bottom | same | [C] | (0xe7 - 0xce) / (0xe7 - 0x76) = 0.22; (0x47 - 0x2d) / (0xd3 - 0x2d) = 0.16 on the green channel |
| Selected row fill | `#f2f2f3` | `#575858` | [I] | from the `Business News` cell; no stock row is selected in either capture |

The badge colours do not change with the appearance. The gain line is lighter than the gain badge (`#76d472 (sRGB #4cd864)` against `#65c366 (sRGB #35c759)`); the loss line and loss badge are the same red [M].

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Symbol font | SF Pro Text 14 pt Medium (18 iOS pt x 0.77) | [C] | cap height 20 px (`D` 349..368) |
| Company name font | SF Pro Text 12.5 pt Regular (16 iOS pt x 0.77), tail-truncated | [C] | cap height 18 px (`D` 384..401); x-height 14 px |
| Price font | SF Pro Text 13 pt Regular (17 x 0.77), right-aligned, thousands separator | [C] | digit height 19 px (350..368); digits 13 to 15 px wide at a 16 px pitch |
| Badge font | SF Pro Text 11.5 pt Semibold (15 x 0.77), white, explicit sign (`+122.42`, `-0.99`), two decimals | [C] | digit height 16 px (389..404; loss row 870..887 measures 18 px including anti-aliasing); stems 2 px solid + anti-aliasing |
| Strings | symbol or index name (`Dow Jones`, `AAPL`); legal name (`Apple Inc.`) | [M] | see `apps/stocks.md` for all ten rows |
| Sparkline | SVG: a polyline of the session's prices scaled to the 55 x 25 pt box (vertical range = session low..high extended to include the previous close), `stroke-width:1.5`, `stroke-linejoin:round`; a closed path under it filled with the gradient; a dashed horizontal line at the previous close (`stroke-dasharray: 2.3 1.5`) | [M] geometry, [I] scaling rule | crops `@ 490,340,290,80`, `L @ 492,812,124,92` |

### Shadows and effects
None [M] (the pixels around the badge are the flat sidebar colour apart from one anti-aliased ring: row y=396 `#e1e2e2` at x=630 and 748).

## Layout and spacing
- Left inset 12.5 to 13.5 pt (= 16 to 17 iOS pt x 0.77) for text and separator; right inset 12 pt (badge) and 13 pt (price digits).
- The sparkline box is pinned 81 pt before the sidebar's right edge (x 194..249 of 330), so with a wider sidebar the name column grows and the sparkline, price and badge stay right-aligned [I].
- The badge has a fixed width; its text is right-aligned so decimal points line up down the list [M] (`+122.42` and `+23.02` both end at x=738).
- Rows are separated only by the inset hairline; the last row keeps its hairline [M] (y=1290).

## Keyboard and accessibility
Up/Down arrows move the selection when the list has focus; Return opens the ticker [I] (Catalyst table focus in 10.15 is limited). Each row is one accessibility element whose label reads symbol, name, price and change ("Apple Inc., 220.82, up 1.86") [I]. ARIA: `role="listbox"` with `role="option"` rows (`aria-selected`), or a list of buttons; the badge is a separate `<button>` when it toggles the value; give the sparkline `role="img"` with an `aria-label` describing the trend.

## Browser notes
Fully reproducible. Use `font-variant-numeric: tabular-nums` only if the columns must align digit by digit: the reference uses proportional digits with right alignment. The 48.25 pt pitch is fractional: use `height:48.25px` and let the 0.5 pt separator land between device pixels as in the reference, or round to 48 px.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Stocks.png` | 112,327,660,96 | gain row (`Dow Jones`, `+122.42`), full-session sparkline |
| light | `10-15-Catalina-Light-Stocks.png` | 112,809,660,96 | loss row (`DIS`, `-0.99`), red sparkline and badge |
| dark | `10-15-Catalina-Dark-Stocks.png` | 112,328,660,95 | gain row, partial-session sparkline |
| dark | `10-15-Catalina-Dark-Stocks.png` | 112,905,660,97 | loss row (`GE`, `-0.08`) |
| light | `10-15-Catalina-Light-Stocks.png` | 490,340,290,80 | sparkline, price and badge close-up |
| light | `10-15-Catalina-Light-Stocks.png` | 112,230,660,97 | `Business News` cell (the selected-cell fill) |

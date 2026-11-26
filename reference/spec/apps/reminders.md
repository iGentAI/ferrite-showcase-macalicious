# Reminders
- **Screenshots:** 10-15-Catalina-Light-Reminders.png, 10-15-Catalina-Dark-Reminders.png (a reminder's info popover is open and extends past the window's right edge)
- **Window:** 768 x 624 pt [M] (image x=112..1647, y=76..1323). Full-size content view: no title bar strip; the traffic lights float over the sidebar.

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Sidebar (`sidebar`), full window height | 280 wide (x=112..671) | `#e7e7e6` | `#2c2d2e` | [M] @ 300,1180 |
| Divider | 1 | `#cfcfce` | `#000000` | [M] @ 672,1180 |
| List pane | 487 wide (x=674..1647) | `#ffffff` | `#1e1f21` | [M] @ 1500,300 |
| Popover (`popover`), body | 290 x 301 (light x 1638..2217, y 404..1005; dark fill x 1640..2215, y 406..1003 inside a 1 pt rim). It extends 285 past the window's right edge | fill `#f2f2f2`, outer edge pixel `#bababa` at x=1637 | fill `#282828`, 1 pt rim `#535353`, 0.5 pt outer line `#040404` | [M] `10-15-Catalina-Light-Reminders.png @ 1600,900,690,1`; `10-15-Catalina-Dark-Reminders.png @ 1600,900,690,1` |
| Popover arrow, on the left edge pointing at the row's info button | 11.5 deep (light tip at x=1615, y=702; dark tip at x=1617, y=703), 149 below the popover top | fill `#f2f2f2` | fill `#282828` | [M] `10-15-Catalina-Light-Reminders.png @ 1600,704,60,1` |
| Popover separators | 1 pt at y 540, 762 and 832 | `#dbdbdb` | `#4b4b4b` | [M] `10-15-Catalina-Light-Reminders.png @ 1900,380,1,650`; `10-15-Catalina-Dark-Reminders.png @ 1900,380,1,650` |

```
| o o o                    |                                   [ + ] |
| [ Search              ]  |  iMac Colors                        13  |
| [Today 0] [Scheduled 0]  |  ( ) Bondi                              |
| [All  18] [Flagged   0]  |  ( ) Blueberry        ...               |
| My Lists                 |  ( ) Graphite                   (i)<|-- popover
|  (=) Reminders        0  |      [img]                              |
|  (=) Work             5  |  ( ) Snow                               |
|  (=) iMac Colors     13  |                                         |
| (+) Add List             |                                         |
```

## Components used
`window`, `window-controls`, `sidebar`, `sidebar-badge` (plain counts), `search-field` (in sidebar), `split-view`, `list-view` (reminders), `toolbar-button`-style "+" push button, `popover`, `checkbox`, `text-field`, `pop-up-button` ("Image"), `push-button` ("Add Image..."), `label`, `image-button` (info, flag, "Add List").

## App-specific elements
- Smart-list tiles, a 2 x 2 grid in the sidebar. Identical geometry in both captures. Image px; pt offsets are from each tile's top-left corner.

| Element | Image px | Size and position (pt) | Light | Dark | Tag | Evidence |
|---|---|---|---|---|---|---|
| Tile grid | columns x 144..383 and 400..639; rows y 256..373 and 390..507 | each tile 120 x 59; column gap 8, row gap 8; 16 from the sidebar's left edge and 16 from its right edge (divider at x=672) | fill `#d0d0d0` on sidebar `#e7e7e6` | fill `#404142` on `#2c2d2e` | [M] | `10-15-Catalina-Light-Reminders.png @ 130,300,530,1`; `10-15-Catalina-Light-Reminders.png @ 200,240,1,280`; `10-15-Catalina-Dark-Reminders.png @ 300,300` |
| Tile corner radius | corner at 144,256; top edge straight from x=157, left edge from y=269 | 6.5 | - | - | [M] | `10-15-Catalina-Light-Reminders.png @ 144,256,14,14` |
| Icon disc | x 160..207, y 272..319 in the first tile | 24 disc at (8, 8) | Today `#2f7cf6 (sRGB #027aff)`, Scheduled `#f19938 (sRGB #ff9503)`, All `#5c6269 (sRGB #5b626a)`, Flagged `#ec4d3d (sRGB #ff3b30)`; white glyph | `#3686f7 (sRGB #0885ff)`, `#f2a23c (sRGB #ff9f0b)`, `#5c6269 (sRGB #5b626a)`, `#ec5445 (sRGB #ff443a)` | [M] | `10-15-Catalina-Light-Reminders.png @ 165,296`; `10-15-Catalina-Light-Reminders.png @ 421,296`; `10-15-Catalina-Light-Reminders.png @ 165,430`; `10-15-Catalina-Light-Reminders.png @ 421,430` |
| Count | digit ink x 340..361, y 282..309 ("0"); two digits x 321..361 ("18") | right-aligned, ink ends 11 from the tile's right edge; digit top 13 below the tile top; digit height 28 px | `#686867` | `#a9a9aa` | [M] | `10-15-Catalina-Light-Reminders.png @ 340,282,22,28` |
| Count font | from the 28 px digit height | 20 pt, Bold | - | - | [C] size; [I] weight (judged from 4 px stems) | same |
| Title | ink from x 164 ("Today"), cap top y 335 | ink starts 10 from the tile's left edge; cap top 39.5 below the tile top; baseline 10.5 above the tile bottom | `#686867` | `#a9a9aa` | [M] | `10-15-Catalina-Light-Reminders.png @ 164,335,72,24` |
| Title font | from the 18 px cap height | 13 pt, Semibold | - | - | [C] size; [I] weight | same |
- "My Lists" rows: 36 pt high, 22 pt coloured disc with a white list glyph (x=152..195; blue `#2e7cf7 (sRGB #007aff)`, green `#377d21 (sRGB #008000)`), 13 pt label, right-aligned count `#686867`; selected row `#c7c7c6` / `#505152`. [M] @ 152,586,44,44 and 660,716,1,72.
- List title "iMac Colors": line box y=173..224, colour = the list colour `#2f7cf6 (sRGB #027aff)` (dark `#3686f7 (sRGB #0885ff)`) [M] `10-15-Catalina-Light-Reminders.png @ 710,173,369,52`; count "13" right-aligned with its ink ending at x=1610 [M]. Font: about 34 pt [C] from the cap height (uncertainty 1 pt); the rounded design and the Heavy weight of the title and Light weight of the count are judged by eye [I].
- Reminder row: see `list-view` (34 pt pitch, 18 pt circle, separators inset 50 pt). The edited row is tinted `#f3f3f3` / `#303133` and shows a blue (i) button at the right and an image thumbnail under the title.
- "+" button: top-right of the list pane. Light: x 1555..1632, y 91..131 including its edges and shadow row (39 x 20 pt: white fill x 1556..1631, y 92..129, edge `#d0d0d0`); its right edge is 7.5 pt from the window's right edge and its top 7.5 pt below the window top. Dark: fill `#565759` x 1556..1631, y 92..129 (38 x 19 pt) with a top highlight `#78797a`. Plus glyph 11 pt wide with 1 pt strokes (horizontal bar x 1583..1604, y 111..112; `#272727` light, `#e5e5e5` dark). [M] `10-15-Catalina-Light-Reminders.png @ 1540,112,110,1`; `10-15-Catalina-Dark-Reminders.png @ 1540,112,110,1`.

Info popover contents. Image px in the light capture; the dark capture has every element at the same image position within 2 px. Offsets in pt are from the popover body's top-left corner (x=1638, y=404).

| Element | Image px (light) | Size and position (pt) | Light | Dark | Tag | Evidence |
|---|---|---|---|---|---|---|
| Title "Graphite" | ink x 1667..1796, y 445..476 | ink starts 14.5 from the left edge; cap top 20.5 below the top | `#000000` | `#ffffff` | [M] | `10-15-Catalina-Light-Reminders.png @ 1667,445,130,32` |
| Title font | cap height about 24 px | 17 pt, Bold | - | - | [C] size; [I] weight | same |
| Flag button | x 2126..2189, y 437..479 with shadow rows (dark x 2128..2187, y 438..477) | 32 x 20 (dark 30 x 20); right edge 14 from the popover's right edge; top 16.5 below the top | see `push-button` with image | same | [M] | `10-15-Catalina-Light-Reminders.png @ 2126,437,64,43`; `10-15-Catalina-Dark-Reminders.png @ 2128,438,60,40` |
| Placeholder "Notes" | ink x 1669..1735, y 499..517 | 13 pt [C]; 15.5 from the left edge | `#b7b8b8` | `#696a6a` | [M] | `10-15-Catalina-Light-Reminders.png @ 1669,499,67,19` |
| Separators | x 1666..2189 at y 540, 762, 832 | 262 wide, 1 thick; inset 14 from each side | `#dbdbdb` | `#4b4b4b` | [M] | `10-15-Catalina-Light-Reminders.png @ 1666,540,524,2` |
| Label column ("remind me", "priority", "URL", "images") | ink right edge x 1781..1782; ink tops y 572, 791, 860, 907 | right-aligned 72.5 from the left edge; 13 pt [C] | `#737373` | `#a4a4a4` | [M] | `10-15-Catalina-Light-Reminders.png @ 1669,572,114,19`; `10-15-Catalina-Light-Reminders.png @ 1706,791,77,22` |
| Control column | starts x 1806 | 84 from the left edge (11.5 after the label column) | - | - | [M] | `10-15-Catalina-Light-Reminders.png @ 1800,580,40,1` |
| Checkboxes "On a Day", "At a Location", "When Messaging a Person" | boxes x 1806..1833; rows y 566..593, 622..649, 678..705 | 14 box; row pitch 28; title 13 pt [C], its ink starting 4.5 after the box (x 1842..1843). The third is checked (accent fill) | title `#3f3f3f` | title `#ffffff` | [M] | `10-15-Catalina-Light-Reminders.png @ 1806,566,143,29`; `10-15-Catalina-Light-Reminders.png @ 1806,678,346,29` |
| "Add Contact" | ink x 1842..1978, y 722..740 | 13 pt [C]; aligned with the checkbox titles (102 from the left edge) | `#737373` | `#a4a4a4` | [M] | `10-15-Catalina-Light-Reminders.png @ 1842,722,137,19` |
| Value "None" (priority) | ink x 1807..1867, y 789..808 | 13 pt [C] | `#3e3e3e` | `#ffffff` | [M] | `10-15-Catalina-Light-Reminders.png @ 1807,789,61,20` |
| Placeholder "None" (URL) | ink x 1805..1865, y 859..877 | 13 pt [C] | `#b8b8b7` | `#696a6a` | [M] | `10-15-Catalina-Light-Reminders.png @ 1805,859,61,19` |
| Pop-up button "Image" (`pop-up-button`, with a 16 pt image) | x 1801..2148, y 898..938 with shadow rows | 174 x 20; right edge 34.5 from the popover's right edge | see `pop-up-button` | same | [M] | `10-15-Catalina-Light-Reminders.png @ 1801,898,348,41` |
| Button "Add Image..." (`push-button`) | x 1803..1976, y 945..985 with shadow rows | 87 x 20; 3.5 below the pop-up; bottom 10 above the popover's bottom edge (y=1005) | see `push-button` | same | [M] | `10-15-Catalina-Light-Reminders.png @ 1803,945,174,41` |

## Content in the screenshot
Search placeholder "Search". Tiles: Today 0, Scheduled 0, All 18, Flagged 0. "My Lists": Reminders 0, Work 5, iMac Colors 13 (selected). "Add List". Title "iMac Colors" / "13". Reminders: Bondi, Blueberry, Strawberry, Grape, Lime, Tangerine, Graphite (selected, with image), Snow, Sage, Ruby (info button shown), Indigo, Flower Power, Blue Dalmation. Popover: "Graphite", "Notes", "remind me": [ ] On a Day, [ ] At a Location, [x] When Messaging a Person, "Add Contact"; "priority" None; "URL" None; "images" [Image] pop-up; "Add Image...".

## Not reproducible / assets needed
Smart-list and list glyphs; the iMac thumbnail image.

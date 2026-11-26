# Store and media card grids and shelves (`card-grid`)

- **Status:** present
- **AppKit:** `NSCollectionView` (flow / compositional layout, macOS 10.15) with custom item views; Podcasts and News use `UICollectionView` through Mac Catalyst. No system-drawn card style exists: every card below is app-drawn.
- **HIG:** none specific. Related: image views https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/image-views/ ; Mac Catalyst scaling https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/ios/overview/mac-catalyst/
- **Appearances shown:** light, dark

## Purpose and behaviour
A family of browsing layouts used by the App Store, TV, Music, Podcasts, Books and News: a vertical scroll of **sections**; each section has a **header** (title at the leading edge, optional `See All` link at the trailing edge) followed by either a horizontally paging **shelf** of cards, a wrapping **grid** of cells, or a multi-column **lockup list**. Sections are divided by full-width hairlines. Shelves page with thin chevrons that sit in the side margins; a chevron is dimmed when there is nothing further in that direction [M] (TV dark: left chevron dim, right bright after paging).

## Anatomy
```
| margin |  Section title                                  See All | margin |
|   <    |  [ card ][ card ][ card ][ card ]                        |   >    |
|        |-----------------------------------------------------------|       |  hairline
|        |  [icon] Title            (GET)  |  [icon] Title   ($9.99) |       |  lockup list
|        |         Subtitle       In-App.. |         Subtitle        |       |
```
Card variants (back to front): artwork or tinted panel clipped to a rounded rectangle; optional hairline inner border (on light artwork); optional drop shadow; text either below the artwork (media cells) or inside the panel (editorial cards).

## Variants and parameters
| Variant | Used by | Size (pt) | Shown |
|---|---|---|---|
| Landscape artwork card (16:9), shelf | TV "What to Watch" | 288.5 x 162.5 | light, dark |
| Wide trailer card, shelf | TV "Watch New Trailers" | 391.5 wide (top 21 pt visible) | light, dark |
| Hero banner | TV (tv+), App Store (Discover) | TV 1214 x 455; App Store 945 wide, at least 340 tall (top clipped by scrolling) | light, dark |
| Editorial panel card | App Store | 462 x 230 | light, dark |
| App lockup row | App Store | 301 x 69 per row, 3 columns | light, dark |
| Square artwork cell with 2 text lines | Music albums | 168 x 168 + text | light, dark |
| Square artwork card with caption, title, description | Podcasts "Up Next" | 252 x 252 + text | light, dark |
| Book cover cell | Books library | 145.5 x 190; see `book-cover` | light, dark |
| Story card (image, publisher logo, headline, age) | News, Stocks | lead 399 x 300 image; see `story-card`, `catalyst-chrome` and the app blueprints | light, dark |
| Pill button (`GET` / price) | App Store | 66 x 21 | light, dark |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes | all files |
| hover (card lifts / play button overlay) | no | [I] TV and Music overlay a circular play/more button on hover; not captured |
| pressed | no | [I] card dims by about 10% |
| pill: `GET`, price | yes | `10-15-Catalina-Light-Mac-App-Store.png @ 1102,1465,132,42` and `@ 1744,1465,132,42` |
| pill: `OPEN`, download progress, cloud | no | [I] same pill with the other label; progress is a 21 pt circular indicator |
| shelf chevron enabled / disabled | yes | TV: `Light @ 2647,1149,26,58` enabled, `Light @ 139,1149,25,58` disabled; `Dark @ 2647,379,26,58` enabled, `Dark @ 139,379,25,58` disabled |

## Measurements
Evidence shorthand: `TV`, `Music`, `Podcasts`, `Books` and `App Store` before `@` mean `10-15-Catalina-Light-<App>.png` (`App Store` = `Mac-App-Store`); `Light` / `Dark` select the appearance; where a row gives both a Light and a Dark value with one location, the location holds in both files. Within a block of rows headed by a bold app name, a bare `@`, `row y=` or `col x=` refers to that app's Light file.

Window origin is image px (112, 76) in the App Store, TV, Music and Podcasts captures.

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| **TV** content side margin | 40 | [M] | `10-15-Catalina-Light-TV.png`: cards start x=192, end x=2619 (window 112..2699) |
| TV card size | 288.5 x 162.5 (577 x 325 px, 16:9) | [M] | third card `@ 1426,246,577,325`; first card x=192..768 |
| TV card gap | 20 | [M] | 769..808 between cards 1 and 2 (row y=400) |
| TV card / hero corner radius | circular fit 11; the edge leaves the straight line 9 pt from the corner (continuous-curvature corner) | [C] | first card top-left: artwork begins at x=210, 207, 205, 203, 202, 200, 199, 198, 197, 197, 196, 195, 195, 194 on rows y=246..259 (card edge x=192); hero identical on rows 714..727 |
| TV card inner border | 0.5 pt (1 px), visible on light artwork | [M] | `Light @ 1426,400` and `@ 1700,246` |
| TV hero banner | 1214 x 455 | [M] | `@ 192,714,2428,910` |
| TV trailer card | 391.5 wide, gap 20 | [M] | row y=1810: 192..974, next from 1015 |
| TV section header | cap top 17 pt below the toolbar / 17 pt below a separator; cards start 18.5 pt below the header baseline | [M] | header caps y=184..209 and 1723..1748; cards y=246 and 1785; toolbar ends y=149, separator y=1688 |
| TV section separator | 1 pt, inset to the 40 pt margins, 32 pt below the card bottom | [M] | `@ 192,634,2428,2`; card bottom y=570 |
| TV tv+ logo | 47 x 18, 10.5 pt below the separator; hero starts 11 pt below it | [M] | `@ 192,656,94,36` |
| Shelf chevron | 12.5 x 29 box, 1 pt stroke, two segments meeting at the outer middle; 13.5 pt from the window edge; vertically centred on the shelf | [M] | `TV Light @ 139,1149,25,58`, `@ 2647,1149,26,58`; Podcasts `@ 661,663,25,58` |
| **App Store** hero | 945 wide; bottom corners radius about 6 | [M]/[C] | `10-15-Catalina-Light-Mac-App-Store.png @ 634,76,1890,680`; bottom-left corner edge at x=642, 640, 638, 637, 636, 636, 635 on rows y=755..749 |
| App Store editorial card | 462 x 230, gap 20, 20 pt below the hero | [M] | `@ 634,796,924,460` and `@ 1598,796,924,460` |
| App Store card radius | about 8 (continuous) | [C] | Dark top-left: card begins at x=649, 644, 642, 640, 639, 638, 637, 637, 636, 636, 635 on rows y=796..806 (edge x=634) |
| Editorial card text inset | 32.5 from the card's left edge; eyebrow cap top 28 pt below the card top | [M] | eyebrow `@ 699,852,141,16` |
| Editorial card artwork | 170 pt circle, 15 pt from the card's right edge, 30 pt from top and bottom | [M] | `@ 1188,856,340,340` |
| App Store section separator | 1 pt, 36.5 pt below the cards | [M] | `@ 634,1328,1890,2` |
| App Store section header | cap top 17 pt below the separator; lockups start 22.5 pt below its baseline | [M] | caps y=1363..1391; first icon y=1436 |
| Lockup grid | 3 columns of 301 pt with 20 pt gaps; row pitch 69 pt | [M] | row separators start at x=762, 1404, 2046 and end at 1235, 1877, 2519; separators at y=1554 and 1692 |
| Lockup icon | 50 x 50, 9 pt above and below within the row | [M] | `@ 634,1436,100,100` |
| Lockup text | starts 65 pt from the icon's left edge (15 pt gap) | [M] | title ink x=764 |
| Lockup row separator | 1 pt, from the text's left edge to the column's right edge | [M] | `@ 762,1554,474,2` |
| Pill button | 66 x 21, fully rounded (radius 10.5); right-aligned in the column; vertically centred on the icon | [M] | `@ 1102,1465,132,42` (col x=1170: 1465..1506) |
| Pill caption (`In-App Purchases`) | centred under the pill, cap top 7.5 pt below the pill | [M] | `@ 1111,1521,114,12` |
| **Music** album artwork | 168 x 168, radius 4 | [M]/[C] | `10-15-Catalina-Light-Music.png @ 632,266,336,336`; corner edge at x=637, 635, 634, 633, 633, 632 on rows 266..271 |
| Music grid origin | 39 pt right of the sidebar divider, 40 pt below the bar | [M] | artwork x=632 (pane starts 554), y=266 (content starts 186) |
| Music cell text | title cap top 7 pt below the artwork; artist baseline 16.5 pt below the title baseline | [M] | title ink y=616..638, artist 648..666 |
| **Podcasts** artwork | 252 x 252, radius about 3 | [M]/[C] | `10-15-Catalina-Light-Podcasts.png @ 714,440,504,504`; corner at x=718, 717, 716, 715, 714 on rows 440..444 |
| Podcasts card text | caption cap top 12 pt below the artwork; title cap top 9 pt below the caption; description lines at 15 pt pitch; duration 9 pt below | [M] | ink rows y=968..984, 1001..1024, 1046..1068, 1076..1097, 1106..1128, 1142..1160 |
| Podcasts page header | large title cap top 93.5 pt below the window top; 1 pt hairline 16.5 pt below its baseline; shelf header cap top 16.5 pt below the hairline; artwork 18 pt below the shelf baseline | [M] | caps 263..311; hairline y=344..345; `Up Next` 378..404; artwork y=440 |
| **Books** cover cell | 145.5 x 190, square corners | [M] | `10-15-Catalina-Light-Books.png @ 656,244,291,380` |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Page background | App Store, TV, Music, Podcasts `#ffffff` | App Store `#1e1f22`; TV, Music `#1e2022`; Podcasts `#1e1e1e` | [M] | App Store `@ 600,500` (Dark); TV `@ 2528,200` |
| Editorial card fill (App Store) | `#f7f7f8` | `#343538` | [M] | App Store `@ 700,1000` in both files |
| Section separator | App Store `#e6e6e6`; TV `#f4f4f4`; Podcasts `#e6e6e6` | App Store `#343538`; TV `#282a2c`; Podcasts `#343434` | [M] | App Store `@ 900,1328`; TV `@ 1000,634`; Podcasts col x=1500 @ y=344 |
| Lockup row separator | `#e6e6e6` | `#343538` | [M] | App Store `@ 900,1554` |
| Section title | App Store `#272727`; TV `#0c0c0c`; Podcasts `#272727` | `#dddddd`; TV `#e9e9e9` | [M] | App Store `@ 638,1363,659,37`; TV `@ 194,184,33,26` |
| `See All` link | `#2f7cf6 (sRGB #027aff)` (stored accent blue) | App Store `#3686f7 (sRGB #0885ff)`; TV, Podcasts `#2f7cf6 (sRGB #027aff)` | [M] | App Store `@ 2504,1380`; TV `@ 2528,188,90,23` (both files) |
| Eyebrow / body text on editorial card | `#7c7c7c` | `#a3a4a5` | [M] | App Store `@ 699,852,141,16` |
| Editorial card title | `#262626` | `#e0e0e1` | [M] | App Store `@ 698,887,178,36` |
| Lockup title | `#272727` | `#dddddd` | [M] | App Store `@ 764,1456,165,20` |
| Lockup subtitle | `#8e8e93` | `#98989d` | [M] | App Store `@ 763,1494,282,22` |
| Pill fill | `#f2f2f7` | `#f2f2f7` (unchanged in dark) | [M] | App Store `@ 1110,1486` in both files |
| Pill label | `#2f7cf6 (sRGB #027aff)` | `#3686f7 (sRGB #0885ff)` | [M] | App Store `@ 1146,1486` in both files |
| Pill caption | `#808080` | `#9a9a9b` | [M] | App Store palette `@ 1110,1521,115,13` in both appearances; also `store-pill-button` |
| TV card inner border | `#e6e6e6` | `#e6e6e6` | [M] | TV `@ 1700,246` (Light); TV Dark `@ 1426,400` |
| Music title / artist | `#000000` / `#808080` | `#dddddd` / `#9a9a9b` | [M] | `Music @ 633,616,222,23`, `@ 634,648,29,19` |
| Podcasts caption / title / description | `#7e7e7e` / `#272727` / `#808080` | `#9a9a9a` / `#dddddd` / `#9a9a9a` | [M] | ink rows listed above, both files |
| Chevron enabled / disabled | `#262626` / `#d4d4d4` (Podcasts `#e6e6e6`) | `#dddede` / `#444647` | [M] | TV boxes listed under States |

### Text and icons
| Role | Font (SF Pro) | Tag | Evidence |
|---|---|---|---|
| TV section title | 18 pt Bold | [C] | cap 26 px (`W` 184..209) |
| TV `See All` | 15 pt Regular | [C] | cap 21 px (`A` 189..209) |
| App Store section title | 20.5 pt (cap 29 px), Semibold | [C] | `A` 1363..1391 |
| App Store `See All` | 15.5 pt Regular | [C] | cap 22 px (`A` 1370..1391) |
| App Store hero eyebrow | 11 pt Semibold, uppercase, grey over the photo (`#878785` on cloud) | [C] | cap 16 px `@ 689,178,151,16` |
| App Store hero title | 24 pt Regular, `#303033`, 28 pt line pitch | [C] | cap 34 px (`E` 240..273); second line cap top y=296 |
| Editorial eyebrow | 11 pt Semibold, uppercase | [C] | cap 16 px (852..867) |
| Editorial title | 20.5 pt Regular (cap 29 px) | [C] | `A` 887..915 |
| Editorial body | 12 pt Regular, 19 pt line pitch | [C] | cap 17 px (`T` 963..979); lines at y=962 and 1000 |
| Lockup title | 14 pt Regular | [C] | cap 20 px (`H` 1456..1475) |
| Lockup subtitle | 12 pt Regular, up to 2 lines, 15 pt pitch | [C] | cap 17 px (`Y` 1495..1511) |
| Pill label | 13 pt Bold, uppercase for `GET` | [C] | cap 18 px (`G` 1477..1495, `E` 1477..1494) |
| Pill caption | 7 pt Regular | [C] | cap 10 px (1521..1530) |
| Music title, artist | 13 pt Regular | [C] | cap 18 px (`S` 616..633); `U2` 19 px |
| Podcasts large title | 34.5 pt Bold (45 pt iOS x 0.77) | [C] | cap 49 px (`L` 263..311) |
| Podcasts shelf title | 18.5 pt Bold (24 pt x 0.77) | [C] | cap 26 px (`N` 378..403) |
| Podcasts `See All` | 15.5 pt Regular (20 pt x 0.77) | [C] | cap 22 px (`A` 382..403) |
| Podcasts caption (`NEW · SUNDAY`) | 11.5 pt Semibold, uppercase (15 pt x 0.77) | [C] | cap 16 px (968..983) |
| Podcasts episode title | 15.5 pt Regular | [C] | cap 22 px (`I` 1002..1023) |
| Podcasts description, duration | 12.5 pt Regular (16 pt x 0.77), 15 pt pitch | [C] | cap 17-18 px (`I` 1047..1063) |

### Shadows and effects
| Card | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| TV cards and hero | grey falloff under the card: `#c9c9c9` at 0.5 pt, `#e5e5e5` at 5 pt, `#fbfbfb` at 10 pt; at the sides `#e1e1e1` at 0.5 pt, `#f2f2f2` at 3 pt, `#fefefe` at 8 pt; above `#f8f8f8` at 0.5 pt | below `#18191b` at 0.5 pt, `#1b1d1f` at 5 pt (page `#1e2022`) | [M] | `TV Light @ 1700,571`, `@ 1700,580`, `@ 1700,590`, `@ 1425,400`, `@ 1420,400`, `@ 1410,400`, `@ 1700,245`; Dark `@ 1700,571`, `@ 1700,580` |
| TV cards, fitted CSS | `box-shadow: 0 3px 8px rgba(0,0,0,.22)` | `0 3px 8px rgba(0,0,0,.35)` | [C] | from the falloff above |
| Music artwork | below `#e1e1e1` at 0.5 pt, `#ededed` at 2.5 pt, `#f9f9f9` at 5 pt; side `#f7f7f7` at 0.5 pt | below `#1a1c1e` at 0.5 pt | [M] | `Music @ 700,602`, `@ 700,606`, `@ 700,611`, `@ 631,400` |
| Music artwork, fitted CSS | `0 2px 5px rgba(0,0,0,.15)` | `0 2px 5px rgba(0,0,0,.3)` | [C] | - |
| Podcasts artwork | below `#f1f1f1` at 0.5 pt, `#f6f6f6` at 5 pt, `#fafafa` at 10 pt; side `#f5f5f5` at 0.5 pt, `#fafafa` at 5 pt; above `#fafafa` at 1 pt | below `#1c1c1c` (page `#1e1e1e`) | [M] | `Podcasts @ 900,944`, `@ 900,954`, `@ 900,963`, `@ 1218,700`, `@ 1228,700`, `@ 900,438` |
| Podcasts artwork, fitted CSS | `0 2px 12px rgba(0,0,0,.08)` | `0 2px 12px rgba(0,0,0,.2)` | [C] | - |
| Books cover | below `#cacaca` at 0.5 pt fading to white by 4 pt; right `#d9d9d9` fading by 3 pt | below `#18191b` at 0.5 pt fading to page `#1e2022` by 4 pt; right `#191b1d` fading to page by 3 pt | [M] | 10-15-Catalina-Light-Books.png @ 800,624,1,8; 10-15-Catalina-Light-Books.png @ 947,500,6,1; 10-15-Catalina-Dark-Books.png @ 800,624,1,8; 10-15-Catalina-Dark-Books.png @ 947,500,6,1 |
| App Store cards, hero, lockups | no shadow, no border | same | [M] | App Store col x=700: `#ffffff` up to y=795, card fill from y=796 |

## Layout and spacing
- Side margins: 40 pt (TV, Podcasts, App Store pane). Card gap 20 pt everywhere.
- TV shelf: 4 cards visible in a 1214 pt wide content area: `(1214 - 3 x 20) / 4 = 288.5`; trailer shelf: 3 cards, `(1214 - 2 x 20) / 3 = 391.3` [C]. Cards resize with the window; the gap and margins stay fixed [I].
- App Store: content column 945 pt = two 462.5 pt cards + 20 pt gap = three 301.7 pt lockup columns + 2 x 20 pt [C].
- Section rhythm: card bottom -> 32-36 pt -> separator -> 17 pt -> header cap -> about 18-22 pt -> next cards.

## Keyboard and accessibility
Arrow keys move the selection between cells when the collection view has focus; Return opens; Space plays (media) [I]. Cells are `AXCell`s inside an `AXGrid`/`AXList`; `See All` is an `AXLink`/button; the pill is an `AXButton` whose label includes the price. ARIA: `role="list"` / `listitem` for shelves, `link` for `See All`, `button` for pills and chevrons (`aria-disabled` when dimmed).

## Browser notes
- Continuous-curvature ("squircle") corners on TV, App Store and Home cards cannot be drawn with `border-radius`; use the circular-fit radius given (visually within 1 px) or an SVG clip path.
- The pill keeps its light fill in dark mode: do not derive it from a dark-mode control token.
- Artwork is image assets.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-TV.png` | 192,170,2428,460 | shelf header, See All, 4 landscape cards with shadows |
| dark | `10-15-Catalina-Dark-TV.png` | 192,170,2428,460 | same, dark; enabled right chevron |
| light | `10-15-Catalina-Light-TV.png` | 192,650,2428,980 | tv+ logo and hero banner |
| light | `10-15-Catalina-Light-Mac-App-Store.png` | 634,796,1888,460 | two editorial panel cards |
| dark | `10-15-Catalina-Dark-Mac-App-Store.png` | 634,796,1888,460 | same, dark |
| light | `10-15-Catalina-Light-Mac-App-Store.png` | 634,1330,1890,460 | section header, See All, lockup list with GET / price pills |
| dark | `10-15-Catalina-Dark-Mac-App-Store.png` | 634,1330,1890,460 | same, dark (pills stay light) |
| light | `10-15-Catalina-Light-Music.png` | 632,266,336,410 | album cell |
| light | `10-15-Catalina-Light-Podcasts.png` | 714,378,1592,790 | shelf header and episode card |
| light | `10-15-Catalina-Light-Books.png` | 656,244,291,380 | book cover cell |

# App Store
- **Screenshots:** `10-15-Catalina-Light-Mac-App-Store.png`, `10-15-Catalina-Dark-Mac-App-Store.png` (window captures)
- **Window:** 1246 x 857 pt [M] (`@ 112,76,2492,1714` in both). Full-size content window without title bar or toolbar: full-height sidebar holding the traffic lights; scrolling content pane (scrolled a little: the hero's top edge is under the window top).

## Layout
Evidence shorthand: `Light @` / `Dark @` are the two screenshots above; a bare `@ x,y[,w,h]`, `row y=` or `col x=` refers to the Light file and holds at the same coordinates in the Dark file unless a Dark location is given.

Positions in pt from the window's top-left (image px = 2 x pt + (112, 76)).

| Region | x, y, w, h | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Sidebar | 0, 0, 220, 857 | `#e7e8e9` | `#2c2d2f` | [M] `@ 300,500` |
| Sidebar divider | 220, 0, 1, 857 | `#cfd0d1` | `#000000` | [M] `@ 552,500` |
| Content pane | 221, 0, 1025, 857 | `#ffffff` | `#1e1f22` | [M] `@ 600,500` (Dark); Light row y=250 @ x=554..633 |
| Content column | 261, -, 945, - (40 pt side margins) | - | - | [M] hero x=634..2523 |

```
 0          220 221   261                                           1206   1246
 +-----------+------------------------------------------------------------+
 |(o)(o)(o)  |      +--------------------------------------------------+   |
 | [ Search ]|      | GET STARTED                       hero (photo)  |   |
 | [Discover]|      | Extensions for Fast Photo Edits                 |   |
 |  Arcade   |      +--------------------------------------------------+   | 340
 |  Create   |      +-----------------------+ +-----------------------+   | 360
 |  Work     |      | COLLECTION      (o)   | | FEATURED APP    (o)   |   |
 |  Play     |      | Act Fast!             | | Print a Photo Project |   |
 |  Develop  |      +-----------------------+ +-----------------------+   | 590
 |  Categories|     ---------------------------------------------------   | 626
 |  Updates  |      Apps and Games We Love Right Now           See All    |
 |           |      [i] Homescapes   GET | [i] Overflow 3 $14.99 | ...    |
 | (o) Sign In|     [i] Noizio Lite  GET | [i] Total War  $49.99 | ...    |
 +-----------+------------------------------------------------------------+ 857
```

### Sidebar (pt)
| Element | x, y, w, h | Style (Light / Dark) | Tag / evidence |
|---|---|---|---|
| Traffic lights | x 13, 33, 53; y 13 (12 pt circles), inside the sidebar | - | [M] close button box `@ 138,102,24,24`, zoom ends x=241 |
| Search field | 20, 49, 180, 26; 1 pt border; fully centred placeholder with magnifier | fill `#e3e5e5`, border `#aaacac`, placeholder `#aaacac`, glyph `#646666` / fill `#454649`, border `#68696c` | [M] `@ 152,174,360,52`; `@ 300,200`, `@ 400,174` |
| Row pitch | 42 | - | [M] selection 264..347 px; icons at 366, 448, 534, 617 px |
| Selection (Discover) | 0, 94, 220, 42 | `#c7c8c9` / `#505153` | [M] `@ 300,300` |
| Rows | selection-height slots at y 94, 136, 178, 220, 262, 304, 346, 388 | - | [C] from the 42 pt pitch |
| Row icon | x 20, about 26 x 24, vertically centred | monochrome glyph `#68696a` (selected `#48494a`) / `#a8a9ab` | [M] `@ 152,366,52,48` |
| Row text | x 58.5 | 18.5 pt Regular (cap 26 px), `#4c4c4c` / `#e5e5e5` | [M]/[C] `D` `@ 231,292,21,26` |
| Account button | avatar circle 40 x 40 at (20, 797); label x 71.5 | glyph `#68696a`; label `Sign In` 14 pt Bold `#343536` / `#ffffff` | [M] `@ 152,1670,80,80`; `@ 255,1699,84,26` |

### Content (pt)
| Element | x, y, w, h | Style (Light / Dark) | Tag / evidence |
|---|---|---|---|
| Hero card | 261, top above the window, bottom at y 340; 945 wide | photo, bottom corners radius 6 | [M] `@ 634,76,1890,680` |
| Hero eyebrow | x 288.5; cap top y 51 | 11 pt Semibold uppercase, grey `#878785` over the photo | [M] `@ 689,178,151,16` |
| Hero title (2 lines) | x 289.5; cap tops y 82, 110 | 24 pt Regular, `#303033` | [M] `@ 691,240,516,34` |
| Hero body | x 288.5, under the title (mostly hidden by the mountain in the photo) | 13 pt, grey | [I] preview-only estimate; the partially obscured body was not pixel-measured |
| Editorial card 1 | 261, 360, 462, 230 | fill `#f7f7f8` / `#343538`, radius 8 | [M] `@ 634,796,924,460` |
| Editorial card 2 | 743, 360, 462, 230 | same | [M] `@ 1598,796,924,460` |
| Card eyebrow | card x + 32.5; cap top y 388 | 11 pt Semibold uppercase, `#7c7c7c` / `#a3a4a5` | [M] `@ 699,852,141,16` |
| Card title | cap top y 405.5 | 20.5 pt Regular, `#262626` / `#e0e0e1` | [M] `@ 698,887,178,36` |
| Card body (2 lines) | tops y 443, 462 | 12 pt Regular, `#7c7c7c` / `#a3a4a5` | [M] ink rows 962, 1000 px |
| Card artwork | 170 pt circle at card x + 277, y 390 | image | [M] `@ 1188,856,340,340` |
| Separator | 261, 626, 945, 1 | `#e6e6e6` / `#343538` | [M] `@ 900,1328` |
| Section title | x 263; cap top y 643.5 | 20.5 pt Semibold, `#272727` / `#dddddd` | [M] `@ 638,1363,659,37` |
| `See All` | right edge x 1200.5; cap top y 647 | 15.5 pt, `#2f7cf6 (sRGB #027aff)` / `#3686f7 (sRGB #0885ff)` | [M] `@ 2423,1369,91,24` |
| Lockup columns | x 261, 582, 903; each 301 wide | - | [M] separators from 762, 1404, 2046 px |
| Lockup rows | icon tops y 680, 749, 818 (69 pt pitch); icon 50 x 50 | - | [M] `@ 634,1436,100,100`; separators y=1554, 1692 px |
| Lockup title / subtitle | column x + 65; title cap top y 690; subtitle top y 709 | 14 pt `#272727` / `#dddddd`; 12 pt `#8e8e93` / `#98989d` | [M] `@ 764,1456,165,20`; `@ 763,1494,282,22` |
| Pill | column right edge - 67 (x 495 in column 1), y 694.5; 66 x 21 | fill `#f2f2f7` in both; label 13 pt Bold `#2f7cf6 (sRGB #027aff)` / `#3686f7 (sRGB #0885ff)` | [M] `@ 1102,1465,132,42` |
| `In-App Purchases` | centred under the pill; top y 722.5 | 7 pt, `#808080` / `#9a9a9b` | [M] `@ 1110,1521,115,13` in each appearance; see `store-pill-button` |
| Row separator | column x + 64 to column right edge; y 739, 808 | `#e6e6e6` / `#343538` | [M] `@ 762,1554,474,2` |

## Components used
- `card-grid`: hero, editorial cards, section header, lockup list.
- `store-pill-button`: GET/price capsules and purchase captions.
- `sidebar` (deviations: 42 pt rows, 18.5 pt labels, 26 pt monochrome icons, grey selection), `search-field` (26 pt bordered, centred placeholder), `split-view`.
- `window`, `window-shadow`, `window-controls`, `scroll-view`.

## App-specific elements
All covered by `card-grid`. The account button at the sidebar's bottom-left is a 40 pt circular avatar placeholder plus a bold label.

## Content in the screenshot
- Sidebar: search placeholder `Search`; rows `Discover` (selected), `Arcade`, `Create`, `Work`, `Play`, `Develop`, `Categories`, `Updates`; `Sign In`.
- Hero: `GET STARTED` / `Extensions for Fast Photo` / `Edits` / body beginning `Make multistep tweaks with…` (second body line starts `window…`).
- Card 1: `COLLECTION` / `Act Fast!` / `These games push your reaction` / `time to the limit.`
- Card 2: `FEATURED APP` / `Print a Photo Project` / `Create a book, calendar, or card with` / `Mimeo Photos.`
- Section: `Apps and Games We Love Right Now` / `See All`.

| Column | Row | Title | Subtitle | Pill | Caption |
|---|---|---|---|---|---|
| 1 | 1 | Homescapes | Your home is your puzzle | `GET` | In-App Purchases |
| 1 | 2 | Noizio Lite | Calm meditation nature sounds (2 lines) | `GET` | - |
| 1 | 3 | Ulysses | The ultimate writing app | `GET` | (cut off) |
| 2 | 1 | Overflow 3 | Visual launcher and organizer (2 lines) | `$14.99` | - |
| 2 | 2 | Total War: THREE KINGDOMS (2 lines) | An era of legendary conq... | `$49.99` | In-App Purchases |
| 2 | 3 | Fade In | Productivity | `$89.99` | (cut off) |
| 3 | 1 | SideNotes | Clean notes on monitor side (2 lines) | `$19.99` | - |
| 3 | 2 | Civilization® VI | Build. Conquer. Inspire. | `$59.99` | In-App Purchases |
| 3 | 3 | Divinity: Original Sin 2 | Definitive Edition | `$44.99` | (cut off) |

Menu bar (not captured) [D]: App Store, Edit, Store, Window, Help.

## Light vs dark
Identical layout and content. Colours as tabulated; the hero photo, card artwork, app icons and the pill fill do not change.

## Not reproducible / assets needed
- Hero photograph, two circular editorial artworks, nine app icons: replace with placeholders.
- Eight sidebar glyphs (star, joystick, paintbrush, paper plane, rocket, hammer, squares, download arrow) and the account avatar glyph (SVG).

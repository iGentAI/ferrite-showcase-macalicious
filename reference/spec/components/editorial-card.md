# Store editorial card and hero banner (`editorial-card`)

- **Status:** present
- **AppKit:** `NSCollectionView` item views drawn by the apps (App Store.app, TV.app); no public class and no system card style.
- **HIG:** none specific. Related: image views https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/image-views/
- **Appearances shown:** light, dark
- **Provenance:** split out of `card-grid` on 2026-10-06, when the hero banner and the editorial panel were built as a component of their own (`src/components/editorial-card/`): the `card-grid` stylesheet had no room for them under the 3 kB budget. The values below are those of `card-grid.md` and `apps/app-store.md` for these two members, re-read from the screenshots where a row says so; the hairline along the bottom of TV's hero is new.

## Purpose and behaviour
The large features of a store page. The **hero banner** opens the App Store's Discover page and TV's tv+ section: artwork as wide as the content column; in the App Store an eyebrow, a two-line title and a body lie over the artwork's top left. The **editorial panel card** follows the hero in the App Store, two to a row: a tinted panel with an eyebrow, a title, a body of up to two lines and a round illustration at the right. Clicking either opens the story [I]. TV's hero sits in a paging shelf with chevrons in the side margins (see `shelf-pager`).

## Anatomy
```
  +------------------------------------------------+     +--------------------------------+
  | EYEBROW                                        |     | EYEBROW                 .---.  |
  | Title on up to                  (artwork)      |     | Title                  (     ) |
  | two lines                                      |     | Body on up to           '---'  |
  | body                                           |     | two lines                      |
  +------------------------------------------------+     +--------------------------------+
        hero banner, 945 pt wide (App Store)               editorial panel, 462 x 230 pt
```
Back to front: (1) panel fill, or the artwork clipped to the card's corners; (2) hairline and shadow, TV's hero only; (3) text; (4) the panel's round artwork.

## Variants and parameters
| Variant | Used by | Size (pt) | Shown |
|---|---|---|---|
| Editorial panel card | App Store | 462 x 230 | light, dark |
| Hero banner, flat | App Store (Discover) | 945 wide, at least 340 tall (top scrolled out of the capture) | light, dark |
| Hero banner, raised | TV (tv+) | 1214 x 455 | light, dark |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes | all four files |
| hover | no | [I] no change in the App Store; TV overlays a play button, not captured and not specified |
| pressed | no | [I] the card dims by about 10%, as `card-grid` |
| focused (full keyboard access) | no | [I] standard focus ring around the card, see `focus-ring` |
| disabled | no | [I] 0.5 opacity |
| inactive window | no | [I] unchanged |

## Measurements
Evidence shorthand: `App Store` and `TV` before `@` mean `10-15-Catalina-Light-Mac-App-Store.png` and `10-15-Catalina-Light-TV.png`; `Dark` selects the dark file of the same app; a location given once holds in both files. Window origin is image px (112, 76).

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Panel size | 462 x 230 (924 x 460 px), gap 20 between two | [M] | App Store `@ 634,796,924,460` and `@ 1598,796,924,460`; col x=1000: fill 796..1255 |
| Panel corner radius | about 8 (continuous) | [C] | `card-grid.md`, App Store card radius; a `border-radius` of 8 px reproduces the four corners with no differing pixel at 2x |
| Panel border, shadow | none | [M] | row y=1000: `#ffffff` at x=633, fill from x=634 |
| Panel text inset | 32.5 from the card's left edge | [M] | eyebrow ink starts x=699 (`@ 699,852,141,16`) |
| Panel eyebrow | cap top 28 below the card's top | [M] | col x=700: ink 854..865 |
| Panel title | cap top 45.5 below the card's top | [M] | `@ 698,887,178,36`; col x=700: ink 914..921 (stem foot) |
| Panel body | first cap top 83.5 below the card's top; 19 pitch; at most two lines shown | [M] | lines at y=962 and 1000 |
| Panel text column | 224 wide: it ends between 253.5 and about 257 from the card's left edge | [C] | card 2's first body line ends at x=2105 (253.5 pt from the card); card 1's ends at x=1091 (228.5 pt) and its next word, about 28 pt with the space, wraps |
| Panel artwork | 170 circle, 15 from the card's right edge, 30 from top and bottom | [M] | `@ 1188,856,340,340`; row y=1000: artwork from x=1189 |
| Hero, App Store | 945 wide; bottom at window y 340; bottom corners radius about 6 | [M]/[C] | `@ 634,76,1890,680`; bottom-left edge at x=642, 640, 638, 637, 636, 636, 635 on rows y=755..749 |
| Hero text inset, App Store | 27.5 from the hero's left edge | [M] | eyebrow `@ 689,178,151,16` |
| Hero eyebrow, title | cap tops 51, 82 and 110 below the window top (289, 258 and 230 above the hero's bottom) | [M] | eyebrow caps y=178; title `@ 691,240,516,34`, second line cap top y=296 |
| Hero title column | at least 260 wide, less than 324; 290 used | [C] | first line ends 287 pt from the hero's left edge; "Edits" wraps |
| Hero, TV | 1214 x 455 (2428 x 910 px) | [M] | TV `@ 192,714,2428,910` |
| Hero corner, TV | as TV's cards: circular fit 11, drawn best by a 12 px `border-radius` | [C] | 12 px scores 1.43% (light) and 0.65% (dark) of `@ 180,1596,48,48` at 2x; 11 px scores 2.00% and 1.35% |
| Hero hairline, TV | 0.5 pt (1 px) on every side, the bottom included | [M] | TV rows y=1622, 1623, 1624 at x=220: artwork, hairline, shadow |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Panel fill | `#f7f7f8` | `#343538` | [M] | `10-15-Catalina-Light-Mac-App-Store.png @ 700,1000`; `10-15-Catalina-Dark-Mac-App-Store.png @ 700,1000` |
| Panel eyebrow and body | `#7c7c7c` | `#a3a4a5` | [M] | App Store `@ 699,852,141,16`; col x=700: `#7c7c7c` on rows 856..863 |
| Panel title | `#262626` | `#e0e0e1` | [M] | App Store `@ 698,887,178,36`; col x=700: `#262626` on rows 917..921 |
| Hero eyebrow, App Store | `#878785` | `#878785` (on the photograph) | [M] | App Store `@ 689,178,151,16` |
| Hero title, App Store | `#303033` | `#303033` (on the photograph) | [M] | App Store `@ 691,240,516,34` |
| Hero body, App Store | grey, 13 pt | same | [I] | mostly hidden by the mountain in the photograph (`apps/app-store.md`) |
| Hero hairline, TV | `#26282e` over artwork `#0f1118` | same | [M] | `10-15-Catalina-Light-TV.png @ 220,1623`; fitted as a grey at 20% |
| Page behind | `#ffffff` | App Store `#1e1f22`; TV `#1e2022` | [M] | `card-grid.md`, page background |

### Text and icons
| Role | Font (SF Pro) | Tag | Evidence |
|---|---|---|---|
| Panel eyebrow | 11 pt Semibold, uppercase | [C] | cap 16 px (852..867) |
| Panel title | 20.5 pt Regular | [C] | cap 29 px (887..915) |
| Panel body | 12 pt Regular, 19 pt line pitch | [C] | cap 17 px (963..979) |
| Hero eyebrow | 11 pt Semibold, uppercase | [C] | cap 16 px |
| Hero title | 24 pt Regular, 28 pt line pitch | [C] | cap 34 px (240..273) |

### Shadows and effects
| Card | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Panel, App Store hero | none | none | [M] | App Store col x=700: `#ffffff` up to y=795 |
| TV hero | as TV's cards: fitted `0 4px 7px rgba(0,0,0,.25)` | same | [C] | TV col x=220 below y=1624: `#cacaca`, `#cccccc`, `#cfcfcf`, `#d1d1d1`, `#d4d4d4`, `#d8d8d8` on rows 1624..1629 |

## Layout and spacing
- App Store: the hero spans the 945 pt content column; the two panels follow 20 pt below it with a 20 pt gap (`2 x 462 + 20 = 944`).
- TV: the hero spans the 1214 pt content area between the 40 pt margins, 11 pt below the tv+ logo; the shelf chevrons stand in the margins, level with its middle.
- A panel is not shown at another width. [I] It keeps its height and its artwork; the text column takes what is left.

## Keyboard and accessibility
Collection view items: `AXCell`s that open the story; with full keyboard access they take focus and Return opens [I]. ARIA: a link (or a button) named by the eyebrow, title and body; the title may be exposed as a heading; decorative artwork has an empty `alt`.

## Browser notes
- TV's corner is a continuous curve; `border-radius: 12px` is the closest circle.
- The hero's text has no backdrop: its colours suit the App Store's photograph and must be chosen for other artwork.
- Artwork is image assets, not redistributed.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Mac-App-Store.png` | 634,796,924,460 | first editorial panel card |
| dark | `10-15-Catalina-Dark-Mac-App-Store.png` | 634,796,924,460 | same, dark |
| light | `10-15-Catalina-Light-Mac-App-Store.png` | 634,76,1890,680 | hero banner with eyebrow and title |
| light | `10-15-Catalina-Light-TV.png` | 192,714,2428,910 | TV's raised hero |
| dark | `10-15-Catalina-Dark-TV.png` | 192,714,2428,910 | same, dark |

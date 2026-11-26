# Home
- **Screenshots:** `10-15-Catalina-Light-Home.png`, `10-15-Catalina-Dark-Home.png` (window captures)
- **Window:** 914 x 768 pt [M] (`@ 112,76,1828,1536` in both). Mac Catalyst app: translucent 38 pt toolbar with a centred segmented control (no title); content is a full-bleed wallpaper with white text and translucent tiles.

## Layout
Evidence shorthand: `Light @` / `Dark @` are the two screenshots above; a bare `@ x,y[,w,h]`, `row y=` or `col x=` refers to the Light file and holds at the same coordinates in the Dark file.

Positions in pt from the window's top-left (image px = 2 x pt + (112, 76)).

| Region | x, y, w, h | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Toolbar (tinted by the wallpaper) | 0, 0, 914, 37 | `#bed8e0 (sRGB #b8d9e1)` -> `#a6c1c9 (sRGB #a0c2ca)` (top 2 px `#e3edf0 (sRGB #e1edf0)`, `#cee2e8 (sRGB #c9e3e9)`) | `#445d65 (sRGB #3d5e66)` -> `#374c52 (sRGB #314d53)` (top 2 px `#7f9096 (sRGB #7b9197)`, `#75898e (sRGB #708a8f)`) | [M] col x=500 @ y=76..149 |
| Toolbar lines | 0, 37, 914, 1 | `#97b2b9 (sRGB #90b3ba)`, `#809ba3 (sRGB #799ca4)` | `#2c3c42 (sRGB #283c43)`, `#000000` | [M] col x=500 @ y=150, 151 |
| Content | 0, 38, 914, 730 | blurred teal wallpaper photo (about `#4197b0 (sRGB #0099b3)` at the top, `#1e4d60 (sRGB #014e62)` mid-left, darker towards the bottom) | same image | [M] `@ 500,152`; `@ 135,800` |

```
 +------------------------------------------------------------------------+ 0
 |(o)(o)(o) [house v]        [ Home | Rooms | Automation ]             [+] | 38
 +------------------------------------------------------------------------+
 |  Home                                                                  |
 |  6 lights on.                                                          |
 |  Studio humidity 47%.                                                  |
 |  Master light on.                                                      |
 |  and 1 More >                                                          |
 |  Favorite Scenes                                                       |
 |  [Street On ] [Street Off] [Studio On*] [Studio Off]     211 x 54.5    |
 |  [Recording ]                                                          |
 |  Favorite Accessories                                                  |
 |  [ ][ ][*][ ][*][ ][*][ ]                               101.5 x 101.5  |
 |  [ ][ ][ ]                                                             |
 +------------------------------------------------------------------------+ 768
```

### Toolbar items (pt)
| Item | x, y, w, h | Style (Light / Dark) | Tag / evidence |
|---|---|---|---|
| Traffic lights | x 13, 33, 53; y 13 | - | [M] row y=112: 138..161, 178..201, 218..241 |
| Home pull-down (house glyph + chevron) | 77.5, 7.5, 47, 23 | fill `#f6f9fa (sRGB #f5f9fa)`, glyph `#555656` / dark button | [M] row y=100: 267..360 |
| Segmented control | 312, 7.5, 290, 23 (3 x 96.5) | selected `#5d6c6f (sRGB #596c70)` -> `#536264 (sRGB #4f6364)` + white text; others `#fbfcfc` -> `#eff2f3 (sRGB #eef2f3)` + `#545556` / selected `#ceebf0 (sRGB #c7ecf1)` -> `#c6e0e4 (sRGB #c0e1e5)` + `#3e585e (sRGB #37595f)`; others `#708e93 (sRGB #688f94)` -> `#698387 (sRGB #628488)` + light text | [M] `@ 736,91,580,46`; cols x=800, x=1000 |
| Add button (`+`) | 867.5, 7.5, 39, 23 | as the pull-down | [M] row y=100: 1847..1924 |

### Content (pt)
| Element | x, y, w, h | Style | Tag / evidence |
|---|---|---|---|
| Title `Home` | x 16 (ink 17); cap top y 84.5 | 26 pt Bold, `#ffffff` | [M] `@ 146,245,139,38` |
| Status lines (3) | x 16; cap tops y 136.5, 158.5, 180; 22 pt pitch | 18.5 pt Bold, `#ffffff` | [M] ink rows 348, 392, 435 px |
| `and 1 More` + chevron | x 16; top y 205.5 | 12 pt Semibold, `#ffffff` | [M] `@ 143,487,140,19` |
| Section header `Favorite Scenes` | x 16; cap top y 310.5 | 12 pt Semibold, `#ffffff` | [M] `@ 144,697,11,17` |
| Scene tiles | x 15.5, 234, 452.5, 671.5; rows y 326, 388; 211 x 54.5; gaps 7.5 | radius 13 (continuous) | [M] row y=800: 143..564, 580..1001, 1017..1439, 1455..1876; col x=300: 728..836, 852..960 |
| Section header `Favorite Accessories` | x 16; cap top y 467.5 | as above | [M] `@ 144,1011,234,19` |
| Accessory tiles | x 15.5 + 109.5 n (n = 0..7); rows y 484, 593.5; 101.5 x 101.5; gaps 8 | radius 13 (continuous) | [M] row y=1100: 143..345, 362..; white tile 580..783; col x=660: 1044..1247; second row from y=1263 |

### Tiles
| Part | On tile (white) | Off tile, Light | Off tile, Dark | Tag / evidence |
|---|---|---|---|---|
| Fill | `#ffffff` opaque | light translucent: `#38637a (sRGB #29647c)` where the wallpaper is `#194354 (sRGB #004456)`; `#3b7492 (sRGB #237595)` further right | dark translucent: `#143548 (sRGB #04354a)`, `#19455e (sRGB #004660)` at the same places | [M] `@ 1300,780`; Light/Dark `@ 200,1100`, `@ 420,1100`; wallpaper `@ 136,1100` (same in both files) |
| Fill recipe | - | tint `rgba(160,210,255,0.14)` | tint `rgba(0,10,40,0.34)` | [C] fit from 24 tile/gap pairs in `components/homekit-tile.md`; opaque mean fallbacks `#3b7693 (sRGB #217796)` / `#19475f (sRGB #004861)`. Use `backdrop-filter: blur(20px)` [I]: blur radius is not recoverable from stills. |
| Scene icon | 24.5 x 25 at tile x 9.5, y 15; coloured (orange house `#ea983f (sRGB #f7951f)` at image px 1050,775 + grey figure) | monochrome, same tone as the tile text | same | [M] `@ 1036,758,49,50` |
| Scene title | tile x 44; cap top y 22.5; 14 pt Semibold; `#000000` | `#114c6b (sRGB #004d6e)` (darker than the tile) | `#88aec4 (sRGB #7eafc7)` (lighter than the tile) | [M] `@ 1105,773,160,20`; `Light @ 230,773,121,19`; `Dark @ 230,772,122,21` |
| Accessory icon | about 17 x 24.5 at tile x 15.5, y 12; coloured (yellow bulb `#f8cc46 (sRGB #ffcc02)` at image px 625,1085) | monochrome | monochrome | [M] `@ 611,1068,34,49` |
| Accessory name (2 lines) | tile x 12; cap tops y 53, 67; 12 pt Bold; `#000000` | `#15465f (sRGB #004761)` | `#89abbf (sRGB #81acc1)` | [M] `@ 605,1150,79,18`, `@ 604,1178,145,23`; `Light @ 168,1150,59,30`; `Dark @ 166,1149,61,31` |
| Accessory status | tile x 12; cap top y 82; 12 pt Bold; `#85858a` | same tone as the name, dimmer | same | [M] `@ 604,1208,30,17` |

## Components used
- `catalyst-chrome`: toolbar, type scale.
- `toolbar`, `toolbar-segmented-control`, `toolbar-pop-up` (home pull-down), `toolbar-button` (add), `window-controls`, `window`, `window-shadow`.
- `homekit-tile`: scene and accessory cells, active/inactive materials, text and icon metrics.
- `material`: translucent tiles and toolbar.

## App-specific elements
- Scene tile and accessory tile (table above). On tiles are opaque white with black text and a coloured icon; off tiles are translucent with tone-on-tone text. A tile's last text line is the state (`On`, `Off`, `Playing`, `Closed`, `100%`, `Paused`, `4 Sensors`). Long names are truncated with an ellipsis on the second line.
- A HomePod tile that is the default speaker shows a small circular badge on its icon (third tile in the second row).

## Content in the screenshot
- Toolbar segments: `Home` (selected), `Rooms`, `Automation`.
- Header: `Home`; `6 lights on.` / `Studio humidity 47%.` / `Master light on.`; `and 1 More ›`.
- `Favorite Scenes`: `Street On`, `Street Off`, `Studio On` (on), `Studio Off`; second row `Recording`.
- `Favorite Accessories`, row 1: `Front` / `Light` / `Off`; `Front` / `Turtle` / `Off`; `Master` / `Corner Light` / `On` (on); `Den` / `Light` / `Off`; `Den` / `Apple TV` / `Playing` (on); `Garage` / `Door` / `Closed`; `Studio` / `Work` / `100%` (on); `Studio` / `Humidity Se...` / `4 Sensors`. Row 2: `Master` / `Bedroom H...` / `Paused`; `Kitchen` / `HomePod` / `Paused`; `Studio` / `HomePod` / `Paused`.
- Menu bar (not captured) [D]: Home, File, Edit, View, Window, Help.

## Light vs dark
Same wallpaper, text and on-tiles. Off tiles flip from light translucent with dark text (Light) to dark translucent with light text (Dark); the toolbar and its controls take the dark rendering.

## Not reproducible / assets needed
- Wallpaper photograph (blurred teal abstract): image asset.
- Accessory and scene icons (bulb, outlet, Apple TV, garage door, desk lamp, humidity sensor, HomePod, house, house with person): SVG.
- Vibrant tile materials: `backdrop-filter` approximation as given.

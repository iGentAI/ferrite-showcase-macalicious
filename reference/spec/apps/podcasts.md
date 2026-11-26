# Podcasts
- **Screenshots:** `10-15-Catalina-Light-Podcasts.png`, `10-15-Catalina-Dark-Podcasts.png` (window captures)
- **Window:** 1137 x 764 pt [M] (`@ 112,76,2274,1528` in both). Player layout of `media-app-chrome`: full-height sidebar with traffic lights and search, 55 pt playback bar over the content pane, no title.

## Layout
Evidence shorthand: `Light @` / `Dark @` are the two screenshots above; a bare `@ x,y[,w,h]`, `row y=` or `col x=` refers to the Light file and holds at the same coordinates in the Dark file unless a Dark location is given.

Positions in pt from the window's top-left (image px = 2 x pt + (112, 76)).

| Region | x, y, w, h | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Sidebar | 0, 0, 260, 764 | `#e8e9e9` | `#2c2d2f` | [M] `@ 400,500` |
| Sidebar divider | 260, 0, 1, 764 | `#bfbfbf` | `#000000` | [M] `@ 632,500` |
| Playback bar | 261, 0, 876, 54 | `#ffffff` | `#1e1e1e` | [M] row y=130 @ x=634..793 |
| Bar separator | 261, 54, 876, 0.5 | `#dedede` | `#1a1a1a` | [M] `@ 1500,184` |
| Content pane | 261, 54.5, 876, 709.5 | `#ffffff` | `#1e1e1e` | [M] |

```
 0            260 261                                                    1137
 +-------------+-----------------------------------------------------------+ 0
 |(o)(o)(o)    |     (15)  >  (30)    [art|   title / subtitle   ]  <) ---O (a) (i) [=]|
 | [ Search  ] +-----------------------------------------------------------+ 55
 | Apple Podcasts                                                          |
 | [Listen Now]|   Listen Now                         (34.5 pt Bold)       |
 |  Browse     |   --------------------------------------------------------|
 |  Top Charts |   Up Next                                         See All |
 | Library     | < +----------+                                          > |
 |  Recently.. |   | artwork  | 252 x 252                                  |
 |  Shows      |   +----------+                                            |
 |  Episodes   |   NEW . SUNDAY                                            |
 |  Downloaded |   I Saw Your Face on the Internet                         |
 |             |   In this feedback episode, ...                           |
 +-------------+-----------------------------------------------------------+ 764
```

### Playback bar items (pt, [M]; evidence in `media-app-chrome`)
| Item | x | y | w x h | Light | Dark |
|---|---|---|---|---|---|
| Skip back | 341 | 16 | 18 x 20 | plain circular arrow, disabled `#a6a6a6` | circular arrow with `15`, `#ffffff` |
| Play | 375 | 17 | 18 x 20 | `#4c4c4c` | `#ffffff` |
| Skip forward | 405 | 16 | 18 x 20 | plain circular arrow, disabled | circular arrow with `30`, `#ffffff` |
| LCD | 502.5 | 4.5 | 351 x 45 | idle: podcast glyph in the 44 pt well, Apple logo | playing: show artwork in the well, two text lines, 3 pt progress line |
| Speaker glyph | 908 | 22.5 | 11 x 10 | `#999999` | `#787878` |
| Volume slider | 927 | 22 | 65 x 11 | track `#7f7f7f`, knob `#ffffff` | track `#a5a5a5`, knob `#cdcbcd` |
| AirPlay | 998 | 20.5 | 15 x 14.5 | `#4c4c4c` | `#ffffff` |
| Info (filled circle `i`) | 1075 | 20 | 14 x 14 | `#4c4c4c` | `#fafafa` |
| Up Next (bullet list) | 1104 | 22 | 14 x 9.5 | `#505050` | `#fafafa` |

### Sidebar (pt)
| Element | Position | Tag / evidence |
|---|---|---|
| Traffic lights | x 10, 30, 50; y 21 | [M] row y=130 |
| Search field | 10, 63, 240 x 23; 1 pt border | [M] `@ 132,202,480,46` |
| Header `Apple Podcasts` | cap top y 103.5 | [M] ink 282..302 px |
| Selection (Listen Now) | 0, 116, 260, 28 | [M] col x=500: 308..363 |
| Rows Listen Now / Browse / Top Charts | icon tops y 121, 147, 173 (26 pt pitch) | [M] 318 (inside the selection), 370, 422 px |
| Header `Library` | cap top y 209.5 | [M] ink 494..514 px |
| Rows Recently Updated / Shows / Episodes / Downloaded | icon tops y 227, 253, 279, 305 | [M] 530, 582, 634, 686 px |

### Content (pt)
| Element | Position / size | Style | Tag / evidence |
|---|---|---|---|
| Large title `Listen Now` | left x 301 (40 pt pane margin); cap top y 93.5 | 34.5 pt Bold, `#272727` / `#dddddd` | [M]/[C] `@ 717,263,347,49` |
| Hairline | 301, 134, 797, 1 | `#e6e6e6` / `#343434` | [M] `@ 714,344,1594,2` |
| Shelf title `Up Next` | cap top y 151 | 18.5 pt Bold, `#272727` / `#dddddd` | [M] `@ 717,378,135,27` |
| `See All` | right edge x 1096.5; cap top y 153 | 15.5 pt Regular, `#2f7cf6 (sRGB #027aff)` | [M] `@ 2215,381,91,24` |
| Artwork | 301, 182, 252 x 252; radius 3; soft shadow | image | [M] `@ 714,440,504,504` |
| Caption | cap top y 446 | 11.5 pt Semibold uppercase, `#7e7e7e` / `#9a9a9a` | [M] `@ 716,968,165,17` |
| Episode title | cap top y 463 | 15.5 pt Regular, `#272727` / `#dddddd` | [M] `@ 716,1001,422,24` |
| Description (3 lines, 252 pt wide) | first line top y 485; 15 pt pitch | 12.5 pt Regular, `#808080` / `#9a9a9a` | [M] ink rows 1046, 1076, 1106 px |
| Duration | top y 533 | 12.5 pt Regular, `#808080` / `#9a9a9a` | [M] `@ 715,1142,81,19` |
| Shelf chevrons | 12.5 x 29 at x 274.5 and x 1111.5, y 293.5 | `#e6e6e6` (both dimmed) | [M] `@ 661,663,25,58`, `@ 2335,663,25,58` |

## Components used
- `media-app-chrome` (player layout), `card-grid` (shelf header, episode card, chevrons), `catalyst-chrome` (77% scaled type, 26 pt sidebar rows).
- `window`, `window-shadow`, `window-controls`, `sidebar`, `search-field` (bordered variant: fill `#dadbdb` / `#292a2c`, border `#aeafaf` / `#525355`), `slider`, `separator`.

## App-specific elements
- LCD playing state (Dark): show artwork 44 x 44 at the LCD's left; title 13 pt `#e2e2e2` centred in the body, cap top 13 pt below the bar top; subtitle 13 pt `#a9a9a9`, cap top 28 pt below the bar top; progress line 3 pt tall along the body's bottom edge, elapsed `#b3b3b3` (first 3 pt here), remaining `#575757` [M] (`Dark @ 1334,101,356,20`, `@ 1282,132,460,22`, row y=171).
- Caption variants: Light `NEW · SUNDAY`; Dark shows a 4-segment progress glyph followed by `1 HR 46 MIN LEFT` [M].

## Content in the screenshot
- Sidebar: search shows typed text `Mac Power Users` (Light) or placeholder `Search` (Dark); `Apple Podcasts`: `Listen Now` (selected), `Browse`, `Top Charts`; `Library`: `Recently Updated`, `Shows`, `Episodes`, `Downloaded`.
- Content: `Listen Now`; `Up Next`; `See All`; artwork "Mac Power Users — Fully charged discussion" (Relay FM); caption as above; title `I Saw Your Face on the Internet`; description `In this feedback episode, David and Stephen revisit Alfred and backups and talk about iOS 13's bumpy release and the new iPhone` (wrapped after `Stephen` and `about`); duration `1h 46m`.
- LCD (Dark): `I Saw Your Face on the Internet` / `Mac Power Users — September 29, 2019`.
- Menu bar (not captured) [D]: Podcasts, File, Edit, View, Controls, Account, Window, Help.

## Not reproducible / assets needed
- Mac Power Users show artwork (replace with a placeholder square).
- Seven sidebar icons (purple / blue-violet rounded squares with white glyphs).

# TV
- **Screenshots:** `10-15-Catalina-Light-TV.png`, `10-15-Catalina-Dark-TV.png` (window captures)
- **Window:** 1294 x 876 pt [M] (`@ 112,76,2588,1752` in both). Unified toolbar without title (store layout of `media-app-chrome`); no sidebar; scrolling content.

## Layout
Evidence shorthand: `Light @` / `Dark @` are the two screenshots above; a bare `@ x,y[,w,h]`, `row y=` or `col x=` refers to the Light file and holds at the same coordinates in the Dark file unless a Dark location is given.

Positions in pt from the window's top-left (image px = 2 x pt + (112, 76)).

| Region | x, y, w, h | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Toolbar | 0, 0, 1294, 36 | gradient `#e5e5e5` -> `#cdcdcd` | `#434547` -> `#363839` (top 2 px `#87888a`, `#77797a`) | [M] col x=500 |
| Toolbar separator | 0, 36, 1294, 1 | `#b8b8b8` | `#4a4b4c` | [M] col x=500 @ y=148..149 |
| Content | 0, 37, 1294, 839 | `#ffffff` | `#1e2022` | [M] `@ 2528,200` |

```
 +----------------------------------------------------------------------------+ 0
 |(o)(o)(o)      [Watch Now| Movies | TV Shows | Kids | Library]     [ Search ]| 37
 +----------------------------------------------------------------------------+
 |    What to Watch                                                  See All   |
 |  < [ card ]  [ card ]  [ card ]  [ card ]                                 > |  288.5 x 162.5
 |    ----------------------------------------------------------------------   |
 |    (apple)tv+                                                               |
 |  < [                    hero 1214 x 455                                 ] > |
 |    ----------------------------------------------------------------------   |
 |    Watch New Trailers                                                       |
 |    [ trailer ]   [ trailer ]   [ trailer ]      (cut off by the window)     |
 +----------------------------------------------------------------------------+ 876
```

### Toolbar items (pt)
| Item | x, y, w, h | Tag / evidence |
|---|---|---|
| Traffic lights | x 10, 30, 50; y 12.5 (12 pt circles) | [M] close button box `@ 132,101,24,24`, zoom ends x=235 |
| Segmented control (5 segments, 95 pt each) | 403.5, 6, 479, 23 | [M] `@ 919,88,958,46` |
| Search field | 1109.5, 6.5, 176, 22 | [M] `@ 2331,89,352,44` |

### Content (pt)
| Element | x, y, w, h | Style | Tag / evidence |
|---|---|---|---|
| `What to Watch` | x 40; cap top y 54, cap 13 | 18 pt Bold, `#0c0c0c` / `#e9e9e9` | [M] `@ 194,184,33,26` |
| `See All` | right edge x 1253; cap top y 56 | 15 pt Regular, `#2f7cf6 (sRGB #027aff)` | [M] `@ 2528,188,90,23` |
| Cards 1-4 | x 40, 348.5, 657, 965.5; y 85; 288.5 x 162.5 | radius 11 (continuous), shadow | [M] cards at px x=192, 809, 1426, 2043; y=246..570 |
| Separator | 40, 279, 1214, 1 | `#f4f4f4` / `#282a2c` | [M] `@ 192,634,2428,2` |
| tv+ logo | 40, 290, 47, 18 | `#000000` / `#ffffff` | [M] `@ 192,656,94,36` |
| Hero | 40, 319, 1214, 455 | radius 11, shadow | [M] `@ 192,714,2428,910` |
| Separator | 40, 806, 1214, 1 | as above | [M] col x=400 @ y=1688 |
| `Watch New Trailers` | x 40; cap top y 823.5 | 18 pt Bold | [M] `@ 194,1723,50,26` |
| Trailer cards | x 40, 451.5, 863; y 854.5; 391.5 wide (21 pt visible) | radius 11 | [M] row y=1810 |
| Chevrons | 12.5 x 29 at x 13.5 and x 1267.5 | Light: both on the hero row (y 536.5), left `#d4d4d4` dim, right `#262626`; Dark: both on the first shelf (y 151.5), left `#444647` dim, right `#dddede` | [M] `Light @ 139,1149,25,58`, `@ 2647,1149,26,58`; `Dark @ 139,379,25,58`, `@ 2647,379,26,58` |

## Components used
- `media-app-chrome` (store layout: toolbar, segmented navigation, search).
- `toolbar`, `toolbar-segmented-control`, `toolbar-search-field` (owned by chrome; the TV instance uses 95 pt equal-width segments and a 176 pt field).
- `card-grid`: shelves, cards, hero, separators, chevrons, `See All`.
- `window`, `window-shadow`, `window-controls`, `scroll-view`.

## App-specific elements
- Segmented navigation colours (selected `Watch Now`): Light fill `#707070` -> `#656566` with white text; unselected `#fdfdfd` -> `#f3f3f3` with `#565656` text. Dark: selected `#cfd1d3` -> `#c4c6c8` with `#3b3c3f` text; unselected `#6d6f71` -> `#676869` with `#fcfeff` text [M] (cols x=1010, x=1200).
- Card inner hairline `#e6e6e6` (0.5 pt) visible on white artwork in both appearances [M] (`@ 1700,246`).

## Content in the screenshot
- Segments: `Watch Now` (selected), `Movies`, `TV Shows`, `Kids`, `Library`. Search placeholder `Search`.
- `What to Watch` / `See All`. Cards, Light: Succession (HBO), Toy Story 4, Modern Family, It's Always Sunny in Philadelphia. Dark (shelf paged once): This Is Us, It's Always Sunny in Philadelphia, Modern Family, Toy Story 4.
- ` tv+` logo; hero artwork: The Morning Show.
- `Watch New Trailers` (three trailer cards, only their top edge visible).
- Menu bar (not captured) [D]: TV, File, Edit, View, Controls, Account, Window, Help.

## Not reproducible / assets needed
- All show and movie artwork (4 landscape cards, 1 hero, 3 trailers): replace with placeholder images.
- Apple tv+ wordmark (SVG).
- Continuous-curvature corners (use radius 11).

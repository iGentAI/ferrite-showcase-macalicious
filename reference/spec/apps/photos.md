# Photos
- **Screenshots:** 10-15-Catalina-Light-Photos.png, 10-15-Catalina-Dark-Photos.png
- **Window:** 1200 x 720 pt [M] (image x=112..2511, y=76..1515). Unified toolbar, 38 pt (y=76..151), with a centred title "My Albums" inside the toolbar row.

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Toolbar | 38 | gradient `#f3f3f3` -> `#bcbcbc`, line `#a5a6a6` | dark gradient, line `#000000` | [M] Light-Photos @ 250,76,1,76 |
| Sidebar (`sidebar`) | 179 wide (x=112..469) | `#e8e9e9` | `#2c2d30` | [M] @ 300,1180 |
| Divider | 1 | `#d1d2d2` | `#404143` | [M] @ 470,1180 |
| Album header | y=152..301 (75 pt), ending in a 0.5 pt rule | `#ffffff`, rule `#e6e6e6` | `#1e2022`, rule `#343638` | [M] @ 1000,301 |
| Thumbnail grid (`icon-view`) | x=472..2511 (1020 wide) | `#ffffff` | `#1e2022` | [M] @ 1000,200 (dark) |

Toolbar (px, row y=114): back button 269..334 (33 pt); zoom slider with small/large glyphs 364..552; title "My Albums" 13 pt centred (x=1247..1370); Info 1759..1840; Share 1859..1940; Favorite 1959..2040 (dimmed); Rotate 2059..2140 (dimmed) (each 41 pt wide, 50 pt pitch); search field 2161..2495 (167.5 pt) [M].

```
[o o o] [<] [-o--]                 My Albums                 [i][share][heart][rot] [Search]
+ Library ----+  Wallpapers
|  Photos     |  May 2013 - September 2019   17 Photos   Show as Memory   Slideshow    Showing: All Items v
|  Memories.. |  ---------------------------------------------------------------
| Shared      |  [img][img][img][img][img][img][img]
| Albums      |  [img][img][img][img][img][img][img]
| v My Albums |  [img][img][img]
|    Wallpap. |
| > My Proj.  |
```

## Components used
`window`, `window-controls`, `toolbar`, `toolbar-button`, `slider` (mini, in toolbar), `toolbar-search-field`, `sidebar` + `outline-view` (My Albums expanded, My Projects collapsed; grey selection on "Wallpapers"), `disclosure-triangle`, `split-view`, `icon-view` (photo grid), `label` (links), `pull-down-button` ("Showing: All Items").

## App-specific elements
- Sidebar: headers Library / Shared / Albums / Projects; template icons 16-18 pt; child album row uses an 18 pt square colour thumbnail at x=180..215 with its label at x=228 (58 pt). [M] 10-15-Catalina-Light-Photos.png @ 113,758,150,1.
- Album header: title "Wallpapers" about 28 pt Bold at 13 pt left inset (x=497), line box y=188..237; meta line y=264..288: date range 13 pt Semibold grey, "17 Photos" 12 pt grey, "Show as Memory" and "Slideshow" links blue `#276ad3 (sRGB #0168da)`; right-aligned "Showing: All Items" with a chevron. [M] @ 497,188,290,50 and 498,264,692,25.
- Grid: seven 128 pt cells per row at 144.5 pt pitch starting x=498; thumbnails aspect-fit (4:3 -> 128 x 96, 16:10 -> 128 x 80, square -> 128 x 128), first row top y=318; row gap 16 pt. [M] see `icon-view`.

## Content in the screenshot
Sidebar: "Library": Photos, Memories, People, Places, Recents, Imports; "Shared": Activity; "Albums": My Albums > Wallpapers (selected); "Projects": My Projects. Toolbar title "My Albums"; search placeholder "Search". Header: "Wallpapers", "May 2013 - September 2019", "17 Photos", "Show as Memory", "Slideshow", "Showing: All Items". Grid: 17 macOS default wallpapers (10.0 Aqua Blue through 10.15 Catalina day and night), in three rows of 7, 7 and 3.

## Not reproducible / assets needed
The 17 wallpaper thumbnails (image assets), album thumbnail, toolbar glyphs.

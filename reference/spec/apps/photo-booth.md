# Photo Booth
- **Screenshots:** `10-15-Catalina-Light-Photo-Booth.png`, `10-15-Catalina-Dark-Photo-Booth.png` (window captures)
- **Window:** 720 x 562 pt [M] (`@ 112,76,1440,1124` in both). Titled window (22 pt title bar, no toolbar) showing the Effects browser: a 3 x 3 grid of live previews and a 60 pt bottom control bar.

## Layout
Evidence shorthand: a bare `@ x,y[,w,h]` refers to the Light file and holds at the same coordinates in the Dark file.

Positions in pt from the window's top-left (image px = 2 x pt + (112, 76)).

| Region | x, y, w, h | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Title bar | 0, 0, 720, 22 | gradient `#dfdfdf` -> `#c9c9ca`; no separator line | `#404142` -> `#353636` (top 2 px `#7d7e7e`, `#727373`) | [M] `@ 130,80`, `@ 130,117` |
| Effects grid | 0, 22, 720, 480 | background `#292929` | `#292929` | [M] `@ 115,300`, `@ 592,300` |
| Bottom bar | 0, 502, 720, 60 | `#e7e6e5` | `#2b2c2d` | [M] `@ 700,1100` |

```
 +----------------------------------------------------------+ 0
 |(o)(o)(o)                 Photo Booth                      | 22
 +----------------------------------------------------------+
 | [   Sepia    ] [Black and White] [Plastic Camera]         |  cells 236 x 156
 | [ Comic Book ] [    Normal     ] [ Color Pencil ]         |  3 pt gaps and margins
 | [    Glow    ] [Thermal Camera ] [    X-Ray     ]         |
 +----------------------------------------------------------+ 502
 |                    <  o  (o)  o  >              [Effects] | 60
 +----------------------------------------------------------+ 562
```

| Element | x, y, w, h (pt) | Style (Light / Dark) | Tag / evidence |
|---|---|---|---|
| Title | centred; 13 pt | `#434343` / light | [M] `@ 760,88,145,20` |
| Grid cells | columns x 3, 242, 481; rows y 25, 184, 343; each 236 x 156 | live preview image, square corners | [M] background runs: x=113..117, 590..595, 1068..1073, 1546..1550; y=120..125, 438..443, 756..761, 1074..1079 |
| Grid gaps / margins | 3 between cells; 3 around the grid | `#292929` | [M] same runs |
| Effect label | centred in the cell; baseline 14.5 pt above the cell bottom | 18 pt Regular, `#ffffff`, with a soft dark shadow for legibility | [M] `Sepia` `@ 311,376,86,39` (cap 26 px: 383..408); cell bottom y=437 |
| Previous page (left triangle) | 282.5, 522, 15.5, 20 | `#676765` / `#b7b7b9` | [M] `@ 677,1120,31,40`; `@ 690,1140` |
| Page dots (3) | 12 pt circles at x 318, 354, 390; y 526 (36 pt pitch) | current (middle): `#0b4dbf (sRGB #004ac6)` / `#4987f6 (sRGB #3785fe)`; others `#676765` / `#b7b7b9` | [M] `@ 748,1128,24,24`, `@ 820,1128,24,24`, `@ 892,1128,24,24`; `@ 760,1140`, `@ 832,1140` |
| Next page (right triangle) | 422, 522, 15.5, 20 | as previous | [M] `@ 956,1120,31,40` |
| `Effects` button | 605.5, 522, 95, 20.5 (push button); right inset 19.5 | fill `#ffffff`, label `#262626` / fill `#676869`, label `#f3f4f5` | [M] `@ 1323,1120,190,41`; label `@ 1377,1129,83,20` |

## Components used
- `window`, `window-shadow`, `title-bar`, `window-controls` (x 8, 28, 48; row y=98 px).
- `push-button`: `Effects` (regular size, 13 pt label).
- `image-view`: nine preview cells.
- `page-control` (new id, see handoff): the three dots with arrows.

## App-specific elements
- Page control: two 15.5 x 20 pt solid triangles flanking three 12 pt dots at 36 pt pitch, centred on the window (group centre x = 360); the current page's dot is filled with a deep blue (`#0b4dbf (sRGB #004ac6)` light, `#4987f6 (sRGB #3785fe)` dark: an app-specific blue, darker than the system accent in light) [M].
- Effect cells: each shows the camera through one Core Image filter with the filter name overlaid. The centre cell is always `Normal`.

## Content in the screenshot
- Title: `Photo Booth`.
- Effects, row by row: `Sepia`, `Black and White`, `Plastic Camera`; `Comic Book`, `Normal`, `Color Pencil`; `Glow`, `Thermal Camera`, `X-Ray`.
- Page dots: second of three is current.
- Button: `Effects`.
- Menu bar (not captured) [D]: Photo Booth, File, Edit, View, Camera, Window, Help.

## Light vs dark
The title bar and bottom bar switch (`#e7e6e5` -> `#2b2c2d`), the dots and triangles invert from dark grey to light grey, the current dot changes from `#0b4dbf (sRGB #004ac6)` to `#4987f6 (sRGB #3785fe)`, and the `Effects` button takes the dark push-button rendering. The grid background `#292929` is the same in both [M].

## Not reproducible / assets needed
- Nine filtered camera previews: placeholder photos with CSS filters (`sepia()`, `grayscale()`, `saturate()`, `invert()`, `blur()`) give an approximation; Comic Book, Color Pencil, Thermal Camera and X-Ray need pre-rendered images.

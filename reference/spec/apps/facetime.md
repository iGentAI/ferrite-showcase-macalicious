# FaceTime
- **Screenshots:** `10-15-Catalina-Light-FaceTime.png`, `10-15-Catalina-Dark-FaceTime.png` (window captures)
- **Window:** 652 x 585 pt [M] (`@ 112,76,1304,1170` in both). Full-size content window with no title: a dark translucent sidebar on the left (traffic lights float over it) and the live camera preview on the right. Dark-styled in both appearances.

## Layout
Evidence shorthand: a bare `@ x,y[,w,h]`, `row y=` or `col x=` refers to the Light file and holds at the same coordinates in the Dark file (values for each are in the two capture columns).

Positions in pt from the window's top-left (image px = 2 x pt + (112, 76)).

| Region | x, y, w, h | Light capture | Dark capture | Tag / evidence |
|---|---|---|---|---|
| Sidebar | 0, 0, 262, 585 | dark vibrant material: `#413f3b` at the top, `#494847` mid, `#40403f` near the bottom | `#403e3b` at the top, `#43403d (sRGB #44403d)` mid, `#343230` near the bottom | [M] `@ 300,100`; `@ 300,600`; `@ 300,1200` (each in both files) |
| Camera preview | 262, 0, 390, 585 | live video frame | live video frame | [M] row y=700: video from x=636 |
| Window rim | 1 pt lighter inner edge; top 2 px `#868482`, `#757571` | same | `#848380`, `#757371` | [M] `@ 300,76`, `@ 300,77` |

```
 +---------------------+-------------------------------+ 0
 |(o)(o)(o)            |                               |
 |    [ All | Missed ] |                               | 32..51
 | [Enter a name, ... ]|        camera preview         | 60.5..80.5
 |                     |                               |
 |   (empty call list) |                               |
 |                     |                               |
 +---------------------+-------------------------------+ 585
 0                    262                             652
```

| Element | x, y, w, h (pt) | Style | Tag / evidence |
|---|---|---|---|
| Traffic lights | x 8, 28, 48 | dark-window colours `#ed655a (sRGB #ff5a53)`, `#e1c04c (sRGB #e7c029)`, `#72be47 (sRGB #53c22c)` | [M] row y=98: 128..151, 168..191, 208..231 |
| Segmented control | 64, 32, 134, 19 (two 67 pt segments), centred in the sidebar | selected `All`: accent blue gradient `#2e6bde (sRGB #1869e6)` -> `#2960c6 (sRGB #155ecd)`, white label; unselected `Missed`: `#7e7c78` (Dark capture `#7c7a76`), white label | [M] `@ 240,140,268,38`; cols x=280, x=450; row y=150: boundary at x=374, end at x=507 |
| Segment labels | centred; 13 pt Regular (small-control height with regular text) | `#ffffff` | [M] `All` `@ 290,146,40,28` (darkest glyph AA only; glyph height 19 px) |
| Recipient field | 11.5, 60.5, 239, 20 | fill `#524f4b (sRGB #534f4b)` (Dark capture `#504e4a`), 0.5 pt top edge `#605d59 (sRGB #615d59)`, 0.5 pt bottom highlight `#7e7b79 (sRGB #7f7b79)` | [M] `@ 135,197,478,40`; `@ 500,216` |
| Field placeholder | x 16; cap top y 65.5 | 13 pt Regular, `#7d7b7a` | [M] `@ 144,206,375,25` |
| Call list | 0, 86, 262, 499 | empty | - |

## Components used
- `window`, `window-shadow`, `window-controls`.
- `sidebar` + `material` (dark vibrant sidebar regardless of appearance).
- `segmented-control` (small, in dark vibrant rendering, accent-coloured selection).
- `text-field` / `token-field` (recipient entry, dark rendering).
- `image-view` (camera preview).

## App-specific elements
None beyond the dark rendering of the standard controls listed above.

## Content in the screenshot
- Segments: `All` (selected), `Missed`.
- Field placeholder: `Enter a name, email, or number`.
- No recent calls are listed.
- Camera preview: a different still of the same person in each capture.
- Menu bar (not captured) [D]: FaceTime, File, Edit, Video, Window, Help.

## Light vs dark
Same dark-styled geometry, **different pixels**. Sidebar samples [M] at `@ 300,100`, `@ 300,600`, `@ 300,1200` are light `#413f3b`, `#494847`, `#40403f` and dark `#403e3b`, `#43403d (sRGB #44403d)`, `#343230`; the lower sample differs by up to 15 channel levels. Controls also shift: `#7e7c78` / `#7c7a76` on the unselected segment and `#524f4b (sRGB #534f4b)` / `#504e4a` on the field (`@ 500,216`) [M]. Selected-segment blue is identical (`#2d69d9 (sRGB #1767e1)` at `@ 250,150` in both) [M]. The camera frames differ. Material/backdrop blending is the plausible cause of neutral differences [I], not proven by these stills; retain both observed composites instead of describing the captures as pixel-identical.

## Not reproducible / assets needed
- Camera frame: use a placeholder photo or `getUserMedia` video.
- Sidebar vibrancy: opaque fallback `#413f3b`.

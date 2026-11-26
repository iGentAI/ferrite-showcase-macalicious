# Chess
- **Screenshots:** `10-15-Catalina-Light-Chess.png`, `10-15-Catalina-Dark-Chess.png` (window captures)
- **Window:** 971 x 702 pt [M] (`@ 112,76,1942,1404` in both). Standard titled window (22 pt title bar, no toolbar) whose content is a single OpenGL view.

## Layout
Evidence shorthand: a bare `@ x,y[,w,h]` or `col x=` refers to the Light file and holds at the same coordinates in the Dark file.

Positions in pt from the window's top-left (image px = 2 x pt + (112, 76)).

| Region | x, y, w, h | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Title bar | 0, 0, 971, 21 | gradient `#e4e4e4` -> `#cdcdcd` | `#434447` -> `#37383a` (top 2 px `#86878a`, `#78797a`) | [M] `@ 400,78`, `@ 400,117` |
| Title-bar lines | 0, 21, 971, 1 | `#bebebe`, `#a8a8a8` | `#2c2e2e`, `#000000` | [M] `@ 400,118`, `@ 400,119` |
| 3D view | 0, 22, 971, 680 | rendered scene | identical | [M] `@ 150,130`, `@ 150,760` equal in both files |

```
 +---------------------------------------------------------------+ 0
 |(o)(o)(o)          Stephen - Computer   (New Game)             | 22
 +---------------------------------------------------------------+
 |          grey gradient backdrop (lighter at the top)          |
 |              +-------------------------------+                |
 |             /  8  r n b q k b n r            \                |
 |            /   7  p p p p p p p p             \               |
 |- - - - - -/    6..3 empty squares              \- - - - - - - | horizon y 331
 |          /     2  P P P P P P P P               \             |
 |         /      1  R N B Q K B N R                \            |
 |        +-------  A B C D E F G H  ----------------+           |
 |                dark floor #404040                             |
 +---------------------------------------------------------------+ 702
```

## Components used
- `window`, `window-shadow`, `title-bar` (centred 13 pt title, no proxy icon), `window-controls` (x 8, 28, 48).
- `image-view` stand-in for the OpenGL view.

## App-specific elements
| Element | Measurement | Tag / evidence |
|---|---|---|
| Title text | 13 pt Regular, `#474747` / `#bcbdc0`, centred (ink x 380.5..588.5), cap top y 6.5 | [M] `@ 873,88,417,25` |
| Backdrop gradient (left edge, top to horizon) | `#989898` at y 27, `#838383` at y 112, `#6a6a6a` at y 212, `#515151` at y 312, `#4d4d4d` at y 331 | [M] `@ 150,130`, `@ 150,300`, `@ 150,500`, `@ 150,700`; col x=150: 731..738 |
| Floor | flat `#404040` from y 331.5 at the left edge to the window bottom; the horizon line is a shallow curve (lower towards the middle) | [M] col x=150 from y=739; `@ 150,1400` |
| Board | wooden board in perspective: outer frame corners at about (148, 669), (828, 669), (782, 110), (194, 110) pt; 8 x 8 squares in light maple and dark red-brown wood textures; file letters `A`-`H` on the near frame, rank numbers `1`-`8` on the left frame, engraved | [I] approximate preview-derived coordinates only; not a pixel measurement. Use a rendered-scene asset for exact reconstruction. |
| Pieces | 32 Staunton pieces rendered in 3D: light wood (white, near side) and dark wood (black, far side), with soft reflections on the board | image |

## Content in the screenshot
- Title: `Stephen - Computer   (New Game)` (three spaces before the parenthesis).
- Board in the initial position, white at the bottom.
- Menu bar (not captured) [D]: Chess, Game, Edit, Moves, View, Window, Help.

## Light vs dark
Only the title bar differs. The 3D view is pixel-identical [M].

## Not reproducible / assets needed
- The whole 3D scene (board, pieces, lighting): use a pre-rendered image, or a flat 2D board as a stand-in. A CSS-only approximation: backdrop `linear-gradient(#989898 0, #4d4d4d 45.5%, #404040 45.5%)` with a board image on top.

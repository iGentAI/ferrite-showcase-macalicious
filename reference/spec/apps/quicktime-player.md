# QuickTime Player
- **Screenshots:** `10-15-Catalina-Light-QuickTime.png`, `10-15-Catalina-Dark-QuickTime.png` (window captures)
- **Window:** Light 1470 x 827 pt [M] (`@ 112,76,2940,1654`); Dark 1346 x 757 pt [M] (`@ 112,76,2692,1514`). Movie window: dark translucent title bar over a full-bleed video, floating HUD controller. Dark-styled in both appearances.

## Layout
Evidence shorthand: `Light @` / `Dark @` are the two screenshots above; `row y=` / `col x=` without a file refer to the Light file.

| Region | Size (pt) | Light capture | Dark capture | Tag / evidence |
|---|---|---|---|---|
| Title bar | full width x 22 (44 px: y=76..119) | 1 px highlight `#999a9b`, 1 px `#8b8c8d`, then gradient `#5e5f60` -> `#4d4e4f`, 1 px `#3e3e3f`, 1 px `#000000` | `#909193`, `#828385`, gradient `#525356` -> `#434447`, `#363638`, `#000000` | [M] `@ 600,76` .. `@ 600,119` in each file |
| Video | full width x (window - 22) | movie frame | movie frame | image asset |
| Controller (HUD) | 440 x 75, centred horizontally, bottom edge 15.3% of the window height above the window bottom | see `hud-window` | see `hud-window` | [M] Light `@ 1143,1325,880,150`; Dark `@ 1018,1209,880,150` |

The title bar is translucent over the top of the video (its grey shifts with what is behind: `#5e5f60` over the pale wall at x=600 but `#444449 (sRGB #44444a)` over the dark shirt at `Light @ 1400,100`) [M]. It appears with the controller when the pointer is over the window [I].

```
+-(o)(o)(o)---------[doc] Pippin: Apple's Forgotten Game Console----------+ 22 pt
|                                                                          |
|                              video frame                                 |
|                                                                          |
|              +----------------------------------------------+            |
|              | vol  << > >>                   airplay share pip |        |
|              | 00:03:16:12 ----|------------------ 00:12:49:22 |         |
|              +----------------------------------------------+            |
|                                                                          |
+--------------------------------------------------------------------------+
```

## Components used
- `window`, `window-shadow`, `window-controls` (close/minimise/zoom at x 8, 28, 48 pt; y 5 pt; row y=98: 128..151, 168..191, 208..231 [M]).
- `title-bar`: dark translucent variant with document proxy icon and title.
- `hud-window`: the playback controller (all geometry there).
- `slider`: volume slider in HUD rendering; `image-view`: the video.

## App-specific elements
| Element | Measurement | Tag |
|---|---|---|
| Title text | SF Pro Text 13 pt Regular, `#c2c4c9 (sRGB #c2c4ca)` on the dark bar; cap height 19 px (`P` at `Light @ 1356,89,14,19`) | [M]/[C] |
| Title block | proxy icon + title centred as one unit: icon `Light @ 1319,83,22,29` (11 x 14.5 pt document icon), 8 pt gap, text `@ 1356,88,485,25` | [M] |
| Video area top | y = 22 pt (px 120) | [M] |

Controller item order, left to right (positions in `hud-window`): volume-low glyph, volume slider (at maximum), volume-high glyph, rewind, play, fast-forward, AirPlay, Share, Picture in Picture; second row: elapsed time, scrubber, duration.

## Content in the screenshot
| Element | Light | Dark |
|---|---|---|
| Window title | `Pippin: Apple's Forgotten Game Console` | same |
| Elapsed | `00:03:16:12` | `00:04:40:02` |
| Duration | `00:12:49:22` | `00:12:49:22` |
| Scrubber thumb | 25.4% along the track (thumb centre x=1459 on track 1325..1840) | 36.7% (thumb x=1387..1392 on track 1200..1715, row y=1321) |
| Playback state | paused (play triangle) | paused |

Menu bar (not captured) [D]: QuickTime Player, File, Edit, View, Window, Help.

## Light vs dark
Same dark-styled control design, but **different pixels and window sizes**. Title-bar samples [M] at `@ 600,78` / `@ 600,117` are light `#5e5f60` / `#4d4e4f`, dark `#525356` / `#434447`. The floating controller retains its 440 x 75 pt geometry but its vibrant composites change: play glyph light `#feeed8 (sRGB #ffeed5)` at `Light @ 1570,1374`, dark `#edd8b7 (sRGB #f1d8b3)` at `Dark @ 1445,1258` [M]. Volume blue remains `#2e6cde (sRGB #176ae6)` at `Light @ 1250,1374` / `Dark @ 1125,1258` [M]. Video frame, time, scrubber position and window size differ. Backdrop compositing plausibly explains the material colours [I]; these stills do not isolate a system-appearance effect.

## Not reproducible / assets needed
- The movie frame (a still image or video asset).
- Document proxy icon (QuickTime movie icon, 16 pt).
- Vibrant glyph blending in the controller (see `hud-window`, Browser notes).

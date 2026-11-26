# Voice Memos
- **Screenshots:** `10-15-Catalina-Light-Voice-Memos.png`, `10-15-Catalina-Dark-Voice-Memos.png` (window captures)
- **Window:** 789 x 630 pt [M] (`@ 112,76,1578,1260` in both). Mac Catalyst app showing the recording/editing view: 38 pt toolbar with centred title and a trim button; black content that is identical in both appearances.

## Layout
Evidence shorthand: a bare `@ x,y[,w,h]`, `row y=` or `col x=` refers to the Light file and holds at the same coordinates in the Dark file where explicitly noted. Waveform data, ruler phase, overview handle position and timer differ.

Positions in pt from the window's top-left (image px = 2 x pt + (112, 76)).

| Region | x, y, w, h | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Toolbar | 0, 0, 789, 37 | `#bcbcbc` -> `#a3a3a3` (top 2 px `#e3e3e3`, `#cdcdcd`) | `#393a3c` -> `#2e2f30` (top 2 px `#78787a`, `#6d6e6f`) | [M] col x=300 @ y=76..149 |
| Toolbar lines | 0, 37, 789, 1 | `#949494`, `#807f7f` | `#252626`, `#000000` | [M] col x=300 @ y=150, 151 |
| Background | 0, 38, 789, 592 | `#000000` | `#000000` | [M] `@ 300,180` |
| Waveform panel | 0, 74.5, 789, 244 | `#151515` | `#151515` | [M] `@ 300,400`; col x=300: 225..712 |
| Time ruler | 0, 318, 789, 23 | on black | same | [M] `@ 423,712,1267,44` |
| Overview strip | 33, 394, 723, 44.5 | `#151515` | `#151515` | [M] col x=1000: 864..952; row y=880: 178..1623 |
| Timer | centred, cap top y 485.5 | text `#f0f0f0` | same | [M] `@ 861,1047,180,49` |
| Bottom bar | 0, 556.5, 789, 73.5 | 1 px `#212121`, then `#191919` -> `#0c0c0c` | same | [M] col x=700: 1189..1335 |

```
 +------------------------------------------------------------------+ 0
 |(o)(o)(o)                 New Recording 3                    [trim]| 38
 +------------------------------------------------------------------+
 |                              o                                    | 68
 |------------------------------|------------------------------------| 74.5
 |           ||||||||||||||||||||                                    |
 |                              |          waveform panel            |
 |------------------------------|------------------------------------| 318.5
 |      '   '   '   '   '   '   o   '   '   '   '   '   '            |
 |    00:00   00:01   00:02   00:03   00:04   00:05 ...              |
 |   [ ~~~~~~| overview strip                                   ]    | 394
 |   00:00                                                  00:03    |
 |                           00:03.09                                |
 |------------------------------------------------------------------ | 556.5
 |     ( || )              (15)  >  (15)                 ( Done )    |
 +------------------------------------------------------------------+ 630
```

| Element | x, y, w, h (pt) | Style | Tag / evidence |
|---|---|---|---|
| Traffic lights | x 13, 33, 53; y 13 | on the grey toolbar: `#ed695e (sRGB #ff5e57)`, `#f7c24f (sRGB #ffc12b)`, `#64ca55 (sRGB #28ce3f)` | [M] row y=114: 138..161, 178..201, 218..241 |
| Title | centred; cap top y 14.5 | 13 pt, `#202020` / `#b1b2b3` | [M] `@ 799,104,204,25` |
| Trim button (crop glyph) | 742.5, 7.5, 39, 23 | fill `#f9f9f9` -> `#efefef`, glyph `#b3b3b3` / fill `#606163`, glyph `#a0a0a1` | [M] row y=114: 1597..1674; col x=1610: 91..136 |
| Playhead line | x 394.5 (near window centre), y 67.5..325; nominal 1 pt | core `#ef4e3e (sRGB #ff3b30)` / `#f04e3e (sRGB #ff3b30)`, fringes `#ad3a2f (sRGB #bb2e26)`, `#dc4839 (sRGB #ee372d)` | [M] col x=901: 211..725; row y=500: 900..902 |
| Playhead end dots | 7.5 pt circles centred on the line; top dot spans y 67.5..75, bottom dot y 317.5..325 | `#ec4d3d (sRGB #ff3b30)` | [M] `@ 894,211,15,15`; `@ 901,218`, `@ 901,719` |
| Waveform bars | 1.5 pt wide, 4.15 pt pitch, vertically centred at y 196..196.25; drawn from x 156 to the playhead | `#f44f3f (sRGB #ff3c31)` | [M] `@ 424,375,475,187`; bars at x=424, 432, 440, 449 on rows 460..469 |
| Ruler ticks | every 19.25 pt (4 per second), nominal 1 x 10 pt, y 318..328; first at x 155.5 light / 158.5 dark | major (each second) `#424242`, minor `#2b2b2b` | [M] Light ticks at x=423, 462, 501, 539, 577 px; Dark x=429, 467, 506, 544, 583; col x=423 (Light) / 429 (Dark): core y=712..730, edge 731..732 |
| Ruler labels | under each second tick, left-aligned to the tick; cap top y 330.5 | 13.5 pt Regular, tabular, `#5c5c5c` | [M] `@ 422,737,65,19` |
| Seconds scale | 77 pt per second | - | [C] 423 -> 577 px |
| Overview playhead | nominal 5 pt wide rounded bar, 48.5 pt tall (2 pt taller than the strip at each end); centre x 145.5 light / 143.5 dark | `#ec4d3d (sRGB #ff3b30)` | [M] Light core x=398..407 / Dark 395..403, with AA fringes; core y=861..955, ends y=860,956; Light `@ 403,900`, Dark `@ 399,900` |
| Overview labels | left x 34, right-aligned to x 755; cap top y 447.5 | 13.5 pt, `#5d5d5d` | [M] `@ 180,971,64,19`, `@ 1560,971,63,19` |
| Timer | cap height 24.5 | 34.5 pt Bold, tabular digits, `#f0f0f0` | [M]/[C] digit boxes 38 x 49 px |
| Record / pause button | 66, 569.5, 113, 46.5; 1.5 pt white outline, fully rounded, no fill | pause glyph: two 8 x 19 pt red bars (`#ee4e3d (sRGB #ff3c2f)`) at x 113 and 124, y 583.5 | [M] row y=1262: outline 244..247 and 466..469; bars 338..353, 360..375; col x=345: 1243..1280 |
| Skip back 15 | 328.5, 582.5, 20, 21.5 | circular arrow with `15`, `#818182` | [M] `@ 769,1241,40,43` |
| Play | 383, 579, 25, 28 (triangle) | `#7d7d7d` | [M] `@ 878,1234,50,56`; `@ 900,1262` |
| Skip forward 15 | 439, 582.5, 20, 21.5 | `#828382` | [M] `@ 990,1241,40,43` |
| Done button | 617.5, 573.5, 105, 39; fully rounded | fill `#7f7f7f`; label `Done` 11.5 pt Bold `#000000`, centred | [M] row y=1262: 1347..1556; col x=1500: 1223..1300; `@ 1424,1255,57,16` |

## Components used
- `catalyst-chrome`: toolbar (translucent over black), type scale, iOS system red.
- `waveform-view`: detailed waveform, ruler, main playhead and overview strip; its component spec records the Light/Dark phase and data differences.
- `toolbar`, `toolbar-button`, `title-bar`, `window-controls`, `window`, `window-shadow`.

## App-specific elements
Everything below the toolbar is custom: waveform panel, playhead, ruler, overview strip, timer, transport and the two pill buttons (table above).

## Content in the screenshot
| Element | Light | Dark |
|---|---|---|
| Title | `New Recording 3` | `New Recording 4` |
| Ruler labels | `00:00` .. `00:07`, then a clipped `00:0` at the right edge | same |
| Overview labels | `00:00` (left), `00:03` (right) | same |
| Timer | `00:03.09` | `00:03.06` |
| Button | `Done` | `Done` |
| Waveform | recorded up to about 3.1 s; shape differs per capture | - |

Menu bar (not captured) [D]: Voice Memos, File, Edit, View, Window, Help.

## Light vs dark
The toolbar follows appearance (grey `#bcbcbc` -> `#a3a3a3` in Light, `#393a3c` -> `#2e2f30` in Dark, with matching button and title colours). Content retains the same palette [M] (`@ 300,400`, `@ 300,180`, `@ 300,1250`, `@ 901,500` equal in both files), but is **not pixel-identical**: waveform data and timer differ, the ruler shifts 6 image px (first major tick x=423 / 429), and the overview handle shifts 4 image px (centre x=403 / 399) [M]. These position differences are consistent with the 0.03 s duration difference at 77 pt/s [C], not a new dark-mode layout.

## Not reproducible / assets needed
None beyond SVG glyphs (crop/trim, skip 15, play, pause). The waveform is drawn from sample data.

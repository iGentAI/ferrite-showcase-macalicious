# Home accessory and scene tile (`homekit-tile`)

- **Status:** present
- **AppKit:** none: a `UICollectionViewCell` drawn by Home.app through Mac Catalyst (iOS metrics scaled to 77%, see `catalyst-chrome`). No public class.
- **HIG:** none for macOS. Mac Catalyst scaling: https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/ios/overview/mac-catalyst/ ; translucency: https://web.archive.org/web/20200504055746/https://developer.apple.com/design/human-interface-guidelines/macos/visual-design/translucency/
- **Appearances shown:** light, dark (on tiles are identical in both; off tiles flip from a light to a dark translucent panel)

## Purpose and behaviour
A rounded tile that stands for one HomeKit accessory (square) or one scene (wide). A click toggles the accessory or runs the scene; a double-click or right-click opens its controls [I] (not visible). An **on / active** tile is opaque white with black text and a full-colour icon; an **off / inactive** tile is a translucent panel over the wallpaper with tone-on-tone text and a monochrome icon [M]. The last text line of an accessory tile is its state (`On`, `Off`, `Playing`, `Closed`, `100%`, `Paused`, `4 Sensors`) [M]. The off tile is a vibrancy effect in the HIG's sense, blending "the foreground and background colors" [D, HIG Translucency].

## Anatomy
```
Accessory tile 101.5 x 101.5           Scene tile 211 x 54
+----------------------+               +-----------------------------------------+
|  (icon) 15.5, 12     |               |  (icon)   Title                         |
|                      |               +-----------------------------------------+
|  Room        53      |                  9.5       44 (text x)
|  Name        67.5    |
|  State       82      |   <- cap-top offsets from the tile top, pt
+----------------------+
```
Back to front: (1) panel: white, or translucent tint over the blurred wallpaper; continuous-curvature corners; (2) icon at the top left (accessory) or left centre (scene); (3) text lines; (4) optional small circular badge on the icon (HomePod with a muted microphone).

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| kind | accessory (square), scene (wide) | - | - | both |
| on | false, true | false | - | both, in both appearances |
| lines (accessory) | room, name (ellipsis when too long), state | - | - | `Studio` / `Humidity Se...` / `4 Sensors` |
| icon | per accessory category | - | - | bulb, outlet, Apple TV, garage door, desk lamp, sensor, HomePod; house, house with person |
| badge | none, status badge on the icon | none | - | third tile of the second row |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| accessory, on | yes | `10-15-Catalina-Light-Home.png @ 580,1044,204,204` (same pixels in the Dark file) |
| accessory, off | yes | `10-15-Catalina-Light-Home.png @ 143,1044,203,204`; `10-15-Catalina-Dark-Home.png @ 143,1044,203,204` |
| scene, on | yes | `10-15-Catalina-Light-Home.png @ 1017,728,423,109` |
| scene, off | yes | `10-15-Catalina-Light-Home.png @ 143,728,422,109`; Dark same box |
| pressed | no | [I] the tile scales to about 0.95 and springs back (iOS behaviour) |
| updating / no response | no | [I] state line reads `Updating...` / `No Response` in the off style |
| hover, focus | no | [I] none in 10.15 |
| inactive window | no | [I] unchanged |

## Measurements
Evidence shorthand: `L @` = `10-15-Catalina-Light-Home.png`, `D @` = `10-15-Catalina-Dark-Home.png`; a bare `@`, `row y=` or `col x=` is the Light file and holds in the Dark file at the same coordinates. Window origin (112, 76). Tile edges fall on fractional pixels (iOS points x 0.77), so each edge is one partly covered pixel.

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Accessory tile size | 101.5 x 101.5 (203.5 px; = 132 iOS pt x 0.77) | [M] | row y=1146: partial px at 580 and 783, white 581..782; col x=680: partial 1044, white 1045..1246, partial 1247 |
| Scene tile size | 211 x 54 (422 x 108 px; = 274 x 70 iOS pt x 0.77) | [M] | row y=780: partial 1017, white 1018..1438, partial 1439; col x=1200: white 729..835, partial 836 |
| Gap between tiles | 7.5 both ways (= 10 iOS pt x 0.77 = 7.7) | [M] | row y=1100: gap 346..360 (15 px); col x=250: gap 1248..1262 |
| Accessory pitch | 109.4 horizontally (tile lefts x=143, 361, 580, 799, 1017, 1236, 1454, 1674), 109 vertically (tops y=1045, 1263) | [M] | row y=1100; col x=250 |
| Scene pitch | 218.7 horizontally (lefts x=143, 580, 1017, 1455), 61.5 vertically (tops y=729, 852) | [M] | row y=800; col x=300 |
| Corner radius | 13 as a circular fit; the edge leaves the straight line 13.5 pt from the corner (continuous curvature) | [C] | accessory top-left, inset of the white edge on rows 1..27 below the top: 22, 16, 14, 12, 10, 9, 8, 7, 6, 5, 5, 4, 3, 3, 2, 2, 2, 2, 1 ... 0 px (grid `@ 578,1042,16,16`); the 45 degree point is 7.5 px in from both edges = 0.293 x 25.6 px |
| Border | none | [M] | row y=1146: flat wallpaper to x=578, tile from 580. (One darker fringe pixel at x=579, `#005977 (sRGB #005a7a)`, is a compositing artefact; do not draw it) |
| Accessory icon | box at tile x 15.5, y 12; 17 x 24.5 for the bulb; others up to 24 x 24.5 | [M] | bulb `@ 611,1068,34,49`; Apple TV `@ 1042,1069,47,47`; lamp `@ 1479,1068,48,49` |
| Accessory text x | 12 (ink starts 12 to 12.5 from the tile edge) | [M] | `C` at x=604, `M` at 605 (tile edge 580) |
| Accessory text lines | cap tops at 53, 67.5, 82 from the tile top; 14.5 pitch; last baseline 11 above the tile bottom | [M] | `@ 605,1150,79,17`, `@ 604,1179,145,22`, `@ 604,1208,31,17` (tile top 1044, bottom 1247) |
| Scene icon | box at tile x 9.5, vertically centred; 24.5 x 25 (house with person), 20 x 18.5 (house) | [M] | `@ 1036,758,49,50`; `@ 166,763,40,37` |
| Scene title | x 44 from the tile edge; cap top 22.5 from the tile top (vertically centred) | [M] | `@ 1105,773,125,20` (tile 1017, 728) |
| Status badge | 13 pt circle (including a 0.5 pt ring in the tile colour) overlapping the icon's bottom-right | [M] | `@ 625,1310,26,26` (row y=1322: ring at x=625 and 650; col x=638: 1310..1335) |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| On tile fill | `#ffffff` opaque | `#ffffff` opaque | [M] | `@ 700,1100` in both files |
| On tile, name / title text | `#000000` | `#000000` | [M] | row y=1160: stems at 606..607, 611..612; row y=784 |
| On tile, state text | `#85858a` (stems reach `#86868b`) | same | [M] | row y=1218: 605..607, 631..633 |
| On tile icon colours | bulb `#f8cc46 (sRGB #ffcc02)` with grey base `#757575`; Apple TV box `#929295`; lamp `#57a9d7 (sRGB #34aadc)`; scene house `#ea983f (sRGB #f7951f)`, person grey `#6f6559 (sRGB #716557)` | same | [M] | `@ 625,1085`, `@ 1060,1090`, `@ 1497,1100`, `@ 1050,775`; row y=800 @ 1078 |
| Off tile fill, observed | `#396b85 (sRGB #266c88)` .. `#3c7e9d (sRGB #1c7fa0)` over wallpaper `#23586e (sRGB #005970)` .. `#30738c (sRGB #00748f)` | `#163c52 (sRGB #023c54)` .. `#1b4f68 (sRGB #00506b)` over the same wallpaper | [M] | 24 pairs of tile pixel (7 px inside an edge) and gap pixel (centre of the adjacent gap) at y=1060, 1130, 1235, for example `@ 340,1130` vs `@ 353,1130`, `@ 806,1060` vs `@ 791,1060`, `@ 1681,1235` vs `@ 1666,1235`, in both files |
| Off tile, mean change against the adjacent wallpaper | R +17, G +15, B +21 (range +9 .. +29) | R -17, G -32, B -32 (range -12 .. -38) | [C] | means of the 24 pairs; the wallpaper pixels are identical in the two files |
| Off tile recipe | `backdrop-filter: blur(20px)`; `background: rgba(160,210,255,0.14)` | `backdrop-filter: blur(20px)`; `background: rgba(0,10,40,0.34)` | [C] tint fitted to the mean pair (wallpaper `#2a667f (sRGB #026782)` -> `#3b7693 (sRGB #217796)` light, `#19475f (sRGB #004861)` dark; error up to 3 levels on the means, 6 on single samples); blur radius [I] | as above |
| Off tile opaque fallback | `#3b7693 (sRGB #217796)` | `#19475f (sRGB #004861)` | [C] | mean tile colour |
| Off tile, name / title text | `#15465f (sRGB #004761)` (accessory), `#114c6b (sRGB #004d6e)` (scene) | `#89abbf (sRGB #81acc1)` (accessory), `#88aec4 (sRGB #7eafc7)` (scene) | [M] | darkest / lightest ink in `L @ 168,1150,59,17`, `L @ 231,773,120,19`; `D @ 167,1150,60,18`, `D @ 230,772,121,21` |
| Off tile, state text | `#22536c (sRGB #05546f)` | `#618499 (sRGB #58859b)` | [M] | `L @ 167,1208,35,18`; `D @ 166,1208,37,19` |
| Off tile icon | `#16465f (sRGB #004761)` (scene house `#144b67 (sRGB #004c6a)`) | `#88a9bd (sRGB #80aabf)` (scene house `#86acc1 (sRGB #7cadc3)`) | [M] | `L @ 175,1068,31,49`, `L @ 166,763,40,37`; `D @ 173,1067,35,50`, `D @ 166,763,40,37` |
| Off tile text as a rule | wallpaper tone darkened: about black at 0.55 over the tile | wallpaper tone lightened: about white at 0.5 over the tile | [C] | `#15465f (sRGB #004761)` over `#396a84 (sRGB #266b87)`; `#89abbf (sRGB #81acc1)` over `#163c52 (sRGB #023c54)` |

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Accessory text (all three lines) | SF Pro Text 12 pt Bold (15.5 iOS pt x 0.77), 14.5 pt line pitch, left-aligned, one line each, tail-truncated with `...` | [C] | cap height 17 px (`M` 1150..1166, `C` 1179..1196, `O` 1208..1224); vertical stems 2 px solid + 2 anti-aliased = about 3.2 px (row y=1160: 605..608); Semibold cannot be excluded |
| Scene title | SF Pro Text 14 pt Semibold (18 iOS pt x 0.77), single line | [C] | cap height 20 px (`S` 773..792); stems 3 px solid + anti-aliasing (row y=784: 1124..1126) |
| Icons | flat glyphs; full colour on an on tile, single tone on an off tile; SVG assets | [M] | crops `@ 595,1055,70,70`, `@ 1020,740,90,80`, `@ 150,745,80,70` |

### Shadows and effects
No drop shadow on either state [M]: the gap between two tiles is the unmodified wallpaper from the first pixel outside the edge (`L` row y=1100, x=346..360: `#285f76 (sRGB #076079)`, `#265e75 (sRGB #015f78)` ... `#265f76 (sRGB #006079)`; col x=250, y=1248..1262) and the same gap pixels are identical in the Dark file. The off tile blurs what is behind it (the wallpaper's local detail does not show through: tile red values stay within `#39`..`#3c` while the wallpaper beside them ranges `#23`..`#30`) [M].

## Layout and spacing
- Grid origin 15.5 pt from the window's left edge; section header cap top 16.5 pt above the first row (see `apps/home.md`).
- Accessory grid: 101.5 pt squares, 7.5 pt gaps, 8 columns in the 914 pt window (`8 x 101.6 + 7 x 7.7 = 866.7`, leaving 15.5 + 31.5 pt margins); tiles do not stretch [M].
- Scene grid: 211 pt x 54 pt, 7.5 pt gaps, 4 columns = the width of two accessory tiles plus a gap each (`2 x 101.6 + 7.7 = 210.9`) [C].
- Content padding inside an accessory tile: 12 pt left, 12 pt top (icon), 11 pt bottom (last baseline).

## Keyboard and accessibility
No keyboard focus in the 10.15 Catalyst build [I]. Each tile is exposed through the UIKit bridge as a button whose label joins the three lines ("Master Corner Light, On") [I]. ARIA: `<button aria-pressed="true|false">` for accessories; a plain `<button>` for scenes; group each section with `role="group"` and the header as its label.

## Browser notes
- Continuous-curvature corners: use `border-radius: 13px` (within 1 px of the reference) or an SVG squircle clip.
- Off tiles need `backdrop-filter`; without it use the opaque fallbacks, which are correct only over this wallpaper.
- The measured off-tile colours depend on the wallpaper photograph; with another image only the recipe carries over.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Home.png` | 580,1044,204,204 | accessory tile, on (`Master` / `Corner Light` / `On`) |
| light | `10-15-Catalina-Light-Home.png` | 143,1044,203,204 | accessory tile, off, light translucent |
| dark | `10-15-Catalina-Dark-Home.png` | 143,1044,203,204 | accessory tile, off, dark translucent |
| light | `10-15-Catalina-Light-Home.png` | 1017,728,423,109 | scene tile, on (`Studio On`) |
| light | `10-15-Catalina-Light-Home.png` | 143,728,422,109 | scene tile, off |
| dark | `10-15-Catalina-Dark-Home.png` | 143,728,422,109 | scene tile, off, dark |
| light | `10-15-Catalina-Light-Home.png` | 143,1044,1734,424 | whole accessory grid: 8 + 3 tiles, three on |

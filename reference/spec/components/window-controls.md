# Window controls: close, minimize, zoom (`window-controls`)

- **Status:** present
- **AppKit:** `NSWindow.standardWindowButton(.closeButton | .miniaturizeButton | .zoomButton)`; full screen via `collectionBehavior.fullScreenPrimary`
- **HIG:** https://web.archive.org/web/20200503141343/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/
- **Appearances shown:** light, dark; Blue and Graphite accents

## Purpose and behaviour
Three round buttons at the leading end of the title bar: close, minimize, and zoom (enter/exit full screen when the window supports it; Option-click zooms). They "are colorized in the key window and gray in other windows" [D]; glyphs appear on all three when the pointer is over any of them [M]. A control can be individually disabled, for example minimise in a full-screen window [D], [M].

## Anatomy
Circle fill, 0.5 pt darker ring (light appearance only), glyph shown on hover.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| size | regular 12 pt, small 11 pt (utility panel) | regular | `.utilityWindow` | both |
| accent | multicolour, Graphite | multicolour | General > Accent color | both (`Theme-*-Graphite`) |
| zoom role | full screen, zoom (+), exit full screen | full screen | `collectionBehavior` | exit full screen (hover) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| key, no hover | yes | `10-15-Catalina-Light-Finder-Network.png @ 120,80,120,40` |
| hover (glyphs) | yes | `10-15-Catalina-Light-Full-Screen-App.png @ 20,64,120,36` (close and exit-full-screen glyphs) |
| pressed | no | [I] fill darkened by 20% black |
| disabled (one button) | yes | zoom in `...System-Preferences-General.png @ 218,102,24,24`; minimise in `...Full-Screen-App.png @ 66,70,24,24` |
| main, not key | yes | `10-15-Catalina-Light-Finder-Quick-Look.png @ 159,268,104,24` |
| inactive | yes | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 342,128,104,24` |
| Graphite | yes | `10-15-Catalina-Theme-Light-Graphite.png @ 1004,350,104,24` |
| edited document dot | no | [D] dark dot in the close button |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Diameter (regular), including the ring | 12 (24 px) | [M] | close x 128..151, y 86..109 in `10-15-Catalina-Light-Finder-Network.png` |
| Centre spacing | 20 | [M] | left edges at x 128, 168, 208 |
| Centres from the window's top-left, titled bar (22 pt strip) | (14, 11), (34, 11), (54, 11) | [M] | frame origin (112,76) |
| Centres, 38 pt title-hidden bar | (19, 19), (39, 19), (59, 19) | [M] | `10-15-Catalina-Light-Safari-v13.png`: close x 138..161, y 102..125; `...System-Preferences-General.png` row y=114 |
| Centres, full-screen toolbar | (19, 19) from the bar's top-left | [M] | `10-15-Catalina-Light-Full-Screen-App.png`: close x 26..49, y 70..93, bar top y=44 |
| Small size (utility panel): diameter / spacing / first centre | 11 / 18 / (11.5, 8) | [M] | `10-15-Catalina-Light-Help.png`: x 58..79, 94..115, 130..151; y 43..64; frame origin (46,38) |
| Close glyph (hover) | 6 x 6 (12 px), two 45 degree strokes about 1.5 pt wide, centred | [M] | `10-15-Catalina-Light-Full-Screen-App.png @ 32,76,12,12` |
| Exit-full-screen glyph | two right triangles with 4.5 pt legs meeting at the centre: upper one with vertices (118,73) (118,81) (126,81) px, lower one (109,82) (117,82) (117,90) px in a circle spanning x 106..129, y 70..93 | [M] | `10-15-Catalina-Light-Full-Screen-App.png @ 106,70,24,24` |
| Minimise glyph | 8 x 1.5 horizontal bar, centred | [I] | not captured; same stroke as the close glyph |
| Enter-full-screen glyph | the same two triangles pointing outwards (to top-right and bottom-left corners), 1 pt gap along the diagonal | [I] | not captured; mirrors the exit glyph |
| Zoom (+) glyph (Option) | 8 x 8 plus, 1.5 pt strokes | [I] | not captured |

### Colours and fills
Fill is flat with a slightly lighter 0.5 pt band just inside the ring (light appearance).

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Close fill / inner band / ring | `#ed6a5e (sRGB #ff6057)` / `#ee6d62 (sRGB #ff635b)` / `#d25448 (sRGB #e24940)` | `#ed655a (sRGB #ff5a53)` / none / none (edge antialias `#de6357 (sRGB #ef5950)`) | [M] | light `10-15-Catalina-Light-Finder-Network.png @ 140,98`, `@ 130,98`, `@ 128,98`; dark `10-15-Catalina-Dark-Finder-Network.png @ 138,98`, `@ 128,98` |
| Minimise fill / band / ring | `#f6be4f (sRGB #ffbd2d)` / `#f7c553 (sRGB #ffc432)` / `#d8a344 (sRGB #e1a228)` | `#e1c04c (sRGB #e7c029)` / none / none (`#d4b54b (sRGB #d9b52e)`) | [M] | `@ 177,98`, `@ 179,88`, `@ 179,86`; dark `@ 179,98`, `@ 191,98` |
| Zoom fill / band / ring | `#62c555 (sRGB #29c941)` / `#66cc57 (sRGB #2bd042)` / `#56a943 (sRGB #2aad2f)` | `#72be47 (sRGB #53c22c)` / none / none (`#6db445 (sRGB #51b82d)`) | [M] | `@ 220,98`, `@ 219,88`, `@ 219,86`; dark `@ 220,98`, `@ 208,98` |
| Disabled button (key window) | fill `#d1d1d1`, ring `#b0b1b1` | fill `#5f6061` | [M] | `10-15-Catalina-Light-System-Preferences-General.png @ 219,114`, `@ 218,114`; `10-15-Catalina-Dark-System-Preferences-General.png @ 230,114`; About This Mac: `#cdcece`/`#b5b5b6`, dark `#5d5d5e`-`#636464` (`10-15-Catalina-Light-About-This-Mac.png @ 1201,422`, `@ 1200,422`; `10-15-Catalina-Dark-About-This-Mac.png @ 1200,422`) |
| Disabled minimise in full screen | fill `#d1d1d1`, ring `#b0b1b1` | fill `#656972 (sRGB #646973)` (tinted bar) | [M] | `10-15-Catalina-Light-Full-Screen-App.png @ 67,82`, `@ 66,82`; `10-15-Catalina-Dark-Full-Screen-App.png @ 78,82` |
| Main, not key (all three) | fill `#d0d0d0`, ring `#b1b0b2` | fill `#525354` | [M] | `10-15-Catalina-Light-Finder-Quick-Look.png @ 171,280`, `@ 171,268`; `10-15-Catalina-Dark-Finder-Quick-Look.png @ 214,222` |
| Inactive window (all three) | fill `#dedede`, ring `#d5d4d4` on a `#f6f6f6` bar | fill `#4b4b4e` on `#2b2c2f` | [M] | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 354,140`, `@ 342,140`; `10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png @ 382,115` |
| Graphite, close and minimise | fill `#8f8f94`, ring `#727276` | fill `#a3a3a3`, edge `#9b9b9b` | [M] | `10-15-Catalina-Theme-Light-Graphite.png @ 1016,362`, `@ 1027,362`; `10-15-Catalina-Theme-Dark-Graphite.png @ 1016,362`, `@ 1044,362` |
| Graphite, zoom (enabled) | same grey as the other two | same | [I] | zoom is disabled in the captured preference window |
| Hover glyph, close | `#460804 (sRGB #4d0000)` | `#8c1a10 (sRGB #990000)` | [M] | `10-15-Catalina-Light-Full-Screen-App.png @ 38,82`; `10-15-Catalina-Dark-Full-Screen-App.png @ 38,82` |
| Hover glyph, zoom | `#2a6119 (sRGB #036302)` | `#265a16 (sRGB #015c01)` | [M] | `10-15-Catalina-Light-Full-Screen-App.png @ 115,82`; `10-15-Catalina-Dark-Full-Screen-App.png @ 120,77` |
| Hover glyph, minimise | `#90591d (sRGB #995700)` | `#91591d (sRGB #9a5600)` | [I] | not captured; the same darkening ratio as the close and zoom glyphs applied to the minimise fill |

### Text and icons
No text.

### Shadows and effects
None.

## Layout and spacing
The group is always at the leading edge, 8 pt from the window edge in titled bars (13 pt in 38 pt bars, 6 pt in the utility bar). The first toolbar item of a title-hidden bar starts 13 pt after the zoom button (Safari back button fill at x=268, zoom ends at x=241) [M]. Hover is tracked for the whole group, not per button [D].

## Keyboard and accessibility
Command-W, Command-M, Control-Command-F [D]. `AXButton` with subroles `AXCloseButton`, `AXMinimizeButton`, `AXFullScreenButton`/`AXZoomButton`; in HTML use three `<button>`s with `aria-label` "Close", "Minimize", "Zoom"/"Enter Full Screen", not focusable by Tab by default (macOS excludes them from the key loop unless Full Keyboard Access is on) [D].

## Browser notes
Reproducible exactly: 12 px circles, `box-shadow: inset 0 0 0 0.5px <ring>` in light. Draw the glyphs as inline SVG and show them with `.controls:hover svg { opacity: 1 }`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Network.png` | 120,80,120,40 | key, normal |
| dark | `10-15-Catalina-Dark-Finder-Network.png` | 120,80,120,40 | key, normal |
| light | `10-15-Catalina-Light-Full-Screen-App.png` | 20,64,120,36 | hover glyphs, disabled minimise |
| dark | `10-15-Catalina-Dark-Full-Screen-App.png` | 20,64,120,36 | hover glyphs, disabled minimise |
| light | `10-15-Catalina-Theme-Light-Graphite.png` | 996,344,120,36 | Graphite, zoom disabled |
| dark | `10-15-Catalina-Theme-Dark-Graphite.png` | 996,344,120,36 | Graphite, zoom disabled |
| light | `10-15-Catalina-Light-Help.png` | 52,40,106,28 | small (utility) size |

# Accent colour (`accent-colors`)

- **Status:** present (all 8 accents, light and dark)
- **AppKit:** `NSColor.controlAccentColor` (macOS 10.14+), user default `AppleAccentColor` (-1 graphite, 0 red, 1 orange, 2 yellow, 3 green, 5 purple, 6 pink, unset = blue) [D]; `NSColor.currentControlTint` is `.graphiteControlTint` for graphite and `.blueControlTint` otherwise [D]
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/visual-design/color/
- **Appearances shown:** light (three wallpapers: Morning, Day, Evening), dark

## Purpose and behaviour

System Preferences > General > "Accent color" lets the user pick one of eight accents. The accent tints
every control that shows an "on" or "emphasised" state: checkboxes, radio buttons, pop-up button caps,
default buttons, menu and menu-bar selection, selection rings, focus rings. Choosing an accent also
switches "Highlight color" to the matching preset (see `highlight-color`). The HIG tells apps to use
`controlAccentColor` instead of hard-coding blue so that custom controls follow the user's choice
(HIG Color, "System Colors") [D]. Graphite additionally replaces the red/yellow/green window controls
with grey ones and, in dark mode, turns off wallpaper tinting of window backgrounds (measured below).

Evidence files: `10-15-Catalina-Theme-<Variant>-<Accent>.png`, Variant = `Morning`, `Light` (the page
captions it "Day"), `Evening`, `Dark`; Accent = `Blue`, `Purple` (`Purpe` in the Evening file name),
`Pink`, `Red`, `Orange`, `Yellow`, `Green`, `Graphite`. All are 3360x2100 px full-screen captures.

## Anatomy

The accent is not a view; it is a set of derived colours. In Catalina the same accent produces several
different hex values depending on the element:

1. **Swatch colour** (the dot in the General pane, also the thumbnail selection ring): the pure accent.
2. **Control fill** (checkbox, radio, pop-up cap, default button): a lighter, slightly desaturated
   version in light mode (flat for checkbox/radio, a top-to-bottom gradient for pop-up caps and default
   buttons); a darker gradient in dark mode.
3. **Menu selection** (menu item and open menu-bar title): the accent drawn through the menu's vibrant
   material, so it shifts with the wallpaper behind it.
4. **Highlight colour** (text selection): a pale tint, see `highlight-color`.

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| accent | blue, purple, pink, red, orange, yellow, green, graphite | blue | `AppleAccentColor` | all 8, in 4 variants each |
| appearance | light, dark | light | `NSAppearance.Name.aqua` / `.darkAqua` | both |
| window state | key, inactive | key | `NSWindow.isKeyWindow` | key only (the General window is key in all 32) |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| Each accent, key window, light | yes | 24 files (Morning/Light/Evening x 8) |
| Each accent, key window, dark | yes | 8 files (Dark x 8) |
| Inactive window (controls lose the accent and draw grey) | no | [I] AppKit draws "on" checkboxes/radios/pop-up caps in an inactive window with the unselected bezel plus a dark glyph; use the graphite column of the dark table and the unselected control colours from `checkbox`/`radio-button` |
| Pressed | no | [I] darken each fill by multiplying with black at 0.12 |
| Disabled | no | [I] control at 50% opacity, no accent |
| Focus ring | blue only | `10-15-Catalina-Light-Finder-Go-To-Folder.png`, `10-15-Catalina-Light-Safari-v13-Preferences.png` (see table "Focus ring") |
| Default button | blue only | dialogs in this group (see table "Default button") |

## Measurements

### Geometry (pt)

All in the General pane of System Preferences. Window frame in the `Light` and `Dark` files is
x 978..2313, y 324..1679 px (668 x 678 pt) [M]; in the `Morning` and `Evening` files it is x 970..2305,
y 318..1673 px, that is shifted by (-8, -6) px [M]. Coordinates below are for `Light`/`Dark`.

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Accent swatch diameter | 16 pt (32 px, x 1480..1511) | [M] | 10-15-Catalina-Theme-Light-Blue.png @ 1480,602,32,32 |
| Accent swatch pitch | 24 pt (48 px centre to centre; 8 pt gap) | [M] | 10-15-Catalina-Theme-Light-Blue.png row 617: swatches start at 1480, 1528, 1576, 1624, 1672, 1720, 1768, 1816 |
| Swatch border ring | 1 pt (2 px: outer anti-aliased px + one flat px) | [M] | 10-15-Catalina-Theme-Light-Blue.png @ 1480,617 `#2c68c7 (sRGB #1367ce)`, @ 1481,617 `#2664c5 (sRGB #0662cc)`, fill from 1482 |
| Selected swatch centre dot | 5 pt diameter (10 px, x 1491..1500), white, centred | [M] | 10-15-Catalina-Theme-Light-Blue.png row 617 |
| Appearance thumbnail image | 67 x 44 pt (134 x 88 px); corner radius 4.5 to 5 pt as a grid reading, not fitted (the inner arc runs from x 1481 to x 1490..1491 on row 436, as it does in `color-swatch-picker`); build with 4.5 pt [I]: the low end of the reading, which equals the ring's fitted outer radius 6 minus its 1.5 pt width only if the ring's inner edge is concentric, and the fit in `color-swatch-picker` does not support that. This row gave 4 pt [C] while the ring was read as 5.5 pt | [M] size and grid reading; [I] 4.5 | 10-15-Catalina-Theme-Light-Blue.png @ 1481,436,134,88; grid @ 1474,428,16,16 |
| Thumbnail pitch | 86 pt (172 px): images start at x 1481, 1653, 1825 | [M] | 10-15-Catalina-Theme-Light-Blue.png row 480 |
| Thumbnail selection ring | 1.5 pt (3 px) wide, drawn outside the image, outer size 70 x 47 pt, outer radius 6 pt (fit with `tools/corner_fit.py` on the outer edge: best 6, rms 1.7 levels; 10.2 at 5.75, 5.8 at 6.25; the earlier grid reading was 5.5, from the straight edge on column 1478 starting at row 444) | [M]; [C] radius, fit from [M] pixels | 10-15-Catalina-Theme-Light-Blue.png @ 1478,433,140,94; row 480: 1478..1480 ring; grid @ 1474,428,16,16 |
| Unselected thumbnail border | 0.5 pt (1 px) `#d9d9d9` light | [M] | 10-15-Catalina-Theme-Light-Blue.png @ 1652,480 `#d9d9d9` |
| Highlight pop-up colour swatch | 24 x 12 pt (48 x 24 px incl. 0.5 pt border), 8.5 pt from the pop-up's left edge | [M] | 10-15-Catalina-Theme-Light-Blue.png @ 1496,670,48,24 |
| Pop-up cap | 16 pt wide (32 px, x 1744..1775) plus 0.5 pt right edge, 20 pt tall incl. edge rows (y 661..700) | [M] | 10-15-Catalina-Theme-Light-Blue.png row 680, col 1750 |
| Radio button | 16 pt diameter (32 px); dot 5 pt (10 px solid, x 1491..1500, y 889..898, plus 1 px anti-aliasing) | [M] | 10-15-Catalina-Theme-Light-Blue.png @ 1480,878,32,32 |
| Checkbox | 14 pt square (28 px, x 1478..1505, y 1312..1339) | [M] | 10-15-Catalina-Theme-Light-Blue.png @ 1478,1312,28,28 |
| Menu bar open-title highlight | full menu-bar height 22 pt (y 0..43), from 8 px left of the title to 8 px right (x 90..403 for "System Preferences") | [M] | 10-15-Catalina-Theme-Light-Blue.png row 4 |
| Highlighted menu item | 19 pt tall (y 52..89), full menu width (x 90..560), square corners | [M] | 10-15-Catalina-Theme-Light-Blue.png col 95, row 70 |

### Colours and fills: matrix, light appearance ("Day" wallpaper)

File for each cell: `10-15-Catalina-Theme-Light-<Accent>.png` at the pixel in the last column
(k = 0 for Blue .. 7 for Graphite in the column order shown). All values [M]. Flat fills carry +/-1
level of dither noise in these captures; a neighbouring pixel can differ by one step.

| Element | Blue | Purple | Pink | Red | Orange | Yellow | Green | Graphite | px (x,y) |
|---|---|---|---|---|---|---|---|---|---|
| Menu bar open-title background | `#407ee8 (sRGB #2c7cf0)` | `#935799 (sRGB #9d519d)` | `#e16ca2 (sRGB #f262a4)` | `#ce5957 (sRGB #de4f52)` | `#e4904e (sRGB #f18c3d)` | `#edbc5c (sRGB #f5bb46)` | `#83b966 (sRGB #71bc5a)` | `#949494` | 95,10 |
| Highlighted menu item background | `#3f7ee7 (sRGB #2a7cef)` | `#935799 (sRGB #9d519d)` | `#e16ca2 (sRGB #f262a4)` | `#ce5857 (sRGB #de4e52)` | `#e4904d (sRGB #f18c3b)` | `#ecbb5c (sRGB #f4ba46)` | `#83b966 (sRGB #71bc5a)` | `#949494` | 95,70 |
| Highlighted menu item text | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | 138,66 |
| Open menu title text | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | 112,20 |
| Appearance thumbnail selection ring | `#2f7cf7 (sRGB #027aff)` | `#8b4592 (sRGB #963d96)` | `#e55d9c (sRGB #f74f9e)` | `#cf4745 (sRGB #e0383e)` | `#e9873a (sRGB #f8821b)` | `#f3b94b (sRGB #fdb828)` | `#79b756 (sRGB #63ba46)` | `#989898` | 1479,480 |
| Accent swatch, selected: fill | `#2f7cf7 (sRGB #027aff)` | `#8b4592 (sRGB #963d96)` | `#e55e9c (sRGB #f7509e)` | `#d04746 (sRGB #e1383f)` | `#e8873a (sRGB #f7821c)` | `#f3ba4b (sRGB #fdb927)` | `#78b657 (sRGB #62b947)` | `#999899` | 1484+48k,617 |
| Accent swatch, selected: border ring | `#2664c5 (sRGB #0662cc)` | `#6f3775 (sRGB #783179)` | `#b64c7c (sRGB #c4417d)` | `#a63937 (sRGB #b42e32)` | `#b96d2e (sRGB #c56917)` | `#c2953c (sRGB #ca9421)` | `#609245 (sRGB #4e9538)` | `#7a7a7a` | 1481+48k,617 |
| Accent swatch, selected: centre dot | `#ffffff` | `#fffeff` | `#fffeff` | `#fffeff` | `#fffeff` | `#ffffff` | `#ffffff` | `#fffeff` | 1496+48k,617 |
| Highlight pop-up swatch: fill | `#bad7fb (sRGB #b4d7ff)` | `#dbc7dd (sRGB #dfc6df)` | `#f5cde1 (sRGB #fdcbe2)` | `#eec5c6 (sRGB #f6c3c5)` | `#f7dabf (sRGB #fcd9bb)` | `#fbe9c3 (sRGB #fee9be)` | `#d5e9ca (sRGB #d0eac7)` | `#e0e0e0` | 1510,680 |
| Highlight pop-up swatch: border | `#8ba2bd (sRGB #86a2c0)` | `#a596a6 (sRGB #a895a7)` | `#b89ba9 (sRGB #be99aa)` | `#b39594 (sRGB #b99493)` | `#baa58f (sRGB #bea48c)` | `#bcb092 (sRGB #beb08e)` | `#a0af98 (sRGB #9cb096)` | `#a9aaa8` | 1496,680 |
| Pop-up cap: top edge row | `#5b93f3 (sRGB #4c92fa)` | `#b676b4 (sRGB #c171b8)` | `#db6bb1 (sRGB #eb60b4)` | `#c46457 (sRGB #d25d52)` | `#e19b42 (sRGB #ec9826)` | `#e5b158 (sRGB #eeb043)` | `#88b163 (sRGB #7cb458)` | `#a6a6ab` | 1750,661 |
| Pop-up cap: fill 0% (first fill row) | `#77a6f4 (sRGB #6ca6fb)` | `#c28dc1 (sRGB #cc89c4)` | `#df84be (sRGB #ee7dc1)` | `#ce7f74 (sRGB #da7a70)` | `#e5ac5d (sRGB #efaa4c)` | `#eabf73 (sRGB #f1be65)` | `#9dc07e (sRGB #93c276)` | `#b2b2b7` | 1750,662 |
| Pop-up cap: fill 25% | `#669bf5 (sRGB #589afc)` | `#bc7fba (sRGB #c77abe)` | `#de75b7 (sRGB #ee6cba)` | `#c96f63 (sRGB #d6695e)` | `#e3a24c (sRGB #eea035)` | `#e9b863 (sRGB #f1b751)` | `#91b86e (sRGB #86ba64)` | `#acacb1` | 1750,671 |
| Pop-up cap: fill 50% | `#4e8af5 (sRGB #3d88fd)` | `#b26aaf (sRGB #be63b3)` | `#db60ac (sRGB #ec53af)` | `#c2574a (sRGB #d14f44)` | `#e19338 (sRGB #ed9010)` | `#e6ae4d (sRGB #efac32)` | `#7fad57 (sRGB #70b049)` | `#a2a2a7` | 1750,680 |
| Pop-up cap: fill 75% | `#3579f6 (sRGB #1c77ff)` | `#a854a4 (sRGB #b54ba8)` | `#d94aa0 (sRGB #eb36a3)` | `#bc402f (sRGB #cb3324)` | `#de8430 (sRGB #ec8000)` | `#e5a23c (sRGB #f0a010)` | `#6ca140 (sRGB #5aa42c)` | `#98989d` | 1750,690 |
| Pop-up cap: fill 100% (last fill row) | `#286ef6 (sRGB #076bff)` | `#a2469d (sRGB #af3ba1)` | `#d83f98 (sRGB #eb259b)` | `#b73322 (sRGB #c72111)` | `#de7a2e (sRGB #ed7401)` | `#e39b37 (sRGB #ef9802)` | `#619a34 (sRGB #4c9d19)` | `#919196` | 1750,699 |
| Pop-up cap: bottom edge row | `#2165f6 (sRGB #0361ff)` | `#9f4198 (sRGB #ac359c)` | `#d73b91 (sRGB #ea1e94)` | `#b6321f (sRGB #c6200b)` | `#dc7b2e (sRGB #ea7601)` | `#e49d37 (sRGB #ef9a00)` | `#5b9730 (sRGB #439a11)` | `#7b7b80` | 1750,700 |
| Pop-up cap: right edge column | `#3d7df5 (sRGB #297bfe)` | `#ab5ca6 (sRGB #b754aa)` | `#d852a2 (sRGB #ea42a5)` | `#bd4939 (sRGB #cc3f30)` | `#de8c32 (sRGB #eb8800)` | `#e5a841 (sRGB #efa61c)` | `#72a548 (sRGB #61a837)` | `#929297` | 1776,680 |
| Pop-up cap: arrow glyph | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | 1759,670 |
| Radio on: top edge row | `#4382f4 (sRGB #3080fc)` | `#ad61ac (sRGB #b95ab0)` | `#d958a8 (sRGB #ea49ab)` | `#bf4f41 (sRGB #ce463a)` | `#de8e38 (sRGB #eb8b15)` | `#e4a846 (sRGB #eea628)` | `#77a74e (sRGB #67aa3f)` | `#929399 (sRGB #92939a)` | 1496,878 |
| Radio on: fill | `#4d8af5 (sRGB #3b89fd)` | `#b26aaf (sRGB #be63b3)` | `#db60ab (sRGB #ec53ae)` | `#c25749 (sRGB #d14f42)` | `#e19438 (sRGB #ed9110)` | `#e6ad4c (sRGB #f0ab31)` | `#7ead56 (sRGB #6fb048)` | `#999a9e` | 1484,894 |
| Radio on: bottom edge row | `#4483f4 (sRGB #3181fc)` | `#ad60aa (sRGB #b959ae)` | `#d957a6 (sRGB #eb48a9)` | `#bf4d3f (sRGB #ce4337)` | `#de8d36 (sRGB #eb890f)` | `#e5a947 (sRGB #efa729)` | `#78a84e (sRGB #68ab3e)` | `#929297` | 1496,909 |
| Radio on: left edge px | `#4583f5 (sRGB #3281fd)` | `#ad61aa (sRGB #b95aae)` | `#d957a6 (sRGB #eb48a9)` | `#bf4e3f (sRGB #ce4437)` | `#de8d37 (sRGB #eb8913)` | `#e6a847 (sRGB #f0a629)` | `#78a84f (sRGB #68ab40)` | `#929297` | 1480,894 |
| Radio on: centre dot | `#fffffe` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#fffffe` | `#fffffe` | `#ffffff` | 1496,894 |
| Radio on: dot shadow (2nd px below dot) | `#3570dc (sRGB #216ee4)` | `#985095 (sRGB #a34999)` | `#c14791 (sRGB #d13894)` | `#a83e30 (sRGB #b63428)` | `#c7792b (sRGB #d37500)` | `#cc9339 (sRGB #d59119)` | `#65923f (sRGB #569530)` | `#7e7f84 (sRGB #7e7f85)` | 1496,900 |
| Checkbox on: top edge row | `#4181f4 (sRGB #2d7ffc)` | `#ac5fa8 (sRGB #b858ac)` | `#d955a4 (sRGB #eb45a7)` | `#be4c3c (sRGB #cd4234)` | `#df8c32 (sRGB #ec8800)` | `#e5a742 (sRGB #efa51f)` | `#75a64a (sRGB #65a939)` | `#919296` | 1492,1312 |
| Checkbox on: fill | `#4d89f5 (sRGB #3c87fd)` | `#b26aaf (sRGB #be63b3)` | `#db5fab (sRGB #ec52ae)` | `#c15649 (sRGB #d04e43)` | `#e09338 (sRGB #ec9011)` | `#e6ad4c (sRGB #f0ab31)` | `#7fac56 (sRGB #71af48)` | `#99999e` | 1480,1326 |
| Checkbox on: bottom edge row | `#4181f5 (sRGB #2d7ffd)` | `#ad5fa8 (sRGB #b957ac)` | `#da54a4 (sRGB #ec44a7)` | `#bf4b3c (sRGB #ce4134)` | `#e08c32 (sRGB #ed8800)` | `#e5a743 (sRGB #efa521)` | `#76a64b (sRGB #66a93b)` | `#929196` | 1492,1339 |
| Checkbox on: left edge px | `#4081f4 (sRGB #2b7ffc)` | `#ad5fa9 (sRGB #b957ad)` | `#da54a5 (sRGB #ec44a8)` | `#be4b3d (sRGB #cd4135)` | `#e08c33 (sRGB #ed8803)` | `#e4a742 (sRGB #eea51f)` | `#75a64a (sRGB #65a939)` | `#919197 (sRGB #919198)` | 1478,1326 |
| Close button fill | `#ee6a5e (sRGB #ff5f57)` | `#ed695f (sRGB #ff5e58)` | `#ed695f (sRGB #ff5e58)` | `#ed695f (sRGB #ff5e58)` | `#ed695f (sRGB #ff5e58)` | `#ee6a5e (sRGB #ff5f57)` | `#ee6a5e (sRGB #ff5f57)` | `#8d8d92` | 1016,361 |
| Close button edge (top px) | `#d25347 (sRGB #e3483f)` | `#d15548 (sRGB #e14a40)` | `#d15548 (sRGB #e14a40)` | `#d15548 (sRGB #e14a40)` | `#d15548 (sRGB #e14a40)` | `#d25347 (sRGB #e3483f)` | `#d25347 (sRGB #e3483f)` | `#727376` | 1016,350 |
| Minimize button fill | `#f5be4f (sRGB #febd2e)` | `#f6be50 (sRGB #ffbd2f)` | `#f6be50 (sRGB #ffbd2f)` | `#f6be50 (sRGB #ffbd2f)` | `#f6be50 (sRGB #ffbd2f)` | `#f5be4f (sRGB #febd2e)` | `#f5be4f (sRGB #febd2e)` | `#8d8d92` | 1056,361 |
| Minimize button edge (top px) | `#d8a243 (sRGB #e1a126)` | `#d7a244 (sRGB #e0a128)` | `#d7a244 (sRGB #e0a128)` | `#d7a244 (sRGB #e0a128)` | `#d7a244 (sRGB #e0a128)` | `#d8a243 (sRGB #e1a126)` | `#d8a243 (sRGB #e1a126)` | `#727176` | 1056,350 |
| Zoom button fill (disabled in this window) | `#cfcfcf` | `#cfcecf` | `#cfcecf` | `#cfcecf` | `#cfcecf` | `#cfcfcf` | `#cfcfcf` | `#cfcecf` | 1096,361 |
| Window background | `#ececec` | `#ececec` | `#ececec` | `#ececec` | `#ececec` | `#ececec` | `#ececec` | `#ececec` | 2200,500 |

Reading the light table:

- Checkbox and radio "on" fills are **flat** in light mode (the 20%, 50% and 85% rows of each control
  measure the same value +/-1; for example blue radio col x=1496: y 879..887 all `#4c89f5 (sRGB #3a87fd)`..`#4d8af6 (sRGB #3b88fe)`) [M],
  with a 0.5 pt edge that is the fill darkened by about 4% (`#4d8af5 (sRGB #3b89fd)` -> `#4382f4 (sRGB #3080fc)`) [M].
- The pop-up cap is a five-stop vertical gradient; the 50% stop equals the checkbox/radio fill [M].
  CSS for blue: `linear-gradient(#77a6f4 (sRGB #6ca6fb) 0%, #669bf5 (sRGB #589afc) 25%, #4e8af5 (sRGB #3d88fd) 50%, #3579f6 (sRGB #1c77ff) 75%, #286ef6 (sRGB #076bff) 100%)`
  with `border-top: 0.5px solid #5b93f3 (sRGB #4c92fa); border-bottom: 0.5px solid #2165f6 (sRGB #0361ff); border-right: 0.5px solid #3d7df5 (sRGB #297bfe)` [C].
- The white radio dot casts a 1 pt shadow below it: the first px under the dot blends to the fill, the
  second is the fill darkened by about 10% (`#4d8af5 (sRGB #3b89fd)` -> `#3570dc (sRGB #216ee4)`), the third by about 5% (10-15-Catalina-Theme-Light-Blue.png @ 1496,901 `#417de8 (sRGB #2f7bf0)`) [M]. The checkmark has the same shadow.
- Graphite controls in light mode are a cool grey `#99999e` (not neutral), menu selection is neutral
  `#949494`, and the swatch itself is `#989898` [M].
- Window controls: only graphite changes them. Close and minimize become the same grey `#8d8d92` with
  edge `#727376`; the disabled zoom button stays `#cfcfcf` for every accent [M]. The zoom button's
  graphite active colour is not shown here; it is the same grey as close/minimize, as the appearance
  thumbnails in the same screenshots show three identical grey dots
  (10-15-Catalina-Theme-Light-Graphite.png @ 1500,470,60,30) [M for the thumbnail, I for the real control].

### Colours and fills: matrix, dark appearance

File for each cell: `10-15-Catalina-Theme-Dark-<Accent>.png`. All values [M].

| Element | Blue | Purple | Pink | Red | Orange | Yellow | Green | Graphite | px (x,y) |
|---|---|---|---|---|---|---|---|---|---|
| Menu bar open-title background | `#2c6ed6 (sRGB #0c6cdd)` | `#7a3f80 (sRGB #833984)` | `#c75489 (sRGB #d7488b)` | `#b5413f (sRGB #c43539)` | `#ca7736 (sRGB #d77320)` | `#d3a244 (sRGB #dba129)` | `#6ba04e (sRGB #59a341)` | `#68748b (sRGB #66748d)` | 95,10 |
| Highlighted menu item background | `#2c6dd5 (sRGB #0e6bdc)` | `#793f80 (sRGB #823984)` | `#c65388 (sRGB #d6478a)` | `#b4403f (sRGB #c3343a)` | `#c97735 (sRGB #d5731e)` | `#d2a144 (sRGB #daa029)` | `#6a9f4d (sRGB #58a240)` | `#697488 (sRGB #67748a)` | 95,70 |
| Highlighted menu item text | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | 138,66 |
| Open menu title text | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | 112,20 |
| Appearance thumbnail selection ring | `#2f7cf7 (sRGB #027aff)` | `#9a56a3 (sRGB #a54fa8)` | `#e55d9d (sRGB #f74e9f)` | `#ec5e5e (sRGB #ff5158)` | `#e8863b (sRGB #f7811e)` | `#f2b94b (sRGB #fcb828)` | `#78b657 (sRGB #62b947)` | `#8c8c8c` | 1651,480 |
| Accent swatch, selected: fill | `#2f7cf7 (sRGB #027aff)` | `#9b57a3 (sRGB #a650a7)` | `#e55e9c (sRGB #f7509e)` | `#ed5f5e (sRGB #ff5258)` | `#e8873a (sRGB #f7821c)` | `#f3b94b (sRGB #fdb828)` | `#78b756 (sRGB #62ba46)` | `#8c8c8c` | 1484+48k,617 |
| Accent swatch, selected: border ring | `#5997f8 (sRGB #4796ff)` | `#ae79b5 (sRGB #b874b9)` | `#ea7faf (sRGB #fa76b1)` | `#f07f7e (sRGB #ff777a)` | `#eca061 (sRGB #f89d53)` | `#f5c76f (sRGB #fdc65e)` | `#93c677 (sRGB #83c96d)` | `#a3a3a4` | 1481+48k,617 |
| Accent swatch, selected: centre dot | `#ffffff` | `#fffeff` | `#fffeff` | `#fffeff` | `#fffeff` | `#fffeff` | `#fffeff` | `#ffffff` | 1496+48k,617 |
| Highlight pop-up swatch: fill | `#476388 (sRGB #40638b)` | `#6c586e (sRGB #705770)` | `#81596d (sRGB #88566e)` | `#845a59 (sRGB #8b5858)` | `#83664b (sRGB #886547)` | `#877550 (sRGB #8a754a)` | `#627556 (sRGB #5d7653)` | `#686868` | 1510,680 |
| Highlight pop-up swatch: border | `#738aa5 (sRGB #6e8aa8)` | `#908292 (sRGB #938193)` | `#a08391 (sRGB #a68192)` | `#a28382 (sRGB #a88281)` | `#a28d77 (sRGB #a68c74)` | `#a5987b (sRGB #a79877)` | `#889880 (sRGB #84997e)` | `#8c8e8d` | 1496,680 |
| Pop-up cap: row above fill (outer edge) | `#29292a` | `#29292a` | `#29292a` | `#29292a` | `#29292a` | `#29292a` | `#29292a` | `#2d2d2d` | 1750,661 |
| Pop-up cap: fill row 1 (top highlight) | `#6998e8 (sRGB #5d97ef)` | `#b77fbb (sRGB #c17abf)` | `#da7ea5 (sRGB #e877a6)` | `#eb8077 (sRGB #fb7972)` | `#f4b45b (sRGB #ffb246)` | `#f8d262 (sRGB #fed248)` | `#8ed174 (sRGB #77d567)` | `#b3b3b3` | 1750,662 |
| Pop-up cap: fill row 2 | `#3874df (sRGB #2472e7)` | `#9d53a2 (sRGB #a94ba6)` | `#cf5384 (sRGB #e04685)` | `#e5574a (sRGB #f74941)` | `#f19938 (sRGB #ff9503)` | `#f3c244 (sRGB #fbc109)` | `#6cc04b (sRGB #47c432)` | `#9e9e9e` | 1750,663 |
| Pop-up cap: fill 25% | `#2d69da (sRGB #1767e2)` | `#96489b (sRGB #a23fa0)` | `#c9497b (sRGB #da3a7c)` | `#e14e3f (sRGB #f33e34)` | `#f09135 (sRGB #fe8c00)` | `#eebb40 (sRGB #f7ba00)` | `#63b942 (sRGB #39bd25)` | `#999999` | 1750,671 |
| Pop-up cap: fill 50% | `#2c66d3 (sRGB #1764db)` | `#924797 (sRGB #9d3e9b)` | `#c24777 (sRGB #d23978)` | `#d94b3e (sRGB #eb3c34)` | `#f08d34 (sRGB #ff8800)` | `#e7b53e (sRGB #efb401)` | `#61b440 (sRGB #39b824)` | `#999999` | 1750,680 |
| Pop-up cap: fill 75% | `#2a63cc (sRGB #1561d3)` | `#8c4391 (sRGB #973b95)` | `#bc4473 (sRGB #cb3674)` | `#d1483b (sRGB #e23a31)` | `#f08933 (sRGB #ff8400)` | `#deaf3b (sRGB #e6ae00)` | `#5dad3e (sRGB #37b124)` | `#999999` | 1750,690 |
| Pop-up cap: fill 100% (last fill row) | `#2960c6 (sRGB #155ecd)` | `#88418d (sRGB #933991)` | `#b6426f (sRGB #c53570)` | `#cb4639 (sRGB #dc382f)` | `#ed8532 (sRGB #fc7f00)` | `#d8aa39 (sRGB #e0a900)` | `#5aa83b (sRGB #35ac20)` | `#999999` | 1750,699 |
| Pop-up cap: row below fill (outer edge) | `#232325` | `#232325` | `#232325` | `#232325` | `#232325` | `#232325` | `#232325` | `#282828` | 1750,700 |
| Pop-up cap: arrow glyph | `#dee8f9 (sRGB #dce8fb)` | `#eee3f0 (sRGB #f0e2f1)` | `#f6e2ec (sRGB #fae1ed)` | `#fae3e2 (sRGB #ffe2e1)` | `#fceeda (sRGB #ffeed8)` | `#fdf5da (sRGB #fef5d7)` | `#e6f5e0 (sRGB #e2f6de)` | `#252525` | 1759,670 |
| Radio on: top row (highlight) | `#6694e3 (sRGB #5b93e9)` | `#b27bb8 (sRGB #bc76bc)` | `#d57ba1 (sRGB #e374a2)` | `#e47d75 (sRGB #f37671)` | `#f0af59 (sRGB #fbad44)` | `#f1cd60 (sRGB #f7cd47)` | `#8acc72 (sRGB #73cf66)` | `#afafaf` | 1496,878 |
| Radio on: fill row 2 | `#3975e0 (sRGB #2573e8)` | `#9f54a5 (sRGB #ab4caa)` | `#cf5486 (sRGB #df4787)` | `#e6594b (sRGB #f84c42)` | `#f19a39 (sRGB #ff9606)` | `#f4c244 (sRGB #fcc109)` | `#6dc04d (sRGB #49c436)` | `#9e9e9e` | 1496,879 |
| Radio on: fill 20% | `#2e6bdc (sRGB #1869e4)` | `#98489c (sRGB #a43fa1)` | `#ca497c (sRGB #db3a7d)` | `#e24e40 (sRGB #f43e35)` | `#f19135 (sRGB #ff8c00)` | `#f0bb40 (sRGB #f9ba00)` | `#65b942 (sRGB #3ebd25)` | `#999999` | 1496,884 |
| Radio on: fill 50% (centre row) | `#2b66d3 (sRGB #1564db)` | `#914696 (sRGB #9c3d9a)` | `#c24878 (sRGB #d23a79)` | `#d84b3d (sRGB #ea3c32)` | `#f08d35 (sRGB #ff8802)` | `#e6b53e (sRGB #eeb401)` | `#61b440 (sRGB #39b824)` | `#999999` | 1484,894 |
| Radio on: fill 87% | `#2a61c8 (sRGB #175fcf)` | `#8a438f (sRGB #953b93)` | `#b94372 (sRGB #c83573)` | `#ce473b (sRGB #df3931)` | `#f08633 (sRGB #ff8001)` | `#dbab3b (sRGB #e3aa05)` | `#5caa3d (sRGB #37ae23)` | `#999999` | 1496,905 |
| Radio on: last row | `#285ec2 (sRGB #155cc9)` | `#854089 (sRGB #8f388d)` | `#b2416d (sRGB #c1346e)` | `#c74538 (sRGB #d7372e)` | `#e88231 (sRGB #f77c00)` | `#d3a638 (sRGB #dba501)` | `#59a53b (sRGB #35a922)` | `#959595` | 1496,909 |
| Radio on: centre dot | `#dee7f7 (sRGB #dce7f9)` | `#ede4ef (sRGB #efe3f0)` | `#f4e3eb (sRGB #f8e2eb)` | `#f8e4e1 (sRGB #fce3e0)` | `#fceed9 (sRGB #ffeed6)` | `#faf4db (sRGB #fbf4d8)` | `#e4f4e0 (sRGB #e0f5de)` | `#262525` | 1496,894 |
| Checkbox on: top row (highlight) | `#6998e8 (sRGB #5d97ef)` | `#b77fbb (sRGB #c17abf)` | `#d97fa4 (sRGB #e778a5)` | `#eb8176 (sRGB #fb7a71)` | `#f4b55a (sRGB #feb344)` | `#f7d362 (sRGB #fdd348)` | `#8ed274 (sRGB #77d667)` | `#b2b2b2` | 1492,1312 |
| Checkbox on: fill row 2 | `#3874df (sRGB #2472e7)` | `#9e53a2 (sRGB #aa4ba6)` | `#cf5384 (sRGB #e04685)` | `#e55849 (sRGB #f74b3f)` | `#f29938 (sRGB #ff9502)` | `#f3c243 (sRGB #fbc103)` | `#6dc04b (sRGB #49c432)` | `#9d9d9d` | 1492,1313 |
| Checkbox on: fill 20% | `#2e6bda (sRGB #1769e2)` | `#97499c (sRGB #a340a1)` | `#c9497c (sRGB #da3a7d)` | `#e14e40 (sRGB #f33e35)` | `#f19136 (sRGB #ff8c02)` | `#efbb41 (sRGB #f8ba05)` | `#65ba43 (sRGB #3dbe27)` | `#999999` | 1492,1318 |
| Checkbox on: fill 50% (centre row) | `#2c66d3 (sRGB #1764db)` | `#904696 (sRGB #9b3d9a)` | `#c24777 (sRGB #d23978)` | `#d84b3d (sRGB #ea3c32)` | `#f08d35 (sRGB #ff8802)` | `#e6b53e (sRGB #eeb401)` | `#60b340 (sRGB #38b724)` | `#989898` | 1480,1326 |
| Checkbox on: fill 85% | `#2961c8 (sRGB #145fcf)` | `#8a438e (sRGB #953b92)` | `#b94371 (sRGB #c83672)` | `#ce4839 (sRGB #df3a2e)` | `#f08732 (sRGB #ff8100)` | `#dbac3a (sRGB #e3ab00)` | `#5caa3c (sRGB #37ae21)` | `#999999` | 1492,1336 |
| Checkbox on: last row | `#2960c6 (sRGB #155ecd)` | `#89418c (sRGB #943990)` | `#b7426f (sRGB #c63570)` | `#cc4638 (sRGB #dd382e)` | `#ed8531 (sRGB #fc7f00)` | `#d9aa39 (sRGB #e1a900)` | `#5ba83b (sRGB #37ac20)` | `#999999` | 1492,1339 |
| Checkbox on: checkmark | `#d2dff5 (sRGB #cfdff7)` | `#e8d9e8 (sRGB #ebd8e9)` | `#f2d9e3 (sRGB #f7d8e3)` | `#f5d9d6 (sRGB #fad8d5)` | `#fce8cc (sRGB #ffe8c8)` | `#faefcd (sRGB #fcefc9)` | `#dcefd5 (sRGB #d7f0d3)` | `#2e2d2e` | 1494,1328 |
| Close button fill | `#ed6659 (sRGB #ff5b51)` | `#ed655a (sRGB #ff5a53)` | `#ed655a (sRGB #ff5a53)` | `#ed655a (sRGB #ff5a53)` | `#ed655a (sRGB #ff5a53)` | `#ed655a (sRGB #ff5a53)` | `#ed655a (sRGB #ff5a53)` | `#a3a3a3` | 1016,361 |
| Close button edge (top px) | `#df6257 (sRGB #f05850)` | `#df6357 (sRGB #f05950)` | `#df6357 (sRGB #f05950)` | `#df6357 (sRGB #f05950)` | `#df6357 (sRGB #f05950)` | `#df6357 (sRGB #f05950)` | `#df6357 (sRGB #f05950)` | `#9d9d9c` | 1016,350 |
| Minimize button fill | `#e0c04c (sRGB #e5c029)` | `#e1c04d (sRGB #e7c02b)` | `#e1c04d (sRGB #e7c02b)` | `#e1c04d (sRGB #e7c02b)` | `#e1c04d (sRGB #e7c02b)` | `#e1c04d (sRGB #e7c02b)` | `#e1c04d (sRGB #e7c02b)` | `#a3a4a4` | 1056,361 |
| Minimize button edge (top px) | `#d4b64a (sRGB #d9b62c)` | `#d4b54b (sRGB #d9b52e)` | `#d4b54b (sRGB #d9b52e)` | `#d4b54b (sRGB #d9b52e)` | `#d4b54b (sRGB #d9b52e)` | `#d4b54b (sRGB #d9b52e)` | `#d4b54b (sRGB #d9b52e)` | `#9d9d9c` | 1056,350 |
| Zoom button fill (disabled in this window) | `#636465` | `#636364` | `#636364` | `#636364` | `#636364` | `#636364` | `#636364` | `#666666` | 1096,361 |
| Window background | `#303032` | `#303032` | `#303032` | `#303032` | `#303032` | `#303032` | `#303032` | `#323232` | 2200,500 |

Reading the dark table:

- Checkbox, radio and pop-up cap share one recipe in dark mode: a 1 px top highlight row (the fill
  lightened by about 30% white), then a linear gradient from the 0% colour to the 100% colour. Blue:
  `linear-gradient(#2e6bde (sRGB #1869e6), #2960c6 (sRGB #155ecd))` under `box-shadow: inset 0 0.5px 0 rgba(255,255,255,0.3)`; full
  column 10-15-Catalina-Theme-Dark-Blue.png col x=1750, y 662..699: `#6998e8 (sRGB #5d97ef)`, `#3874df (sRGB #2472e7)`, `#2e6bde (sRGB #1869e6)` ... `#2960c6 (sRGB #155ecd)` [M].
  There is no accent-coloured edge; the outer 0.5 pt edge is the dark control outline (`#29292a` above,
  `#232325` below) [M].
- Orange is the exception: its gradient is almost flat (`#f19135 (sRGB #ff8c00)` -> `#ed8532 (sRGB #fc7f00)`) [M].
- Glyphs (radio dot, checkmark, pop-up arrows) are not pure white in dark mode; they are white at about
  0.85 alpha over the fill (blue `#dee8f9 (sRGB #dce8fb)`, yellow `#fdf5da (sRGB #fef5d7)`) [M; alpha C from blue:
  (0xde - 0x2c) / (0xff - 0x2c) = 0.84].
- **Graphite in dark mode inverts the glyphs**: controls are a flat neutral `#999999` with a
  `#b3b3b3` top row and the dot, checkmark and arrows are near-black `#252525`/`#262525`/`#2e2d2e` [M].
- **Dark swatch colours differ from light for purple and red**: purple `#9b57a3 (sRGB #a650a7)` (light `#8b4592 (sRGB #963d96)`),
  red `#ed5f5e (sRGB #ff5258)` (light `#d04746 (sRGB #e1383f)`), graphite `#8c8c8c` (light `#989898`); blue, pink, orange, yellow and
  green are the same in both appearances. In dark mode the swatch ring is lighter than the fill
  (`#5997f8 (sRGB #4796ff)` around `#2f7cf7 (sRGB #027aff)`) where in light mode it is darker [M].
- **Desktop tinting**: the dark window background is `#303032` (slightly blue, picked up from the
  wallpaper) for the seven colour accents and neutral `#323232` for graphite; every grey in the window
  shifts the same way (title bar `#424344` vs `#434343`, 10-15-Catalina-Theme-Dark-Blue.png / 10-15-Catalina-Theme-Dark-Graphite.png
  @ 1700,330), which is why the two files differ over the whole window [M]. This matches the documented
  behaviour that the graphite accent disables window tinting in dark mode [D: HIG Dark Mode, "desktop
  tinting"; https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/visual-design/dark-mode/].
- Dark graphite menu selection is not a flat colour: `#68748b (sRGB #66748d)`, `#65748a (sRGB #62748c)`, `#697488 (sRGB #67748a)`, `#66748a (sRGB #63748c)` at
  four sample points (10-15-Catalina-Theme-Dark-Graphite.png @ 95,10; 300,40; 95,70; 500,60) [M]. It is a translucent
  grey over the blurred wallpaper; use `rgba(255,255,255,0.25)` over the menu material [I].

### Unselected accent swatches (the picker itself)

The eight swatches are the same in every screenshot of an appearance (checked across all 8 files per
appearance, +/-1 level) [M]. Sample px: fill at 1496+48i,617 and ring at 1481+48i,617 (i = swatch
index 0..7). The values below are read from `10-15-Catalina-Theme-Light-Graphite.png` and
`10-15-Catalina-Theme-Dark-Graphite.png` for i = 0..6 and from the `-Blue` files for i = 7.

| Swatch | Light fill | Light ring | Dark fill | Dark ring | Tag |
|---|---|---|---|---|---|
| Blue | `#2f7cf7 (sRGB #027aff)` | `#2564c5 (sRGB #0262cc)` | `#2f7cf6 (sRGB #027aff)` | `#5997f8 (sRGB #4796ff)` | [M] |
| Purple | `#8a4491 (sRGB #953c95)` | `#6f3775 (sRGB #783179)` | `#9a56a3 (sRGB #a54fa8)` | `#ae79b6 (sRGB #b874ba)` | [M] |
| Pink | `#e55d9d (sRGB #f74e9f)` | `#b64c7c (sRGB #c4417d)` | `#e55e9c (sRGB #f7509e)` | `#ea7eb0 (sRGB #fa75b2)` | [M] |
| Red | `#cf4645 (sRGB #e0373e)` | `#a63937 (sRGB #b42e32)` | `#ec5f5e (sRGB #fe5258)` | `#f07f7e (sRGB #ff777a)` | [M] |
| Orange | `#e9873a (sRGB #f8821b)` | `#b96d2e (sRGB #c56917)` | `#e98739 (sRGB #f88219)` | `#ed9f61 (sRGB #fa9c53)` | [M] |
| Yellow | `#f2b94a (sRGB #fcb826)` | `#c2943c (sRGB #ca9321)` | `#f2b94b (sRGB #fcb828)` | `#f5c86f (sRGB #fdc75d)` | [M] |
| Green | `#78b657 (sRGB #62b947)` | `#609344 (sRGB #4e9637)` | `#79b756 (sRGB #63ba46)` | `#94c578 (sRGB #85c86e)` | [M] |
| Graphite | `#989898` | `#7a7a7a` | `#8c8c8c` | `#a3a3a4` | [M] |

The light ring is the fill multiplied by about 0.80; the dark ring is the fill mixed with about 20%
white [C]. The thumbnail artwork inside the Appearance picker is re-tinted with the accent too (its
miniature menu bar highlight uses the swatch colour, and graphite turns its three window dots grey) [M:
10-15-Catalina-Theme-Light-Blue.png @ 1481,436,134,88 vs 10-15-Catalina-Theme-Light-Graphite.png same rectangle].

### Morning, Day and Evening (light appearance on three wallpapers)

Measured, not assumed:

- **Inside the window nothing changes with the wallpaper.** Morning and Evening files of the same
  accent are pixel-identical over the whole window (x 970..2305, y 318..1673) except 111..113 px in the
  four rounded corners, where the anti-aliased corner blends with the wallpaper (diff with tolerance 3,
  blue, red and graphite pairs) [M]. Every control colour in the light table above reproduces in the
  Morning and Evening files at (x-8, y-6) within +/-1 level.
- **Layout differences Morning/Evening vs Light(Day)** are content, not theme: (1) Morning/Evening have
  "Auto" selected in Appearance, Day has "Light", so the selection ring sits on a different thumbnail
  (Morning ring sample @ 1815,474; Day @ 1479,480); (2) the default-browser pop-up reads
  "Safari (13.0.2)" in Morning/Evening and "Safari" in Day/Dark, and all four pop-ups in that column are
  8 pt wider (cap at x 1752..1783 in Morning actual px vs 1744..1775 in Day); (3) the window sits
  (8, 6) px further up-left; (4) the menu's Hide/Hide Others items are enabled in Morning/Day/Dark and
  disabled in Evening, where Show All is enabled instead; (5) menu-bar clock and a location arrow extra [M].
- **What does change is everything vibrant**: the menu bar, the menu, and therefore the accent seen
  through them.

| Element (px, all three files) | Wallpaper | Blue | Purple | Pink | Red | Orange | Yellow | Green | Graphite | Tag |
|---|---|---|---|---|---|---|---|---|---|---|
| Menu bar open-title background (95,10) | Morning | `#4e8aee (sRGB #3c89f6)` | `#9d64a3 (sRGB #a75fa7)` | `#e878ac (sRGB #f96fae)` | `#d66664 (sRGB #e65e60)` | `#eb9b5b (sRGB #f8974c)` | `#f3c469 (sRGB #fbc356)` | `#8ec272 (sRGB #7ec567)` | `#9f9f9f` | [M] |
| Menu bar open-title background (95,10) | Day | `#407ee8 (sRGB #2c7cf0)` | `#935799 (sRGB #9d519d)` | `#e16ca2 (sRGB #f262a4)` | `#ce5957 (sRGB #de4f52)` | `#e4904e (sRGB #f18c3d)` | `#edbc5c (sRGB #f5bb46)` | `#83b966 (sRGB #71bc5a)` | `#949494` | [M] |
| Menu bar open-title background (95,10) | Evening | `#2f6ed8 (sRGB #166ce0)` | `#834689 (sRGB #8d408d)` | `#d25c92 (sRGB #e25094)` | `#bf4846 (sRGB #ce3d40)` | `#d5803d (sRGB #e27c28)` | `#deac4c (sRGB #e6ab32)` | `#73a955 (sRGB #61ac48)` | `#848484` | [M] |
| Highlighted menu item background (95,70) | Morning | `#4a87ed (sRGB #3886f5)` | `#9b61a1 (sRGB #a55ca5)` | `#e676aa (sRGB #f76dac)` | `#d46361 (sRGB #e45a5d)` | `#e99858 (sRGB #f69449)` | `#f2c266 (sRGB #fac153)` | `#8cc070 (sRGB #7cc365)` | `#9c9c9c` | [M] |
| Highlighted menu item background (95,70) | Day | `#3f7ee7 (sRGB #2a7cef)` | `#935799 (sRGB #9d519d)` | `#e16ca2 (sRGB #f262a4)` | `#ce5857 (sRGB #de4e52)` | `#e4904d (sRGB #f18c3b)` | `#ecbb5c (sRGB #f4ba46)` | `#83b966 (sRGB #71bc5a)` | `#949494` | [M] |
| Highlighted menu item background (95,70) | Evening | `#2f6ed8 (sRGB #166ce0)` | `#834689 (sRGB #8d408d)` | `#d25c92 (sRGB #e25094)` | `#bf4846 (sRGB #ce3d40)` | `#d5803d (sRGB #e27c28)` | `#ddac4b (sRGB #e5ab31)` | `#73a955 (sRGB #61ac48)` | `#848484` | [M] |

The three rows of one accent differ by a constant: Morning = Day + about (11,10,6), Evening = Day -
about (16,16,15) on every accent including grey. That is what a fixed accent layer at partial opacity
over a lighter or darker blurred backdrop produces. Recovered recipe [C]: selection = swatch colour at
alpha ~0.85 over the menu material, then the material's own brightening; for a non-vibrant fallback use
the Day row.

### Focus ring (blue accent only)

| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Ring, outer 2.5 pt (5 px), flat | `#89abeb (sRGB #82abf1)` | `#3e6c94 (sRGB #2f6c98)` | [M] | 10-15-Catalina-Light-Finder-Go-To-Folder.png @ 149,227 `#89abeb (sRGB #82abf1)`; 10-15-Catalina-Dark-Finder-Go-to-Folder.png @ 149,227 `#3e6c94 (sRGB #2f6c98)` |
| Ring, outermost px | `#8badec (sRGB #84adf2)` | `#3e6b92 (sRGB #2f6b96)` | [M] | 10-15-Catalina-Light-Finder-Go-To-Folder.png @ 148,227 `#8badec (sRGB #84adf2)`; 10-15-Catalina-Dark-Finder-Go-to-Folder.png @ 148,227 `#3e6b92 (sRGB #2f6b96)` |
| Field border under the ring (1 px) | `#6b8dcd (sRGB #638cd2)` | `#47759e (sRGB #3975a2)` | [M] | 10-15-Catalina-Light-Finder-Go-To-Folder.png @ 153,227 `#6b8dcd (sRGB #638cd2)`; 10-15-Catalina-Dark-Finder-Go-to-Folder.png @ 154,227 `#47759e (sRGB #3975a2)` |
| Ring total thickness | 3 pt (6 px incl. the border px), square corners with 1 pt outer rounding | 3 pt | [M] | 10-15-Catalina-Light-Finder-Go-To-Folder.png row 227: 148..153; col 500: 202..207 and 246..251 |

Second instance: 10-15-Catalina-Light-Safari-v13-Preferences.png @ 772,468 `#89abeb (sRGB #82abf1)`, @ 777,468 `#6b8dcd (sRGB #638cd2)` (same
values) [M]. The ring is the accent at about 0.5 alpha over the window background: over `#ececec`,
`#2f7cf7 (sRGB #027aff)` at 0.47 gives `#93b7f1 (sRGB #8bb7f6)`; the measured `#89abeb (sRGB #82abf1)` is slightly darker and less saturated, so use
the measured hex over window-background grey and `rgba(47,124,247,0.5)` elsewhere [C]. Other accents:
not shown; use the accent swatch colour at 0.5 alpha [I].

### Default button (blue accent only)

| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Top edge row | `#5b93f3 (sRGB #4c92fa)` | (outer edge `#29292a`) | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 800,301 `#5b93f3 (sRGB #4c92fa)`; 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 800,301 `#29292a` |
| Fill 0% | `#77a6f4 (sRGB #6ca6fb)` | `#6998e8 (sRGB #5d97ef)` (highlight row), then `#3874df (sRGB #2472e7)` | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 800,302 `#77a6f4 (sRGB #6ca6fb)`; 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 800,302 `#6998e8 (sRGB #5d97ef)`, @ 800,303 `#3874df (sRGB #2472e7)` |
| Fill 50% | `#4e8af5 (sRGB #3d88fd)` | `#2c66d3 (sRGB #1764db)` | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 800,320 `#4e8af5 (sRGB #3d88fd)`; 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 800,320 `#2c66d3 (sRGB #1764db)` |
| Fill 100% | `#286ef6 (sRGB #076bff)` | `#2960c6 (sRGB #155ecd)` | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 800,339 `#286ef6 (sRGB #076bff)`; 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 800,339 `#2960c6 (sRGB #155ecd)` |
| Bottom edge row | `#2165f6 (sRGB #0361ff)` | (outer edge `#232324`) | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 800,340 `#2165f6 (sRGB #0361ff)`; 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 800,340 `#232324` |
| Side edge | `#3d7df5 (sRGB #297bfe)` | `#272728` | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 685,320 `#3d7df5 (sRGB #297bfe)`; 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 685,320 `#272728` |
| Title text | `#ffffff` | `#e0e8f8 (sRGB #dee8fa)` | [M] | 10-15-Catalina-Light-Finder-Empty-Trash.png @ 725,320 `#ffffff`; 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 725,320 `#e0e8f8 (sRGB #dee8fa)` |

The default button uses exactly the pop-up cap gradient of the same accent (compare the 0/50/100%
stops), so for the other seven accents use the pop-up cap rows of the matrices [C].

### Text and icons

| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Text on any accent fill (menu item, menu-bar title) | `#ffffff` | `#ffffff` | [M] | matrices, rows 3-4 |
| Glyph on control fill | `#ffffff` | white at 0.85 alpha; graphite `#252525` | [M] | matrices |

### Shadows and effects

None of its own. Glyph shadow on light controls: 1 pt, below only, the fill darkened 10% [M, see above].

## Layout and spacing

Accent picker row: label "Accent color:" right-aligned to x 1459 px (10.5 pt before the first swatch;
10-15-Catalina-Theme-Light-Blue.png @ 1301,606,159,21), 8 swatches of 16 pt at a 24 pt
pitch starting 251 pt from the window's left edge (px 1480 - 978 = 502), centre line 146.5 pt below the
window top (px 617.5 - 324) [M: 10-15-Catalina-Theme-Light-Blue.png].

## Keyboard and accessibility

The accent picker is a radio group: arrow keys move between swatches, Space selects, each swatch is
labelled with its colour name (AXRadioButton in an AXRadioGroup; ARIA `radiogroup` with `radio`
children and `aria-checked`) [I from the control's visible behaviour]. Never rely on the accent alone
to convey state: every tinted control also changes its glyph (HIG Color: "Avoid using colors that make
it hard for people to perceive content") [D].

## Browser notes

- Expose the accent as CSS custom properties per appearance, one set per row of the matrices (for
  example `--accent-control-fill`, `--accent-cap-0..100`, `--accent-menu-selection`, `--accent-ring`,
  `--accent-swatch`). One hue variable is not enough: fills, caps, menu selection and swatch are
  different colours and the light/dark relationship is not a simple transform.
- Menu selection depends on the wallpaper behind the menu. Use the Day row as the opaque fallback and,
  where `backdrop-filter` is available, draw the swatch colour at 0.85 alpha over the menu material.
- Dark-mode desktop tinting (`#303032` vs `#323232`) cannot be derived in CSS from the wallpaper; ship
  two neutral ramps (tinted and graphite) and switch on the accent.
- The captures are stored unconverted from a Display P3 panel (see CONVENTIONS), so `#2f7cf7 (sRGB #027aff)` here is
  the on-disk value of the system blue that documentation lists as sRGB `#007aff (sRGB #0078ff)`.

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Theme-Light-Blue.png | 1460,420,520,300 | thumbnails, swatches, Highlight pop-up (blue) |
| light | 10-15-Catalina-Theme-Light-Blue.png | 60,0,540,380 | menu-bar title and menu item highlight |
| light | 10-15-Catalina-Theme-Light-Blue.png | 1460,860,120,260 | radio buttons on/off |
| light | 10-15-Catalina-Theme-Light-Graphite.png | 984,340,130,44 | graphite window controls |
| light | 10-15-Catalina-Theme-Morning-Yellow.png | 1452,414,520,300 | Auto selected, yellow ring, wider pop-up |
| dark | 10-15-Catalina-Theme-Dark-Blue.png | 1460,420,520,300 | thumbnails, swatches, Highlight pop-up (blue) |
| dark | 10-15-Catalina-Theme-Dark-Graphite.png | 1460,860,120,60 | graphite radio with dark dot |
| dark | 10-15-Catalina-Theme-Dark-Graphite.png | 1466,1300,60,50 | graphite checkbox with dark checkmark |
| light | 10-15-Catalina-Light-Finder-Go-To-Folder.png | 140,196,800,62 | focus ring on a combo box, default button |
| dark | 10-15-Catalina-Dark-Finder-Go-to-Folder.png | 140,196,800,62 | same, dark |

# Quick Look panel (`quick-look-panel`)

- **Status:** present
- **AppKit:** `QLPreviewPanel` (Quartz / QuickLookUI), shown by Finder on Space
- **HIG:** https://web.archive.org/web/20200503144246/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/quick-look/
- **Appearances shown:** light, dark

## Purpose and behaviour
Quick Look shows a full-size preview of a file without opening its app; apps that let people interact with files should offer a Quick Look viewer [D]. The panel floats above the Finder window and becomes key while Finder stays main (Finder's toolbar keeps its active look, only its window controls turn grey) [M]. Space or Escape closes it; the second title button enters full screen; "Open with <App>" opens the default app; Rotate, Markup and Share act on the file [D]/[M].

## Anatomy
```
 +--------------------------------------------------------------------------+
 | (x) (full)            10-9.jpg        [rotate] [markup] [Open with Preview] [share] |  vibrant title bar
 +--------------------------------------------------------------------------+
 |                              preview, aspect-fitted                      |
 +--------------------------------------------------------------------------+
   thin vibrant frame on the left, right and bottom
```

## Variants and parameters
| Variant | Shown in screenshots |
|---|---|
| image preview, normal toolbar | `...Finder-Quick-Look.png` |
| Markup mode (toolbar replaced, see `markup-toolbar`) | `...Finder-Quick-Look-Markup.png` |
| multiple items (previous/next, index sheet), full screen, other file types | not shown |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| key panel | yes | `10-15-Catalina-Light-Finder-Quick-Look.png @ 1480,90,1784,1094` |
| inactive | no | [I] buttons and glyphs fade like `toolbar-button` inactive |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Panel size in the capture | light 892 x 547 (x 1480..3263, y 90..1183); dark 1103 wide (x 964..3169), top y=118 | [M] | `10-15-Catalina-Light-Finder-Quick-Look.png @ 1470,600,31,1`, `@ 3245,600,31,1`, `@ 2000,80,1,111`, `@ 2000,1160,1,41`; `10-15-Catalina-Dark-Finder-Quick-Look.png @ 955,600,121,1`, `@ 3060,600,121,1` |
| Title bar height | 38: title centre 19.5 below the top (ink y 117..141, top 90); in dark the preview starts 37 below the top (y 192 vs 118); in light the preview starts at 41.5 because the image is letterboxed | [C] | `10-15-Catalina-Light-Finder-Quick-Look.png @ 2323,117,98,25`; `10-15-Catalina-Dark-Finder-Quick-Look.png @ 2000,117,1,76` |
| Side frame, light | 3 (x 1480..1485 and 3258..3263) | [M] | rows at y=600 above |
| Bottom frame, light | 7.5 (y 1169..1183) | [M] | `@ 2000,1169,1,15` |
| Dark: letterbox bands | 50 either side of the image (x 966..1065, 3068..3167), 3 below it | [M] | rows at y=600; `10-15-Catalina-Dark-Finder-Quick-Look.png @ 2000,1316,1,9` |
| Corner radius | 5 | [C] | arc spans about 10 px in the 6x crop of `10-15-Catalina-Light-Finder-Quick-Look.png @ 1476,86,30,30` (cannot be read by alpha: full-screen capture) |
| Close and full-screen buttons | 12 diameter discs at x 1504..1527 and 1544..1567, y 115..138: 12 from the left edge, 20 pitch, centre 18.25 below the top | [M] | `@ 1504,115,24,24`, `@ 1544,115,24,24` |
| Toolbar buttons | 19 high (fill y 108..145), radius about 4; widths 37 (Rotate x 2680..2753), 37 (Markup x 2778..2851), 135 ("Open with Preview" x 2876..3145), 37 (Share x 3170..3243); 12 between fills; 10 from the right edge | [M] | `@ 2650,110,620,1`, `@ 2720,107,1,40` |
| Title | centred on the panel, 13 pt Regular | [M], [C] | `@ 2323,117,98,25` (panel centre x=2371.5) |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title bar and frame material (observed over the Catalina desktop) | `#b7d5ef (sRGB #b0d6f2)` to `#c6daed (sRGB #c2daef)` in the bar, `#d6e8e0 (sRGB #d2e9e0)` in the side frame over the picture's green, `#b0c2d2 (sRGB #acc2d4)` at the bottom | `#273548 (sRGB #24354a)` to `#2e3742 (sRGB #2c3743)` in the bar, `#2b5347 (sRGB #1a5446)` in the letterbox over green, `#293855 (sRGB #263857)` over blue | [M] | `10-15-Catalina-Light-Finder-Quick-Look.png @ 2000,90,1,83`, `@ 1481,600`, `@ 2000,1170`; `10-15-Catalina-Dark-Finder-Quick-Look.png @ 2000,120,1,72`, `@ 970,600`, `@ 3070,600` |
| Recommended opaque fallback | `#e6e6e6` | `#2d2d2d` | [I] | neutral equivalents of the tint: the light bar is the backdrop pushed about 60% towards white; the dark bar is `rgb(70,70,70)` at 0.42 over the blurred backdrop (solved from the bar `#293547 (sRGB #263549)` over desktop `#142848 (sRGB #0e284b)`) [C] |
| Material recipe | `backdrop-filter: blur(40px) saturate(1.8)`; tint `rgba(255,255,255,0.60)` | same blur; tint `rgba(70,70,70,0.42)` | [C] tint, [I] blur | above |
| Outer hairline / inner highlight (dark) | edge rows darker than the backdrop (`#5a7b9e (sRGB #527ba1)` over `#6d96bf (sRGB #6296c3)` sky = black @ 0.19) | hairline `#010203`, inner 1 pt `#515f6b (sRGB #4e5f6c)`/`#57756c (sRGB #4e766c)` (white @ 0.2) | [M] | `10-15-Catalina-Light-Finder-Quick-Look.png @ 2000,89`; `10-15-Catalina-Dark-Finder-Quick-Look.png @ 2000,117`, `@ 2000,118`, `@ 964,600` |
| Toolbar button fill | `#ffffff`, bottom edge `#92a1af (sRGB #8fa1b1)`, top edge `#a7b9ca (sRGB #a3b9cc)` | `#5b6a83 (sRGB #586a85)` to `#647084 (sRGB #627086)` (white @ about 0.25 over the bar) | [M] | `10-15-Catalina-Light-Finder-Quick-Look.png @ 2720,108,1,38`, `@ 2720,146`, `@ 2720,107`; `10-15-Catalina-Dark-Finder-Quick-Look.png @ 2587,138,33,1` |
| Button glyph / text | `#262626` | `#e3effe (sRGB #e1efff)` (near white) | [M] | `10-15-Catalina-Light-Finder-Quick-Look.png @ 2720,125,1,14`; `10-15-Catalina-Dark-Finder-Quick-Look.png @ 2719,138` |
| Close / full-screen discs and title text (vibrant dark label) | `#34586f (sRGB #285971)` discs, `#415b6f (sRGB #3a5b71)` title | `#a9afc7 (sRGB #a8afc9)` title | [M] | `10-15-Catalina-Light-Finder-Quick-Look.png @ 1490,100,50,50`, `@ 2300,96,160,60`; `10-15-Catalina-Dark-Finder-Quick-Look.png @ 1980,128,180,56` |

### Text and icons
Close glyph: an x cut out of a filled disc; full-screen glyph: two triangles (as the zoom button's) cut out of a filled disc [M] (6x crop of `@ 1476,86,130,90`). Toolbar glyphs: Rotate Left, Markup (pen tip in a circle), Share (box with arrow), each about 15 pt.

### Shadows and effects
Key-panel shadow over the desktop; not separable from the photo backdrop in these captures. Use the key window shadow [I].

## Layout and spacing
The panel is sized to the content's aspect ratio (light: 16:9 image fills the width; dark: the panel was resized, so the image is letterboxed). The preview is centred below the bar.

## Keyboard and accessibility
Space toggles the panel, Escape closes, arrow keys move between items, Option-Space or the second button enters full screen [D]. `AXWindow` subrole `AXFloatingWindow` with an `AXImage`/`AXWebArea` content element. ARIA: `role="dialog"`, focus on the content, Escape to close.

## Browser notes
The vibrant chrome depends on what is behind the window; use the opaque fallback or `backdrop-filter` over page content. The preview itself is an image or `<iframe>`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Quick-Look.png` | 1480,90,1784,1094 | whole panel over the Finder window |
| dark | `10-15-Catalina-Dark-Finder-Quick-Look.png` | 964,117,2206,1208 | whole panel, letterboxed image |
| light | `10-15-Catalina-Light-Finder-Quick-Look.png` | 1476,86,130,90 | close and full-screen buttons |
| light | `10-15-Catalina-Light-Finder-Quick-Look.png` | 2650,100,620,56 | Rotate, Markup, Open with Preview, Share |

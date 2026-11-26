# Markup toolbar (`markup-toolbar`)

- **Status:** present
- **AppKit:** custom toolbar of the Markup extension (`com.apple.MarkupUI`), hosted in the Quick Look panel and in Preview
- **HIG:** https://web.archive.org/web/20200503144246/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/quick-look/ (no dedicated page)
- **Appearances shown:** light, dark

## Purpose and behaviour
Markup lets the user annotate an image or PDF in place. In Quick Look, clicking the Markup button replaces the panel's title-bar content with the Markup tools; Done saves and returns to the normal bar [M]. Tools are borderless image buttons; those with a chevron open a popover or menu of choices; the active drawing tool is tinted with the accent colour [M].

## Anatomy
Leading to trailing (`10-15-Catalina-Light-Finder-Quick-Look-Markup.png`, panel left edge x=1480):

| # | Item | Glyph box x (px) | Notes |
|---|---|---|---|
| 1 | Close (x in a disc) | 1504..1527 | the full-screen disc is hidden in Markup mode |
| 2 | Sketch | 1553..1590 | selected: accent blue |
| 3 | Draw | 1624..1666 | |
| 4 | Shapes (with chevron) | 1717..1777 | |
| 5 | Text | 1807..1840 | |
| 6 | Highlight | 1895..1925 | |
| 7 | Sign (with chevron) | 1966..2031 | |
| - | separator | 2052 | |
| 8 | Shape Style (line weights, chevron) | 2086..2143 | |
| 9 | Border Colour (swatch, chevron) | about 2172..2232 | black square with white inner frame |
| 10 | Fill Colour (swatch, chevron) | about 2262..2322 | white square with red diagonal = none |
| 11 | Text Style (italic A, chevron) | 2352..2409 | |
| - | separator | 2428..2429 | |
| 12 | Rotate Left | 2462..2490 | |
| 13 | Crop | 2534..2565 | |
| 14 | Done (text button) | trailing, before Share | white `quick-look-panel` button |
| 15 | Share | 3170..3243 (fill) | |

## Variants and parameters
| Variant | Shown |
|---|---|
| Quick Look host (vibrant bar) | yes |
| Preview host (second toolbar row under the window toolbar) | no (Preview's Markup toolbar is closed in both Preview shots) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| tool normal | yes | Draw: `10-15-Catalina-Light-Finder-Quick-Look-Markup.png @ 1624,111,43,31` |
| tool selected | yes | Sketch: `@ 1553,111,38,31` |
| tool disabled (no selection) | no | [I] 35% opacity |
| pressed | no | [I] darker by 20% |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Bar | the Quick Look title bar (38 high) | [C] | see `quick-look-panel` |
| Glyph height | 15-16 (rows y 111..142) | [M] | boxes above |
| Glyph vertical centre | 18.25 below the panel top (y 126.5) | [M] | same |
| Pitch between plain tools | about 36 (Sketch centre 1571.5, Draw 1645) ; tools with a chevron take about 45 | [M] | boxes above |
| Chevron | as `toolbar-pop-up` (7.5 x 4.5), 4 after the glyph | [M] by inspection of the 1x crop, [I] exact | `@ 1476,86,1000,90` |
| Separator | 1 wide (2 px), 20 high (y 107..146), centred | [M] | `10-15-Catalina-Light-Finder-Quick-Look-Markup.png @ 2052,107,2,40`, `@ 2428,107,2,40` (re-measured by the lead: the darker run on column x=2052 spans y 107..146) |
| Colour swatch | 15 x 15 with 1 pt frame | [C] | from the 1x crop |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Glyph, normal | `#3b546f (sRGB #355472)` (vibrant label over the light bar; neutral fallback `#4d4d4d`) | light grey-blue `#a9afc7 (sRGB #a8afc9)`-like (neutral fallback `#d0d0d0`) | [M] light, [I] dark value | darkest pixel in `@ 1612,100,66,56`, `@ 1700,100,90,56` |
| Glyph, selected tool | accent: `#3882e2 (sRGB #1481e9)` body, darkest `#0049db (sRGB #0043e4)` | accent blue | [M] | `@ 1560,140`; darkest in `@ 1540,100,60,56` |
| Separator | `#a1c1d7 (sRGB #99c2da)` (black @ about 0.1 over the bar) | lighter than the bar | [M] light | darkest pixel in `@ 2052,109,1,18` |
| Done / Share buttons | white fill, text `#262626` | translucent light fill, white text | [M] | `@ 3020,100,130,56`; `10-15-Catalina-Dark-Finder-Quick-Look-Markup.png` (preview) |

### Text and icons
"Done": 13 pt Regular. Glyphs are custom template images (pen with squiggle, pen with stroke, square + circle, boxed T, marker with underline, signature, three line weights, swatches, italic A, rotate, crop marks); they must be supplied as assets.

### Shadows and effects
The toolbar adds no separate shadow [I]; it shares the Quick Look panel's vibrant material, edge treatment and panel shadow (`quick-look-panel`). No pressed-tool shadow is captured.

## Layout and spacing
Tools are leading-aligned after the close disc (25 pt gap), Done and Share trailing-aligned with the panel's 10 pt right margin.

## Keyboard and accessibility
Each tool is an `AXButton` (or `AXMenuButton` with chevron) with a title; the selected drawing tool reports `AXValue` 1. ARIA: `role="toolbar"`, drawing tools as a `radiogroup`.

## Browser notes
Glyph artwork is not derivable from the screenshots at vector quality; redraw as SVG. The vibrant glyph colour is the label colour blended with the backdrop; use the neutral fallback.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Quick-Look-Markup.png` | 1476,86,1790,90 | whole Markup toolbar |
| dark | `10-15-Catalina-Dark-Finder-Quick-Look-Markup.png` | 960,112,2214,90 | whole Markup toolbar |

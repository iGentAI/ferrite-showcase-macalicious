# Accent colour swatches and appearance thumbnails (`color-swatch-picker`)

- **Status:** present
- **AppKit:** two custom, select-one groups of image-backed `NSButton` cells [I: private System Preferences implementation; public radio behaviour is the equivalent, not a claim about its actual classes]. Accent value is `NSColor.controlAccentColor` [D].
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/radio-buttons/ ; https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/visual-design/color/
- **Appearances shown:** light, dark; Blue selected in both [M].

## Purpose and behaviour
Select one global accent or one appearance. Preferences apply immediately [D: archived HIG Preferences]. These are radio groups, not colour wells: clicking an accent chooses that preset, and clicking a thumbnail chooses Light, Dark or Auto [M: visible choices; D: mutually exclusive choice semantics, HIG Radio Buttons]. Auto follows the system's scheduled appearance [I: scheduling is not captured]. The eight-swatch arrangement is this specific system surface, not a recommendation to replace ordinary long radio lists with swatches.

## Anatomy
Back to front: pane background; circular accent swatches with contrasting edge; white centre dot on the chosen accent. In the separate appearance group: rounded image, faint unselected border or external accent selection ring, centred caption below. Introducing labels are right-aligned to a shared colon column.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| accent | Blue, Purple, Pink, Red, Orange, Yellow, Green, Graphite | Blue [M] | controlAccentColor [D] | all swatches; Blue selected [M] |
| appearance | Light, Dark, Auto | Light [I: system initial preference not observable] | NSAppearance aqua/darkAqua [D]; Auto policy [I] | Light selected in light; Dark selected in dark [M] |
| enabled | enabled, disabled | enabled [M] | isEnabled [D] | enabled only [M] |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal/unselected | both | both General PNGs below [M] |
| selected | both | Blue dot in both; Light/Dark thumbnail respectively [M] |
| hover | not captured | no additional decoration proposed [I: consistent with macOS image choices] |
| pressed | not captured | retain selection geometry, temporary image darkening as image-button [I] |
| disabled | not captured | reduce image, swatch and caption opacity to 0.5 [I: use image-button disabled recipe] |
| focused | not captured | focus-ring in addition to the selection indicator [I]; never use colour alone to expose focus |
| inactive window | not captured | keep selected value and dot [I]; not shown: General and Theme captures show the preferences window active; no inactive swatch group is visible |
| other accents selected | 32 Theme captures, not re-measured here | per-accent matrix in [accent-colors.md](accent-colors.md), light and dark swatch/ring rows [M: existing project evidence] |

## Measurements
All coordinates in this file refer to the original General PNGs. Stored chromatic values are intentionally not colour-converted here; consolidated annotation is the lead's step.

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Swatch diameter | 16 | [M] | 10-15-Catalina-Light-System-Preferences-General.png @ 614,354,32,32; centre row 369: x 614..645; dark same |
| Swatch pitch / clear gap | 24 / 8 | [M] | 10-15-Catalina-Light-System-Preferences-General.png @ 614,369,368,1; starts 614,662,710,758,806,854,902,950; dark matches |
| Edge treatment | 1 effective radial ring: outer AA pixel plus one flat pixel (not two flat border pixels) | [M] | 10-15-Catalina-Light-System-Preferences-General.png @ 614,369,4,1; AA at 614, flat at 615, transition at 616, full fill from 617; dark 614/615 similarly |
| Selected centre dot | 5 diameter, centred; 0.5 AA fringe | [M] | 10-15-Catalina-Light-System-Preferences-General.png @ 624,369,12,1: white x 625..634; column 630 white y 365..374; dark matches |
| Thumbnail image, excluding external ring/border | 67 × 44 | [M] | 10-15-Catalina-Light-System-Preferences-General.png @ 615,188,134,88; other image origins 787,188 and 959,188; dark same |
| Thumbnail pitch / image-to-image gap | 86 / 19 | [M] | 10-15-Catalina-Light-System-Preferences-General.png @ 605,232,496,1: image origins 615,787,959; dark matches |
| Selection ring width | 1.5 external to image | [M] | 10-15-Catalina-Light-System-Preferences-General.png @ 612,232,3,1; dark selected left ring @ 784,232,3,1 |
| Selection ring outer size | 70 × 47 | [M] | 10-15-Catalina-Light-System-Preferences-General.png @ 612,185,140,94; dark @ 784,185,140,94 |
| Selection ring outer radius | 6, on the ring's outer edge. Least-squares fit with `tools/corner_fit.py` to the outer edge only (a 6 px square, which holds the pane and the ring but not the image): best 6 in light (rms 1.7 levels; 10.1 at 5.75, 5.8 at 6.25) and in dark (rms 1.7; 9.8 at 5.75, 5.5 at 6.25); the same ring in `accent-colors` fits 6 as well. The earlier value of 5.5 ±0.5 was a grid reading. A fit of the whole corner with a concentric 1.5 pt ring over the image gives 6.25 at rms 7.6 to 8.0, so the inner edge is not well modelled as concentric and that figure is not used | [C] fit from [M] pixels | 10-15-Catalina-Light-System-Preferences-General.png @ 612,184,14,14: top y185; outer column transitions through y196 and is flat by y197; dark @ 784,184,14,14; fit corners light @ 610,183,8,8 and dark @ 782,183,8,8 |
| Image corner radius | 4.5 to 5 as a grid reading, not fitted; build with 4.5 [I] | [M] grid reading; [I] 4.5 | On the same corner grids the inner arc runs from x 615 to x 624..625 on row 188 and from y 188 to y 197 on column 615 (9 to 10 px), in light and in dark. Not fitted: the ring's own outer corner falls inside the square the tool compares. 4.5 is inferred: it is the low end of the reading, and it equals outer radius 6 minus the 1.5 ring only under the assumption of a concentric inner edge, which the whole-corner fit in the row above does not support, so the subtraction is not a computed value. This row gave 4 [C] (5.5 minus 1.5) before the ring was fitted |
| Unselected border | 0.5 outside image; outer size 68 × 45 | [M] | 10-15-Catalina-Light-System-Preferences-General.png @ 786,232,1,1 and @ 921,232,1,1; image x787..920. Dark unselected x614/749 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Pane | #ececec | #2f3031 | [M] | light General @ 605,369; dark same |
| Blue selection ring | #2f7cf7 (sRGB #027aff) | #2f7cf7 (sRGB #027aff) (dither ±1) | [M] | 10-15-Catalina-Light-System-Preferences-General.png @ 613,232; 10-15-Catalina-Dark-System-Preferences-General.png @ 785,232 |
| Dot | #ffffff | #ffffff (±1 dither) | [M] | 10-15-Catalina-Light-System-Preferences-General.png @ 630,369; dark same |
| Unselected thumbnail border | #dadada (range #d9d9d9..#dadada) | #2b2c2d | [M] | 10-15-Catalina-Light-System-Preferences-General.png @ 786,232; 10-15-Catalina-Dark-System-Preferences-General.png @ 614,232 |

Swatch colours below are **all eight visible presets in the Blue-selected General capture**, not eight separate selected-state captures. Fill sample is x=618+48k, y=369; flat ring x=615+48k, y=369 [M]. k runs from 0 through 7 [C: measured pitch].

| Preset | Light fill / ring | Dark fill / ring | Tag | Evidence |
|---|---|---|---|---|
| Blue | #2f7cf7 (sRGB #027aff) / #2564c5 (sRGB #0262cc) | #2f7cf7 (sRGB #027aff) / #5897f8 (sRGB #4596ff) | [M] | both General PNGs @ 618,369 and @ 615,369 |
| Purple | #8a4592 (sRGB #953d96) / #6f3775 (sRGB #783179) | #9b57a3 (sRGB #a650a7) / #ae79b5 (sRGB #b874b9) | [M] | both @ 666,369 and @ 663,369 |
| Pink | #e55d9d (sRGB #f74e9f) / #b64b7d (sRGB #c5407f) | #e55e9c (sRGB #f7509e) / #ea7faf (sRGB #fa76b1) | [M] | both @ 714,369 and @ 711,369 |
| Red | #ce4645 (sRGB #df373e) / #a63838 (sRGB #b42c33) | #ed5f5e (sRGB #ff5258) / #f07f7e (sRGB #ff777a) | [M] | both @ 762,369 and @ 759,369 |
| Orange | #e8873a (sRGB #f7821c) / #b96d2e (sRGB #c56917) | #e8873a (sRGB #f7821c) / #eca061 (sRGB #f89d53) | [M] | both @ 810,369 and @ 807,369 |
| Yellow | #f2b94b (sRGB #fcb828) / #c2943c (sRGB #ca9321) | #f3b94b (sRGB #fdb828) / #f5c76f (sRGB #fdc65e) | [M] | both @ 858,369 and @ 855,369 |
| Green | #78b757 (sRGB #62ba47) / #5f9345 (sRGB #4c9638) | #78b756 (sRGB #62ba46) / #93c677 (sRGB #83c96d) | [M] | both @ 906,369 and @ 903,369 |
| Graphite | #979898 / #7a797a | #8d8c8d / #a3a3a3 | [M] | both @ 954,369 and @ 951,369 |

These samples agree within ±2 per channel with `accent-colors.md`'s light/dark selected-swatch fill and ring matrices. Geometry agrees exactly (16 diameter, 24 pitch, 5 dot, 67 × 44 image, 86 pitch, 1.5 ring). The unselected light thumbnail border here is #dadada versus #d9d9d9 in Theme (difference 1); stored dithering accounts for the difference [M: samples above]. Reuse that file for all accent-dependent control fills, selection rings, menu selections and highlight colours; do not use swatch fill as the default-button gradient.

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Caption and introducing label | SF Pro Text Regular 13 pt | same | [C] | light General @ 443,251,150,21: A cap 19 px; caption L @ 653,293,12,19; dark caps 19..20 px |
| Text colour | #242424 | #dfdfdf | [M] | 10-15-Catalina-Light-System-Preferences-General.png @ 592,268; 10-15-Catalina-Dark-System-Preferences-General.png @ 592,268; caption stem palettes @ 650,290,60,27 |
| Caption placement | centred on image; Light cap top y293, baseline y312; Dark/Auto cap top around y293 | same, raster AA can extend 0.5 pt higher | [M] | light General @ 650,290,65,27; dark same; nominal caption centres x682,854,1026 [C: image midpoints] |
| Caption offset | cap top 8.5 below image bottom boundary y276; upper AA ink 8 below | same | [C] | image bottom275; caption cap293 and AA292 |

### Shadows and effects
No additional control shadow outside thumbnail border/ring [M: centre columns return immediately to pane at y279 selected]. Miniature windows and wallpaper are image artwork, not extra interactive controls.

## Layout and spacing
Introducing labels end at x592 in both appearances [M: General @ 410,249,185,23 and @ 425,354,170,30]. Right edges align; Appearance baseline y270 and Accent color baseline y378 [M: cap ink ends269/377]. Appearance label baseline is 3 pt above image bottom boundary y276 [C]. Accent label baseline is 4.5 pt below swatch centre row y369 [C]. Gap from final label ink to ring is 9.5 pt, and to swatch outer edge is 10.5 pt [C: blank pixels593..611 /593..613]. At frame origin112,76, the first ring is (250,54.5), first image (251.5,56), first swatch (251,139), and shared label right edge240.5 pt [C]. Keep dimensions fixed; additional width goes outside the group, not into circle diameters.

## Keyboard and accessibility
Two distinct `radiogroup`s, labelled “Appearance” and “Accent color”; each choice is a `radio` with `aria-checked`, one roving Tab stop per group [I: web mapping of documented radio semantics]. Left/Right arrows select adjacent options, Space chooses, and Tab leaves the group [D: HIG Keyboard/radio pattern]. AppKit equivalent AXRadioGroup with AXRadioButton children [D]. Expose swatch names, not colour hex values. Thumbnail image is decorative when a visible caption names the radio. Dot/ring and checked state must remain discernible without hue discrimination.

## Browser notes
Use circular backgrounds and an inset 1 pt effective edge; match antialiasing at 2x. Use image assets for thumbnail interiors; CSS recreations of their miniature desktop are not pixel-exact. Draw the selected ring external to the image without changing layout. Browser system-theme detection supplies Light/Dark but does not implement Catalina's Auto schedule; provide a demo-owned state [I].

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-General.png | 410,184,692,204 | thumbnail radios, labels, accent swatches |
| dark | 10-15-Catalina-Dark-System-Preferences-General.png | 410,184,692,204 | Dark selection and lighter swatch edges |
| accents | see accent-colors.md | per-accent matrices | previously measured 32 Theme captures; not re-audited here |

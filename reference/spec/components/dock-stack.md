# Dock stack (`dock-stack`)

- **Status:** present (fan view open, light and dark; grid and list views not shown)
- **AppKit:** Dock.app stacks (folder tiles in the Dock)
- **HIG:** https://web.archive.org/web/20200503160803/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/dock/
- **Appearances shown:** light, dark

## Purpose and behaviour
A stack is a folder kept in the Dock (Downloads by default). Clicking it springs its contents out as a fan (an arc of icons with labels), a grid (a popover-like panel of icons) or a list (a menu); "Automatic" picks fan for few items and grid for many. The last fan element opens the folder in Finder. While open, the stack's Dock tile shows a "close" placeholder (a rounded square with a down triangle) [M].

## Anatomy (fan)
```
            [ 7 More in Finder ]  (->)        circle button, 56 pt
         [ 10-8.jpg ]  [thumb]                items rotate progressively and drift right
        ...
   [ 10-15-beta-light.jpg ] [thumb]           64 pt vertical pitch
   [ 10-15-beta-dark.jpg  ] [thumb]           bottom item is upright, 15.5 pt above the Dock
================ Dock: [v] placeholder tile ================
```
Each item = a label pill (to the left) + a thumbnail (file preview with a white photo border, or the file icon).

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| view | fan, grid, list, automatic | automatic | Dock tile option "View content as" | fan |
| display as | stack (pile of thumbnails), folder icon | stack | "Display as" | stack (closed tile shows the newest file's thumbnail) |
| sort | name, date added/modified/created, kind | date added | "Sort by" | date order (light) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| closed tile | yes | 10-15-Catalina-Light-Desktop.png @ 2812,1961,108,114; 10-15-Catalina-Dark-Desktop.png @ 2812,1961,108,114 |
| fan open | yes | 10-15-Catalina-Light-Stacks.png @ 2480,440,640,1480; 10-15-Catalina-Dark-Stacks.png @ 2480,440,640,1480 |
| open-state Dock tile (down-triangle placeholder) | yes | 10-15-Catalina-Light-Stacks.png @ 2812,1961,108,114; 10-15-Catalina-Dark-Stacks.png @ 2812,1961,108,114 |
| item hovered (pill highlighted) | no | [I] pill fill switches to the accent selection colour with white text |
| grid view | no | [I] popover-style panel (Dock material, radius about 10 pt, pointer toward the tile) with a grid of 64 pt icons, 13 pt labels below, "Open in Finder" button at the bottom |
| list view | no | [I] a standard `menu` of 16 pt-icon items anchored to the tile |

## Measurements
### Geometry (pt)
Items are numbered from the bottom (item 1 nearest the Dock).

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Vertical pitch between items | 64 (thumbnail centres y=1850, 1722.5, 1595, 1467, 1339, 1211, 1082.5 px) | [M] | 10-15-Catalina-Light-Stacks.png @ 2790,1036,310,874 (white photo borders: rows 1791..1909, 1662..1783, 1556..1634, 1427..1507, 1298..1380, 1169..1253, 1036..1129) |
| Thumbnail box | up to about 60 x 60 pt including a 2 pt white photo border (item 1: px 2810..2929 x 1791..1909; landscape item 3: 2821..2942 x 1556..1634) | [M] | 10-15-Catalina-Light-Stacks.png @ 2810,1791,120,119; 2821,1556,122,79 |
| Photo border | 2 pt white (4-5 px of `#ffffff`) | [M] | 10-15-Catalina-Light-Stacks.png @ 2866,1559,1,4 |
| Fan curve: thumbnail centre x per item | 2869.5, 2873.5, 2881.5, 2892, 2905.5, 2921.5, 2939.5, 2945.5 (item 8), 2998.5 (item 9), 3013.5 (item 10, arrow circle 3044) px; that is +2, +4, +5, +7, +8, +9 pt per step at first | [M] | same white-border boxes (x ranges 2810..2929, 2813..2934, 2821..2942, 2831..2953, 2844..2967, 2859..2984, 2876..3003, 2866..3025, 2924..3073, 2949..3078) |
| Rotation | item 1 top-edge slope 5 px / 180 px = 1.6 degrees; uppermost photo top-edge slope 16 px / 70 px = 12.9 degrees clockwise | [C] arctan of measured edge slopes | 10-15-Catalina-Dark-Stacks.png @ 2600,1817,1,4; 10-15-Catalina-Dark-Stacks.png @ 2780,1822,1,4; first full-white photo-edge pixels in 10-15-Catalina-Dark-Stacks.png @ 2980,630,1,50 (y=652) and 10-15-Catalina-Dark-Stacks.png @ 3050,630,1,50 (y=668) |
| Gap bottom item to Dock | 15.5 (thumbnail bottom y=1909, shelf top 1940) | [M] | 10-15-Catalina-Light-Stacks.png @ 2866,1909,1,31 |
| Label pill height | 26 (light: fill rows 1819..1870 px); 27.5 including the dark outline in dark mode (1817..1871) | [M] | 10-15-Catalina-Light-Stacks.png @ 2600,1818,1,53; 10-15-Catalina-Dark-Stacks.png @ 2600,1816,1,56 |
| Label pill width | text width + 32 (16 pt padding each side); "10-15-beta-dark.jpg" = 150 (px 2496..2795) | [M] | 10-15-Catalina-Light-Stacks.png @ 2496,1846,300,1 |
| Label pill corner radius | about 4 | [M] | 10-15-Catalina-Dark-Stacks.png @ 2492,1814,14,12 |
| Gap pill to thumbnail | 7 (pill right edge 2795/2797, thumbnail left 2810) | [M] | 10-15-Catalina-Dark-Stacks.png @ 2790,1846,22,1 |
| "Open in Finder" circle | 56 diameter (px 2988..3099 x 516..627) with an 18 pt curved-arrow glyph | [M] | 10-15-Catalina-Light-Stacks.png @ 2960,570,160,1; 3044,490,1,160 |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Pill fill over dark sea | `#98a9b9 (sRGB #94a9bb)` (over `#1f354b (sRGB #19354d)`) | `#282e36 (sRGB #272e37)` (over `#0e192a (sRGB #0b192b)`) | [M] | 10-15-Catalina-Light-Stacks.png @ 2510,1846; 10-15-Catalina-Dark-Stacks.png @ 2510,1846 |
| Pill fill over sky | `#d8e9f1 (sRGB #d4e9f2)` (over `#b2cfe9 (sRGB #abd0ec)`) | `#2e3a4f (sRGB #2b3a51)` (over `#263e66 (sRGB #203e69)`) | [M] | 10-15-Catalina-Light-Stacks.png @ 2800,485,1,24; 10-15-Catalina-Dark-Stacks.png @ 2800,487,1,22 |
| Pill recipe | `rgba(255,255,255,0.58)` over the (lightly blurred) backdrop | `rgba(51,55,59,0.70)` | [C] | two-backdrop solve from the rows above |
| Pill border | none | 1 pt lighter inner line `#484d54 (sRGB #474d55)` + 0.5-1 pt black outline `#000000` | [M] | 10-15-Catalina-Dark-Stacks.png @ 2492,1814,14,12 |
| Label text | `#4c4c4c` | `#e3e3e3` | [M] | 10-15-Catalina-Light-Stacks.png @ 2529,1835; 10-15-Catalina-Dark-Stacks.png @ 2529,1846 |
| Circle fill | `#dfeaf0 (sRGB #ddeaf1)` (over sky) | `#293f64 (sRGB #233f67)` (close to the backdrop `#283f66 (sRGB #223f69)`: nearly clear) with a 1 pt `#435575 (sRGB #3f5578)` rim and black outline | [M] | 10-15-Catalina-Light-Stacks.png @ 3000,570; 10-15-Catalina-Dark-Stacks.png @ 2990,570,30,1 |
| Circle arrow glyph | `#616b71 (sRGB #5f6b72)` | `#a1b8dd (sRGB #9cb8e1)` | [M] | 10-15-Catalina-Light-Stacks.png @ 3025,570; 10-15-Catalina-Dark-Stacks.png @ 3025,570 |
| Open-state Dock tile | rounded square outline with a down triangle, black on the light shelf, light grey on the dark shelf | - | [M] presence; shape is an asset | 10-15-Catalina-Light-Stacks.png @ 2812,1961,108,114 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Label font | SF Pro Text 13 pt Regular (digit height 18 px: rows 1834..1851) | same | [C] | 10-15-Catalina-Light-Stacks.png @ 2529,1834,1,18 |
| Label text inset | 16 from the pill's left edge (first ink px 2528, pill 2496) | same | [M] | 10-15-Catalina-Light-Stacks.png @ 2496,1846,40,1 |
| Last element label | "N More in Finder" (here "7 More in Finder") | same | [M] | 10-15-Catalina-Light-Stacks.png @ 2720,480,290,120 |

### Shadows and effects
Thumbnails have a soft drop shadow (about `0 1px 3px rgba(0,0,0,0.4)`) [I]; pills and the circle show no measurable shadow in light mode.

## Layout and spacing
The fan grows upward from the tile; item n is offset 64 pt above item n-1 and shifted right along the curve given above; pills are right-aligned 7 pt left of their thumbnail and rotate with it. At most about 10 files are shown, then the "N More in Finder" element.

## Keyboard and accessibility
With Dock focus (Control-F3), Up/Return opens the stack; arrows move through items; Return opens; Esc closes [D]. ARIA: the tile is a `button` with `aria-haspopup="menu"`; the fan is a `menu` of `menuitem`s.

## Browser notes
Reproduce the fan with per-item `transform: translate() rotate()` using the table of offsets; the spring animation needs script or keyframes. Thumbnails are user content.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Stacks.png | 2480,440,640,1480 | whole fan |
| dark | 10-15-Catalina-Dark-Stacks.png | 2480,440,640,1480 | whole fan, dark pills with outlines |
| dark | 10-15-Catalina-Dark-Stacks.png | 2480,1400,640,700 | bottom items and the open-state Dock tile |

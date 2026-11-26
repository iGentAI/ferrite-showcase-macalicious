# Siri window (`siri`)

- **Status:** present
- **AppKit:** Siri.app panel (dark HUD-style window with result "snippets")
- **HIG:** Siri is covered under the HIG's Technologies section (Siri), not under macOS; no archived page was fetched for this spec, so behaviour statements below are tagged [D] from Apple's macOS User Guide ("Use Siri on your Mac") and general knowledge of Catalina
- **Appearances shown:** light, dark (the window chrome is dark in both; captured as a window with shadow)

## Purpose and behaviour
Siri on the Mac opens from its menu bar extra, Dock icon or "Hey Siri" as a floating panel at the top-right of the screen. The spoken request is transcribed at the top, results appear as cards ("snippets") that can be scrolled, dragged out or pinned to Notification Center, and the Siri orb at the bottom listens again when clicked [D].

## Anatomy
```
+------------------------------- 344 pt --+
| (x)                                      |  28 pt top strip (close button)
|  +------------------------------------+  |
|  | [orb] WEATHER                      |  |  26 pt card header
|  | (sun)  Memphis             95 deg  |  |  summary block
|  | 4 PM        (icon)            96   |  |  39 pt rows
|  | ...                                |  |
|  +------------------------------------+  |
| (?)              (orb)                   |  59 pt bottom strip
+------------------------------------------+   600 pt tall
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| content | transcript only, one or more result cards | - | - | one Weather card |
| card glow | per-result coloured glow in the card (weather: light aqua / warm) | - | - | aqua (light capture), pink-grey (dark capture) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| result shown | yes | 10-15-Catalina-Light-Siri.png @ 38,36,688,1200; 10-15-Catalina-Dark-Siri.png @ 38,36,688,1200 |
| listening (waveform at the bottom, "What can I help you with?") | no | [I] animated multi-colour waveform replaces the orb |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Window size | 344 x 600 (opaque frame px 38..725 x 36..1235) | [M] | 10-15-Catalina-Light-Siri.png (measure.py info); 10-15-Catalina-Dark-Siri.png |
| Corner radius | about 7 (fully opaque pixels start at x=53 on row 36, x=44 on row 40, x=39 from row 46) | [M] | 10-15-Catalina-Light-Siri.png @ 30,34,30,18 (alpha) |
| Top strip | 28 (px y=36..91) | [M] | 10-15-Catalina-Light-Siri.png @ 380,36,1,60 |
| Close button | x glyph 6 x 6 (px 64..75 x 58..69), centre 16 pt from the left, 14 pt from the top | [M] | 10-15-Catalina-Light-Siri.png @ 64,58,12,12 |
| Card | 320 wide (px 62..701), 12 pt side margins; top at y=92 px; clipped by the bottom strip at y=1117 | [M] | 10-15-Catalina-Light-Siri.png @ 30,600,80,1; 690,600,44,1; 380,92,1,1030 |
| Card top corner radius | 6.5 (13 px from top y=94 to full straight-edge fill at x=62, y=107) | [M] | corner grid 10-15-Catalina-Light-Siri.png @ 62,94,16,16 |
| Card header | 26 (px y=92..143); title ink from px 121 (29.5 pt from the card edge), orb icon 14 pt at 8 pt | [M] title; [I] icon | 10-15-Catalina-Light-Siri.png @ 380,92,1,52; 121,109,121,19 |
| Bottom strip | 59 (px y=1118..1235); help (?) glyph px 69..77 x 1169..1181; orb about 40 pt, centred | [M] strip and glyph; [I] orb size | 10-15-Catalina-Light-Siri.png @ 380,1117,1,120; 69,1169,9,13 |
| Weather rows | 39 pt pitch (icons at y=399, 477, 555 px); hour label ink from px 99 (18.5 pt from the card edge); value right-aligned ending px 660 (20.5 pt from the card's right edge) | [M] | 10-15-Catalina-Light-Siri.png @ 380,399,1,180; 99,393,60,19; 629,393,32,19 |
| Weather summary | city from px 236; big temperature digits 80 px tall (px y=220..299), right edge px 619 | [M] | 10-15-Catalina-Light-Siri.png @ 236,182,112,25; 505,220,115,80 |

### Colours and fills
| Part | Light capture | Dark capture | Tag | Evidence |
|---|---|---|---|---|
| Window chrome | `#373635` (sides), `#353c3a (sRGB #333c3a)` (top), `#383838` (bottom) | `#373838`, `#4e362f (sRGB #52352e)` (top, warm glow), `#493c43 (sRGB #4c3b43)` | [M] | 10-15-Catalina-Light-Siri.png @ 46,600,8,8; 200,56,8,8; 200,1180,8,8; dark same |
| Chrome recipe | dark HUD material: `rgba(40,40,40,0.85)` with `backdrop-filter: blur(30px)`; opaque fallback `#383838` | same | [I] alpha (window capture has no backdrop); [M] base colour | same |
| Inner border | 1 pt `#535252` / `#575757` | `#545555` | [M] | 10-15-Catalina-Light-Siri.png @ 38,600,2,1; 724,600,2,1 |
| Outer hairline | 0.5 pt black at alpha 0.78 | same | [M] | 10-15-Catalina-Light-Siri.png @ 37,600 |
| Card fill | `#d6d6d6` (lower), `#d8ece9 (sRGB #d3ede9)` near the top glow | `#d4dde0 (sRGB #d2dde0)`..`#e3dae7 (sRGB #e5d9e8)`, `#d6d0d0 (sRGB #d7d0d0)` near the top | [M] | 10-15-Catalina-Light-Siri.png @ 300,700,10,10; 400,300,10,10; 10-15-Catalina-Dark-Siri.png @ 300,700,10,10; 400,300,10,10 |
| Card header band | `#cfe0de (sRGB #cbe1de)` | `#d6c7c6 (sRGB #d9c6c6)` | [M] | 10-15-Catalina-Light-Siri.png @ 300,118,10,10; 10-15-Catalina-Dark-Siri.png @ 300,118,10,10 |
| Close / help glyphs | `#b3b4b2` | `#c5b4b4 (sRGB #c8b3b4)`, `#bdb5b1 (sRGB #bfb5b0)` | [M] | 10-15-Catalina-Light-Siri.png @ 64,58,12,12; 69,1169,9,13 |
| Card text, primary | `#181c18 (sRGB #171c18)`..`#263d38 (sRGB #1f3e38)` | `#241c1b (sRGB #251c1b)`..`#281713 (sRGB #2b1612)` | [M] | 10-15-Catalina-Light-Siri.png @ 121,109,121,19; 236,182,112,25; dark same |
| Card text, secondary (conditions) | `#5e7770 (sRGB #577870)` | `#5a5250 (sRGB #5c5250)` | [M] | 10-15-Catalina-Light-Siri.png @ 235,224,68,22; 10-15-Catalina-Dark-Siri.png @ 235,224,68,23 |
| Weather sun glyph | `#fbdf4b (sRGB #ffe000)`..`#fbe04c (sRGB #ffe103)` | same | [M] | 10-15-Catalina-Light-Siri.png @ 380,555,1,18 |

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Card header title | about 13.5 pt Regular, upper case (cap 19 px) | [C] | 10-15-Catalina-Light-Siri.png @ 121,109,121,19 |
| City | 14 pt Semibold ("Memphis" 25 px with descender) | [C] | 10-15-Catalina-Light-Siri.png @ 236,182,112,25 |
| Conditions lines | 13-14 pt Regular, about 19.5 pt line pitch | [C] size; [I] pitch | 10-15-Catalina-Light-Siri.png @ 235,224,68,22 |
| Temperature | SF Pro Display Thin/Light about 56 pt (digit height 80 px) | [C] | 10-15-Catalina-Light-Siri.png @ 505,220,115,80 |
| Hour labels / values | 13.5 pt Regular / Bold (cap 19 px) | [C] | 10-15-Catalina-Light-Siri.png @ 99,393,60,19; 629,393,32,19 |

### Shadows and effects
Window shadow margins in the capture: left 38, top 36, right 38, bottom 168 px (light) [M] measure.py info. The coloured glow inside the card is a soft radial gradient (aqua `#d8ece9 (sRGB #d3ede9)` in the light capture, pink-grey in the dark one) [M] samples above.

## Layout and spacing
Appears at the top-right of the screen under the menu bar [D]; not resizable; content scrolls under the fixed top and bottom strips.

## Keyboard and accessibility
Hold Command-Space (default) to invoke; Esc closes; Type to Siri is an accessibility option [D]. ARIA: `dialog` labelled "Siri" with a live region for the response.

## Browser notes
The orb and waveform are animated raster/shader artwork; use a static asset or a canvas animation. The card glow is a `radial-gradient` overlay.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Siri.png | 38,36,688,1200 | weather result (Memphis, 95 degrees) |
| dark | 10-15-Catalina-Dark-Siri.png | 38,36,688,1200 | weather result (Memphis, 73 degrees) |

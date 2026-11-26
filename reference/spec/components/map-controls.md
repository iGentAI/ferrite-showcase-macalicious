# Map controls (`map-controls`)

- **Status:** present (new component, not in seed.json; family: views). Seen in Maps and Find My.
- **AppKit:** `MKMapView` built-in controls: `showsZoomControls` (`MKZoomControl`), `showsCompass` (`MKCompassButton`, with the 3D toggle in Maps), `MKUserTrackingButton`; the map-type switch is an `NSSegmentedControl` (toolbar-style in Maps, floating over the map in Find My); Maps' "Show" is an `NSPopUpButton` over the map
- **HIG:** none specific for macOS 10.15 (MapKit); general: https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/
- **Appearances shown:** light, dark

## Purpose and behaviour
Floating controls drawn over a map: zoom out/in (a joined minus/plus pair), a compass that also toggles 3D, a button that centres the map on the current location (Find My), a map-type switch (Map / Hybrid / Satellite in Find My; Map / Transit / Satellite in the Maps toolbar) and a "Show" pull-down (Maps) for traffic and labels. They stay pinned to the bottom corners while the map pans.

## Anatomy
Bottom-right cluster, bottom to top: [locate] [- | +] row, compass disc above the zoom pair. Bottom-left: map-type segmented control (Find My) or "Show" pop-up (Maps). All are small white (light) or grey (dark) rounded controls with a hairline border and soft shadow.

## Variants and parameters
| Control | Maps | Find My |
|---|---|---|
| Zoom pair | yes | yes |
| Compass / 3D | yes | yes (3D dimmed) |
| Locate | in toolbar | over the map |
| Map type | toolbar segmented control | segmented control over the map |
| "Show" pop-up | yes | no |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Normal | yes | both apps, both appearances |
| Selected segment | yes | "Map" (white in light, lighter grey in dark) |
| Pressed / disabled | no | pressed darkens the face about 10 %; disabled glyph at 30 % [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Button height (zoom, locate, "Show") | 20 (white face 38-41 px plus hairline borders) | [M] | 10-15-Catalina-Light-Maps.png @ 240,1405,1,42; 10-15-Catalina-Light-Find-My.png @ 2150,1448,1,43 |
| Zoom pair width (Maps) | 56 (x=1973..2084 incl. border px): two halves and a 1 pt divider at x=2028 | [M] | 10-15-Catalina-Light-Maps.png @ 1973,1424,112,1 |
| Zoom glyphs | minus: 11 x 1 pt bar (22 x 2 px); plus: same bar crossed | [M] | 10-15-Catalina-Light-Maps.png @ 1990,1424,22,2 |
| Locate button width (Find My) | 34.5 (x=2145..2213) | [M] | 10-15-Catalina-Light-Find-My.png @ 2145,1456,69,1 |
| Gap locate -> zoom pair (Find My) | 12 (x=2214..2237) | [M] | same row |
| Zoom pair width (Find My) | 53.5 (x=2238..2344), divider near x=2290 | [M] | 10-15-Catalina-Light-Find-My.png @ 2238,1456,107,1 |
| Right margin | zoom pair right edge 19 pt from the window's right edge (Find My: x=2344 vs 2382); 13.5 pt in Maps (x=2084 vs 2111) | [M] | same |
| Bottom margin | control bottom 15 pt above the window bottom (Find My: y=1492 vs 1521; Maps: y=1445 vs 1473 -> 14) | [M] | same |
| Compass | disc about 53 pt across, centred above the zoom pair, about 5 pt gap; red north tick at the top | [M] approx | 10-15-Catalina-Light-Find-My.png @ 2240,1320,106,110 |
| Map-type control (Find My) | height 22.5 (y=1448..1492); left edge 15.5 pt from the map's left edge (x=667 vs 636); selected segment 71.5 wide (x=671..813) inset 2 pt inside the track | [M] | 10-15-Catalina-Light-Find-My.png @ 664,1456,166,1 and 1000,1448,1,45 |
| "Show" pop-up (Maps) | left edge 14 pt from the window edge (x=140), height 20 | [M] | 10-15-Catalina-Light-Maps.png @ 130,1424,40,1 |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Button face | `#ffffff` | `#646467` .. `#6a6a6d` | [M] | 10-15-Catalina-Light-Find-My.png @ 2150,1470; 10-15-Catalina-Dark-Find-My.png @ 2110,1446 |
| Button border (over the map) | top `#d2d0ca (sRGB #d2d0c9)`, bottom `#b7b5af (sRGB #b7b5ae)` (hairlines blended with the map) | top edge `#858687`, bottom edge `#242628` | [M] | 10-15-Catalina-Light-Maps.png @ 240,1406; 10-15-Catalina-Light-Maps.png @ 240,1445; 10-15-Catalina-Dark-Maps.png @ 2000,1388; 10-15-Catalina-Dark-Maps.png @ 2000,1426 |
| Pair divider | `#c4c2bd (sRGB #c4c2bc)` | `#292a2c` | [M] | 10-15-Catalina-Light-Maps.png @ 2028,1424; 10-15-Catalina-Dark-Maps.png @ 2028,1406 |
| Glyphs | `#262626` | `#e9e9e9` | [M] | 10-15-Catalina-Light-Maps.png @ 2000,1424; 10-15-Catalina-Dark-Find-My.png @ 2134,1446 |
| Segmented track (Find My) | `#e8e7e5` (translucent grey over the map `#f8f5ee (sRGB #f9f5ed)`) | `#3c3d41` .. `#36363b` | [M] | 10-15-Catalina-Light-Find-My.png @ 1000,1470; 10-15-Catalina-Dark-Find-My.png @ 956,1446 |
| Selected segment | `#ffffff` | `#6c6c72 (sRGB #6c6c73)` .. `#66666d (sRGB #66666e)` | [M] | 10-15-Catalina-Light-Find-My.png @ 700,1470; 10-15-Catalina-Dark-Find-My.png @ 640,1446 |
| Map land colour behind | `#f8f5ee (sRGB #f9f5ed)` | `#2b2d2f` | [M] | 10-15-Catalina-Light-Find-My.png @ 660,1470; 10-15-Catalina-Dark-Find-My.png @ 616,1446 |
| Compass north tick | `#eb3d25 (sRGB #ff2101)` | same hue | [M] | bbox extreme, 10-15-Catalina-Light-Find-My.png @ 2220,1320,160,110 |

### Text and icons
Segment labels: 11 pt [C] from the 15 px capital M (y=1463..1477), black `#000000` light / `#f2f2f3` dark [M]; evidence: `10-15-Catalina-Light-Find-My.png @ 723,1463,40,20`, `10-15-Catalina-Dark-Find-My.png @ 679,1439,40,20`. "3D" in the Maps compass: 14 pt [C] from the 20 px full-ink cap of D (y=1330..1349; 22 px including edge AA), `#262626` [M], `10-15-Catalina-Light-Maps.png @ 2010,1328,46,27` and `10-15-Catalina-Light-Maps.png @ 2030,1327,15,27`.

### Shadows and effects
A soft 1-2 pt drop shadow under each control is visible as 2-3 blended pixels below the bottom border (10-15-Catalina-Light-Find-My.png @ 700,1490,1,4). Dark controls are translucent over the map.

## Layout and spacing
Pinned to the map's bottom corners with 14-19 pt margins; the cluster does not scale with the window.

## Keyboard and accessibility
Buttons are in the key-view loop with full keyboard access; map zoom also via Command-plus/minus. ARIA: `button` with labels "Zoom out", "Zoom in", "Show current location", `radiogroup` for the map type.

## Browser notes
Map tiles are not reproducible (use a static image or a tile provider). The compass disc is an artwork asset.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Find-My.png | 2100,1300,290,210 | compass, locate, zoom pair |
| light | 10-15-Catalina-Light-Find-My.png | 650,1430,500,80 | map-type segmented control |
| dark | 10-15-Catalina-Dark-Find-My.png | 2056,1276,290,210 | same cluster, dark |
| dark | 10-15-Catalina-Dark-Find-My.png | 606,1406,500,80 | map-type control, dark |
| light | 10-15-Catalina-Light-Maps.png | 1940,1260,180,200 | compass with 3D, zoom pair |
| light | 10-15-Catalina-Light-Maps.png | 130,1390,240,70 | "Show" pop-up |

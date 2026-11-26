# Icon view / Collection View (`icon-view`)

- **Status:** present
- **AppKit:** `NSCollectionView` with `NSCollectionViewFlowLayout` / grid layout; Finder's icon view (`IKImageBrowserView`-like private implementation)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/ ; Finder: https://web.archive.org/web/20200503170015/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/finder/
- **Appearances shown:** light, dark

## Purpose and behaviour
Shows items as a grid of icons or thumbnails with a label beneath each. Finder's icon view arranges items on a grid whose icon size (16-512 pt), grid spacing, label size (10-16 pt) and label position come from View Options [D] (Finder View Options; not on a HIG page). Clicking selects, double-clicking opens, dragging a rectangle selects several.

## Anatomy
Per cell, top to bottom: icon box (square, icon art centred, aspect preserved) -> gap -> label (centred, up to 2 lines, middle-truncated), optional leading tag dot in the label line. Selected: rounded-rect backdrop behind the icon box and an accent pill behind the label.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| Icon size | 16-512 pt | 64 | Finder View Options | 64 (Applications, Utilities, Search); about 160 (Home, 5 per row) |
| Label position | bottom / right | bottom | View Options | bottom |
| Label size | 10-16 pt | 12 | View Options | 12 |
| Thumbnail grid (Photos) | square cells, aspect-fit | - | `NSCollectionView` | Photos album: 128 pt cells |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Normal | yes | all Finder icon windows |
| Selected (key window) | no (not in any Finder window capture; desktop icons are owned by `desktop-icon`) | icon backdrop: 4 pt-radius rounded rect, black @ 0.10 (light) / white @ 0.15 (dark), 4 pt larger than the icon box on each side; label pill: accent fill `#2466d9 (sRGB #0164e1)` / `#1f5bc9 (sRGB #0158d0)` with white text, radius 3, 2 pt horizontal padding [I], colours taken from the measured emphasized selection |
| Selected (inactive window) | no | label pill `#dcdcdc` / `#464646` with normal text colour [I] |
| Drop target folder | no | same as selected [I] |
| Renaming | no | label becomes a text field with focus ring [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Icon box, default | 64 x 64 (art up to 56-62 wide inside it) | [C] | art bboxes 101-124 px wide: 10-15-Catalina-Light-Applications.png @ 510,210,112,113 and row scan @ 444,190,1820,140 |
| Horizontal pitch (64 pt icons, 8 per row in a 915 pt pane) | 113 (flexes with the window width) | [M] | icon centres x=565.5, 797.5, 1017.5, 1244.5, 1467.5, 1695.5, 1921, 2148 (10-15-Catalina-Light-Applications.png @ 444,190,1820,140) |
| Vertical pitch (64 pt icons) | 116 | [M] | label cap tops y=350, 581/582, 814, 1045 (10-15-Catalina-Light-Applications.png @ 444,340,240,730) |
| First icon box | top 8 pt below the content top; first column centre 62 pt from the content's left edge | [C] | icon art y=210..322 centred in the box 202..329; content top y=186, left x=442 |
| Icon box bottom -> label cap top | 10 (box bottom y=329, cap top y=350) | [C] | same |
| Label line pitch (2 lines) | 16 | [M] | 10-15-Catalina-Light-Applications.png @ 2081,1046,133,50 ("System" top y=1046, "Preferences" top y=1078) |
| Large icons (Home) | art 148 wide x 117.5 tall (296 x 235 px), i.e. about 160 pt icon box; pitch 186 horizontally, 226 vertically | [M] art and pitch, [C] box size | 10-15-Catalina-Light-Finder-Home.png @ 490,354,296,235; columns at x=490, 862, 1234, 1606, 1978; rows at y=354 and 806 |
| Large icons: art bottom -> label cap top | 33 | [M] | art bottom y=588, label y=654 (10-15-Catalina-Light-Finder-Home.png @ 590,654,92,23) |
| Tag dot in label | 10 diameter, 6 pt gap before the text | [M] | 10-15-Catalina-Light-Finder-Home.png @ 929,652,20,20; text starts x=961 |
| Photos grid cell | 128 x 128 cell, thumbnail aspect-fit and centred; column pitch 144.5 (gap 16.5); first cell 13 pt from the pane edge | [M] | 10-15-Catalina-Light-Photos.png @ 498,420,1987,1 (cells at x=498, 787, 1075, 1364, 1652, 1941, 2229, each 256 px) |
| Photos row gap | 16 between the tallest thumbnails of adjacent rows (row height = tallest thumbnail in the row) | [M] approx | 10-15-Catalina-Light-Photos.png @ 600,300,1,710 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| View background | `#ffffff` | `#1e2022` | [M] | 10-15-Catalina-Light-Applications.png @ 480,340; 10-15-Catalina-Dark-Finder-Home.png @ 938,662 |
| Label text | `#272627` | `#dddddd` [C from other dark primary text] | [M] light | 10-15-Catalina-Light-Applications.png @ 509,350,111,22 |
| Label tag dot (green) | `#7ad373 (sRGB #54d766)` flat, no ring | `#80db7c (sRGB #5adf70)` flat, no ring | [M] | 10-15-Catalina-Light-Finder-Home.png @ 938,662; 10-15-Catalina-Dark-Finder-Home.png @ 1063,662 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Label font | SF Pro Text 12 pt Regular, centred, max 2 lines | same | [C] | cap + descender box 22 px: 10-15-Catalina-Light-Applications.png @ 509,350,111,22 |
| Photos title | SF Pro Display about 28 pt Bold; sub-line 13 pt (semibold date range, grey count, blue links) | same | [C] | 10-15-Catalina-Light-Photos.png @ 497,188,290,50 and 498,264,692,25 |

### Shadows and effects
Finder icons carry their own baked shadows (in the artwork). Photos thumbnails have none.

## Layout and spacing
Flow left to right, top to bottom; the horizontal pitch stretches so columns fill the width evenly. The view scrolls vertically. Group headers (Photos "Wallpapers" title block) sit above the grid with a 0.5 pt rule (`#e6e6e6` at 10-15-Catalina-Light-Photos.png @ 1000,301; dark `#343638` at 10-15-Catalina-Dark-Photos.png @ 1000,301).

## Keyboard and accessibility
Arrow keys move the selection in two dimensions, Shift extends, type-select, Return renames (Finder), Space Quick Looks, Command-Down opens [D] (Finder behaviour). AX role `AXList`/`AXGrid` of `AXImage`/`AXGroup` cells. ARIA `role="grid"` or `listbox` with `aria-multiselectable`.

## Browser notes
App and folder icons are artwork assets (not reproducible in CSS). The stretch-to-fill pitch is `display:grid; grid-template-columns: repeat(auto-fill, minmax(...)); justify-content: space-between` or computed gaps.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Applications.png | 442,186,1830,1402 | 64 pt icon grid, one- and two-line labels |
| dark | 10-15-Catalina-Dark-Applications.png | 442,186,1900,1434 | same, dark |
| light | 10-15-Catalina-Light-Finder-Home.png | 444,286,1878,1254 | large icons, tag dot in a label |
| dark | 10-15-Catalina-Dark-Finder-Home.png | 442,286,1880,1254 | same, dark |
| light/dark | 10-15-Catalina-Light-Photos.png, 10-15-Catalina-Dark-Photos.png | 472,152,2040,880 | thumbnail grid |

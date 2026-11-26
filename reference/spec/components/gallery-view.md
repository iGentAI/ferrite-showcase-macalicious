# Gallery View (`gallery-view`)

- **Status:** present
- **AppKit:** custom Finder view (10.14+); closest public pieces are `QLPreviewView` for the large preview, `NSCollectionView` for the thumbnail strip and an `NSSplitView` preview pane
- **HIG:** https://web.archive.org/web/20200503170015/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/finder/ (Quick Actions and the Preview pane are described there)
- **Appearances shown:** light, dark

## Purpose and behaviour
Finder's fourth view mode: a large preview of the selected item, a horizontally scrolling strip of thumbnails beneath it, and (optionally) the Preview pane on the right with metadata and Quick Actions ("Rotate Left", "Markup", "More...") [D] (HIG Finder page: Quick Actions appear in the Preview pane).

## Anatomy
```
+---------------------------------------------+------------------+
|                                             | [thumb] 10-9.jpg |
|              large preview                  |  JPEG image - .. |
|        (aspect-fit, centred)                | Information  Show More
|                                             | Created ...      |
|                                             | Tags             |
| [t][t][t][t][t][t][t][t][T][t][t][t][t]     | Rotate  Markup  More
+---------------------------------------------+------------------+
```

## Variants and parameters
| Parameter | Values | Default | Shown |
|---|---|---|---|
| Preview pane | shown / hidden (View > Show Preview) | shown in gallery view | shown |
| Thumbnail size | fixed 48 pt wide slot | - | 48 |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Thumbnail normal | yes | strip |
| Thumbnail selected (window key) | yes | grey rounded backdrop behind "10-9.jpg" (light and dark) |
| Thumbnail selected, strip focused with accent | no | the captured backdrop is grey in both appearances; Catalina does not accent-tint it [I] |
| Preview pane "Show More" expanded | no | more rows of the same style [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Preview pane width | 250, separated by a 1 pt divider | [M] | 10-15-Catalina-Light-Finder-Gallery-View.png @ 2078,300,2,1 (divider), pane x=2080..2579; 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2154,300,2,1 |
| Large preview | aspect-fit, horizontally centred in the gallery pane; here 754 x 424 (16:9) | [M] | 10-15-Catalina-Light-Finder-Gallery-View.png @ 506,455,1508,848 |
| Thumbnail slot | 48 wide; height by aspect (4:3 -> 36, 16:9 -> 27), vertically centred on a common centre line | [M] | 10-15-Catalina-Light-Finder-Gallery-View.png @ 464,1576,97,1 and 500,1540,1,72; selected 16:9 thumb @ 1500,1548,1,54 |
| Thumbnail pitch | 62 (gap 14) | [M] | thumbs start x=464, 588, 712, 836, 960, 1084 (same file, row y=1576) |
| Strip left inset | 11 (first thumb x=464, pane x=442) | [M] | same |
| Strip centre line | 35 pt above the window bottom (centre y=1575.5, window bottom y=1645) | [M] | same |
| Selected backdrop | 54 x 52, radius about 3, centred on the thumbnail (3 pt wider on each side) | [M] | 10-15-Catalina-Light-Finder-Gallery-View.png @ 1450,1530,108,1 and 1452,1524,1,104; corner grid @ 1448,1520,8,8 |
| Pane content inset | 20 left and right (rules x=2120..2539 in a pane x=2080..2579) | [M] | 10-15-Catalina-Light-Finder-Gallery-View.png @ 2120,424,420,2 |
| Info row pitch | 20, with 1 pt separators between rows | [M] | 10-15-Catalina-Light-Finder-Gallery-View.png @ 2300,528,1,122 (#e6e6e6 lines at y=528, 568, 608, 648) |
| Section rules | 1 pt at y=424 and y=716 (above "Information" and above "Tags") | [M] | 10-15-Catalina-Light-Finder-Gallery-View.png @ 2300,424,1,2 and 2300,716,1,2 |
| Quick Action row | three items; glyph row y=1534..1565, label row y=1583..1603; window bottom y=1645 | [M] | 10-15-Catalina-Light-Finder-Gallery-View.png @ 2122,1534,394,70 |
| "Shared Folder" banner above the view | 24 high + 1 pt bottom border (a Finder info bar, not part of gallery view) | [M] | 10-15-Catalina-Light-Finder-Gallery-View.png @ 1300,186,1,50 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Gallery and pane background | `#ffffff` | `#1e2022` | [M] | Light @ 1300,300; Dark @ 1300,300 |
| Pane divider | `#d5d5d5` | `#000000` | [M] | Light @ 2078,300; Dark @ 2154,300 |
| Selected thumbnail backdrop | `#c0c0c0` | `#565759` | [M] | Light @ 1452,1560; Dark @ 1452,1540 |
| Section rule | `#c0c0c0` | `#565759` | [M] | Light @ 2300,424; Dark @ 2400,424 |
| Row separator | `#e6e6e6` | `#343638` | [M] | 10-15-Catalina-Light-Finder-Gallery-View.png @ 2300,528; 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2400,528 |
| Info label / value / link | `#808080` / `#272727` / `#276ad3 (sRGB #0168da)` | `#9a9a9b` / `#dddddd` / `#589cf8 (sRGB #429bff)` | [M] | darkest/lightest ink in 10-15-Catalina-Light-Finder-Gallery-View.png @ 2121,500,87,19; 10-15-Catalina-Light-Finder-Gallery-View.png @ 2302,500,236,23; 10-15-Catalina-Light-Finder-Gallery-View.png @ 2410,448,125,19; 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2196,500,90,19; 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2300,500,320,23; 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2486,448,130,22 |
| Placeholder "Add Tags..." | `#c0c0c0` | `#565759` | [M] | darkest/lightest ink in 10-15-Catalina-Light-Finder-Gallery-View.png @ 2121,784,121,23; 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2196,784,130,23 |
| Quick Action glyph / label | `#7f7f7e` / `#8e8e93` | `#9a9b9c` / `#98989d` | [M] | darkest/lightest ink in 10-15-Catalina-Light-Finder-Gallery-View.png @ 2164,1534,334,32; 10-15-Catalina-Light-Finder-Gallery-View.png @ 2122,1583,394,21; 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2238,1510,32,32; 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2196,1560,132,20 |
| Banner fill / border | `#f0f0f0` / `#cecece` | `#2b2e30 (sRGB #2a2e30)` / `#4d5052 (sRGB #4c5052)` | [M] | Light @ 1300,200 and 1300,235; Dark @ 1300,200 and 1300,235 |

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| File name | about 15 pt Semibold; kind line 11 pt grey | [C] | 10-15-Catalina-Light-Finder-Gallery-View.png @ 2123,291,348,70 |
| Section titles ("Information", "Tags") | 13 pt Bold | [C] | line box y=444..466 and 738..763 |
| Info rows | 11 pt; label left-aligned grey, value right-aligned | [C] | line boxes 19-23 px at y=500, 540, 580, 620, 660 |
| Quick Action labels | 11 pt, centred under 16 pt glyphs | [C] | y=1583..1603 |

### Shadows and effects
None. The large preview has a 0.5 pt darker outline from the image itself.

## Layout and spacing
Gallery pane = window width - sidebar - 250 pt preview pane. The captured preview has 32 pt left and right margins [C] (pane x=442..2077, image x=506..2013; 10-15-Catalina-Light-Finder-Gallery-View.png @ 442,455,1636,1); it scales to fit the area above the strip; the strip scrolls horizontally and keeps the selected thumbnail visible.

## Keyboard and accessibility
Left/Right move through items, Space opens Quick Look, Command-Up/Down navigate folders [D] (Finder). AX: preview `AXImage`, strip `AXList` of `AXImage`. ARIA: `role="listbox"` (horizontal, `aria-orientation`) controlling an `img` region.

## Browser notes
Preview content and thumbnails are image assets. Everything else is flat.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Finder-Gallery-View.png | 442,236,2138,1410 | preview, strip with selected thumbnail, preview pane |
| dark | 10-15-Catalina-Dark-Finder-Gallery-View.png | 442,236,2214,1386 | same, dark |
| light | 10-15-Catalina-Light-Finder-Quick-Look.png | 140,260,2480,1570 | gallery view in an inactive window behind Quick Look (full-screen capture) |

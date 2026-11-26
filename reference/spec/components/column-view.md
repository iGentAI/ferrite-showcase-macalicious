# Column View / browser (`column-view`)

- **Status:** present (Finder "Network" window and both Open dialogs)
- **AppKit:** `NSBrowser` (`columnResizingType`, `rowHeight`, preview via `previewViewController(forLeafItem:)`); Finder uses its own implementation with the same look
- **HIG:** https://web.archive.org/web/20200503194050/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/column-views/
- **Appearances shown:** light, dark

## Purpose and behaviour
Navigates a hierarchy with a series of vertical columns, one per level. A parent item is marked with a triangle; selecting it shows its children in the next column. When a leaf is selected the last column shows a preview and information about it. The first column is the root; columns are resizable (all [D], HIG column-views page).

## Anatomy
1. Column background (content colour) with rows at table metrics.
2. Selection highlight in each column on the path (the active column emphasized, parents unemphasized).
3. Row: 16 pt icon, label, trailing right-pointing triangle for containers.
4. 1 pt column divider on the trailing edge of each column (drag to resize; a resize handle glyph is not drawn in Catalina).
5. Preview column: tinted panel with artwork, name, kind and action buttons (Finder) or preview + metadata (Open panel).

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| Preview column | on / off | on | Finder "Show Preview"; `NSBrowser` preview controller | on |
| Column width | user-resizable, default about 204 pt | - | `setWidth(_:ofColumn:)` | 203.5-204 pt |
| Icons | 16 pt / none | 16 pt | cell image | 16 pt |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Row normal | yes | Finder Network, Open dialog |
| Row selected, emphasized | yes | "Castle" (light and dark), "512 Pixels" in the Open dialog |
| Row selected, unemphasized (parent column on the path) | no | `#dcdcdc` light / `#464646` dark, as `table-view` [I] |
| Empty column | yes | third column in Finder Network, both columns of the iCloud Open dialog |
| Divider dragging | no | resize cursor only [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Row pitch | 18 | [M] | row text tops y=194, 230 (selected), 266, 302: 10-15-Catalina-Light-Finder-Network.png @ 497,194,215,127 |
| Selection height | 17, starting 1 pt below the top of the first row slot | [M] | 10-15-Catalina-Light-Finder-Network.png @ 600,224,1,34; 10-15-Catalina-Dark-Finder-Network.png @ 600,188,1,34 (content starts y=186) |
| Column width | 203.5 (light, x=444..850), 204 (dark, x=378..785) | [M] | 10-15-Catalina-Light-Finder-Network.png @ 444,600,407,1; 10-15-Catalina-Dark-Finder-Network.png @ 380,600,406,1 |
| Column divider | 1 pt, full height | [M] | 10-15-Catalina-Light-Finder-Network.png @ 851,600,2,1 and 1357,600,2,1; 10-15-Catalina-Dark-Finder-Network.png @ 786,600,2,1 |
| Preview column width (Finder) | 252 (x=853..1356) | [M] | 10-15-Catalina-Light-Finder-Network.png @ 853,600,504,1 |
| Icon | 16 x 16, left edge 7 pt from the column edge (x=458) | [M] | 10-15-Catalina-Light-Finder-Network.png @ 458,239,33,1 |
| Label left edge | 26 from the column edge (x=496/497) | [M] | 10-15-Catalina-Light-Finder-Network.png @ 496,266,89,23 |
| Disclosure arrow | 4.5 x 7 (9 x 14 px), right edge 3.5 pt from the column's right edge (x=835..843, column ends 850), vertically centred | [M] | 10-15-Catalina-Light-Finder-Network.png @ 835,269,9,14 |
| Preview tinted panel height (Finder, connection panel) | 171.5 (y=186..528) plus a 0.5 pt bottom line `#f0f0f0` at y=529; below it the column continues in the content colour | [M] | 10-15-Catalina-Light-Finder-Network.png @ 900,500,1,31 |

Arrow polygon (px at 2x in a 9 x 14 box): (0,0) (9,7) (0,14), solid [M] (grid 10-15-Catalina-Light-Finder-Network.png @ 832,266,12,18).

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Column background | `#ffffff` | `#1e1f21` | [M] | 10-15-Catalina-Light-Finder-Network.png @ 600,600; 10-15-Catalina-Dark-Finder-Network.png @ 600,600 |
| Column divider | `#e6e6e6` | `#000000` | [M] | Light @ 851,600; Dark @ 786,600 |
| Selection, emphasized | `#2466d9 (sRGB #0164e1)` | `#1f5ac8 (sRGB #0357cf)` | [M] | Light @ 600,240; Dark @ 600,200 |
| Preview panel fill | `#f5f5f5` | `#252628` | [M] | Light @ 1100,300; Dark @ 990,300 |
| Arrow, normal | `#7f7f7f` | `#9a9a9b` | [M] | Light @ 836,275; Dark bbox @ 770,226,18,28 |
| Arrow, selected row | `#ffffff` | `#ffffff` | [M] | 10-15-Catalina-Light-Finder-Network.png @ 835,239,11,1 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Label font | SF Pro Text 13 pt Regular | same | [C] | line boxes 19-23 px: 10-15-Catalina-Light-Finder-Network.png @ 496,302,114,19 |
| Label colour | `#272727`; selected `#ffffff` | `#dddddd`; selected `#ffffff` | [M] | Light @ 497,194,215,19; Dark @ 431,229,89,24 |
| Preview name | 13 pt Bold, centred; status line 11 pt secondary grey | same | [C] | 10-15-Catalina-Light-Finder-Network.png @ 1040,350,130,60 (visual: "Castle" / "Not Connected") |

### Shadows and effects
None.

## Layout and spacing
Columns are laid out left to right at their own widths; the view scrolls horizontally when columns overflow, keeping the newest column visible. Rows start 1 pt below the content top. In the Open panel the browser sits between the sidebar and the bottom button bar; the preview column takes the remaining width (512 Pixels preview: `open-panel`, owned by dialogs).

## Keyboard and accessibility
Up/Down move within a column, Right enters the child column, Left returns to the parent, type-select works per column [D]. AX role `AXBrowser` containing `AXScrollArea` > `AXList` columns. ARIA: nested `role="listbox"` columns inside a `group`, or a `tree` with `aria-level`; expose `aria-expanded` on the selected container.

## Browser notes
None; flat colours and 1 pt lines.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Finder-Network.png | 444,186,1520,400 | three columns, emphasized selection, preview panel |
| dark | 10-15-Catalina-Dark-Finder-Network.png | 378,186,1730,400 | same, dark |
| light | 10-15-Catalina-Light-Finder-Open.png | 424,210,1500,1010 | Open panel browser with document preview column |
| light | 10-15-Catalina-Light-Finder-Open-iCloud.png | 424,160,1290,730 | empty columns |

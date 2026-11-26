# Path bar / path control (`path-bar`)

- **Status:** present only as an empty bar (no path components are drawn in any screenshot)
- **AppKit:** `NSPathControl` (`pathStyle = .standard | .popUp`); Finder's View > Show Path Bar
- **HIG:** https://web.archive.org/web/20200503161454/https://developer.apple.com/design/human-interface-guidelines/macos/selectors/path-controls/
- **Appearances shown:** light, dark (empty bar)

## Purpose and behaviour
A path control shows the file-system path of the selected item, or of the window's folder when nothing is selected, as icon + name components from the root disk to the item; names in the middle are hidden when space runs out; a pop-up style shows only the last component and opens a menu of ancestors [D]. It belongs in the window body (Finder draws it at the bottom of the body), not in the frame [D]. Double-clicking a component opens it; items can be dragged onto components [D].

Finder shows the bar automatically while searching so the location of a selected result can be read. Checked every Finder window capture: it is visible only in the two Finder Search shots (and their Spotlight "Show all in Finder" twins), and it is empty there because no result is selected. Network, Home, Gallery View, Applications and Utilities have no path bar.

## Anatomy
Top separator rows, flat bar, then (not shown) components: 16 pt icon, name, chevron separator.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| style | standard breadcrumb, pop-up | standard [D] | `pathStyle` | empty standard bar only; populated and pop-up controls not shown |
| value | empty, folder path, selected result path | app-defined [D] | `url` / `pathComponentCells` | empty only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| empty bar | yes | `10-15-Catalina-Light-Finder-Search.png @ 443,1454,1927,50` |
| with path components | no | [D]/[I] below |
| hover on a truncated component (expands) | no | [D] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Bar height | 25 = two 0.5 rows (y 1454, 1455) + 24 fill (y 1456..1503) | [M] | `10-15-Catalina-Light-Finder-Search.png @ 1500,1454,1,50` |
| Extent | from the sidebar divider to the window's right edge, at the very bottom of the body; the window's bottom corners clip it | [M] | same crop |
| Component icon | 16 x 16 | [I] | standard small file icon |
| Component text | 11 pt Regular (small system font), 4 after the icon | [I] | `NSPathControl` small control size as used by Finder |
| Separator chevron | right-pointing, 5 x 8, 6 either side | [I] | |
| Leading inset of the first component | 8 | [I] | |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill | `#f0f0f0` | `#2b2c2f` | [M] | `10-15-Catalina-Light-Finder-Search.png @ 1500,1470`; `10-15-Catalina-Dark-Finder-Search.png @ 1500,1440` |
| Top rows (outer, inner) | `#cecece`, `#e1e1e1` | `#4d4e51`, `#3a3b3e` | [M] | `@ 1500,1454`, `@ 1500,1455` (light); `@ 1500,1418`, `@ 1500,1419` (dark) |
| Last row of the bar (window edge highlight) | `#f3f3f3` | `#565659` (the window's inner border) | [M] | `@ 1500,1503` light; `@ 1500,1466` dark |
| Component text | `#262626` | `#dfdfdf` | [I] | label colour |
| Chevron | `#8e8e8e` | `#8e8e8e` | [I] | secondary label |

### Text and icons
No path text or icons are shown. The icon size, label size, chevron and colours above remain [I]; not shown: the captured Finder path bars are empty, so they do not prove populated-bar raster geometry.

### Shadows and effects
No independent shadow [M] in the cited top/bottom columns. The bar's last row is the window highlight, not a second shadow.

## Layout and spacing
Sits below the content and above the status bar when both are enabled [D]. Components are laid out leading to trailing; the last is the selected item.

## Keyboard and accessibility
Not in the default key loop. `AXList` of `AXStaticText`/`AXImage` cells (`NSPathControl` exposes each component as an `AXCell`). ARIA: `<nav aria-label="Path">` with an ordered list (breadcrumb pattern), last item `aria-current="page"`.

## Browser notes
Reproducible; middle truncation needs measuring text in script.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Search.png` | 443,1454,1927,50 | empty path bar during search |
| dark | `10-15-Catalina-Dark-Finder-Search.png` | 443,1418,1581,50 | same |

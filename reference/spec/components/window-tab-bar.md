# Window tab bar (`window-tab-bar`)

- **Status:** present
- **AppKit:** `NSWindow.tabbingMode`, `NSWindowTabGroup`, `NSWindowTab`; `newWindowForTab(_:)` enables the + button
- **HIG:** https://web.archive.org/web/20200503141343/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/
- **Appearances shown:** light, dark

## Purpose and behaviour
A tab bar lets the user switch between several body content views in one window; it sits below the title bar and toolbar, tabs can be dragged out into their own window, and "all windows have tabs enabled by default" [D]. The bar appears when a window has two or more tabs. Hovering a tab shows a close button at its leading edge [D] (not captured).

## Anatomy
```
 toolbar bottom rows (shadow + separator)
 +-----------+===========+-----------+---+
 | inactive  |  ACTIVE   | inactive  | + |   24 pt fill
 +-----------+===========+-----------+---+
 bottom rows (shadow + separator)             1 pt
```
Tabs share the width equally; 1 pt dividers between tabs; the + (new tab) button is a fixed cell at the trailing end.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| tab count | 2 or more | n/a | `tabbedWindows` | 3 (Finder Home) |
| new-tab button | shown, hidden | shown when the app implements it | `newWindowForTab` | shown |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| active tab | yes | `10-15-Catalina-Light-Finder-Home.png @ 856,186,720,50` |
| inactive tab | yes | `@ 113,186,741,50`, `@ 1578,186,696,50` |
| hover (lighter fill, close button) | no | [I] fill halfway between inactive and active; close glyph as below |
| inactive window | yes, for the Safari bar | see `safari-tab-bar` (identical metrics) |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Height | 25 = 24 fill + 1 (two 0.5 pt bottom rows) | [M] | `10-15-Catalina-Light-Finder-Home.png @ 1000,186,1,50` |
| Divider between tabs | 1 (2 px) | [M] | `@ 854,196,2,1`, `@ 1576,196,2,1` |
| Tab widths in the capture (frame 1105 pt wide) | 370.5, 360, 348 (x 113..853, 856..1575, 1578..2273) | [M] | `@ 112,196,2210,1` |
| New-tab cell | 22.5 wide (x 2276..2320) + 1 divider (x 2274..2275) | [M] | same row |
| + glyph | 11 x 11 (22 px), strokes 1 (2 px), centred in the cell | [M] | `@ 2288,198,22,22` |
| Title | centred in the tab, cap rows y 201..217 -> 11 pt; baseline 16 below the bar top (last ink row y=217) | [M], [C] | `@ 1172,201,88,17` |
| Close button (hover) | 14 x 14 hit area, 8 x 8 cross with 1 pt strokes, 6 pt from the tab's leading edge | [I] | not captured; AppKit tab button metrics |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Inactive tab fill (top -> bottom) | `#bfbfbf` -> `#b7b7b7` | `#1d1d1e` -> `#1a1b1c` | [M] | `10-15-Catalina-Light-Finder-Home.png @ 400,186,1,48`; `10-15-Catalina-Dark-Finder-Home.png @ 400,186,1,48` |
| Active tab fill | `#d4d4d4` -> `#cccccc` | `#37383a` -> `#333436` | [M] | `@ 1000,186,1,48` in both |
| Divider | `#adadad` | `#595a5c` | [M] | `10-15-Catalina-Light-Finder-Home.png @ 854,196`; `10-15-Catalina-Dark-Finder-Home.png @ 834,196` |
| Bottom rows under an inactive tab | `#a9a9a9`, `#929292` | `#151617`, `#000000` | [M] | `@ 400,234`, `@ 400,235` |
| Bottom rows under the active tab | `#bebebe`, `#a7a7a7` | `#292a2b`, `#000000` | [M] | `@ 1000,234`, `@ 1000,235` |
| Toolbar rows directly above the bar | `#c5c5c5`, `#afafaf` | `#444546`, `#515253` (above inactive), `#4c4c4e`, `#5a5c5e` (above active) | [M] | `@ 400,184`, `@ 400,185`; dark `@ 1000,184`, `@ 1000,185` |
| New-tab cell fill | `#bcbcbc` -> `#b6b6b6` | `#262627` | [M] | `10-15-Catalina-Light-Finder-Home.png @ 2300,186,1,48`; `10-15-Catalina-Dark-Finder-Home.png @ 2214,196,44,1` |
| Divider before the new-tab cell | `#888888` | `#7d7d7e` | [M] | `10-15-Catalina-Light-Finder-Home.png @ 2274,196`; `10-15-Catalina-Dark-Finder-Home.png @ 2212,196` |
| + glyph | `#818080` | `#7d7b7c` | [M] | `10-15-Catalina-Light-Finder-Home.png @ 2300,208`; darkest/lightest in `10-15-Catalina-Dark-Finder-Home.png @ 2218,190,40,44` |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title font | SF Pro Text 11 pt Regular | same | [C] | cap height 15-16 px |
| Active title colour | `#1b1b1b` | `#ffffff` | [M] | darkest/lightest pixel in `10-15-Catalina-Light-Finder-Home.png @ 1100,190,240,44`; `10-15-Catalina-Dark-Finder-Home.png @ 1100,190,240,44` |
| Inactive title colour | `#3a3b3a` | `#999a9a` | [M] | `@ 400,190,240,44` in both |

### Shadows and effects
None.

## Layout and spacing
The bar spans the full window width directly under the toolbar separator and above scope bars, banners and content. Tabs divide the width left of the new-tab cell equally (the captured widths step by 12 pt because the capture caught the bar mid-layout or with rounding carried to the first tabs; build with equal widths) [I]. Long titles truncate at the end.

## Keyboard and accessibility
Control-Tab / Control-Shift-Tab cycle tabs, Command-T opens a new tab where supported, Command-W closes the tab [D]. `AXTabGroup` with `AXRadioButton` children (`AXValue` 1 for the selected tab). ARIA: `role="tablist"` / `role="tab"` with `aria-selected`, arrow keys to move, the + as a separate `<button>`.

## Browser notes
Reproducible; use two-colour 0.5 px bottom rows as in `title-bar`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Home.png` | 112,184,2210,52 | three tabs, middle one active, + button |
| dark | `10-15-Catalina-Dark-Finder-Home.png` | 112,184,2148,52 | same |

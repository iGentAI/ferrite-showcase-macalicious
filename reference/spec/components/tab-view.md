# Tab View (`tab-view`)

- **Status:** present
- **AppKit:** `NSTabView` (`tabViewType = .topTabsBezelBorder`, `controlSize`), tabs are `NSTabViewItem`; the tab strip is drawn like an `NSSegmentedControl` of style `.rounded` with `trackingMode = .selectOne`
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/tab-views/
- **Appearances shown:** light, dark (blue accent)

## Purpose and behaviour
Presents several mutually exclusive panes in the same area: a tabbed control (similar to a segmented control) above a bordered content area. Clicking a tab shows its pane; switching tabs never changes the size of the tab view or window. Tabs can sit on any side or be hidden (tabless, bezeled or line-bordered). Use two to six tabs with title-case noun labels; controls in a pane affect only that pane; inset the tab view from the window edges and keep window-wide controls (lock, help) outside it. [D] (HIG, Tab Views)

## Anatomy
```
            +-------------+--------+-------+        tab strip, 20 pt high, centred on the
   .--------| Sound Effects| Output | Input |-----.  top border of the content box (10 pt above,
   |        +-------------+--------+-------+      |  10 pt below)
   |                 content box                  |
   '----------------------------------------------'
```
1. Content box: the `box` recipe (tinted fill, hairline border, 4 pt radius).
2. Tab strip: one rounded rectangle split into segments, horizontally centred on the box, drawn over the box's top border.
3. Selected segment: accent gradient with white text. Unselected: control fill with label-colour text, 1 pt dividers between unselected neighbours.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| tab position | top, bottom, left, right, none | top | `tabViewType` | top only |
| border | bezel, line, none | bezel | `tabViewType` | bezel only |
| controlSize | regular, small, mini | regular | `controlSize` | regular only |
| number of tabs | 2..6 recommended | - | `tabViewItems` | 2 (Users & Groups, Spotlight, Energy Saver), 3 (Sound, Trackpad, Displays), 4 (Security & Privacy), 5 (Keyboard), 8 (Network Utility) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| tab selected, key window | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Sound.png @ 553,193,217,40`; `10-15-Catalina-Dark-System-Preferences-Sound.png @ 554,193,216,40` |
| tab unselected | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Sound.png @ 770,193,238,40`; Dark same |
| last tab selected (mirrored end cap) | yes, light | `10-15-Catalina-Light-System-Preferences-Energy-Saver.png @ 736,313,225,40` |
| pressed | not shown | [I] unselected segment darkens to `#e6e6e6` (light) / lightens to `#7b7c7d` (dark), as a pressed push button |
| disabled | not shown | [I] text at the tertiary label colour, selected segment loses the accent |
| inactive window | not shown in my screenshots | [I] selected segment drawn grey (`#d5d5d5` light, `#6a6a6a` dark) with label-colour text, as inactive segmented controls |
| focused | not shown | [I] `focus-ring` around the whole strip |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Tab strip height | 20 (plus 1 pt of shadow below) | [M] | Light Sound col 660: y 193..232; col 840: y 193..232. Second instance: `10-15-Catalina-Light-Network-Utility.png` col 280: y 145..184 |
| Tab strip corner radius | 3.5, on the outer edge of the border; the strip is the `push-button` bezel, whose radius fits 3.75. Least-squares fit with `tools/corner_fit.py` to the selected first tab, with its gradient fill taken as flat: best 3.5 (rms 4.2 levels; 5.6 at 3.75, 5.9 at 3.25, 8.9 at 3), and the 0.5 pt halo outside it fits 4 (rms 3.1). The gradient makes this fit coarser than the push button's, so 3.5 to 3.75 is the supported range. The earlier value of 3 misread the grid (the top row is still blended at x=559) | [C] fit from [M] pixels | `10-15-Catalina-Light-System-Preferences-Sound.png @ 551,191,12,12` |
| Strip vertical position | centred on the box's top border: 9.5 pt above the border line, 10.5 pt below | [M] | Light Sound: strip y 193..232, box top border y=212 (col 300) |
| Strip horizontal position | centred on the box | [M] | Light Sound: strip x 553..1007 (centre 780), box x 152..1407 (centre 779.5) |
| Segment width | label ink width + 23.5 (+/- 0.5); the first and last segments are about 1 pt wider | [M] | Light Security & Privacy `@ 499,203,562,40`: segments 142 / 146 / 134 / 134 px for label ink 91 / 99 / 88 / 86 px; Light Sound: 216 / 130 / 106 px for ink 158 / 82 / 59 px |
| Divider between unselected segments | 1 wide, full height inside the border | [M] | Light Sound row 196: x 900..901 `#e5e6e4`; Dark `#535455` |
| Divider next to the selected segment | none | [M] | Light Sound row 196: `#74a4f5 (sRGB #68a3fc)` ends x=769, white starts x=770 |
| Label baseline | 13.75 below the strip top (cap top 5 pt below strip top, cap height 9 pt) | [M] | Light Sound: caps y 203..220 for strip top 193 |
| Tab view inset from window edges | 20 left / right; strip top 20.5 below the toolbar; box top 30 below the toolbar | [M] | Light Sound: box x 152..1407 in a frame x 112..1447; strip y=193, box y=212, content starts y=152 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Selected: top edge | `#5b93f2 (sRGB #4c92f9)` (0.5 pt) | highlight `#6897e9 (sRGB #5c96f0)`, then `#3773df (sRGB #2371e7)` | [M] | Sound col 660 y 193 (light), y 194..195 (dark) |
| Selected: fill gradient | 0% `#77a5f5 (sRGB #6ca4fc)`, 25% `#699cf5 (sRGB #5c9bfc)`, 50% `#4e8af5 (sRGB #3d88fd)`, 75% `#367af6 (sRGB #1d78ff)`, 100% `#286ef6 (sRGB #076bff)` | 0% `#2e6cde (sRGB #176ae6)`, 50% `#2c66d4 (sRGB #1864dc)`, 100% `#2961c7 (sRGB #145fce)` | [M] | Sound col 660 y 194..231 (light), 196..231 (dark) |
| Selected: bottom edge | `#2066f6 (sRGB #0062ff)` (0.5 pt) | none; shadow `#282829` below | [M] | Sound col 660 y=232 |
| Selected: label | `#ffffff` | `#e0e8fa (sRGB #dee8fc)` = white @ 0.85 | [M] / [C] | Sound `@ 582,200,150,26` |
| Unselected: top / bottom edge | `#c7c7c7` / `#a7a7a7` (0.5 pt each); right end `#d1d1d1` | highlight row `#828283`, then `#68696a`; no bottom edge | [M] | Sound col 771 / 840 y 193, 232; row 196 x=1007 |
| Unselected: fill | `#ffffff` | `#636465` flat | [M] | Sound col 771 y 194..231 (light), 196..231 (dark) |
| Unselected: label | `#262626` = black @ 0.85 | `#e8e8e8` = white @ 0.85 | [M] / [C] | Sound `@ 793,200,80,26` |
| Divider | `#e5e5e5` | `#535455` | [M] | Sound row 196 x 900..901 |
| Outer ring (dark) | - | `#2b2c2d` 0.5 pt around the strip, top `#28292a` | [M] | Dark Sound col 771 y=193, 232 |
| Shadow under the strip | `#c8c8c8`, `#dadada` on `#e3e3e3` = `0 0.5px 1px rgba(0,0,0,0.14)` | `#282829`, `#303030`, `#343435` on `#363637` = `0 0.5px 1px rgba(0,0,0,0.25)` | [M] / [C] | Sound col 660 y 233..234 |
| Content box | see `box` | see `box` | - | - |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Label font | SF Pro Text 13 pt regular, centred in the segment | same | [C] | cap height 18 px, Light Sound `@ 924,196,60,34` |

### Shadows and effects
Only the 1 pt shadow under the strip listed above.

## Layout and spacing
- First control row inside the box starts about 29 pt below the box top (19 pt below the strip bottom). [M] Light Sound: "Select an alert sound:" cap top y=272, box top 212, strip bottom 232.
- Box inner padding: 20 pt left / right to labels in most panes. [M] Light Sound: text x=199 for box x=152 -> 23.5 pt; Trackpad 20 pt.
- Controls that apply to the whole window (help button, Bluetooth set-up button, lock) sit below the box, 15 pt below its bottom edge. [M] Light Trackpad: box bottom border y=994, button top y=1025.

## Keyboard and accessibility
Control-Tab / Control-Shift-Tab cycle tabs; with Full Keyboard Access the strip takes focus and the arrow keys move the selection. Role `AXTabGroup` containing `AXRadioButton` tabs. ARIA: `role="tablist"` with `role="tab"` (`aria-selected`) and `role="tabpanel"`. [D]

## Browser notes
Reproducible with flex segments and gradients. The strip overlaps the box border, so position it absolutely (`top: -10px`) or give the box `margin-top: 10px`. Half-point edges as `box-shadow: inset 0 0.5px ...`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Sound.png | 152,193,1256,707 | three tabs, first selected, with content box |
| light | 10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png | 499,203,562,40 | four tabs |
| light | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png | 601,313,360,40 | two tabs, last selected |
| light | 10-15-Catalina-Light-Network-Utility.png | 112,140,1288,60 | eight tabs in a utility window |
| dark | 10-15-Catalina-Dark-System-Preferences-Sound.png | 152,193,1256,707 | three tabs, first selected |
| dark | 10-15-Catalina-Dark-System-Preferences-Security-and-Privacy.png | 499,203,562,40 | four tabs |

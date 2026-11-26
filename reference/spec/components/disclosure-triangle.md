# Disclosure Triangle (`disclosure-triangle`)

- **Status:** present
- **AppKit:** `NSButton` with `bezelStyle = .disclosure` (`NSDisclosureBezelStyle`), `setButtonType(.onOff)`; in `NSOutlineView` the built-in disclosure button (`NSOutlineView.disclosureButtonIdentifier`)
- **HIG:** https://web.archive.org/web/20200503161554/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/disclosure-controls/
- **Appearances shown:** light, dark

Short file names: `L-DSS` / `D-DSS` = `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png` / Dark.

## Purpose and behaviour
A disclosure triangle reveals and hides content associated with a view or an item in a list of disclosable items. It points right when the content is hidden and down when it is visible; clicking toggles it and the parent view expands or collapses. In a dialog, give it a descriptive label and consider changing the label with the state ("Show advanced options" / "Hide advanced options"). The Finder uses disclosure triangles in list view to reveal hierarchy. [D] (HIG, Disclosure Controls)

Option-click expands or collapses all descendants in an outline. The rotation animates (about 0.1 s) in AppKit. [D]

## Anatomy
A single solid triangle, no bezel. Collapsed: apex pointing right. Expanded: the same triangle rotated 90 degrees clockwise, apex pointing down.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| state | collapsed, expanded | collapsed | `state` off / on | both |
| context | outline row; section header (Finder Get Info) | - | - | outline here; section headers in `inspector-panel` |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| collapsed | yes, light + dark | `L-DSS @ 194,618,18,20`; `D-DSS @ 194,618,18,20` |
| expanded | yes, light + dark | `L-DSS @ 192,498,20,20`; `D-DSS @ 192,498,20,20` |
| pressed | not shown | [I] the triangle darkens to the label colour while the mouse is down |
| in a selected (emphasized) row | not shown here | [I] white, like the row's text |
| disabled | not shown | [I] 0.5 alpha |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Expanded triangle | 9 wide x 7.5 high (18 x 15 px), flat edge on top, apex at the bottom centre | [M] | `L-DSS @ 193,501,18,15`: top row y=501 spans x 193..210, apex row y=515 at x 201..202 |
| Collapsed triangle | 7.5 wide x 9 high (15 x 18 px), flat edge on the left, apex at the right middle | [M] | `L-DSS @ 195,619,15,18`: left column x=195 spans y 619..636, apex x 208..209 at y 627..628 |
| Path, expanded (pt, origin = top-left of the 9 x 7.5 box) | `M 0 0 H 9 L 4.5 7.5 Z` | [C] | from the mask below |
| Path, collapsed (origin = top-left of the 7.5 x 9 box) | `M 0 0 L 7.5 4.5 L 0 9 Z` | [C] | from the mask below |
| Position in an outline row | triangle box starts 8.5 from the outline's left edge (row level 0); the row text starts 13 after the triangle's left edge | [M] | `L-DSS`: outline frame x=176, expanded triangle x=193, text ink x=219 (row y=508); collapsed triangle x=195, text ink x=218 (row y=628) |
| Vertical position | centred on the row's text; rows are 20 pt apart | [M] | `L-DSS`: rows at y=508 and y=628 are three rows apart (40 px per row); expanded triangle rows y 501..515 lie inside the row's text rows y 498..520 (triangle + `Apple` blob `@ 193,498,87,23`) |

Coverage masks (hex digit = coverage, one character per device pixel) [M].
Expanded, origin `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 193,501`, 18 x 15:
```
affffffffffffffffa
2effffffffffffffe2
07ffffffffffffff70
00dffffffffffffd00
004ffffffffffff400
000affffffffffa000
0002fffffffffe2000
00007ffffffff70000
00000dffffffd00000
000004ffffff400000
000000affffa000000
0000002effe2000000
00000008ff70000000
00000000dd00000000
000000004500000000
```
Collapsed, origin `@ 195,619`, 15 x 18:
```
a20000000000000
fe7100000000000
fffd40000000000
fffffa200000000
ffffffe70000000
ffffffffd400000
ffffffffffa2000
fffffffffffe810
fffffffffffffd4
fffffffffffffd4
fffffffffffe810
ffffffffffa2000
ffffffffd400000
ffffffe81000000
fffffa200000000
fffd40000000000
fe7000000000000
a20000000000000
```

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Triangle, normal (on a white / dark list background) | `#808080` (`rgba(0,0,0,0.50)` on white) | `#99999a` on `#1d1e1f` (`rgba(255,255,255,0.55)`) | [M], [C] | `L-DSS @ 201,508`; `D-DSS @ 201,505` |
| Triangle in Finder Get Info section headers (on window background) | `#8c8c8c` on `#ececec` | `#7c7c7c` | [M] by the dialogs group | see `inspector-panel` |

### Shadows and effects
None.

## Layout and spacing
- Outline rows: one triangle per expandable row, indented 8.5 pt at level 0 plus the outline's indentation per level (children in this outline have no triangle and start their icon 8 pt further right than the parent's text: `Desktop Pictures` icon x=235 vs parent text x=219). [M] `L-DSS` row y=585: icon starts x=235.
- Hit area: AppKit gives the outline disclosure button a 13 x 13 pt frame centred on the triangle. [D]

## Keyboard and accessibility
In an outline: Right Arrow expands the selected row, Left Arrow collapses it; Option-Right / Option-Left act recursively. Standalone: Space toggles. Role `AXDisclosureTriangle` with value 0 / 1. Web: `<button aria-expanded>` controlling the disclosed region, or `role="treeitem"` with `aria-expanded` in a tree. [D]

## Browser notes
Draw as an SVG path and rotate with `transform: rotate(90deg)` for the expanded state; the two measured boxes (9 x 7.5 and 7.5 x 9) are exactly that rotation.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png` | 192,498,20,20 | expanded, in an outline row |
| light | `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png` | 194,618,18,20 | collapsed |
| dark | `10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png` | 192,498,20,20 | expanded |
| dark | `10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png` | 194,618,18,20 | collapsed |

# Mac Catalyst segmented control (`catalyst-segmented-control`)

- **Status:** present
- **AppKit:** none: UIKit for Mac draws it (`UISegmentedControl` in its iOS 13 style). AppKit's own control is `NSSegmentedControl`, see `segmented-control`.
- **HIG:** https://web.archive.org/web/20200503185450/https://developer.apple.com/design/human-interface-guidelines/macos/selectors/segmented-controls/ (the macOS page; it does not describe the UIKit look)
- **Appearances shown:** light, dark
- **Provenance:** added on 2026-10-06 for the People and Devices switch of Find My, which the Find My demo had built from the map-type control of `map-controls`. `catalyst-chrome.md` listed the control as not seen with inferred values; the two Find My captures show it, and it is measured here. The map-type control over Find My's map is the same UIKit control at 22.25 pt and stays in `map-controls`.

## Purpose and behaviour
A set of two or more segments of equal width of which one is selected, in an iPad app that runs on the Mac. Find My's sidebar uses it to switch between People and Devices. The selected segment is a raised pill on a grey track; clicking another segment moves the pill there [I: the move is animated in UIKit; not shown].

## Anatomy
```
+--------------------------------------+   track, 24.5 pt tall, grey at 12% (24% dark)
| [   People   ]        Devices        |   pill 1.5 pt inside the track above and below,
+--------------------------------------+   2 pt from the segment's leading edge
```

## Variants and parameters
| Parameter | Values | Default | Shown in screenshots |
|---|---|---|---|
| segments | two or more titles | - | two (People, Devices) |
| selected segment | any one | - | the first |
| width | set by the layout; segments share it equally | - | 246.5 pt |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, first segment selected | yes | `10-15-Catalina-Light-Find-My.png @ 127,150,493,49`; `10-15-Catalina-Dark-Find-My.png @ 83,126,493,49` |
| another segment selected | no | [I] the same pill in that segment |
| pressed | no | [I] no change until the selection moves |
| disabled | no | [I] title at 30% |
| focused (full keyboard access) | no | [I] focus ring inside the selected segment, see `focus-ring` |
| inactive window | yes (dark) | the Dark Aqua capture's window is not key: the control is unchanged |

## Measurements
Evidence shorthand: `Light` before `@`, `row y=` or `col x=` means `10-15-Catalina-Light-Find-My.png`, `Dark` the dark file. The window's origin is image px (112, 76) in the light file and (68, 52) in the dark one; geometry is in pt from the window's top-left corner.

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Track | x 7.5..254, y 37..61.5: 246.5 x 24.5 | [M] | Light row y=174: x=127..619; col x=492: y=150..198. Dark row y=150: x=83..575 |
| Track corner radius | 7 | [I] | UIKit's 9 pt x 0.77; the corner pixels agree with it in the component's comparison |
| Pill (selected segment) | x 9.5..128.5, y 38.5..60: 119 x 21.5 | [M] | Light row y=174: x=131..368; col x=232: y=153..195. Dark row y=150: x=87..325 |
| Pill inset in its segment | 2 leading, 2.25 trailing (the segment is 123.25 wide: 2 + 119 + 2.25), 1.5 above and below | [C] | from the two rows above |
| Pill corner radius | 5.5 | [I] | the track's radius less the inset |
| Title | capitals 7.5 high, centred on the segment in both directions | [M] | Light: "People" x=219..281, y=167..181; "Devices" x=462..532 |
| Title size and weight | 10.5 pt Medium | [C] | capitals 7.5 pt / 0.705; stems 1.15 pt, Light row y=174 @ 219 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Sidebar behind the control | `#f8f7f5` | `#1f2021` | [M] | Light `@ 627,174`; Dark `@ 583,150` |
| Track | `#e8e7e5` | `#343438` | [M] | Light `@ 607,174`; Dark `@ 563,150` |
| Track, as a recipe | `rgba(118,118,128,0.12)` over the sidebar | `rgba(118,118,128,0.24)` | [C] | gives `#e8e7e5` and `#343439` over the two fills |
| Pill | `#ffffff` | `#6b6b72` | [M] | Light `@ 232,170`; Dark `@ 188,146` |
| Track under the pill (its shadow) | `#d6d6d5`, `#d4d4d3`, `#d4d4d3` to the track's edge | `#3b3c40` (edge), then the track | [M] | Light col x=232: y=196..198; Dark col x=188: y=172..174 |
| Track after the pill | `#e0dedd`, `#dddbd8`, `#e0dedb`, `#e3e1de`, `#e3e1df`, `#e5e3e0`, `#e7e5e2`, then the track | the track | [M] | Light row y=174: x=369..375; Dark row y=150: x=325..326 |
| Track above the pill | `#e5e5e4`, `#e5e5e4`, `#e2e2e1` | the track | [M] | Light col x=232: y=150..152; Dark col x=188: y=126..128 |
| Shadow, fitted CSS | `0 2px 3px rgba(0,0,0,.10), 0 0 1px rgba(0,0,0,.04)`, clipped by the track | none | [C] | the three rows above |
| Title | `#000000` | `#e9eaea` | [M] | Light `@ 220,171`; Dark `@ 188,150` |
| Divider between two unselected segments | black at 11% | white at 13% | [M] | measured on the map-type control of the same captures, `map-controls.md` |

## Layout and spacing
- In Find My the track starts 7.5 pt from the window's leading edge and ends 8 pt before the sidebar's line; its top is 37 pt under the window's top edge, 15 pt under the strip that holds the window controls.
- Segments share the track's width equally.

## Keyboard and accessibility
`AXRadioGroup` of `AXRadioButton`s [I]. ARIA: `radiogroup` named by the app, each segment a `radio`; one tab stop, arrow keys move the selection.

## Browser notes
- The pill's shadow is clipped by the track (`overflow: clip`), as in the captures, so the focus ring is drawn inside the segment.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Find-My.png` | 114,136,520,80 | the switch on the sidebar, People selected |
| dark | `10-15-Catalina-Dark-Find-My.png` | 70,112,520,80 | the same, dark, window not key |

# Separator (`separator`)

- **Status:** present
- **AppKit:** `NSBox` with `boxType = .separator` (horizontal or vertical); colour `NSColor.separatorColor`
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/boxes/
- **Appearances shown:** light, dark

## Purpose and behaviour
A thin line that divides groups of controls inside a pane without enclosing them. It is not interactive. The HIG covers it only implicitly (boxes; "add extra padding to separate groups"). [D]

## Anatomy
A single flat line of translucent black (light) or white (dark), 1 pt thick.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| orientation | horizontal, vertical | horizontal | frame shape | horizontal; vertical only as the region edge described in `box` |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 198,694,1164,2`; Dark same |
| inactive window | not shown | [I] unchanged |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Thickness | 1 (2 device pixels) | [M] | Light Security & Privacy col 600: y 694..695; Light Trackpad col 400: y 608..609 and 781..782; Light Time Machine col 1000: y 206..207 and 524..525 |
| Ends | square | [M] | Light Security & Privacy row 694: starts x=198, ends x=1361 with no blended pixel |
| Lengths seen | 582 (Security & Privacy), 287 (Trackpad), 415 (Time Machine), 148 (Screen Time sidebar) | [M] | rows cited above; `10-15-Catalina-Light-System-Preferences-Screen-Time.png` row 726: x 142..437 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Line on a box (`#e3e3e3` / `#363637`) | `#cdcdcd` | `#4a4a4b` | [M] | Security & Privacy `@ 600,694` |
| Line on the window background (`#ececec` / `#2f3031`) | `#d5d5d5` | `#434445` | [M] | Screen Time `@ 300,726` |
| As a translucent colour | `rgba(0,0,0,0.10)` | `rgba(255,255,255,0.10)` | [C] | both composites above give 0.097..0.100 |
| Hairline at the bottom of some panes (above the lock / button row) | `#dddddd` 0.5..1 pt | not resolved | [M] | `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 156,1080,1248,2` (this is the bottom border of the box, listed here because it reads as a separator) |

### Text and icons
None.

### Shadows and effects
None.

## Layout and spacing
| Pane | Space above (to previous ink) | Space below (to next ink) | Tag | Evidence |
|---|---|---|---|---|
| Trackpad, above the sliders | 31.5 pt | 13 pt to the slider titles | [M] | Light Trackpad: last text ends y=544, line y 608..609, next caps 636 |
| Security & Privacy | - | 19 pt to "Allow apps downloaded from:" | [M] | line y=694, caps 734 |
| Time Machine | first line 27 pt below the toolbar | second line 21 pt above "Time Machine keeps:" | [M] | lines y=206 and 524 (toolbar ends y=152); caps 568 |
Separators are inset from the box edges: 23 pt (Security & Privacy), 19 pt (Trackpad, left column only), 14 pt (Time Machine). [M]

## Keyboard and accessibility
Not focusable; hidden from accessibility unless it carries meaning. ARIA: `<hr>` or `role="separator"`. [D]

## Browser notes
`height: 1px; background: rgba(0,0,0,0.1)`; never `border-top: 0.5px`, the line really is two device pixels at 2x.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png | 198,694,1164,2 | long separator inside a box |
| light | 10-15-Catalina-Light-System-Preferences-Trackpad.png | 190,608,574,2 | separator above slider group |
| light | 10-15-Catalina-Light-System-Preferences-Screen-Time.png | 142,726,296,2 | separator on the window background |
| dark | 10-15-Catalina-Dark-System-Preferences-Security-and-Privacy.png | 198,694,1164,2 | long separator |
| dark | 10-15-Catalina-Dark-System-Preferences-Screen-Time.png | 142,726,296,2 | separator on the window background |

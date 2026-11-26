# Help Button (`help-button`)

- **Status:** present
- **AppKit:** `NSButton`, `bezelStyle = .helpButton` (`NSHelpButtonBezelStyle`), no title
- **HIG:** https://web.archive.org/web/20200503175357/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/help-buttons/
- **Appearances shown:** light, dark

Short file names: `L-SP-<Pane>` = `10-15-Catalina-Light-System-Preferences-<Pane>.png`, `D-SP-<Pane>` = the Dark file.

## Purpose and behaviour
A help button opens app-specific help for the current context (for a pane, the help topic of that pane; otherwise the top level of the app's help). It is always the same circular button with a question mark, has no label, and at most one appears per window. Position: lower-left corner, vertically aligned with the dismissal buttons, in a dialog that has OK/Cancel; lower-left or lower-right corner in a dialog without dismissal buttons and in preference panes. It is used in views, never in toolbars or status bars. [D] (HIG, Help Buttons)

## Anatomy
Back to front: halo ring and two shadow rows (same recipe as `push-button`), 0.5 pt circular edge, flat fill (dark: with a top highlight), centred question mark glyph.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| size | one size (AppKit ignores `controlSize` for this bezel in 10.15) | 20 pt circle | - | yes |
| enabled | true, false | true | `isEnabled` | enabled only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes, light + dark | `L-SP-Bluetooth @ 1372,858,42,43`; `D-SP-Bluetooth @ 1372,858,42,43`; 15 more panes in each appearance (see Evidence) |
| pressed | not shown | [I] light: fill `#f0f0f0`; dark: fill `rgba(255,255,255,0.36)`. This is the shared `--mac-bezel-fill-pressed` of the token sheet, the one value to build with for the non-accent rounded bezels (help, round and disclosure buttons). No screenshot shows a pressed help button, so it is inferred, and no pixel evidence favours it over this row's earlier inference, about `#e5e5e5` (black 0.10 over white) in light and `rgba(255,255,255,0.35)` in dark, which it supersedes since 3 October 2026: the page and the token sheet disagreed, both by inference, and the page now follows the value that is built. The help button never takes the accent colour |
| disabled | not shown | [I] `push-button` disabled recipe: fill `rgba(255,255,255,.5)` / `rgba(255,255,255,.125)`, glyph at 0.25 alpha |
| focused | not shown | [I] circular `focus-ring`, 3 pt |
| inactive window | not shown | [I] unchanged |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Diameter (edge to edge) | 20 | [M] | `L-SP-Bluetooth` row y=879: edge `#c3c3c3` at x=1373 and x=1412 (40 px); col x=1393: edge `#cacaca` y=859, edge `#b0b0b0` y=898 |
| Painted size including halo and shadow rows | 21 x 21.5 | [M] | same row and column: halo `#e6e6e6` x=1372 / 1413, y=858; shadow rows y=899 `#d2d2d2`, y=900 `#e4e4e4` |
| Edge width | 0.5 | [M] | row y=879: `#c3c3c3` x1 then `#fdfdfd`, `#ffffff` |
| Glyph ink bounds, relative to the circle's top-left edge corner | x 7.0..13.5, y 4.5..15.5 (13 x 22 px) | [M] | `L-SP-Bluetooth @ 1387,868,13,22`: ink columns x 1387..1399, rows y 868..889 (dot rows 886..889) |
| Glyph | question mark, SF Pro Text Medium, 13 pt [C]: cap-height-tall bowl 15 px + 3 px gap + 4 px dot; stem 3 px (1.5 pt) | [C] | stroke width from mask row 880: `4ff7` = 3 px |
| Glyph centring | horizontally centred on x = 10 pt (ink centre 1393.0 vs circle centre 1392.5); optical vertical centre 0 | [M] | same crop |

Glyph coverage mask (hex digit 0..f = 0..100 %, one character per device pixel), origin `10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 1386,868`, 15 columns x 22 rows [M]:
```
0000279a9510000
0019ffffffe6000
00bffea9cfff700
06ffa10004eff20
0cfd0000007ff60
0ef80000003ff80
00000000004ff70
00000000009ff40
0000000007ffc00
00000002bffd200
0000003effa1000
000000dff600000
000004ff7000000
000006ff3000000
000007ff2000000
000000110000000
000000000000000
000000000000000
000006ef6000000
00000effe000000
00000effe000000
000005ee6000000
```

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill | `#ffffff` | `#646465` on `#303031` = `rgba(255,255,255,0.25)` | [M], [C] | `L-SP-Bluetooth @ 1380,879`; `D-SP-Bluetooth @ 1380,879` |
| Top highlight (dark) | none | row 1 `#818182`, row 2 `#6a6a6b` | [M] | `D-SP-Bluetooth` col x=1393: y=860, 861 |
| Edge, top / side / bottom | `#cacaca` / `#c3c3c3` / `#b0b0b0` on `#ececec` (black 0.144 / 0.174 / 0.254) | `#2c2c2d` / `#2b2b2b` / `#262627` on `#303031` | [M] | `L-SP-Bluetooth @ 1393,859`, `@ 1373,879`, `@ 1393,898`; `D-SP-Bluetooth @ 1393,859`, `@ 1373,879`, `@ 1393,898` |
| Glyph | `#262626` = `rgba(0,0,0,0.85)` on white | `#e7e7e7` on `#646465` = `rgba(255,255,255,0.85)` | [M], [C] | `L-SP-Bluetooth @ 1393,879`; `D-SP-Bluetooth @ 1393,879` |

### Shadows and effects
Halo `#e6e6e6` (light) / `#2f2f30` (dark) 0.5 pt around; shadow rows `#d2d2d2`, `#e4e4e4` (light) and `#2b2b2c`, `#2e2e2f` (dark) under the bottom edge. [M] `L-SP-Bluetooth` col x=1393 y 858, 899, 900; `D-SP-Bluetooth` col x=1393 y 858, 899, 900. Use the `push-button` fitted `box-shadow` with `border-radius: 50%`. [C]

## Layout and spacing
| Rule | Value (pt) | Tag | Evidence |
|---|---|---|---|
| Position in a preference pane, lower right: circle edge to window right edge | 15.5 to 23.5 (20.5 most often) | [M] | `L-SP-Bluetooth`: right edge x=1412, frame right 1447 (17.5); `L-SP-General`: x 1367..1406 (20.5); `L-SP-Mouse`: 1377..1416 (15.5); `L-SP-Keyboard`: 1361..1400 (23.5) |
| Bottom edge to window bottom edge | 20.5 typical | [M] | `L-SP-Bluetooth`: bottom edge y=898, frame bottom 939 |
| Gap to a push button on its left | 13 | [M] | `L-SP-Bluetooth` row y=879: button edge x=1346, help edge x=1373 |
| Lower-left placement | 20.5 from the left and bottom edges | [M] | `L-SP-Family-Sharing @ 152,650,42,43`: edge x=153, frame left 112; bottom edge y=690, frame bottom 731 |
| Vertical alignment with a push button on the same row | same top and bottom edges (both 20 pt) | [M] | `L-SP-Bluetooth`: both y 859..898 |

## Keyboard and accessibility
Space activates it when focused (Full Keyboard Access). The Help key / Command-? opens the Help menu instead. AppKit role `AXButton`, subrole none, description "help". Web: `<button aria-label="Help">`. [D]

## Browser notes
Draw the question mark as an inline SVG or as text in a font with SF-like metrics; the exact glyph shape above is SF Pro's and cannot be reproduced with a fallback font. A `13px` `font-weight: 500` `?` in `-apple-system` on macOS matches.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-System-Preferences-Bluetooth.png` | 1372,858,42,43 | on window background `#ececec`, next to a push button |
| light | `10-15-Catalina-Light-System-Preferences-General.png` | 1366,1358,42,43 | lower-right of a pane |
| light | `10-15-Catalina-Light-System-Preferences-Family-Sharing.png` | 152,650,42,43 | lower-left placement |
| light | `10-15-Catalina-Light-System-Preferences-Internet-Accounts.png` | 1336,936,42,43 | inside a box (`#e3e3e3`) |
| dark | `10-15-Catalina-Dark-System-Preferences-Bluetooth.png` | 1372,858,42,43 | on `#303031` |
| dark | `10-15-Catalina-Dark-System-Preferences-General.png` | 1366,1358,42,43 | lower-right of a pane |
| dark | `10-15-Catalina-Dark-System-Preferences-Family-Sharing.png` | 152,650,42,43 | lower-left placement |

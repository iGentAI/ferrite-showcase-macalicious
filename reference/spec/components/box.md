# Box (`box`)

- **Status:** present
- **AppKit:** `NSBox` (`boxType = .primary`, `titlePosition`, `borderType`); the same surface is drawn by `NSTabView` for its content area and by System Preferences for its recessed detail regions
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/boxes/
- **Appearances shown:** light, dark

## Purpose and behaviour
A box groups related controls. By default it has a border and a title; either can be turned off, and the title can sit above (default) or below the box. Do not nest boxes; use sentence-style capitalisation for titles and no trailing colon. [D] (HIG, Boxes)

## Anatomy
1. Fill: the window background darkened (light) or lightened (dark) by about 4 %.
2. Border: hairline, stronger along the top edge, with a second softer line inside it.
3. Optional title: small text above the top-left corner.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| title | none, above, below | above | `titlePosition`, `title` | none (preference panes); above (Network Utility "Interface Information") |
| edges | all four (rounded); top and bottom only (full-bleed band); leading only (detail region filling the rest of the window) | all four | - | all three |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Sound.png @ 152,212,1256,688`; Dark same |
| full-bleed band | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Sharing.png @ 112,344,1336,646`; Dark same |
| leading-edge region | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Time-Machine.png @ 570,152,878,804`; Dark same |
| inactive window | not shown in my screenshots | [I] unchanged (a box has no key-window dependence) |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Border width | 0.5 outer line + 0.5 softer inner line | [M] | Light Sound row 500: x=152 `#dedede`, x=153 `#e1e1e1`, then fill |
| Corner radius | Fitted: 3.875 in light, 4 in dark, on the outer edge of the border, all four corners. Least-squares fit with `tools/corner_fit.py`: light best 3.875 at every corner (top corners rms 0.86 levels at 3.875, 0.88 at 3.75, 0.99 at 4, 1.34 at 3.5, 2.55 at 3, 3.39 at 2.5; bottom corners rms 0.48 to 0.53 at 3.875 and at 4); dark best 4 at every corner (rms 0.46 to 0.52 at 4, 1.28 to 1.41 at 3.75 and at 4.25, 5.4 to 5.6 at 2.5). The earlier value of 2.5 misread the grid: it took x=157, where the top border is still blended, as the end of the arc, and the border reaches its straight colour at x=159 | [C] fit from [M] pixels | `10-15-Catalina-Light-System-Preferences-Sound.png @ 150,210,14,14`; `10-15-Catalina-Dark-System-Preferences-Sound.png @ 150,210,14,14`; the other corners of both captures `@ 1396,210,14,14`, `@ 150,888,14,14`, `@ 1396,888,14,14` |
| Corner radius to build with | 4 in both appearances. In dark this is the fitted value. In light it is the fitted 3.875 rounded up by an eighth of a point: a rounded value, not a measurement (in light 4 fits the top corners at rms 0.99 against 0.86 at 3.875, and the bottom corners equally well). Until 3 October 2026 the row above led with "4" tagged [C] for both appearances | [C] dark; [I] light, rounded | the row above; `tokens.md`, `--mac-radius-group` |
| Title (when present) | 13 pt text above the box; ink starts 12 pt right of the box's left edge; text bottom (baseline) 3 pt above the box top | [M] | `10-15-Catalina-Light-Network-Utility.png`: title ink x=196, rows y 344..363; box left x=172, box top y=370 |
| Typical inset from window edges | 20 | [M] | Light Sound box x 152..1407 in frame x 112..1447 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Window background outside | `#ececec` | `#2f3031` (`#303031` in some panes) | [M] | Sound `@ 140,500` |
| Fill | `#e3e3e3` = `rgba(0,0,0,0.04)` over the window | `#363637` = `rgba(255,255,255,0.035)` over the window | [M] / [C] | Sound `@ 300,500` |
| Border, top | `#d3d3d3`..`#d4d4d4` = `rgba(0,0,0,0.10)`; inner line `#e0e0e0` | `#4e4f50` = `rgba(255,255,255,0.15)`; inner line `#404142` | [M] / [C] | Sound col 300 y 212..213; row 212 x 159..170 |
| Border, sides and bottom | `#dedede` = `rgba(0,0,0,0.06)`; inner line `#e0e0e0`..`#e1e1e1` | `#4e4f50`; inner line `#404142` | [M] / [C] | Sound row 500 x 152..153 and 1406..1407; col 300 y 898..899 |
| Full-bleed band (Sharing) | top `#d3d3d3` then `#e0e0e0`, bottom `#dedede`, fill `#e3e3e3` | top `#4e4f50` then `#404142`, bottom `#4e4f50`, fill `#353637`..`#363637` | [M] | Sharing col 600 y 344..345 and 988..989 |
| Leading-edge region (Time Machine, Siri, Software Update, Touch ID) | edge `#dedede`, then `#e1e1e1`, fill `#e3e3e3` | edge `#4f4f50`, then `#414142`, fill `#363637` | [M] | Time Machine row 600 x 570..572 |
| Titled box inside a `#e3e3e3` window (Network Utility) | fill `#dadada`, top `#cbcbcb` then `#d8d8d8`, sides `#d6d6d6` then `#d8d8d8` | fill `#3c3c3e`, top and sides `#545456` then `#474748` | [M] | 10-15-Catalina-Light-Network-Utility.png @ 172,500,6,1; 10-15-Catalina-Light-Network-Utility.png @ 400,370,1,3; 10-15-Catalina-Dark-Network-Utility.png @ 172,500,6,1; 10-15-Catalina-Dark-Network-Utility.png @ 400,370,1,3 |
| White content box (Screen Time) | fill `#ffffff`, border `#c0c0c0` 1 pt, square corners | fill `#1d1e1f`, border `#555656` 1 pt | [M] | `10-15-Catalina-Light-System-Preferences-Screen-Time.png` row 400 x 504..505; col 700 y 192..193 and 1178..1179; Dark same |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title | SF Pro Text 13 pt regular, `#232323` on `#e3e3e3` = `rgba(0,0,0,0.85)` | `#e0e0e1` on `#363638` (white @ 0.846) | [M] colours; [C] alpha | darkest/lightest ink in 10-15-Catalina-Light-Network-Utility.png @ 180,340,300,32; 10-15-Catalina-Dark-Network-Utility.png @ 180,340,300,32; (224 - 54)/(255 - 54) |

### Shadows and effects
None. The darker top border reads as a faint inner shadow; there is no blur.

## Layout and spacing
Controls inside start 20 pt from the left edge and about 19..30 pt below the top edge. Boxes are separated from following window-level controls by 13..20 pt. [M] (see the pane blueprints)

## Keyboard and accessibility
Not focusable. Role `AXGroup` with the title as its label. ARIA: `role="group"` with `aria-labelledby`, or `<fieldset>` and `<legend>`. [D]

## Browser notes
Use the rgba fills so that the box composes correctly over any window background. The two-line border is `border: 0.5px solid` plus `box-shadow: inset 0 0 0 0.5px` at a lower alpha; the top edge needs its own colour (`border-top-color`).

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Sound.png | 152,212,1256,688 | tab view content box |
| light | 10-15-Catalina-Light-System-Preferences-Network.png | 508,274,900,800 | plain box without tabs |
| light | 10-15-Catalina-Light-System-Preferences-Sharing.png | 112,344,1336,646 | full-bleed band |
| light | 10-15-Catalina-Light-System-Preferences-Time-Machine.png | 570,152,878,804 | leading-edge region |
| dark | 10-15-Catalina-Dark-System-Preferences-Sound.png | 152,212,1256,688 | tab view content box |
| dark | 10-15-Catalina-Dark-System-Preferences-Sharing.png | 112,344,1336,646 | full-bleed band |

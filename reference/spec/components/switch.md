# Switch (`switch`)

- **Status:** present only in Notification Center's Do Not Disturb row (off state, on a vibrant panel). No `NSSwitch` appears in any System Preferences pane or app window of the library: Catalina's own panes still use checkboxes. The Notifications pane contains a small illustration of this switch inside its Do Not Disturb artwork (`10-15-Catalina-Light-System-Preferences-Notifications.png @ 1163,333,204,120`), which is an image, not a control.
- **AppKit:** `NSSwitch` (macOS 10.15+; `state`, `controlSize`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/switches/
- **Appearances shown:** light, dark (off only)

## Purpose and behaviour
A visual toggle between two mutually exclusive states. It is on when the accent colour is visible and off when it appears colourless. Use it in a view, not a window frame; it has more visual weight than a checkbox, so use it for a group of settings rather than a minor detail, and do not replace existing checkboxes with switches. [D] (HIG, Switches)

Clicking anywhere toggles; the knob can also be dragged; the knob slides in about 0.2 s. [D] / [I]

## Anatomy
1. Track: a capsule 38 x 21 pt.
2. Knob: a 20 pt white disc at the leading end (off) or trailing end (on).

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| state | off, on | off | `state` | off |
| controlSize | regular (small and mini were added only in macOS 11) | regular | `controlSize` | regular |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| off | yes, light + dark | `10-15-Catalina-Light-Notification-Center-Today.png @ 3242,187,76,42`; `10-15-Catalina-Dark-Notification-Center-Today.png @ 3242,187,76,42` |
| on | not shown | [D] track filled with the accent colour (HIG); values below [I] |
| pressed, disabled, focused | not shown | [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Track size | 38 x 21 | [M] | Light Notification Center Today row 206: x 3242..3317; col 3300: y 187..228 |
| Track radius | 10.5 (capsule), half the 21 pt height. Not fitted, in either appearance: the track lies on the Notification Center material, which is not flat (along row 185 the pane's blue channel rises by 10 levels across the track's width), and `tools/corner_fit.py` models a flat background. Two trial fits on the light capture returned 10.375 at the right end and 10.625 at the left end, under the knob; they break that rule, so they are invalid and neither confirm nor refine the value. Treat the radius as good to about 1 pt, like the other radii on a translucent material | [C], not fitted | half the height; trial-fit corners, for the record only: `10-15-Catalina-Light-Notification-Center-Today.png @ 3294,185,26,26` and `@ 3240,185,26,26`; pane row `@ 3236,185,88,1` |
| Knob diameter | 20 (outline to outline), flush with the track's left, top and bottom | [M] | Light row 206: x 3243..3282; col 3262: y 188..227 |
| Knob travel | 18 (track width - knob diameter) | [C] | - |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Track, off (composited on the Notification Center material) | `#d7e5ec (sRGB #d4e5ed)`..`#d7e5ef (sRGB #d4e5f0)` on a panel of `#e4f4ff (sRGB #e1f4ff)`..`#e7f2f8 (sRGB #e5f2f9)` = about `rgba(0,0,0,0.06)` | `#393f49 (sRGB #383f4a)`..`#363d49 (sRGB #353d4a)` on `#232c3c (sRGB #212c3d)`..`#31363c (sRGB #30363d)` = about `rgba(255,255,255,0.09)` | [M] / [C] | row 206 x 3284..3315 (light, dark) |
| Track edge, off | top `#cad8df (sRGB #c7d8e0)` (1 pt, an inner shadow), right end `#cddbe5 (sRGB #cadbe6)` | top `#4a5059 (sRGB #49505a)`, right end `#515864 (sRGB #505865)` (lighter rim) | [M] | col 3300 y 187..188; row 206 x 3316..3317 |
| Knob fill | `#ffffff` | `#cfd0d2` | [M] | row 206 x 3245..3280 |
| Knob outline | `#b4bbbf (sRGB #b3bbc0)` (0.5 pt), bottom `#a2aab0 (sRGB #a0aab1)` | `#44484d (sRGB #43484e)`; top `#d4d5d6` highlight inside | [M] | row 206 x=3243; col 3262 y 188, 227 |
| Track, on | accent: `#4d8af5 (sRGB #3b89fd)`-class blue flat (the checkbox on fill) | `#2e6bde (sRGB #1869e6)` -> `#285fc6 (sRGB #145dcd)`-class | [I] | not shown; uses the measured `checkbox` on fills so the two controls match |
| Opaque off-track recommendation for windows | `rgba(0,0,0,0.09)` over the window background | `rgba(255,255,255,0.10)` | [I] | the measured values are on a vibrant material |

### Text and icons
None. A switch has no title of its own; a label sits beside it.

### Shadows and effects
Knob shadow: one darker pixel row under the knob (`#bec8ce (sRGB #bcc8cf)` light, `#50545b (sRGB #4f545c)` dark) = `0 0.5px 1px rgba(0,0,0,0.15)` [C] from col 3262 y=228.

## Layout and spacing
In Notification Center the switch is right-aligned, 10 pt from the card's right outer edge [C]: the track ends x=3317 and the card edge is x=3337, measured on `10-15-Catalina-Light-Notification-Center-Today.png @ 3230,207,112,1`.

## Keyboard and accessibility
Space toggles when focused (Full Keyboard Access). Role `AXCheckBox` with subrole `AXSwitch`. ARIA: `role="switch"` with `aria-checked`. [D]

## Browser notes
Reproducible: a 38 x 21 capsule with a 20 px knob and a `transform: translateX(18px)` transition. Because the only sample is on a vibrant panel, verify the off-track colour against the lead's material tokens before using it on opaque windows.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Notification-Center-Today.png | 3220,170,110,70 | Do Not Disturb switch, off |
| dark | 10-15-Catalina-Dark-Notification-Center-Today.png | 3220,170,110,70 | Do Not Disturb switch, off |

# Focus Ring (`focus-ring`)

- **Status:** present
- **AppKit:** `NSView.focusRingType` (`.default`, `.none`, `.exterior`), `drawFocusRingMask()`, `focusRingMaskBounds`; colour `NSColor.keyboardFocusIndicatorColor`
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/user-interaction/keyboard/
- **Appearances shown:** light, dark (blue accent; other accents in `accent-colors`)

## Purpose and behaviour
The ring marks the control that will receive keyboard input. Text fields, search fields and combo boxes show it whenever they are first responder; buttons, checkboxes, sliders and lists show it only when Full Keyboard Access is on (Tab moves between all controls). The ring follows the control's outline, is drawn outside its bounds, and animates in from a larger, fainter ring. [D] (HIG, Keyboard: full keyboard access mode)

## Anatomy
A flat, uniformly translucent band that hugs the control: it overlaps the control's own border and one pixel of its interior, and extends 2.5 pt outwards. It is not blurred in Catalina.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| shape | follows the focus ring mask: rectangle, rounded rectangle, capsule, circle | control bounds | `drawFocusRingMask()` | square (combo box), rounded 4.25 pt (toolbar search field), rounded (in-content search field) |
| accent | 8 accent colours | blue | `keyboardFocusIndicatorColor` | blue only here |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| focused, key window | yes, light + dark | `10-15-Catalina-Light-Finder-Go-To-Folder.png @ 144,198,794,58`; `10-15-Catalina-Dark-Automator.png @ 412,210,456,54` |
| inactive window | not shown | [D] the ring is removed when the window is not key |
| appearing animation | not shown | [I] ring scales from about 3x thickness at 0 alpha to its final size in about 0.25 s |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Width outside the control's outer edge | 2.5 (5 px); one instance 3 (6 px) | [M] | Light Go to Folder col 500: ring y 202..206, field border y=207. Light Sharing toolbar search col 1300: ring y 86..90, border y=91. Light Automator col 640: ring y 213..218, border y=219 |
| Overlap into the control | 1 (the 0.5 pt border pixel and the next pixel are tinted) | [M] | Light Go to Folder col 500: y=207 `#6b8dcd (sRGB #638cd2)` (ring over border), y=208 `#8baded (sRGB #84adf3)` (ring over inner edge), y=209 white |
| Total band | 3.5 | [C] | 2.5 + 1 |
| Edge | hard, one anti-aliased pixel; constant alpha across the band | [M] | Light Go to Folder col 500: y=202 `#8badec (sRGB #84adf2)`, y 203..206 `#89abeb (sRGB #82abf1)` |
| Outer corner radius | Fitted: 6.75 around the 4.25 pt toolbar search field; 3.25 around a square control. Least-squares fits with `tools/corner_fit.py` on the ring's outer edge: square combo box best 3.25 (rms 0.5 levels; 4.5 at 3, 4.3 at 3.5; 1.2 with the border and inner edge included); toolbar search field best 6.75 (rms 1.5; 3.9 at 6.5, 3.6 at 7). The earlier value for the square control, 2.5..3, was a grid reading. Around any other rounded control: control radius + 2.5, a rule generalised from that one fitted rounded control (6.75 = 4.25 + 2.5) and the ring's 2.5 pt outer width; it is not fitted on any other control and is inferred (this row gave the rule under the [C] tag until 3 October 2026). The Automator ring is cut by the bar above and below the field, so it has no clean corner and was not fitted | [C] 6.75 and 3.25, fits from [M] pixels; [I] the rule "control radius + 2.5" for other rounded controls | Light Go to Folder grid `@ 144,198,14,12`: outer top edge starts x=151, left edge starts y=205 (ring origin 148,202); fit corners `10-15-Catalina-Light-Finder-Go-To-Folder.png @ 146,200,12,12`, `10-15-Catalina-Light-System-Preferences-Sharing.png @ 1104,84,9,9` |
| Inner corner | follows the control (square for the combo box) | [M] | same grid: border corner pixel at 153,207 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Ring over the window background | `#89abeb (sRGB #82abf1)` on `#ececec` | `#3d6c95 (sRGB #2d6c99)` on `#2f3032` | [M] | Light Go to Folder `@ 500,204`; Dark Automator `@ 640,216` |
| Ring over a toolbar | `#83a5e5 (sRGB #7ca5eb)` on `#e3e3e3`; `#7b9ddd (sRGB #749de3)` on `#cfd0cf` | `#45749d (sRGB #3674a1)` on `#3f4042` | [M] | Light Sharing `@ 1300,89` and `@ 1300,139`; `10-15-Catalina-Dark-Dictionary.png @ 1150,123` |
| Ring over the control's border | `#6b8dcd (sRGB #638cd2)` on `#b1b1b1` | `#4c7aa3 (sRGB #3e7aa7)` | [M] | Light Go to Folder `@ 500,207`; Dark Automator `@ 640,219` |
| Recovered colour | `rgba(38,106,234,0.5)` | `rgba(75,168,248,0.5)` | [C] | solves all three light composites (window, toolbar, border) and both dark composites to within 1 level |

### Text and icons
None.

### Shadows and effects
None; the ring itself is the effect.

## Layout and spacing
The ring is drawn outside the layout box and never changes layout. Leave at least 3 pt of clear space around focusable controls so the ring is not clipped (scroll views clip it; AppKit insets focused cells for this reason). [D]

## Keyboard and accessibility
Tab / Shift-Tab move focus; Control-F7 toggles Full Keyboard Access in Catalina. The ring must meet 3:1 contrast against adjacent colours; in Increase Contrast mode the ring is opaque. ARIA: use `:focus-visible`. [D]

## Browser notes
- `box-shadow: 0 0 0 2.5px rgba(38,106,234,0.5), inset 0 0 0 1px rgba(38,106,234,0.5)` reproduces the band, including the tinted border, on any background. `outline` cannot overlap the border and has no inner part.
- Do not blur it: later macOS versions and many web imitations use a soft glow, Catalina's ring is a crisp band.
- Colours are stored Display P3 values; the lead's token sheet decides the sRGB conversion.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Finder-Go-To-Folder.png | 144,198,794,58 | ring around a square combo box |
| light | 10-15-Catalina-Light-System-Preferences-Sharing.png | 1104,84,340,60 | ring around the rounded toolbar search field |
| light | 10-15-Catalina-Light-Automator.png | 412,210,456,54 | ring around an in-content search field |
| dark | 10-15-Catalina-Dark-Automator.png | 412,210,456,54 | ring, dark |
| dark | 10-15-Catalina-Dark-Dictionary.png | 826,114,664,66 | ring around a toolbar search field, dark |

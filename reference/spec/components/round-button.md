# Round Button (`round-button`)

- **Status:** not seen in the screenshots
- **AppKit:** `NSButton`, `bezelStyle = .circular` (`NSCircularBezelStyle`), `controlSize` regular / small / mini
- **HIG:** https://web.archive.org/web/20200503170022/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/round-buttons/
- **Appearances shown:** none

## Purpose and behaviour
A round button contains a small centred icon, similar to a help button or a radio button. The HIG discourages it in modern apps: use push buttons, help buttons or radio buttons instead. [D] (HIG, Round Buttons)

No round button appears in any of the 294 screenshots. Circular controls that do appear are other components: the help button (`help-button`), the stop-progress button in Time Machine preferences (`progress-bar` family, 14 pt disc [M], x=1345..1372/y=346..373, `10-15-Catalina-Light-System-Preferences-Time-Machine.png @ 1340,360,39,1` and `10-15-Catalina-Light-System-Preferences-Time-Machine.png @ 1358,340,1,41`), and the red delete circles in Contacts (app-specific). The file exists so the inventory is complete.

## Anatomy
Circular bezel drawn with the `push-button` recipe (halo, 0.5 pt translucent edge, flat fill, two shadow rows), with a centred template image. [I] AppKit draws `.circular` and `.helpButton` with the same bezel artwork; only the content differs.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| controlSize | regular, small, mini | regular | `controlSize` | no |
| content | template image (one glyph) or one character | - | `image`, `title` | no |
| variant | bezel, destructive (app-drawn: the red remove disc of a Contacts card being edited) | bezel | none: Contacts draws it | destructive, light only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, pressed, disabled, focused | not shown | [I] identical to `help-button` in every state, with the glyph replaced |
| destructive, normal | yes, light | `10-15-Catalina-Light-Contacts.png @ 920,317,50,50` |
| destructive, pressed, disabled, Dark Aqua | not shown | [I] the fill darkened; the bezel's disabled opacity; the dark system red |

## Measurements
| Property | Value | Tag | Basis |
|---|---|---|---|
| Diameter, regular | 20 | [I] | equals the measured `help-button` diameter (same bezel) |
| Diameter, small / mini | 17 / 14 | [I] | follows the control-size steps measured for `push-button` (20 / 17) and the mini `segmented-control` (14) |
| Edge, fill, shadow | as `help-button` | [I] | same bezel |
| Glyph | up to 11 x 11 pt template image, `rgba(0,0,0,.85)` light / `rgba(255,255,255,.85)` dark, centred | [I] | size of the add / remove template images measured in `gradient-button` |
| Destructive disc, diameter | 14 (the mini size) | [M] | `10-15-Catalina-Light-Contacts.png`: first disc x 930..957, y 328..355 |
| Destructive disc, fill | flat `#ec4d3d` (sRGB `#ff3b30`, the system red), no edge, no shadow | [M] | `10-15-Catalina-Light-Contacts.png @ 944,333` |
| Destructive disc, bar | 8 x 2, white | [M] | same disc: bar y 340..343 |
| Destructive discs, pitch on the card | 53 | [M] | second disc y 434..461 |

## Layout and spacing
As `help-button`: aligned to the baseline grid of neighbouring 20 pt controls, 13 pt from an adjacent push button. [I]

## Keyboard and accessibility
Space activates it when focused. Role `AXButton`; it needs an accessibility label because it has no title. Web: `<button aria-label>`. [D]

## Browser notes
None beyond `help-button`.

## Evidence
No instance of the AppKit bezel. Closest measured relative: `10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 1372,858,42,43` (help button). The destructive variant: `10-15-Catalina-Light-Contacts.png @ 920,317,50,50`.

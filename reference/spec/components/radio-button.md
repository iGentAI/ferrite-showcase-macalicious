# Radio Button (`radio-button`)

- **Status:** present
- **AppKit:** `NSButton` with `setButtonType(.radio)` (sibling radio buttons with the same action and superview form a group); `state`, `controlSize`
- **HIG:** https://web.archive.org/web/20200503212902/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/radio-buttons/
- **Appearances shown:** light, dark (blue accent)

## Purpose and behaviour
A small circular button followed by a title, presented in groups of two to five related, mutually exclusive choices; on is a filled circle, off an empty one. A mixed state (dash) exists but checkboxes are preferred for that. Titles are sentence case without ending punctuation. Radio buttons present options and never start an action, and are used in views rather than toolbars or status bars. An introductory label's baseline aligns with the first button's title. Horizontal groups use consistent spacing sized for the longest title. Use a pop-up button for more than five choices. [D] (HIG, Radio Buttons)

Selecting one button deselects the others in its group; clicking the selected one does nothing. No hover state. [D]

## Anatomy
1. Circle, 16 pt diameter. Off: white (light) or grey gradient (dark) well. On: accent fill.
2. Dot (on only): white disc, 5.25 pt diameter, concentric.
3. Title to the right, 13 pt system.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| state | off, on (mixed possible) | off | `state` | off, on |
| enabled | true, false | true | `isEnabled` | both |
| controlSize | regular, small, mini | regular | `controlSize` | regular only |
| orientation of group | vertical, horizontal | vertical | layout | horizontal (Siri), vertical (Security and Privacy) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| on, enabled | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Siri.png @ 953,560,32,32`; `10-15-Catalina-Dark-System-Preferences-Siri.png @ 953,560,32,32` |
| off, enabled | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Siri.png @ 1043,560,32,32`; Dark same |
| off, disabled | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 328,778,32,32`; Dark same |
| on, disabled | yes, light + dark | `...Security-and-Privacy.png @ 328,822,32,32` (light, dark) |
| mixed | not shown | [I] 8 x 2 pt white dash as in `checkbox` |
| pressed | not shown | [I] fill darkened about 12 % |
| focused | not shown | [I] `focus-ring` following the circle |
| inactive window | not shown in my screenshots | [I] accent removed: off well with a dark (light appearance) or light (dark appearance) dot |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Circle diameter (regular) | 16 | [M] | Light Siri row 576: x 953..984 (32 px); col 968: y 560..591 |
| Dot diameter | 5.25 (10 full pixels + about 0.3 px anti-aliasing each side = 10.6 px) | [M] | Light Siri row 576: `#ffffff` x 964..973, edge pixels 963 / 974 at about 35 % |
| Dot centre | circle centre (px 968.5, 575.5) | [M] | same |
| Border width, off (light) | 0.5 | [M] | Light Siri row 576 x=1043 `#b2b2b2` x1 |
| Title first ink from circle edge | 3.5 (letter `O`; title origin about 3 pt after the circle) | [M] | Light Siri: circle ends x=984, `O` ink starts 992; second button circle ends 1074, ink 1082 |
| Title baseline | 2.5 pt above circle bottom | [M] | Light Siri cap `O` y 567..586 (with overshoot), circle y 560..591 |
| Horizontal gap, title end to next circle | 10 | [M] | Light Siri: `On` ink ends x=1023, next circle starts 1043 |
| Vertical pitch in a vertical group | 22 | [M] | Light Security and Privacy circles at y 778 and 822 |
| Small / mini diameters | 14 / 12 | [I] | AppKit control metrics (one size step = 2 pt); not shown |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Off: border | top `#a2a1a1`, sides `#b2b2b2`, bottom `#b8b8b9` | none; first row highlight `#6d6d6e`, second row `#5c5d5d` | [M] | Siri col 1060 (y 560, 591), row 576 (x 1043, 1074) |
| Off: fill | `#ffffff`; inner shadow rows under the top border `#cccdcd`, `#e3e3e3`, `#f4f3f4`, `#fdfdfd`; inside the side border `#f2f2f2`, `#fbfafb`; above the bottom border `#fafbfa`, `#ebeaeb` | gradient 0% `#555555` -> 100% `#6d6d6d` (lighter at the bottom) | [M] | Siri col 1060 y 560..591 |
| Off: inner shadow as CSS (light) | `inset 0 0.5px 1.5px rgba(0,0,0,0.20), inset 0 0 0 0.5px rgba(0,0,0,0.05)` | - | [C] | from the rows above |
| Off: outer ring / shadow (dark) | - | ring `#303031` at the sides, `#2b2b2c` then `#313132` below (bg `#363637`) | [M] | Dark Siri row 576 x=1042 / 1075; col 1060 y 592..593 |
| On: fill | `#4c89f5 (sRGB #3a87fd)` flat, outermost pixel ring `#4383f4 (sRGB #2f81fc)` | gradient 0% `#2e6cdd (sRGB #176ae5)` -> 100% `#2961c9 (sRGB #155fd0)`; first row `#6795e2 (sRGB #5c94e8)`, second row `#3975e0 (sRGB #2573e8)`; last row `#285ec2 (sRGB #155cc9)` | [M] | Siri col 968 y 560..591; row 576 |
| On: outer ring / shadow (dark) | none | sides `#2d2d2d`, below `#292829` then `#303031` | [M] | Dark Siri row 576 x=952 / 985; col 968 y 592..593 |
| Dot | `#ffffff` with a soft shadow below (darkest `#3570db (sRGB #216ee3)`, 0.5 pt offset) | `#dee8f9 (sRGB #dce8fb)` = white @ 0.85 over the fill, no shadow | [M] / [C] | Siri col 968 y 571..583 |
| Disabled off: border | sides `#c1c1c1`, top `#bbbbbb`, bottom `#c5c5c5` | first row `#525253`, outer ring `#333334` | [M] | Security and Privacy row 794, col 342 y 776..810 |
| Disabled off: fill | `#f0f0f0`..`#f1f1f1` | gradient `#464647` -> `#505051` | [M] | same |
| Disabled on: dot | `#919191` (black @ 0.40), no shadow | `#777777`..`#79797a` (white @ 0.25) | [M] / [C] | Security and Privacy row 838 x 339..348 |
| Pressed | on `#3f7ae0 (sRGB #2d78e8)`; off `#f0f0f0` | on darker 12 %; off lighter 8 % | [I] | never captured |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title font | SF Pro Text 13 pt regular | same | [C] | cap height 18-19 px, Light Siri `@ 990,556,30,40` |
| Title colour enabled / disabled | `rgba(0,0,0,0.85)` (`#222222` on `#e3e3e3`) / `rgba(0,0,0,0.25)` (`#a9a9aa`) | `rgba(255,255,255,0.85)` (`#e1e1e1`) / `rgba(255,255,255,0.25)` (`#686869`) | [M] / [C] | Siri `@ 986,560,160,32`; Security and Privacy `@ 366,780,120,30` |

### Shadows and effects
Same treatment as `checkbox`: nothing outside the circle in light; a 0.5 pt dark ring and a 1 pt soft shadow below in dark (`0 0 0 0.5px rgba(0,0,0,0.17), 0 0.5px 1px rgba(0,0,0,0.15)` [C]).

## Layout and spacing
Vertical groups: 22 pt pitch, left edges aligned. Horizontal groups: 10 pt between the end of one title and the next circle (Siri); the HIG asks for a constant slot width sized to the longest title. The group label (right-aligned, ending with a colon) shares the first title's baseline; label-to-circle gap 8 pt (Siri: label ends x=938, circle starts 953 -> 7.5 pt) [M].

## Keyboard and accessibility
Arrow keys move the selection within the group when it has keyboard focus (Full Keyboard Access); Space selects. Role `AXRadioButton` inside an `AXRadioGroup`. ARIA: `role="radiogroup"` containing `role="radio"` with `aria-checked`, roving tabindex. [D]

## Browser notes
Reproducible with `appearance:none`, `border-radius:50%` and a centred pseudo-element dot. The dot is not the 6 pt of later macOS versions: keep 5.25 px. Half-pixel borders as for `checkbox`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Siri.png | 953,560,122,32 | on and off, horizontal pair |
| light | 10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png | 328,778,32,76 | disabled off, disabled on, vertical pair |
| dark | 10-15-Catalina-Dark-System-Preferences-Siri.png | 953,560,122,32 | on and off |
| dark | 10-15-Catalina-Dark-System-Preferences-Security-and-Privacy.png | 328,778,32,76 | disabled off, disabled on |

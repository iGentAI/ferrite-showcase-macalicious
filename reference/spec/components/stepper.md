# Stepper (`stepper`)

- **Status:** present (always attached to a date picker in the screenshots)
- **AppKit:** `NSStepper` (`minValue`, `maxValue`, `increment`, `valueWraps`, `autorepeat`, `controlSize`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/selectors/steppers/
- **Appearances shown:** light, dark

## Purpose and behaviour
A two-segment control that increases or decreases a numeric, date or time value by a fixed increment. It does not display the value itself, so it sits beside the field that does. [D] (HIG, Steppers). Holding a half auto-repeats; values may wrap. [D] (AppKit)

## Anatomy
```
  .----.
  | /\ |   increment half
  |    |   (no visible divider)
  | \/ |   decrement half
  '----'
```
One tall capsule-like bezel with an up chevron in the top half and a down chevron in the bottom half.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| controlSize | regular, small, mini | regular | `controlSize` | regular |
| enabled | true, false | true | `isEnabled` | both |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Notifications.png @ 956,546,26,45`; Dark same |
| disabled | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 640,394,26,45` (outline x 641..664, y 395..436); Dark same |
| pressed (one half) | not shown | [I] the pressed half fills with the accent gradient of a pressed default button and its chevron turns white |
| focused | not shown | [I] `focus-ring` around the bezel |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Bezel size (outline to outline) | 12 wide x 21 high | [M] | Light Notifications row 567: outline x=957 and x=980; col 969: y 547..588 |
| Corner radius | 5.125 to 5.25, on the outer edge of the 0.5 pt border. Least-squares fit with `tools/corner_fit.py`: best 5.125 (rms 2.8 levels; 2.9 at 5.25, 3.5 at 5, 5.0 at 5.5), halo 5.75 (rms 2.3). The earlier value of 5.5 was a grid reading (the ends are almost semicircular; the flat part of the top edge is 2 pt wide) | [C] fit from [M] pixels | Light Notifications grid `@ 954,544,30,50`: top edge full colour only x 967..970; left edge reaches full colour at y=558; fit corner `10-15-Catalina-Light-System-Preferences-Notifications.png @ 957,547,9,9` |
| Outline width | 0.5 | [M] | Light Notifications row 567 x=957 `#b9b9b9` x1 |
| Chevron size | 6 wide x 3.5 high, stroke 1.4, mitred apex, butt ends | [M] / [C] | Light Notifications grid rows 556..562: apex x 967..970 at y=556, feet x 963..964 and 973..974 at y=561..562; vertical stroke thickness 4 px at 45 deg -> 1.4 pt |
| Chevron path (bezel-local pt, origin at the outline's top-left) | up: `M 3.25 7.25 L 6 4.75 L 8.75 7.25`; down: `M 3.25 13.75 L 6 16.25 L 8.75 13.75` | [C] | from the grid above (outline origin 957,547) |
| Chevron positions | up apex 4.5 below the top; down apex 4.5 above the bottom; both centred horizontally | [M] | Light Notifications col 969: ink y 556..559 and 576..579 |
| Divider between halves | none | [M] | Light Notifications rows 563..572 uniform `#ffffff`; Dark `#686869` |
| Gap to its field | 4 | [M] | Light Notifications row 568: field ends x=948, stepper outline x=957 |
| Vertical alignment with its field | centred (1 pt shorter than the 23 pt date field at top and bottom) | [M] | field y 545..590, stepper y 547..588 |
| Small / mini sizes | 10 x 18 / 9 x 15 [I] | [I] | AppKit small and mini metrics; not shown |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill | `#ffffff` | `#686869` flat; first row highlight `#868787`, second row `#6e6e6f` | [M] | Notifications col 969 y 548..587 |
| Outline | top `#c1c1c1`, sides `#b9b9b9`, bottom `#a8a8a7` | outer ring `#2f2f30` (sides), `#313132` (top), `#2b2b2c` (bottom) on `#363637` | [M] | Notifications col 969 y=547, 588; row 567 x=957 |
| Shadow below | `#c8c8c8`, `#dadada` on `#e3e3e3` = `0 0.5px 1px rgba(0,0,0,0.13)` | `#303031`, `#343435` = `0 0.5px 1px rgba(0,0,0,0.12)` | [M] / [C] | Notifications col 969 y 589..590 |
| Chevrons | `#404040` = black @ 0.75 | `#e8e8e8` = white @ 0.85 | [M] / [C] | Notifications `@ 968,557` |
| Disabled: fill / outline | `#f1f1f1` / top `#d0d0d0`, sides `#cdcdcd` | `#4f4f50`, highlight row `#5e5e5f`, ring `#333333` | [M] | Date & Time col 652 y 395..436; row 416 x 641..664 |
| Disabled: chevrons | `#909191` | `#7b7b7c` | [M] | Date & Time col 652 y 405, 425 |

### Text and icons
No text. Chevrons as above.

### Shadows and effects
Listed above; dark uses the same dark outer ring as `checkbox` and `radio-button`.

## Layout and spacing
Placed to the right of the field it controls, 4 pt away, vertically centred. A label before the field aligns to the field's baseline, not to the stepper. [M] / [D]

## Keyboard and accessibility
Up / Down arrows step when the field or stepper is focused. Role `AXIncrementor` with `AXIncrementButton` and `AXDecrementButton` children. ARIA: `role="spinbutton"` on the field with `aria-valuenow`, plus two buttons hidden from the tab order. [D]

## Browser notes
`<input type="number">` spin buttons cannot be styled consistently: hide them and draw two stacked buttons inside one bezel. The bezel is not a full capsule (radius 5.5 on a 12 pt width).

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Notifications.png | 956,546,26,45 | enabled stepper beside a time field |
| light | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png | 640,394,26,45 | disabled stepper |
| dark | 10-15-Catalina-Dark-System-Preferences-Notifications.png | 956,546,26,45 | enabled |
| dark | 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png | 640,394,26,45 | disabled |

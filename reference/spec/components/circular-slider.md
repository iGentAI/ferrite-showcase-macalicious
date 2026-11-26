# Circular Slider (`circular-slider`)

- **Status:** not seen in the screenshots
- **AppKit:** `NSSlider` with `sliderType = .circular`
- **HIG:** https://web.archive.org/web/20200504054800/https://developer.apple.com/design/human-interface-guidelines/macos/selectors/sliders/
- **Appearances shown:** none. Searched: all 34 sysB panes, and the sysA panes with sliders (Displays, Dock, Keyboard, Energy Saver). No circular dial appears; the only round dial-like object in the library is the analog clock in Date & Time, which is part of `date-picker`.

## Purpose and behaviour
A circular dial for values that repeat or continue indefinitely (rotation 0..360 degrees, number of spins). The thumb is a small circle; tick marks, when enabled, are evenly spaced dots around the circumference. [D] (HIG, Sliders)

## Anatomy
1. Dial: a disc drawn like an unpressed round button.
2. Thumb: a small dot near the rim at the angle of the value (0 at 12 o'clock, clockwise).
3. Optional tick dots outside the rim.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| controlSize | regular, small | regular | `controlSize` | no |
| numberOfTickMarks | 0..n | 0 | `numberOfTickMarks` | no |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| all | not shown | values below are inferred |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Dial diameter, regular | 24 (in a 28 x 30 frame) | [I] | AppKit's intrinsic size for the regular circular slider; not shown |
| Dial diameter, small | 18 | [I] | AppKit small metric; not shown |
| Thumb dot diameter | 4 | [I] | not shown |
| Thumb dot centre from dial centre | radius - 4.5 | [I] | not shown |
| Tick dot diameter | 2, centred 3 pt outside the rim | [I] | not shown |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Dial fill | `#ffffff` with the `slider` thumb outline (`rgba(0,0,0,0.14)` top -> `rgba(0,0,0,0.26)` bottom) and shadow | `#cccccc` flat with `rgba(0,0,0,0.15)` ring, as the `slider` thumb | [I] | reuses the measured round slider knob recipe (`slider.md`) because the dial is drawn with the same bezel |
| Thumb dot | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.6)` | [I] | not shown |
| Tick dots | `rgba(0,0,0,0.36)` | `rgba(255,255,255,0.25)` | [I] | the measured linear tick colours |

### Text and icons
None.

### Shadows and effects
As the round `slider` knob. [I]

## Layout and spacing
Usually paired with a text field and stepper showing the numeric value. [D]

## Keyboard and accessibility
Arrow keys change the value; it wraps at the ends. Role `AXSlider`. ARIA: `role="slider"` with `aria-valuetext` giving the angle. [D]

## Browser notes
Build from a circular element with a rotated child for the thumb; pointer angle via `atan2`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| - | none | - | not present in the library subset reviewed |

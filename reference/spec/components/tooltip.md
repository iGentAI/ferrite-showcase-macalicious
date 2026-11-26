# Tooltip, help tag (`tooltip`)

- **Status:** not seen in the screenshots. Searched: all 34 sysB panes; the manifest and README contain no "tooltip" or "help tag" entry; none of the other groups' coverage files lists one. A help tag appears only after the pointer rests on a control, and no capture was taken in that state.
- **AppKit:** `NSView.toolTip`, `addToolTip(_:owner:userData:)`; expansion tooltips via `NSCell.expansionFrame(withFrame:in:)`
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/user-interaction/help/
- **Appearances shown:** none

## Purpose and behaviour
Help tags (tooltips) briefly describe how to use a control without taking focus away from the interface. They appear when the pointer rests over a control for a few seconds and stay for 10 seconds or until the pointer moves away. Describe only the control under the pointer; add them to app-specific controls, not to system controls such as scrollers; do not merely repeat the control's name; context-sensitive text for different states is allowed. An expansion tooltip shows the full text of a clipped or truncated field. Apple's term in user-facing text is "help tag". [D] (HIG, Help)

## Anatomy
A small borderless floating window: a rectangle with a light fill, hairline border and soft shadow, containing one or more lines of small text. It has no arrow.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| kind | help tag, expansion tooltip | help tag | `toolTip`; cell expansion | no |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| visible | not shown | all values below are [D] or [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Text | 11 pt regular (`NSFont.toolTipsFont(ofSize: 0)` = small system font) | [D] | AppKit `toolTipsFont` |
| Padding | 4 left / right, 2 top / bottom | [I] | not shown |
| Corner radius | 0 (square corners in 10.15; rounded corners arrived with macOS 11) | [I] | not shown |
| Maximum width | text wraps at about 300 pt | [I] | not shown |
| Position | top-left corner about 16 pt below and 8 pt right of the pointer hot spot, kept on screen | [I] | not shown |
| Delay | appears after about 1.5 s of rest; hidden after 10 s | [D] / [I] | HIG: "a few seconds", "10 seconds" |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill | `#f2f2f2`-class (window background family) | `#2a2a2a`-class | [I] | Catalina help tags follow the appearance; not shown |
| Border | `rgba(0,0,0,0.2)` 0.5 pt | `rgba(255,255,255,0.2)` 0.5 pt | [I] | not shown |
| Text | `rgba(0,0,0,0.85)` | `rgba(255,255,255,0.85)` | [I] | label colour measured in `label` |
| Shadow | `0 2px 6px rgba(0,0,0,0.25)` | same | [I] | not shown |

### Text and icons
Plain text, sentence case, no trailing full stop for fragments. [D]

### Shadows and effects
Fades in over about 0.1 s and out over about 0.5 s. [I]

## Layout and spacing
Never covers the control it describes if it can be avoided. [D]

## Keyboard and accessibility
Not reachable by keyboard; the same text is exposed as the control's help (`AXHelp`). ARIA: `aria-describedby` pointing at `role="tooltip"`, shown on hover and on focus. [D]

## Browser notes
The native `title` attribute gives the platform's own tooltip, whose look cannot be controlled; draw a custom element. Because every visual value here is inferred, treat this component as low confidence until a reference capture exists.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| - | none | - | no help tag is visible in the 294 screenshots as far as the coverage files and my 34 panes show |

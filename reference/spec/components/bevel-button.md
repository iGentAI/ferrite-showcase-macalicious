# Bevel Button (`bevel-button`)

- **Status:** present (one use: the Orientation buttons of the Print dialog)
- **AppKit:** `NSButton`, `bezelStyle = .regularSquare` (`NSRegularSquareBezelStyle`) or `.shadowlessSquare`; `setButtonType(.onOff)` / `.pushOnPushOff`; image-only or image + title
- **HIG:** https://web.archive.org/web/20200503170610/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/bevel-buttons/
- **Appearances shown:** light, dark

Short file names: `L-Print` = `10-15-Catalina-Light-Print.png`, `D-Print` = `10-15-Catalina-Dark-Print.png`.

## Purpose and behaviour
Bevel buttons can have square or rounded corners and show text, an icon or another image; they once served as push buttons, radio or checkbox groups and, with a downward arrow badge, pop-up buttons. The HIG says to avoid them in modern apps and to use push buttons, checkboxes, pop-up buttons, radio buttons or segmented controls instead. [D] (HIG, Bevel Buttons)

The one place Catalina still shows them is the Print dialog, where two square image buttons form a radio pair for portrait and landscape orientation: the chosen one stays in the on state.

## Anatomy
A square cell: 1 pt border, vertical gradient fill (lighter at the bottom), centred image. No shadow.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| state | off, on | off | `state` | both |
| corners | square, rounded | square | `.regularSquare` vs `.texturedSquare` / `.roundRect` | square only |
| content | image, title, both | image | `image`, `title`, `imagePosition` | image only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| off | yes, light + dark | `L-Print @ 1100,582,76,76`; `D-Print @ 1014,552,76,76` |
| on | yes, light + dark | `L-Print @ 1000,582,76,76`; `D-Print @ 914,552,76,76` |
| pressed | not shown | [I] same as on |
| disabled | not shown | [I] off fill with the image at 0.25 alpha |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Size | 38 x 38 | [M] | `L-Print` row y=600: border x 1000..1001, fill x 1002..1073, border x 1074..1075; col x=1004: border y 582..583, fill y 584..655, border y 656..657. `D-Print` row y=572: x 914..989; col x=920: y 552..627 |
| Border | 1 (2 px) | [M] | `L-Print` row y=600: `#afafaf` x 1000..1001 |
| Corner radius | 0 | [M] | `L-Print` grid `@ 998,580,6,6`: border colour present at the corner pixel x=1000, y=582 |
| Gap between the two buttons | 12 | [M] | `L-Print` row y=600: first ends x=1075, second starts x=1100; `D-Print` row y=572: 989 and 1014 |
| Image | 27.5 x 25 visible artwork including its soft edge (x=1011..1065, y=596..645), centred | [M] | 10-15-Catalina-Light-Print.png @ 1005,585,67,70; pixels differing by more than 10 stored channel levels from the fill at x=1004 on each row |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Border | `#afafaf` | off: `#5e635f (sRGB #5d635f)` at the cited pixel (material-dependent, not a neutral constant); on: none (the fill runs to the edge) | [M] | `L-Print @ 1000,600`; `D-Print @ 1014,572`; `D-Print` row y=572 x 914..927 all `#8a8b8b` |
| Fill, off | `#e2e2e2` (top) -> `#ededed` (30%) -> `#f2f2f2` (60%) -> `#f7f7f6` (bottom) | `#414042` (top) -> `#464647` (50%) -> `#494a4b` (bottom) | [M] | `L-Print` col x=1104 y 584..655; `D-Print` col x=1020 y 554..625 |
| Fill, on | `#c4c4c4` (top) -> `#cbcbcb` (30%) -> `#d2d2d2` (60%) -> `#dbdbdb` (bottom) | `#8a8b8b` flat | [M] | `L-Print` col x=1004 y 584..655; `D-Print` col x=920 y 552..627 |
| Surrounding sheet colour at this location | `#efefef` | `#2c2e2c` | [M] | `L-Print @ 996,600`; `D-Print @ 910,572` |

### Shadows and effects
None. [M] `L-Print` col x=1004: y=658 is the sheet colour `#efefef`.

## Layout and spacing
The pair follows a right-aligned label ("Orientation:") in the Print form; the first button's left edge is on the control column (aligned with the pop-up buttons above it). Buttons are 12 pt apart. [M] gap; alignment by inspection of `L-Print` only.

## Keyboard and accessibility
As a radio pair: arrow keys move the selection, Space selects. AppKit role `AXRadioButton` inside an `AXRadioGroup` (the Print panel exposes them as "portrait" / "landscape"). Web: `role="radiogroup"` with two `role="radio"` image buttons. [D]

## Browser notes
Plain CSS. The pictograms are image assets.

## Pixel audit
Stored colours [M], independently re-sampled; the dark Print sheet's edge picks up its backdrop.
- Light border `#afafb0`: 10-15-Catalina-Light-Print.png @ 1000,600 (within1 of the nominal #afafaf above).
- Dark off border `#5e635f (sRGB #5d635f)`: 10-15-Catalina-Dark-Print.png @ 1014,572.
- Light surrounding sheet `#efefef`: 10-15-Catalina-Light-Print.png @ 996,600.
- Dark selected fill `#8a8c8b`: 10-15-Catalina-Dark-Print.png @ 920,572 (within1 of nominal #8a8b8b).

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Print.png` | 1000,582,176,76 | portrait (on) and landscape (off) |
| dark | `10-15-Catalina-Dark-Print.png` | 914,552,176,76 | portrait (on) and landscape (off) |

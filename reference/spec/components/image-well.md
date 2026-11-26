# Image Well (`image-well`)

- **Status:** present
- **AppKit:** `NSImageView` with `isEditable = true` and `imageFrameStyle = .grayBezel` (or `.photo`, `.groove`, `.button`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/selectors/image-wells/
- **Appearances shown:** light, dark

## Purpose and behaviour
An editable image view. The user can drag a new image into it, press Delete to clear it or revert to a default image, and copy or paste its content; it must be selected (shown by a selection ring) for Delete, Copy and Paste. Revert to a default image when the well requires one, and provide the standard Edit menu commands. [D] (HIG, Image Wells). The HIG's own example is the desktop picture well in Desktop & Screen Saver, which is the instance measured here.

## Anatomy
1. Outer ring: a 2 pt white (light) or grey (dark) rounded frame.
2. Recess: a flat grey area with a soft inner shadow under the top edge.
3. Image: scaled proportionally and centred inside the recess with padding.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| frame style | gray bezel, photo, groove, button, none | gray bezel | `imageFrameStyle` | the rounded desktop-picture well only |
| scaling | proportionally down, axes independently, none, proportionally up or down | proportionally down | `imageScaling` | proportional |
| editable | true, false | true | `isEditable` | true |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, with image | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 210,263,278,178`; Dark same |
| selected (focus ring) | not shown | [D] a selection ring surrounds the well (HIG); use `focus-ring` with outer radius 8 |
| drag target highlight | not shown | [I] ring in the accent colour, 2 pt |
| empty | not shown | [I] recess only |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Outer size | 138 x 88 | [M] | Light Desktop & Screen Saver row 350: ring x 211..486; col 350: y 264..439 |
| Ring width | 2 | [M] | row 350: `#ffffff` x 211..214 and 483..486; col 350: y 264..267 and 436..439 |
| Outer corner radius | 6.5, on the outer edge of the outer line. Least-squares fit with `tools/corner_fit.py`, modelling the outer line, the 2 pt white ring, the inner line and the recess taken as flat: best 6.5 (rms 2.3 levels; 4.1 at 6.25, 3.4 at 6.75, 6.3 at 6). The earlier "about 5.5" was a grid reading | [C] fit from [M] pixels | grid `@ 210,262,12,12`: along the top edge (y=264) the ring reaches full white only at x=222; along the left edge (x=211) it is still blended at y=273 (ring origin 211,264); fit corner `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 210,263,13,13` |
| Image inset from the ring's inner edge | 7.5 left / right, 5 top / bottom | [M] | row 350: recess x 215..229, image from 230 to 467; col 350: recess y 268..277, image from 278 to 425 |
| Image size | 119 x 74 | [M] | row 350: x 230..467; col 350: y 278..425 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Ring | `#ffffff` | `#767677` | [M] | Desktop & Screen Saver row 350 x 211..214 (light, dark) |
| Ring outer anti-aliasing against the box | `#d6d6d6` on `#e3e3e3` | none visible on `#363637` | [M] | row 350 x=210 |
| Recess edge (inner shadow line) | top `#bdbdbd`, left `#c6c5c6`, right `#c5c5c5`, bottom `#cacaca` | top `#2e2f30`, sides `#323233`, bottom `#333334` | [M] | col 350 y=268, 435; row 350 x=215, 482 |
| Recess fill | `#dadada`; under the top edge `#cdcdcd`, `#d2d2d2`, `#d4d4d4`, `#d6d6d6`, `#d8d8d8` (a 3 pt shadow) | `#3e3e3f`; under the top edge `#3a3a3b`, `#3c3c3d` | [M] | col 350 y 269..277 |
| Recess shadow as CSS | `inset 0 0.5px 0 rgba(0,0,0,0.13), inset 0 1px 3px rgba(0,0,0,0.08)` | `inset 0 0.5px 0 rgba(0,0,0,0.25)` | [C] | from the rows above |

### Text and icons
None.

### Shadows and effects
Only the recess inner shadow.

## Layout and spacing
In Desktop & Screen Saver the well's left edge is 49.5 pt from the window's left edge (well x 211..486 in a frame starting x=112) [M]; the picture name starts at x=521, y=288, 12 pt below the well top y=264; its pop-up bezel starts at x=521, y=331 and is 169 x 20 pt (through x=858, y=370) [M]. Both sit to the right with a 17 pt blank gap from the well's right edge [C] (x=487..520); evidence: `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 500,270,180,52`, `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 510,350,361,1`, `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 700,325,1,54`.

## Keyboard and accessibility
Focusable with Full Keyboard Access; Delete clears, Command-C / Command-V copy and paste. Role `AXImage` (editable). ARIA: a button or `role="img"` with drop handlers and an accessible name; provide a file-input alternative. [D]

## Browser notes
Reproducible with nested boxes and `object-fit: contain`. Drag and drop needs the HTML drag-and-drop API plus a hidden `<input type="file">`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png | 200,250,300,200 | desktop picture well |
| dark | 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png | 200,250,300,200 | desktop picture well |

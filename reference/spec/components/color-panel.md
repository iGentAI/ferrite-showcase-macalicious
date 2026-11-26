# Color Panel (`color-panel`)

- **Status:** not seen in the screenshots
- **AppKit:** `NSColorPanel` (`shared`, `color`, `alpha`, `showsAlpha`, `isContinuous`, `mode`, `NSColorPanel.Mode`, `setPickerMask(_:)`, `attachColorList(_:)`, `accessoryView`); opened by `NSColorWell`
- **HIG:** https://web.archive.org/web/20200504154558/https://developer.apple.com/design/human-interface-guidelines/macos/selectors/color-wells/
- **Appearances shown:** none (no app in the 294 screenshots has the Colors panel open; the colour wells that are shown, measured in `color-well.md`, are at rest)

## Purpose and behaviour
"A standard user interface for selecting color in an app" [D] (NSColorPanel). It "provides a number of standard color selection modes" and "allows the user to save swatches containing frequently used colors" [D]. A colour well opens it: "When clicked, a color well darkens to provide visual confirmation that it's active. It then opens the system's color panel so people can choose a color. After a selection is made, the color well updates to show the new color" [D] (HIG, Color Wells). One panel is shared by the whole app (`NSColorPanel.shared`) and edits whichever well is active [D]. It reports the colour continuously while the user drags (`isContinuous`, default true) [D]. The opacity slider is shown only when `showsAlpha` is true; otherwise every colour it returns is opaque [D]. Colours can be dragged from the panel to a well and between wells [D] (HIG).

Sources: https://developer.apple.com/documentation/appkit/nscolorpanel and https://developer.apple.com/documentation/appkit/nscolorpanel/mode-swift.enum (read 2026-10-06); the HIG page above (capture of 2020-05-04).

## Anatomy
```
+--------------------------------+
| (o)(o)(o)      Colors          |  title bar
|   [wheel][sliders][palettes]   |  toolbar: one item per picker
|          [image][pencils]      |
+--------------------------------+
|                                |
|        the chosen picker       |
|                                |
|  Opacity  ----------o   [100]  |  only with showsAlpha
|  [eyedropper] [current colour] |  [swatch grid, not built]
+--------------------------------+
```
The library builds the pickers as components of their own, each usable alone: `color-wheel` (the wheel, and the spectrum of the image palettes), `color-sliders` (grey scale, RGB and HSB), `color-palette` (the colour list and the pencils). Their inventory rows share this spec.

## Variants and parameters
| Parameter | Values | AppKit equivalent | Shown |
|---|---|---|---|
| picker | colour wheel, colour sliders (grey scale, RGB, CMYK, HSB), colour palettes (colour lists), image palettes, pencils | `mode`: `.wheel`, `.gray`, `.RGB`, `.CMYK`, `.HSB`, `.colorList`, `.customPalette`, `.crayon` [D] | no |
| opacity slider | shown, hidden | `showsAlpha` (default false) [D] | no |
| continuous | true, false | `isContinuous` (default true) [D] | no |
| pickers offered | any subset | `setPickerMask(_:)` [D] | no |
| colour lists | "Apple" and others the app attaches | `attachColorList(_:)` [D] | no |

## States
None shown. The window has the usual key and inactive states of a panel; the chosen picker's toolbar item is drawn selected [I].

## Measurements (all [I] unless tagged; there is no Catalina reference to measure)
| Property | Value | Basis |
|---|---|---|
| Frame width | 228 [I] | an estimate of the panel's minimum width; not measured |
| Title bar and toolbar | 22 title strip + 24 toolbar row + 4 below = 50 [I] | unified title bar measured in `title-bar`; the toolbar row is an estimate |
| Toolbar item | 32 x 24, radius 4, 4 apart, centred [I] | size of a small toolbar button |
| Body margins | 12 at every edge, 10 between its parts [I] | |
| Picker area | 204 wide, at least 236 high [I] | the wheel's disc plus its slider |
| Wheel disc | diameter 204 [I]; white at the centre, full saturation at the rim [D]; hue anticlockwise from red at three o'clock [I] | HSB model (`NSColor` hue, saturation, brightness) for the colours; the size and the orientation are not documented and no screenshot shows them |
| Marker | 9 ring, 1.5 wide [I] | |
| Slider rows | small slider and a 40 wide small text field, name above [I] | controls measured in `slider` and `text-field` |
| Colour list row | 19 high, swatch 26 x 13 [I] | small-text list row |
| Pencils | 4 rows of 12 [D] for the count (48 crayons); 17 wide, a new row every 34 [I] | |
| Current colour | 24 high, radius 3, hairline edge [I] | |
| Eyedropper | 32 x 24 button with a 16 glyph [I] | |

### Geometry (pt)
Every length in the preceding table is [I]. No Colors panel is seen in the screenshots; do not promote these values to measured Catalina defaults.

### Colours and fills
| Part | Light | Dark | Tag | Basis |
|---|---|---|---|---|
| Body | `#ececec` | `#323232` | [M] | window background measured in `window` |
| Title bar and toolbar | title bar material | title bar material | [M] | measured in `title-bar` |
| Chosen toolbar item | black at 14% | white at 20% | [I] | |
| Slider track, filled | `#3d88fd` | `#1869e6` | [M] | measured in `slider` |
| Slider track, unfilled | black at 22% | white at 14% | [M] | measured in `slider` |
| Chosen row of a colour list | `#0164e1` | `#0158d0` | [M] | emphasised selection measured in `list-view` |
| Hues of the wheel and the spectrum | the HSB model at full saturation and brightness | the same | [D] | not appearance-dependent; where each hue lies on the disc and across the spectrum is [I] |
| Crayon and "Apple" list colours | commonly published sRGB values (Licorice `#000000` ... Carnation `#ff8ad8`; Black, Blue `#0000ff`, Brown `#996633` ...) | the same | [I] | not read from a Mac |
| Tiles behind a translucent colour | `#ffffff` and `#c8c8c8` | the same | [I] | |

### Text and icons
Title "Colors" [D], in the window title font [M] (`title-bar`). Labels in the small control font [I]. The toolbar glyphs and the eyedropper are Apple artwork in AppKit; the library draws its own line glyphs [I] and does not copy them.

### Shadows and effects
Panel shadow as `window-shadow`, panel level [M] there, [I] that the Colors panel uses it.

## Layout and spacing
The panel floats above the app's windows and is moved by its title bar [D]. On a page it is either placed by the app or opened under the colour well that owns it, 6 pt below, leading edges aligned [I].

## Keyboard and accessibility
A panel window (`AXWindow`, subrole floating window) [D]. ARIA: a labelled region, or a `dialog` when a well opens it as a popup; the toolbar is a `tablist` with one `tab` per picker, arrow keys between them; each slider is a `slider` with a text field for the same value; a colour list is a `radiogroup` (or `listbox`) of named colours; the wheel is one focusable element with the arrow keys moving its marker. Escape closes a panel opened as a popup and returns focus to the well.

## Browser notes
`<input type="color">` opens the browser's own chooser, which is not the Colors panel: cancel its click and open this component instead. Chromium's `EyeDropper` API picks a colour from the screen; Firefox and Safari have none, so the eyedropper is disabled there. This implementation works in sRGB, the colour space of a hex value: it has no CMYK sliders and no choice of colour space. Dragging colours between wells and the swatch grid are not built.

## Evidence
None available.

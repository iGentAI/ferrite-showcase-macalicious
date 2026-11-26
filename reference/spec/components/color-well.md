# Color Well (`color-well`)

- **Status:** present (TextEdit's format bar text-colour well; the Print screenshots show the same bar behind the dialog). No colour well appears in the System Preferences panes reviewed.
- **AppKit:** `NSColorWell` (`color`, `isBordered`, `activate(_:)`, `isActive`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/selectors/color-wells/
- **Appearances shown:** light, dark

## Purpose and behaviour
Lets people adjust the colour of text, shapes, guides and other elements. When clicked, the well darkens to confirm it is active and opens the system colour panel; after a choice it shows the new colour. Wells support drag and drop of colours between wells and from the colour panel. [D] (HIG, Color Wells)

## Anatomy
```
+--------------------+   outer border 0.5 pt
| bezel 1.5 pt       |
| +----------------+ |   inner frame 1 pt
| |    swatch      | |
| +----------------+ |
+--------------------+
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| size | any frame; standard in forms 44 x 23; format-bar size 22 x 16 | 44 x 23 | frame | 22 x 16 only |
| bordered | true, false | true | `isBordered` | true |
| active | false, true | false | `isActive` | false |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes, light + dark | `10-15-Catalina-Light-Text-Edit.png @ 651,130,44,32`; `10-15-Catalina-Dark-TextEdit.png @ 652,131,43,30` |
| active (colour panel open) | not shown | [D] the well darkens (HIG); [I] bezel `#c9c9c9` light / `#8a8d8f` dark |
| disabled | not shown | [I] swatch at 50 % opacity |
| second well with "no colour" slash (TextEdit highlight well) | yes, light + dark | `10-15-Catalina-Light-Text-Edit.png @ 701,130,44,32` (white swatch with a red diagonal and letter a: app-specific content) |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Outer size (format-bar well) | 22 x 16 | [M] | Light TextEdit row 146: x 651..694; col 672: y 130..161 |
| Outer border | 0.5 | [M] | row 146 x=651 `#bdbdbd` x1 |
| Bezel band | 1.5 at the sides, 0.5 at top and bottom | [M] | row 146: `#f6f6f6` x 652..654; col 672: y=131 `#fcfcfc`, y=160 `#f3f3f3` |
| Inner frame | 1 | [M] | row 146: `#e8e8e8` x 655..656; col 672: y 132..133 |
| Swatch | 16 x 12 | [M] | row 146: x 657..688; col 672: y 134..157 |
| Corner radius | 0 on the swatch; outer corners square at this size | [M] | col 672 and row 146 runs are constant to the corners |
| Standard well in a form | 44 x 23 with a 3 pt bezel [I] | [I] | Interface Builder default frame; not shown |
| Gap between adjacent wells | 3 | [M] | row 146: first well ends x=694, second starts x=701 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Outer border | sides `#bdbdbd`, top `#c1c1c1`, bottom `#9d9d9d` | none at the sides (bezel meets the bar); top `#838688 (sRGB #828688)` highlight | [M] | TextEdit row 146 x 651; col 672 y 130, 161 (light); Dark col 672 y=131 |
| Bezel | `#f6f6f6` (top `#fcfcfc`, bottom `#f3f3f3`) | `#676a6c (sRGB #666a6c)` (bottom `#65686a (sRGB #64686a)`) | [M] | row 146 x 652..654; Dark x 652..654 |
| Inner frame | `#e8e8e8` | `#232323` | [M] | row 146 x 655..656; Dark x 655..656 |
| Swatch | the chosen colour (`#000000` shown) | the chosen colour (`#ffffff` shown: TextEdit's text colour follows the appearance) | [M] | `@ 672,146` |
| Surrounding format bar | `#d3d3d3` | `#3a3d3f (sRGB #393d3f)` | [M] | row 146 x 640..650 |

### Text and icons
None.

### Shadows and effects
None at this size.

## Layout and spacing
In a form, a right-aligned label ends 8 pt before the well and is vertically centred on it [I]; not shown: no standard form-layout well is captured. In TextEdit's format bar the wells sit between the font-size combo box and style buttons with 7 pt blank gaps [C] (font-size right border x=636, first well left border x=651; second well right border x=744, style-button left border x=759: 14 blank px each), `10-15-Catalina-Light-Text-Edit.png @ 628,146,36,1` and `10-15-Catalina-Light-Text-Edit.png @ 732,146,36,1`.

## Keyboard and accessibility
Space activates when focused (Full Keyboard Access). Role `AXColorWell` with the colour as its value. ARIA: `<input type="color">` or a button with `aria-label` giving the colour name. [D]

## Browser notes
`<input type="color">` opens the browser's picker, not the macOS colour panel, and its swatch chrome differs per engine: draw the well as a button with nested boxes and open your own popover. The panel itself is specified in `color-panel.md`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Text-Edit.png | 651,130,96,32 | text colour well (black) and highlight well |
| dark | 10-15-Catalina-Dark-TextEdit.png | 651,130,96,32 | same, dark |

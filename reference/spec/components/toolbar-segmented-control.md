# Toolbar segmented control (`toolbar-segmented-control`)

- **Status:** present
- **AppKit:** `NSSegmentedControl` with `segmentStyle = .texturedRounded` (joined) or `.separated`; `trackingMode = .selectOne | .momentary`
- **HIG:** https://web.archive.org/web/20200503185450/https://developer.apple.com/design/human-interface-guidelines/macos/selectors/segmented-controls/ and https://web.archive.org/web/20200503121036/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/toolbars/
- **Appearances shown:** light, dark

## Purpose and behaviour
A row of two or more segments that act as mutually exclusive choices (view switcher), independent toggles, or momentary buttons (Back/Forward, zoom out/in). The HIG names this as the one toolbar control that may show a persistent selected appearance, "such as the view controls in a Finder window toolbar" [D]. Segments hold either icons or text, not both, and should be equal in width [D].

## Anatomy
One textured rounded bezel (see `toolbar-button`) divided by 1 pt vertical dividers; the selected segment is filled with the "on" colour and hides the dividers on both of its sides.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| style | joined (textured rounded), separated, navigation pair | joined | `segmentStyle` | joined: Finder view switcher; separated: Preview zoom; pair: Back/Forward |
| tracking | select one, select any, momentary | select one | `trackingMode` | select one, momentary |
| content | icon, text | icon | `setImage`, `setLabel` | icon (Finder, Preview); text (Calendar Day/Week/Month/Year, Maps Map/Transit/Satellite); Calendar text measured below [M] |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal segment | yes | `10-15-Catalina-Light-Finder-Network.png @ 451,125,222,47` |
| selected segment | yes | third segment in the same crop; fourth in `...Finder-Gallery-View.png`; first in `...Applications.png` |
| disabled segment | yes | Forward in every Finder shot; both arrows in `10-15-Catalina-Light-Preview-Search.png @ 2206,206,44,29` |
| pressed | no | [I] as `toolbar-button` pressed |
| inactive window | yes | Back/Forward in `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 470,119,56,46` |
| selected segment, inactive window | yes, light + dark | first segment of the Books toolbar: `10-15-Catalina-Light-Books.png @ 921,103,786,66`; `10-15-Catalina-Dark-Books.png @ 921,103,786,66` |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Height | 22 fill (23 with light borders) | [M] | as `toolbar-button` |
| Finder view switcher, total fill width | 110 (x 452..671 at y=150) | [M] | `10-15-Catalina-Light-Finder-Network.png @ 451,150,222,1` |
| Segment boundaries (px at y=130) | fills 453..507, 510..561, 564..615, 618..670; dividers 508..509, 562..563, 616..617 | [M] | `10-15-Catalina-Light-Finder-Network.png @ 451,130,222,1` (dark: control starts at x=386, same offsets) |
| Segment pitch | 27 (54 px); first and last segments are 1 pt wider for the rounded ends | [M] | same row |
| Divider | 1 wide (2 px), full fill height | [M] | `@ 508,130,2,1` |
| Selected segment extent | its own 26 pt plus the divider on its trailing side (x 564..617); the divider on its leading side is painted with the normal fill | [M] | `@ 510,130,108,1` light; `10-15-Catalina-Dark-Finder-Network.png @ 444,130,108,1` |
| Corner radius (outer ends only) | Light 4.25, on the outer edge of the 0.5 pt border. Dark, where the fill has no border: the fit's optimum is 3.625 on the edge of the fill, with 3.75 almost as good. Least-squares fits with `tools/corner_fit.py` to the leading end of the Finder view switcher: light best 4.25 (rms 1.36 levels; 2.49 at 4, 2.33 at 4.5); dark best 3.625 (rms 1.46; 1.53 at 3.75, 2.01 at 3.5, 2.99 at 4). The toolbar behind the control is a gradient within 4 levels over the compared square and was taken as flat. The trailing end and the other captures are not fitted. Until 3 October 2026 this row gave 4.25 for both appearances, carried over from `toolbar-button` and tagged [I]; before the fits it gave 4 tagged [M], which was taken by reference to `toolbar-button` and was not a direct measurement of this control | [C] fit from [M] pixels: light 4.25, dark 3.625 | fit corners `10-15-Catalina-Light-Finder-Network.png @ 451,125,12,12` and `10-15-Catalina-Dark-Finder-Network.png @ 386,126,12,12` |
| Corner radius to build with, dark | 3.75. A choice between the two candidates the dark fit does not separate (0.07 levels of rms apart): 3.75 is what the toolbar pop-up, the toolbar search field and the smart search field fit in dark, and it is the light fill inside its border (4.25 less 0.5). Not the computed optimum, which is the row above | [I] | the row above; `toolbar-pop-up`, `toolbar-search-field`, `smart-search-field` |
| Navigation pair (Back/Forward) | two 25 pt buttons; light: their side borders touch (2 px `#bdbdbd` between the fills, x 178..179); dark: 1 pt gap showing the bar (x 178..179 `#313233`) | [M] | `10-15-Catalina-Light-Finder-Network.png @ 172,150,14,1`; `10-15-Catalina-Dark-Finder-Network.png @ 172,150,14,1` |
| Navigation pair in System Preferences | two 27 pt buttons (x 268..321, 324..377) | [M] | `10-15-Catalina-Light-System-Preferences-General.png @ 250,96,140,1` |
| Separated style (Preview zoom out / zoom in) | two bezels that touch. Fills 39 and 37 wide (x 216..293 and 296..369 at mid-height), 1 pt (2 px) between the fills, in both appearances. Light: each bezel has 0.5 pt side borders, so the outer bezels are 40 and 38 wide (x 215..294 and 295..370; outer borders at x=215 and x=370 `#bebebe`) and the pair is 78 wide; the 1 pt between the fills is the two inner side borders side by side (x 294 and 295, `#c0c0c0`), with no toolbar showing between them. Dark: there are no side borders, so the bezels are the fills, 39 and 37 wide, the pair is 77 wide, and the 1 pt between them shows the toolbar (`#3b3c3e`). Each bezel keeps its own four rounded corners, so on the corner rows the fills draw back (x 218..291 and 298..367 at y=128, with the toolbar, `#d9d9d9`, visible at x 294..295). The earlier value of 38 and 36 with a 3 pt gap was read on that corner row | [M] | `10-15-Catalina-Light-Preview.png @ 214,150,160,1`; `10-15-Catalina-Dark-Preview.png @ 214,150,160,1`; corner row `10-15-Catalina-Light-Preview.png @ 214,128,160,1` |
| Icon size | 14 x 10 (28 x 20 px) for the four view icons; 16 x 10 on the selected gallery/column glyph | [M] | glyph boxes x 468..495, 522..549, 574..605, 630..657; y 138..157 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Normal fill, borders | as `toolbar-button` | as `toolbar-button` (`#666768` -> `#626364` here) | [M] | `10-15-Catalina-Light-Finder-Network.png @ 462,125,1,47`; `10-15-Catalina-Dark-Finder-Network.png @ 700,126,1,44` |
| Divider | `#e2e2e2` on a `#fafafa` fill | `#58595a` on `#666768` | [M] | `10-15-Catalina-Light-Finder-Network.png @ 508,130`; `10-15-Catalina-Dark-Finder-Network.png @ 442,130` |
| Selected fill | 0% `#6d6d6d`, 25% `#6a6a6a`, 50% `#686868`, 75% `#666666`, 100% `#646464`; top border `#676767`, bottom border `#5b5b5b` | 0% `#d8d9da` (first row), 2% `#c9cacb`, 5% `#c5c6c7`, 50% `#c2c3c4`, 100% `#c0c0c2` | [M] | `10-15-Catalina-Light-Finder-Network.png @ 570,125,1,47`; `10-15-Catalina-Dark-Finder-Network.png @ 506,126,1,44` |
| Selected glyph | `#ffffff` | `#363638` | [M] | `@ 566,128,50,40`; dark `@ 500,128,50,40` |
| Selected fill, inactive window | flat `#e3e3e3` with a first and last row of `#dfdfdf`, inside the control's `#dbdbdb` outline, on a `#f6f6f6` bar (black at 7.7% and 9.3%) | `#535557` under rows of `#646668` and `#56585a`, no outline, on a `#2b2d2f` bar: white at about 12.7% over each row of the unselected inactive fill (`#3a3c3e` under `#4d4f51` and `#3e4042`) | [M], [C] alphas | `10-15-Catalina-Light-Books.png` column x=1000, y 113..158; `10-15-Catalina-Dark-Books.png` columns x=1000 and x=1300, y 113..158 |
| Selected title, inactive window | `#a4a4a4` on the `#e3e3e3` fill, as dim as the other titles (black at about 28%) | the bar's colour, `#2b2d2f` on `#535557` (black at about 48%) | [M], [C] alphas | most frequent ink colour in `10-15-Catalina-Light-Books.png @ 1010,122,100,28`; `10-15-Catalina-Dark-Books.png @ 1010,122,100,28` |
| Normal glyph / disabled glyph | `#555555` / `#aaaaaa` | `#fafafa` / `#898988` | [M] | light `@ 455,128,50,40`, Forward `@ 182,128,46,40`; dark `@ 389,128,50,40`, `@ 182,128,46,40` |

### Text and icons
Text segments: Calendar 13 pt Regular [C] (Week capital W y=105..123, 19 px including edge AA), `10-15-Catalina-Light-Calendar.png @ 1120,101,30,32`. Measured text colours [M]: light normal `#555555`, selected `#ffffff`; dark normal `#ffffff`, selected `#3a3b3d`. Darkest/lightest ink in `10-15-Catalina-Light-Calendar.png @ 1000,101,80,30`, `10-15-Catalina-Light-Calendar.png @ 1110,101,100,30`, `10-15-Catalina-Dark-Calendar.png @ 1000,101,80,30`, `10-15-Catalina-Dark-Calendar.png @ 1120,102,100,30`.

### Shadows and effects
As `toolbar-button`.

## Layout and spacing
Segments are equal in width; the control is treated as one toolbar item with 8 pt to its neighbours. Icons are centred in each segment.

## Keyboard and accessibility
With Full Keyboard Access the control takes one tab stop; arrow keys move between segments, Space selects [D]. `AXRadioGroup` of `AXRadioButton` (select one) or `AXGroup` of `AXButton`/`AXCheckBox`. ARIA: `role="radiogroup"` with `role="radio"` children and roving tabindex, or a `toolbar` group of toggle buttons.

## Browser notes
Reproducible. Hide the dividers next to the selected segment with `:has()` or by drawing dividers as each segment's `border-inline-start` and removing it on `.selected` and `.selected + *`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Network.png` | 448,122,228,52 | view switcher, column view selected |
| dark | `10-15-Catalina-Dark-Finder-Network.png` | 382,122,228,52 | same |
| light | `10-15-Catalina-Light-Finder-Gallery-View.png` | 448,122,228,52 | last segment selected |
| light | `10-15-Catalina-Light-Preview.png` | 212,122,160,52 | separated style |
| dark | `10-15-Catalina-Dark-Preview.png` | 212,122,160,52 | separated style, dark |
| light | `10-15-Catalina-Light-Finder-Network.png` | 124,122,110,52 | Back/Forward pair |

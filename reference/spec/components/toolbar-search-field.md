# Toolbar search field (`toolbar-search-field`)

- **Status:** present
- **AppKit:** `NSSearchField` hosted in an `NSToolbarItem` (`NSSearchToolbarItem` is 11.0 and not used)
- **HIG:** https://web.archive.org/web/20200503175723/https://developer.apple.com/design/human-interface-guidelines/macos/fields-and-labels/search-fields/ ; https://web.archive.org/web/20200503121036/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/toolbars/
- **Appearances shown:** light, dark

## Purpose and behaviour
A text field for search with a magnifier, placeholder text and, once it has content, a clear button [D]. In a toolbar it is the trailing item. Searching may start as the user types or on Return, and a scope bar can appear under the toolbar to narrow results (see `scope-bar`) [D]. In Finder the typed text can become a token with a criterion pull-down ("Name") [M].

## Anatomy
Textured rounded bezel (identical to `toolbar-button`), magnifier glyph, placeholder or text (left aligned), optional token, clear button, focus ring.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| content | empty (placeholder), text, token + text | empty | `stringValue`, `NSSearchFieldCell` | all three |
| width | flexible; 160 (System Preferences), 238 (Preview), 323 (Finder, Help) | app-defined | `minSize`/`maxSize` | all |
| menu | none, recent-searches menu on the magnifier | none | `searchMenuTemplate` | none shown |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| empty, unfocused | yes | `10-15-Catalina-Light-Finder-Network.png @ 1301,125,648,47` |
| text, unfocused | yes | `10-15-Catalina-Light-Finder-Search.png @ 1707,125,648,47` |
| focused, text | yes | `10-15-Catalina-Light-Help-Search.png @ 1132,70,660,56`; `10-15-Catalina-Light-Preview-Search.png @ 1908,118,490,58` |
| focused, token | yes | `10-15-Catalina-Dark-Finder-Search.png @ 1356,120,658,56` |
| disabled | no | [I] glyph and text at the disabled colour `#aaaaaa` / `#8e9090` |
| inactive window | no | [I] bezel as `toolbar-button` inactive, placeholder unchanged |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Height | 22 fill (y 126..169), 23 with light borders | [M] | `10-15-Catalina-Light-Finder-Network.png @ 1600,125,1,47` |
| Width (fill, at mid-height) | Finder 323 (x 1302..1947); Help 323 (x 1138..1783); Preview 238 (x 1418..1893); System Preferences 160 (x 1112..1431). The Help, Preview and System Preferences rows cited were sampled 4, 2 and 4 px below the bezel top, where the corner curve insets the fill by 1, 2 and 1 px per side (the raw runs are 1139..1782, 1420..1891, 1113..1430) | [M] | `10-15-Catalina-Light-Finder-Network.png @ 1296,148,656,1`; `10-15-Catalina-Light-Help.png @ 1130,80,660,1`; `10-15-Catalina-Light-Preview.png @ 1412,128,486,1`; `10-15-Catalina-Light-System-Preferences-General.png @ 1106,96,330,1` |
| Corner radius | 4.25, on the outer edge of the 0.5 pt border. Least-squares fit with `tools/corner_fit.py`: best 4.25 (rms 1.33 levels; 2.4 at 4, 2.4 at 4.5, 4.2 at 3.75). The earlier value of 4 was a grid reading. Dark, which draws no border, fits 3.75 on the edge of the fill (rms 1.7 levels; 2.3 at 3.5, 3.0 at 4): the same shape as the light fill inside its 0.5 pt border | [C] fit from [M] pixels | `10-15-Catalina-Light-Finder-Network.png @ 1300,124,13,11` (top row full at x=1310, left column full at y=134: 8 px); fit corner `10-15-Catalina-Light-Finder-Network.png @ 1301,125,12,12`; dark fit corner `10-15-Catalina-Dark-Finder-Network.png @ 1448,126,12,12` |
| Magnifier glyph | 12.5 x 12.5 (25 px): lens circle diameter 9.5, stroke 1, handle 4.5 long at 45 degrees, stroke 1.5 | [M] | `10-15-Catalina-Light-Finder-Network.png @ 1313,137,26,25` |
| Magnifier leading inset | 5.5 (x 1313, fill starts 1302) | [M] | same |
| Placeholder / text start | placeholder 27.5 from the fill's leading edge (x 1357, fill from 1302); typed text 23.5 (x 1755, fill from 1708) | [M] | `10-15-Catalina-Light-Finder-Network.png @ 1357,138,82,21`; `10-15-Catalina-Light-Finder-Search.png @ 1755,139,59,24` |
| Clear button | 14 diameter (x 2320..2347), 3 from the trailing fill edge (2353), vertically centred | [M] | `10-15-Catalina-Light-Finder-Search.png @ 2320,134,28,28` |
| Focus ring | 3 outside the bezel, over its border, plus a 0.5 inner line; outer size = field + 6 x 6 | [M] | `10-15-Catalina-Light-Help-Search.png @ 1500,70,1,56` (ring rows 70..75 and 120..125) and `@ 1132,97,7,1` |
| Token (Finder criterion) | two joined parts: criterion "NAME v" 41 wide (x 1414..1495) and value 40 (x 1498..1577), about 16 high, 1 pt gap | [M] | `10-15-Catalina-Dark-Finder-Search.png @ 1414,148,164,1` |
| Insertion point | 1 wide (2 px) | [M] | `10-15-Catalina-Dark-Finder-Search.png @ 1584,148,2,1` |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill gradient | `#fcfcfb` (first row) -> `#f9f9f9` (25%) -> `#f6f6f6` (50%) -> `#f3f3f3` (last rows) | `#818283` (first row), `#6c6d6e`, then `#67686a` -> `#626364` | [M] | `10-15-Catalina-Light-Finder-Network.png @ 1600,126,1,44`; `10-15-Catalina-Dark-Finder-Network.png @ 1800,126,1,44` |
| Border top / sides / bottom | `#c5c5c5` / `#bfbfbf` / `#9e9e9e` | none | [M] | `@ 1600,125`, `@ 1301,148`, `@ 1600,170` |
| Shadow row | `#c5c5c5` on `#cfcfcf` | none | [M] | `@ 1600,171` |
| Magnifier | `#555555` | `#e8e8e8` | [M] | `10-15-Catalina-Light-Finder-Network.png @ 1306,128,60,40`; `10-15-Catalina-Dark-Finder-Network.png @ 1452,128,60,40` |
| Placeholder text | `#aaacab` (Finder), `#9f9ea0` (Safari field) | `#8d8d8e` (Finder), `#909192` (Safari) | [M] | lightest/darkest glyph pixel in `10-15-Catalina-Light-Finder-Network.png @ 1357,138,82,21`; `10-15-Catalina-Dark-Finder-Network.png @ 1495,138,81,20` |
| Typed text | `#555454` (field without the keyboard focus); `#252525` (focused field, the label colour) | `#ffffff` (in the token); `#e8e8e9` (focused field) | [M] | `10-15-Catalina-Light-Finder-Search.png @ 1755,139,59,24`; `10-15-Catalina-Light-Help-Search.png @ 1180,82,110,32`; `10-15-Catalina-Light-Preview-Search.png @ 1960,130,200,34`; `10-15-Catalina-Dark-Finder-Search.png @ 1424,148`; `10-15-Catalina-Dark-Help-Search.png @ 1180,82,110,32` |
| Clear button | disc `#7b7b7b`, cross `#fcfbfb` | disc `#b9b9ba`, cross = fill | [M] | `10-15-Catalina-Light-Finder-Search.png @ 2321,148`, region `@ 2310,128,44,40`; `10-15-Catalina-Dark-Finder-Search.png @ 1975,148` |
| Focus ring, outer 3 pt | `#81a3e3 (sRGB #7aa3e9)` on a `#dfdfdf` bar (= `rgb(35,103,231)` @ 0.5) | `#437198 (sRGB #34719c)` on `#3a3c3d` (= `rgb(76,166,243)` @ 0.5) | [M] colours, [C] recipe | `10-15-Catalina-Light-Help-Search.png @ 1500,72`; `10-15-Catalina-Dark-Finder-Search.png @ 1700,122` |
| Focus ring, inner line | `#91b3f3 (sRGB #8ab3f9)` (top), `#8baeee (sRGB #83aef4)` (bottom) | `#6595be (sRGB #5796c2)` (top), `#5785ae (sRGB #4a85b2)` (bottom) | [M] | `10-15-Catalina-Light-Help-Search.png @ 1500,76`, `@ 1500,119`; `10-15-Catalina-Dark-Finder-Search.png @ 1700,126`, `@ 1700,169` |
| Token, criterion part / value part | not shown in light | `#9f9fa0` / `#848485`, text `#ffffff` / `#ececec` | [M] | `10-15-Catalina-Dark-Finder-Search.png @ 1416,148`, `@ 1500,148`, `@ 1510,148` |

### Text and icons
Text and placeholder: SF Pro Text 13 pt Regular [C] (placeholder cap/x rows y 138..158 in `10-15-Catalina-Light-Finder-Network.png`). Token text: 9 pt Semibold criterion capitals [C] (13 px cap y=143..155), 13 pt value [C] ("A" cap 19 px including edge AA, y=139..157), measured in `10-15-Catalina-Dark-Finder-Search.png @ 1420,130,40,38` and `10-15-Catalina-Dark-Finder-Search.png @ 1510,130,34,38`; criterion stems are 3 px wide [M].

### Shadows and effects
Focus ring as above. It is half transparent and lies over the bezel border, which shows through it while focused: `#5a83c9` under the fill and `#6d97dc` in the shadow row, against `#749de2` for the plain ring [M] (`10-15-Catalina-Light-Help-Search.png @ 1426,120,1,6`). Blue accent only was captured for the ring; other accents: see `focus-ring` / `accent-colors`.

## Layout and spacing
Trailing item, 8 pt from the window edge. The field grows with the window between its minimum and maximum width.

## Keyboard and accessibility
Command-F (or Option-Command-F in Finder) focuses the field; Escape clears, then removes focus; Return searches; Down Arrow opens recent searches when a menu exists [D]. `AXTextField` with subrole `AXSearchField`; the clear button is an `AXButton`. ARIA: `<input type="search">` inside `role="search"`.

## Browser notes
Reset the native search decorations (`-webkit-appearance: none`) and draw the magnifier and clear button as SVG. Ring: `box-shadow: 0 0 0 3px rgba(35,103,231,0.5)` light, `rgba(76,166,243,0.5)` dark, plus a 0.5 px inner line.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Network.png` | 1296,120,660,56 | empty, placeholder |
| dark | `10-15-Catalina-Dark-Finder-Network.png` | 1442,120,660,56 | empty, placeholder |
| light | `10-15-Catalina-Light-Finder-Search.png` | 1702,120,660,56 | text and clear button, unfocused |
| light | `10-15-Catalina-Light-Help-Search.png` | 1126,64,672,68 | focused, text, clear button |
| dark | `10-15-Catalina-Dark-Finder-Search.png` | 1350,114,670,68 | focused, token, insertion point |
| dark | `10-15-Catalina-Dark-Help-Search.png` | 1126,64,672,68 | focused, text |

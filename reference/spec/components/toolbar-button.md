# Toolbar item button, textured rounded (`toolbar-button`)

- **Status:** present
- **AppKit:** `NSButton` with `bezelStyle = .texturedRounded` inside an `NSToolbarItem`
- **HIG:** https://web.archive.org/web/20200503121036/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/toolbars/
- **Appearances shown:** light, dark

## Purpose and behaviour
The push button style reserved for toolbars. Clicking performs an immediate action; it must not keep a selected appearance unless it is a real toggle [D]. Prefer a system template icon over text [D].

## Anatomy
Light: 0.5 pt border (darker at the bottom), white-to-light-grey vertical gradient fill, 0.5 pt soft shadow line under the bottom border, glyph. Dark: no border, flat grey fill with a lighter 0.5 pt top highlight row, glyph.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| content | template image, text ("Done", "Open with Preview", "Calendars"), image + chevron (see `toolbar-pop-up`) | image | `image`, `title` | all |
| width | 25 (Back/Forward), 27 (System Preferences Back/Forward), 36-38 (single glyph), text width + 2 x 8 | 37 | intrinsic | all |
| toggle | momentary, on/off | momentary | `setButtonType(.pushOnPushOff)` | on: Safari Reader button, Photos sidebar |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes | `10-15-Catalina-Light-Finder-Network.png @ 127,125,52,47` |
| disabled | yes | Share and Edit Tags with no selection, `10-15-Catalina-Light-Finder-Network.png @ 903,125,170,47`; Forward (`@ 179,125,52,47`) |
| on (selected) | yes | segment style, see `toolbar-segmented-control`; Reader button `10-15-Catalina-Light-Safari-v13-Reader-Mode.png @ 900,91,58,47` |
| pressed | yes, as the highlighted bezel of a button whose menu is open | Safari's Share button, `10-15-Catalina-Light-Safari-v13-Sharing.png @ 2284,40,80,50`; `10-15-Catalina-Dark-Safari-v13-Sharing.png @ 2300,34,80,48` |
| inactive window | yes | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 470,119,56,46` |
| main, not key | yes | same as normal (`10-15-Catalina-Light-Finder-Quick-Look.png @ 157,307,100,47`) |
| focused (full keyboard access) | no | [I] 3 pt focus ring as on `toolbar-search-field` |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Fill height | 22 (y 126..169) | [M] | `10-15-Catalina-Light-Finder-Network.png @ 135,126,1,44` |
| Outer height incl. light borders | 23 (y 125..170) + 0.5 shadow row (y 171) | [M] | same column, y 125 and 170..171 |
| Fill width, Back | 25 (x 128..177 at y=150) | [M] | `10-15-Catalina-Light-Finder-Network.png @ 127,150,53,1` |
| Fill width, single-glyph buttons | 38 (Finder Share x 904..979), 37 (Safari sidebar x 390..463, Share x 2580..2653, Tabs x 2670..2743), 36 (Preview Share, Markup) | [M] | `10-15-Catalina-Light-Finder-Network.png @ 903,150,78,1`; `10-15-Catalina-Light-Safari-v13.png @ 389,100,76,1` |
| Corner radius | 4.25, on the outer edge of the 0.5 pt border. Least-squares fit with `tools/corner_fit.py`: best 4.25 (rms 1.35 levels; 2.5 at 4, 2.4 at 4.5, 4.3 at 3.75). The earlier value of 4 was a grid reading. Dark, which draws no border, fits 3.75 on the edge of the fill (top-left of Back 3.625 to 3.75, top-right of Forward 3.75; rms 1.4 levels; 2.0 at 3.5, 2.8 to 2.9 at 4): the same shape as the light fill inside its 0.5 pt border | [C] fit from [M] pixels | `10-15-Catalina-Light-Finder-Network.png @ 124,123,14,11` (top border reaches full strength at x=136, side border at y=133: 8 px); dark same crop; fit corner `10-15-Catalina-Light-Finder-Network.png @ 127,125,12,12`; dark fit corners `10-15-Catalina-Dark-Finder-Network.png @ 126,124,14,14` and `@ 218,124,14,14` |
| Glyph box, chevron (Back) | 7 x 12 (14 x 24 px), stroke 1.5, vertex at the leading side | [M] | `10-15-Catalina-Light-Finder-Network.png @ 146,136,14,24` |
| Back chevron as SVG (pt, origin = glyph box top-left) | `M 6 0.5 L 0.75 6 L 6.25 11.5` stroke-width 1.5, round caps | [C] | from the same grid: ends at px (157,136.5) and (158.5,158.5), vertex (146.5,147.5) |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill gradient, normal | 0% `#f8f8f8` (first row), 2% `#fcfcfc`, 5% `#fafafa`, 25% `#f9f9f9`, 50% `#f6f6f6`, 75% `#f5f5f5`, 95% `#f2f2f2`, 100% `#ececeb` (last row) | 0% `#777879` (first row), 2% `#676869`, 5% `#616162`, 50% `#5f5f60`, 95% `#5c5d5e`, 100% `#595a5b` (last row) | [M] | column x=135, y 126, 127, 128, 133, 148, 158, 168, 169 in `10-15-Catalina-Light-Finder-Network.png` and `10-15-Catalina-Dark-Finder-Network.png` |
| Border top | `#c5c5c5` | none | [M] | `@ 135,125` |
| Border sides | `#bdbdbd` on a `#d3d3d3` bar | none | [M] | `@ 127,150`, `@ 178,150` |
| Border bottom | `#a1a1a1` | none | [M] | `@ 135,170` |
| Shadow row under the border | `#c7c7c7` on `#cecece`: black at about 0.034, computed as 1 − 199/206. `rgba(0,0,0,0.03)` is that figure rounded to two decimals, the value to build with (it gives 199.8 against the measured 199). Until 3 October 2026 this row read "= black @ 0.03" under the [C] tag | none | [M] the two colours; [C] 0.034; [I] 0.03 to build with | `@ 135,171`; the bar beside the button `10-15-Catalina-Light-Finder-Network.png @ 120,171` |
| Dark fill in other windows | n/a | Safari `#6a6b6d` -> `#666769` with top rows `#848587`, `#6f7072`; Preview `#6b6b6e` to `#737275` (lighter where light content scrolls under the bar) | [M] | `10-15-Catalina-Dark-Safari-v13.png @ 300,92,1,44`; `10-15-Catalina-Dark-Preview.png @ 132,128,65,1` |
| On (selected) fill | `#6d6d6d` -> `#646464`, top border `#676767`, bottom border `#5b5b5b` | `#c5c6c7` -> `#c0c0c2`, top rows `#d8d9da`, `#c9cacb` | [M] | `10-15-Catalina-Light-Finder-Network.png @ 570,125,1,47`; `10-15-Catalina-Dark-Finder-Network.png @ 506,126,1,44` |
| Inactive window | fill = bar `#f6f6f6`; 0.5 pt outline `#dcdcdc` top, `#dbdbdb` bottom, `#e1e1e1` sides | fill `#3a3b3e` on a `#2b2c2f` bar, top rows `#4d4e51`, `#3e3f42` | [M] | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 480,119,1,46`, `@ 472,124`; `10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png @ 520,94,1,44` |
| Pressed | fill `#e5e5e5` -> `#d6d6d6` under two first rows `#f2f2f2`, `#ebebeb`, last row `#d1d1d1`, inside the resting border; glyph `#222222`. The open menu's shadow lies over the button's lower half: without it `#e5e5e5` -> `#dfdfdf`, last row `#d9d9d9` [C] | fill `#838486` -> `#767779` under two first rows `#989a9d`, `#868a8a`, no border; glyph `#f7f9fa`: white at 48%, 39%, 36.6% to 35.6% over the bar without the shadow [C] | [M] | Safari's Share button while its menu is open: `10-15-Catalina-Light-Safari-v13-Sharing.png @ 2330,50,1,46`, `@ 2376,64`; `10-15-Catalina-Dark-Safari-v13-Sharing.png @ 2346,35,1,44`, `@ 2394,58`. Until 6 October 2026 this row was [I]: `#dcdcdc` -> `#d2d2d2`, Dark `#787979` |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Glyph colour, enabled | `#565656` (= black @ 0.65 on the fill) | `#f3f5f4` to `#fafafa` | [M] | `10-15-Catalina-Light-Finder-Network.png @ 149,150`; darkest/lightest pixel in `@ 130,128,46,40` (dark) |
| Glyph colour, disabled | `#aaaaaa` | `#8e9090` | [M] | lightest glyph pixel in `10-15-Catalina-Light-Finder-Network.png @ 907,128,70,40`; `10-15-Catalina-Dark-Finder-Network.png @ 841,128,70,40` |
| Glyph colour, on | `#ffffff` | `#363638` | [M] | `10-15-Catalina-Light-Finder-Network.png @ 566,128,50,40`; `10-15-Catalina-Dark-Finder-Network.png @ 500,128,50,40` |
| Glyph colour, inactive window | `#b0b1b1` | `#7b7c7f` | [M] | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 470,122,50,44`; `10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png @ 500,96,50,44` |
| Text label inside a button | 13 pt Regular, colour as glyph (`#262626` in Quick Look's white buttons) | 13 pt, near white | [C], [M] | "Open with Preview" `10-15-Catalina-Light-Finder-Quick-Look.png @ 2876,108,270,38`; "Done" `10-15-Catalina-Light-Preview-Search.png @ 2304,199,76,36` |

### Shadows and effects
Only the 0.5 pt shadow row under the light bezel. No focus ring is captured.

## Layout and spacing
Centre the glyph in the fill. 8 pt between neighbouring buttons; a Back/Forward pair touches (see `toolbar-segmented-control`). Text buttons use 8 pt horizontal padding [C] ("Done" in Preview: text 27 pt in a 42 pt button, estimate).

## Keyboard and accessibility
Space activates when focused (Full Keyboard Access). `AXButton` with the item label as title; toggles expose `AXValue` 0/1 (`aria-pressed`). Every button needs an accessible name because it shows only a glyph.

## Browser notes
Fully reproducible. The fitted radii belong to different edges: 4.25 is the outer edge of the light 0.5 pt border, 3.75 the edge of the fill (light inside its border, and dark, where there is no border). So the radius to write depends on how the border is drawn. With the border as an outer spread shadow, the element is the fill: `border-radius: 3.75px` with `box-shadow: 0 0 0 0.5px #bdbdbd, 0 0.5px 0 0.5px #a1a1a1, 0 1px 0 0 rgba(0,0,0,0.03)` (the 0.5px spread carries the outer corner to 4.25px; 4.25px on the element would make it about 4.75px). With real 0.5 px borders (top `#c5c5c5`, sides `#bdbdbd`, bottom `#a1a1a1`), the element is the border box: `border-radius: 4.25px`. Dark has no border: `border-radius: 3.75px`. Fill `linear-gradient(#fcfcfc, #f2f2f2)`. The recipe's colours are the measured values of the Colours table [M], in `10-15-Catalina-Light-Finder-Network.png`: border top `#c5c5c5` `@ 135,125`, sides `#bdbdbd` `@ 127,150`, bottom `#a1a1a1` `@ 135,170`; fill `#fcfcfc` `@ 135,127` and `#f2f2f2` `@ 135,168`, the 2% and 95% stops of the measured gradient; the shadow row is `#c7c7c7` `@ 135,171` on a bar that is `#cecece` `@ 120,171` on the same row outside the button, which makes the shadow black at about 0.034, computed [C] from those two (1 − 199/206); the recipe's `rgba(0,0,0,0.03)` is that figure rounded to two decimals, a value to build with [I] and not the computed one (until 3 October 2026 this sentence called 0.03 itself computed). The window-chrome batch builds this control with 4px after its own rendered comparison; that is an adopted engineering value, not a measurement, and 4.25 / 3.75 remain the fitted figures.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Network.png` | 124,122,110,52 | Back (enabled) and Forward (disabled) |
| dark | `10-15-Catalina-Dark-Finder-Network.png` | 124,122,110,52 | same |
| light | `10-15-Catalina-Light-Finder-Network.png` | 900,122,176,52 | Share and Edit Tags, disabled |
| light | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png` | 466,116,180,52 | inactive-window rendering |
| dark | `10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png` | 496,90,180,52 | inactive-window rendering |

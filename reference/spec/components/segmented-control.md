# Segmented Control, in-content styles (`segmented-control`)

- **Status:** present
- **AppKit:** `NSSegmentedControl`; `segmentStyle` = `.rounded` (default in content), `.separated`, `.smallSquare`; `trackingMode` = `.selectOne`, `.selectAny`, `.momentary`; `controlSize`
- **HIG:** https://web.archive.org/web/20200503185450/https://developer.apple.com/design/human-interface-guidelines/macos/selectors/segmented-controls/
- **Appearances shown:** light, dark

Scope: the styles used inside window content. Toolbar styles are `toolbar-segmented-control`; the tab strip of a tab view (a select-one rounded segmented control whose selected segment is accent-filled) is measured in `tab-view`; the small-square style is `gradient-button`.

Short file names: `L-SP-<Pane>` / `D-SP-<Pane>` = `10-15-Catalina-Light-System-Preferences-<Pane>.png` / Dark; `L-<Name>` = `10-15-Catalina-Light-<Name>.png`.

## Purpose and behaviour
A segmented control is a horizontal set of two or more segments, each of which works as a button. It offers closely related choices that affect an object, state or view. It can allow one selection (like radio buttons), any combination (like checkboxes) or act as a group of momentary buttons. Segments hold text or icons, not both mixed within one control; keep segment widths equal where possible; a label may introduce the control. [D] (HIG, Segmented Controls)

## Anatomy
One `push-button` bezel (halo, 0.5 pt translucent edge, flat fill, two shadow rows) divided by 1 pt vertical divider lines into segments; each segment holds a centred glyph or title. In the separated style every segment is its own bezel and neighbours are 1 pt apart.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| segmentStyle | rounded, separated, smallSquare | rounded | `segmentStyle` | rounded and separated (smallSquare: see `gradient-button`) |
| trackingMode | selectOne, selectAny, momentary | selectOne | `trackingMode` | momentary here; selectOne in `tab-view` |
| controlSize | regular, small, mini | regular | `controlSize` | regular and mini |
| segment content | text, template image, image + menu (Action) | - | `setLabel`, `setImage`, `setMenu` | all three |
| per-segment enabled | true, false | true | `setEnabled(_:forSegment:)` | both |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| rounded, momentary, normal | yes, light + dark | `L-SP-Desktop-and-Screen-Saver @ 176,1038,102,43`; `D-SP-Desktop-and-Screen-Saver @ 176,1038,102,43`; `L-Finder-Connect-to-Server @ 152,456,198,43` |
| segment disabled | yes, light + dark | remove segment in the same crops |
| separated, normal and disabled segment | yes, light | `L-SP-Screen-Time @ 1154,214,232,43` (third segment disabled) |
| mini rounded | yes, light | `L-Print @ 279,868,134,30` |
| selected (selectOne / selectAny) | not shown for the in-content rounded style outside tab views | accent-filled segment: use the `tab-view` measurements (same control) [I] |
| pressed | not shown | [I] the pressed segment takes the accent gradient of `default-button` with a white glyph, as a selected tab does |
| inactive window | not shown | [I] momentary: unchanged; selected segment: accent replaced by a grey fill (see `tab-view`) |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Height, regular (edge to edge) | 20 | [M] | `L-SP-Desktop-and-Screen-Saver` col x=190: edge `#c0c0c0` y=1039, fill y 1040..1077, edge `#a7a7a7` y=1078; `L-SP-Screen-Time` col x=1168: edge y=215, edge y=254 |
| Height, mini | 14 | [M] | `L-Print` col x=290: edge y=869, fill y 870..895 (26 px), edge y=896 |
| Corner radius, regular | 3.75, on the outer edge of the 0.5 pt border (same bezel as `push-button`). Fitted in light only: least-squares fit with `tools/corner_fit.py`: best 3.75 (rms 2.4 levels; 3.4 at 3.5, 3.7 at 4), halo 4.25 (rms 1.8). Dark is not fitted and takes 3.75 from the light fit, which is inferred (this row carried one [C] tag for both appearances until 3 October 2026). The earlier value of 4 was a grid reading | [C] light, fit from [M] pixels; [I] dark, taken from the light fit | `L-SP-Desktop-and-Screen-Saver` grid `@ 174,1036,8,8` shows the same corner pixel pattern as the push button grid `10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 1149,857,12,12` (edge pixels at x=180..181 on y=1039, x=179..180 on y=1040, x=178..179 on y=1041, x=177..178 on y=1042); fit corner `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 177,1039,10,10` |
| Divider | 1 wide (2 px), full fill height, no gap at top or bottom | [M] | `L-SP-Desktop-and-Screen-Saver` row y=1059: `#e5e5e5` x 226..227; col x=226: `#e5e5e5` y 1040..1077 |
| Segment width, icon segments | 24 (add / remove pair), 27 (Connect to Server), 41 (Action gear + chevron) | [M] | `L-SP-Desktop-and-Screen-Saver` row y=1059: fill x 178..225 and x 228..275; `L-Finder-Connect-to-Server` row y=477: fill x 154..207, 210..263, 266..347 |
| Whole control, add / remove pair | 50 wide (edge to edge) | [M] | `L-SP-Desktop-and-Screen-Saver` row y=1059: edges x=177 and x=276 |
| Glyph, add / remove | 11 x 11 plus, 11 x 1 minus, 1 pt strokes, centred in the segment | [M] | `L-SP-Desktop-and-Screen-Saver @ 190,1048,22,22` (plus), `@ 242,1058,22,2` (minus); see `gradient-button` |
| Separated style: segment widths and gap | 23, 67, 23; 1 pt between neighbouring edges (2 px, filled by the two halos `#f8f8f8`) | [M] | `L-SP-Screen-Time` row y=222: edges x=1155 and 1200; 1203 and 1336; 1339 and 1384 |
| Mini rounded: segment width, divider | 32 each, 1 pt divider; control 66 wide | [M] | `L-Print` row y=872: edge x=280, fill x 281..344, divider `#e5e5e5` x 345..346, fill x 347..410, edge x=411 |
| Title metrics (text segments) | 13 pt regular, baseline 14.5 below the top edge, as `push-button` | [I] | no text segment was measured outside `tab-view`; the Today segment in Screen Time uses 13 pt text by inspection only |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill | `#ffffff` | `#686869` in a box `#363637` (`rgba(255,255,255,0.25)`), highlight rows `#868687`, `#6e6e6f` | [M] | `L-SP-Desktop-and-Screen-Saver @ 180,1059`; `D-SP-Desktop-and-Screen-Saver` col x=190 y 1040..1077 |
| Edge top / side / bottom, halo, shadow rows | as `push-button`: `#c0c0c0` / `#b9b9b9` / `#a7a7a7` on `#e3e3e3`; shadow `#c9c9c9`, `#d9d9d9` | as `push-button`: outline `#313132` top, `#2f2f30` side, `#2b2b2c` bottom on `#363637` | [M] | `L-SP-Desktop-and-Screen-Saver` col x=190 y 1038..1080, row y=1059 x 176..177; `D-SP-Desktop-and-Screen-Saver` col x=190, row y=1059 x=177 |
| Divider | `#e5e5e5` (black 0.10 over white) | `#585859` (black 0.15 over the fill); its top two rows `#717172`, `#5d5d5d` | [M] | `L-SP-Desktop-and-Screen-Saver @ 226,1059`; `D-SP-Desktop-and-Screen-Saver` col x=226 y 1040..1077 |
| Glyph, enabled | `#262626` | `#e8e8e9` | [M] | `L-SP-Desktop-and-Screen-Saver @ 200,1059`; `D-SP-Desktop-and-Screen-Saver @ 200,1059` |
| Glyph, disabled segment | `#bfbfbf` (black 0.25 over white) | `#8e8e8e` (white 0.25 over the fill) | [M] | `L-SP-Desktop-and-Screen-Saver @ 250,1059`; `D-SP-Desktop-and-Screen-Saver @ 250,1059` |
| Separated style, enabled segment edge (on white) | top `#d8d8d8`, side `#d4d4d4`, bottom `#bcbcbc`; shadow row `#e1e1e1` | not shown | [M] light | `L-SP-Screen-Time` col x=1168 y 215, 254, 255; row y=222 x=1155 |
| Separated style, disabled segment edge | side `#e9e9e9` (about half the enabled edge alpha) | not shown | [M] light | `L-SP-Screen-Time` row y=222 x=1339, 1384 |
| Mini rounded on the Print sheet | fill `#ffffff`; edges composite over the sheet (`#97a6b6 (sRGB #94a6b8)` top, `#858f9e (sRGB #838fa0)` bottom); divider `#e5e5e5` | composite fill `#667184 (sRGB #647186)`; top outline `#2b3e53 (sRGB #263e55)` and highlight `#858c9c (sRGB #848c9e)`; bottom outline `#2a3347 (sRGB #283349)`; divider `#545e6b (sRGB #525e6c)` | [M] | 10-15-Catalina-Light-Print.png @ 290,869; 10-15-Catalina-Light-Print.png @ 290,896; 10-15-Catalina-Light-Print.png @ 345,872; 10-15-Catalina-Dark-Print.png @ 202,845; 10-15-Catalina-Dark-Print.png @ 202,839; 10-15-Catalina-Dark-Print.png @ 202,840; 10-15-Catalina-Dark-Print.png @ 202,866; 10-15-Catalina-Dark-Print.png @ 259,842 |

### Shadows and effects
Same halo and two shadow rows as `push-button` under the whole control. [M] `L-SP-Desktop-and-Screen-Saver` col x=190: y=1038 `#dddddd`, y=1079 `#c9c9c9`, y=1080 `#d9d9d9`.

## Layout and spacing
- Add / remove pair under a list that has no attached bar: left edge aligned with the list's left edge, top edge 7.5 pt below the list frame. [M] `L-SP-Desktop-and-Screen-Saver`: list frame bottom y=1023 (`@ 176,488,1208,536`), control top edge y=1039; list left x=176, control edge x=177.
- In Connect to Server the add / remove / Action control starts 20.5 pt from the window's left edge and shares the row with the help button and the push buttons. [M] `L-Finder-Connect-to-Server` row y=477: control edges x=153 and x=348; window frame left x=112.
- Equal-width text segments size to the widest title plus 10 pt padding each side. [D] (AppKit `segmentDistribution = .fillEqually` is the 10.13+ default)

## App-specific variant: Contacts card tabs
`10-15-Catalina-Light-Contacts.png @ 1173,246,424,40`: a flat two-segment selector ("Info", "Picture") 212 x 20 pt with a 0.5 pt `#e5e5e5` outline and no shadow; the selected segment is filled `#f5f5f5`, the other is white; title ink is `#000000` in the selected half and `#262626` in the other. [M] row y=255: outline x=1173 and x=1596, selected fill x 1175..1385, white x 1386..1594, ink `#000000` x 1282..1285, ink `#262626` x 1467..1468; col x=1250: outline y=246 and y=285. This is not a system style; it has an inventory row and a spec of its own, `capsule-segmented-control`, which measures it in full (215 pt wide at mid-height).

## Keyboard and accessibility
With focus: Left / Right move between segments, Space activates or toggles. AppKit role `AXRadioGroup` with `AXRadioButton` children for selectOne, `AXGroup` of `AXCheckBox` for selectAny, `AXButton` for momentary. Web: `role="radiogroup"`, a toolbar of `aria-pressed` buttons, or plain buttons respectively. [D]

## Browser notes
The divider is inset from nothing (full height) but must not overlap the 0.5 pt edge; draw it as a 1 px wide element between segments rather than as a border, so that hover/pressed fills of a segment do not cover it inconsistently.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png` | 176,1038,102,43 | rounded add / remove pair, remove disabled |
| light | `10-15-Catalina-Light-Finder-Connect-to-Server.png` | 152,456,198,43 | add, remove (disabled), Action |
| light | `10-15-Catalina-Light-System-Preferences-Screen-Time.png` | 1154,214,232,43 | separated style, on white |
| light | `10-15-Catalina-Light-Print.png` | 279,868,134,30 | mini rounded page navigation |
| dark | `10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png` | 176,1038,102,43 | rounded add / remove pair |

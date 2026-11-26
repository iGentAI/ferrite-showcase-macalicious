# Pop-Up Button (`pop-up-button`)

- **Status:** present
- **AppKit:** `NSPopUpButton` with `pullsDown = false`, `bezelStyle = .rounded`; cell `NSPopUpButtonCell`, `arrowPosition = .arrowAtBottom` draws the double arrow; `controlSize` regular / small / mini
- **HIG:** https://web.archive.org/web/20200503110755/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/pop-up-buttons/
- **Appearances shown:** light, dark (blue accent; other accents in `accent-colors`)

Short file names: `L-SP-<Pane>` = `10-15-Catalina-Light-System-Preferences-<Pane>.png`, `D-SP-<Pane>` = the Dark file, `L-<Name>` / `D-<Name>` = `10-15-Catalina-Light-<Name>.png` / `10-15-Catalina-Dark-<Name>.png`.

## Purpose and behaviour
A pop-up button shows the current choice from a list of mutually exclusive items and, when clicked, opens a menu on top of the button with the current item positioned over the button and marked with a checkmark. A double-arrow indicator hints that the menu extends both ways. Use it for a list of things or states, not commands (commands go in a `pull-down-button`). Introduce it with a label in sentence case that ends in a colon; menu items use title case. The menu stays open until an item is chosen or the user clicks elsewhere. [D] (HIG, Pop-Up Buttons)

## Anatomy
```
  0.5 edge                                       cap 16 (+0.5 edge)
  .---------------------------------------.---------.
  | 9  Title                              |   /\    |  20 pt body
  |                                       |   \/    |
  '---------------------------------------'---------'
```
Back to front: halo and shadow rows (as `push-button`); bezel with the `push-button` edge and fill for the title part; an accent-coloured cap that fills the trailing 16 pt, shares the bezel's corner radius on its two outer corners and has no separator line against the white part; the white double-chevron glyph centred in the cap; the title, optionally preceded by a 16 pt image.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| controlSize | regular, small, mini | regular | `controlSize` | regular and small |
| enabled | true, false | true | `isEnabled` | both |
| title content | text; image + text; colour chip + text | text | `NSMenuItem.title`, `.image` | all three (`L-SP-General`) |
| bordered | true; false (text and double arrow only, used in table cells and inline) | true | `isBordered` | both: bordered everywhere; borderless in `10-15-Catalina-Light-System-Preferences-Sharing.png @ 1204,632,196,100` and `10-15-Catalina-Light-Contacts.png` (blue label pop-ups, owned by the Contacts blueprint) |
| width | fixed by layout (does not track the title) | - | frame | yes |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, key window, regular | yes, light + dark | `L-SP-General @ 612,412,300,43`; `D-SP-General @ 612,412,316,43` |
| normal, small | yes, light + dark | `L-Finder-Get-Info @ 142,1176,470,37`; `D-Finder-Get-Info @ 142,1176,470,37` |
| disabled | yes, light + dark | `L-SP-Desktop-and-Screen-Saver @ 774,1038,416,43`; `D-SP-Desktop-and-Screen-Saver @ 774,1038,416,43`; `L-Calendar-Preferences @ 538,1078,362,43` |
| open (menu shown) | the button is hidden by its menu | `10-15-Catalina-Light-Print.png` (Presets menu); see `menu` |
| pressed | not shown | [I] the cap gradient darkens about 12% while the mouse is down, the white part is unchanged |
| inactive window | not shown in any screenshot | [I] the cap loses the accent: it is drawn like the rest of the bezel (white in light, `rgba(255,255,255,.25)` in dark) and the chevrons use the title colour (`rgba(0,0,0,.85)` / `rgba(255,255,255,.85)`). Basis: the disabled rendering measured below has exactly this un-tinted cap, and AppKit uses the same un-tinted cap for inactive windows |
| focused | not shown | [I] `focus-ring` around the whole bezel |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Body height, regular (edge to edge) | 20 | [M] | `L-SP-General` col x=626: edge y=413, fill y 414..451, edge y=452; cap col x=895: `#5b93f3 (sRGB #4c92fa)` y=413, `#2266f6 (sRGB #0462ff)` y=452 |
| Body height, small | 17 | [M] | `L-Finder-Get-Info` col x=156: edge y=1177, fill y 1178..1209, edge y=1210 |
| Body height, mini | 14 | [I] | AppKit mini metric; not shown |
| Corner radius | 3.75, on the outer edge of the 0.5 pt border, all four corners: the `push-button` bezel. Least-squares fit with `tools/corner_fit.py`: the white corner fits 3.75 (rms 2.2 levels; 2.9 at 3.5, 3.1 at 4) and its halo 4.25 (rms 1.4); the cap corner, with its gradient taken as flat, fits 3.5 (rms 3.5; 5.1 at 3.75, 5.4 at 3.25) and its halo 4 (rms 2.6), so 3.5 to 3.75 is supported there. The earlier value of 4 was a grid reading | [C] fit from [M] pixels | `L-SP-General` grids `@ 611,411,12,12` (white corner) and `@ 899,411,14,12` (cap corner: right edge straight from y=420); fit corners `10-15-Catalina-Light-System-Preferences-General.png @ 613,413,12,12` and `@ 901,413,10,10` |
| Cap width, regular | 16 + 0.5 edge = 16.5 (33 px) | [M] | `L-SP-General` row y=433: white ends x=877, cap `#4b89f5 (sRGB #3987fd)` x 878..909 (excluding glyph ink), edge `#3b7bf4 (sRGB #2679fd)` x=910 |
| Cap width, small | 14 + 0.5 = 14.5 (29 px) | [M] | `L-Finder-Get-Info` row y=1194: white ends x=581, cap x 582..609, edge x=610 |
| Cap width, dark regular | 16, with the 0.5 dark outline outside it | [M] | `D-SP-General` row y=434: fill `#636465` ends x=893, cap `#2c66d2 (sRGB #1764da)` x 894..925 (32 px), outline `#262728` x=926 |
| Separator between title area and cap | none | [M] | `L-SP-General` row y=433: `#ffffff` x=877 directly followed by `#4b89f5 (sRGB #3987fd)` x=878 |
| Double chevron bounds, regular (relative to the cap's top-left edge corner) | x 4.5..12.0, y 4.0..16.0 (15 x 24 px); each chevron 15 x 9 px, 6 px apart | [M] | `L-SP-General @ 887,421,15,24` (cap box starts x=878, y=413) |
| Double chevron bounds, small | x 4.0..10.5, y 3.5..13.5 (13 x 20 px); each chevron 13 x 8 px, 4 px apart | [M] | `L-Finder-Get-Info @ 590,1184,13,20` (cap box starts x=582, y=1177) |
| Chevron stroke | 1.2 (2.4 px measured perpendicular), 45 degree arms, butt ends, mitred apex | [C] | horizontal run `fff6` = 3.4 px at 45 degrees in mask row 428 |
| Chevron path, regular (pt, origin = cap top-left edge corner, cap box 16.5 x 20) | up: `M 5.25 7.95 L 8.25 4.95 L 11.25 7.95`; down: `M 5.25 12.05 L 8.25 15.05 L 11.25 12.05`; `stroke-width: 1.2; fill: none` | [C] | centre line fitted to the mask below |
| Chevron path, small (cap box 14.5 x 17) | up: `M 4.5 6.9 L 7.0 4.4 L 9.5 6.9`; down: `M 4.5 10.1 L 7.0 12.6 L 9.5 10.1`; `stroke-width: 1.1` | [C] | fitted to `L-Finder-Get-Info @ 590,1184,13,20` |
| Title inset (edge to first ink), regular | 9.5 (title box starts 9 pt from the edge) | [M] | `L-SP-General` Medium: edge x=613, ink x=632; Recent items `10`: edge 613, ink 636 (digit side bearing) |
| Title inset with a leading image or chip | image or chip starts 8.5 from the edge; text starts 5 after it; icon height 16 | [M] | `L-SP-General` row y=434: chip x 630..677 (24 pt wide colour chip), text ink x=688; Safari icon + title blob `@ 630,922,108,32` |
| Title font and baseline, regular | 13 pt regular; baseline 14.5 below the top edge | [C] / [M] | `L-SP-General @ 632,486,93,20`: `M` y 487..505 (19 px cap), top edge y=477 |
| Title font and baseline, small | 11 pt regular; baseline 12.5 below the top edge | [C] / [M] | `L-Finder-Get-Info @ 200,1186,180,16`: caps y 1186..1201 (16 px), top edge y=1177 |
| Widths seen (edge to edge) | 64.5 (`10`), 80 (`5 secs`), 85.5 (`zoom`), 106.5 (Genie effect), 149 (General pane), 157 (dark General pane), 161 (Mission Control), 204 (Language & Region), 234 (Get Info, small) | [M] | `L-SP-General` rows y=1216 (x 613..741) and y=434 (613..910); `L-SP-Keyboard @ 734,526,162,43`; `L-SP-Dock @ 1121,593,173,43`, `@ 643,484,215,43`; `D-SP-General` row y=434 (613..926); `L-SP-Mission-Control @ 548,700,324,43`; `L-SP-Language-and-Region @ 903,400,410,43`; `L-Finder-Get-Info` row y=1194 (143..610) |

Double-chevron coverage mask, regular size (hex digit = coverage of white, one character per device pixel), origin `10-15-Catalina-Light-System-Preferences-General.png @ 887,421`, 15 x 24 [M]:
```
0000008f8000000
000009fff900000
00008fffff80000
0008fff9fff8000
008fff505fff800
07fff50005fff80
7fff6000006fff7
fff600000006fff
af60000000006fa
000000000000000   (6 empty rows)
af60000000006fa
fff600000006fff
7fff6000006fff7
07fff50005fff80
008fff505fff800
0008fff9fff8000
00008fffff80000
000009fff900000
0000008f8000000
```

### Colours and fills (blue accent)
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title-area fill, edge, halo, shadow rows | identical to `push-button` (white; edge `#c8c8c8` / `#c1c1c1` / `#aeaeae` on `#ececec`) | identical to `push-button` (`rgba(255,255,255,.25)` -> `#636465` on `#2f3031`; highlight rows `#828383`, `#696a6a`) | [M] | `L-SP-General` col x=626 y 412..454; `D-SP-General` col x=627 y 412..454 |
| Cap gradient | `0% #77a6f4 (sRGB #6ca6fb)`, `27% #6499f5 (sRGB #5698fc)`, `51% #4b89f5 (sRGB #3987fd)`, `76% #3579f6 (sRGB #1c77ff)`, `100% #286ef6 (sRGB #076bff)` (same as `default-button`) | `0% #6998e8 (sRGB #5d97ef)` (0.5 pt highlight), `3% #3874df (sRGB #2472e7)`, `5% #2e6bde (sRGB #1869e6)`, `51% #2c66d2 (sRGB #1764da)`, `100% #2960c6 (sRGB #155ecd)` | [M] | `L-SP-General` col x=908 y 416..450 and col x=895; `D-SP-General` col x=899 y 414..451 (x=923 intersects the rounded corner at the first and last fill rows and is not a valid gradient sample) |
| Cap top / right / bottom edge | `#5b93f3 (sRGB #4c92fa)` / `#3b7bf4 (sRGB #2679fd)` at mid height / `#2165f6 (sRGB #0361ff)` | dark outline `#28292a` / `#262728` / `#232324` outside the cap | [M] | `L-SP-General @ 895,413`, `@ 910,433`, `@ 899,452`; `D-SP-General @ 910,413`, `@ 926,434`, `@ 910,452` |
| Chevrons | `#ffffff` | `#dee8f9 (sRGB #dce8fb)` at stroke centre over `#2d6adb (sRGB #1668e3)` = `rgba(255,255,255,0.85)` | [M], [C] | `L-SP-General @ 895,423`; `D-SP-General @ 910,422` |
| Disabled: fill | `rgba(255,255,255,0.5)`: `#f1f1f1` on `#e3e3e3`, `#f6f6f6` on `#ececec`, cap not tinted | `rgba(255,255,255,0.125)`: `#4f4f50` on `#363637`, `#4a4a4c` on `#303032` | [M], [C] | `L-SP-Desktop-and-Screen-Saver` row y=1059 x 1148..1187; `L-Calendar-Preferences` row y=1098 x 870..897; `D-SP-Desktop-and-Screen-Saver` row y=1059; `D-Calendar-Preferences` row y=1098 |
| Disabled: edge | side `#cfcfcf` on `#e3e3e3`, `#d6d6d6` on `#ececec` (black 0.09) | side `#323334` on `#363637` | [M] | `L-SP-Desktop-and-Screen-Saver @ 1188,1059`; `L-Calendar-Preferences @ 898,1098`; `D-SP-Desktop-and-Screen-Saver @ 1188,1059` |
| Disabled: chevrons | `#919191` on `#f1f1f1` = `rgba(0,0,0,0.40)` (the disabled `pull-down-button` and `combo-box` chevrons give the same alpha) | `#7b7b7c` on `#4f4f50` = `rgba(255,255,255,0.25)` | [M], [C] | `L-SP-Desktop-and-Screen-Saver` col x=1172 y 1047..1070 and mask `@ 1165,1047,15,24`; `D-SP-Desktop-and-Screen-Saver` col x=1172 y 1047..1070 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title colour | `#262626` = `rgba(0,0,0,0.85)` | `#e8e8e8` on `#636465` = `rgba(255,255,255,0.85)` | [M], [C] | `L-SP-General @ 723,505` (346 px of `#262626` in `@ 618,480,250,34`); `D-SP-General @ 723,505` |
| Title colour, disabled | `#b5b5b5` on `#f1f1f1`, `#b8b8b8` on `#f6f6f6` = `rgba(0,0,0,0.25)` | `#7b7b7c` on `#4f4f50` = `rgba(255,255,255,0.25)` | [M], [C] | `L-SP-Desktop-and-Screen-Saver @ 795,1059` (`E` stem); `L-Calendar-Preferences @ 558,1098` (`C` stem); `D-SP-Desktop-and-Screen-Saver @ 795,1059` |
| Colour chip in the title (Highlight color) | 24 pt wide, fill `#b9d6fc (sRGB #b3d6ff)`, 0.5 pt edge `#8ca2bd (sRGB #87a2c0)` | fill `#466388 (sRGB #3f638b)`, edge `#7489a6 (sRGB #6f89a9)` | [M] | `L-SP-General` row y=434 x 630..677; `D-SP-General` row y=434 x 630..677 |
| Truncation | tail ellipsis before the cap | same | [D] | `NSPopUpButtonCell` default line break mode |

### Shadows and effects
Same halo and shadow rows as `push-button`, continuous under the cap. [M] `L-SP-General` col x=895: y=412 `#e6e6e6`, y=453 `#d0d0d0`, y=454 `#e3e3e3`.

## Layout and spacing
| Rule | Value (pt) | Tag | Evidence |
|---|---|---|---|
| Label (right-aligned, ends with a colon) to pop-up edge | 9.5 (AppKit: 8 pt between the label box and the control's alignment rect) | [M] | `L-SP-General`: `Sidebar icon size:` ink ends x=593, pop-up edge x=613 |
| Baselines | label baseline = title baseline, within 0.5 pt | [M] | `L-SP-General`: label ink rows y 486..506 (`@ 383,486,211,21`), title cap rows y 487..505 |
| Vertical pitch of stacked pop-ups | 32 (General), 31 (Language & Region), 28 (Mission Control box) | [M] | `L-SP-General`: tops y=412, 476; `L-SP-Language-and-Region`: 400, 462, 524; `L-SP-Mission-Control`: 700, 756, 812 |
| Inline in a sentence (checkbox title, pop-up, trailing text) | 7 before and 7 after (ink to edge), baselines aligned | [M] | `L-SP-Keyboard`: checkbox title ink ends x=720 (`@ 288,532,433,30`), pop-up edge x=735; pop-up edge x=894, trailing text ink x=909 |
| Menu position when open | the selected item's text sits exactly over the title; menu extends past both edges | [D] | HIG; see `menu` |

## Keyboard and accessibility
With focus (Full Keyboard Access): Space, Up or Down opens the menu; in the menu, arrows move, Return or Space chooses, Escape closes, typing selects by prefix. AppKit role `AXPopUpButton`, value = the selected title. Web: the ARIA "select-only combobox" pattern (`role="combobox"` + `aria-haspopup="listbox"`), or a styled native `<select>`. [D]

## Browser notes
- A native `<select>` cannot place the menu over the button with the checked item aligned to the title; that needs a custom listbox.
- The cap must clip to the bezel's radius: put it inside an `overflow: hidden` wrapper or give it `border-radius: 0 3.5px 3.5px 0`.
- The inactive-window rendering depends on window state that CSS cannot observe; drive it from the window component.

## Pixel audit
Stored colours [M], re-sampled with ±2-channel tolerance. Corner-adjacent columns must not be used for gradient endpoints.
- Title fill `#ffffff`: 10-15-Catalina-Light-System-Preferences-General.png @ 626,434.
- Dark title fill `#636465`: 10-15-Catalina-Dark-System-Preferences-General.png @ 627,434.
- Cap first fill row `#77a6f4 (sRGB #6ca6fb)`: 10-15-Catalina-Light-System-Preferences-General.png @ 895,414.
- Cap 51% row `#4b89f5 (sRGB #3987fd)`: 10-15-Catalina-Light-System-Preferences-General.png @ 895,433.
- Cap last fill row `#286ef6 (sRGB #076bff)`: 10-15-Catalina-Light-System-Preferences-General.png @ 895,451.
- Dark first fill row `#6998e8 (sRGB #5d97ef)`: 10-15-Catalina-Dark-System-Preferences-General.png @ 899,414.
- Dark last fill row `#2960c6 (sRGB #155ecd)`: 10-15-Catalina-Dark-System-Preferences-General.png @ 899,451.
- Top cap edge `#5b93f3 (sRGB #4c92fa)`: 10-15-Catalina-Light-System-Preferences-General.png @ 895,413.
- Dark cap top outline `#28292a`: 10-15-Catalina-Dark-System-Preferences-General.png @ 910,413.
- Dark right outline `#262728`: 10-15-Catalina-Dark-System-Preferences-General.png @ 926,434.
- Bottom cap edge `#2165f6 (sRGB #0361ff)`: 10-15-Catalina-Light-System-Preferences-General.png @ 899,452.
- Dark bottom outline `#232324`: 10-15-Catalina-Dark-System-Preferences-General.png @ 910,452.
- Chevron `#ffffff`: 10-15-Catalina-Light-System-Preferences-General.png @ 895,423.
- Dark chevron `#dee8f9 (sRGB #dce8fb)`: 10-15-Catalina-Dark-System-Preferences-General.png @ 910,422.
- Title `#262626`: 10-15-Catalina-Light-System-Preferences-General.png @ 723,505.
- Dark title `#e8e8e8`: 10-15-Catalina-Dark-System-Preferences-General.png @ 723,505.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-System-Preferences-General.png` | 612,476,300,43 | regular, text title |
| light | `10-15-Catalina-Light-System-Preferences-General.png` | 612,412,300,43 | colour chip + text |
| light | `10-15-Catalina-Light-System-Preferences-General.png` | 612,916,300,43 | 16 pt icon + text |
| light | `10-15-Catalina-Light-Finder-Get-Info.png` | 142,1176,470,37 | small size |
| light | `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png` | 774,1038,416,43 | disabled |
| light | `10-15-Catalina-Light-System-Preferences-Keyboard.png` | 734,526,162,43 | inline in a sentence, inside a box |
| dark | `10-15-Catalina-Dark-System-Preferences-General.png` | 612,476,316,43 | regular |
| dark | `10-15-Catalina-Dark-Finder-Get-Info.png` | 142,1176,470,37 | small |
| dark | `10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png` | 774,1038,416,43 | disabled |

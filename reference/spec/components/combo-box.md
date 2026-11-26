# Combo Box (`combo-box`)

- **Status:** present
- **AppKit:** `NSComboBox` (`NSComboBoxCell`), `isButtonBordered = true`, `numberOfVisibleItems`, `completes`
- **HIG:** https://web.archive.org/web/20200503142537/https://developer.apple.com/design/human-interface-guidelines/macos/fields-and-labels/combo-boxes/
- **Appearances shown:** light, dark

Short file names: `L-GoTo` = `10-15-Catalina-Light-Finder-Go-To-Folder.png`, `D-GoTo` = `10-15-Catalina-Dark-Finder-Go-to-Folder.png` (note the different capitalisation), `L-Connect` = `10-15-Catalina-Light-Finder-Connect-to-Server.png`, `D-Connect` = `10-15-Catalina-Dark-Finder-Conect-to-Server.png` (file name is misspelled in the library), `L-DT` / `D-DT` = `10-15-Catalina-Light-System-Preferences-Date-and-Time.png` / Dark.

## Purpose and behaviour
A combo box joins a text field and a pull-down button. The user types any value or picks one from the list; a typed value is not added to the list. Give the field a meaningful default from the list, introduce it with a label (title case, colon), keep the choices relevant and no wider than the field, and note that only one value can be chosen. [D] (HIG, Combo Boxes)

Clicking the button (or pressing Down Arrow in the field) opens a list directly below the field, as wide as the field; typing auto-completes against the list when `completes` is on. [D]

## Anatomy
```
  .--------------------------------------------.-------.
  | 3  text                                    |   v   |   20 pt high
  '--------------------------------------------'-------'
   text field part                              button part 16 (+ edge)
```
Back to front: text-field well (see `text-field`), the trailing button part (accent gradient when enabled in a key window, un-tinted when disabled) with square inner corners, one down chevron, the text, and the `focus-ring` when it has keyboard focus.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| controlSize | regular, small, mini | regular | `controlSize` | regular |
| enabled | true, false | true | `isEnabled` | both |
| focused | true, false | false | first responder | focused only (both enabled instances have focus) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| enabled, focused, key window | yes, light + dark | `L-GoTo @ 148,202,786,50`; `D-GoTo @ 148,202,786,50`; `L-Connect @ 148,154,900,50` |
| enabled, not focused | not shown | [I] the same control without the 2.5 pt ring: field edge as `text-field` (light top edge about `#b5b5b5`, sides `#c8c8c8`; dark as below), button part unchanged |
| disabled | yes, light + dark | `L-DT @ 709,295,550,40`; `D-DT @ 709,295,550,40` |
| list open | not shown | [I] list styled as `menu` without the checkmark column, 13 pt text, attached below the field |
| inactive window | not shown | [I] button part loses the accent (as the disabled rendering but with full-contrast chevron) |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Height (edge to edge) | 20 | [M] | `L-GoTo` col x=453: edge y=207, fill y 208..245, edge y=246; `L-DT` col x=1100: edge `#c7c7c7` y=295, edge `#c6c6c6` y=334 |
| Button part width | 16 + 0.5 outer edge; a 0.5 pt divider separates it from the field | [M] | `L-GoTo` row y=227: field white ends x=893, divider `#467fe3 (sRGB #357eea)` x=894, gradient x 895..926, edge x 927..928 (blended with the focus ring); `L-DT` row y=314: divider `#e1e1e1` x=1224, button x 1225..1257, edge `#cbcbcb` x=1258 |
| Chevron bounds (relative to the button part's top-left edge corner at the divider) | x 5.0..12.5, y 8.0..12.5 (15 x 9 px), same glyph as `pull-down-button` | [M] | `L-GoTo @ 904,223,15,9` (divider x=894, top edge y=207); `L-DT @ 1234,311,15,9` (divider x=1224, top edge y=295) |
| Corner radius | about 1 at the field end (text-field corners), 3.5 to 4 on the button end | [I] | not resolved under the focus ring; from the bezel family |
| Focus ring | 2.5 pt outside the edge plus the edge itself tinted | [M] | `L-GoTo` row y=227: `#8badec (sRGB #84adf2)`, `#89abeb (sRGB #82abf1)` x 148..152 (5 px), tinted edge `#6b8dce (sRGB #638cd3)` x=153; col x=453: ring y 202..206 and 247..251 |
| Text inset | first ink 4.5 from the field edge | [M] | `L-GoTo @ 162,219,170,23`: field edge x=153, first ink x=162 |
| Widths seen | 388 (Go to Folder), 445 (Connect to Server), 275 (Date & Time) | [M] | `L-GoTo` row y=227 x 153..928; `L-Connect` row y=177 x 153..1042; `L-DT` row y=314 x 709..1258 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Field fill, enabled | `#ffffff` | `#3a3a3b` on window `#303031` (white 0.05), top rows `#363637`, `#373737` | [M] | `L-GoTo @ 453,227`; `D-GoTo` col x=400 y 209..243 |
| Button gradient, enabled | `#75a4f4 (sRGB #6aa3fb)` (top) -> `#4d8af5 (sRGB #3b89fd)` (mid) -> `#296ef6 (sRGB #0b6bff)` (bottom); top edge `#407eee (sRGB #2d7cf6)`, bottom edge `#2368f0 (sRGB #0164f9)` (edges blended with the focus ring) | `#3773df (sRGB #2371e7)`, `#2f6cde (sRGB #196ae6)` -> `#2b66d3 (sRGB #1564db)` (mid) -> `#2960c7 (sRGB #155ece)`; top highlight `#5a9ff0 (sRGB #439ff7)` | [M] | `L-GoTo` col x=912 y 207..246; `D-GoTo` col x=912 y 208..245 |
| Divider between field and button | `#467fe3 (sRGB #357eea)` | `#2f2f30` | [M] | `L-GoTo @ 894,227`; `D-GoTo @ 893,227` |
| Chevron | `#ffffff` | `#dee8f7 (sRGB #dce8f9)` (white 0.85) | [M] | `L-GoTo @ 911,229`; `D-GoTo @ 908,227` |
| Focus ring (blue accent) | `#89abeb (sRGB #82abf1)` on `#ececec`; edge under it `#6b8dcd (sRGB #638cd2)` | `#3e6c94 (sRGB #2f6c98)` on `#303031`; edge `#47759e (sRGB #3975a2)` | [M] | `L-GoTo` row y=227 x 148..153; `D-GoTo` row y=227 x 148..154 |
| Disabled: fill | `#f1f1f1` on `#e3e3e3` (white 0.5) | `#3a3b3c` on `#363637` | [M] | `L-DT @ 1100,300`; `D-DT @ 1100,304` |
| Disabled: edges | top `#c7c7c7`, left `#c8c8c8`, right `#cbcbcb`, bottom `#c6c6c6`; inner top and left shade row `#e9e9e9` | top `#3f4040`, left `#3f3f40`, bottom `#4d4d4e` (the bottom edge is the lightest) | [M] | `L-DT` col x=1100 y 295, 296, 334; row y=314 x 709, 710, 1258; `D-DT` col x=1100 y 296, 333; row y=314 x=710 |
| Disabled: divider and button | divider `#e1e1e1`, button fill `#f1f1f1`, chevron `#919191` | not resolved | [M] light | `L-DT` row y=314 x 1224..1258; `@ 1241,317` |
| Disabled: text | `#b4b4b4` (black 0.25) | `#6b6b6c` (white 0.25) | [M] | `L-DT` col x=719 y 318..321; `D-DT` col x=720 y 314..319 |

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Text | 13 pt regular, `#262626` on white = `rgba(0,0,0,.85)` (light); dark `rgba(255,255,255,.85)` | [M] light colour, [I] size and dark colour (text metrics belong to `text-field`) | `L-GoTo @ 330,219` `#262626`; ink rows y 219..241 inside the field y 207..246 |

### Shadows and effects
No drop shadow under the field part. The focus ring is the only effect; see `focus-ring`.

## Layout and spacing
- In the Go to Folder dialog the combo box spans the content width: 20.5 pt from each window edge (edge x=153 and 928 inside frame x 112..969). The label "Go to the folder:" sits above it, left-aligned with the field edge, its baseline 10.5 pt above the field's top edge. [M] `L-GoTo`: label ink x 153..347, y 166..185 (`@ 153,166,195,20`), field edge y=207.
- Following a checkbox label in a row (Date & Time): 9.5 pt after the label's colon. [M] `L-DT`: label ink ends x=689, field edge x=709.
- Vertical alignment: field baseline aligns with the label baseline. [D]

## Keyboard and accessibility
Typing edits the field; Down Arrow opens the list; Up / Down move through items; Return accepts; Escape closes the list. AppKit role `AXComboBox`. Web: ARIA 1.2 `combobox` with `aria-autocomplete="list"` or `"both"` and a `listbox` popup. [D]

## Browser notes
`<input list>` + `<datalist>` cannot be styled to match; build a text input plus a button with a custom listbox. The button's left corners are square and its right corners rounded, which needs separate radii.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Go-To-Folder.png` | 148,202,786,50 | enabled, focused, with focus ring |
| light | `10-15-Catalina-Light-Finder-Connect-to-Server.png` | 148,154,900,50 | enabled, focused, insertion point visible |
| light | `10-15-Catalina-Light-System-Preferences-Date-and-Time.png` | 709,295,550,40 | disabled |
| dark | `10-15-Catalina-Dark-Finder-Go-to-Folder.png` | 148,202,786,50 | enabled, focused |
| dark | `10-15-Catalina-Dark-System-Preferences-Date-and-Time.png` | 709,295,550,40 | disabled |

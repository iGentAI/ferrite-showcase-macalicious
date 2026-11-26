# Text Field (`text-field`)

- **Status:** present
- **AppKit:** `NSTextField` (`isBezeled = true`, `bezelStyle = .squareBezel` (default) or `.roundedBezel`, `isEditable`, `placeholderString`, `controlSize`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/fields-and-labels/text-fields/
- **Appearances shown:** light, dark

## Purpose and behaviour
A rectangular area where the user enters or edits a line of text. Give it an introductory label (title case, ending in a colon) or placeholder text (sentence case, no punctuation); validate when the user leaves the field or presses Return, Enter or Tab; use formatters for numbers; choose clipping, wrapping or truncation; use a secure text field for sensitive data; offer an expansion tooltip for clipped text. [D] (HIG, Text Fields)

## Anatomy
1. Bezel: a square-cornered rectangle with a 0.5 pt border and a 0.5 pt lighter inner line.
2. Background: `textBackgroundColor`-like fill.
3. Text, placeholder, insertion point, selection highlight.
4. Focus ring when first responder (see `focus-ring`).

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| bezel | square, rounded, capsule (app-drawn: Messages, FaceTime), none | square | `bezelStyle`, `isBezeled`; the capsule is the apps' own field | square; capsule in Messages |
| controlSize | regular, small, mini | regular | `controlSize` | regular |
| state | enabled, disabled, focused | enabled | `isEnabled`, first responder | enabled (Sharing); focused as the text part of a combo box (Go to Folder, Connect to Server); disabled as the text part of a date picker (Date & Time) |
| content | text, placeholder | - | `stringValue`, `placeholderString` | text |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| enabled, not focused, key window | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Sharing.png @ 429,203,918,40`; Dark same |
| focused (combo box text part) | yes, light + dark | `10-15-Catalina-Light-Finder-Go-To-Folder.png @ 148,202,786,50`; `10-15-Catalina-Dark-Finder-Go-to-Folder.png` |
| disabled | only via the date picker field | `10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 474,393,160,46` |
| placeholder | not shown in a standard field | [D] / [I] below |
| inactive window | not shown in my screenshots | [I] identical minus focus ring and selection tint |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Height (regular) | 20 | [M] | Light Sharing col 800: border y 203..242. Combo box text part: Light Go to Folder col 500 y 207..246; Light Connect to Server col 600 y 159..198 |
| Corner radius | 0 (square) | [M] | Light Sharing grid `@ 428,200,6,6` |
| Border | 0.5, all four sides | [M] | Light Sharing col 800 y=203, 242; row 222 x=429, 1346 |
| Inner line | 0.5 inside the border | [M] | Light Sharing col 800 y=204 `#f0f0f0`, y=241 `#f0f0f0`; row 222 x=430 |
| Text inset (left edge to first ink) | 4 | [M] | Light Sharing: border x=429, first ink x=437; Light Connect to Server: border x=153, ink x=161 |
| Baseline | 14.5 below the top edge, 5.5 above the bottom edge (cap top 5 pt below the top) | [M] | Light Sharing: field y 203..242, digit glyphs y 213..232 |
| Width seen | 459 (Sharing computer name) | [M] | Light Sharing row 222: x 429..1346 |
| Small / mini heights | 17 / 14 [I] (AppKit steps of 3 pt; 19 / 16 in Interface Builder frames) | [I] | not shown |
| Capsule bezel (Messages' message field): height | 24 | [M] | `10-15-Catalina-Light-Messages.png` col 1700: edge y 1078..1125; Dark y 1070..1117 |
| Capsule: edge | 1, flat, all round | [M] | Light col 1700 y 1078..1079 and 1124..1125 |
| Capsule: ends | half circles (radius 12) | [M] | the masked comparison differs in 0.00% (Aqua) and 0.02% (Dark Aqua) of pixels at 2x with fully round ends |
| Capsule: text inset (edge to first ink) | 10.5 | [M] | Light row 1100: edge x=1316, placeholder ink x=1337 |
| Capsule: width seen | 403; 8 above and below it in a 40 pt bar | [M] | Light row 1102: x 1316..2121; bar y 1062..1141 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Border | `#b1b1b1` on `#ececec` = `rgba(0,0,0,0.25)` | top `#474849`, sides `#424344`, bottom `#636465` on `#2f3031` (top = white @ 0.12, bottom = white @ 0.25) | [M] / [C] | Sharing col 800 y 203, 242; row 222 x 429 |
| Inner line | `#f0f0f0` | top rows `#363737`, `#373738`, `#39393a` (a 1.5 pt inner shadow); above the bottom border `#494a4b` | [M] | Sharing col 800 y 204..206, 241 |
| Fill | `#ffffff` | `#393a3b`..`#3a3b3b` = `rgba(255,255,255,0.05)` over the window | [M] / [C] | Sharing `@ 800,222` |
| Capsule edge | `#cccccc` | `#6d6d6f` | [M] | `10-15-Catalina-Light-Messages.png @ 1700,1078`; `10-15-Catalina-Dark-Messages.png @ 1700,1070` |
| Capsule fill | `#ffffff` | `#535355` | [M] | `10-15-Catalina-Light-Messages.png @ 1700,1100`; `10-15-Catalina-Dark-Messages.png @ 1700,1094` |
| Text | `#262626` = `rgba(0,0,0,0.85)` | `#e2e2e2` = `rgba(255,255,255,0.85)` | [M] / [C] | Sharing `@ 436,206,90,32` |
| Placeholder | `rgba(0,0,0,0.25)` | `rgba(255,255,255,0.25)` | [D] | `NSColor.placeholderTextColor`; consistent with the Music search placeholder (`#989999` on `#d2d3d3`), see `search-field` |
| Disabled (date picker field on a box) | border `#c8c8c8`, inner line `#f2f2f2`, fill `#ffffff`, text `#c0c0c0` | border `#3e3e3f` top / `#4d4d4d` bottom, fill `#232323`, text `#595a59` | [M] | Date & Time col 480 y 393..438; row 416 |
| Selection highlight | see `highlight-color` | see `highlight-color` | - | owner: dialogs |
| Insertion point | 1 pt wide, 16 pt high (x=378..379, y=162..193), `#000000` in Connect to Server; blink rate remains inferred (0.5 s on/off) | dark 1 x 16 pt (x=372..373), `#ffffff` | [M] geometry/colour; [I] timing (not shown: still images contain no blink sequence) | 10-15-Catalina-Light-Finder-Connect-to-Server.png @ 378,162,2,32; 10-15-Catalina-Dark-Finder-Conect-to-Server.png @ 372,162,2,32 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Font | SF Pro Text 13 pt regular | same | [C] | digit height 19 px, Light Sharing `@ 436,206,90,32` |

### Shadows and effects
Light: none beyond the inner line. Dark: the lighter bottom border acts as a bottom highlight. Focus: `focus-ring`.

## Layout and spacing
- A right-aligned label ends 8.5 pt before the field's left edge and shares its baseline. [M] Light Sharing: label ink ends x=411, field starts 429.
- Helper text below the field starts 9 pt under its bottom edge, left-aligned with the field. [M] Light Sharing: field bottom y=242, text rows from 261.
- Fields stretch horizontally; height is fixed.

## Keyboard and accessibility
Tab / Shift-Tab move between fields (text fields are always in the key loop); Return commits; Escape cancels the edit; standard editing shortcuts apply. Role `AXTextField` with its label as title. ARIA: `<input type="text">` with `<label for>`. [D]

## Browser notes
Fully reproducible: `border: 0.5px solid rgba(0,0,0,0.25); box-shadow: inset 0 0 0 0.5px #f0f0f0; border-radius: 0; height: 20px; padding: 0 3.5px; font: 13px`. In dark mode the border needs per-side colours.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Sharing.png | 429,203,918,40 | enabled field with text |
| light | 10-15-Catalina-Light-Finder-Go-To-Folder.png | 148,202,786,50 | focused combo box text part |
| light | 10-15-Catalina-Light-Finder-Connect-to-Server.png | 148,154,900,50 | focused combo box text part |
| light | 10-15-Catalina-Light-Messages.png | 1306,1068,830,68 | capsule message field with its placeholder |
| dark | 10-15-Catalina-Dark-System-Preferences-Sharing.png | 429,203,918,40 | enabled field with text |
| dark | 10-15-Catalina-Dark-Messages.png | 1318,1060,830,68 | capsule message field |

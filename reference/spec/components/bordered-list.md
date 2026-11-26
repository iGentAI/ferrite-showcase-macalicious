# Bordered list with gradient-button bar (`bordered-list`)

- **Status:** present
- **AppKit:** `NSScrollView` (`borderType = .bezelBorder` / `.lineBorder`) containing an `NSTableView` or `NSOutlineView`, with a footer of `NSButton` (`bezelStyle = .smallSquare`) or an `NSSegmentedControl` (`.smallSquare`) pinned under it
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/gradient-buttons/ and https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/table-views/
- **Appearances shown:** light, dark

## Purpose and behaviour
The standard source list of a preference pane: a bordered, scrolling, single-column list whose selection drives the detail area beside it, with Add (+), Remove (-) and sometimes an Action (gear) gradient button directly below. Gradient buttons act on the associated view and sit in close proximity to it, usually below; they contain icons, not text. [D] (HIG, Gradient Buttons). The selection is a full-width row highlight; the list scrolls with overlay scrollers. Row cell contents (icon, title, subtitle, status dot, checkbox) are pane-specific. The cell-level table behaviour belongs to `table-view`; the button bezel to `gradient-button`.

## Anatomy
```
+--------------------------+  1 pt border
| (o) Wi-Fi          [ic]  |  row (selected: full-width tint)
|     Connected            |
| (o) Bluetooth PAN  [ic]  |
|                          |
+----+----+-----+----------+  footer top line
| +  | -  | *v  |          |  footer 19 pt gradient + 1 pt lines
+----+----+-----+----------+
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| footer | attached full-width bar; detached 2-segment control below the list; none | attached | layout | attached (Network, Users & Groups, Printers & Scanners, Connect to Server); detached (Sharing, Desktop & Screen Saver); none (Notifications, Spotlight) |
| row height | 18, 20, 22, 34, 41, 42 | - | `rowHeight` | all listed |
| alternating rows | on, off | off | `usesAlternatingRowBackgroundColors` | on (Spotlight); off elsewhere |
| group header rows | on, off | off | `isGroupRow` | Users & Groups ("Current User"), Printers & Scanners ("Printers") |
| column header | on, off | off | `headerView` | Sharing service list (see `table-header`) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| row selected, list not first responder (unemphasized) | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Network.png @ 154,276,336,84`; Dark same |
| row selected, list focused (emphasized, accent) | not shown in these panes | see `table-view` (owner: views) |
| footer buttons enabled | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Network.png @ 152,1032,340,42`; Dark same |
| footer buttons disabled (pane locked) | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Users-and-Groups.png @ 152,860,340,42`; Dark same |
| footer button pressed | not shown | [I] cell fill darkens to `#d9d9d9` (light) / lightens to `#6a6b6c` (dark) |
| disabled rows | yes | Users & Groups "Guest User" (title and subtitle at the tertiary label colour) |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Border width | 1 (2 px), square corners | [M] | Light Network row 600: x 152..153 and 490..491; grid `@ 152,274,5,5` |
| Footer bar height | 21 total = 1 top line + 19 fill + 1 bottom line | [M] | Light Network col 440: y 1032..1033, 1034..1071, 1072..1073 |
| Footer button cell width | 24 (Network), 23 (Users & Groups); Action cell 28; dividers 1 | [M] | Light Network row 1052: cells x 154..201, 204..251, 254..309; dividers 202..203, 252..253, 310..311. Light Users & Groups row 880: cells 154..199, 202..247 |
| + glyph | 11 x 11, stroke 1, centred in its cell | [M] | Light Network row 1052: x 167..188; col 180: y 1052..1053 |
| - glyph | 11 x 1, same centre line | [M] | Light Network row 1052: x 217..238 |
| Detached +/- control | 45 x 21: two 21 pt cells, 1 pt border and divider; 8 pt below the list | [M] | Light Sharing row 934: x 580..669; col 620: list border y 896..897, control y 914..955 |
| Row height: two-line network service | 42 | [M] | Light Network col 440: selected row y 276..359 |
| Row height: user | 34 | [M] | Light Users & Groups col 440: y 256..323 |
| Row height: Notifications app | 41 | [M] | Light Notifications: title caps y 392 and 474 |
| Row height: checklist (Spotlight) | 22 | [M] | Light Spotlight col 1000: bands y 420..463, 464..507 |
| Row height: Sharing services / Sharing folders and users | 20 / 18 | [M] | Light Sharing: checkboxes y 442, 482 (2 rows apart); col 700: row y 622..657 |
| Row content (Network) | status dot 10 pt, 7 pt from the inner left edge; title ink 23.5 pt from the inner left edge; title cap top 9 pt below row top; subtitle cap top 25 pt below row top; trailing icon right-aligned 11 pt from the inner right edge | [M] | Light Network: dot x 168..187, title x=201, rows y 294 / 326 for row top 276; icon `@ 426,371` |
| Group header row (Users & Groups) | 23 high; text 11 pt, ink 10 pt from the inner left edge | [M] | Light Users & Groups col 440: y 210..255; text `@ 172,228` |
| List sizes seen | 170 x 400 (Network), 170 x 347 (Users & Groups), 198 x 296 (Printers & Scanners), 232 x 362 (Notifications), 195 x 286 (Sharing), 492 x 317 (Spotlight) | [M] | pane blueprints |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| List background | `#ffffff` | `#1d1e1f` (`#1e1e1f` in some panes) | [M] | Network `@ 300,700` |
| Alternate row | `#f4f5f5` | `#282929` = white @ 0.05 | [M] / [C] | Spotlight col 1000 y 464..507 |
| Border (Network, Spotlight, Sharing, Printers) | `#c5c5c5` | `#565656` | [M] | Network row 600 x 152..153 |
| Border (Users & Groups) | `#aaaaaa` | `#808080` | [M] | Users & Groups row 500 x 152..153. Instances disagree: this pane draws a darker line border |
| Selected row, unemphasized | `#dcdcdc` | `#464646` | [M] | Network col 440 y 276..359 |
| Row separator (Users & Groups, above "Login Options") | `#aaaaaa` 0.5 pt | `#aaaaaa` 0.5 pt | [M] | Users & Groups col 440 y=790 (light, dark) |
| Footer: top / side / bottom lines | `#b4b4b4` | top `#808080`, sides and bottom `#636465` | [M] | Network col 440 y 1032, 1072; row 1052 x 152, 490 |
| Footer: fill | gradient 0% `#fafafa` -> 100% `#f5f5f5` | gradient 0% `#4e4f50` -> 100% `#48494a` | [M] | Network col 440 y 1034..1071 |
| Footer: dividers | `#b4b4b4` | `#8a8b8c` | [M] | Network row 1052 x 202..203 |
| Footer: glyphs | `#252525` = black @ 0.85 | `#e4e4e4` = white @ 0.85 | [M] / [C] | Network row 1052 x 167..188 |
| Footer disabled: fill | gradient `#f9f9f9` -> `#f3f3f3` | flat `#3c3c3c` | [M] | Users & Groups col 440 y 862..899 |
| Footer disabled: lines / dividers | `#b4b4b4` / `#b7b7b7` | `#7f7f7f` | [M] | Users & Groups row 880 |
| Footer disabled: glyphs | `#b9b9b9` = black @ 0.25 | `#6d6c6c` = white @ 0.25 | [M] / [C] | Users & Groups row 880 x 166..187 |
| Footer (Printers & Scanners variant) | top line `#c5c5c5`, fill `#f3f3f3` -> `#f1f1f1`, bottom `#d0d0d0` | top `#565656`, fill `#3f3f40` -> `#3d3d3e`, bottom `#4a4a4b` | [M] | Printers & Scanners col 300 y 742..783 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Row title | 13 pt regular, black @ 0.85 (`#262626` on white, `#212121` on the selected row) | white @ 0.85 (`#dddddc` on `#1d1e1f`, `#e3e4e3` on `#464646`) | [M] / [C] | Network `@ 196,286,150,30`, `@ 200,372,200,30` |
| Row subtitle | 11 pt regular, black @ 0.5 (`#7f7f7f` on white, `#6f6e6e` on the selected row) | white @ 0.55 (`#999a9a`, `#abacac`) | [M] / [C] | Network `@ 196,322,150,24`, `@ 200,404,200,30` |
| Group header text | 11 pt, black @ 0.25 (`#c0c0c0`) | white @ 0.25 (`#565656`) | [M] / [C] | Users & Groups `@ 166,222,150,26`; Printers `@ 166,204,100,28` |
| Status dot | see `status-dot` | see `status-dot` | - | - |

### Shadows and effects
None. Overlay scrollers appear only while scrolling (not captured).

## Layout and spacing
The list sits 20 pt from the window's left edge and its top aligns with the top of the detail box beside it; the gap between list and detail box is 8 pt (Network: list ends x=491, box starts 508). The footer shares the list's left and right borders so the two read as one frame. [M]

## Keyboard and accessibility
Up / Down arrows move the selection when the list is focused; type-select jumps to a row; Delete triggers Remove where the pane allows it. Roles: `AXScrollArea` > `AXTable` / `AXOutline` with `AXRow`s; footer buttons are `AXButton` with labels "Add" / "Remove". ARIA: `role="listbox"` with `role="option"` and `aria-selected`; buttons need `aria-label`. [D]

## Browser notes
Build as a flex column: a scrolling `div` with `border: 1px solid` and a 21 px footer whose top border overlaps the list's bottom border (only one line between them). The unemphasized selection must switch to the accent colour when the list has DOM focus (see `table-view`).

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Network.png | 152,274,340,800 | list with + / - / action footer, selected two-line row |
| light | 10-15-Catalina-Light-System-Preferences-Users-and-Groups.png | 152,208,340,694 | group rows, disabled footer |
| light | 10-15-Catalina-Light-System-Preferences-Spotlight.png | 288,418,984,634 | alternating checklist rows, no footer |
| light | 10-15-Catalina-Light-System-Preferences-Sharing.png | 580,620,300,336 | list with detached +/- control |
| dark | 10-15-Catalina-Dark-System-Preferences-Network.png | 152,274,340,800 | same, dark |
| dark | 10-15-Catalina-Dark-System-Preferences-Users-and-Groups.png | 152,208,340,694 | same, dark |
| dark | 10-15-Catalina-Dark-System-Preferences-Spotlight.png | 288,418,984,634 | alternating rows, dark |

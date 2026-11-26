# Outline View (`outline-view`)

- **Status:** present
- **AppKit:** `NSOutlineView` (`indentationPerLevel`, `indentationMarkerFollowsCell`, `outlineTableColumn`); disclosure via the standard `NSOutlineView.disclosureButtonIdentifier` button (see `disclosure-triangle`, owned by sysA)
- **HIG:** https://web.archive.org/web/20200503161505/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/outline-views/
- **Appearances shown:** light, dark

## Purpose and behaviour
A table whose first column shows a hierarchy: parent rows carry a disclosure triangle that expands to reveal children. Hierarchy is exposed in the first column only; other columns show attributes. Clicking a triangle expands one level, Option-click expands all descendants; the app should remember expansion state. Everything else (headings, sorting, resizing, alternating rows, editing, centred-ellipsis truncation) follows table views (all [D], HIG outline-views page).

## Anatomy
Row = [indent x level] [disclosure triangle or empty slot] [icon] [label] [other columns]. Selection, stripes and header are those of `table-view`; in a sidebar those of `sidebar`.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| Context | content outline (white background) / source-list outline (vibrant) | content | `selectionHighlightStyle` | content: System Information, Font Book font list, Automator Library; source list: Disk Utility, Photos |
| Indentation per level | 16 pt (AppKit default) | 16 | `indentationPerLevel` | 16-17 |
| Disclosure position | leading, before the icon | leading | `outlineTableColumn` | all |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Collapsed parent (triangle points right) | yes | Font Book families, Photos "My Projects" |
| Expanded parent (triangle points down) | yes | System Information "Hardware"/"Network", Font Book "Zapf Dingbats", Disk Utility, Photos "My Albums", Automator "Library" |
| Selected parent, emphasized (triangle turns white) | yes | System Information "Hardware" |
| Selected child | yes | Font Book "Regular", Disk Utility "Macintosh SSD" |
| Triangle pressed / animating | no | triangle darkens while pressed and rotates 90 degrees over about 0.2 s [I] |
| Disabled (dimmed) rows | yes | Font Book families that are not installed are drawn in grey |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Indent per level (source list) | 16 | [M] | Disk Utility triangles at x=123 and 155, icons at x=158 and 222 (level 0 and 2): 10-15-Catalina-Light-Disk-Utility.png @ 113,290,80,1 and 113,394,190,1 |
| Indent per level (content outline, Font Book) | 15.5 (parent label x=557, child label x=588) | [M] | 10-15-Catalina-Light-Font-Book.png @ 557,434,3,1 and 588,1228,9,1 |
| Indent, System Information | children's text at 35 pt from the pane edge, parent text at about 19 | [M] child, [C] parent | 10-15-Catalina-Light-System-Information.png @ 182,160,39,16 |
| Triangle box, expanded | 9 x 7.5 (18 x 15 px) | [M] | 10-15-Catalina-Light-Disk-Utility.png @ 123,283,18,15; 10-15-Catalina-Light-Font-Book.png @ 529,1184,18,15; 10-15-Catalina-Light-System-Information.png @ 127,128,18,15 |
| Triangle box, collapsed | 7.5 x 9 (15 x 18 px) | [M] | 10-15-Catalina-Light-Font-Book.png @ 531,426,15,18; 10-15-Catalina-Light-Photos.png @ 125,859,15,18 |
| Triangle leading inset | 5.5 (source list), 7.5 (System Information), 8.5 (Font Book list, from the pane edge x=514) | [M] | x=123 with pane edge 112; x=127; x=531 |
| Gap triangle -> icon (source list) | 9 (triangle right edge x=140, icon left x=158) | [M] | 10-15-Catalina-Light-Disk-Utility.png @ 123,290,70,1 |
| Gap triangle -> label (no icon, Font Book) | 6 (triangle x=531..544, label x=557); label 21.5 from the pane edge x=514 | [M] | 10-15-Catalina-Light-Font-Book.png @ 526,434,50,1 |
| Vertical position | triangle centred on the row | [M] | Disk Utility row centre y=290, triangle y=283..297 |
| Row pitch | as the host table: 26 (source list), 18 (Font Book), 16 (System Information), about 19 (Automator Library; four rows span y=275..399, not resolved to the pixel) | [M], Automator [C] | see `sidebar`, `table-view`; 10-15-Catalina-Light-Automator.png @ 220,275,112,125 |

Triangle shape: solid isosceles triangle. Expanded polygon in its 18 x 15 px box: (0,0) (18,0) (9,15). Collapsed in its 15 x 18 px box: (0,0) (15,9) (0,18) [M] (grids 10-15-Catalina-Light-Disk-Utility.png @ 121,280,20,20 and 10-15-Catalina-Light-Photos.png @ 122,856,18,22).

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Triangle, source list | `#686867` (Disk Utility), `#696a6a` (Photos) | `#a8a9ab` [C: equals the measured dark template-icon tint] | [M] light | 10-15-Catalina-Light-Disk-Utility.png @ 131,288; 10-15-Catalina-Light-Photos.png @ 128,866 |
| Triangle, content outline | `#7e7e7e` .. `#7f7f7f` | `#9a9a9b` [C: equals the measured dark column-view arrow] | [M] light | 10-15-Catalina-Light-Font-Book.png @ 531,426,15,18 |
| Triangle on emphasized selection | `#ffffff` | `#ffffff` | [M] | 10-15-Catalina-Light-System-Information.png @ 127,128,18,15 |
| Row background / selection | see `table-view` and `sidebar` | | | |

### Text and icons
As the host table. Font Book list: 13 pt, `#272727`; dimmed families use `#c0c0c0` light / `#565658` dark [M], darkest/lightest ink of "Toppan Bunkyu Midashi Mi..." in `10-15-Catalina-Light-Font-Book.png @ 556,210,310,23` and `10-15-Catalina-Dark-Font-Book.png @ 556,210,310,23`.

### Shadows and effects
None.

## Layout and spacing
Children are inserted directly under the parent at the same row pitch. Rows without children keep the empty triangle slot so labels at the same level align (Disk Utility leaf rows: icon x=222 at level 2 = 158 + 2 x 32 px).

## Keyboard and accessibility
Right Arrow expands, Left Arrow collapses (or moves to the parent), Option-Right/Left expand/collapse recursively, Up/Down move [D]. AX role `AXOutline`, rows expose `AXDisclosing`/`AXDisclosureLevel`. ARIA: `role="treegrid"` (multi-column) or `tree`, rows `aria-expanded`, `aria-level`.

## Browser notes
None beyond `table-view`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Information.png | 112,120,326,950 | two-level content outline, emphasized parent |
| dark | 10-15-Catalina-Dark-System-Information.png | 112,120,326,950 | same, dark |
| light | 10-15-Catalina-Light-Font-Book.png | 514,186,400,1096 | collapsed families, one expanded with selected child |
| dark | 10-15-Catalina-Dark-Font-Book.png | 514,186,400,1096 | same, dark |
| light/dark | 10-15-Catalina-Light-Disk-Utility.png, 10-15-Catalina-Dark-Disk-Utility.png | 112,216,508,580 | three-level source-list outline |
| light/dark | 10-15-Catalina-Light-Automator.png, 10-15-Catalina-Dark-Automator.png | 112,260,326,600 | Library outline with colour icons |

# Table header (`table-header`)

- **Status:** present
- **AppKit:** `NSTableHeaderView` with `NSTableHeaderCell`; sort indicator via `NSTableView.setIndicatorImage(_:in:)` / `sortDescriptorPrototype`; `NSTableColumn.headerCell.alignment`
- **HIG:** https://web.archive.org/web/20200503153039/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/table-views/
- **Appearances shown:** light, dark

## Purpose and behaviour
The row of column headings above a table or outline. Headings are short noun phrases in title case with no trailing colon. Clicking a heading sorts by that column (ascending first), clicking again reverses; the sorted column shows an indicator. Dragging the boundary between two headings resizes; dragging a heading reorders (when allowed) (all [D], HIG).

## Anatomy
```
|  fill 23 pt                         | 1 pt separator, inset 3 pt top and bottom
|  Name                            ^  | Kind              | Date Modified
+-------------------------------------+ 1 pt bottom border
```
1. Fill (flat).
2. Column separators between cells: 1 pt wide, 17 pt tall, inset 3 pt from the top and bottom of the fill.
3. Title text, 11 pt; left-aligned by default, centred or right-aligned per column.
4. Sort indicator chevron at the trailing end of the sorted column.
5. 1 pt bottom border (and a 1 pt top border when the header is not directly under a toolbar).

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| Title alignment | left / centre / right | left | `headerCell.alignment` | left: Keychain Access, Console, Automator; centre: Activity Monitor |
| Sort indicator | none / ascending / descending | none | `NSSortDescriptor` | descending: Activity Monitor "% CPU"; ascending: Keychain Access "Name" |
| Fill | standard grey / white (Console) | grey | `NSTableHeaderView` (Console customises) | both |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Normal | yes | all |
| Sorted column | yes | title text stays regular weight and colour; only the chevron is added (Activity Monitor, Keychain) |
| Pressed | no | fill darkens about 8 % (light) / lightens (dark) [I] |
| Column being resized / dragged | no | [I] cursor change only; dragged column lifts with 50 % opacity |
| Inactive window | no | unchanged fill, text unchanged [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Fill height | 23 | [M] | 10-15-Catalina-Light-Activity-Monitor.png @ 540,188,1,46; 10-15-Catalina-Light-Keychain-Access.png @ 900,364,1,46; 10-15-Catalina-Light-Automator.png @ 1400,1478,1,46 |
| Bottom border | 1 | [M] | 10-15-Catalina-Light-Activity-Monitor.png @ 540,234,1,2 |
| Top border (only when not under a toolbar) | 1 | [M] | 10-15-Catalina-Light-Keychain-Access.png @ 900,362,1,2; 10-15-Catalina-Light-Automator.png @ 1400,1476,1,2 |
| Total height | 24 under a toolbar, 25 free-standing | [C] | sums of the above |
| Console header (custom white) | fill 24, bottom border 1 | [M] | 10-15-Catalina-Light-Console.png @ 900,258,1,50 |
| Column separator | 1 wide x 17 tall, 3 pt from the fill top and bottom | [M] | 10-15-Catalina-Light-Activity-Monitor.png @ 594,188,2,46 (bg x6, #d5d5d5 x34, bg x6) |
| Console separators | 1 wide, full header height | [M] | 10-15-Catalina-Light-Console.png @ 578,268,2,1 and 924,268,2,1 |
| Title left inset (left-aligned) | Keychain Access: 5 from the column's left edge to the first full-ink column of the title, 4.5 to its first antialiased one. Console's own header: 2.5 | [M] | Keychain "Name": fill from x=462, ink from x=471 (antialiased) and x=472 (full). Console "Type": fill from x=474, the bar of the T from x=479 (x=478 antialiased); x=484 is the T's stem, not the title's left edge (10-15-Catalina-Light-Console.png @ 474,274,18,4) |
| Title cap height / position | cap 16 px; cap top 7 pt below the fill top, baseline 15 pt below it | [M] | 10-15-Catalina-Light-Activity-Monitor.png @ 280,202,148,16 (fill top y=188); Keychain @ 472,378,59,16 (fill top y=364) |
| Sort indicator size | 7 x 4 (14 x 8 px), stroke ~1.5 | [M] | 10-15-Catalina-Light-Activity-Monitor.png @ 728,208,14,8; 10-15-Catalina-Light-Keychain-Access.png @ 880,382,14,8 |
| Sort indicator position | right edge 4 pt before the column separator; vertically centred (10 pt below fill top) | [M] | Activity Monitor chevron x=728..741, separator x=750; Keychain chevron x=880..893, separator x=902 |

Sort indicator path (descending, pointing down; px at 2x in a 14 x 8 box, round-ish joins): polyline (1,1) (7,7) (13,1), stroke width 3 px (1.5 pt), butt ends cut horizontally. Ascending is the vertical mirror: (1,7) (7,1) (13,7) [M] (grid 10-15-Catalina-Light-Activity-Monitor.png @ 727,207,16,10).

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill | `#efefef` (Activity Monitor; `#eeeeee` Keychain; `#f0f0f0` Automator) | `#2d2f31` (Activity Monitor; `#2b2c2f` Keychain, Automator) | [M] | 10-15-Catalina-Light-Activity-Monitor.png @ 540,200; 10-15-Catalina-Dark-Activity-Monitor.png @ 540,200; Light-Keychain-Access @ 900,380; Dark-Keychain-Access @ 900,380 |
| Fill, Console | `#ffffff` (stored #fffffe/#feffff, +-1) | `#323231` .. `#303131` | [M] | 10-15-Catalina-Light-Console.png @ 900,270; 10-15-Catalina-Dark-Console.png @ 900,280 |
| Bottom / top border | `#c6c7c7` (Keychain `#c4c5c5`, Automator `#c7c7c7`) | `#47494c` (Keychain `#444649`, Automator `#45464a`) | [M] | Light-Activity-Monitor @ 540,234; Dark-Activity-Monitor @ 540,234; Light-Keychain-Access @ 900,362 |
| Console bottom border | `#d6d6d6` | `#4a4a49` | [M] | Light-Console @ 900,306; Dark-Console @ 900,306 |
| Column separator | `#d5d5d5` | `#46494b (sRGB #45494b)` | [M] | Light-Activity-Monitor @ 594,210; Dark-Activity-Monitor @ 594,210 |
| Console column separator | `#e5e5e5` | `#494949` | [M] | 10-15-Catalina-Light-Console.png @ 578,268; 10-15-Catalina-Dark-Console.png @ 578,268 |
| Sort indicator | `#909090` | `#8b8c8e` | [M] | Light-Activity-Monitor @ 733,212; Dark-Activity-Monitor bbox @ 728,208,14,8 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title font | SF Pro Text 11 pt Regular (cap 16 px, stem 2 px), also for the sorted column | same | [C] | 10-15-Catalina-Light-Activity-Monitor.png @ 280,210,12,1 and 669,210,12,1 |
| Title colour | `#161616` .. `#171717` | `#ffffff` | [M] | Light-Activity-Monitor @ 281,210; Dark-Keychain-Access @ 472,386 |
| Pane title used as a header (Keychain "Keychains", "Category") | same 23 pt fill and borders, title centred, 11 pt | same | [M] | 10-15-Catalina-Light-Keychain-Access.png @ 440,152,1,46 and 440,707,1,48 |

### Shadows and effects
None.

## Layout and spacing
The header spans the table width and does not scroll vertically. The last separator is omitted at the trailing edge. Minimum column width keeps title plus indicator visible (title truncates with a tail ellipsis).

## Keyboard and accessibility
Headers are not in the tab order; sorting is reachable through VoiceOver (`AXSortDirection` on `AXColumn` headers, role `AXButton` inside `AXGroup` header). ARIA: `role="columnheader"` with `aria-sort="ascending|descending|none"`; make them buttons for click-to-sort.

## Browser notes
None; all flat fills and 1 px (0.5 pt is not used here; borders are 1 pt = 2 device px) lines.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Activity-Monitor.png | 112,186,1678,52 | centred titles, descending indicator on "% CPU" |
| dark | 10-15-Catalina-Dark-Activity-Monitor.png | 112,186,1678,52 | same, dark |
| light | 10-15-Catalina-Light-Keychain-Access.png | 462,360,1404,54 | left-aligned titles, ascending indicator on "Name" |
| dark | 10-15-Catalina-Dark-Keychain-Access.png | 462,360,1404,54 | same, dark |
| light/dark | 10-15-Catalina-Light-Console.png, 10-15-Catalina-Dark-Console.png | 474,258,1638,50 | white/tinted custom header |

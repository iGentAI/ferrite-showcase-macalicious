# Table View (`table-view`)

- **Status:** present
- **AppKit:** `NSTableView` in an `NSScrollView`; `usesAlternatingRowBackgroundColors`, `gridStyleMask`, `rowHeight`, `intercellSpacing`, `selectionHighlightStyle = .regular`; row view `NSTableRowView.isEmphasized`
- **HIG:** https://web.archive.org/web/20200503153039/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/table-views/
- **Appearances shown:** light, dark

## Purpose and behaviour
A scrolling list of rows organised in columns: one primary column plus optional attribute columns. Column headings are nouns in title case; clicking a heading sorts, clicking again reverses. Columns are resizable. Alternating row colours are recommended for multi-column tables. Cells can be editable on single click; clipped text truncates with a centred ellipsis. Windows whose main feature is a table usually have a toolbar search field (all [D], HIG table-views page).

## Anatomy
1. Table background (`controlBackgroundColor`), or alternating stripes that continue below the last row to fill the view.
2. Selection highlight per selected row (full table width, square corners, 1 pt shorter than the row pitch).
3. Cell content: optional 16 pt icon, text, right-aligned numbers.
4. Optional vertical/horizontal grid lines (none in the Catalina apps captured).
5. Header (`table-header`) pinned above; scrollers overlay (`scroll-view`).

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| Row pitch | 18 (small/standard list), 19, 21, 16, 20 | 17 + 2 spacing [D: AppKit default `rowHeight` 17, `intercellSpacing` (3,2)] | `rowHeight` + `intercellSpacing.height` | 18: Activity Monitor, Keychain Access items, Finder column view, Font Book; 19: Automator log; 21: Console; 16: System Information; 20: Keychain Access left lists |
| Alternating rows | on / off | off | `usesAlternatingRowBackgroundColors` | on: Activity Monitor, Keychain Access, Console, Automator log, Get Info sharing table; off: Font Book, System Information, Automator action list |
| Grid lines | none / vertical / horizontal | none | `gridStyleMask` | none shown; horizontal hairlines appear only in custom lists (see `list-view`) |
| Selection emphasis | emphasized (accent) / unemphasized (grey) | by focus | `isEmphasized` | both, light and dark |
| Header | with / without | with | `headerView` | both |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Row normal, odd / even stripe | yes | Activity Monitor, Keychain Access |
| Selected, emphasized (table is first responder in key window) | yes | Activity Monitor (light row 1, dark "Finder" row), Font Book "Regular", System Information "Hardware", Keychain "login" (light) |
| Selected, unemphasized (table not first responder or window inactive) | yes | Keychain Access item row and "All Items" (light), all three selections in dark |
| Hover | n/a | tables have no hover |
| Disabled | no | text at tertiary label colour [I] |
| Editing a cell | no | cell becomes a white (dark: `#1e1e1e`) text field with focus ring, row keeps highlight [I] |
| Drop target | no | accent 2 pt inset outline on the row or a 2 pt insertion line with a 6 pt ring at its leading end [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Row pitch, Activity Monitor | 18 | [M] | stripes 36 px: 10-15-Catalina-Light-Activity-Monitor.png @ 540,272,1,144 (#f4f5f5 x36, #ffffff x36 ...); same in dark |
| Selection highlight height | 17 (pitch - 1; the bottom 1 pt shows the row's own stripe colour) | [M] | 10-15-Catalina-Light-Activity-Monitor.png @ 540,236,1,36 (#2466d9 (sRGB #0164e1) x34 then #ffffff x2); 10-15-Catalina-Dark-Activity-Monitor.png @ 540,452,1,36 (#1f5bc9 (sRGB #0158d0) x34, #1e1f21 x2); Keychain @ 900,412,1,36 |
| Row pitch, Keychain Access item table | 18 | [M] | 10-15-Catalina-Light-Keychain-Access.png @ 900,412,1,72 |
| Row pitch, Keychain left lists | 20 (highlight 19) | [M] | 10-15-Catalina-Light-Keychain-Access.png @ 440,198,1,38 |
| Row pitch, Console | 21 | [M] | 10-15-Catalina-Light-Console.png @ 900,320,1,210 (42 px stripes) |
| Row pitch, Automator log | 19 | [M] | 10-15-Catalina-Light-Automator.png @ 1400,1526,1,228 (38 px stripes) |
| Row pitch, System Information list | 16 (highlight 15) | [M] | 10-15-Catalina-Light-System-Information.png @ 430,120,1,30; row text tops y=160, 191/192, 223/224 |
| First row offset | starts immediately under the header's bottom border | [M] | Activity Monitor header border y=234..235, row 1 starts y=236 |
| Selection width | full table width, including under the window edge highlight | [M] | 10-15-Catalina-Light-Activity-Monitor.png @ 113,252,38,1 |
| Cell text left inset, first column with icon | icon box 16 pt at 19.5 from the table edge (x=152..179), text at 46 (x=204) | [M] | 10-15-Catalina-Light-Activity-Monitor.png @ 152,252,28,1 and 204,245,165,21 |
| Cell text left inset, Keychain | icon at 24 (x=510), text at 42 (x=546) from the table's left edge x=462 | [M] | 10-15-Catalina-Light-Keychain-Access.png @ 462,428,100,1 |
| Cell text inset from a column separator, plain text columns | 4-5 (header and cell text share the inset) | [M] | Console header "Type" at x=484, column edge x=474; Keychain "Name" at x=472, edge 462 |
| Numeric columns | right-aligned; text right edge 4 pt before the separator | [M] | Activity Monitor "% CPU" values end x=742, separator x=750 (10-15-Catalina-Light-Activity-Monitor.png @ 709,276,42,28) |
| Text baseline | cap top 4.5 pt below the row top for 12 pt text in an 18 pt row (visually centred) | [M] | row 1 top y=236, text top y=245 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Background / odd stripe | `#ffffff` | `#1e1f21` (Console, Calendar: `#1e1f20`) | [M] | 10-15-Catalina-Light-Activity-Monitor.png @ 540,320; 10-15-Catalina-Dark-Activity-Monitor.png @ 540,250 |
| Even stripe | `#f4f5f5` (Keychain, Automator: `#f5f5f5`) | `#292a2b` (Console `#292a2a`, Automator `#29292b`) | [M] | 10-15-Catalina-Light-Activity-Monitor.png @ 540,290; 10-15-Catalina-Dark-Activity-Monitor.png @ 540,290; Light-Keychain-Access @ 900,460 |
| Selection, emphasized | `#2466d9 (sRGB #0164e1)` (varies +-1: #2365d9 (sRGB #0062e1)..#2466da (sRGB #0163e2)) | `#1f5bc9 (sRGB #0158d0)` (System Information `#1f5bc8 (sRGB #0159cf)`, column view `#1f5ac8 (sRGB #0357cf)`) | [M] | 10-15-Catalina-Light-Activity-Monitor.png @ 540,250; 10-15-Catalina-Dark-Activity-Monitor.png @ 540,470; Light-System-Information @ 430,130; Light-Font-Book @ 880,1220 |
| Selection, unemphasized | `#dcdcdc` | `#464646` | [M] | 10-15-Catalina-Light-Keychain-Access.png @ 900,430 and 440,770; 10-15-Catalina-Dark-Keychain-Access.png @ 900,430 and 440,215; Light-Contacts @ 800,214; Dark-Contacts @ 860,234 |
| Bottom border under the table (to a footer pane) | `#c6c6c6` 1 pt | `#a6a6a6` 1 pt | [M] | 10-15-Catalina-Light-Activity-Monitor.png @ 540,1110,1,2; 10-15-Catalina-Dark-Activity-Monitor.png @ 540,1110,1,2 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Cell font, Activity Monitor | SF Pro Text 12 pt Regular (cap 17 px, x-height 12 px) | same | [C] | 10-15-Catalina-Light-Activity-Monitor.png @ 206,390,11,17 ("U"); @ 205,286,1,12 |
| Cell font, Keychain Access / System Information | 11 pt Regular (line box 21 px with ascender and descender; SysInfo cap 16 px) | same | [C] | 10-15-Catalina-Light-Keychain-Access.png @ 546,419,62,21; 10-15-Catalina-Light-System-Information.png @ 182,160,39,16 |
| Cell font, Console | 11 pt monospaced (Menlo) | same | [C] | 10-15-Catalina-Light-Console.png @ 595,326,269,17 |
| Default cell font | system 13 pt (Font Book list, column view; cap 18 px) | same | [C] | 10-15-Catalina-Light-Font-Book.png @ 557,426,88,18 |
| Text colour, normal | `#252525` .. `#272727` | `#dddddd` | [M] | Light-Activity-Monitor @ 205,281,189,22; Dark-Activity-Monitor @ 204,245,165,21 |
| Text colour, emphasized selection | `#ffffff` | `#ffffff` | [M] | Light-Activity-Monitor @ 208,252,2,1 |
| Text colour, unemphasized selection | unchanged (`#212120`) | unchanged (`#e4e3e4`) | [M] | Light-Keychain-Access @ 546,419,62,21; Dark-Keychain-Access same box |
| Bold selected label (Keychain "login") | 11 pt Bold white on the emphasized row | 11 pt Bold `#e3e3e3` on the unemphasized row | [M] colours, [C] weight | Light-Keychain-Access @ 194,216,12,1; Dark-Keychain-Access @ 194,216,12,1 |
| Coloured value text (Activity Monitor footer) | `System` red `#ec4d3d (sRGB #ff3b30)`, `User` blue `#4facf2 (sRGB #1dadf8)` | same measured colours | [M] | darkest/lightest ink in 10-15-Catalina-Light-Activity-Monitor.png @ 676,1148,76,27; 10-15-Catalina-Light-Activity-Monitor.png @ 676,1190,76,27; 10-15-Catalina-Dark-Activity-Monitor.png @ 676,1148,76,27; 10-15-Catalina-Dark-Activity-Monitor.png @ 676,1190,76,27 |

### Shadows and effects
None. Stripes are flat; the selection has no gradient in Catalina.

## Layout and spacing
- The table fills its scroll view; stripes continue past the last data row.
- Column widths are content-defined and user-resizable; the last column absorbs spare width.
- Minimum sensible row heights: 16 (11 pt text), 18 (12-13 pt text with 16 pt icons).

## Keyboard and accessibility
Up/Down change the selection; Shift extends; Command toggles; type-select; Return/Enter starts editing in editable tables; Space is Quick Look in Finder-like tables [D]. AX role `AXTable` with `AXRow`/`AXCell` and `AXColumn`; ARIA `role="grid"` (or `table` when read-only) with `aria-selected` rows and `aria-sort` on headers.

## Browser notes
- Emphasis depends on focus within the table and on window key state; implement with `:focus-within` plus a window-blur class.
- Use `tabular-nums` for right-aligned numeric columns to match SF's fixed-width digits in tables.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Activity-Monitor.png | 112,188,1678,924 | 9-column striped table, emphasized selection, sort indicator |
| dark | 10-15-Catalina-Dark-Activity-Monitor.png | 112,188,1678,924 | same, dark, selection on row 7 |
| light | 10-15-Catalina-Light-Keychain-Access.png | 462,362,1404,900 | striped table, unemphasized selection |
| dark | 10-15-Catalina-Dark-Keychain-Access.png | 462,362,1404,900 | same, dark |
| light | 10-15-Catalina-Light-Console.png | 474,258,1638,274 | 21 pt monospaced rows |
| dark | 10-15-Catalina-Dark-Console.png | 474,258,1638,274 | same, dark |
| light/dark | 10-15-Catalina-Light-Automator.png, 10-15-Catalina-Dark-Automator.png | 876,1476,1236,296 | empty striped log table with header |

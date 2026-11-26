# Sidebar / Source List (`sidebar`)

- **Status:** present
- **AppKit:** `NSOutlineView` / `NSTableView` with `selectionHighlightStyle = .sourceList` inside an `NSVisualEffectView` (`material = .sidebar`, `blendingMode = .behindWindow`), hosted in the leading pane of an `NSSplitView`; group rows via `outlineView(_:isGroupItem:)`; `rowSizeStyle` follows System Preferences > General > "Sidebar icon size".
- **HIG:** https://web.archive.org/web/20200503160808/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/sidebars/ ; icon sizes from https://web.archive.org/web/20200504060024/https://developer.apple.com/design/human-interface-guidelines/macos/icons-and-images/custom-icons/
- **Appearances shown:** light, dark

## Purpose and behaviour
A sidebar ("source list") sits on the leading side of a window, separated from the content by a (usually movable) splitter. It is a one-column table or outline that lets people pick the item shown in the main part of the window. Titles group related items; sidebars normally have no column header. No more than two levels of hierarchy should be exposed. The background is translucent unless the window has more than one sidebar or is a panel/preferences window, in which case it is opaque. Sidebars may auto-collapse when the window gets narrow, and editable sidebars put borderless add/remove buttons floating at the bottom (all [D], HIG sidebars page).

## Anatomy
Back to front:
1. Vibrant material filling the pane from under the toolbar to the window bottom (full height; the window's bottom-left corner radius clips it).
2. Selection highlight: a full-width rectangle (edge to edge, square corners) behind the selected row.
3. Section header rows (group rows): small semibold grey text, optional trailing "Hide/Show" hover button (not shown).
4. Item rows: optional disclosure triangle, icon, label, optional trailing accessory (badge, count, eject glyph, progress spinner).
5. Optional footer button pinned to the bottom ("New Folder", "Add List", "+").
6. Optional header pinned above the list, which does not scroll with the rows: Reminders puts its search field (and its smart-list tiles) there, Safari the Bookmarks / Reading List switch.
7. 1 pt divider on the trailing edge (drawn by the split view, see `split-view`).

```
|<10>Favorites                     |   header: 11 pt semibold, cap top 10.5 pt under toolbar
|   <18>[ic]<5>AirDrop             |   row slot 26 pt = 24 pt row + 2 pt spacing
|########[ic]###Applications#######|   selection: 24 pt high, full width
|<10>iCloud                        |
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| Sidebar icon size | small / medium / large | medium | `NSTableView.rowSizeStyle` (`.small/.medium/.large`), set system-wide | medium only (every sidebar in the library) |
| Material | translucent (vibrant) / opaque | translucent | `NSVisualEffectView.material = .sidebar`; `backgroundColor` for opaque | translucent: Finder, Mail, Notes, Reminders, Calendar, Photos, Console, Disk Utility, Font Book, Dictionary, Contacts, Messages, Find My; opaque white: Keychain Access, System Information, Automator library, Storage Management |
| Selection emphasis | grey (source-list) / accent (emphasized) | grey unless the sidebar is first responder | `NSTableRowView.isEmphasized` | both |
| Icon style | monochrome template / full colour | template | `NSImage.isTemplate` | template: Finder, Mail, Photos, Console, Font Book; colour: Disk Utility volumes (grey artwork), Photos album thumbnail, Reminders list badges, Calendar checkboxes |
| Hierarchy | flat / outline with disclosure triangles | flat | `NSOutlineView` | outline: Disk Utility (3 levels), Photos (2 levels) |
| Footer button | none / borderless plus-circle + label / bare "+" | none | `NSButton` borderless | Notes "New Folder", Reminders "Add List", Find My "Share My Location", Font Book "+" |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Row normal | yes | all sidebars |
| Row selected, sidebar not first responder (grey) | yes, light and dark | Finder, Notes (light), Reminders, Photos, Console, Calendar, Font Book, Dictionary |
| Row selected, sidebar is first responder in key window (accent) | yes, light and dark | Disk Utility (both), Notes (dark) |
| Row selected in inactive window | yes, light and dark | Mail main window behind the compose window; Finder behind Quick Look |
| Hover | n/a | macOS sidebars have no row hover; hovering a header reveals a "Hide"/"Show" text button [D] (AppKit behaviour, not captured) |
| Pressed | no | selection changes on mouse-down, so pressed = selected [I] |
| Disabled row | no | text at 50 % of label colour [I] (Storage Management "System/Other" rows show this; owned by group dialogs) |
| Drag target | no | accent-coloured 2 pt rounded outline around the row [I] |
| Collapsed section | no | header only, rows hidden [I] |

## Measurements
### Geometry (pt)
All taken from window captures (window origin at image x=112, y=76). "Medium" is the only size shown.

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Row height (selection highlight) | 24 | [M] | 10-15-Catalina-Light-Applications.png @ 430,340,1,48 (#c7c8c8 x48); 10-15-Catalina-Dark-Notes.png @ 480,202,1,48; 10-15-Catalina-Light-Disk-Utility.png @ 600,636,1,48; Console @ 460,308,1,48; Photos @ 460,734,1,48; Calendar @ 436,244,1,48; Font Book @ 500,196,1,48 |
| Row pitch (row + intercell spacing) | 26 (24 + 2) | [M] | Finder icon centres y=259.5, 311.5, 363.5 (10-15-Catalina-Light-Applications.png @ 146,243,40,137); Mail text tops 258/310/363; Disk Utility rows at y=272,324,376,428 |
| Row pitch in Calendar's calendar list | 24 (rows touch) | [M] | 10-15-Catalina-Light-Calendar.png: row content at y=206..233 and 254..281; selection 244..291 |
| Tall-row variants | Reminders "My Lists" 36; Dictionary word list 28; Contacts groups 24; Messages conversation 64 (see `list-view`) | [M] | 10-15-Catalina-Light-Reminders.png @ 660,716,1,72; 10-15-Catalina-Light-Dictionary.png @ 470,264,1,56 |
| Small / large row height | small 20, large 32 (not shown) | [I] | Not captured. Icon sizes 16 / 18 / 32 pt are documented [D] (HIG custom-icons "Sidebar Icons" table); row heights inferred from medium = icon 18 + 6 |
| Selection width | full pane width, from the window edge to the divider, square corners | [M] | 10-15-Catalina-Light-Applications.png @ 113,350,38,1 and 400,350,40,1 (#c7c8c8 up to the divider at x=440) |
| Header text left inset | 10 | [M] | "Favorites" starts at x=132 (10-15-Catalina-Light-Applications.png @ 132,208,2,16); Notes "iCloud" x=131; Photos x=131/132; Console x=136 (12 pt) |
| First header: cap top below toolbar bottom edge | 10.5 (toolbar's last line y=185, cap top y=207) | [M] | 10-15-Catalina-Light-Applications.png @ 133,186,1,38 |
| Header baseline to the next row's highlight top | 12 (baseline y=224, first row rect y=248..271); 9.5 to the icon top (y=243) | [C] | header cap bottom row y=223; first row centre 259.5 from the icon bbox 10-15-Catalina-Light-Applications.png @ 148,243,36,34 |
| Previous row centre to next header cap top | 28.75 (57.5 px) | [M] | Downloads centre y=519.5, "iCloud" cap top y=577 (10-15-Catalina-Light-Applications.png @ 190,577,7,17) |
| Section pitch | a header consumes 29 pt in the flow: header-to-header = 29 + 26 x rows | [C] | Favorites header 215 -> iCloud 585 (6 rows): 370 px = 6x52 + 58; iCloud -> Locations 695: 110 px = 52 + 58 |
| Icon box | 18 x 18 (glyphs 16-18 wide), centred 26.75 from the window edge; left edge at 18 | [M] | glyph bboxes x=148..183 / 150..181, y heights 28..36 px (10-15-Catalina-Light-Applications.png @ 146,243,40,295) |
| Label left edge | 40.5 from window edge (5 after an 18 pt icon box) | [M] | text starts x=193/194 (same file @ 193,407,3,19) |
| Icon / label in apps with a narrower inset | Mail icon x=88..123 (18 pt from the window's left edge at x=52), label at x=134 (41 pt); Font Book icon box 22..38, label 50; Notes label (no icon) at 21 | [M] | 10-15-Catalina-Light-Mail.png @ 88,256,36,25; 10-15-Catalina-Light-Font-Book.png @ 156,204,150,32; 10-15-Catalina-Light-Notes.png @ 154,217,60,20 |
| Indent per outline level | 16 | [M] | Disk Utility triangle x=123 (level 0) and 155 (level 1); icon x=158 (level 0) and 222 (level 2): 10-15-Catalina-Light-Disk-Utility.png @ 123,283,18,15 and 113,394,190,1 |
| Disclosure triangle | expanded 9 x 7.5 (18 x 15 px), collapsed 7.5 x 9; left edge 5.5 from the pane edge at level 0; 9 pt before the icon | [M] | 10-15-Catalina-Light-Disk-Utility.png @ 123,283,18,15; 10-15-Catalina-Light-Photos.png @ 125,859,15,18 |
| Trailing accessory inset | count text right edge 11-12.5 from the divider; badge right edge 12 | [M] | Notes "5" x=454..465, divider at 492; Reminders "13" right edge x=649, divider 672 |
| Sidebar widths seen | Finder 164.5; Calendar 165; Notes 190; Font Book 200; Console 180; Photos 179; Dictionary 183; Disk Utility 253; Reminders 280; Mail 200; Contacts 222; Find My 261; Messages 270 | [M] | divider x positions: 441 (Finder), 442 (Calendar), 492 (Notes), 512 (Font Book), 472 (Console), 470 (Photos), 478 (Dictionary), 618 (Disk Utility), 672 (Reminders); window left edge x=112 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Material, key window, window-only capture (neutral backdrop) | `#e7e8e8` (seen #e6e7e7 .. #e8e9e9 across apps) | `#2c2d2f` (seen #2b2c2e .. #2c2d30) | [M] | 10-15-Catalina-Light-Finder-Home.png @ 130,600; Light-Notes @ 300,1180 (#e6e7e7); Light-Photos @ 300,1180 (#e8e9e9); 10-15-Catalina-Dark-Finder-Home.png @ 130,600; Dark-Photos @ 300,1180 (#2c2d30) |
| Material, key window over the Catalina wallpaper | `#d0cdc8 (sRGB #d1cdc7)` (over sunlit cliff) .. `#bfc8d2 (sRGB #bdc8d3)` (over ocean) | `#2b303b (sRGB #2a303c)` .. `#2c3238 (sRGB #2b3239)` | [M] | 10-15-Catalina-Light-Contacts.png @ 300,60 / 300,150 / 300,500 / 300,700; 10-15-Catalina-Dark-Contacts.png @ 300,60 / 300,300 / 300,600 |
| Material, inactive window (vibrancy off) | `#f6f6f6` | `#2c2d2f` | [M] | 10-15-Catalina-Light-Mail.png @ 250,600; 10-15-Catalina-Dark-Mail.png @ 240,600 |
| Messages / Find My list material (lighter recipe) | `#c8c7c0 (sRGB #c8c7bf)` over wallpaper (Messages); `#f8f7f5` (Find My window capture) | `#2c2e31` (Messages); `#1e1f20` (Find My) | [M] | 10-15-Catalina-Light-Messages.png @ 900,120; 10-15-Catalina-Light-Find-My.png @ 620,800; 10-15-Catalina-Dark-Messages.png @ 900,110; 10-15-Catalina-Dark-Find-My.png @ 576,776 |
| Opaque fallback (recommended) | `#e7e8e8` active, `#f6f6f6` inactive | `#2c2d2f` both | [M] | as above |
| Selection, not first responder (grey) | `#c7c8c8` on #e7e8e9 = black @ 0.14 | `#505153` on #2c2d2f = white @ 0.17 | [M] colours, [C] alphas | 10-15-Catalina-Light-Applications.png @ 430,350; 10-15-Catalina-Dark-Applications.png @ 430,350; also Light-Notes @ 480,220 (#c6c6c6), Light-Photos @ 460,750 (#c8c9c9), Dark-Reminders @ 660,740 (#505152) |
| Selection, first responder (accent, blue) | `#2f71de (sRGB #136fe6)` | `#2d74e3 (sRGB #0772eb)` (Disk Utility), `#2d74e4 (sRGB #0772ec)` (Notes) | [M] | 10-15-Catalina-Light-Disk-Utility.png @ 600,650; 10-15-Catalina-Dark-Disk-Utility.png @ 600,650; 10-15-Catalina-Dark-Notes.png @ 480,220 |
| Selection, inactive window | `#d2d2d2` | `#505153` | [M] | 10-15-Catalina-Light-Mail.png @ 250,260; 10-15-Catalina-Dark-Mail.png @ 240,260 |
| Selection over wallpaper (vibrant) | `#a39f91 (sRGB #a49f8f)` over cliff | `#47525c (sRGB #45525d)` .. `#4c515f (sRGB #4b5160)` | [M] | 10-15-Catalina-Light-Contacts.png @ 300,100; 10-15-Catalina-Dark-Contacts.png @ 300,110 |
| Window-edge highlight (dark only) | none (1 px `#eaebeb`) | 1 pt `#565759` inner stroke on the leading edge | [M] | 10-15-Catalina-Dark-Finder-Home.png @ 112,600,2,1 (owned by `window`) |

Recipe [I]: the composites over wallpaper fit `tint ~ rgba(209,211,213,0.90)` (light) and `rgba(45,46,48,0.88)` (dark) over a heavily blurred, saturation-boosted backdrop; estimated from two backdrops whose blurred values are not directly observable, so treat as approximate. CSS: `backdrop-filter: blur(30px) saturate(180%)` + that tint for content behind the element inside the page; when nothing sits behind (the normal case in a browser) use the opaque fallback.

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Section header font | SF Pro Text 11 pt Semibold (cap height 16 px, stem ~2.5 px), sentence/title case as authored (not upper-cased) | same | [C] | 10-15-Catalina-Light-Applications.png @ 133,208,1,16; stem 10-15-Catalina-Light-Applications.png @ 131,215,11,1 |
| Section header colour | `#68696a` (Finder), `#686867` (Disk Utility) | `#a8a9ab` | [M] | Light-Applications @ 133,212; Dark-Applications @ 133,212 |
| Row label font | SF Pro Text 13 pt Regular (cap 18 px) | same | [C] | 10-15-Catalina-Light-Applications.png @ 195,408,1,18 |
| Row label colour, normal | `#343536` | `#ffffff` | [M] | Light-Applications @ 195,412; Dark-Applications @ 196,412 |
| Row label colour, selected (grey highlight) | `#141515` (same weight) | `#ffffff` | [M] | Light-Applications @ 300,365; Dark-Applications |
| Row label colour, selected (accent highlight) | `#ffffff` | `#ffffff` | [M] | 10-15-Catalina-Light-Disk-Utility.png row at y=636..683 (text white); Dark-Notes @ 154,217,60,20 |
| Row label, inactive window | `#777777`; selected row `#535353` | `#a8a9ab`; selected `#cccdcf` | [M] | 10-15-Catalina-Light-Mail.png @ 134,310,71,20 and 134,258,63,21; Dark-Mail @ 122,308,71,20 |
| Template icon tint | `#68696a`; selected row `#545555` | `#a8a9ab`; selected `#c0c1c3` | [M] | Light-Applications @ 146,243,40,34 and 148,348,36,32; Dark-Applications same boxes |
| Count text (trailing) | 13 pt, `#8d8d8d` on grey selection; `#686867` unselected (Reminders) | `#ffffff` on accent selection | [M] | Light-Notes @ 454,217,12,19; Light-Reminders @ 636,599,14,19; Dark-Notes @ 454,217,13,20 |
| Disclosure triangle colour | `#686867` | `#a8a9ab` [C from icon tint] | [M] light | 10-15-Catalina-Light-Disk-Utility.png @ 131,288 |

Disclosure triangle geometry (expanded, px at 2x, origin top-left of the 18 x 15 box): polygon (0,0) (18,0) (9,15); collapsed is the same rotated -90 degrees: (0,0) (15,9) (0,18). Solid fill, no stroke [M] (grid 10-15-Catalina-Light-Disk-Utility.png @ 121,280,20,20; 10-15-Catalina-Light-Photos.png @ 122,856,18,22).

### Shadows and effects
None on the sidebar itself. Label and icon colours on the vibrant material are "vibrant" (blended with the backdrop), which is why they are not pure black/grey; over wallpaper they shift with it.

## Layout and spacing
- The sidebar starts directly under the toolbar's 0.5 pt bottom line and runs to the window bottom; its content scrolls under nothing (no top inset beyond the first header's 10.5 pt).
- Section order and spacing: header, rows at 26 pt pitch, then the next header 29 pt slot. A sidebar may also start with a row instead of a header (Font Book "All Fonts", first row highlight starts 5 pt under the toolbar: 10-15-Catalina-Light-Font-Book.png @ 500,186,1,58).
- Footer button [M]: plus-circle glyph 16 pt + 13 pt label. Notes "New Folder": glyph x 136..167, y 1352..1383 (12 pt from the pane edge, glyph bottom 12 pt above the window bottom at y=1407); label ink from x=182 (7 pt after the glyph), baseline 14.5 pt above the window bottom (10-15-Catalina-Light-Notes.png @ 136,1352,182,32). Reminders "Add List": glyph x 144..175, y 1266..1297 (16 pt from the pane edge, glyph bottom 13 pt above the window bottom at y=1323); label ink from x=192 (8 pt after), baseline 16 pt above the window bottom (10-15-Catalina-Light-Reminders.png @ 144,1266,145,32). The two apps differ; neither is a system-wide constant.
- Header [M]: Reminders pins a search field above its lists. The pane runs x 112..671 (280 pt) and the field x 145..638, y 181..222: 247 x 21 pt, 16.5 pt from each edge of the pane, its top 52.5 pt under the window's top edge at y=76 (10-15-Catalina-Light-Reminders.png @ 112,181,560,42; the same rectangle in 10-15-Catalina-Dark-Reminders.png). The distances are Reminders' own, not a system-wide constant; what the header has in common across apps is only that it stays above the scrolling list.
- Minimum width in the library 164.5 pt (Finder); the divider is draggable; double-clicking the divider or View > Hide Sidebar collapses it [D].

## Keyboard and accessibility
Up/Down move the selection, Left/Right collapse/expand an outline item, type-select jumps to a row [D] (NSOutlineView). Full keyboard access puts a focus ring around the whole list, not a row. AX role `AXOutline` with `AXRow` children and `AXDisclosureTriangle`; ARIA: `role="tree"` with `treeitem` (or `listbox`/`option` for a flat list), headers as `role="group"` labels (not focusable).

## Browser notes
- Behind-window vibrancy cannot be reproduced: a web page cannot see the desktop. Use the opaque fallback colours; optionally `backdrop-filter` for in-page content.
- Inactive-window recolouring needs a `:window-inactive`-like state driven by `window.onblur`/`onfocus`.
- Vibrant label blending: use the measured solid colours.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Applications.png | 112,186,330,1200 | Finder sidebar, grey selection, tags |
| dark | 10-15-Catalina-Dark-Applications.png | 112,186,330,1250 | same, dark |
| light | 10-15-Catalina-Light-Disk-Utility.png | 112,216,508,600 | three-level outline, accent selection, eject accessory |
| dark | 10-15-Catalina-Dark-Disk-Utility.png | 112,216,508,600 | same, dark |
| light | 10-15-Catalina-Light-Mail.png | 52,196,400,300 | inactive-window sidebar with badge |
| dark | 10-15-Catalina-Dark-Mail.png | 40,194,400,320 | inactive-window sidebar, dark |
| light | 10-15-Catalina-Light-Contacts.png | 36,40,444,870 | material over wallpaper |
| light | 10-15-Catalina-Light-Reminders.png | 112,136,560,114 | header: the search field pinned above the lists |
| dark | 10-15-Catalina-Dark-Reminders.png | 112,136,560,114 | same, dark |
| dark | 10-15-Catalina-Dark-Contacts.png | 60,56,446,870 | material over wallpaper, dark |
| light/dark | 10-15-Catalina-Light-Photos.png, 10-15-Catalina-Dark-Photos.png | 112,152,358,760 | outline with collapsed and expanded groups |

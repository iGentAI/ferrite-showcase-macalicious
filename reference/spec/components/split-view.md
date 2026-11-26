# Split View (`split-view`)

- **Status:** present (thin dividers, and one thick divider with its dimple in the Sharing pane; the pane-splitter style is not seen in the screenshots)
- **AppKit:** `NSSplitView` (`dividerStyle = .thin | .thick | .paneSplitter`, `isVertical`), `NSSplitViewController` / `NSSplitViewItem` (`.sidebar`, `.contentList`, collapse behaviour)
- **HIG:** https://web.archive.org/web/20200503170954/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/split-views/
- **Appearances shown:** light, dark

## Purpose and behaviour
Manages two or more panes arranged horizontally or vertically and separated by dividers that can usually be dragged to resize. Panes have minimum and maximum sizes and may be hidden; provide toolbar buttons or menu commands to bring hidden panes back. Divider styles: thin 1 pt; thick 9 pt, clear by default; pane splitter 10 pt. The whole divider is draggable, and for thin dividers the hit area extends 2 pt on each side. Prefer thin (all [D], HIG split-views page).

## Anatomy
Panes laid edge to edge; between each pair one divider: a flat line (thin) or a band (thick: transparent, showing the window background, with a centred dimple; pane splitter: gradient band with a centred dimple).

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| Divider style | thin / thick / pane splitter | thin (thick in old nibs) | `dividerStyle` | thin; thick once (Sharing pane, between the Shared Folders and Users lists) |
| Orientation | side-by-side (`isVertical = true`) / stacked | - | `isVertical` | both |
| Divider colour | separator colour, black in dark mode for pane boundaries, custom | system | `dividerColor` | several |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Idle | yes | all |
| Hover | n/a | cursor changes to the resize cursor; no visual change [D] |
| Dragging | no | no visual change, panes resize live [I] |
| Collapsed pane | no | divider sits at the window edge or disappears [I] |
| Inactive window | yes | Mail (main window behind compose): divider `#dedede` (light), `#000000` (dark) |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Thin divider thickness | 1 (2 device px) | [M] | 10-15-Catalina-Light-Finder-Home.png @ 441,600,2,1; 10-15-Catalina-Dark-Finder-Home.png @ 440,600,2,1; 10-15-Catalina-Light-Notes.png @ 492,250,2,1; 10-15-Catalina-Light-Console.png @ 900,530,1,2; 10-15-Catalina-Light-Script-Editor.png @ 1000,1064,1,2 |
| Thick divider | 9, clear: the band between the two bordered lists of the Sharing pane is 9 wide (x 904..921) and shows the pane's box | [M], and [D] HIG split-views "Dividers" | 10-15-Catalina-Light-System-Preferences-Sharing.png @ 902,700,22,1; 10-15-Catalina-Dark-System-Preferences-Sharing.png @ 902,700,22,1 |
| Thick divider dimple | 6 across (x 907..918, y 757..768), centred in the band's width; centred in the split view's height [I: the lists end at y=988, the dimple's centre is 31 px under theirs, so the split view is taken to reach below the lists] | [M] | 10-15-Catalina-Light-System-Preferences-Sharing.png @ 895,739,36,48; 10-15-Catalina-Dark-System-Preferences-Sharing.png @ 895,739,36,48 |
| Pane splitter | 10 | [D] | HIG split-views "Dividers" (not shown) |
| Thin divider hit area | 1 + 2 on each side = 5 | [D] | HIG |
| Divider length | full length of the shared edge, from the toolbar bottom line to the window bottom (or the pane bounds) | [M] | 10-15-Catalina-Light-Applications.png @ 440,186,2,1402 |

### Colours and fills
| Divider | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Sidebar \| content (Finder, Notes, Font Book, Reminders, Calendar) | `#cfd0d0` (also #cecfcf, #cfcfce, #d0d1d1) | `#000000` | [M] | Light-Finder-Home @ 441,600; Light-Notes @ 492,1180; Light-Reminders @ 672,1180; Light-Calendar @ 442,1180; Dark-Finder-Home @ 440,600; Dark-Notes @ 492,1180 |
| Sidebar \| grey content (Disk Utility, Dictionary), opaque pane \| pane (System Information, Gallery preview pane, Contacts list \| card) | `#d5d5d5` | `#000000` | [M] | Light-Disk-Utility @ 618,1180; Light-Dictionary @ 478,1180; Light-System-Information @ 438,600; Light-Finder-Gallery-View @ 2078,300; Light-Contacts @ 858,214; Dark-Disk-Utility @ 618,1180; Dark-Contacts @ 884,234 |
| Photos sidebar \| grid | `#d1d2d2` | `#404143` | [M] | Light-Photos @ 470,1180; Dark-Photos @ 470,1180 |
| Content \| content, horizontal (Console table \| detail, Script Editor editor \| description) | `#d5d5d5` | `#000000` | [M] | Light-Console @ 900,530; Dark-Console @ 900,530; Light-Script-Editor @ 1000,1064; Dark-Script-Editor @ 1000,1064 |
| Automator panes (library \| actions \| workflow, workflow \| log, lists \| description) | `#d4d4d4` | `#2a2a2a` (workflow \| log and lists \| description) | [M] | Light-Automator @ 438,900 and 874,900 and 1400,1474 and 300,1538; Dark-Automator @ 1400,1474 and 300,1538 |
| Notes list \| editor | `#cecfcf` [C: same as its sidebar divider] | `#000000` | [M] dark | Dark-Notes @ 990,250 |
| Column-view column divider | `#e6e6e6` | `#000000` | [M] | see `column-view` |
| Mail, inactive window | `#dedede` (sidebar \| list), `#d2d2d2` (list \| viewer) | `#000000` | [M] | Light-Mail @ 452,300 and 1140,300; Dark-Mail @ 440,300 and 1128,300 |
| Over wallpaper (vibrant sidebar edge) | `#b8b4a7 (sRGB #b9b4a6)` (Contacts), `#c2beaf (sRGB #c3bead)` (Messages) | `#000000` | [M] | Light-Contacts @ 480,214; Light-Messages @ 1286,260; Dark-Contacts @ 506,234 |
| Opaque pane \| pane inside Keychain Access; Automator panes in dark | `#d4d4d4` | `#2a2a2a` | [M] | Light-Keychain-Access @ 460,500; Dark-Keychain-Access @ 460,500 |
| Thick divider fill | transparent (the pane's box shows: `#e3e3e3`) | same (`#353637`) | [M] | Light-System-Preferences-Sharing @ 912,700; Dark-System-Preferences-Sharing @ 912,700 |
| Thick divider dimple | shaded from above: `#a0a0a0` at its top, `#c5c5c5` at mid-height, `#bbbbbb` at its bottom, on `#e3e3e3` (black at 29.5%, 13%, 17.5%) | flat `#4a4a4b` on `#353637` (white at 10.5%) | [M], [C] alphas | Light-System-Preferences-Sharing column x=913, y 757..768; Dark-System-Preferences-Sharing column x=913, y 757..768 |
| Pane splitter fill | not shown; window-background grey, with the thick divider's dimple [I] | same | [I] | - |

Summary for tokens: light `#d5d5d5` between opaque panes, about `#cfd0d0` next to a vibrant sidebar; dark `#000000` everywhere (Photos uses a lighter `#404143`).

### Text and icons
None.

### Shadows and effects
None. In dark mode the black divider plus the lighter content gives the "inset" look; there is no highlight line beside it.

## Layout and spacing
- Dividers add their thickness to the layout (pane A + 1 pt + pane B).
- Typical arrangements in the library: sidebar \| content (most apps); sidebar \| list \| detail (Mail 200 \| 343 \| rest; Notes 190 \| 248 \| rest; Contacts 222 \| 188 \| rest); stacked table over detail (Console, Script Editor, Automator workflow over log).

## Keyboard and accessibility
Dividers are not focusable by default; with VoiceOver the divider is an `AXSplitter` whose value can be incremented/decremented. ARIA: `role="separator"` with `aria-orientation`, `aria-valuenow`, focusable, arrow keys resize.

## Browser notes
Use a 1 CSS px element with a 5 px wide transparent hit area and `cursor: col-resize` / `row-resize`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Notes.png | 480,152,524,300 | two vertical thin dividers |
| dark | 10-15-Catalina-Dark-Notes.png | 480,152,524,300 | same, black |
| light | 10-15-Catalina-Light-Console.png | 474,500,1638,60 | horizontal thin divider |
| dark | 10-15-Catalina-Dark-Console.png | 474,500,1638,60 | same, black |
| light/dark | 10-15-Catalina-Light-Automator.png, 10-15-Catalina-Dark-Automator.png | 112,212,2000,1560 | five panes |
| light/dark | 10-15-Catalina-Light-System-Preferences-Sharing.png, 10-15-Catalina-Dark-System-Preferences-Sharing.png | 895,739,36,48 | thick divider with its dimple, between two bordered lists |

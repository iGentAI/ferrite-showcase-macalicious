# Inspector / Info panel (`inspector-panel`)

- **Status:** present (Finder Get Info, light and dark)
- **AppKit:** Finder's Info window is an `NSWindow`/`NSPanel` with standard-height title bar (not `.utilityWindow`), document proxy icon in the title, stacked collapsible sections (disclosure triangle = `NSButton` `bezelStyle = .disclosure`); small-size controls (`controlSize = .small`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/panels/ and https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/disclosure-controls/
- **Appearances shown:** light, dark

## Purpose and behaviour

A panel is an auxiliary window with information or controls for the current selection. The HIG
distinguishes an *inspector* (updates to follow the selection) from an *Info window* (stays bound to
the item it was opened for; several can be open). Finder's Get Info (Command-I) is an Info window;
Command-Option-I opens the single inspector variant with the same layout. Panels use small controls
and text to save space, are titled with a noun phrase, and hide when the app is inactive if they float
(HIG Panels) [D]. Sections collapse and expand with disclosure triangles; the window grows or shrinks
vertically and keeps its width.

## Anatomy

```
+ (o)(o)(o) [doc] Aqua and Bondi.pdf Info +   title bar 22 pt, proxy icon, title = "<name> Info"
| [icon] Aqua and Bondi.pdf      111.6 MB |   header: 32 pt icon, bold name, bold size right-aligned
|        Modified: July 14, 2018 ...      |   11 pt secondary line
| [ Add Tags...                         ] |   tags field, 33 pt tall
|-----------------------------------------|   1 pt separator between sections
| v General:                              |   section header: triangle + bold 11 pt title
|        Kind: PDF document               |   label column right-aligned, value column
|        ...                              |
|-----------------------------------------|
| > Comments:                             |   collapsed section = header only (19 pt)
|-----------------------------------------|
| v Sharing & Permissions:                |
|   table, [+][-][gear v]          (lock) |
+-----------------------------------------+
```

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| section state | expanded, collapsed | per section, remembered | disclosure button state | General, More Info, Name & Extension, Open with, Sharing & Permissions expanded; Comments, Preview collapsed |
| kind | Info window (one per item), inspector (follows selection, title "Info") | Info window | - | Info window |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| Key window | yes | both captures |
| Locked permissions (controls disabled until the lock is opened) | yes | closed lock at bottom right, 10-15-Catalina-Light-Finder-Get-Info.png @ 581,1712,26,32; privilege pop-ups and [+][-] drawn disabled |
| Disabled small button ("Change All...") | yes | 10-15-Catalina-Light-Finder-Get-Info.png @ 143,1299,162,28 |
| Inactive window | no | [I] standard inactive title bar; content unchanged |

## Measurements

Frame: x 112..641, y 76..1763 px = **265 x 844 pt** in both appearances [M].

### Geometry (pt)

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Title bar | standard 22 pt (y 76..119) with standard 12 pt window controls; not the 16 pt utility title bar | [M] | 10-15-Catalina-Light-Finder-Get-Info.png col 130: close button y 91..104 region, content from y 120 |
| Header icon | 32 pt canvas; artwork 23 x 31 pt at x 143..188, y 142..203 (15.5 pt from the left edge, 11 pt below the title bar) | [M] | @ 143,142,46,62 |
| Name / size line | bold 13 pt, name at x 211 (49.5 pt in), size right-aligned ending x 626 (7.5 pt from the right edge); baseline 43.5 pt below the title bar (y 163) | [M] | @ 211,145,254,24 and @ 524,145,103,20 |
| Modified line | 11 pt, baseline 17 pt below the name baseline (y 197) | [M] | @ 213,182,362,16 |
| Tags field | x 120..633 (4 pt side insets), y 222..287 (33 pt tall), 1 pt border | [M] | rows 250, col 300 |
| Section separator | 1 pt (2 px), full window width (light: x 112..641, the two frame-edge px slightly lighter `#d9d9d9`/`#d8d8d8`; dark: visible at x 114..639 between the window's 1 pt inner rim `#6b6d6f`) | [M] | 10-15-Catalina-Light-Finder-Get-Info.png @ 112,296,530,2 and at y 646, 936, 1086, 1126, 1344, 1384; 10-15-Catalina-Dark-Finder-Get-Info.png row 296 |
| Section header height | separator -> first content row cap top: 27 pt (y 298 -> 352); header title baseline 13.5 pt below the separator's lower row (y 325) | [M] | "General:" @ 157,310,84,16 |
| Collapsed section | 19 pt between separators (y 1088..1125) | [M] | col 130 |
| Disclosure triangle, expanded (down) | 9 x 7 pt (18 x 14 px incl. edge anti-aliasing: x 130..147, y 310..323), left edge 9 pt from the window edge | [M] | row 310, col 138, grid @ 132,310,14,14 |
| Disclosure triangle, collapsed (right) | 7 x 9 pt (x 132..146, y 1099..1114) | [M] | row 1107, col 134 |
| Header title x | 22.5 pt from the window edge (x 157); 5 pt after the expanded triangle | [M] | same |
| Label column (General) | right-aligned, ends x 245 (66.5 pt); values start x 257 (72.5 pt): 6 pt gutter | [M] | @ 196,351,50,18 and @ 257,351,153,18 |
| Label column (More Info) | ends x 335 (111.5 pt); values start x 347 (117.5 pt) | [M] | @ 203,701,133,21 and @ 347,701,262,21 |
| Row pitch | 14 pt (cap tops y 352, 380, 408, 436, 464, 492, 520) | [M] | lay boxes |
| Small checkbox | 12 pt box (x 222..245), title at x 257, row pitch 18 pt (y 570, 606) | [M] | @ 222,570,24,24; @ 222,606,24,24 |
| Name field | x 137..616 (240 pt), y 987..1026 (20 pt), 12.5 pt side insets | [M] | row 1000, col 300 |
| "Open with" pop-up | small size: 234 x 17.5 pt (x 143..610, y 1177..1211) | [M] | @ 143,1177,468,35 |
| Permissions table | x 142..611 (235 pt), y 1478..1703 (113 pt): header row 17 pt, rows 16 pt, vertical divider at x 375 | [M] | @ 142,1478,470,226 |
| Bottom controls | [+][-][gear v] gradient segmented 71 x 17 pt at x 142; lock icon 13 x 16 pt at x 581; bottom margin 9 pt | [M] | @ 142,1712,142,34 |

### Colours and fills

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Window background | `#ececec` | `#323437` | [M] | 10-15-Catalina-Light-Finder-Get-Info.png @ 400,130 `#ececec`; 10-15-Catalina-Dark-Finder-Get-Info.png @ 400,130 `#323437` |
| Section separator | `#d5d5d5` | `#46484b` | [M] | 10-15-Catalina-Light-Finder-Get-Info.png @ 300,296 `#d5d5d5`; 10-15-Catalina-Dark-Finder-Get-Info.png @ 300,296 `#46484b` |
| Disclosure triangle | `#8c8c8c` | `#7c7c7c` | [M] | 10-15-Catalina-Light-Finder-Get-Info.png @ 138,315 `#8c8c8c`; 10-15-Catalina-Dark-Finder-Get-Info.png @ 138,315 `#7c7c7c` |
| Tags field fill / border | `#ffffff` / `#c5c5c5` | `#202225` / `#565656` | [M] | 10-15-Catalina-Light-Finder-Get-Info.png @ 300,250 `#ffffff`, @ 300,222 `#c5c5c5`; 10-15-Catalina-Dark-Finder-Get-Info.png @ 300,250 `#202225`, @ 300,222 `#565656` |
| Name field border | `#b1b1b1` (top/sides) | - | [M] | 10-15-Catalina-Light-Finder-Get-Info.png @ 300,987 `#b1b1b1` |

The dark background `#323437` is noticeably bluer than the `#303031`/`#303132` of other dark windows
in this group: dark window backgrounds pick up the wallpaper's average colour (desktop tinting, see
`accent-colors`), so the exact grey depends on where the window sat when captured [M].

### Text and icons

| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title | "<file name> Info", 13 pt regular, preceded by a 16 pt proxy icon | same | [M] | @ 258,84,330,28 |
| File name and size | SF Pro Text Bold 13 pt (cap 19 px, stem 4 px), `#000000` | `#ffffff` | [M], [C] | @ 211,145,17,19 |
| Secondary line ("Modified: ...") | SF Pro Text Regular 11 pt (cap 16 px), `#767676` | `#a3a3a5` | [M], [C] | @ 213,182,16,16 in both files |
| Section header | SF Pro Text Bold 11 pt (cap 16 px, stem 3 px), `#000000`, ends with a colon | `#ffffff` | [M], [C] | @ 157,310,14,16 in both files |
| Labels and values | SF Pro Text Regular 11 pt (cap 16 px), `#000000`; labels right-aligned with colon | `#ffffff` | [M], [C] | @ 258,352,11,16 |
| Path value | components joined by small right-pointing triangles ("Macintosh SSD > Users > shackett > Documents"), wraps with hanging indent | same | [M] | @ 257,435,354,46 |
| Disabled text ("Change All...", "Preview (default)" suffix) | `#b8b8b8`-class | - | [M] | @ 143,1299,162,28 |

### Shadows and effects

Standard window shadow (margins as other window captures).

## Layout and spacing

Sections stack with a 1 pt separator between them and no other gap. Expanding a section inserts its
content and grows the window downward (animated); the window is not user-resizable in width. Each
section has its own label-column width (General 66.5 pt, More Info 111.5 pt), chosen to fit its longest
label.

## Keyboard and accessibility

Command-I opens, Command-W closes; disclosure triangles respond to click and, when focused, Space and
the arrow keys (Right expands, Left collapses) [D: HIG Disclosure Controls]. AX: each header is an
AXDisclosureTriangle with AXValue 0/1 and a title. ARIA: a `button` with `aria-expanded` controlling a
`region`; label/value pairs as a description list.

## Browser notes

The triangle is a filled isosceles triangle; SVG path for the 9 x 7 pt expanded state:
`M0 0 H9 L4.5 7 Z`; rotate -90 degrees for collapsed (measured 7 x 9 pt) [C]. Height animation needs
measured heights.

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Finder-Get-Info.png | 112,76,530,1688 | whole Info window |
| dark | 10-15-Catalina-Dark-Finder-Get-Info.png | 112,76,530,1688 | same, dark |
| light | 10-15-Catalina-Light-Finder-Get-Info.png | 112,296,530,60 | section header with expanded triangle |
| light | 10-15-Catalina-Light-Finder-Get-Info.png | 112,1086,530,42 | collapsed section header |

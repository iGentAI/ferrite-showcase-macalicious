# Notes
- **Screenshots:** 10-15-Catalina-Light-Notes.png, 10-15-Catalina-Dark-Notes.png
- **Window:** 1000 x 666 pt [M] (image x=112..2111, y=76..1407). Unified toolbar with hidden title (38 pt incl. bottom line).

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Toolbar | 38 high (y=76..151) | gradient `#f5f5f5` -> `#bdbdbd`, bottom line `#a7a7a7` | `#3a3b3d`-ish gradient, bottom line `#000000` | [M] Light-Notes @ 250,76,1,76; Dark-Notes @ 480,150,1,2 |
| Folder sidebar (`sidebar`) | 190 wide (x=112..491) | `#e6e7e7` | `#2c2d2e` | [M] @ 300,1180 |
| Divider | 1 | `#cecfcf` | `#000000` | [M] @ 492,250 |
| Note list (`list-view`) | 248 wide (x=494..989), rows 56 | paper texture ~`#f9f9f7` | `#1e1f21` | [M] Dark-Notes @ 494,250,496,1 |
| Divider | 1 | (textured, not resolved) | `#000000` | [M] Dark-Notes @ 990,250 |
| Editor (`text-view`) | 560 wide (x=992..2111) | paper texture ~`#f9f9f7` | `#232425` textured | [M] Dark-Notes @ 1500,300 |

```
[o o o] [list|grid]   [sidebar][attach][trash][compose]     [lock v][table][check][Aa]   [media v][people][share] [Search]
+ iCloud (*) -+ Catalina Notes is just... [img] +        October 3, 2019 at 3:55 PM        +
|  Notes    5 | 3:55 PM  View.                  | Catalina Notes is just about the same...  |
|             | All computers should be orange  |   [ embedded screenshot image ]            |
| (+) New Folder                                |                                            |
```

Toolbar item extents (px, both appearances identical): view switch (list | gallery) 268..404 with the list segment selected; four 37 pt buttons at 503..576, 595..668, 687..760, 779..852 (show/hide folders, attachments browser, delete, new note); second group 1001..1074 (lock pull-down), 1093..1166 (table), 1185..1258 (checklist), 1277..1350 (format "Aa"); third group 1405..1478 (media pull-down), 1497..1570 (add people), 1589..1662 (share); search field 1681..2094 (207 pt) [M] (10-15-Catalina-Light-Notes.png row y=96, face/gap transitions). Button height 23 pt (y=91..136).

## Components used
`window`, `window-controls`, `toolbar` (title hidden), `toolbar-segmented-control`, `toolbar-button`, `toolbar-pop-up`, `toolbar-search-field`, `sidebar` (grey selection in light, accent selection in dark), `sidebar-badge` (plain count "5"), `progress-spinner` (next to "iCloud" in light), `split-view`, `list-view`, `text-view`, `image-view` (embedded screenshot), `image-button` ("New Folder").

## App-specific elements
- Note row: title 13 pt Bold, single line, tail-truncated; second line date (primary colour) + snippet (grey), 18 pt below; optional 41 x 40 pt thumbnail at the row's right edge (x~894..975, 7 pt from the divider) with a hairline outline. Separator 1 pt inset 25 pt. [M] see `list-view`.
- Editor: centred date line 12 pt `#909190` (y=174..195); title about 17 pt Bold `#444545`, left inset 24 pt from the pane edge (x=1040), wraps to two lines at 20 pt pitch [M] 10-15-Catalina-Light-Notes.png @ 1040,221,890,74.
- Paper texture in light mode (list and editor); dark mode uses a very faint texture on `#232425`.
- Footer: plus-circle + "New Folder" 13 pt grey, at the sidebar bottom.

## Content in the screenshot
Sidebar: "iCloud"; "Notes" 5; "New Folder". List: "Catalina Notes is just..." / "3:55 PM  View." (dark: "Yesterday  View."); "All computers should be orange" / "9/20/18  It's true."; "Are these what the kid..." / "7/15/18  1 photo"; "This is a note in Yosemite" / "7/14/18  It's kinda nice in here."; "This is a note in Mavericks." / "6/13/18  Here is an image:". Editor: "October 3, 2019 at 3:55 PM"; "Catalina Notes is just about the same as before, but adds a Gallery View."; an embedded screenshot of Notes in gallery view. Search placeholder "Search".

## Not reproducible / assets needed
Paper texture; note thumbnails and the embedded screenshot; toolbar glyphs.

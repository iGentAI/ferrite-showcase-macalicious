# Disk Utility
- **Screenshots:** 10-15-Catalina-Light-Disk-Utility.png, 10-15-Catalina-Dark-Disk-Utility.png
- **Window:** 926 x 571 pt [M] (image x=112..1963, y=76..1217). Title bar + icon-and-label toolbar, 70 pt (y=76..215). Title "Disk Utility".

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Title + toolbar | 70 | gradient `#f7f7f7` -> `#bdbdbd`, line `#a7a7a7` | `#363738`, line `#000000` | [M] Light-Disk-Utility @ 250,76,1,140; Dark @ 1700,210,1,6 |
| Sidebar (`sidebar`, outline) | 253 wide (x=112..617) | `#e7e7e6` | `#2c2d2e` | [M] @ 300,1180 |
| Divider | 1 | `#d5d5d5` | `#000000` | [M] @ 618,1180 |
| Detail pane | 672 wide (x=620..1963) | `#ececec` | `#303132` | [M] @ 1000,1000 / Dark @ 1700,400 |

Detail pane contents (light px; pane left edge x=620):

| Element | Geometry | Colours | Tag / evidence |
|---|---|---|---|
| Volume icon | 64 pt, left edge about 32 pt from the pane edge, top about 26 pt below the toolbar | artwork | visual |
| Title "Macintosh SSD" | about 24 pt Bold; sub-lines 13 pt and 11 pt grey | primary / secondary | [C] visual |
| Capacity box "249.85 GB" | outlined box, 1 pt border, top y=285, bottom y=361 (38 pt high), right-aligned 16.5 pt from the window edge; caption "SHARED BY 6 VOLUMES" 9 pt | border `#767676` light / `#a2a2a3` dark, no fill | [M] Light-Disk-Utility @ 1700,285,1,78; Dark @ 1700,285,1,78 |
| Rule | 1 pt at y=440 and y=678, inset 33 pt | `#d5d5d5` / `#444546` | [M] @ 1700,440,1,2 and 1700,678,1,2 |
| Usage bar | x=688..1887 (600 pt), y=494..541 (24 pt incl. 1 pt border), rounded ends about 4 pt | border `#d1d1d1`, track `#ffffff`, used `#4eacf2 (sRGB #19adf8)`; dark: border `#808080`, track `#38393a`, used `#3f6f92 (sRGB #2f7095)` with a 1 pt bright leading edge `#4eacf2 (sRGB #19adf8)` | [M] Light @ 680,518,1220,1 and 1200,494,1,48; Dark @ 680,518,1220,1 |
| Legend | three items (Used / Other Volumes / Free) at thirds of the bar, 9 pt square swatch + 11 pt Bold label, value line 11 pt grey below | swatches blue / grey / white | visual |
| Info table | rounded 1 pt outlined box, top y=728, rows 31 pt (lines at y=792, 854, 916), two columns of label/value pairs | border and lines `#d1d1d1`, fill `#ffffff`; dark: lines `#808080`, fill `#38393a` | [M] @ 1700,728,1,190 |

Toolbar (px, row y=150; labels below): View pull-down 127..220 (47 pt, label "View"); Volume "+ | -" pair 315..434 (60 pt, label "Volume"); First Aid 778..855; Partition 883..960; Erase 982..1059 (disabled); Restore 1077..1154 (disabled); Unmount 1190..1267 (disabled); Info 1871..1948 (each 39 pt wide) [M].

```
                                Disk Utility
 [View v]   [+|-]            [First Aid][Partition][Erase][Restore][Unmount]            [Info]
+ Internal ----------------+   [icon]  Macintosh SSD                     [ 249.85 GB ]
| v [] APPLE SSD AP0512M.. |           APFS Volume - APFS                 SHARED BY 6 VOLUMES
|   v [] Container disk1   |   ------------------------------------------------------------
|       [] Macintosh HD    |   [####______________________________________________________]
| External                 |    Used 16.36 GB      Other Volumes --        Free 198.03 GB
|       [] Macintosh SSD   |   +---------------------------+--------------------------+
|       [] Time Machine  ^ |   | Mount Point:            / | Type:         APFS Volume |
```

## Components used
`window`, `title-bar`, `window-controls`, `toolbar`, `toolbar-labelled-item`, `toolbar-button`, `toolbar-pop-up`, `toolbar-segmented-control` (+/-), `sidebar` + `outline-view` (3 levels, 16 pt indent, accent selection), `disclosure-triangle`, `split-view`, `level-indicator`-like usage bar (custom), `separator`, `box`, `label`, `image-view`.

## App-specific elements
- Sidebar rows: 18 pt grey disk/volume artwork icons; eject glyph at the right edge of external disks ("Samsung Portable SSD T3...", "Time Machine"), x~574..588; text truncates with a tail ellipsis before it.
- Selected sidebar row is accent blue (`#2f71de (sRGB #136fe6)` / `#2d74e3 (sRGB #0772eb)`) with white text and white-tinted icon: the sidebar is first responder.

## Content in the screenshot
Sidebar: "Internal": APPLE SSD AP0512M Media > Container disk1 > Macintosh HD, Macintosh HD - Data. "External": Samsung Portable SSD T3... > Container disk3 > Macintosh SSD (selected), Macintosh SSD - Data, Time Machine. Detail: "Macintosh SSD", "APFS Volume \u2022 APFS", "macOS 10.15"; "249.85 GB", "SHARED BY 6 VOLUMES"; legend Used 16.36 GB (dark: 10.9 GB), Other Volumes --, Free 198.03 GB (dark: 191.72 GB); table: Mount Point: /; Capacity: 249.85 GB; Available: 203.51 GB (5.48 GB purgeable) (dark: 194.4 GB (2.68 GB purgeable)); Used: 16.36 GB (dark 10.9 GB); Type: APFS Volume; Owners: Enabled; Connection: USB; Device: disk3s4. Toolbar labels: View, Volume, First Aid, Partition, Erase, Restore, Unmount, Info.

## Not reproducible / assets needed
Disk and volume artwork (yellow external-drive icon with Finder face), toolbar glyphs.

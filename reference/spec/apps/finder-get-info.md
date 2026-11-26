# Finder Get Info

- **Screenshots:** 10-15-Catalina-Light-Finder-Get-Info.png, 10-15-Catalina-Dark-Finder-Get-Info.png
- **Window:** 265 x 844 pt (frame x 112..641, y 76..1763 px), standard title bar with proxy icon and window controls (zoom disabled), not resizable in width [M]

All component measurements are in `components/inspector-panel.md`; this file lists the regions and the
content needed to rebuild the screen.

## Layout

| Region (top to bottom) | y px (light) | Height pt | Light bg | Dark bg | Notes |
|---|---|---|---|---|---|
| Title bar | 76..119 | 22 | title-bar gradient | dark gradient | controls + proxy icon + "Aqua and Bondi.pdf Info" |
| Header (icon, name, size, modified) | 120..213 | 47 | `#ececec` | `#323437` | |
| Tags field | 222..287 | 33 | `#ffffff`, border `#c5c5c5` | `#202225`, border `#565656` | placeholder "Add Tags..." |
| General (expanded) | 298..645 | 174 | `#ececec` | `#323437` | 7 text rows + 2 checkboxes |
| More Info (expanded) | 648..935 | 144 | | | 8 rows |
| Name & Extension (expanded) | 938..1085 | 74 | | | text field + checkbox |
| Comments (collapsed) | 1088..1125 | 19 | | | header only |
| Open with (expanded) | 1128..1343 | 108 | | | pop-up, help text, button |
| Preview (collapsed) | 1346..1383 | 19 | | | header only |
| Sharing & Permissions (expanded) | 1386..1763 | 189 | | | text, table, buttons, lock |

Separators (1 pt, `#d5d5d5` light / `#46484b` dark) sit between all regions at y 296, 646, 936, 1086,
1126, 1344, 1384 [M].

```
[title bar]
[icon] name ........ size
       Modified: ...
[ Add Tags...          ]
--------------------------
v General:
      Kind: ...
--------------------------
v More Info:
...
```

## Components used

`inspector-panel` (window, sections), `title-bar` (with proxy icon), `window-controls`,
`disclosure-triangle`, `token-field` (tags), `label`, `checkbox` (small), `text-field` (name),
`pop-up-button` (small; "Open with" and the privilege pop-ups), `push-button` (small, disabled),
`table-view` + `table-header` (permissions), `gradient-button` ([+][-]), `pull-down-button` (gear),
`lock-button`, `separator`.

## App-specific elements

- Path value with small triangle separators between components (11 pt), wrapping to a second line.
- Privilege cells: a small up/down chevron glyph followed by the value ("Read & Write"), i.e. pop-up
  cells without a bezel (10-15-Catalina-Light-Finder-Get-Info.png @ 385,1528,220,96) [M].
- User icons in the Name column: single person, pair, group (template, 14 pt).

## Content in the screenshot

- Title: "Aqua and Bondi.pdf Info". Header: "Aqua and Bondi.pdf", "111.6 MB", "Modified: July 14,
  2018 at 6:52 PM".
- General: Kind "PDF document"; Size "111,631,362 bytes (111.6 MB on disk)"; Where "Macintosh SSD >
  Users > shackett > Documents"; Created "December 31, 2016 at 1:17 PM"; Modified "July 14, 2018 at
  6:52 PM"; checkboxes "Stationery pad", "Locked" (both off).
- More Info: Last opened "Sep 21, 2018 at 10:14 AM" (dark: "Oct 3, 2019 at 3:16 PM"); Version "1.4";
  Pages "81"; Resolution "1024x748"; Security "None"; Content Creator "iBooks Author"; Encoding
  software "Mac OS X 10.10.5 Quartz PDFContext".
- Name & Extension: field "Aqua and Bondi.pdf"; checkbox "Hide extension" (off).
- Comments: collapsed. Open with: pop-up "Preview (default)" with Preview icon; text "Use this
  application to open all documents like this one."; button "Change All..." (disabled).
- Preview: collapsed. Sharing & Permissions: "You can read and write"; table columns "Name",
  "Privilege"; rows "shackett (Me)" Read & Write, "staff" Read only, "everyone" Read only, two empty
  rows; buttons +, -, gear; closed lock.

## Not reproducible / assets needed

PDF document icon (32 pt and 16 pt proxy), Preview app icon (16 pt), lock icon (closed, gold), user /
group glyphs.

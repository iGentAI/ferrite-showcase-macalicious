# Storage Management

- **Screenshots:** 10-15-Catalina-Light-Storage-Management.png, 10-15-Catalina-Dark-Stroage-Management.png
- **Window:** 801 x 532 pt (frame x 112..1713, y 76..1139 px); standard title bar with all three window controls enabled; title "Macintosh SSD - 195.81 GB available of 249.85 GB" (dark: "193.78 GB") [M]

## Layout

| Region | px (light) | Size pt | Light | Dark | Evidence |
|---|---|---|---|---|---|
| Title bar | y 76..119 | 801 x 22 | gradient | dark gradient | [M] |
| Sidebar | x 112..511, y 120..1139 | 200 x 510 | `#e7e7e5` | `#2b2c2d` | [M] 10-15-Catalina-Light-Storage-Management.png @ 300,500 `#e7e7e5`; 10-15-Catalina-Dark-Stroage-Management.png @ 300,500 `#2b2c2d` |
| Sidebar divider | x 512..513 | 1 | `#d5d5d5` | `#000000` | [M] 10-15-Catalina-Light-Storage-Management.png @ 512,500 `#d5d5d5`; 10-15-Catalina-Dark-Stroage-Management.png @ 512,500 `#000000` |
| Content | x 514..1713, y 120..1139 | 600 x 510 | `#ffffff` | `#1e1e20` | [M] 10-15-Catalina-Light-Storage-Management.png @ 1000,500 `#ffffff`; 10-15-Catalina-Dark-Stroage-Management.png @ 1000,500 `#1e1e20` |

Sidebar rows: first row "Recommendations" 28 pt (y 120..175), selected with the accent colour and white text: light `#2f70dd (sRGB #146ee5)` (10-15-Catalina-Light-Storage-Management.png @ 300,130), dark `#2d73e2 (sRGB #0971ea)` (10-15-Catalina-Dark-Stroage-Management.png @ 300,130) [M]; a 1 pt separator; then
category rows at 28 pt pitch, each with a 16..18 pt glyph at x ~132, 13 pt name at x 190 and a
right-aligned 11 pt grey size ending 9 pt before the divider; a second separator; then dimmed
non-clickable rows (System, Other) [M: 10-15-Catalina-Light-Storage-Management.png @ 114,122,400,480].

Content: four recommendation rows of 113 pt (separator lines at y 372, 598, 824; x 556..1669,
`#e6e6e6` light / `#343436` dark), each [M]:

| Part | px (row 1) | Size pt |
|---|---|---|
| Icon | x 584..671, y 187..274 | 44 x 44, 35 pt from the content's left edge |
| Title, bold 13 pt | x 709, cap top y 189 | 12.5 pt right of the icon |
| Description, regular 12 pt (cap 18 px), 3 lines at 15 pt pitch, max width ~317 pt | x 709, y 223..306 | `#272727` |
| Action button, 127 x 20 pt | x 1391..1644, y 225..264 | right margin 34.5 pt |

## Components used

`window`, `title-bar`, `window-controls`, `sidebar` (with icons, sizes, separators, disabled rows),
`highlight-color` (accent sidebar selection), `split-view`, `separator`, `label`, `push-button`,
`image-view`.

## App-specific elements

- Selected sidebar glyph: white lightbulb in a blue-tinted disc (10-15-Catalina-Light-Storage-Management.png @ 132,124,50,48) [M].
- Disabled button look for "Turn On..." is not used; all four buttons are enabled.

## Content in the screenshot

- Sidebar (light): Recommendations; Documents 6.92 GB; iCloud Drive 3.6 MB; Music 58.4 MB; Photos
  256.3 MB; TV 6 GB; (separator) System 16.36 GB; Other 6.32 GB. Dark: Recommendations; Documents 6.92
  GB; iCloud Drive 3.6 MB; Music 58.4 MB; Photos 256.3 MB; Podcasts 117.5 MB; Trash 11.7 MB; TV 6 GB;
  (separator) Other 12.45 GB.
- Rows: "Store in iCloud" / "Store all files, photos, and messages in iCloud and save space by keeping
  only recent files and optimized photos on this Mac when storage space is needed." / button "Store in
  iCloud..."; "Optimize Storage" / "Save space by automatically removing movies and TV shows that
  you've already watched from this Mac." / "Optimize..."; "Empty Trash Automatically" / "Save space by
  automatically erasing items that have been in the Trash for more than 30 days." / "Turn On...";
  "Reduce Clutter" / "Sort through documents and other content stored on this Mac and delete what is no
  longer needed." / "Review Files".

## Not reproducible / assets needed

iCloud tile icon, Apple TV app icon, Trash icon, documents-stack icon (44 pt each); sidebar glyphs.

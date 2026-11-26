# Title bar (`title-bar`)

- **Status:** present
- **AppKit:** `NSWindow` title bar (`NSTitlebarView`), `titleVisibility`, `titlebarAppearsTransparent`, `representedURL` (proxy icon), `NSTitlebarAccessoryViewController`; small variant with `styleMask.utilityWindow`
- **HIG:** https://web.archive.org/web/20200503141343/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/
- **Appearances shown:** light, dark

## Purpose and behaviour
The title bar sits at the top of a window and holds the close, minimize and zoom controls and usually a title; a document window may also show an icon and let the user click the title to rename, tag or move the document [D]. Titles use the display name, never a path [D]. With a toolbar the two are drawn as one continuous surface ("integrated title bar and toolbar") [D].

## Anatomy
```
 row 0      top highlight (0.5 pt)                 light #f6f6f6 / dark #858686
 row 1      second highlight row (0.5 pt)          light #ececec / dark #767677
 ...        vertical gradient over the whole chrome height
 last-1     shadow row (0.5 pt)                    light #bdbdbd / dark #2a2a2a
 last       separator (0.5 pt)                     light #a7a7a7 / dark #000000
```
Contents: window controls at the leading edge, optional proxy icon + title centred on the window, toolbar items below (or beside, when the title is hidden).

## Variants and parameters
Heights include the two bottom rows (shadow + separator = 1 pt).

| Variant | Height (pt) | Tag | Evidence (column near the right edge of the frame, frame top y=76 unless noted) |
|---|---|---|---|
| Plain title bar | 22 | [M] | `10-15-Catalina-Light-Finder-Get-Info.png @ 634,76,1,44`; same in Boot Camp Assistant, Chess, Force Quit, Go To Folder, Storage Management, System Information |
| Title bar + icon-only toolbar (unified) | 55 | [M] | `10-15-Catalina-Light-Finder-Network.png @ 1200,76,1,110`; Preview, Font Book, Script Editor, Finder Search |
| Title-hidden toolbar (controls and items on one row) | 38 | [M] | `10-15-Catalina-Light-System-Preferences-General.png @ 900,76,1,76`; Safari, Notes, Photos, Stocks, News, Keychain Access |
| Title bar + icon-and-text toolbar | 70 (Disk Utility), 68 (Automator) | [M] | `10-15-Catalina-Light-Disk-Utility.png @ 150,76,1,140`; `10-15-Catalina-Light-Automator.png @ 150,76,1,136` |
| Title bar + toolbar with segmented control only | 56 | [M] | `10-15-Catalina-Light-Activity-Monitor.png` separator at offsets 110-111 px |
| Title bar + format-bar accessory (TextEdit) | 48 | [M] | `10-15-Catalina-Light-Text-Edit.png @ 1100,76,1,96` |
| Utility panel (small title bar 16 + toolbar) | 49 | [M] | `10-15-Catalina-Light-Help.png @ 90,38,1,98` (frame top y=38) |
| Preferences toolbar window | 78 | [M] | see `preferences-toolbar` (dialogs group) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| key | yes | all window captures |
| main, not key | yes | `10-15-Catalina-Light-Finder-Quick-Look.png @ 900,258,1,110`: same gradient as key (`#f5f5f5`, `#ececec`, `#e5e5e5` ... `#cdcdcd`, `#bdbdbd`, `#a7a7a7`) |
| inactive | yes | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 900,104,1,76`; `10-15-Catalina-Light-Split-Screen-Apps.png @ 1200,0,1,76` |
| edited document (dot in close button, "Edited" suffix) | no | [D] `isDocumentEdited` |
| title clicked (rename popover) | no | [D] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Title baseline below window top (22 pt strip) | 16 | [M] | `10-15-Catalina-Light-Finder-Network.png @ 1010,84,96,28` (last ink row y=107) |
| Title cap height | 18-19 px -> 13 pt | [C] | same crop, "C" rows 89..107, "l" rows 88..107 |
| Title position | icon + title group centred on the window width | [M] | group x 981..1092, window centre 1037.5 (`10-15-Catalina-Light-Finder-Network.png`) |
| Title in the 38 pt bar | 13 pt, centred on the window, vertical centre 19 pt | [M] | `10-15-Catalina-Light-System-Preferences-General.png @ 734,105,66,20` |
| Proxy icon | 16 x 16 box, about 4 pt before the title | [C] | `10-15-Catalina-Light-Finder-Network.png @ 981,88,26,21` (icon ink), title starts x=1019; `10-15-Catalina-Light-Text-Edit.png @ 656,85,24,28` (document icon), title starts x=694 |
| Utility panel title | 11 pt, cap rows y 45..62 in a 16 pt strip | [C] | `10-15-Catalina-Light-Help.png @ 823,45,196,18` |

### Colours and fills
Gradient stops are positions inside the chrome between row 2 and the last fill row; the gradient is linear and stretches with the chrome height.

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Row 0 (top highlight) | `#f6f6f6` | `#858686` | [M] | `10-15-Catalina-Light-Finder-Network.png @ 1200,76`; `10-15-Catalina-Dark-Finder-Network.png @ 1300,76` |
| Row 1 | `#ececec` | `#767677` | [M] | `@ 1200,77`; `@ 1300,77` |
| Gradient, key, 55 pt chrome | 0% `#e5e5e5`, 20% `#e1e1e1`, 40% `#dbdbdb`, 60% `#d6d6d6`, 80% `#d1d1d1`, 100% `#cdcdcd` | 0% `#404142`, 20% `#3c3e3f`, 40% `#3b3c3d`, 60% `#38393a`, 80% `#363738`, 100% `#343435` | [M] | column x=1200, y 78, 99, 120, 141, 162, 183 (light); x=1300 same rows (dark) |
| Gradient, key, 38 pt chrome | `#e5e5e5` -> `#cccccc` | `#424344` -> `#353637` | [M] | `10-15-Catalina-Light-System-Preferences-General.png @ 900,78` and `@ 900,149`; dark same |
| Gradient, key, 22 pt | `#e5e5e5` -> `#cecece` | `#3f4041`-ish -> `#363637` | [M] | `10-15-Catalina-Light-Finder-Get-Info.png` rows 78..117; `10-15-Catalina-Dark-Finder-Go-to-Folder.png` |
| Shadow row (last-1) | `#bdbdbd` | `#2a2a2a` | [M] | `@ 1200,184`; `@ 1300,184` |
| Separator (last) | `#a7a7a7` | `#000000` | [M] | `@ 1200,185`; `@ 1300,185` |
| Inactive: top row | `#fdfdfd` | `#747578`, then `#636465` | [M] | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 900,104`; `10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png @ 900,78` and `@ 900,79` |
| Inactive: fill (flat) | `#f6f6f6` | `#2b2c2f` (Safari), `#2d2d2d` (Notes) | [M] | `@ 900,140` light; `@ 900,120` dark; `10-15-Catalina-Dark-Split-Screen-Apps.png @ 1200,8` |
| Inactive: bottom two rows | `#e7e7e7`, `#d1d1d1` (Safari); `#e7e7e7`, `#cecece` (Notes) | `#242424`, `#000000` (Notes); `#3c3d3f`, `#494a4c` above a tab bar (Safari) | [M] | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 900,178` and `@ 900,179`; `10-15-Catalina-Light-Split-Screen-Apps.png @ 1200,74`; `10-15-Catalina-Dark-Split-Screen-Apps.png @ 1200,74`; `10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png @ 900,152` |
| Toolbar over scrolled light content (dark only) | no change | `#616364` -> `#585a5c` | [M] | `10-15-Catalina-Dark-Preview-Search.png @ 1500,180` vs `@ 300,180` = `#323335` over the sidebar |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title font | SF Pro Text 13 pt Regular | same | [C] | cap height 18 px, stem 2 px (`10-15-Catalina-Light-Finder-Network.png @ 1020,98,2,1`) |
| Title colour, key | `#555555` on `#e1e1e1` (= black @ 0.62) | `#b9babb` on `#3d3e3f` (= white @ 0.64) | [M] colour, [C] alpha | `10-15-Catalina-Light-Finder-Network.png @ 1020,98`, `@ 1046,98`; `10-15-Catalina-Light-Text-Edit.png @ 703,98`; `10-15-Catalina-Dark-Finder-Network.png @ 1139,98`, `@ 1154,98` |
| Title colour, inactive | `#b9b9b9` | `#606163` | [I] | not captured with a title; `disabledControlTextColor` (25% of label colour) over the inactive fill |
| Utility title colour | `#535353` | `#bebfc0` | [M] | `10-15-Catalina-Light-Help.png @ 823,45,196,18`; `10-15-Catalina-Dark-Help.png` same crop |
| Tracking | default SF Text tracking at 13 pt | same | [I] | system font |

### Shadows and effects
None inside the bar. In full screen the revealed bar casts a short shadow on the content (see `full-screen-window`).

## Layout and spacing
- Window controls: see `window-controls` (centre y = 11 pt in titled bars, 19 pt in the 38 pt bar, 8 pt in the utility bar).
- With a toolbar the item row starts 25 pt below the window top (22 pt title strip + 3 pt) and ends 8 pt above the bottom edge.
- A long title is truncated in the middle; the title never overlaps toolbar items [D].

## Keyboard and accessibility
Double-click zooms or minimises (System Preferences > Dock setting) [D]. Command-click on the title shows the path menu [D]. `AXStaticText` title inside `AXWindow`; expose the title as the window's accessible name (`aria-labelledby`).

## Browser notes
Use `linear-gradient(#e5e5e5, #cdcdcd)` (light) or `linear-gradient(#404142, #343435)` (dark) under a 1 px `#f6f6f6`/`#858686` top line; the two bottom rows are a 1 pt `border-bottom` that needs two 0.5 pt colours (use a gradient or `box-shadow: inset 0 -0.5px #a7a7a7, inset 0 -1px #bdbdbd`).

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Network.png` | 112,76,1852,110 | 55 pt unified bar, proxy icon and title |
| dark | `10-15-Catalina-Dark-Finder-Network.png` | 112,76,1998,110 | same in dark |
| light | `10-15-Catalina-Light-System-Preferences-General.png` | 112,76,1336,76 | 38 pt title-centred bar |
| light | `10-15-Catalina-Light-Finder-Get-Info.png` | 112,76,530,44 | plain 22 pt title bar |
| light | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png` | 316,104,1900,76 | inactive bar |
| light | `10-15-Catalina-Light-Help.png` | 46,38,1754,98 | utility panel bar |

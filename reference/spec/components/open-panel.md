# Open panel (`open-panel`)

- **Status:** present (TextEdit's Open dialog, two folders, light and dark)
- **AppKit:** `NSOpenPanel` (`canChooseFiles`, `canChooseDirectories`, `allowsMultipleSelection`, `accessoryView`, `prompt`, `message`, `showsHiddenFiles`); document-based apps add the "New Document" button and iCloud container sidebar item
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/dialogs/ ("Open Dialogs")
- **Appearances shown:** light, dark

## Purpose and behaviour

The app-modal file chooser. It embeds a miniature Finder: toolbar with back/forward, view switcher,
group/new-folder button, location pop-up and search; sidebar; file browser in the chosen view; and a
bottom bar with app buttons on the left and Cancel/Open on the right. The Open button is the default
and is disabled until something openable is selected. The HIG asks apps to use the system panel, to
remember the last location, and to filter to file types the app can open [D].

## Anatomy

```
+--------------------------------------------------------------------------------------+
| [<][>]  [view v]  [folder+]        [ (icon) Documents            ^v ]   [ Q Search ] |  toolbar 42 pt + 1 pt line (no title, no window controls)
+-----------+--------------------------------------------------------------------------+
| Favorites | Shared Folder                    (header band 23 pt, optional)          |
|  Recents  +--------------------+-----------------------------------------------------+
|  ...      | file column 204 pt | preview column (icon/preview, name, Information)    |
| sidebar   |                    |                                                     |
| 155 pt    |                    |                                                     |
+-----------+--------------------+-----------------------------------------------------+  1 pt line
| [New Document] [Options]                                         [Cancel] [ Open ]   |  bottom bar 41 pt
+--------------------------------------------------------------------------------------+
```

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| view | icon, list, column, gallery | last used | toolbar view control | column |
| presentation | app-modal window, sheet | window | `runModal` / `beginSheetModal` | window |
| options area | collapsed, expanded accessory view | collapsed | `accessoryView`, "Options" button | collapsed |
| size | user-resizable, remembered | - | - | 914 x 615 pt; 799 x 448 pt (light iCloud) |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| File selected, Open enabled (default, accent) | yes | 10-15-Catalina-Light-Finder-Open.png, 10-15-Catalina-Dark-Finder-Open.png |
| Nothing selected, Open disabled | yes | 10-15-Catalina-Light-Finder-Open-iCloud.png, 10-15-Catalina-Dark-Finder-Open-iCloud.png |
| Forward button disabled | yes | glyph `#ababab` vs back `#555555` (10-15-Catalina-Light-Finder-Open.png @ 204,106,14,24 and @ 152,106,14,24) |
| Options expanded, search active, sheet presentation | no | [I] accessory view appears between browser and bottom bar with a 1 pt line above it |

## Measurements

Frame (Documents capture, both appearances): x 112..1939, y 76..1305 px = 914 x 615 pt [M].

### Geometry (pt)

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Toolbar | 42 pt gradient (y 76..159) + 1 pt line (y 160..161) | [M] | 10-15-Catalina-Light-Finder-Open.png col 600 |
| Toolbar controls | 23 pt tall (y 95..140), vertically centred; left/right margins 11 pt | [M] | col 170: fill 96..139; row 100 |
| Back / forward buttons | 25 pt each (x 134..183, 186..235), 1 pt apart | [M] | row 100 |
| View pop-up; new-folder button | 44 pt each (x 252..339, 352..439) | [M] | row 100 |
| Location pop-up | 207 pt (x 819..1232), centred in the window (centre 1025.5 = frame centre) | [M] | row 100 |
| Search field | 275.5 pt (x 1367..1917) | [M] | row 100 |
| Sidebar width | 155 pt (x 112..421) + 1 pt divider (x 422..423) | [M] | row 500 |
| Sidebar row pitch / selection height | 26 pt (baselines y 243, 295, 347, 399) / 24 pt (y 366..413) | [M] | 10-15-Catalina-Light-Finder-Open.png @ 193,225,16,19 and following rows; col 200 |
| Sidebar text x; icon x | text 41 pt from the frame edge (x 193); icons 18 pt in (x ~148..183) | [M] | same |
| Header band ("Shared Folder") | 23 pt (y 162..207) + 1 pt line (y 208..209), spans the browser only | [M] | col 600 |
| File column width | 204 pt (x 424..831) + 1 pt divider (x 832..833) | [M] | row 500 |
| Column-view row | pitch 18 pt (baselines 235, 271, 307), selection 17 pt (y 212..245) | [M] | col 600; glyph rows |
| Preview column | image well 256 x 127.5 pt at x 874..1897 (inset 20 pt from the column edges), then name 17 pt bold, kind line 11 pt grey, "Information" 13 pt bold with "Show More" link right-aligned, key/value rows 11 pt at 20 pt pitch with 0.5 pt separators, "Tags" 13 pt bold, "Add Tags..." placeholder | [M] | 10-15-Catalina-Light-Finder-Open.png @ 874,250,1024,960 |
| Line above bottom bar | 1 pt (y 1222..1223) | [M] | col 600 |
| Bottom bar | 41 pt (y 1224..1305) | [M] | col 600 |
| Bottom bar buttons | 20 pt tall (y 1245..1284), margins 10.5 pt left/right/top/bottom | [M] | row 1245, col 250 |
| Button widths | New Document 120 pt (x 133..372), Options 83 pt (x 391..556), Cancel 77 pt (x 1593..1746), Open 77 pt (x 1765..1918) | [M] | rows 1245 and 1262 |
| Gap between adjacent buttons | 9 pt (18 px) | [M] | same |

### Colours and fills

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Toolbar mid | `#dfdfdf` | `#3b3c3e` | [M] | 10-15-Catalina-Light-Finder-Open.png @ 600,100 `#dfdfdf`; 10-15-Catalina-Dark-Finder-Open.png @ 600,100 `#3b3c3e` |
| Toolbar bottom line | `#d8d8d8` | `#404143` | [M] | 10-15-Catalina-Light-Finder-Open.png @ 600,160 `#d8d8d8`; 10-15-Catalina-Dark-Finder-Open.png @ 600,160 `#404143` |
| Sidebar (vibrant, composite over this wallpaper) | `#e8e8e7` | `#2c2d2e` | [M] | 10-15-Catalina-Light-Finder-Open.png @ 200,300 `#e8e8e7`; 10-15-Catalina-Dark-Finder-Open.png @ 200,300 `#2c2d2e` |
| Sidebar selection (unemphasised) | `#c8c8c7` | `#505152` | [M] | 10-15-Catalina-Light-Finder-Open.png @ 200,389 `#c8c8c7`; 10-15-Catalina-Dark-Finder-Open.png @ 200,389 `#505152` |
| Sidebar divider | `#d0d0cf` | `#000000` | [M] | 10-15-Catalina-Light-Finder-Open.png @ 422,500 `#d0d0cf`; 10-15-Catalina-Dark-Finder-Open.png @ 422,500 `#000000` |
| Header band | `#f0f0f0`, line `#e1e1e1`/`#cecece` | `#2b2c2f`, line `#3a3b3e`/`#4d4e51` | [M] | 10-15-Catalina-Light-Finder-Open.png @ 600,180 `#f0f0f0`, @ 600,208 `#e1e1e1`, @ 600,209 `#cecece`; 10-15-Catalina-Dark-Finder-Open.png @ 600,180 `#2b2c2f`, @ 600,208 `#3a3b3e`, @ 600,209 `#4d4e51` |
| Browser background | `#ffffff` | `#1e1f21` | [M] | 10-15-Catalina-Light-Finder-Open.png @ 600,500 `#ffffff`; 10-15-Catalina-Dark-Finder-Open.png @ 600,500 `#1e1f21` |
| Column divider | `#e6e6e6` | `#000000` | [M] | 10-15-Catalina-Light-Finder-Open.png @ 832,500 `#e6e6e6`; 10-15-Catalina-Dark-Finder-Open.png @ 832,500 `#000000` |
| Selected file row (emphasised) | `#2365d9 (sRGB #0062e1)` | `#1e5ac8 (sRGB #0057cf)` | [M] | 10-15-Catalina-Light-Finder-Open.png @ 600,227 `#2365d9 (sRGB #0062e1)`; 10-15-Catalina-Dark-Finder-Open.png @ 600,227 `#1e5ac8 (sRGB #0057cf)` |
| Line above bottom bar | `#bfbfbf` | `#3f3f3f` | [M] | 10-15-Catalina-Light-Finder-Open.png @ 600,1222 `#bfbfbf`; 10-15-Catalina-Dark-Finder-Open.png @ 600,1222 `#3f3f3f` |
| Bottom bar (gradient `#ececec` -> `#d7d7d7` light) | `#e2e2e2` mid | `#2f2f2f` | [M] | 10-15-Catalina-Light-Finder-Open.png @ 600,1260 `#e2e2e2`; 10-15-Catalina-Dark-Finder-Open.png @ 600,1260 `#2f2f2f` |

### Text and icons

| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Sidebar header ("Favorites", "iCloud", "Locations", "Tags") | SF Pro Text Semibold 11 pt, `#696968` | `#9a9a9b`-class [I] | [M] light, [C] size | 10-15-Catalina-Light-Finder-Open.png @ 132,182,120,16 |
| Sidebar item | SF Pro Text Regular 13 pt, `#353534` | `#ffffff`-class | [M], [C] | @ 194,225,90,19 |
| Header band text | SF Pro Text Semibold 11 pt (cap 18 px incl. ascender), `#717171` | - | [M], [C] | @ 445,176,170,18 |
| File name | SF Pro Text Regular 12 pt [C: cap 18 px digits, row pitch 18 pt], `#272727`; selected `#ffffff` | selected `#ffffff` | [M], [C] | @ 478,218,60,18 |
| Location pop-up text | 13 pt, `#565656` | - | [M], [C] | @ 873,109,135,20 |
| Preview name | SF Pro Display Bold 17 pt [C: cap 20..21 px], `#262626` | - | [M], [C] | @ 876,826,160,21 |
| Preview secondary text | 11..12 pt, `#808080` | - | [M] | @ 876,869,370,18 |
| "Show More" link | 12 pt, `#276ad3 (sRGB #0168da)` | - | [M] | @ 1770,930,125,18 |
| "Add Tags..." placeholder | `#c0c0c0` | - | [M] | @ 880,1188,125,18 |

### Shadows and effects

Standard key-window shadow; the panel has rounded top corners like any window and no title text.

## Layout and spacing

Resizing grows the browser; sidebar and file column widths are user-adjustable by their dividers;
toolbar: navigation left, location pop-up centred, search right. In the smaller iCloud capture (799 pt)
the same toolbar controls keep their sizes and the location pop-up stays centred [M:
10-15-Catalina-Light-Finder-Open-iCloud.png row 100].

## Keyboard and accessibility

Return opens the selection (or enters a folder in list/column views), Escape cancels, Command-Shift-G
opens the Go to Folder sheet, Command-F focuses search, Command-D jumps to Desktop, arrows navigate the
browser, Command-Up goes to the enclosing folder, Space previews with Quick Look [D]. AX: AXWindow
(dialog) with AXSplitGroup, AXOutline (sidebar), AXBrowser. ARIA: `dialog` containing a `tree` or
`grid`; the file list needs roving focus and type-select.

## Browser notes

A web app cannot read the real file system; the panel is a visual replica fed with mock data (or the
File System Access API where permitted). The sidebar material needs `backdrop-filter`; use the opaque
values above as fallback.

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Finder-Open.png | 112,76,1828,1230 | full panel, column view, preview column, Open enabled |
| dark | 10-15-Catalina-Dark-Finder-Open.png | 112,76,1828,1230 | same, dark |
| light | 10-15-Catalina-Light-Finder-Open-iCloud.png | 112,76,1598,896 | smaller size, empty folder, Open disabled |
| dark | 10-15-Catalina-Dark-Finder-Open-iCloud.png | 112,76,1828,1230 | iCloud Drive with one folder, Open disabled |

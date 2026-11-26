# Spotlight
- **Screenshots:** 10-15-Catalina-Light-Spotlight.png (full screen), 10-15-Catalina-Dark-Spotlight.png (window capture); follow-on Finder search windows 10-15-Catalina-Light-Spotlight-More.png and 10-15-Catalina-Dark-Spotlight-More.png
- **Window:** borderless panel 680 x 430 pt, radius 6, centred horizontally, top 210 pt from the screen top; material see `spotlight`

## Layout
```
+--------------------------------------------------------------- 680 --+
| (Q) OS X - macOS                                          [Dictionary] | 56
+------------------------------- 289 --+----------------------- 390 ----+
| DEFINITION                    16     |  macOS                         |
| [i] macOS            (selected) 26   |    The operating system for... |
| IMAGES                               |                                |
| [i] 19 Apple_iPadOS_Paste-Feature_06...                               |
| ...                                  |                                | 374
+--------------------------------------+--------------------------------+
```
| Region | Size (pt) | Light | Dark | Tag | Evidence |
|---|---|---|---|---|---|
| Search row | 680 x 56 | material (`#c3ced4 (sRGB #c1ced5)`..`#c4bba9 (sRGB #c6bba7)`) | `#2b2c2d` | [M] | 10-15-Catalina-Light-Spotlight.png @ 1000,420,1360,112; 10-15-Catalina-Dark-Spotlight.png @ 112,76,1360,112 |
| Result list | 289 x 374 | material; header bands `rgba(0,0,0,0.12)` | `#2b2c2d`; header bands `#4e4f50` | [M] | 10-15-Catalina-Light-Spotlight.png @ 1000,532,578,746; 10-15-Catalina-Dark-Spotlight.png @ 112,190,578,746 |
| Divider | 1 x 374 | `rgba(0,0,0,0.07)` | `#404142` | [M] | 10-15-Catalina-Dark-Spotlight.png @ 690,190,2,746 |
| Preview | 390 x 374 | material | `#1e1e1e` (text preview) | [M] | 10-15-Catalina-Dark-Spotlight.png @ 692,190,780,746 |

## Components used
`spotlight` (all parts), `material`, `menu-bar` + `menu-bar-extra` + `desktop` + `dock` behind it in the light capture. The "More" captures use `window`, `toolbar`, `toolbar-search-field` (focused, with clear button), `scope-bar`, `sidebar`, `icon-view` and are specified by the chrome and views groups.

## App-specific elements
- Dictionary preview (light): title "macOS" about 24 pt at x=27 pt, y=47 pt of the preview pane; body 12 pt indented 34 pt, with bold blue links (`#0020e4 (sRGB #1400ee)`) [M] 10-15-Catalina-Light-Spotlight.png @ 1634,602,142,34; 1668,682,510,22.
- Text preview (dark): monospaced 11-12 pt white text on `#1e1e1e`, 8 pt left padding [M] 10-15-Catalina-Dark-Spotlight.png @ 709,199,491,22.

## Content in the screenshot
Light: query "OS X" + completion "- macOS" (em dash); top-hit icon: Dictionary.
- DEFINITION: macOS (selected)
- IMAGES: 19 Apple_iPadOS_Paste-Feature_06...; Oscar_Circle-thumb600x600.png; OS X Versions.psd; 09-OS-X-Mavericks.jpg; 10-OS-X-Yosemite.jpg
- FOLDERS: OS X
- DOCUMENTS: catalina.md; page.txt; page.txt; OS X calendars - SH outline.txt; Guest Recording - OS X.pages
- Preview: "macOS" / "The operating system for Mac computers. Introduced in 2001, macOS was originally called Mac OS X, and later OS X. See also Classic Mac OS." ("Classic Mac OS" is a link)

Dark: query "OS X" + completion "- com_apple_MobileAsset_DictionaryServices_dictionaryOSX.xml"; top-hit icon: Safari.
- DEVELOPER: com_apple_MobileAsset_DictionaryS... (selected); com_apple_MobileAsset_DictionaryS...; version.xml; license.html; license.html
- DEFINITION: macOS
- IMAGES: 19 Apple_iPadOS_Paste-Feature_06...; Oscar_Circle-thumb600x600.png; OS X Versions.psd; 09-OS-X-Mavericks.jpg; 10-OS-X-Yosemite.jpg
- FOLDERS: OS X
- Preview: the XML property list text ("<?xml version="1.0" encoding="UTF-8"?> ...").

Finder "More" windows: title "Searching "This Mac""; scope bar "Search: [This Mac] "Desktop" (Shared in dark)" with Save and + buttons; sections Folders, Documents (Show All (553)), Mail & Messages (Show All (1,582)), Events & Reminders.

## Not reproducible / assets needed
Result icons (generic document, Dictionary, Safari, HTML/XML document icons); live search results; Quick Look previews.

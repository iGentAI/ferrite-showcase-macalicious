# Finder dialogs (Go to Folder, Connect to Server, Copy, Replace, Empty Trash, Eject Warning)

- **Screenshots:** 10-15-Catalina-Light-Finder-Go-To-Folder.png / 10-15-Catalina-Dark-Finder-Go-to-Folder.png; 10-15-Catalina-Light-Finder-Connect-to-Server.png / 10-15-Catalina-Dark-Finder-Conect-to-Server.png; 10-15-Catalina-Light-Finder-Copy.png / 10-15-Catalina-Dark-Finder-Copy.png; 10-15-Catalina-Light-Finder-Copy-Replace.png / 10-15-Catalina-Dark-Finder-Copy-Replace.png; 10-15-Catalina-Light-Finder-Empty-Trash.png / 10-15-Catalina-Dark-Finder-Empty-Trash.png; 10-15-Catalina-Light-Finder-Eject-Warning.png / 10-15-Catalina-Dark-Finder-Eject-Warning.png
- **Window:** six small surfaces, all window captures with shadow. Frames [M, `info`]: Go to Folder 429 x 146 pt; Connect to Server 486 x 231 pt; Copy 399 x 69 pt; Replace 399 x 100 pt; Empty Trash 420 x 151 pt; Eject Warning 344 x 63 pt. Light and dark frames are identical in size.

All px coordinates are in the light file unless a file is named; the dark files use the same geometry
(dark frames are 2 px narrower/shorter between their black edge lines).

## 1. Go to Folder

### Layout

| Region | Position / size (pt) | Light | Dark | Evidence |
|---|---|---|---|---|
| Title bar, title "Go to Folder", no window controls | 429 x 22 | gradient `#e5e5e5` -> `#cdcdcd` | `#414243` -> `#363637` | [M] col 130, y 76..119 |
| Content | 429 x 124 | `#ececec` | `#303031` | [M] |
| Label "Go to the folder:" | x 20.5, cap top 45.5 below window top | 13 pt `#242424` | `#dfdfdf` | [M] @ 153,167,195,21 |
| Combo box (focused) | x 20.5, y 65.5, 388 x 20 (px 153..928, 207..246) + 3 pt focus ring | white field, blue 17 pt arrow cap | `#3a3a3b` field | [M] @ 148,202,786,50 |
| Cancel / Go | 83 x 20 each at px 571..736 and 763..928, y 287..326 | push / default | same | [M] |

```
+------------- Go to Folder -------------+
|  Go to the folder:                     |
|  [ ~/Documents/                    [v]]|
|                    [ Cancel ]  [  Go  ]|
+----------------------------------------+
```

### Content

Title "Go to Folder"; label "Go to the folder:"; field text "~/Documents/" with the insertion point at
the end; buttons "Cancel", "Go" (default).

## 2. Connect to Server

### Layout

| Region | Position / size (pt) | Light | Dark | Evidence |
|---|---|---|---|---|
| Title bar with window controls (close, minimize enabled; zoom disabled), title "Connect to Server" | 486 x 22 | as above | as above | [M] |
| Server address combo box (focused) | x 20.5, y 41.5 (px 153..1042 x 159..198), 445 x 20 | white, blue arrow cap | dark field | [M] @ 148,154,900,50 (incl. ring) |
| Label "Favorite Servers:" | x 20.5, y 75.5, 11 pt | `#242424` | `#dfdfdf` | [M] @ 153,227,173,18 |
| Favourites list (bordered, alternating rows, empty) | px 152..1043 x 266..439 = 446 x 87 | border `#c5c5c5`, rows `#ffffff` / `#f5f5f6` | border `#565656`, rows `#1e1e1f` / `#292929` | [M] 10-15-Catalina-Light-Finder-Connect-to-Server.png @ 600,266 `#c6c5c5`, @ 600,300 `#ffffff`, @ 600,340 `#f5f5f6`; 10-15-Catalina-Dark-Finder-Conect-to-Server.png @ 600,266 `#565656`, @ 600,300 `#1e1e1f`, @ 600,340 `#292929` |
| Bottom row | y 190.5 (px 457..496) | | | [M] @ 153,457,890,41 |
| - [+][-][gear v] gradient segmented | px 153..348 (98 pt) | | | [M] |
| - Help button | px 375..414 (20 pt) | | | [M] |
| - Browse / Connect (default) | px 715..858 (72 pt) / 885..1042 (79 pt), 13 pt apart | | | [M] |

### Content

Field text "smb://castle.local" (insertion point after a trailing space in light); empty list; buttons
"+", "-" (disabled), action gear with chevron, "?", "Browse", "Connect".

## 3. Copy (progress)

See `components/progress-window.md` for every measurement. Content: icon = QuickTime movie document;
title `Copying "Pippin - Apple's F...e Console.mov" to "Desktop"`; status "192.9 MB of 6 GB - About 3
minutes" (light) / "494.9 MB of 6 GB - About 2 minutes" (dark); bar about 3% (fill px 227..243 of
226..839) in light, about 8% in dark.

## 4. Replace (copy conflict)

### Layout

| Region | Position / size (pt) | Light | Dark | Evidence |
|---|---|---|---|---|
| Window, transparent title bar with controls (close/zoom disabled, minimize enabled), no title | 399 x 100 | `#ececec` | `#303235` | [M] 10-15-Catalina-Light-Finder-Copy-Replace.png @ 400,200 `#ececec`; 10-15-Catalina-Dark-Finder-Copy-Replace.png @ 400,200 `#303235` |
| Document icon with yellow caution badge at lower right | art px 145..198 x 132..198 (32 pt canvas at x 16.5, y 28) | | | [M] @ 145,132,54,67 |
| Message, 3 lines | x 56 (px 224), cap tops y 126, 154, 182: 11 pt regular, 14 pt pitch | `#242424` | `#dfe0e0` | [M] @ 224,125,625,78 |
| Buttons (small size), three of 84 pt | px 339..507, 527..696, 715..884; y 221..254 (17 pt incl. edges); 10 pt apart; right margin 12.5 pt; bottom margin 10.5 pt | white, 11 pt titles | `#646568` | [M] row 238; 10-15-Catalina-Light-Finder-Copy-Replace.png @ 339,238 `#c1c1c1`, @ 340,238 `#ffffff`; 10-15-Catalina-Dark-Finder-Copy-Replace.png @ 340,238 `#646568` |

No default (accent) button: all three are plain. This is Finder's own compact dialog, not `NSAlert`.

### Content

Message: `An item named "Pippin - Apple's Forgotten Game Console.mov" already exists in this location.
Do you want to replace it with the one you're moving?`; buttons "Keep Both", "Stop", "Replace".

## 5. Empty Trash

A standard `NSAlert`; every measurement is in `components/alert.md`. Content: icon = full Trash;
message "Are you sure you want to permanently erase the items in the Trash?" (2 lines, break after
"erase"); informative text "You can't undo this action."; buttons "Cancel", "Empty Trash" (default).

## 6. Eject Warning

An alert-style notification; every measurement is in `components/notification-alert.md`. Content:
Finder icon; title "Disk Not Ejected Properly"; body `Eject "USB Key" before disconnecting or turning
it off.` (light; the dark capture reads `"USB KEY"` and wraps after "disconnecting"); button "Close".

## Components used

`dialog`, `alert`, `progress-window`, `notification-alert`, `window`, `title-bar`, `window-controls`,
`window-shadow`, `combo-box` (both address fields), `focus-ring`, `push-button`, `default-button`,
`help-button`, `gradient-button` ([+][-]), `pull-down-button` (action gear), `bordered-list` and
`table-view` (favourites list), `label`, `progress-bar`, `image-view` (icons), `material` (notification).

## App-specific elements

- Caution badge: yellow triangle with "!" about 16 pt, overlapping the icon's lower-right corner
  (10-15-Catalina-Light-Finder-Copy-Replace.png @ 170,166,30,34) [M].
- Stop button of the progress window: 13 pt grey disc with an x (see `progress-window`).

## Not reproducible / assets needed

Trash (full) icon 64 pt in light and dark variants, QuickTime .mov document icon 32 pt, Finder icon
32 pt, caution badge.

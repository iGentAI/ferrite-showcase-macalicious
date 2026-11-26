# About This Mac

- **Screenshots:** 10-15-Catalina-Light-About-This-Mac.png, 10-15-Catalina-Dark-About-This-Mac.png (both full-screen, 3360 x 2100 px, the window over the desktop with Finder frontmost)
- **Window:** 586 x 353 pt (light frame x 1094..2265, y 386..1091 px), centred horizontally on the 1680 pt screen (frame centre x 1679.5), top edge 193 pt from the top of the screen; tall title bar with centred tab control; close and minimize enabled, zoom disabled [M]

Component measurements: `components/about-window.md`.

## Layout

| Region | px (light) | Size pt | Light | Dark |
|---|---|---|---|---|
| Menu bar (Finder: File Edit View Go Window Help; extras; "Thu 3:03 PM"; "Stephen") | y 0..43 | 1680 x 22 | vibrant light | vibrant dark |
| Window title bar with tabs | y 386..461 | 586 x 38 | `#e5e5e5` -> `#cdcdcd` | `#434445` -> `#363738` |
| Window content | y 462..1091 | 586 x 315 | `#ececec` | `#303032` |
| - Badge | x 1196..1501, y 604..909 | 153 x 153 | | |
| - Text column | x 1603.., y 553..960 | | | |
| - Footer | y 1061..1079 | | `#b1b1b1` text | grey text |
| Desktop icons (Macintosh SSD, Time Machine) | top right | | | |
| Dock | bottom, centred | | | |

## Components used

`about-window`, `window`, `title-bar`, `window-controls`, `toolbar-segmented-control` (tabs in the title
bar), `label`, `push-button` (small), `image-view`, `menu-bar`, `menu-bar-extra`, `desktop`,
`desktop-icon`, `dock`, `window-shadow`.

## App-specific elements

Circular macOS Catalina badge (153 pt) with a pale rim: day image in light mode, night image in dark
mode [M: @ 1196,604,306,306 in both files].

## Content in the screenshot

- Tabs: Overview (selected), Displays, Storage, Support, Service.
- "macOS" (bold) "Catalina" (light); "Version 10.15 Beta (19A582a)".
- "MacBook Pro (15-inch, 2019)"; "Processor  2.3 GHz 8-Core Intel Core i9"; "Memory  16 GB 2400 MHz
  DDR4"; "Startup Disk  Macintosh SSD"; "Graphics  Intel UHD Graphics 630 1536 MB"; "Serial Number"
  (value blank in light; "C02YM33BLVCJ" in dark).
- Buttons: "System Report...", "Software Update...".
- Footer: "(TM) and (C) 1983-2019 Apple Inc. All Rights Reserved. License Agreement".
- Menu bar clock: "Thu 3:03 PM" (light), "Fri 10:17 AM" (dark); Dock calendar icon shows OCT 3 / OCT 4.

## Not reproducible / assets needed

Catalina badge images (day and night), Catalina wallpapers (day and night), Dock and desktop icons.

# Desktop and Dock
- **Screenshots:** 10-15-Catalina-Light-Desktop.png, 10-15-Catalina-Dark-Desktop.png (also 10-15-Catalina-Light-Stacks.png / -Dark-Stacks.png for the open Dock stack and 10-15-Catalina-Light-Desktop-Stacks.png / -Dark-Desktop-Stacks.png for Desktop Stacks)
- **Window:** none; full screen 1680 x 1050 pt (3360 x 2100 px)

## Layout
```
+------------------------------------------------------------------------------+ y=0
| [apple] Finder File Edit View Go Window Help      (extras) Thu 10:07 AM ...  | menu bar 22
+------------------------------------------------------------------------------+ y=22
|                                                                 [Macintosh SSD]| icon centre (1614.75, 61.25)
|                         desktop picture                         [Time Machine] | next row +112
|                                                                              |
|          ________________________________________________________            |
|         | Finder Launchpad Safari ... System Preferences | DL Trash|          | Dock 1398 x 80
+---------+----------------------------------------------------------+----------+ y=1050
```

| Region | Position / size (pt) | Light | Dark | Tag | Evidence |
|---|---|---|---|---|---|
| Menu bar | 0,0, 1680 x 22 (+1 pt shadow line) | `#c3e0f1 (sRGB #bce1f3)`..`#c8e2f2 (sRGB #c2e3f4)` | `#181c29 (sRGB #171c2a)`..`#1d273c (sRGB #1b273e)` | [M] | 10-15-Catalina-Light-Desktop.png @ 0,0,3360,46; 10-15-Catalina-Dark-Desktop.png @ 0,0,3360,46 |
| Desktop picture | 0,0, 1680 x 1050 (under everything) | Catalina Day | Catalina Night | [M] | whole image |
| Volume icon 1 "Macintosh SSD" | 64 pt icon centred at (1614.75, 61.25); label cap-top y=105.5 | white bold 12 pt label | same | [M] | 10-15-Catalina-Light-Desktop.png @ 3130,56,200,180 |
| Volume icon 2 "Time Machine" | 112 pt below icon 1 (centre y=173.25) | same | same | [M] | 10-15-Catalina-Light-Desktop.png @ 3130,280,200,180 |
| Dock shelf | left 141, top 970, 1398 x 80 (centred; flush with the bottom edge) | `#456689 (sRGB #3c668c)` | `#152137 (sRGB #122139)` | [M] | 10-15-Catalina-Dark-Desktop.png @ 281,1939,2798,161 |

Dock tile centres (pt from the left screen edge; y centre 1007.75 pt; 64 pt tiles on a 68 pt pitch) [M] 10-15-Catalina-Dark-Desktop.png @ 284,1950,2792,130:

| # | Item | Centre x (pt) | Ink box (px) |
|---|---|---|---|
| 1 | Finder (running: dot) | 178.75 | 306..409 x 1967..2064 |
| 2 | Launchpad | 246.75 | 438..549 x 1960..2071 |
| 3 | Safari | 314.75 | 574..685 x 1960..2071 |
| 4 | Mail | 382.75 | 714..816 x 1955..2074 |
| 5 | FaceTime | 450.75 | 845..958 x 1968..2063 |
| 6 | Messages | 518.75 | 982..1093 x 1965..2069 |
| 7 | Maps | 586.75 | 1116..1232 x 1963..2068 |
| 8 | Photos | 654.75 | 1254..1365 x 1960..2071 |
| 9 | Contacts | 722.75 | 1395..1496 x 1954..2073 |
| 10 | Calendar ("OCT", day number) | 790.75 | 1526..1633 x 1961..2070 |
| 11 | Reminders | 858.75 | 1670..1767 x 1958..2071 |
| 12 | Notes | 926.75 | 1804..1905 x 1956..2073 |
| 13 | Music | 994.75 | 1934..2045 x 1960..2071 |
| 14 | Podcasts | 1062.75 | 2070..2181 x 1960..2071 |
| 15 | TV | 1130.75 | 2208..2316 x 1960..2070 |
| 16 | News | 1198.75 | 2343..2452 x 1960..2070 |
| 17 | App Store | 1266.75 | 2478..2589 x 1960..2071 |
| 18 | System Preferences | 1334.75 | 2614..2725 x 1964..2067 |
| - | separator (1 pt line, 60 pt tall) | 1384.25 | 2768..2769 x 1960..2079 |
| 19 | Downloads stack | 1432.75 | 2812..2919 x 1961..2074 |
| 20 | Trash | 1500.75 | 2956..3047 x 1960..2072 |

Running indicator: 4 pt dot centred under the icon at y=1046 pt (px 354..361 x 2088..2095 for Finder) [M].

## Components used
- `menu-bar`, `menu-bar-extra`: top strip (Finder frontmost: Finder, File, Edit, View, Go, Window, Help; extras Time Machine, Wi-Fi, AirPlay, battery, clock, user name, Spotlight, Siri, Notification Center).
- `desktop`, `desktop-icon`: picture and the two volume icons; `desktop-stack` in the Desktop-Stacks captures.
- `dock`: shelf, 18 app icons, separator, Downloads stack, Trash; `dock-stack` for the open fan.
- `material`: menu bar and Dock recipes.

## App-specific elements
- Desktop Stacks column (10-15-Catalina-Light-Desktop-Stacks.png), top to bottom at 112 pt pitch from the first cell: Macintosh SSD, Time Machine, "Images" (closed stack), "PDF Documents" (open stack placeholder), "ENERGY STAR.pdf", "Aqua and Bondi.pdf" (two-line label) [M] @ 3080,40,280,1380.
- Open Dock stack (10-15-Catalina-Light-Stacks.png): fan of 10 files above the Downloads tile plus "7 More in Finder"; the Downloads tile shows the down-triangle placeholder [M] @ 2480,440,640,1640.

## Content in the screenshot
- Menu bar, light: "Finder  File  Edit  View  Go  Window  Help"; clock "Thu 10:07 AM"; user "Stephen". Dark: clock "Thu 4:10 PM".
- Desktop labels: "Macintosh SSD", "Time Machine".
- Fan stack labels, bottom to top (light): 10-15-beta-dark.jpg, 10-15-beta-light.jpg, 10-14-Night.jpg, 10-14-Day.jpg, 10-13.jpg, 10-12.jpg, 10-11.jpg, 10-10.jpg, 10-9.jpg, 10-8.jpg, "7 More in Finder". Dark: 10-15-beta-dark.jpg, 10-15-beta-light.jpg, 10-14-Day.jpg, 10-14-Night.jpg, 10-9.jpg, 10-8.jpg, 10-10.jpg, 10-11.jpg, 10-12.jpg, 10-4.png, "7 More in Finder".

## Not reproducible / assets needed
- Catalina desktop pictures (Day, Night, Morning, Evening).
- All Dock app icons, the Trash (empty and full), volume icons, file thumbnails, menu bar extra glyphs and the Siri orb.

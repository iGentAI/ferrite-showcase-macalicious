# Menu bar menus
- **Screenshots:** 10-15-Catalina-Light-Apple-Menu.png, 10-15-Catalina-Dark-Apple-Menu.png, 10-15-Catalina-Light-Finder-Menu.png, 10-15-Catalina-Dark-Finder-Menu.png, 10-15-Catalina-Light-Finder-Go-Menu.png, 10-15-Catalina-Dark-Finder-Go-Menu.png, 10-15-Catalina-Light-Menu-Bar-Battery.png, 10-15-Catalina-Dark-Menu-Bar-Battery.png, 10-15-Catalina-Light-Time-Machine-Menu.png, 10-15-Catalina-Dark-Time-Machine-Menu.png, 10-15-Catalina-Light-Fast-User-Switching-Menu.png, 10-15-Catalina-Dark-Fast-User-Switching-Menu.png; also the System Preferences menu in the 32 10-15-Catalina-Theme-*.png files and the detached menus in 10-15-Catalina-Light-Print.png, -Dark-Print.png, -Light-Contacts.png, -Dark-Contacts.png (Safari's Share menu in 10-15-Catalina-Light-Safari-v13-Sharing.png belongs to the chrome group's `share-menu`)
- **Window:** menus are borderless windows attached under the 22 pt menu bar (top at y=22 pt)

## Layout
Every menu: 4 pt top padding, rows (19 pt; 21 pt with a 16 pt image; 34 pt user rows), 12 pt separator items with a 2 pt line, 4 pt bottom padding; left text inset 21 pt; bottom corners 5 pt. Row y ranges below are image px (2 px = 1 pt), [M] from column scans at the menu's left margin.

| Menu | x range (px) | Width (pt) | y range (px) | Height (pt) | Evidence |
|---|---|---|---|---|---|
| Apple | 20..435 | 208 | 44..559 | 258 | 10-15-Catalina-Light-Apple-Menu.png @ 20,44,416,516 |
| Finder (app menu) | 90..447 | 179 | 44..421 | 189 | 10-15-Catalina-Light-Finder-Menu.png @ 90,44,358,378 |
| Go | 482..883 | 201 | 44..821 | 389 | 10-15-Catalina-Light-Finder-Go-Menu.png @ 482,44,402,778 |
| Battery (light) | 2722..3287 | 283 | 44..297 | 127 | 10-15-Catalina-Light-Menu-Bar-Battery.png @ 2722,44,566,254 |
| Battery (dark) | 2738..3303 | 283 | 44..381 | 169 | 10-15-Catalina-Dark-Menu-Bar-Battery.png @ 2738,44,566,338 |
| Time Machine | 2518..3041 (dark 2534..3057) | 262 | 44..297 | 127 | 10-15-Catalina-Light-Time-Machine-Menu.png @ 2518,44,524,254 |
| Fast user switching | 2666..3135 | 235 | 44..319 | 138 | 10-15-Catalina-Light-Fast-User-Switching-Menu.png @ 2666,44,470,276 |
| System Preferences (app menu) | 91..560 | 235 | 44..359 | 158 | 10-15-Catalina-Theme-Light-Blue.png @ 91,44,470,316 |

## Components used
`menu-bar` (title highlight), `menu-bar-extra` (status-item highlight), `menu`, `menu-item`, `submenu` (arrows only), `material`.

## App-specific elements
Fast user switching rows: 34 pt rows with a 32 pt circular avatar at x=24 pt and the name at x=65 pt; the logged-in user has a 14 pt check badge at x=5 pt and is dimmed [M] 10-15-Catalina-Light-Fast-User-Switching-Menu.png @ 2666,52,470,136.

## Content in the screenshot
Notation: `[hl]` highlighted row, `(dis)` disabled, `---` separator, `>` submenu arrow. Key equivalents use the glyphs Control U+2303, Option U+2325, Shift U+21E7, Command U+2318.

### Apple menu (light and dark identical)
| Rows (px) | Item | Key equivalent |
|---|---|---|
| 52..89 | About This Mac [hl] | |
| 90..113 | --- | |
| 114..151 | System Preferences... | |
| 152..189 | App Store... | |
| 190..213 | --- | |
| 214..251 | Recent Items > | |
| 252..275 | --- | |
| 276..313 | Force Quit... | Option Command Escape (U+238B) |
| 314..337 | --- | |
| 338..375 | Sleep | |
| 376..413 | Restart... | |
| 414..451 | Shut Down... | |
| 452..475 | --- | |
| 476..513 | Lock Screen | Control Command Q |
| 514..551 | Log Out Stephen... | Shift Command Q |

(Ellipses are the single character U+2026 in the UI.)

### Finder menu
| Rows (px) | Item | Key equivalent | State |
|---|---|---|---|
| 52..89 | About Finder | | [hl] |
| 90..113 | --- | | |
| 114..151 | Preferences... | Command , | |
| 152..175 | --- | | |
| 176..213 | Empty Trash... | Shift Command Delete (U+232B) | (dis) in light (Trash empty); enabled in dark (Trash full) |
| 214..237 | --- | | |
| 238..275 | Services > | | |
| 276..299 | --- | | |
| 300..337 | Hide Finder | Command H | (dis) |
| 338..375 | Hide Others | Option Command H | (dis) |
| 376..413 | Show All | | (dis) |

### Go menu (Finder; light and dark identical)
| Rows (px) | Item | Key equivalent | State |
|---|---|---|---|
| 52..89 | Back | Command [ | (dis) |
| 90..127 | Forward | Command ] | (dis) |
| 128..165 | Enclosing Folder | Command Up-arrow | [hl] |
| 166..189 | --- | | |
| 190..231 | (icon) Recents | Shift Command F | 21 pt row |
| 232..273 | (icon) Documents | Shift Command O | |
| 274..315 | (icon) Desktop | Shift Command D | |
| 316..357 | (icon) Downloads | Option Command L | |
| 358..399 | (icon) Home | Shift Command H | |
| 400..441 | (icon) Computer | Shift Command C | |
| 442..483 | (icon) AirDrop | Shift Command R | |
| 484..525 | (icon) Network | Shift Command K | |
| 526..567 | (icon) iCloud Drive | Shift Command I | |
| 568..609 | (icon) Applications | Shift Command A | |
| 610..651 | (icon) Utilities | Shift Command U | |
| 652..675 | --- | | |
| 676..713 | Recent Folders > | | |
| 714..737 | --- | | |
| 738..775 | Go to Folder... | Shift Command G | |
| 776..813 | Connect to Server... | Command K | |

### Battery status menu
Light (10-15-Catalina-Light-Menu-Bar-Battery.png): 52..89 "Battery Is Charged" (dis); 90..127 "Power Source: Power Adapter" (dis); 128..151 ---; 152..189 "No Apps Using Significant Energy" (dis); 190..213 ---; 214..251 "Show Percentage"; 252..289 "Open Energy Saver Preferences..." [hl].

Dark (10-15-Catalina-Dark-Menu-Bar-Battery.png): 52..89 "0:57 Until Full" (dis); 90..127 "Power Source: Power Adapter" (dis); 128..151 ---; 152..189 "Using Significant Energy" (section header, disabled style); 190..231 (app icon) "Time Machine" [hl], 21 pt row; 232..273 (app icon) "Spotlight"; 274..297 ---; 298..335 "Show Percentage"; 336..373 "Open Energy Saver Preferences...".

### Time Machine status menu
52..89 "Latest Backup to "Time Machine":" (dis; curly quotes U+201C/U+201D); 90..127 "Today, 3:34 PM" (dis) (dark: "Today, 10:15 AM"); 128..151 ---; 152..189 "Back Up Now"; 190..227 "Enter Time Machine" [hl]; 228..251 ---; 252..289 "Open Time Machine Preferences...".

### Fast user switching menu (title "Stephen")
52..119 (avatar) "mhackett" [hl]; 120..187 (check badge, avatar) "Stephen" (dimmed: the current user); 188..211 ---; 212..249 "Login Window..."; 250..273 ---; 274..311 "Users & Groups Preferences...".

### System Preferences app menu (Theme screenshots)
52..89 "About System Preferences" [hl]; 90..113 ---; 114..151 "Services >"; 152..175 ---; 176..213 "Hide System Preferences" Command H; 214..251 "Hide Others" Option Command H; 252..289 "Show All" (dis); 290..313 ---; 314..351 "Quit System Preferences" Command Q. (In the Evening screenshots Hide System Preferences and Hide Others are dimmed and Show All is enabled.) [M] rows computed from the 19/12 pt rule and confirmed by the highlight at 52..89: 10-15-Catalina-Theme-Light-Blue.png @ 96,53,1,300.

### Detached menus (for the pop-up and action variants)
- Print > Presets pop-up (10-15-Catalina-Light-Print.png @ 975,298,488,244; 13 pt, 18 pt rows): 306..341 checkmark "Default Settings"; 342..377 "Last Used Settings"; 378..401 ---; 402..437 "Black and White" [hl]; 438..461 ---; 462..497 "Save Current Settings as Preset..."; 498..533 "Show Presets...".
- Contacts label pop-up (10-15-Catalina-Light-Contacts.png @ 976,389,190,178; 12 pt, 17 pt rows): 398..431 "home"; 432..465 checkmark "work" [hl]; 466..499 "other"; 500..523 ---; 524..557 "Custom...".
- Contacts field action menu (10-15-Catalina-Dark-Contacts.png @ 1148,432,358,130; 14 pt): 440..477 "Send Email"; 478..515 "Send Message" [hl]; 516..553 "Search with Spotlight".

## Not reproducible / assets needed
- Go menu item glyphs (Recents, Documents, Desktop, Downloads, Home, Computer, AirDrop, Network, iCloud Drive, Applications, Utilities) as 16 pt template SVGs.
- User avatars (yin-yang, penguin) and the Time Machine / Spotlight app icons in the battery menu.

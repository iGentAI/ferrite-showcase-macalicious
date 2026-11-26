# Launchpad
- **Screenshots:** 10-15-Catalina-Light-Launchpad.png, 10-15-Catalina-Dark-Launchpad.png, 10-15-Catalina-Light-Launchpad-Folder.png, 10-15-Catalina-Dark-Launchpad-Folder.png
- **Window:** full-screen overlay 1680 x 1050 pt; the menu bar is hidden, the Dock stays (hidden while a folder is open)

## Layout
| Region | Position / size (pt) | Fill | Tag | Evidence |
|---|---|---|---|---|
| Background | 0,0, 1680 x 1050 | desktop picture, blur 30-45 pt, saturate 1.8, `rgba(28,28,28,0.44)` | [C] | 10-15-Catalina-Light-Launchpad.png (fit against 10-15-Catalina-Light-Desktop.png) |
| Search field | x=715, y=25, 250 x 25 | `rgba(255,255,255,0.07)` + 1 pt `rgba(255,255,255,0.2)` border | [M]/[C] | 10-15-Catalina-Light-Launchpad.png @ 1430,50,500,50 |
| Icon grid | 7 x 5; column centres x = 254 + 195 k (k=0..6); icon centres y = 131.5 + 166 r (r=0..4); icons 112 pt | - | [M] | 10-15-Catalina-Light-Launchpad.png @ 300,150,2800,1600 |
| Labels | cap top 5 pt under each icon tile (label tops y = 193.5 + 166 r) | white 13 pt | [M] | @ 448,387,2435,24 |
| Page dots | centres (828.75, 918) and (848.75, 918), 8 pt | white / `rgba(255,255,255,0.2)` | [M] | @ 1650,1828,56,16 |
| Dock | as `dock` (970..1050) | Dock material over the blurred picture | [M] | @ 282,1940,2796,160 |

Folder open:
| Region | Position / size (pt) | Fill | Tag | Evidence |
|---|---|---|---|---|
| Background | full screen | picture with blur of 80 pt or more, about `rgba(0,0,0,0.36)` | [C] approx | 10-15-Catalina-Light-Launchpad-Folder.png |
| Title "Other" | centred, baseline about y=209 | white about 28 pt light | [M]/[C] | @ 1613,377,131,41 |
| Panel | x=137, y=231, 1406 x 573, radius about 30 | `rgba(180,180,180,0.72)` over blur 30 pt, saturate 1.8 | [M]/[C] | @ 274,462,2812,1146 |
| Grid in panel | same 7 column centres; label tops y=399.5, 565.5, 731.5 | - | [M] | @ 300,799,2800,688 |

## Components used
`launchpad`, `launchpad-folder`, `dock`, `material`.

## App-specific elements
None beyond the components.

## Content in the screenshot
Page 1 (5 rows of 7): App Store, Safari, Mail, Contacts, Calendar, Reminders, Notes / FaceTime, Messages, Maps, Find My, Photo Booth, Photos, Preview / Music, Podcasts, TV, Voice Memos, News, Stocks, Books / Dictionary, Calculator, Home, Siri, Mission Control, System Preferences, Other (folder) / QuickTime Player, TextEdit, Time Machine, Font Book, Chess, Stickies, Image Capture. Search placeholder "Search". Two pages (dot 1 current). The Calendar icon shows "OCT 3" (light) / "OCT 4" (dark).

Folder "Other": Grapher, VoiceOver Utility, AirPort Utility, Migration Assistant, Terminal, Activity Monitor, Console / Keychain Access, System Information, Script Editor, Disk Utility, Boot Camp Assistant, Digital Color Meter, ColorSync Utility / Screenshot, Bluetooth File Exchange, Audio MIDI Setup.

## Not reproducible / assets needed
All 51 app icons; the desktop picture.

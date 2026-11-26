# macOS 10.15 Catalina reference screenshots

Local copy of every screenshot on the [512 Pixels Aqua Screenshot Library page for macOS 10.15 Catalina](https://512pixels.net/projects/aqua-screenshot-library/macos-10-15-catalina/) (screenshots by Stephen Hackett, 512 Pixels). These images are the visual source of truth for this project. They are the untouched full-size originals linked from each gallery figure, not the `-scaled` thumbnails embedded in the page. Do not resize, recompress or convert them.

- `screenshots/` holds the PNG files under their original site filenames. The images are third-party and are not committed to the repository (the folder is in `.gitignore`), so the file links in this index work only after a download: `npm run reference:fetch` fetches every file from its `source_url` and rejects any whose SHA-256 differs from the manifest, and `npm run reference:fetch -- --check` verifies the files already on disk without downloading.
- `manifest.json` is the machine-readable catalog, with one entry per file. It is the authority: where this index and the manifest disagree, the manifest is right.
- The counts and tables in this file were derived from the manifest on the retrieval date. No script in the repository rebuilds them, so a change to the manifest has to be carried into this file by hand.

## Summary

| | |
|---|---|
| Figures on the page (parsed from the gallery markup) | 294 |
| Files saved | 294 |
| Failed downloads | 0 |
| Light appearance | 155 (131 in "Light Mode" + 24 accent shots) |
| Dark appearance | 139 (131 in "Dark Mode" + 8 accent shots) |
| Total size | 1000 MB |
| Format | PNG, 8-bit, 293 RGBA and 1 RGB |
| Scale factor | 2x for every file (144 dpi metadata) |
| Retrieved | 2026-09-30 |

The page has three galleries: "Appearance & Accent Combinations" (32 figures), "Light Mode" (131) and "Dark Mode" (131). There is no pagination; lazy loading only affects thumbnails. The light and dark galleries contain the same 131 captions (in a slightly different order), so every surface has exactly one light and one dark shot, linked through `counterpart` in the manifest.

## Resolution and scale

All images are Retina (2x) captures from a 15-inch MacBook Pro running at the scaled 1680 x 1050 pt desktop, so 2 image pixels equal 1 CSS pixel / AppKit point. Divide every measurement by 2 (`width_pt` and `height_pt` in the manifest already do).

| Capture type | Count | Meaning |
|---|---|---|
| `full-screen` | 83 | Whole display, 3360 x 2100 px (1680 x 1050 pt), opaque |
| `window` | 199 | One window, dialog or menu with a transparent background and its drop shadow included; widths range from 688 px (Calculator) to 3164 px (light QuickTime Player) and heights from 202 to 2104 px. Smallest by area: 764 x 202, the two Finder eject-warning banners. Largest by area: 2872 x 2104, four light Safari windows |
| `region` | 12 | Opaque rectangular crop of part of the screen |

Window captures include the shadow margin, so the window frame is smaller than the image; find the frame from the alpha channel. All 68 System Preferences window captures are 1560 px (780 pt) wide including shadow.

## Things to know about the set

- **Every surface has both appearances.** No app or surface appears in only one appearance.
- **Pairs are not pixel-aligned.** Light and dark shots of the same surface were taken separately: content, window size and sometimes the capture type differ. For example Spotlight is a full-screen capture in light and a window capture in dark, and Safari windows are 2872 x 2104 in light and 2732 x 2030 in dark.
- **Some pairs look the same in both appearances.** Siri, the fast user switching login screen, AirPort Utility, Calculator, QuickTime Player and FaceTime are dark-styled (or appearance-independent) in both; these have `appearance_visually_distinct: false` and their appearance comes from the page section.
- **Accent shots.** The 32 accent figures show the System Preferences General pane over the desktop for each of the 8 accent colours (blue, purple, pink, red, orange, yellow, green, graphite) in four variants: Morning, Day and Evening (light appearance with three states of the dynamic desktop picture) and Dark. The page captions the second variant "Day" while the filenames say `Theme-Light-`.
- **Two figures share the caption "Fast User Switching"** in each appearance: one is the menu bar menu (`...Fast-User-Switching-Menu.png`), the other the login screen.
- **Filenames are the site's own** and are inconsistent between appearances in places (`Light-Command-Tab` is captioned "App Switcher"; `Light-Text-Edit` vs `Dark-TextEdit`; `Light-Airport-Utility` vs `Dark-AirPort-Utility`; typos `Dark-Finder-Conect-to-Server`, `Dark-Stroage-Management` and `Theme-Evening-Purpe`). Use `counterpart`, `caption` and `app` from the manifest rather than deriving pairs from filenames.
- **No duplicate files.** All 294 SHA-256 hashes are distinct.
- **Third-party and personal content** (web pages, news photos, album art, the photographer's face) appears inside some windows; it is reference for layout only.

## Apps and surfaces

61 apps or system surfaces, excluding the accent shots. Every one has the same number of light and dark shots.

| App / surface | Light | Dark | Both appearances | Shots (captions) |
|---|---|---|---|---|
| About This Mac | 1 | 1 | yes | About This Mac |
| Activity Monitor | 1 | 1 | yes | Activity Monitor |
| AirPort Utility | 1 | 1 | yes | AirPort Utility |
| App Store | 1 | 1 | yes | Mac App Store |
| App Switcher | 1 | 1 | yes | App Switcher |
| Automator | 1 | 1 | yes | Automator |
| Books | 1 | 1 | yes | Books |
| Boot Camp Assistant | 1 | 1 | yes | Boot Camp Assistant |
| Calculator | 1 | 1 | yes | Calculator |
| Calendar | 2 | 2 | yes | Calendar; Calendar: Preferences |
| Chess | 1 | 1 | yes | Chess |
| Console | 1 | 1 | yes | Console |
| Contacts | 1 | 1 | yes | Contacts |
| Desktop | 2 | 2 | yes | Desktop; Desktop Stacks |
| Dictation | 1 | 1 | yes | Dictation |
| Dictionary | 1 | 1 | yes | Dictionary |
| Disk Utility | 1 | 1 | yes | Disk Utility |
| Dock | 1 | 1 | yes | Stacks |
| FaceTime | 1 | 1 | yes | FaceTime |
| Find My | 1 | 1 | yes | Find My |
| Finder | 17 | 17 | yes | Finder Menu; Go Menu; Finder: Go to Folder; Finder: Connect to Server; Finder: Network; Finder: Home; Finder: Gallery View; Finder: Quick Look; Finder: Quick Look Markup; Finder: Get Info; Finder: Search; Applications; Applications: Utilities; Finder: Copy; Finder: Replace; Finder: Empty Trash; Finder: Eject Warning |
| Font Book | 1 | 1 | yes | Font Book |
| Force Quit Applications | 1 | 1 | yes | Force Quit |
| Full Screen Mode | 1 | 1 | yes | Fullscreen App |
| Help Viewer | 2 | 2 | yes | Help; Help: Search |
| Home | 1 | 1 | yes | Home |
| Keychain Access | 1 | 1 | yes | Keychain Access |
| Launchpad | 2 | 2 | yes | Launchpad; Launchpad: Folder |
| Login Window | 1 | 1 | yes | Fast User Switching (login screen) |
| Mail | 2 | 2 | yes | Mail; Mail: Preferences |
| Maps | 1 | 1 | yes | Maps |
| Menu Bar | 4 | 4 | yes | Apple Menu; Menu Bar: Battery; Fast User Switching (menu); Menu Bar: Time Machine |
| Messages | 1 | 1 | yes | Messages |
| Mission Control | 1 | 1 | yes | Mission Control |
| Music | 2 | 2 | yes | Music; Music: Preferences |
| Network Utility | 1 | 1 | yes | Network Utility |
| News | 1 | 1 | yes | News |
| Notes | 1 | 1 | yes | Notes |
| Notification Center | 2 | 2 | yes | Notification Center: Today; Notification Center: Notifications |
| Open Dialog | 2 | 2 | yes | Open; Open: iCloud |
| Photo Booth | 1 | 1 | yes | Photo Booth |
| Photos | 1 | 1 | yes | Photos |
| Podcasts | 2 | 2 | yes | Podcasts; Podcasts: Preferences |
| Preview | 2 | 2 | yes | Preview: Search; Preview |
| Print Dialog | 1 | 1 | yes | Print |
| QuickTime Player | 1 | 1 | yes | QuickTime Player |
| Reminders | 1 | 1 | yes | Reminders |
| Safari | 7 | 7 | yes | Safari 13; Safari 13: Favorites; Safari 13: Picture in Picture; Safari 13: Preferences; Safari 13: Reader Mode; Safari 13: Sharing; Safari 13: Tab Overview |
| Script Editor | 1 | 1 | yes | Script Editor |
| Siri | 1 | 1 | yes | Siri |
| Split View | 1 | 1 | yes | Split Screen Apps |
| Spotlight | 2 | 2 | yes | Spotlight; Spotlight: More Results |
| Stickies | 1 | 1 | yes | Stickies |
| Stocks | 1 | 1 | yes | Stocks |
| Storage Management | 1 | 1 | yes | Storage Management |
| System Information | 1 | 1 | yes | System Information |
| System Preferences | 34 | 34 | yes | System Preferences; System Preferences: Accessibility; System Preferences: Apple ID; System Preferences: Bluetooth; System Preferences: Date & Time; System Preferences: Desktop & Screen Saver; System Preferences: Displays; System Preferences: Dock; System Preferences: Energy Saver; System Preferences: Extensions; System Preferences: Family Sharing; System Preferences: General; System Preferences: Internet Accounts; System Preferences: Keyboard; System Preferences: Language & Region; System Preferences: Mission Control; System Preferences: Mouse; System Preferences: Network; System Preferences: Notifications; System Preferences: Printers & Scanners; System Preferences: Screen Time; System Preferences: Security & Privacy; System Preferences: Sharing; System Preferences: Sidecar; System Preferences: Siri; System Preferences: Software Update; System Preferences: Sound; System Preferences: Spotlight; System Preferences: Startup Disk; System Preferences: Time Machine; System Preferences: Touch ID; System Preferences: Trackpad; System Preferences: Users & Groups; System Preferences: Wallet & Apple Pay |
| TextEdit | 1 | 1 | yes | TextEdit |
| Time Machine | 1 | 1 | yes | Time Machine |
| TV | 2 | 2 | yes | TV; TV: Preferences |
| Voice Memos | 1 | 1 | yes | Voice Memos |
| **Total** | **131** | **131** | | |

Accent combinations (System Preferences General pane over the desktop): 24 light (Morning, Day, Evening x 8 colours) and 8 dark.

## Manifest format

`manifest.json` has top-level `source_page`, `page_figure_count`, `count`, `failures`, `field_notes` and a `screenshots` array in page order. Each entry has:

| Field | Meaning |
|---|---|
| `filename`, `path` | File name and path relative to `reference/` |
| `id` | Lowercase short identifier derived from the filename |
| `order` | 1-based position on the page |
| `source_url`, `thumbnail_url` | Full-size original and the page's thumbnail |
| `caption`, `page_section`, `group` | Caption and gallery the figure came from |
| `width`, `height`, `width_pt`, `height_pt`, `scale`, `scale_factor`, `dpi` | Pixel size, point size and scale (always 2x) |
| `appearance`, `appearance_visually_distinct` | `light` or `dark`, and whether the image itself reveals it |
| `app`, `surface`, `surface_type` | What is shown |
| `capture`, `has_transparency` | `full-screen`, `window` or `region` |
| `accent_color`, `wallpaper_variant` | Accent shots only |
| `counterpart` | Same surface in the other appearance |
| `color_mode`, `bytes`, `sha256` | File facts for integrity checks |
| `notes` | Anything unusual about the shot, else null |

## All files

### Appearance and accent combinations

| # | File | Caption | App / surface | Size (px) | Capture |
|---|---|---|---|---|---|
| 1 | [10-15-Catalina-Theme-Morning-Blue.png](screenshots/10-15-Catalina-Theme-Morning-Blue.png) | Morning Blue | System Preferences | 3360 x 2100 | full-screen |
| 2 | [10-15-Catalina-Theme-Morning-Purple.png](screenshots/10-15-Catalina-Theme-Morning-Purple.png) | Morning Purple | System Preferences | 3360 x 2100 | full-screen |
| 3 | [10-15-Catalina-Theme-Morning-Pink.png](screenshots/10-15-Catalina-Theme-Morning-Pink.png) | Morning Pink | System Preferences | 3360 x 2100 | full-screen |
| 4 | [10-15-Catalina-Theme-Morning-Red.png](screenshots/10-15-Catalina-Theme-Morning-Red.png) | Morning Red | System Preferences | 3360 x 2100 | full-screen |
| 5 | [10-15-Catalina-Theme-Morning-Orange.png](screenshots/10-15-Catalina-Theme-Morning-Orange.png) | Morning Orange | System Preferences | 3360 x 2100 | full-screen |
| 6 | [10-15-Catalina-Theme-Morning-Yellow.png](screenshots/10-15-Catalina-Theme-Morning-Yellow.png) | Morning Yellow | System Preferences | 3360 x 2100 | full-screen |
| 7 | [10-15-Catalina-Theme-Morning-Green.png](screenshots/10-15-Catalina-Theme-Morning-Green.png) | Morning Green | System Preferences | 3360 x 2100 | full-screen |
| 8 | [10-15-Catalina-Theme-Morning-Graphite.png](screenshots/10-15-Catalina-Theme-Morning-Graphite.png) | Morning Graphite | System Preferences | 3360 x 2100 | full-screen |
| 9 | [10-15-Catalina-Theme-Light-Blue.png](screenshots/10-15-Catalina-Theme-Light-Blue.png) | Day Blue | System Preferences | 3360 x 2100 | full-screen |
| 10 | [10-15-Catalina-Theme-Light-Purple.png](screenshots/10-15-Catalina-Theme-Light-Purple.png) | Day Purple | System Preferences | 3360 x 2100 | full-screen |
| 11 | [10-15-Catalina-Theme-Light-Pink.png](screenshots/10-15-Catalina-Theme-Light-Pink.png) | Day Pink | System Preferences | 3360 x 2100 | full-screen |
| 12 | [10-15-Catalina-Theme-Light-Red.png](screenshots/10-15-Catalina-Theme-Light-Red.png) | Day Red | System Preferences | 3360 x 2100 | full-screen |
| 13 | [10-15-Catalina-Theme-Light-Orange.png](screenshots/10-15-Catalina-Theme-Light-Orange.png) | Day Orange | System Preferences | 3360 x 2100 | full-screen |
| 14 | [10-15-Catalina-Theme-Light-Yellow.png](screenshots/10-15-Catalina-Theme-Light-Yellow.png) | Day Yellow | System Preferences | 3360 x 2100 | full-screen |
| 15 | [10-15-Catalina-Theme-Light-Green.png](screenshots/10-15-Catalina-Theme-Light-Green.png) | Day Green | System Preferences | 3360 x 2100 | full-screen |
| 16 | [10-15-Catalina-Theme-Light-Graphite.png](screenshots/10-15-Catalina-Theme-Light-Graphite.png) | Day Graphite | System Preferences | 3360 x 2100 | full-screen |
| 17 | [10-15-Catalina-Theme-Evening-Blue.png](screenshots/10-15-Catalina-Theme-Evening-Blue.png) | Evening Blue | System Preferences | 3360 x 2100 | full-screen |
| 18 | [10-15-Catalina-Theme-Evening-Purpe.png](screenshots/10-15-Catalina-Theme-Evening-Purpe.png) | Evening Purple | System Preferences | 3360 x 2100 | full-screen |
| 19 | [10-15-Catalina-Theme-Evening-Pink.png](screenshots/10-15-Catalina-Theme-Evening-Pink.png) | Evening Pink | System Preferences | 3360 x 2100 | full-screen |
| 20 | [10-15-Catalina-Theme-Evening-Red.png](screenshots/10-15-Catalina-Theme-Evening-Red.png) | Evening Red | System Preferences | 3360 x 2100 | full-screen |
| 21 | [10-15-Catalina-Theme-Evening-Orange.png](screenshots/10-15-Catalina-Theme-Evening-Orange.png) | Evening Orange | System Preferences | 3360 x 2100 | full-screen |
| 22 | [10-15-Catalina-Theme-Evening-Yellow.png](screenshots/10-15-Catalina-Theme-Evening-Yellow.png) | Evening Yellow | System Preferences | 3360 x 2100 | full-screen |
| 23 | [10-15-Catalina-Theme-Evening-Green.png](screenshots/10-15-Catalina-Theme-Evening-Green.png) | Evening Green | System Preferences | 3360 x 2100 | full-screen |
| 24 | [10-15-Catalina-Theme-Evening-Graphite.png](screenshots/10-15-Catalina-Theme-Evening-Graphite.png) | Evening Graphite | System Preferences | 3360 x 2100 | full-screen |
| 25 | [10-15-Catalina-Theme-Dark-Blue.png](screenshots/10-15-Catalina-Theme-Dark-Blue.png) | Dark: Blue | System Preferences | 3360 x 2100 | full-screen |
| 26 | [10-15-Catalina-Theme-Dark-Purple.png](screenshots/10-15-Catalina-Theme-Dark-Purple.png) | Dark: Purple | System Preferences | 3360 x 2100 | full-screen |
| 27 | [10-15-Catalina-Theme-Dark-Pink.png](screenshots/10-15-Catalina-Theme-Dark-Pink.png) | Dark: Pink | System Preferences | 3360 x 2100 | full-screen |
| 28 | [10-15-Catalina-Theme-Dark-Red.png](screenshots/10-15-Catalina-Theme-Dark-Red.png) | Dark: Red | System Preferences | 3360 x 2100 | full-screen |
| 29 | [10-15-Catalina-Theme-Dark-Orange.png](screenshots/10-15-Catalina-Theme-Dark-Orange.png) | Dark: Orange | System Preferences | 3360 x 2100 | full-screen |
| 30 | [10-15-Catalina-Theme-Dark-Yellow.png](screenshots/10-15-Catalina-Theme-Dark-Yellow.png) | Dark: Yellow | System Preferences | 3360 x 2100 | full-screen |
| 31 | [10-15-Catalina-Theme-Dark-Green.png](screenshots/10-15-Catalina-Theme-Dark-Green.png) | Dark: Green | System Preferences | 3360 x 2100 | full-screen |
| 32 | [10-15-Catalina-Theme-Dark-Graphite.png](screenshots/10-15-Catalina-Theme-Dark-Graphite.png) | Dark: Graphite | System Preferences | 3360 x 2100 | full-screen |

### Light mode

| # | File | Caption | App / surface | Size (px) | Capture |
|---|---|---|---|---|---|
| 33 | [10-15-Catalina-Light-Desktop.png](screenshots/10-15-Catalina-Light-Desktop.png) | Desktop | Desktop | 3360 x 2100 | full-screen |
| 34 | [10-15-Catalina-Light-About-This-Mac.png](screenshots/10-15-Catalina-Light-About-This-Mac.png) | About This Mac | About This Mac | 3360 x 2100 | full-screen |
| 35 | [10-15-Catalina-Light-System-Information.png](screenshots/10-15-Catalina-Light-System-Information.png) | System Information | System Information | 1726 x 1264 | window |
| 36 | [10-15-Catalina-Light-Stacks.png](screenshots/10-15-Catalina-Light-Stacks.png) | Stacks | Dock | 3360 x 2100 | full-screen |
| 37 | [10-15-Catalina-Light-Desktop-Stacks.png](screenshots/10-15-Catalina-Light-Desktop-Stacks.png) | Desktop Stacks | Desktop | 3360 x 2100 | full-screen |
| 38 | [10-15-Catalina-Light-Apple-Menu.png](screenshots/10-15-Catalina-Light-Apple-Menu.png) | Apple Menu | Menu Bar | 3360 x 2100 | full-screen |
| 39 | [10-15-Catalina-Light-Finder-Menu.png](screenshots/10-15-Catalina-Light-Finder-Menu.png) | Finder Menu | Finder | 3360 x 2100 | full-screen |
| 40 | [10-15-Catalina-Light-Finder-Go-Menu.png](screenshots/10-15-Catalina-Light-Finder-Go-Menu.png) | Go Menu | Finder | 3360 x 2100 | full-screen |
| 41 | [10-15-Catalina-Light-Finder-Go-To-Folder.png](screenshots/10-15-Catalina-Light-Finder-Go-To-Folder.png) | Finder: Go to Folder | Finder | 1082 x 516 | window |
| 42 | [10-15-Catalina-Light-Finder-Connect-to-Server.png](screenshots/10-15-Catalina-Light-Finder-Connect-to-Server.png) | Finder: Connect to Server | Finder | 1196 x 686 | window |
| 43 | [10-15-Catalina-Light-Finder-Network.png](screenshots/10-15-Catalina-Light-Finder-Network.png) | Finder: Network | Finder | 2076 x 1646 | window |
| 44 | [10-15-Catalina-Light-Finder-Home.png](screenshots/10-15-Catalina-Light-Finder-Home.png) | Finder: Home | Finder | 2434 x 1688 | window |
| 45 | [10-15-Catalina-Light-Finder-Gallery-View.png](screenshots/10-15-Catalina-Light-Finder-Gallery-View.png) | Finder: Gallery View | Finder | 2692 x 1794 | window |
| 46 | [10-15-Catalina-Light-Finder-Quick-Look.png](screenshots/10-15-Catalina-Light-Finder-Quick-Look.png) | Finder: Quick Look | Finder | 3360 x 2100 | full-screen |
| 47 | [10-15-Catalina-Light-Finder-Quick-Look-Markup.png](screenshots/10-15-Catalina-Light-Finder-Quick-Look-Markup.png) | Finder: Quick Look Markup | Finder | 3360 x 2100 | full-screen |
| 48 | [10-15-Catalina-Light-Finder-Get-Info.png](screenshots/10-15-Catalina-Light-Finder-Get-Info.png) | Finder: Get Info | Finder | 754 x 1912 | window |
| 49 | [10-15-Catalina-Light-Finder-Search.png](screenshots/10-15-Catalina-Light-Finder-Search.png) | Finder: Search | Finder | 2482 x 1652 | window |
| 50 | [10-15-Catalina-Light-Applications.png](screenshots/10-15-Catalina-Light-Applications.png) | Applications | Finder | 2384 x 1736 | window |
| 51 | [10-15-Catalina-Light-Applications-Utilities.png](screenshots/10-15-Catalina-Light-Applications-Utilities.png) | Applications: Utilities | Finder | 2384 x 1736 | window |
| 52 | [10-15-Catalina-Light-Menu-Bar-Battery.png](screenshots/10-15-Catalina-Light-Menu-Bar-Battery.png) | Menu Bar: Battery | Menu Bar | 3360 x 2100 | full-screen |
| 53 | [10-15-Catalina-Light-Command-Tab.png](screenshots/10-15-Catalina-Light-Command-Tab.png) | App Switcher | App Switcher | 3360 x 2100 | full-screen |
| 54 | [10-15-Catalina-Light-Force-Quit.png](screenshots/10-15-Catalina-Light-Force-Quit.png) | Force Quit | Force Quit Applications | 900 x 838 | window |
| 55 | [10-15-Catalina-Light-Finder-Copy.png](screenshots/10-15-Catalina-Light-Finder-Copy.png) | Finder: Copy | Finder | 1022 x 362 | window |
| 56 | [10-15-Catalina-Light-Finder-Copy-Replace.png](screenshots/10-15-Catalina-Light-Finder-Copy-Replace.png) | Finder: Replace | Finder | 1022 x 424 | window |
| 57 | [10-15-Catalina-Light-Finder-Empty-Trash.png](screenshots/10-15-Catalina-Light-Finder-Empty-Trash.png) | Finder: Empty Trash | Finder | 1064 x 526 | window |
| 58 | [10-15-Catalina-Light-Finder-Eject-Warning.png](screenshots/10-15-Catalina-Light-Finder-Eject-Warning.png) | Finder: Eject Warning | Finder | 764 x 202 | window |
| 59 | [10-15-Catalina-Light-Fast-User-Switching-Menu.png](screenshots/10-15-Catalina-Light-Fast-User-Switching-Menu.png) | Fast User Switching | Menu Bar | 3360 x 2100 | full-screen |
| 60 | [10-15-Catalina-Light-Fast-User-Switching.png](screenshots/10-15-Catalina-Light-Fast-User-Switching.png) | Fast User Switching | Login Window | 3360 x 2100 | full-screen |
| 61 | [10-15-Catalina-Light-Spotlight.png](screenshots/10-15-Catalina-Light-Spotlight.png) | Spotlight | Spotlight | 3360 x 2100 | full-screen |
| 62 | [10-15-Catalina-Light-Spotlight-More.png](screenshots/10-15-Catalina-Light-Spotlight-More.png) | Spotlight: More Results | Spotlight | 2482 x 1652 | window |
| 63 | [10-15-Catalina-Light-Mission-Control.png](screenshots/10-15-Catalina-Light-Mission-Control.png) | Mission Control | Mission Control | 3360 x 2100 | full-screen |
| 64 | [10-15-Catalina-Light-Time-Machine-Menu.png](screenshots/10-15-Catalina-Light-Time-Machine-Menu.png) | Menu Bar: Time Machine | Menu Bar | 3360 x 2100 | full-screen |
| 65 | [10-15-Catalina-Light-Time-Machine.png](screenshots/10-15-Catalina-Light-Time-Machine.png) | Time Machine | Time Machine | 3360 x 2100 | full-screen |
| 66 | [10-15-Catalina-Light-Launchpad.png](screenshots/10-15-Catalina-Light-Launchpad.png) | Launchpad | Launchpad | 3360 x 2100 | full-screen |
| 67 | [10-15-Catalina-Light-Launchpad-Folder.png](screenshots/10-15-Catalina-Light-Launchpad-Folder.png) | Launchpad: Folder | Launchpad | 3360 x 2100 | full-screen |
| 68 | [10-15-Catalina-Light-Full-Screen-App.png](screenshots/10-15-Catalina-Light-Full-Screen-App.png) | Fullscreen App | Full Screen Mode | 3360 x 2100 | full-screen |
| 69 | [10-15-Catalina-Light-Split-Screen-Apps.png](screenshots/10-15-Catalina-Light-Split-Screen-Apps.png) | Split Screen Apps | Split View | 3360 x 2100 | full-screen |
| 70 | [10-15-Catalina-Light-Notification-Center-Today.png](screenshots/10-15-Catalina-Light-Notification-Center-Today.png) | Notification Center: Today | Notification Center | 3360 x 2100 | full-screen |
| 71 | [10-15-Catalina-Light-Notification-Center-Notifications.png](screenshots/10-15-Catalina-Light-Notification-Center-Notifications.png) | Notification Center: Notifications | Notification Center | 3360 x 2100 | full-screen |
| 72 | [10-15-Catalina-Light-Dictation.png](screenshots/10-15-Catalina-Light-Dictation.png) | Dictation | Dictation | 1425 x 1032 | region |
| 73 | [10-15-Catalina-Light-Siri.png](screenshots/10-15-Catalina-Light-Siri.png) | Siri | Siri | 764 x 1404 | window |
| 74 | [10-15-Catalina-Light-Storage-Management.png](screenshots/10-15-Catalina-Light-Storage-Management.png) | Storage Management | Storage Management | 1826 x 1288 | window |
| 75 | [10-15-Catalina-Light-Text-Edit.png](screenshots/10-15-Catalina-Light-Text-Edit.png) | TextEdit | TextEdit | 1472 x 1298 | window |
| 76 | [10-15-Catalina-Light-Finder-Open.png](screenshots/10-15-Catalina-Light-Finder-Open.png) | Open | Open Dialog | 2052 x 1454 | window |
| 77 | [10-15-Catalina-Light-Finder-Open-iCloud.png](screenshots/10-15-Catalina-Light-Finder-Open-iCloud.png) | Open: iCloud | Open Dialog | 1822 x 1120 | window |
| 78 | [10-15-Catalina-Light-Activity-Monitor.png](screenshots/10-15-Catalina-Light-Activity-Monitor.png) | Activity Monitor | Activity Monitor | 1902 x 1492 | window |
| 79 | [10-15-Catalina-Light-Airport-Utility.png](screenshots/10-15-Catalina-Light-Airport-Utility.png) | AirPort Utility | AirPort Utility | 1616 x 1288 | window |
| 80 | [10-15-Catalina-Light-Automator.png](screenshots/10-15-Catalina-Light-Automator.png) | Automator | Automator | 2224 x 1960 | window |
| 81 | [10-15-Catalina-Light-Books.png](screenshots/10-15-Catalina-Light-Books.png) | Books | Books | 3360 x 2100 | full-screen |
| 82 | [10-15-Catalina-Light-Boot-Camp-Assistant.png](screenshots/10-15-Catalina-Light-Boot-Camp-Assistant.png) | Boot Camp Assistant | Boot Camp Assistant | 1790 x 1320 | window |
| 83 | [10-15-Catalina-Light-Calculator.png](screenshots/10-15-Catalina-Light-Calculator.png) | Calculator | Calculator | 688 x 866 | window |
| 84 | [10-15-Catalina-Light-Calendar.png](screenshots/10-15-Catalina-Light-Calendar.png) | Calendar | Calendar | 2502 x 1472 | window |
| 85 | [10-15-Catalina-Light-Calendar-Preferences.png](screenshots/10-15-Catalina-Light-Calendar-Preferences.png) | Calendar: Preferences | Calendar | 1298 x 1308 | window |
| 86 | [10-15-Catalina-Light-Chess.png](screenshots/10-15-Catalina-Light-Chess.png) | Chess | Chess | 2166 x 1628 | window |
| 87 | [10-15-Catalina-Light-Console.png](screenshots/10-15-Catalina-Light-Console.png) | Console | Console | 2224 x 1224 | window |
| 88 | [10-15-Catalina-Light-Contacts.png](screenshots/10-15-Catalina-Light-Contacts.png) | Contacts | Contacts | 1930 x 938 | region |
| 89 | [10-15-Catalina-Light-Dictionary.png](screenshots/10-15-Catalina-Light-Dictionary.png) | Dictionary | Dictionary | 1604 x 1524 | window |
| 90 | [10-15-Catalina-Light-Disk-Utility.png](screenshots/10-15-Catalina-Light-Disk-Utility.png) | Disk Utility | Disk Utility | 2076 x 1366 | window |
| 91 | [10-15-Catalina-Light-FaceTime.png](screenshots/10-15-Catalina-Light-FaceTime.png) | FaceTime | FaceTime | 1528 x 1394 | window |
| 92 | [10-15-Catalina-Light-Find-My.png](screenshots/10-15-Catalina-Light-Find-My.png) | Find My | Find My | 2496 x 1670 | window |
| 93 | [10-15-Catalina-Light-Font-Book.png](screenshots/10-15-Catalina-Light-Font-Book.png) | Font Book | Font Book | 2258 x 1430 | window |
| 94 | [10-15-Catalina-Light-Help.png](screenshots/10-15-Catalina-Light-Help.png) | Help | Help Viewer | 1846 x 1536 | window |
| 95 | [10-15-Catalina-Light-Help-Search.png](screenshots/10-15-Catalina-Light-Help-Search.png) | Help: Search | Help Viewer | 1846 x 1536 | window |
| 96 | [10-15-Catalina-Light-Home.png](screenshots/10-15-Catalina-Light-Home.png) | Home | Home | 2052 x 1760 | window |
| 97 | [10-15-Catalina-Light-Keychain-Access.png](screenshots/10-15-Catalina-Light-Keychain-Access.png) | Keychain Access | Keychain Access | 1978 x 1410 | window |
| 98 | [10-15-Catalina-Light-Mac-App-Store.png](screenshots/10-15-Catalina-Light-Mac-App-Store.png) | Mac App Store | App Store | 2716 x 1938 | window |
| 99 | [10-15-Catalina-Light-Mail.png](screenshots/10-15-Catalina-Light-Mail.png) | Mail | Mail | 2314 x 1544 | region |
| 100 | [10-15-Catalina-Light-Mail-Preferences.png](screenshots/10-15-Catalina-Light-Mail-Preferences.png) | Mail: Preferences | Mail | 1324 x 1306 | window |
| 101 | [10-15-Catalina-Light-Maps.png](screenshots/10-15-Catalina-Light-Maps.png) | Maps | Maps | 2224 x 1622 | window |
| 102 | [10-15-Catalina-Light-Messages.png](screenshots/10-15-Catalina-Light-Messages.png) | Messages | Messages | 2286 x 1206 | region |
| 103 | [10-15-Catalina-Light-Music.png](screenshots/10-15-Catalina-Light-Music.png) | Music | Music | 2664 x 1664 | window |
| 104 | [10-15-Catalina-Light-Music-Preferences.png](screenshots/10-15-Catalina-Light-Music-Preferences.png) | Music: Preferences | Music | 1290 x 808 | window |
| 105 | [10-15-Catalina-Light-Network-Utility.png](screenshots/10-15-Catalina-Light-Network-Utility.png) | Network Utility | Network Utility | 1512 x 994 | window |
| 106 | [10-15-Catalina-Light-News.png](screenshots/10-15-Catalina-Light-News.png) | News | News | 2668 x 1908 | window |
| 107 | [10-15-Catalina-Light-Notes.png](screenshots/10-15-Catalina-Light-Notes.png) | Notes | Notes | 2224 x 1556 | window |
| 108 | [10-15-Catalina-Light-Photo-Booth.png](screenshots/10-15-Catalina-Light-Photo-Booth.png) | Photo Booth | Photo Booth | 1664 x 1348 | window |
| 109 | [10-15-Catalina-Light-Photos.png](screenshots/10-15-Catalina-Light-Photos.png) | Photos | Photos | 2624 x 1664 | window |
| 110 | [10-15-Catalina-Light-Podcasts.png](screenshots/10-15-Catalina-Light-Podcasts.png) | Podcasts | Podcasts | 2498 x 1752 | window |
| 111 | [10-15-Catalina-Light-Podcasts-Preferences.png](screenshots/10-15-Catalina-Light-Podcasts-Preferences.png) | Podcasts: Preferences | Podcasts | 990 x 576 | window |
| 112 | [10-15-Catalina-Light-Preview-Search.png](screenshots/10-15-Catalina-Light-Preview-Search.png) | Preview: Search | Preview | 2518 x 1810 | window |
| 113 | [10-15-Catalina-Light-Preview.png](screenshots/10-15-Catalina-Light-Preview.png) | Preview | Preview | 2022 x 1574 | window |
| 114 | [10-15-Catalina-Light-Print.png](screenshots/10-15-Catalina-Light-Print.png) | Print | Print Dialog | 1780 x 1205 | region |
| 115 | [10-15-Catalina-Light-QuickTime.png](screenshots/10-15-Catalina-Light-QuickTime.png) | QuickTime Player | QuickTime Player | 3164 x 1878 | window |
| 116 | [10-15-Catalina-Light-Reminders.png](screenshots/10-15-Catalina-Light-Reminders.png) | Reminders | Reminders | 2290 x 1472 | window |
| 117 | [10-15-Catalina-Light-Safari-v13.png](screenshots/10-15-Catalina-Light-Safari-v13.png) | Safari 13 | Safari | 2872 x 2104 | window |
| 118 | [10-15-Catalina-Light-Safari-v13-Favorites.png](screenshots/10-15-Catalina-Light-Safari-v13-Favorites.png) | Safari 13: Favorites | Safari | 2872 x 2104 | window |
| 119 | [10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png](screenshots/10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png) | Safari 13: Picture in Picture | Safari | 3360 x 2100 | full-screen |
| 120 | [10-15-Catalina-Light-Safari-v13-Preferences.png](screenshots/10-15-Catalina-Light-Safari-v13-Preferences.png) | Safari 13: Preferences | Safari | 1772 x 1240 | window |
| 121 | [10-15-Catalina-Light-Safari-v13-Reader-Mode.png](screenshots/10-15-Catalina-Light-Safari-v13-Reader-Mode.png) | Safari 13: Reader Mode | Safari | 2872 x 2104 | window |
| 122 | [10-15-Catalina-Light-Safari-v13-Sharing.png](screenshots/10-15-Catalina-Light-Safari-v13-Sharing.png) | Safari 13: Sharing | Safari | 2662 x 1804 | region |
| 123 | [10-15-Catalina-Light-Safari-v13-Tab-Overview.png](screenshots/10-15-Catalina-Light-Safari-v13-Tab-Overview.png) | Safari 13: Tab Overview | Safari | 2872 x 2104 | window |
| 124 | [10-15-Catalina-Light-Script-Editor.png](screenshots/10-15-Catalina-Light-Script-Editor.png) | Script Editor | Script Editor | 1624 x 1634 | window |
| 125 | [10-15-Catalina-Light-Stickies.png](screenshots/10-15-Catalina-Light-Stickies.png) | Stickies | Stickies | 3360 x 2100 | full-screen |
| 126 | [10-15-Catalina-Light-Stocks.png](screenshots/10-15-Catalina-Light-Stocks.png) | Stocks | Stocks | 2520 x 1830 | window |
| 127 | [10-15-Catalina-Light-TV.png](screenshots/10-15-Catalina-Light-TV.png) | TV | TV | 2812 x 1976 | window |
| 128 | [10-15-Catalina-Light-TV-Preferences.png](screenshots/10-15-Catalina-Light-TV-Preferences.png) | TV: Preferences | TV | 1504 x 944 | window |
| 129 | [10-15-Catalina-Light-Voice-Memos.png](screenshots/10-15-Catalina-Light-Voice-Memos.png) | Voice Memos | Voice Memos | 1802 x 1484 | window |
| 130 | [10-15-Catalina-Light-System-Preferences-0.png](screenshots/10-15-Catalina-Light-System-Preferences-0.png) | System Preferences | System Preferences | 1560 x 1332 | window |
| 131 | [10-15-Catalina-Light-System-Preferences-Accessibility.png](screenshots/10-15-Catalina-Light-System-Preferences-Accessibility.png) | System Preferences: Accessibility | System Preferences | 1560 x 1176 | window |
| 132 | [10-15-Catalina-Light-System-Preferences-Apple-ID.png](screenshots/10-15-Catalina-Light-System-Preferences-Apple-ID.png) | System Preferences: Apple ID | System Preferences | 1560 x 1420 | window |
| 133 | [10-15-Catalina-Light-System-Preferences-Bluetooth.png](screenshots/10-15-Catalina-Light-System-Preferences-Bluetooth.png) | System Preferences: Bluetooth | System Preferences | 1560 x 1088 | window |
| 134 | [10-15-Catalina-Light-System-Preferences-Date-and-Time.png](screenshots/10-15-Catalina-Light-System-Preferences-Date-and-Time.png) | System Preferences: Date & Time | System Preferences | 1560 x 1280 | window |
| 135 | [10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png](screenshots/10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png) | System Preferences: Desktop & Screen Saver | System Preferences | 1560 x 1348 | window |
| 136 | [10-15-Catalina-Light-System-Preferences-Displays.png](screenshots/10-15-Catalina-Light-System-Preferences-Displays.png) | System Preferences: Displays | System Preferences | 1560 x 1246 | window |
| 137 | [10-15-Catalina-Light-System-Preferences-Dock.png](screenshots/10-15-Catalina-Light-System-Preferences-Dock.png) | System Preferences: Dock | System Preferences | 1560 x 1026 | window |
| 138 | [10-15-Catalina-Light-System-Preferences-Energy-Saver.png](screenshots/10-15-Catalina-Light-System-Preferences-Energy-Saver.png) | System Preferences: Energy Saver | System Preferences | 1560 x 1234 | window |
| 139 | [10-15-Catalina-Light-System-Preferences-Extensions.png](screenshots/10-15-Catalina-Light-System-Preferences-Extensions.png) | System Preferences: Extensions | System Preferences | 1560 x 1240 | window |
| 140 | [10-15-Catalina-Light-System-Preferences-Family-Sharing.png](screenshots/10-15-Catalina-Light-System-Preferences-Family-Sharing.png) | System Preferences: Family Sharing | System Preferences | 1560 x 880 | window |
| 141 | [10-15-Catalina-Light-System-Preferences-General.png](screenshots/10-15-Catalina-Light-System-Preferences-General.png) | System Preferences: General | System Preferences | 1560 x 1580 | window |
| 142 | [10-15-Catalina-Light-System-Preferences-Internet-Accounts.png](screenshots/10-15-Catalina-Light-System-Preferences-Internet-Accounts.png) | System Preferences: Internet Accounts | System Preferences | 1560 x 1196 | window |
| 143 | [10-15-Catalina-Light-System-Preferences-Keyboard.png](screenshots/10-15-Catalina-Light-System-Preferences-Keyboard.png) | System Preferences: Keyboard | System Preferences | 1560 x 1386 | window |
| 144 | [10-15-Catalina-Light-System-Preferences-Language-and-Region.png](screenshots/10-15-Catalina-Light-System-Preferences-Language-and-Region.png) | System Preferences: Language & Region | System Preferences | 1560 x 1258 | window |
| 145 | [10-15-Catalina-Light-System-Preferences-Mission-Control.png](screenshots/10-15-Catalina-Light-System-Preferences-Mission-Control.png) | System Preferences: Mission Control | System Preferences | 1560 x 1184 | window |
| 146 | [10-15-Catalina-Light-System-Preferences-Mouse.png](screenshots/10-15-Catalina-Light-System-Preferences-Mouse.png) | System Preferences: Mouse | System Preferences | 1560 x 1248 | window |
| 147 | [10-15-Catalina-Light-System-Preferences-Network.png](screenshots/10-15-Catalina-Light-System-Preferences-Network.png) | System Preferences: Network | System Preferences | 1560 x 1350 | window |
| 148 | [10-15-Catalina-Light-System-Preferences-Notifications.png](screenshots/10-15-Catalina-Light-System-Preferences-Notifications.png) | System Preferences: Notifications | System Preferences | 1560 x 1280 | window |
| 149 | [10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png](screenshots/10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png) | System Preferences: Printers & Scanners | System Preferences | 1560 x 1100 | window |
| 150 | [10-15-Catalina-Light-System-Preferences-Screen-Time.png](screenshots/10-15-Catalina-Light-System-Preferences-Screen-Time.png) | System Preferences: Screen Time | System Preferences | 1560 x 1450 | window |
| 151 | [10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png](screenshots/10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png) | System Preferences: Security & Privacy | System Preferences | 1560 x 1370 | window |
| 152 | [10-15-Catalina-Light-System-Preferences-Sharing.png](screenshots/10-15-Catalina-Light-System-Preferences-Sharing.png) | System Preferences: Sharing | System Preferences | 1560 x 1284 | window |
| 153 | [10-15-Catalina-Light-System-Preferences-Sidecar.png](screenshots/10-15-Catalina-Light-System-Preferences-Sidecar.png) | System Preferences: Sidecar | System Preferences | 1560 x 932 | window |
| 154 | [10-15-Catalina-Light-System-Preferences-Siri.png](screenshots/10-15-Catalina-Light-System-Preferences-Siri.png) | System Preferences: Siri | System Preferences | 1560 x 888 | window |
| 155 | [10-15-Catalina-Light-System-Preferences-Software-Update.png](screenshots/10-15-Catalina-Light-System-Preferences-Software-Update.png) | System Preferences: Software Update | System Preferences | 1560 x 794 | window |
| 156 | [10-15-Catalina-Light-System-Preferences-Sound.png](screenshots/10-15-Catalina-Light-System-Preferences-Sound.png) | System Preferences: Sound | System Preferences | 1560 x 1222 | window |
| 157 | [10-15-Catalina-Light-System-Preferences-Spotlight.png](screenshots/10-15-Catalina-Light-System-Preferences-Spotlight.png) | System Preferences: Spotlight | System Preferences | 1560 x 1418 | window |
| 158 | [10-15-Catalina-Light-System-Preferences-Startup-Disk.png](screenshots/10-15-Catalina-Light-System-Preferences-Startup-Disk.png) | System Preferences: Startup Disk | System Preferences | 1560 x 1030 | window |
| 159 | [10-15-Catalina-Light-System-Preferences-Time-Machine.png](screenshots/10-15-Catalina-Light-System-Preferences-Time-Machine.png) | System Preferences: Time Machine | System Preferences | 1560 x 1104 | window |
| 160 | [10-15-Catalina-Light-System-Preferences-Touch-ID.png](screenshots/10-15-Catalina-Light-System-Preferences-Touch-ID.png) | System Preferences: Touch ID | System Preferences | 1560 x 900 | window |
| 161 | [10-15-Catalina-Light-System-Preferences-Trackpad.png](screenshots/10-15-Catalina-Light-System-Preferences-Trackpad.png) | System Preferences: Trackpad | System Preferences | 1560 x 1254 | window |
| 162 | [10-15-Catalina-Light-System-Preferences-Users-and-Groups.png](screenshots/10-15-Catalina-Light-System-Preferences-Users-and-Groups.png) | System Preferences: Users & Groups | System Preferences | 1560 x 1196 | window |
| 163 | [10-15-Catalina-Light-System-Preferences-Wallet-and-Apple-Pay.png](screenshots/10-15-Catalina-Light-System-Preferences-Wallet-and-Apple-Pay.png) | System Preferences: Wallet & Apple Pay | System Preferences | 1560 x 892 | window |

### Dark mode

| # | File | Caption | App / surface | Size (px) | Capture |
|---|---|---|---|---|---|
| 164 | [10-15-Catalina-Dark-Desktop.png](screenshots/10-15-Catalina-Dark-Desktop.png) | Desktop | Desktop | 3360 x 2100 | full-screen |
| 165 | [10-15-Catalina-Dark-About-This-Mac.png](screenshots/10-15-Catalina-Dark-About-This-Mac.png) | About This Mac | About This Mac | 3360 x 2100 | full-screen |
| 166 | [10-15-Catalina-Dark-System-Information.png](screenshots/10-15-Catalina-Dark-System-Information.png) | System Information | System Information | 1726 x 1264 | window |
| 167 | [10-15-Catalina-Dark-Stacks.png](screenshots/10-15-Catalina-Dark-Stacks.png) | Stacks | Dock | 3360 x 2100 | full-screen |
| 168 | [10-15-Catalina-Dark-Desktop-Stacks.png](screenshots/10-15-Catalina-Dark-Desktop-Stacks.png) | Desktop Stacks | Desktop | 3360 x 2100 | full-screen |
| 169 | [10-15-Catalina-Dark-Apple-Menu.png](screenshots/10-15-Catalina-Dark-Apple-Menu.png) | Apple Menu | Menu Bar | 3360 x 2100 | full-screen |
| 170 | [10-15-Catalina-Dark-Finder-Menu.png](screenshots/10-15-Catalina-Dark-Finder-Menu.png) | Finder Menu | Finder | 3360 x 2100 | full-screen |
| 171 | [10-15-Catalina-Dark-Finder-Go-Menu.png](screenshots/10-15-Catalina-Dark-Finder-Go-Menu.png) | Go Menu | Finder | 3360 x 2100 | full-screen |
| 172 | [10-15-Catalina-Dark-Finder-Go-to-Folder.png](screenshots/10-15-Catalina-Dark-Finder-Go-to-Folder.png) | Finder: Go to Folder | Finder | 1082 x 516 | window |
| 173 | [10-15-Catalina-Dark-Finder-Conect-to-Server.png](screenshots/10-15-Catalina-Dark-Finder-Conect-to-Server.png) | Finder: Connect to Server | Finder | 1196 x 686 | window |
| 174 | [10-15-Catalina-Dark-Finder-Network.png](screenshots/10-15-Catalina-Dark-Finder-Network.png) | Finder: Network | Finder | 2222 x 1642 | window |
| 175 | [10-15-Catalina-Dark-Finder-Home.png](screenshots/10-15-Catalina-Dark-Finder-Home.png) | Finder: Home | Finder | 2372 x 1568 | window |
| 176 | [10-15-Catalina-Dark-Finder-Gallery-View.png](screenshots/10-15-Catalina-Dark-Finder-Gallery-View.png) | Finder: Gallery View | Finder | 2768 x 1770 | window |
| 177 | [10-15-Catalina-Dark-Finder-Quick-Look.png](screenshots/10-15-Catalina-Dark-Finder-Quick-Look.png) | Finder: Quick Look | Finder | 3360 x 2100 | full-screen |
| 178 | [10-15-Catalina-Dark-Finder-Quick-Look-Markup.png](screenshots/10-15-Catalina-Dark-Finder-Quick-Look-Markup.png) | Finder: Quick Look Markup | Finder | 3360 x 2100 | full-screen |
| 179 | [10-15-Catalina-Dark-Finder-Get-Info.png](screenshots/10-15-Catalina-Dark-Finder-Get-Info.png) | Finder: Get Info | Finder | 754 x 1912 | window |
| 180 | [10-15-Catalina-Dark-Finder-Search.png](screenshots/10-15-Catalina-Dark-Finder-Search.png) | Finder: Search | Finder | 2136 x 1616 | window |
| 181 | [10-15-Catalina-Dark-Applications.png](screenshots/10-15-Catalina-Dark-Applications.png) | Applications | Finder | 2454 x 1692 | window |
| 182 | [10-15-Catalina-Dark-Applications-Utilities.png](screenshots/10-15-Catalina-Dark-Applications-Utilities.png) | Applications: Utilities | Finder | 2454 x 1692 | window |
| 183 | [10-15-Catalina-Dark-Menu-Bar-Battery.png](screenshots/10-15-Catalina-Dark-Menu-Bar-Battery.png) | Menu Bar: Battery | Menu Bar | 3360 x 2100 | full-screen |
| 184 | [10-15-Catalina-Dark-Command-Tab.png](screenshots/10-15-Catalina-Dark-Command-Tab.png) | App Switcher | App Switcher | 3360 x 2100 | full-screen |
| 185 | [10-15-Catalina-Dark-Force-Quit.png](screenshots/10-15-Catalina-Dark-Force-Quit.png) | Force Quit | Force Quit Applications | 900 x 838 | window |
| 186 | [10-15-Catalina-Dark-Finder-Copy.png](screenshots/10-15-Catalina-Dark-Finder-Copy.png) | Finder: Copy | Finder | 1022 x 362 | window |
| 187 | [10-15-Catalina-Dark-Finder-Copy-Replace.png](screenshots/10-15-Catalina-Dark-Finder-Copy-Replace.png) | Finder: Replace | Finder | 1022 x 424 | window |
| 188 | [10-15-Catalina-Dark-Finder-Empty-Trash.png](screenshots/10-15-Catalina-Dark-Finder-Empty-Trash.png) | Finder: Empty Trash | Finder | 1064 x 526 | window |
| 189 | [10-15-Catalina-Dark-Finder-Eject-Warning.png](screenshots/10-15-Catalina-Dark-Finder-Eject-Warning.png) | Finder: Eject Warning | Finder | 764 x 202 | window |
| 190 | [10-15-Catalina-Dark-Fast-User-Switching-Menu.png](screenshots/10-15-Catalina-Dark-Fast-User-Switching-Menu.png) | Fast User Switching | Menu Bar | 3360 x 2100 | full-screen |
| 191 | [10-15-Catalina-Dark-Fast-User-Switching.png](screenshots/10-15-Catalina-Dark-Fast-User-Switching.png) | Fast User Switching | Login Window | 3360 x 2100 | full-screen |
| 192 | [10-15-Catalina-Dark-Spotlight.png](screenshots/10-15-Catalina-Dark-Spotlight.png) | Spotlight | Spotlight | 1584 x 1084 | window |
| 193 | [10-15-Catalina-Dark-Spotlight-More.png](screenshots/10-15-Catalina-Dark-Spotlight-More.png) | Spotlight: More Results | Spotlight | 2136 x 1616 | window |
| 194 | [10-15-Catalina-Dark-Mission-Control.png](screenshots/10-15-Catalina-Dark-Mission-Control.png) | Mission Control | Mission Control | 3360 x 2100 | full-screen |
| 195 | [10-15-Catalina-Dark-Time-Machine-Menu.png](screenshots/10-15-Catalina-Dark-Time-Machine-Menu.png) | Menu Bar: Time Machine | Menu Bar | 3360 x 2100 | full-screen |
| 196 | [10-15-Catalina-Dark-Time-Machine.png](screenshots/10-15-Catalina-Dark-Time-Machine.png) | Time Machine | Time Machine | 3360 x 2100 | full-screen |
| 197 | [10-15-Catalina-Dark-Launchpad.png](screenshots/10-15-Catalina-Dark-Launchpad.png) | Launchpad | Launchpad | 3360 x 2100 | full-screen |
| 198 | [10-15-Catalina-Dark-Launchpad-Folder.png](screenshots/10-15-Catalina-Dark-Launchpad-Folder.png) | Launchpad: Folder | Launchpad | 3360 x 2100 | full-screen |
| 199 | [10-15-Catalina-Dark-Full-Screen-App.png](screenshots/10-15-Catalina-Dark-Full-Screen-App.png) | Fullscreen App | Full Screen Mode | 3360 x 2100 | full-screen |
| 200 | [10-15-Catalina-Dark-Split-Screen-Apps.png](screenshots/10-15-Catalina-Dark-Split-Screen-Apps.png) | Split Screen Apps | Split View | 3360 x 2100 | full-screen |
| 201 | [10-15-Catalina-Dark-Notification-Center-Today.png](screenshots/10-15-Catalina-Dark-Notification-Center-Today.png) | Notification Center: Today | Notification Center | 3360 x 2100 | full-screen |
| 202 | [10-15-Catalina-Dark-Notification-Center-Notifications.png](screenshots/10-15-Catalina-Dark-Notification-Center-Notifications.png) | Notification Center: Notifications | Notification Center | 3360 x 2100 | full-screen |
| 203 | [10-15-Catalina-Dark-Dictation.png](screenshots/10-15-Catalina-Dark-Dictation.png) | Dictation | Dictation | 1356 x 1020 | region |
| 204 | [10-15-Catalina-Dark-Siri.png](screenshots/10-15-Catalina-Dark-Siri.png) | Siri | Siri | 764 x 1374 | window |
| 205 | [10-15-Catalina-Dark-Stroage-Management.png](screenshots/10-15-Catalina-Dark-Stroage-Management.png) | Storage Management | Storage Management | 1826 x 1288 | window |
| 206 | [10-15-Catalina-Dark-Activity-Monitor.png](screenshots/10-15-Catalina-Dark-Activity-Monitor.png) | Activity Monitor | Activity Monitor | 1902 x 1492 | window |
| 207 | [10-15-Catalina-Dark-TextEdit.png](screenshots/10-15-Catalina-Dark-TextEdit.png) | TextEdit | TextEdit | 1418 x 1238 | window |
| 208 | [10-15-Catalina-Dark-Finder-Open.png](screenshots/10-15-Catalina-Dark-Finder-Open.png) | Open | Open Dialog | 2052 x 1454 | window |
| 209 | [10-15-Catalina-Dark-Finder-Open-iCloud.png](screenshots/10-15-Catalina-Dark-Finder-Open-iCloud.png) | Open: iCloud | Open Dialog | 2052 x 1454 | window |
| 210 | [10-15-Catalina-Dark-Print.png](screenshots/10-15-Catalina-Dark-Print.png) | Print | Print Dialog | 1633 x 1144 | region |
| 211 | [10-15-Catalina-Dark-AirPort-Utility.png](screenshots/10-15-Catalina-Dark-AirPort-Utility.png) | AirPort Utility | AirPort Utility | 1616 x 1288 | window |
| 212 | [10-15-Catalina-Dark-Automator.png](screenshots/10-15-Catalina-Dark-Automator.png) | Automator | Automator | 2224 x 1960 | window |
| 213 | [10-15-Catalina-Dark-Books.png](screenshots/10-15-Catalina-Dark-Books.png) | Books | Books | 3360 x 2100 | full-screen |
| 214 | [10-15-Catalina-Dark-Boot-Camp-Assistant.png](screenshots/10-15-Catalina-Dark-Boot-Camp-Assistant.png) | Boot Camp Assistant | Boot Camp Assistant | 1790 x 1320 | window |
| 215 | [10-15-Catalina-Dark-Calculator.png](screenshots/10-15-Catalina-Dark-Calculator.png) | Calculator | Calculator | 688 x 866 | window |
| 216 | [10-15-Catalina-Dark-Calendar.png](screenshots/10-15-Catalina-Dark-Calendar.png) | Calendar | Calendar | 2748 x 1472 | window |
| 217 | [10-15-Catalina-Dark-Calendar-Preferences.png](screenshots/10-15-Catalina-Dark-Calendar-Preferences.png) | Calendar: Preferences | Calendar | 1298 x 1308 | window |
| 218 | [10-15-Catalina-Dark-Chess.png](screenshots/10-15-Catalina-Dark-Chess.png) | Chess | Chess | 2166 x 1628 | window |
| 219 | [10-15-Catalina-Dark-Console.png](screenshots/10-15-Catalina-Dark-Console.png) | Console | Console | 2224 x 1224 | window |
| 220 | [10-15-Catalina-Dark-Contacts.png](screenshots/10-15-Catalina-Dark-Contacts.png) | Contacts | Contacts | 1976 x 1000 | region |
| 221 | [10-15-Catalina-Dark-Dictionary.png](screenshots/10-15-Catalina-Dark-Dictionary.png) | Dictionary | Dictionary | 1604 x 1524 | window |
| 222 | [10-15-Catalina-Dark-Disk-Utility.png](screenshots/10-15-Catalina-Dark-Disk-Utility.png) | Disk Utility | Disk Utility | 2076 x 1366 | window |
| 223 | [10-15-Catalina-Dark-FaceTime.png](screenshots/10-15-Catalina-Dark-FaceTime.png) | FaceTime | FaceTime | 1528 x 1394 | window |
| 224 | [10-15-Catalina-Dark-Find-My.png](screenshots/10-15-Catalina-Dark-Find-My.png) | Find My | Find My | 2408 x 1582 | window |
| 225 | [10-15-Catalina-Dark-Font-Book.png](screenshots/10-15-Catalina-Dark-Font-Book.png) | Font Book | Font Book | 2258 x 1430 | window |
| 226 | [10-15-Catalina-Dark-Help.png](screenshots/10-15-Catalina-Dark-Help.png) | Help | Help Viewer | 1846 x 1536 | window |
| 227 | [10-15-Catalina-Dark-Help-Search.png](screenshots/10-15-Catalina-Dark-Help-Search.png) | Help: Search | Help Viewer | 1846 x 1536 | window |
| 228 | [10-15-Catalina-Dark-Home.png](screenshots/10-15-Catalina-Dark-Home.png) | Home | Home | 2052 x 1760 | window |
| 229 | [10-15-Catalina-Dark-Keychain-Access.png](screenshots/10-15-Catalina-Dark-Keychain-Access.png) | Keychain Access | Keychain Access | 1978 x 1410 | window |
| 230 | [10-15-Catalina-Dark-Mac-App-Store.png](screenshots/10-15-Catalina-Dark-Mac-App-Store.png) | Mac App Store | App Store | 2716 x 1938 | window |
| 231 | [10-15-Catalina-Dark-Mail.png](screenshots/10-15-Catalina-Dark-Mail.png) | Mail | Mail | 2304 x 1528 | region |
| 232 | [10-15-Catalina-Dark-Mail-Preferences.png](screenshots/10-15-Catalina-Dark-Mail-Preferences.png) | Mail: Preferences | Mail | 1324 x 1306 | window |
| 233 | [10-15-Catalina-Dark-Maps.png](screenshots/10-15-Catalina-Dark-Maps.png) | Maps | Maps | 2224 x 1604 | window |
| 234 | [10-15-Catalina-Dark-Messages.png](screenshots/10-15-Catalina-Dark-Messages.png) | Messages | Messages | 2308 x 1202 | region |
| 235 | [10-15-Catalina-Dark-Music.png](screenshots/10-15-Catalina-Dark-Music.png) | Music | Music | 2664 x 1664 | window |
| 236 | [10-15-Catalina-Dark-Music-Preferences.png](screenshots/10-15-Catalina-Dark-Music-Preferences.png) | Music: Preferences | Music | 1290 x 808 | window |
| 237 | [10-15-Catalina-Dark-Network-Utility.png](screenshots/10-15-Catalina-Dark-Network-Utility.png) | Network Utility | Network Utility | 1512 x 994 | window |
| 238 | [10-15-Catalina-Dark-News.png](screenshots/10-15-Catalina-Dark-News.png) | News | News | 2738 x 1908 | window |
| 239 | [10-15-Catalina-Dark-Notes.png](screenshots/10-15-Catalina-Dark-Notes.png) | Notes | Notes | 2224 x 1556 | window |
| 240 | [10-15-Catalina-Dark-Photo-Booth.png](screenshots/10-15-Catalina-Dark-Photo-Booth.png) | Photo Booth | Photo Booth | 1664 x 1348 | window |
| 241 | [10-15-Catalina-Dark-Photos.png](screenshots/10-15-Catalina-Dark-Photos.png) | Photos | Photos | 2624 x 1664 | window |
| 242 | [10-15-Catalina-Dark-Podcasts.png](screenshots/10-15-Catalina-Dark-Podcasts.png) | Podcasts | Podcasts | 2498 x 1752 | window |
| 243 | [10-15-Catalina-Dark-Podcasts-Preferences.png](screenshots/10-15-Catalina-Dark-Podcasts-Preferences.png) | Podcasts: Preferences | Podcasts | 990 x 576 | window |
| 244 | [10-15-Catalina-Dark-Preview.png](screenshots/10-15-Catalina-Dark-Preview.png) | Preview | Preview | 2768 x 1880 | window |
| 245 | [10-15-Catalina-Dark-Preview-Search.png](screenshots/10-15-Catalina-Dark-Preview-Search.png) | Preview: Search | Preview | 2976 x 1868 | window |
| 246 | [10-15-Catalina-Dark-QuickTime.png](screenshots/10-15-Catalina-Dark-QuickTime.png) | QuickTime Player | QuickTime Player | 2916 x 1738 | window |
| 247 | [10-15-Catalina-Dark-Reminders.png](screenshots/10-15-Catalina-Dark-Reminders.png) | Reminders | Reminders | 2290 x 1472 | window |
| 248 | [10-15-Catalina-Dark-Script-Editor.png](screenshots/10-15-Catalina-Dark-Script-Editor.png) | Script Editor | Script Editor | 1624 x 1634 | window |
| 249 | [10-15-Catalina-Dark-Stickies.png](screenshots/10-15-Catalina-Dark-Stickies.png) | Stickies | Stickies | 3360 x 2100 | full-screen |
| 250 | [10-15-Catalina-Dark-Stocks.png](screenshots/10-15-Catalina-Dark-Stocks.png) | Stocks | Stocks | 2520 x 1830 | window |
| 251 | [10-15-Catalina-Dark-Safari-v13.png](screenshots/10-15-Catalina-Dark-Safari-v13.png) | Safari 13 | Safari | 2732 x 2030 | window |
| 252 | [10-15-Catalina-Dark-Safari-v13-Favorites.png](screenshots/10-15-Catalina-Dark-Safari-v13-Favorites.png) | Safari 13: Favorites | Safari | 2732 x 2030 | window |
| 253 | [10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png](screenshots/10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png) | Safari 13: Picture in Picture | Safari | 3360 x 2100 | full-screen |
| 254 | [10-15-Catalina-Dark-Safari-v13-Preferences.png](screenshots/10-15-Catalina-Dark-Safari-v13-Preferences.png) | Safari 13: Preferences | Safari | 1772 x 1240 | window |
| 255 | [10-15-Catalina-Dark-Safari-v13-Reader-Mode.png](screenshots/10-15-Catalina-Dark-Safari-v13-Reader-Mode.png) | Safari 13: Reader Mode | Safari | 2732 x 2030 | window |
| 256 | [10-15-Catalina-Dark-Safari-v13-Sharing.png](screenshots/10-15-Catalina-Dark-Safari-v13-Sharing.png) | Safari 13: Sharing | Safari | 2684 x 1847 | region |
| 257 | [10-15-Catalina-Dark-Safari-v13-Tab-Overview.png](screenshots/10-15-Catalina-Dark-Safari-v13-Tab-Overview.png) | Safari 13: Tab Overview | Safari | 2732 x 2030 | window |
| 258 | [10-15-Catalina-Dark-TV.png](screenshots/10-15-Catalina-Dark-TV.png) | TV | TV | 2812 x 1976 | window |
| 259 | [10-15-Catalina-Dark-TV-Preferences.png](screenshots/10-15-Catalina-Dark-TV-Preferences.png) | TV: Preferences | TV | 1504 x 944 | window |
| 260 | [10-15-Catalina-Dark-Voice-Memos.png](screenshots/10-15-Catalina-Dark-Voice-Memos.png) | Voice Memos | Voice Memos | 1802 x 1484 | window |
| 261 | [10-15-Catalina-Dark-System-Preferences-0.png](screenshots/10-15-Catalina-Dark-System-Preferences-0.png) | System Preferences | System Preferences | 1560 x 1332 | window |
| 262 | [10-15-Catalina-Dark-System-Preferences-Accessibility.png](screenshots/10-15-Catalina-Dark-System-Preferences-Accessibility.png) | System Preferences: Accessibility | System Preferences | 1560 x 1176 | window |
| 263 | [10-15-Catalina-Dark-System-Preferences-Apple-ID.png](screenshots/10-15-Catalina-Dark-System-Preferences-Apple-ID.png) | System Preferences: Apple ID | System Preferences | 1560 x 1420 | window |
| 264 | [10-15-Catalina-Dark-System-Preferences-Bluetooth.png](screenshots/10-15-Catalina-Dark-System-Preferences-Bluetooth.png) | System Preferences: Bluetooth | System Preferences | 1560 x 1088 | window |
| 265 | [10-15-Catalina-Dark-System-Preferences-Date-and-Time.png](screenshots/10-15-Catalina-Dark-System-Preferences-Date-and-Time.png) | System Preferences: Date & Time | System Preferences | 1560 x 1280 | window |
| 266 | [10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png](screenshots/10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png) | System Preferences: Desktop & Screen Saver | System Preferences | 1560 x 1348 | window |
| 267 | [10-15-Catalina-Dark-System-Preferences-Displays.png](screenshots/10-15-Catalina-Dark-System-Preferences-Displays.png) | System Preferences: Displays | System Preferences | 1560 x 1246 | window |
| 268 | [10-15-Catalina-Dark-System-Preferences-Dock.png](screenshots/10-15-Catalina-Dark-System-Preferences-Dock.png) | System Preferences: Dock | System Preferences | 1560 x 1026 | window |
| 269 | [10-15-Catalina-Dark-System-Preferences-Energy-Saver.png](screenshots/10-15-Catalina-Dark-System-Preferences-Energy-Saver.png) | System Preferences: Energy Saver | System Preferences | 1560 x 1234 | window |
| 270 | [10-15-Catalina-Dark-System-Preferences-Extensions.png](screenshots/10-15-Catalina-Dark-System-Preferences-Extensions.png) | System Preferences: Extensions | System Preferences | 1560 x 1240 | window |
| 271 | [10-15-Catalina-Dark-System-Preferences-Family-Sharing.png](screenshots/10-15-Catalina-Dark-System-Preferences-Family-Sharing.png) | System Preferences: Family Sharing | System Preferences | 1560 x 880 | window |
| 272 | [10-15-Catalina-Dark-System-Preferences-General.png](screenshots/10-15-Catalina-Dark-System-Preferences-General.png) | System Preferences: General | System Preferences | 1560 x 1580 | window |
| 273 | [10-15-Catalina-Dark-System-Preferences-Internet-Accounts.png](screenshots/10-15-Catalina-Dark-System-Preferences-Internet-Accounts.png) | System Preferences: Internet Accounts | System Preferences | 1560 x 1196 | window |
| 274 | [10-15-Catalina-Dark-System-Preferences-Keyboard.png](screenshots/10-15-Catalina-Dark-System-Preferences-Keyboard.png) | System Preferences: Keyboard | System Preferences | 1560 x 1386 | window |
| 275 | [10-15-Catalina-Dark-System-Preferences-Language-and-Region.png](screenshots/10-15-Catalina-Dark-System-Preferences-Language-and-Region.png) | System Preferences: Language & Region | System Preferences | 1560 x 1258 | window |
| 276 | [10-15-Catalina-Dark-System-Preferences-Mission-Control.png](screenshots/10-15-Catalina-Dark-System-Preferences-Mission-Control.png) | System Preferences: Mission Control | System Preferences | 1560 x 1184 | window |
| 277 | [10-15-Catalina-Dark-System-Preferences-Mouse.png](screenshots/10-15-Catalina-Dark-System-Preferences-Mouse.png) | System Preferences: Mouse | System Preferences | 1560 x 1248 | window |
| 278 | [10-15-Catalina-Dark-System-Preferences-Network.png](screenshots/10-15-Catalina-Dark-System-Preferences-Network.png) | System Preferences: Network | System Preferences | 1560 x 1350 | window |
| 279 | [10-15-Catalina-Dark-System-Preferences-Notifications.png](screenshots/10-15-Catalina-Dark-System-Preferences-Notifications.png) | System Preferences: Notifications | System Preferences | 1560 x 1280 | window |
| 280 | [10-15-Catalina-Dark-System-Preferences-Printers-and-Scanners.png](screenshots/10-15-Catalina-Dark-System-Preferences-Printers-and-Scanners.png) | System Preferences: Printers & Scanners | System Preferences | 1560 x 1100 | window |
| 281 | [10-15-Catalina-Dark-System-Preferences-Screen-Time.png](screenshots/10-15-Catalina-Dark-System-Preferences-Screen-Time.png) | System Preferences: Screen Time | System Preferences | 1560 x 1450 | window |
| 282 | [10-15-Catalina-Dark-System-Preferences-Security-and-Privacy.png](screenshots/10-15-Catalina-Dark-System-Preferences-Security-and-Privacy.png) | System Preferences: Security & Privacy | System Preferences | 1560 x 1370 | window |
| 283 | [10-15-Catalina-Dark-System-Preferences-Sharing.png](screenshots/10-15-Catalina-Dark-System-Preferences-Sharing.png) | System Preferences: Sharing | System Preferences | 1560 x 1284 | window |
| 284 | [10-15-Catalina-Dark-System-Preferences-Sidecar.png](screenshots/10-15-Catalina-Dark-System-Preferences-Sidecar.png) | System Preferences: Sidecar | System Preferences | 1560 x 932 | window |
| 285 | [10-15-Catalina-Dark-System-Preferences-Siri.png](screenshots/10-15-Catalina-Dark-System-Preferences-Siri.png) | System Preferences: Siri | System Preferences | 1560 x 888 | window |
| 286 | [10-15-Catalina-Dark-System-Preferences-Software-Update.png](screenshots/10-15-Catalina-Dark-System-Preferences-Software-Update.png) | System Preferences: Software Update | System Preferences | 1560 x 794 | window |
| 287 | [10-15-Catalina-Dark-System-Preferences-Sound.png](screenshots/10-15-Catalina-Dark-System-Preferences-Sound.png) | System Preferences: Sound | System Preferences | 1560 x 1222 | window |
| 288 | [10-15-Catalina-Dark-System-Preferences-Spotlight.png](screenshots/10-15-Catalina-Dark-System-Preferences-Spotlight.png) | System Preferences: Spotlight | System Preferences | 1560 x 1418 | window |
| 289 | [10-15-Catalina-Dark-System-Preferences-Startup-Disk.png](screenshots/10-15-Catalina-Dark-System-Preferences-Startup-Disk.png) | System Preferences: Startup Disk | System Preferences | 1560 x 1030 | window |
| 290 | [10-15-Catalina-Dark-System-Preferences-Time-Machine.png](screenshots/10-15-Catalina-Dark-System-Preferences-Time-Machine.png) | System Preferences: Time Machine | System Preferences | 1560 x 1104 | window |
| 291 | [10-15-Catalina-Dark-System-Preferences-Touch-ID.png](screenshots/10-15-Catalina-Dark-System-Preferences-Touch-ID.png) | System Preferences: Touch ID | System Preferences | 1560 x 900 | window |
| 292 | [10-15-Catalina-Dark-System-Preferences-Trackpad.png](screenshots/10-15-Catalina-Dark-System-Preferences-Trackpad.png) | System Preferences: Trackpad | System Preferences | 1560 x 1254 | window |
| 293 | [10-15-Catalina-Dark-System-Preferences-Users-and-Groups.png](screenshots/10-15-Catalina-Dark-System-Preferences-Users-and-Groups.png) | System Preferences: Users & Groups | System Preferences | 1560 x 1196 | window |
| 294 | [10-15-Catalina-Dark-System-Preferences-Wallet-and-Apple-Pay.png](screenshots/10-15-Catalina-Dark-System-Preferences-Wallet-and-Apple-Pay.png) | System Preferences: Wallet & Apple Pay | System Preferences | 1560 x 892 | window |

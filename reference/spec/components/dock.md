# Dock (`dock`)

- **Status:** present
- **AppKit:** Dock.app (not an AppKit view); apps interact through `NSDockTile`
- **HIG:** https://web.archive.org/web/20200503160803/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/dock/
- **Appearances shown:** light, dark (bottom position, default size, no magnification)

## Purpose and behaviour
The Dock gives access to frequently used apps, documents, folders and minimised windows; it can sit at the bottom, left or right, and its size and magnification are user settings (HIG, Dock) [D]. Apps are on the left of a separator, with a second "recent applications" section when enabled; stacks, minimised windows and the Trash are on the right. A dot under an icon marks a running app. Clicking an app launches or activates it (the icon bounces while launching [D]).

## Anatomy
```
   ___________________________________________________________________________
  /  [F][L][S][M] ... [App Store][Sys Prefs] | [recent] | [Downloads][Trash]  \   80 pt shelf
  |   .                                 .                                     |   4 pt running dots
==+===========================================================================+== screen bottom
```
Back to front: translucent shelf (top corners rounded, flush with the screen bottom), 1 pt inner border (dark only visible), icons on a 68 pt pitch, separators (1 pt line), running-indicator dots.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| position | bottom, left, right | bottom | Dock preference `orientation` | bottom |
| tile size | 16-128 pt | 64 pt on this machine | `tilesize` | 64 |
| magnification | off / on (16-128) | off | `magnification` | off |
| recent applications section | on/off | on | `show-recents` | shown with one recent app in 10-15-Catalina-Light-Mission-Control.png |
| appearance | light, dark | - | - | both |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| resting | yes | 10-15-Catalina-Light-Desktop.png @ 282,1940,2796,160; 10-15-Catalina-Dark-Desktop.png @ 281,1939,2798,161 |
| app running (dot) | yes | Finder: 10-15-Catalina-Dark-Desktop.png @ 352,2086,12,12; Terminal and System Preferences: 10-15-Catalina-Dark-Command-Tab.png @ 2598,2088,8,8 and 2734,2088,8,8 |
| extra running app appended | yes | Terminal: 10-15-Catalina-Dark-Command-Tab.png @ 2682,1967,112,97; Automator: 10-15-Catalina-Dark-Time-Machine-Menu.png @ 2670,1950,140,130 |
| recent-apps section (two separators) | yes | 10-15-Catalina-Light-Mission-Control.png @ 2660,1950,220,140 (Calculator between separators at x=2670 and 2866) |
| Trash empty / full | yes | empty: 10-15-Catalina-Light-Desktop.png @ 2956,1960,92,113; full: 10-15-Catalina-Dark-Apple-Menu.png @ 2940,1950,120,130 |
| stack open | yes | see `dock-stack` |
| hover label (tooltip above icon) | no | [I] dark rounded label with a pointer, 13 pt text, centred above the icon |
| magnified | no | [D] icons scale up to the magnification size under the pointer |
| launching (bounce), drag-reorder, hidden (auto-hide) | no | [D] HIG |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Shelf height | 80 (px y=1940..2099) | [M] | 10-15-Catalina-Light-Desktop.png @ 300,1940,1,160; 10-15-Catalina-Dark-Desktop.png @ 300,1940,1,160 |
| Gap to screen bottom | 0 (shelf runs to the last row; bottom corners square) | [M] | 10-15-Catalina-Light-Desktop.png @ 300,2070,1,30 (`#456585 (sRGB #3c6588)` to y=2099) |
| Shelf width, 20 tiles + 1 separator | 1398 (px 282..3077) | [M] | 10-15-Catalina-Dark-Desktop.png @ 250,2060,60,1 and 3040,2060,70,1 |
| Shelf width, 21 tiles + 1 separator | 1466 (px 214..3145) | [M] | 10-15-Catalina-Dark-Command-Tab.png @ 216,2096,2928,1 (fill 216..3143 plus 2 px border each side) |
| Width rule | 68 x tiles + 30 x separators + 8 (4 pt padding at each end); centred on the screen | [C] | 20x68+30+8 = 1398; 21x68+30+8 = 1466 |
| Top corner radius | 5 | [M] | 10-15-Catalina-Light-Desktop.png @ 279,1937,14,12; 10-15-Catalina-Dark-Desktop.png @ 279,1937,14,12 |
| Tile pitch | 68 (icon centres px 357.5, 493.5, 629.5 ...) | [M] | 10-15-Catalina-Dark-Desktop.png @ 306,1960,380,112 (Finder 306..409, Launchpad 438..549, Safari 574..685) |
| Icon size | 64 pt tile; round icons have 56 pt of ink (px 438..549 x 1960..2071) | [M] ink, [D] tile | 10-15-Catalina-Dark-Desktop.png @ 438,1960,112,112 |
| Icon vertical position | tile centre 37.75 pt below the shelf top (ink centre y=2015.5 px); tile spans about y=1951.5..2079.5 px | [M]/[C] | same |
| First / last icon centre | 37.75 pt from the shelf's outer left / right edge (357.5-282 = 75.5 px; 3078-3001.5 = 76.5 px) | [M] | 10-15-Catalina-Dark-Desktop.png @ 306,1967,104,98; 2956,1960,92,113 |
| Separator slot | 30 pt wide slot; line 1 pt wide (px 2768..2769), 60 pt tall (y=1960..2079), centred in the slot | [M] | 10-15-Catalina-Dark-Desktop.png @ 2760,2000,18,1; 2768,1955,1,130 |
| Running indicator | circle 4 pt diameter (px 354..361 x 2088..2095), centred under the icon, centre 4 pt above the screen bottom | [M] | 10-15-Catalina-Dark-Desktop.png @ 352,2086,12,12; 10-15-Catalina-Light-Desktop.png @ 352,2086,12,12 |

### Colours and fills
Shelf fill composites (mean of 8x6 px at y=1945) against the wallpaper above the Dock (mean of the 80x90 px ending 10 px above the shelf):

| Screenshot | Shelf fill | Wallpaper above | Tag | Evidence |
|---|---|---|---|---|
| Light, Day picture | `#456689 (sRGB #3c668c)` (x=300), `#44617d (sRGB #3c6180)` (1500), `#4f6984 (sRGB #496987)` (2700) | `#0e2a46 (sRGB #032a48)`, `#091f34 (sRGB #021f36)`, `#1a3147 (sRGB #133149)` | [M] | 10-15-Catalina-Light-Desktop.png @ 300,1945,8,6; 1500,1945,8,6; 2700,1945,8,6 |
| Light, Morning picture | `#65656f (sRGB #656570)` (300), `#545f6b (sRGB #525f6c)` (1900) | `#2c2b33 (sRGB #2c2b34)`, `#151e28 (sRGB #131e29)` | [M] | 10-15-Catalina-Theme-Morning-Blue.png @ 300,1945,8,6; 1900,1945,8,6 |
| Light, Evening picture | `#515567 (sRGB #505569)` (300), `#6e6264 (sRGB #706164)` (3040) | `#0f1221 (sRGB #0e1222)`, `#332628 (sRGB #352528)` | [M] | 10-15-Catalina-Theme-Evening-Blue.png @ 300,1945,8,6; 3040,1945,8,6 |
| Light, Launchpad open | `#456587 (sRGB #3c658a)` (300) | `#0b2642 (sRGB #012644)` (blurred) | [M] | 10-15-Catalina-Light-Launchpad.png @ 300,1945,8,6 |
| Dark, Dark picture | `#132030 (sRGB #102031)` (300), `#152137 (sRGB #122139)` (700..1500), `#132234 (sRGB #0f2236)` (3040) | `#0c1525 (sRGB #0a1526)`, `#0e192d (sRGB #0b192f)`, `#0e192a (sRGB #0b192b)` | [M] | 10-15-Catalina-Dark-Desktop.png @ 300,1945,8,6; 700,1945,8,6; 3040,1945,8,6 |
| Dark, Launchpad open | `#182234 (sRGB #162236)` (300), `#17253a (sRGB #13253c)` (1100) | `#101929 (sRGB #0e192a)`, `#111c2e (sRGB #0e1c30)` | [M] | 10-15-Catalina-Dark-Launchpad.png @ 300,1945,8,6; 1100,1945,8,6 |

| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Material recipe | `backdrop-filter: blur(20px) saturate(1.7)` + `rgba(255,255,255,0.27)` | `backdrop-filter: blur(20px) saturate(1.7)` + `rgba(60,60,60,0.25)` | [C] light (fit of the six light pairs: composite = 0.73 x backdrop + 69); [I] dark (the dark backdrops are too uniform to separate tint from alpha: composite is the backdrop + about 7 levels) | pairs above |
| Opaque fallback | `#456689 (sRGB #3c668c)` over the default picture; `#8e8e93` at 0.5 on a neutral page [I] | `#152137 (sRGB #122139)` over the default picture; `#262626` neutral [I] | [M] first value | rows above |
| Inner border (top and sides) | not distinguishable (edge pixel `#436281 (sRGB #3b6284)`, same as the fill) | 1 pt, `#36414f (sRGB #344150)` on fill `#132030 (sRGB #102031)` = `rgba(255,255,255,0.15)` | [M] composite, [C] alpha | 10-15-Catalina-Light-Desktop.png @ 1300,1940; 10-15-Catalina-Dark-Desktop.png @ 300,1940,1,2 |
| Outer hairline | none visible | 0.5 pt, `#060a0f (sRGB #050a0f)` at y=1939 (about `rgba(0,0,0,0.5)`) | [M] | 10-15-Catalina-Dark-Desktop.png @ 1300,1939 |
| Separator line | `#162d47 (sRGB #0f2d49)` on fill `#4f6680 (sRGB #496683)` (dark, vibrant; about `rgba(0,0,0,0.6)`) | `#546375 (sRGB #516377)` on fill `#132234 (sRGB #0f2236)` = `rgba(255,255,255,0.28)` | [M] composite, [C] alpha | 10-15-Catalina-Light-Desktop.png @ 2768,2000; 10-15-Catalina-Dark-Desktop.png @ 2768,2000 |
| Running indicator | `#000007 (sRGB #000008)` (black) on `#456485 (sRGB #3d6488)` | `#909bab (sRGB #8e9bad)` on `#141f2f (sRGB #111f30)` = `rgba(255,255,255,0.52)` | [M] composite, [C] alpha | 10-15-Catalina-Light-Desktop.png @ 357,2091; 10-15-Catalina-Dark-Desktop.png @ 357,2091 |

### Text and icons
No text at rest. Icon order on the reference machine (left to right, centres every 136 px from x=357.5) [M] 10-15-Catalina-Dark-Desktop.png @ 284,1950,2792,130: Finder, Launchpad, Safari, Mail, FaceTime, Messages, Maps, Photos, Contacts, Calendar (shows "OCT" and the day number), Reminders, Notes, Music, Podcasts, TV, News, App Store, System Preferences, separator, Downloads stack, Trash.

### Shadows and effects
No drop shadow on the shelf was measurable (wallpaper at y=1934..1938 is unchanged: 10-15-Catalina-Light-Desktop.png @ 1300,1934,1,6) [M]. Icons carry their own baked-in shadows.

## Layout and spacing
- Shelf centred horizontally; width from the rule above; height = tile + 16 pt.
- Running apps that are not kept in the Dock are appended after the last kept app, before the separator (Terminal, Automator) [M].
- With "Show recent applications" a second separator encloses up to three recent apps [M] 10-15-Catalina-Light-Mission-Control.png @ 2660,1950,220,140.
- A window may extend under the Dock; the Dock stays in front (Notification Center slides over the Dock's right end: 10-15-Catalina-Light-Notification-Center-Today.png @ 2600,1940,200,160) [M].

## Keyboard and accessibility
Control-F3 moves focus to the Dock; Left/Right move between items, Return opens, Up opens the item's menu, Command-Option-D toggles hiding [D] (macOS keyboard shortcuts). AX: `AXList` of `AXDockItem`. ARIA: `role="toolbar"` with `aria-label="Dock"`, each icon a `button` with `aria-label` and, when running, a visually hidden "running" state.

## Browser notes
- Use `backdrop-filter`; the vibrant dark separator in light mode is approximated with `rgba(0,0,0,0.6)`.
- App icons are artwork assets (1024 px PNGs); they are not reproducible in CSS.
- Magnification needs script-driven scaling of neighbours (cosine falloff over about 2.5 tiles [I]).

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Desktop.png | 260,1920,2840,180 | whole Dock |
| dark | 10-15-Catalina-Dark-Desktop.png | 260,1920,2840,180 | whole Dock, borders visible |
| dark | 10-15-Catalina-Dark-Command-Tab.png | 196,1920,2968,180 | 21 tiles, three running dots |
| light | 10-15-Catalina-Light-Mission-Control.png | 1500,1920,1860,180 | recent-apps section: 21 tiles + 2 separators (1498 pt by the width rule) |
| light | 10-15-Catalina-Theme-Morning-Blue.png | 260,1920,2840,180 | Dock over the Morning picture |

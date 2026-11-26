# Launchpad (`launchpad`)

- **Status:** present
- **AppKit:** Launchpad (part of Dock.app)
- **HIG:** https://web.archive.org/web/20200503160803/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/dock/
- **Appearances shown:** light, dark (the overlay itself is identical; only the wallpaper and Dock differ)

## Purpose and behaviour
Launchpad shows every installed app as a full-screen grid of icons over a blurred, dimmed desktop. It opens from its Dock icon, F4 or a pinch; clicking an app launches it and closes Launchpad; clicking the background or pressing Esc closes it. Pages are swiped horizontally; a search field at the top filters; dragging one icon onto another makes a folder (see `launchpad-folder`) [D].

## Anatomy
1. Blurred + dimmed desktop picture (the menu bar is hidden; the Dock stays).
2. Search field, top centre.
3. 7 x 5 grid of 112 pt icons with labels.
4. Page indicator dots above the Dock.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| grid | columns x rows chosen by screen size | 7 x 5 at 1680 x 1050 | `springboard-columns/rows` defaults | 7 x 5 |
| pages | 1..n | - | - | 2 (page 1 current) |
| item | app, folder | app | - | 34 apps + 1 folder ("Other") |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| grid, page 1 | yes | 10-15-Catalina-Light-Launchpad.png; 10-15-Catalina-Dark-Launchpad.png |
| folder open | yes | see `launchpad-folder` |
| searching | no | [I] field focused with white text; grid shows matches only, first match highlighted |
| icon pressed | no | [I] icon darkened by 50 % black overlay mask |
| jiggle / delete mode | no | [D] icons wiggle; App Store apps show an x badge |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Grid | 7 columns x 5 rows | [M] | 10-15-Catalina-Light-Launchpad.png @ 300,387,2800,1352 (label rows y=387, 719, 1051, 1383, 1715; 7 label clusters per row) |
| Column pitch | 195 (label centres px 508, 898.5, 1288.5, 1677, 2068.5, 2459, 2848) | [M] | 10-15-Catalina-Light-Launchpad.png @ 448,387,2435,24 |
| First / last column centre | 254 pt from the left edge / 256 pt from the right edge | [M] | same |
| Row pitch | 166 (label tops 332 px apart) | [M] | 10-15-Catalina-Light-Launchpad.png @ 448,387,121,1352 |
| Icon size | 112 pt tile; round icons have 97 pt of ink (TV: px 1191..1384 x 831..1027) | [M] ink, [C] tile (97 / 0.875) | 10-15-Catalina-Light-Launchpad.png @ 1191,831,194,197 |
| First row icon centre | about 131.5 pt from the top (App Store disc centre y=263 px) | [M] | 10-15-Catalina-Light-Launchpad.png @ 411,166,194,194 |
| Label position | cap top 5 pt below the tile bottom (TV: tile bottom y about 1041, cap top 1051); centred under the icon | [M]/[C] | 10-15-Catalina-Light-Launchpad.png @ 1266,1051,46,19 |
| Search field | 250 x 25 (px 1430..1929 x 50..99), centred, top 25 pt from the screen top | [M] | 10-15-Catalina-Light-Launchpad.png @ 1415,74,530,1; 1500,30,1,85 |
| Search field border | 1 pt (2 px rows 50..51, 98..99) | [M] | 10-15-Catalina-Light-Launchpad.png @ 1500,50,1,50 |
| Search glyph + placeholder | magnifier 11 pt (px 1612..1633), "Search" from px 1654; the pair is centred in the field | [M] | 10-15-Catalina-Light-Launchpad.png @ 1612,62,22,23; 1654,61,96,24 |
| Page dots | 8 pt diameter (px 1650..1665, 1690..1705; y=1828..1843), 20 pt pitch, centred; centre 52 pt above the Dock top | [M] | 10-15-Catalina-Light-Launchpad.png @ 1630,1836,90,1; 1657,1822,1,28 |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Background, observed | `#0c1e18 (sRGB #051f18)`..`#7587a6 (sRGB #7187a9)` (mean `#3f4f5b (sRGB #3b4f5c)`): `#4373a4 (sRGB #3473a8)` top-left, `#504530 (sRGB #52452d)` centre, `#0e2b4a (sRGB #022b4d)` bottom-left | `#0a1921 (sRGB #061922)`..`#3a5375 (sRGB #345378)` (mean `#1b2941 (sRGB #182943)`) | [M] | 10-15-Catalina-Light-Launchpad.png @ 60,60,20,20; 1680,1000,20,20; 200,1700,20,20; 10-15-Catalina-Dark-Launchpad.png same points |
| Background recipe | the desktop picture with `filter: blur(35px) saturate(1.8)` under `rgba(28,28,28,0.44)` | same | [C] | least-squares fit of 560 background pixels against 10-15-Catalina-Light-Desktop.png / -Dark-Desktop.png: best sigma 60-90 px (30-45 pt), saturation 1.8, alpha 0.44, tint `#1c1c1c`, rms 3.2 / 3.4 levels |
| Search field fill | `#4877a5 (sRGB #3977a9)` on background `#3b6ca0 (sRGB #2a6ca5)` (about `rgba(255,255,255,0.07)`) | `#21375b (sRGB #1b375e)` on `#132b50 (sRGB #0b2b53)` | [M] composite, [C] alpha | 10-15-Catalina-Light-Launchpad.png @ 1500,53,1,44; 10-15-Catalina-Dark-Launchpad.png @ 1500,53,1,44 |
| Search field border | `#638bb3 (sRGB #588bb7)` (about `rgba(255,255,255,0.2)`) | `#425573 (sRGB #3e5576)` | [M] composite, [C] alpha | 10-15-Catalina-Light-Launchpad.png @ 1500,50,1,2; 10-15-Catalina-Dark-Launchpad.png @ 1500,50,1,2 |
| Search placeholder | `#8ba8c5 (sRGB #84a8c8)` (about `rgba(255,255,255,0.4)`) | `#707f95 (sRGB #6d7f97)` | [M] | 10-15-Catalina-Light-Launchpad.png @ 1654,61,96,24; dark same |
| Search glyph | `#ffffff` | `#ffffff` | [M] | 10-15-Catalina-Light-Launchpad.png @ 1612,62,22,23 |
| Label text | `#ffffff` | `#ffffff` | [M] | 10-15-Catalina-Light-Launchpad.png @ 448,387,121,24 |
| Page dot, current | `#ffffff` (edge rows `#fbfbfc`) | `#ffffff` | [M] | 10-15-Catalina-Light-Launchpad.png @ 1657,1836; 10-15-Catalina-Dark-Launchpad.png @ 1657,1836 |
| Page dot, other | `#49545f (sRGB #475460)` on `#1e2b39 (sRGB #1b2b3a)` (about `rgba(255,255,255,0.2)`) | `#414955 (sRGB #3f4956)` on `#121c2b (sRGB #101c2c)` | [M] composite, [C] alpha | 10-15-Catalina-Light-Launchpad.png @ 1697,1836; 10-15-Catalina-Dark-Launchpad.png @ 1697,1836 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Label font | SF Pro Text 13 pt Regular/Medium, white, soft shadow ("App Store" 24 px with descender; "Preview" 19 px) | same | [C] | 10-15-Catalina-Light-Launchpad.png @ 448,387,121,24; 2418,719,83,19 |
| Label shadow | fitted `0 1px 2.5px rgba(0,0,0,0.20)`; observed halo below T: `#1b262e (sRGB #18262f)` at y=1070, `#1b272f (sRGB #182730)` at 1072, `#1c2832 (sRGB #192833)` at 1074 | fitted `0 1px 2px rgba(0,0,0,0.20)`; `#1a1f2c (sRGB #191f2d)`, `#19202e (sRGB #18202f)`, `#1a2130 (sRGB #192131)` at the same rows | [M] composites; [C] CSS fit | 10-15-Catalina-Light-Launchpad.png @ 1256,1044,70,40; 10-15-Catalina-Dark-Launchpad.png @ 1256,1044,70,40. Fit Gaussian shadow to background-only pixels, mask from white ink, per-row backdrop interpolated from three pixels at each crop edge; RMS 0.335 / 0.326 stored levels. CSS blur = 2 sigma; this composite fit is not a unique native shadow recipe |
| Search placeholder font | about 15-16 pt Regular ("Search" 24 px including the h ascender) | same | [C] | 10-15-Catalina-Light-Launchpad.png @ 1654,61,96,24 |

Grid contents, page 1 (row by row) [M] 10-15-Catalina-Light-Launchpad.png: App Store, Safari, Mail, Contacts, Calendar, Reminders, Notes / FaceTime, Messages, Maps, Find My, Photo Booth, Photos, Preview / Music, Podcasts, TV, Voice Memos, News, Stocks, Books / Dictionary, Calculator, Home, Siri, Mission Control, System Preferences, Other (folder) / QuickTime Player, TextEdit, Time Machine, Font Book, Chess, Stickies, Image Capture.

### Shadows and effects
Icons carry their artwork shadows. The folder tile "Other" is a rounded square of the folder material with a 3 x 3 grid of mini icons (see `launchpad-folder`).

## Layout and spacing
The grid is centred; margins follow from the pitches (first column centre at 254 pt). The Dock remains visible and usable; the menu bar is hidden.

## Keyboard and accessibility
Type to search; arrows move the selection; Return launches; Command-Left/Right change page; Esc closes [D]. ARIA: `dialog` (modal) containing a `searchbox` and a `grid` of buttons.

## Browser notes
Apply the blur to a copy of the wallpaper (`filter`) or use `backdrop-filter: blur(35px) saturate(1.8)` on a full-screen layer tinted `rgba(28,28,28,0.44)`. App icons are assets.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Launchpad.png | 0,0,3360,2100 | page 1 over the blurred Day picture |
| dark | 10-15-Catalina-Dark-Launchpad.png | 0,0,3360,2100 | page 1 over the blurred Night picture |

# Launchpad folder (`launchpad-folder`)

- **Status:** present
- **AppKit:** Launchpad (Dock.app)
- **HIG:** https://web.archive.org/web/20200503160803/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/dock/
- **Appearances shown:** light, dark (identical panel; only the backdrop differs)

## Purpose and behaviour
A Launchpad folder groups apps. Closed, it is a tile showing up to nine mini icons. Clicking it zooms it open into a wide panel with the folder name above; the rest of the grid, the search field, the page dots and the Dock disappear and the background blurs further. Clicking the name renames the folder; clicking outside closes it [D].

## Anatomy
- Closed tile: rounded square, 3 x 3 mini icons, label below (in the main grid).
- Open: title (folder name) centred above a large rounded panel; inside, the same 7-column grid as Launchpad.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| state | closed, open | closed | - | both |
| rows when open | 1..5 (panel height follows) | - | - | 3 rows (17 apps) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| closed tile | yes | 10-15-Catalina-Light-Launchpad.png @ 2740,1148,216,216; 10-15-Catalina-Dark-Launchpad.png @ 2740,1148,216,216 |
| open | yes | 10-15-Catalina-Light-Launchpad-Folder.png @ 274,340,2812,1270; 10-15-Catalina-Dark-Launchpad-Folder.png @ 274,340,2812,1270 |
| renaming | no | [I] title becomes an editable field with a light rounded background |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Open panel | 1406 x 573 for three rows (px 274..3085 x 462..1607); 137 pt side margins | [M] | 10-15-Catalina-Dark-Launchpad-Folder.png @ 262,1300,28,1; 3070,1300,30,1; 1000,440,1,40; 1000,1590,1,30 |
| Panel corner radius | about 30 (the straight top edge begins about 60 px in from the corner) | [M] | 10-15-Catalina-Dark-Launchpad-Folder.png @ 270,463,70,1; 276,455,1,65 |
| Panel height rule | 573 for 3 rows; rows are 166 pt apart, so about 573 + 166 per extra row | [C] | row pitch below |
| Title | centred (ink px 1613..1743), baseline about 22 pt above the panel top (ink rows 377..417, panel top 462) | [M] | 10-15-Catalina-Light-Launchpad-Folder.png @ 1613,377,131,41 |
| Grid inside | same 7 columns as Launchpad (label centres px 507.5, 898.5, 1288, 1679, 2067.5, 2457.5, 2847); row pitch 166 (label tops y=799, 1131, 1463) | [M] | 10-15-Catalina-Light-Launchpad-Folder.png @ 300,799,2800,688 |
| First row label | cap top 168.5 pt below the panel top (y=799 against 462) | [M] | same |
| Closed tile | 108 x 108 (x=2740..2955, y=1148..1363), radius 18 (36 px to full straight edge); 3 x 3 miniatures on 30 pt slot pitch. Artwork varies: ColorSync 23.5 x 24.5, Terminal 23 x 20 including soft edge | [M] sizes/radius; [C] pitch | 10-15-Catalina-Light-Launchpad.png @ 2735,1200,226,1; 10-15-Catalina-Light-Launchpad.png @ 2740,1148,37,37 (corner grid); 10-15-Catalina-Light-Launchpad.png @ 2850,1170,1,111 (tops y=1177,1237); 10-15-Catalina-Light-Launchpad.png @ 2764,1170,55,57; 10-15-Catalina-Light-Launchpad.png @ 2824,1233,54,48 (artwork differs by >15 stored channel levels from each row's left backdrop) |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Panel fill, observed | `#858b88 (sRGB #848b88)`..`#b6bcc9 (sRGB #b5bcca)` (mean `#9d9e9d`): `#aebfce (sRGB #aabfd0)` top-left, `#a29f97 (sRGB #a39f96)` centre | `#85898c (sRGB #84898c)`..`#93a0b0 (sRGB #90a0b2)` (mean `#8a8f98 (sRGB #898f99)`) | [M] | 10-15-Catalina-Light-Launchpad-Folder.png @ 300,480,16,16; 1680,900,16,16; 10-15-Catalina-Dark-Launchpad-Folder.png same points |
| Panel recipe | `backdrop-filter: blur(30px) saturate(1.8)` + `rgba(180,180,180,0.72)` | identical | [C] | least-squares fit of 270 panel pixels against the Desktop screenshots: sigma 60 px, saturation 1.8, alpha 0.72, tint `#b4b4b4`, rms 0.4 levels in both appearances |
| Opaque fallback | `#9d9e9d` | `#8a8f98 (sRGB #898f99)` | [M] | means above |
| Background outside the panel | `#081e2d (sRGB #011e2e)`..`#7688a6 (sRGB #7288a9)` (mean `#2f4b69 (sRGB #274b6c)`): heavier blur than plain Launchpad | `#0b1722 (sRGB #081723)`..`#3b5475 (sRGB #355478)` (mean `#162742 (sRGB #122744)`) | [M] | 10-15-Catalina-Light-Launchpad-Folder.png @ 100,480,16,16; 1680,1800,16,16; dark same |
| Background recipe (folder open) | picture with `blur(80px)` or more under about `rgba(0,0,0,0.36)` | same | [C] (poor fit, rms 7-11 levels: treat as approximate) | fit against the Desktop screenshots |
| Title text | `#ffffff` | `#ffffff` | [M] | 10-15-Catalina-Light-Launchpad-Folder.png @ 1613,377,131,41 |
| Label text | `#ffffff` | `#ffffff` | [M] | 10-15-Catalina-Light-Launchpad-Folder.png @ 459,799,99,24 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title font | SF Pro Display Light about 28 pt ("Other" 41 px including overshoot and ascenders) | same | [C] | 10-15-Catalina-Light-Launchpad-Folder.png @ 1613,377,131,41 |
| Label font | 13 pt, as `launchpad` | same | [C] | 10-15-Catalina-Light-Launchpad-Folder.png @ 459,799,99,24 |

Folder "Other" contents (row by row) [M]: Grapher, VoiceOver Utility, AirPort Utility, Migration Assistant, Terminal, Activity Monitor, Console / Keychain Access, System Information, Script Editor, Disk Utility, Boot Camp Assistant, Digital Color Meter, ColorSync Utility / Screenshot, Bluetooth File Exchange, Audio MIDI Setup.

### Shadows and effects
No border or shadow on the panel was measurable (edge pixels blend straight from background to fill: 10-15-Catalina-Dark-Launchpad-Folder.png @ 262,1300,28,1) [M].

## Layout and spacing
The panel is centred horizontally; with three rows its top is 231 pt from the screen top. Icons inside keep the Launchpad column positions.

## Keyboard and accessibility
Return on a folder opens it; Esc closes the folder first, then Launchpad [D]. ARIA: nested `dialog` or `group` labelled by the title.

## Browser notes
As `launchpad`; the open animation scales the closed tile up to the panel (about 0.3 s [I]).

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Launchpad-Folder.png | 0,300,3360,1400 | open "Other" folder |
| dark | 10-15-Catalina-Dark-Launchpad-Folder.png | 0,300,3360,1400 | same, dark |
| light | 10-15-Catalina-Light-Launchpad.png | 2740,1148,216,260 | closed folder tile and label |

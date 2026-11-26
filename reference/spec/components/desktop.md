# Desktop (`desktop`)

- **Status:** present
- **AppKit:** Finder desktop window (`NSWindow` at `kCGDesktopWindowLevel`); picture via `NSWorkspace.setDesktopImageURL(_:for:options:)`
- **HIG:** https://web.archive.org/web/20200503170015/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/finder/
- **Appearances shown:** light, dark

## Purpose and behaviour
The desktop is the bottom layer of the screen: the desktop picture, with Finder's icons for mounted volumes and for the files in ~/Desktop on top. In Catalina the default picture is the dynamic "Catalina" desktop, which changes through the day and follows the appearance: the Day image in light mode, the Night image in dark mode.

## Anatomy
1. Desktop picture, scaled to fill the screen (1680 x 1050 pt here).
2. Icon grid, filled from the top-right corner downward, then in columns to the left.
3. Menu bar (22 pt, top) and Dock (80 pt, bottom centre) float above.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| picture variant | Catalina dynamic: Morning, Day, Evening, Night (plus still "Catalina Day", and other pictures) | dynamic | Desktop & Screen Saver pane | Day (all Light-* full-screen captures), Night (Dark-*), Morning and Evening (Theme-Morning-*, Theme-Evening-*), Evening on the login screen, a different close-up coastal picture in the Command-Tab and Mission Control captures |
| stacks | off / on (group by kind, date, tags) | off | View > Use Stacks | both (see `desktop-stack`) |
| icon size, grid spacing, label position | 16-128 pt; bottom/right | 64 pt, bottom | View Options | 64 pt, bottom |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Day picture (light) | yes | 10-15-Catalina-Light-Desktop.png @ 0,0,3360,2100 |
| Night picture (dark) | yes | 10-15-Catalina-Dark-Desktop.png @ 0,0,3360,2100 |
| Morning picture | yes | 10-15-Catalina-Theme-Morning-Blue.png @ 0,0,3360,2100 |
| Evening picture | yes | 10-15-Catalina-Theme-Evening-Blue.png @ 0,0,3360,2100 |
| Stacks on | yes | 10-15-Catalina-Light-Desktop-Stacks.png; 10-15-Catalina-Dark-Desktop-Stacks.png |
| selection rectangle (rubber band) | no | [I] 0.5 pt `rgba(255,255,255,0.5)` border with `rgba(128,128,128,0.2)` fill |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Screen | 1680 x 1050 (3360 x 2100 px) | [M] | every full-screen capture |
| Usable area | below the 22 pt menu bar; the Dock overlaps the picture | [M] | 10-15-Catalina-Light-Desktop.png @ 600,0,1,46 |
| Icon grid: first cell | icon centre 65.25 pt from the right screen edge (px x=3229.5) and 61.25 pt from the top (px y=122.5, i.e. 39 pt below the menu bar) | [M] | 10-15-Catalina-Light-Desktop.png @ 3177,66,106,114 (ink of the volume icon) |
| Icon grid: vertical pitch | 112 (labels at y=209 and 433 px; icons at 68 and 292) | [M] | 10-15-Catalina-Light-Desktop.png @ 3140,209,178,19 and 3146,433,165,19 |
| Icon grid: rows per column | 6 visible down to y=1383 px with Stacks on (pitch continues at 112) | [M] | 10-15-Catalina-Light-Desktop-Stacks.png @ 3080,209,280,1175 (label rows 209, 433, 659, 883, 1106, 1330) |
| Icon grid: horizontal pitch | not shown (single column in every capture); Finder default for 64 pt icons is about 116 pt | [I] | - |
| Fill order | top-right first, downward, next column to the left | [D] | Finder default "Sort By: None / Snap to Grid" |

### Colours and fills
Reference samples of the bundled pictures (stored values), for sanity-checking a substitute image; the pictures themselves are assets:

| Picture | Sky near the top (1000,300) | Sea near the bottom (1500,1850) | Tag | Evidence |
|---|---|---|---|---|
| Day | `#91c0ec (sRGB #85c1f0)` | about `#091f34 (sRGB #021f36)` | [M] | 10-15-Catalina-Light-Desktop.png @ 1000,300; 1460,1840,80,90 (mean) |
| Night | `#374f76 (sRGB #314f79)` (300,300 mean) | about `#0d192a (sRGB #0a192b)` | [M] | 10-15-Catalina-Dark-Desktop.png @ 300,300,6,3; 1460,1840,80,90 |
| Morning | below-bar strip `#9fa0ac (sRGB #9fa0ad)` | `#1c232d (sRGB #1a232e)` | [M] | 10-15-Catalina-Theme-Morning-Blue.png @ 1190,48,20,8; 1460,1840,80,90 |
| Evening | `#6a7197 (sRGB #69709a)` | `#0e121d (sRGB #0d121e)` | [M] | 10-15-Catalina-Theme-Evening-Blue.png @ 1190,48,20,8; 1460,1840,80,90 |

### Text and icons
See `desktop-icon`.

### Shadows and effects
None.

## Layout and spacing
The menu bar and Dock are separate layers; the right icon column leaves about 33 pt between the icon tile and the screen edge. Windows cover icons.

## Keyboard and accessibility
Command-Shift-D or clicking the desktop makes Finder active with the desktop focused; arrow keys move between icons, typing selects by name, Return renames, Command-O opens [D]. ARIA: a `grid` or `listbox` of items labelled "Desktop".

## Browser notes
The dynamic desktop pictures are Apple artwork (HEIC with time-of-day frames); the demo needs licensed substitutes or its own images. Every vibrant material in this spec was measured over these pictures, so different artwork will shift the menu bar, Dock and menu colours.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Desktop.png | 0,0,3360,2100 | Day picture, two volume icons |
| dark | 10-15-Catalina-Dark-Desktop.png | 0,0,3360,2100 | Night picture |
| light | 10-15-Catalina-Light-Desktop-Stacks.png | 3080,40,280,1380 | six-row icon column |

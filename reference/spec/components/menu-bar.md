# Menu bar (`menu-bar`)

- **Status:** present
- **AppKit:** `NSApplication.mainMenu` (`NSMenu`), system menu bar window; height from `NSStatusBar.system.thickness` = 22
- **HIG:** https://web.archive.org/web/20200503110758/https://developer.apple.com/design/human-interface-guidelines/macos/menus/menu-bar-menus/
- **Appearances shown:** light, dark (and the light bar over the Morning, Day and Evening desktop pictures, the dark bar over the Dark picture)

## Purpose and behaviour
The menu bar runs along the top of the main display. From the leading edge it holds the Apple menu, the app menu (the app name, in bold), then the app's menus (File, Edit, View, ... Window, Help); menu bar extras sit at the trailing end (see `menu-bar-extra`). Clicking a title opens its menu directly below and highlights the title; moving the pointer across titles while a menu is open switches menus. When the app is full screen the bar hides until the pointer reaches the top edge (HIG, Menu Bar Menus) [D]. The bar is a vibrant material: its colour follows the desktop picture behind it.

## Anatomy
```
|<10>[  ]<..>[Finder][File][Edit][View][Go][Window][Help]            ...extras...|   22 pt
      ^35pt   each title cell = text advance + 10 pt padding left and right, cells abut
```
1. Material strip, full screen width, 22 pt tall.
2. Shadow line under the strip (1 pt).
3. Apple logo cell, app-name cell (bold), menu title cells (regular).
4. Highlight rectangle of the open title (full bar height, square corners).
5. Menu bar extras, trailing (separate spec).

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| appearance | light, dark | light | `NSAppearance` aqua / darkAqua | both |
| titles | list of strings; first is the app name | - | `NSMenu.items` of `mainMenu` | Finder (7 titles), Terminal, System Preferences, Automator |
| open title | none or index | none | menu tracking | Apple, app menu, Go, extras |
| accent | 8 system accents | blue | `NSColor.controlAccentColor` | all 8, light and dark (Theme-* screenshots) |
| auto-hide | on/off | off | `NSApplication.presentationOptions` `.autoHideMenuBar` | not shown |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes | 10-15-Catalina-Light-Desktop.png @ 0,0,3360,46; 10-15-Catalina-Dark-Desktop.png @ 0,0,3360,46 |
| title open (highlighted) | yes | 10-15-Catalina-Light-Apple-Menu.png @ 20,0,70,44; 10-15-Catalina-Light-Finder-Menu.png @ 90,0,124,44; 10-15-Catalina-Light-Finder-Go-Menu.png @ 482,0,74,44 (dark: same coordinates in the Dark-* files) |
| title disabled (menu with no enabled items / modal alert) | no | [I] title text drawn with the disabled menu-item colour (see `menu-item`) |
| inactive (another display has focus) | no | [I] same material, titles at about 50 % opacity |
| each accent colour | yes | table below, 10-15-Catalina-Theme-<Wallpaper>-<Accent>.png @ 92,2,6,6 |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Bar height | 22 (rows y=0..43) | [M] | 10-15-Catalina-Light-Desktop.png @ 600,0,1,46 (col: bar #c7e1f1 (sRGB #c1e2f3)..#c6e2f3 (sRGB #c0e3f5) to y=43, shadow y=44-45, wallpaper from y=46); 10-15-Catalina-Dark-Desktop.png @ 600,0,1,46 |
| Bar width | full screen (1680 on the reference display) | [M] | 10-15-Catalina-Light-Desktop.png @ 0,20,3360,1 |
| Shadow line under bar | 1 pt (2 px, y=44..45), no blur | [M] | 10-15-Catalina-Light-Desktop.png @ 600,44 `#577a9e (sRGB #4e7aa1)`, 600,45 `#55799d (sRGB #4b79a0)`, 600,46 `#6692be (sRGB #5a92c2)` |
| Apple logo ink box | 12.5 x 15.5 (x 42..66, y 4..34 px); left edge 21 pt from screen edge, top 2 pt | [M] | 10-15-Catalina-Light-Desktop.png @ 42,4,25,31 |
| Apple cell (highlight) | x 10..45 pt (px 20..89), 35 pt wide, full height | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 20,0,70,44 |
| App-name cell | starts at 45 pt; width = text advance + 20 (Finder: px 90..213 = 62 pt; System Preferences: px 90..403 = 157 pt) | [M] | 10-15-Catalina-Light-Finder-Menu.png @ 90,0,124,44; 10-15-Catalina-Theme-Light-Blue.png @ 90,2,314,1 |
| Menu title cell | text advance + 20 (10 pt padding each side); Go: px 482..555 = 37 pt around ink 502..535 | [M] | 10-15-Catalina-Light-Finder-Go-Menu.png @ 482,0,74,44 |
| Gap between title inks | 20 pt nominal (Finder ink ends 195, File starts 235; File 275 / Edit 316; Edit 361 / View 401; View 461 / Go 502; Go 535 / Window 575; Window 676 / Help 716) | [M] | 10-15-Catalina-Light-Desktop.png @ 110,10,663,27 |
| Text baseline | 16 pt below the top of the bar (last ink row y=31) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 112,12,1,20 |
| Corner radius of highlight | 0 | [M] | 10-15-Catalina-Dark-Apple-Menu.png @ 86,40,8,10 (grid: flat edge) |

Title ink boxes in `10-15-Catalina-Light-Desktop.png` (px, [M]): Apple 42..66; Finder 110..195; File 235..275; Edit 316..361; View 401..461; Go 502..535; Window 575..676; Help 716..772; all text rows y=11..31 (descender of p in Help to y=36).

### Colours and fills
The bar is a vibrant material, so the stored colour depends on the picture behind it. Wallpaper value = mean of the 20x8 px just under the shadow line.

| Backdrop (screenshot) | Bar composite | Wallpaper just below | Tag | Evidence |
|---|---|---|---|---|
| Light, Day picture | `#c3e0f1 (sRGB #bce1f3)` (x=1200), `#c8e2f2 (sRGB #c2e3f4)` (x=4), `#c8e1f0 (sRGB #c2e2f2)` (x=2400), `#e4eaf0 (sRGB #e3eaf1)` (x=3340, over cloud) | `#6490bc (sRGB #5890c0)` (x=1200) | [M] | 10-15-Catalina-Light-Desktop.png @ 1200,4,40,36; 4,2,16,40; 2400,2,40,40; 3340,2,16,40 |
| Light, Morning picture | `#e2e3e9 (sRGB #e2e3ea)` (x=1200), `#d7d9e6 (sRGB #d7d9e7)` (x=2300) | `#9fa0ac (sRGB #9fa0ad)`, `#818296 (sRGB #818298)` | [M] | 10-15-Catalina-Theme-Morning-Blue.png @ 1200,4,40,36; 2300,4,40,36; 1190,48,20,8; 2290,48,20,8 |
| Light, Evening picture | `#cfd4e9 (sRGB #ced4eb)` (x=1200), `#dbe1ee (sRGB #dae1ef)` (x=2300) | `#6a7197 (sRGB #69709a)`, `#9299b9 (sRGB #9199bc)` | [M] | 10-15-Catalina-Theme-Evening-Blue.png (same rectangles) |
| Dark, Dark picture | `#1b2237 (sRGB #1a2239)` (x=1200), `#181e2e (sRGB #171e2f)` (x=2300), `#1d273c (sRGB #1b273e)` (x=4), `#181c29 (sRGB #171c2a)` (x=3340) | `#213860 (sRGB #1b3863)`, `#102447 (sRGB #0a234a)` | [M] | 10-15-Catalina-Theme-Dark-Blue.png @ 1200,4,40,36; 10-15-Catalina-Dark-Desktop.png @ 4,2,16,40; 3340,2,16,40 |

The fill carries a fine +-2 level dither (for example `#c5e0f2 (sRGB #bfe1f4)`, `#c6e1f3 (sRGB #c0e2f5)`, `#c7e1f2 (sRGB #c1e2f4)` on neighbouring pixels) [M] 10-15-Catalina-Light-Desktop.png @ 600,0,1,44.

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Material recipe | `backdrop-filter: blur(20px) saturate(1.7)` + fill `rgba(255,255,255,0.67)` | `backdrop-filter: blur(20px) saturate(1.8)` + fill `rgba(30,28,34,0.78)` | [C] | linear fit of the six light and two dark (wallpaper, bar) pairs above: slope 0.33 and intercept 171 in light (= white at 0.67); slope 0.22, intercept (23,21,26) in dark. Blur radius is [I] (the wallpaper under the bar is not visible in any screenshot) |
| Opaque fallback | `#c5e0f1 (sRGB #bfe1f3)` over the default Day picture; `#ececec` on a neutral page | `#1b2237 (sRGB #1a2239)` over the Dark picture; `#1e1e1e` on a neutral page | [M] first value / [I] neutral value | first values: rows above |
| Shadow line (y=44..45) | `#577a9e (sRGB #4e7aa1)` over `#6692be (sRGB #5a92c2)` = `rgba(0,0,0,0.16)` | `#1b2b46 (sRGB #172b48)` over `#2c436d (sRGB #264370)` = `rgba(0,0,0,0.36)` | [M] composites, [C] alpha | 10-15-Catalina-Light-Desktop.png @ 600,44; 10-15-Catalina-Dark-Desktop.png @ 600,44 |
| Title text, Apple logo | `#122d40 (sRGB #072d42)`..`#152f3f (sRGB #0b2f41)` on the Day bar; `#343237 (sRGB #353237)` on the Morning bar; `#151932 (sRGB #151834)` on the Evening bar | `#ffffff` | [M] | 10-15-Catalina-Light-Desktop.png @ 112,12 `#142e40 (sRGB #0a2e42)`, 237,12 `#15303f (sRGB #0a3041)`; 10-15-Catalina-Theme-Morning-Blue.png @ 560,8,80,28 (darkest); 10-15-Catalina-Theme-Evening-Blue.png @ 560,8,80,28; 10-15-Catalina-Dark-Apple-Menu.png @ 112,12 |
| Title text recipe | vibrant: about 0.27 x the saturated backdrop (black at about 0.73 composited under the white tint). CSS approximation `rgba(0,0,0,0.85)`; exact match needs the per-wallpaper value above | `#ffffff` | [C] / [I] | ratios text/backdrop 0.24-0.33 over the three light wallpapers |
| Open-title highlight (blue accent) | `#3f7ee7 (sRGB #2a7cef)` (dither `#3e7de7 (sRGB #297bef)`..`#417fe8 (sRGB #2d7df0)`) | `#2c6dd5 (sRGB #0e6bdc)` (`#2b6cd3 (sRGB #0c6ada)`..`#2d6fd7 (sRGB #0e6dde)`) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 23,0,1,44; 10-15-Catalina-Dark-Apple-Menu.png @ 23,0,1,44 |
| Open-title text and logo | `#ffffff` | `#ffffff` | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 58,6; 10-15-Catalina-Light-Finder-Menu.png @ 112,14 |

Open-title highlight per accent colour (mean of 6x6 px at 92,2 in each `10-15-Catalina-Theme-<Wallpaper>-<Accent>.png`; note the Evening file for purple is spelled `Purpe`), all [M]:

| Accent | Light (Day) | Morning | Evening | Dark |
|---|---|---|---|---|
| Blue | `#3f7ee8 (sRGB #2a7cf0)` | `#4d89ee (sRGB #3b88f6)` | `#2f6ed8 (sRGB #166ce0)` | `#2c6ed5 (sRGB #0c6cdc)` |
| Purple | `#935799 (sRGB #9d519d)` | `#9d64a3 (sRGB #a75fa7)` | `#834689 (sRGB #8d408d)` | `#7a3f80 (sRGB #833984)` |
| Pink | `#e16ca2 (sRGB #f262a4)` | `#e778ac (sRGB #f76fae)` | `#d15b92 (sRGB #e14f94)` | `#c75489 (sRGB #d7488b)` |
| Red | `#ce5857 (sRGB #de4e52)` | `#d66564 (sRGB #e65c60)` | `#be4846 (sRGB #cd3d41)` | `#b4413f (sRGB #c33639)` |
| Orange | `#e4904d (sRGB #f18c3b)` | `#ea9a5b (sRGB #f7964c)` | `#d4803d (sRGB #e17c28)` | `#ca7736 (sRGB #d77320)` |
| Yellow | `#edbb5c (sRGB #f5ba46)` | `#f3c469 (sRGB #fbc356)` | `#ddac4b (sRGB #e5ab31)` | `#d2a244 (sRGB #daa129)` |
| Green | `#83b966 (sRGB #71bc5a)` | `#8ec272 (sRGB #7ec567)` | `#73a955 (sRGB #61ac48)` | `#6ba04e (sRGB #59a341)` |
| Graphite | `#949494` | `#9e9e9e` | `#848484` | `#67748a (sRGB #64748c)` |

The highlight is itself translucent (it shifts with the wallpaper); see `menu-item` for the recovered recipe (accent at about 0.82 over the backdrop).

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Font | SF Pro Text 14 pt (cap height 20 px, rows 12..31) | same | [C] | 10-15-Catalina-Light-Apple-Menu.png @ 112,12,1,20 (F of Finder); 237,12,1,20 (F of File) |
| App-name weight | Bold (stem 4 px: x=110..114 with 111..113 solid) | same | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 108,20,22,1 |
| Other titles weight | Regular (stem 2 px solid + 1 px edge: x=235..237) | same | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 232,20,18,1 |
| Apple logo | template glyph 12.5 x 15.5 pt, same colour as the titles; supply as an SVG asset | same, `#ffffff` | [M] | 10-15-Catalina-Light-Desktop.png @ 42,4,25,31; 10-15-Catalina-Dark-Desktop.png @ 42,4,25,32 |

### Shadows and effects
Only the 1 pt shadow line above. No blur was measurable below y=46 ([M] 10-15-Catalina-Light-Desktop.png @ 600,46 equals the wallpaper).

## Layout and spacing
- Fixed to the top of the screen, z-order above windows; windows cannot be placed under it.
- First cell (Apple) starts 10 pt from the left edge; cells abut with no gaps; a cell is as wide as its text plus 20 pt.
- An open menu's left edge aligns with the left edge of its title cell and its top touches the bar (see `menu`).
- Extras are laid out from the right edge inward (see `menu-bar-extra`); if titles and extras collide, extras are hidden first [D] (HIG, Menu Bar Extras).

## Keyboard and accessibility
- Control-F2 moves focus to the menu bar; Left/Right move between titles, Down or Return opens, Esc closes [D] (macOS keyboard shortcuts; HIG Keyboard https://web.archive.org/web/20200503161456/https://developer.apple.com/design/human-interface-guidelines/macos/user-interaction/keyboard/).
- AX role `AXMenuBar` with `AXMenuBarItem` children. ARIA: `role="menubar"` containing `role="menuitem"` with `aria-haspopup="menu"` and `aria-expanded`.

## Browser notes
- The material needs `backdrop-filter`; without it use the opaque fallbacks. The vibrant title colour (dark navy over the blue sky) cannot be produced by plain alpha text; use the measured colour for the bundled wallpaper or `rgba(0,0,0,0.85)`.
- The +-2 dither is not reproducible in CSS and can be ignored.
- 14 pt San Francisco is not available on non-Apple systems; use `-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif` and keep the cell width rule (advance + 20) rather than fixed widths.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Desktop.png | 0,0,3360,46 | whole bar, nothing open |
| dark | 10-15-Catalina-Dark-Desktop.png | 0,0,3360,46 | whole bar, nothing open |
| light | 10-15-Catalina-Light-Apple-Menu.png | 0,0,460,46 | Apple cell highlighted |
| dark | 10-15-Catalina-Dark-Finder-Menu.png | 0,0,460,46 | app-name cell highlighted |
| light | 10-15-Catalina-Theme-Morning-Blue.png | 0,0,3360,46 | bar over the Morning picture, System Preferences titles |
| light | 10-15-Catalina-Theme-Evening-Blue.png | 0,0,3360,46 | bar over the Evening picture |
| light | 10-15-Catalina-Light-Command-Tab.png | 0,0,800,46 | Terminal titles (Terminal, Shell, Edit, View, Window, Help) |
| dark | 10-15-Catalina-Dark-Time-Machine-Menu.png | 0,0,1200,46 | Automator titles (Automator, File, Edit, Format, View, Workflow, Action, Window, Help) |

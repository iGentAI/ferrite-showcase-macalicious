# Menu (`menu`)

- **Status:** present
- **AppKit:** `NSMenu` (menu window with `NSVisualEffectView` material `.menu`); pop-up menus come from `NSPopUpButton` / `NSMenu.popUp(positioning:at:in:)`
- **HIG:** https://web.archive.org/web/20200503171533/https://developer.apple.com/design/human-interface-guidelines/macos/menus/menu-anatomy/
- **Appearances shown:** light, dark

## Purpose and behaviour
A menu presents a list of items (commands, attributes or states). It stays open until the user chooses an item, moves to another menu, clicks outside, switches app, or the system shows an alert. All menus are translucent by default (HIG, Menu Anatomy) [D]. Three kinds exist: menu bar menus, contextual menus and Dock menus; pop-up and pull-down buttons open the same container.

## Anatomy
```
menu bar ------------------------------
|  (4 pt top padding)                 |   attached: top edge flush with the bar, top corners square
|  item rows (19 pt each at 14 pt)    |
|  --------- separator (12 pt) ------ |
|  (4 pt bottom padding)              |
\_____________________________________/   bottom corners radius 5 pt
```
Back to front: drop shadow, 0.5 pt outer hairline, material fill, 0.5 pt (light) or 1 pt (dark) inner light border, item rows.
A detached menu (pop-up button menu, contextual menu, Dock menu, submenu) has all four corners rounded and 4 pt padding top and bottom.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| attachment | attached to menu bar (square top corners), detached (all rounded) | - | menu bar tracking vs `popUp` | attached: Apple, Finder, Go, System Preferences, battery, Time Machine, user menus; detached: Print Presets pop-up, Contacts pop-ups, Safari Share menu |
| font size | 14 pt (menu bar, contextual), 13 pt (regular pop-up button), 12 pt and smaller for small/mini controls | 14 | `NSMenu.font` / control size | 14, 13 and 12 pt |
| width | widest item + insets; `minimumWidth` | fit | `NSMenu.minimumWidth` | 179-283 pt |
| appearance | light, dark | - | - | both |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| open, attached | yes | 10-15-Catalina-Light-Apple-Menu.png @ 20,44,416,516; 10-15-Catalina-Dark-Apple-Menu.png @ 20,44,416,516 |
| open, detached | yes | 10-15-Catalina-Light-Print.png @ 975,298,488,244; 10-15-Catalina-Dark-Print.png @ 889,268,488,244; 10-15-Catalina-Dark-Contacts.png @ 1148,432,358,130; 10-15-Catalina-Light-Contacts.png @ 976,389,190,178 |
| scrolling (taller than the screen, arrows at top/bottom) | no | [D] HIG: a menu that does not fit shows a scroll arrow row; [I] arrow row 19 pt high with a centred 9 pt triangle |
| opening / closing animation | no | [I] appears instantly, fades out over about 0.25 s after a chosen item blinks once |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Top padding | 4 (attached: y=44..51 px before the first row at 52) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 400,44,1,8 |
| Bottom padding | 4 (rows end y=551, fill ends 559) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 26,552,1,8 |
| Height | 8 + sum of rows (Apple menu: 4 + 10x19 + 5x12 + 4 = 258; px 44..559) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 400,44,1,516 |
| Width (measured examples) | Apple 208 (px 20..435); Finder 179 (90..447); Go 201 (482..883); System Preferences 235 (91..560); battery 283 (2722..3287); Time Machine 262 (2518..3041); user 235 (2666..3135); Print Presets 244 (975..1462); Contacts action 179 (1148..1505) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 20,66,416,1; -Light-Finder-Menu @ 90,66,358,1; -Light-Finder-Go-Menu @ 482,140,402,1; -Theme-Light-Blue @ 91,53,470,1; -Light-Menu-Bar-Battery @ 2722,260,566,1; -Light-Time-Machine-Menu @ 2518,200,524,1; -Light-Fast-User-Switching-Menu @ 2666,56,470,1; -Light-Print @ 975,408,488,1; -Dark-Contacts @ 1148,484,358,1 |
| Width rule | left inset 21 + widest title + (gap + key-equivalent column) + right inset; see `menu-item` | [C] | from the item measurements |
| Corner radius, detached (all corners) and attached (bottom corners) | 5 | [M] | 10-15-Catalina-Dark-Apple-Menu.png @ 17,546,16,16 (outline leaves x=19 at y=552 and reaches y=560 at x=30); 10-15-Catalina-Light-Print.png @ 972,295,15,14; 10-15-Catalina-Dark-Contacts.png @ 1145,429,15,14 (outline crosses the diagonal 3 px in) |
| Corner radius, attached top corners | 0 | [M] | 10-15-Catalina-Dark-Apple-Menu.png @ 430,40,10,12 (border runs straight up to y=44) |
| Position, menu bar menu | left edge = left edge of the title cell; top = bar bottom (y=22 pt) | [M] | 10-15-Catalina-Light-Finder-Menu.png @ 90,0,124,60 (cell 90..213, menu from 90) |
| Position, pop-up button menu | the checked item's text overlays the button's title (menu shifts so the current item sits over the control) | [M] | 10-15-Catalina-Light-Print.png @ 975,298,488,60 ("Default Settings" row over the Presets button) |

### Colours and fills
Observed fill composites (menu material over different backdrops):

| Appearance | Backdrop | Fill composite | Tag | Evidence |
|---|---|---|---|---|
| light | Day sky (`#98c4ee (sRGB #8dc5f2)`) | `#b2d9f0 (sRGB #a8daf3)` (top) to `#d0e8f4 (sRGB #cbe9f6)` (bottom); `#c0e0f4 (sRGB #b8e1f6)` at 300,300 | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 26,45,1,514; 300,300,6,3; backdrop 10-15-Catalina-Light-Desktop.png @ 300,300,6,3 |
| light | rock / dark sea (Go menu lower third) | `#b3c9d9 (sRGB #aecadb)`..`#c7d7e4 (sRGB #c4d7e6)` | [M] | 10-15-Catalina-Light-Finder-Go-Menu.png @ 488,612,1,200 |
| light | Morning picture | `#eceae6` | [M] | 10-15-Catalina-Theme-Morning-Blue.png @ 300,246,8,8 |
| light | Evening picture | `#b6bad9 (sRGB #b6b9dc)` | [M] | 10-15-Catalina-Theme-Evening-Blue.png @ 300,246,8,8 |
| light | sheet background (`#ececec`) | `#ebecef` (`#eaebef`..`#ecedf1`) | [M] | 10-15-Catalina-Light-Print.png @ 981,299,1,89 |
| light | white window content | `#eff0f0` (`#eeeff1`..`#f2f2f4`) | [M] | 10-15-Catalina-Light-Contacts.png @ 1106,390,1,42 |
| dark | Dark sky (`#374f76 (sRGB #314f79)`) | `#2c3e5a (sRGB #283e5c)` (top) to `#3d4e6a (sRGB #394e6d)` (bottom); `#314360 (sRGB #2d4363)` at 300,300 | [M] | 10-15-Catalina-Dark-Apple-Menu.png @ 26,44,1,514; 300,300,6,3 |
| dark | dark window content (`#1d1e1f`) | `#333536` (dither `#313736 (sRGB #303736)`..`#383536 (sRGB #393536)`) | [M] | 10-15-Catalina-Dark-Contacts.png @ 1156,435,1,42 |
| dark | dark sheet | `#3b3e41 (sRGB #3a3e41)` (`#373d40 (sRGB #363d40)`..`#3f4046 (sRGB #3f4047)`) | [M] | 10-15-Catalina-Dark-Print.png @ 895,271,1,87 |

| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Material recipe | `backdrop-filter: blur(22px) saturate(1.8)` + `rgba(234,234,234,0.70)` | `backdrop-filter: blur(22px) saturate(2.2)` + `rgba(62,63,64,0.70)` | [C] | least-squares fit of 606 fill pixels of the Go menu against the same pixels of 10-15-Catalina-Light-Desktop.png / -Dark-Desktop.png blurred (best Gaussian sigma 45 px = 22 pt, alpha 0.70, rms 2.3 / 1.6 levels), tint pinned with the neutral-backdrop composites above |
| Opaque fallback | `#f0f0f0` | `#343536` | [M] | composites over white / dark window above |
| Inner border | 0.5 pt, `rgba(255,255,255,0.17)` (x=20 `#c4dff4 (sRGB #bee0f6)` on fill `#b8dbf4 (sRGB #b0dcf7)`) | 1 pt, `rgba(255,255,255,0.15)` (x=20..21 `#505c73 (sRGB #4e5c75)` on fill `#30405e (sRGB #2c4061)`), all sides except the attached top | [M] composite, [C] alpha | 10-15-Catalina-Light-Apple-Menu.png @ 20,150; 10-15-Catalina-Dark-Apple-Menu.png @ 20,150,2,1; 10-15-Catalina-Dark-Contacts.png @ 1156,433,1,2 (top border of a detached menu) |
| Outer hairline | 0.5 pt, about `rgba(0,0,0,0.15)` (x=436: `#6d8dac (sRGB #658daf)` on wallpaper `#97c4ee (sRGB #8cc5f2)`, 0.28 total with the shadow) | 0.5 pt, about `rgba(0,0,0,0.80)` (x=436 `#090d14 (sRGB #080d15)` on `#324971 (sRGB #2c4974)`) | [M] composite, [C] alpha | 10-15-Catalina-Light-Apple-Menu.png @ 436,300; 10-15-Catalina-Dark-Apple-Menu.png @ 436,300 against the same pixels of the Desktop screenshots |
| Top row of an attached menu (light only) | 1 px darker line `#89a8c5 (sRGB #82a8c8)` (the menu bar's shadow line continuing over the menu) | none (`#2d3d5f (sRGB #2a3d62)` = fill) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 400,44; 10-15-Catalina-Dark-Apple-Menu.png @ 400,44 |

### Text and icons
See `menu-item`.

### Shadows and effects
Measured as the darkening of the wallpaper next to the Apple menu, relative to the identical wallpaper pixels in the Desktop screenshot (alpha of black) [M]:

| Distance from edge (px) | 1 | 2 | 4 | 8 | 12 | 16 | 20 | 24 | 30 |
|---|---|---|---|---|---|---|---|---|---|
| Right side, light (y=300, x=437..466) | 0.15 | 0.12 | 0.10 | 0.08 | 0.06 | 0.03 | 0.03 | 0.02 | 0.00 |
| Right side, dark (y=300) | 0.15 | 0.13 | 0.12 | 0.08 | 0.06 | 0.05 | 0.02 | 0.02 | 0.00 |
| Below, light (x=220, y=561..600) | 0.20 | 0.16 | 0.14 | 0.12 | 0.10 | 0.07 | 0.05 | - | 0.01 (at 32) |
| Below, dark (x=220) | 0.19 | 0.19 | 0.17 | 0.14 | 0.11 | 0.09 | 0.07 | - | 0.01 (at 32) |
| Right side near the top, light (y=50) | 0.09 | 0.06 | 0.05 | - | 0.03 | - | 0.02 | - | 0.00 |

Evidence: 10-15-Catalina-Light-Apple-Menu.png @ 436,300,65,1 and 220,559,1,72 and 436,50,45,1 against 10-15-Catalina-Light-Desktop.png (same coordinates); dark the same with the Dark-* files.
Fitted CSS [C]: `box-shadow: 0 3px 14px rgba(0,0,0,0.31)` plus the hairline as `0 0 0 0.5px rgba(0,0,0,0.15)` (light) or `0 0 0 0.5px rgba(0,0,0,0.8)` (dark). The same shadow is used in both appearances.

## Layout and spacing
- Rows fill the full width of the menu; the highlight of a row runs edge to edge (it is clipped by the rounded bottom corners only on the last row).
- Separators span the full width.
- Menus keep inside the screen; a status-item menu that would overflow is shifted left (battery menu right edge at 3287 px, 36 pt from the screen edge) [M] 10-15-Catalina-Light-Menu-Bar-Battery.png @ 3280,100,80,1.

## Keyboard and accessibility
Up/Down move the highlight (skipping disabled items and separators), Right opens a submenu, Left closes it, Return/Space choose, Esc closes, typing selects by prefix [D] (HIG Keyboard, archived page above; AppKit `NSMenu`). AX role `AXMenu` with `AXMenuItem` children. ARIA: `role="menu"`, items `role="menuitem"` / `menuitemcheckbox` / `menuitemradio`, separators `role="separator"`.

## Browser notes
- `backdrop-filter` gives a close match; the selection and text vibrancy (see `menu-item`) do not have CSS equivalents and are approximated with fixed colours.
- The half-point hairline needs `box-shadow: 0 0 0 0.5px` (renders 1 device px at 2x, 1 CSS px at 1x).
- The fill's +-2 level dither is not reproducible.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Apple-Menu.png | 0,0,470,600 | attached menu over the sky, with shadow |
| dark | 10-15-Catalina-Dark-Apple-Menu.png | 0,0,470,600 | attached menu, dark |
| light | 10-15-Catalina-Light-Finder-Go-Menu.png | 470,30,440,810 | long menu over sky and rock (material range) |
| light | 10-15-Catalina-Light-Print.png | 960,285,520,270 | detached pop-up menu over a sheet |
| dark | 10-15-Catalina-Dark-Contacts.png | 1136,420,384,154 | detached menu over a dark window |
| dark | 10-15-Catalina-Dark-Print.png | 877,256,512,270 | detached pop-up menu, dark |

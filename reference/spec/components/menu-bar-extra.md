# Menu bar extras / status items (`menu-bar-extra`)

- **Status:** present
- **AppKit:** `NSStatusItem` in `NSStatusBar.system` (`button.image` as a template image, `menu`); system extras (clock, user, Spotlight, Siri, Notification Center) are drawn by SystemUIServer
- **HIG:** https://web.archive.org/web/20200503161847/https://developer.apple.com/design/human-interface-guidelines/macos/extensions/menu-bar-extras/
- **Appearances shown:** light, dark

## Purpose and behaviour
A menu bar extra exposes app or system functions through an icon at the trailing end of the menu bar, visible whichever app is frontmost. Clicking it opens a menu (or a popover); the system hides extras when app menus need the room. Icons are template images so they take the bar's text colour and invert when highlighted (HIG, Menu Bar Extras) [D].

## Anatomy
Right to left on the reference machine: Notification Center, Siri, Spotlight, user name (fast user switching), clock, battery, AirPlay, Wi-Fi, Time Machine, and optionally Location (arrow) when in use. Each item is a cell of the full bar height (22 pt) that contains one template glyph or one text run; the open item gets the same accent highlight as an open menu title.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| content | template image, text, or image + text | image | `NSStatusItem.button.image/title` | image (most), text (clock, user name), image+text (battery with percentage on the login screen) |
| length | variable (content + padding) or square | variable | `NSStatusItem.variableLength` / `.squareLength` | variable |
| state | normal, open | normal | - | both |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes | 10-15-Catalina-Light-Desktop.png @ 2500,0,860,46; 10-15-Catalina-Dark-Desktop.png @ 2500,0,860,46 |
| open (highlighted) | yes | Time Machine: 10-15-Catalina-Light-Time-Machine-Menu.png @ 2518,0,80,44; battery: 10-15-Catalina-Light-Menu-Bar-Battery.png @ 2722,0,72,44; user: 10-15-Catalina-Light-Fast-User-Switching-Menu.png @ 3008,0,128,44 (dark: Dark-* files, battery at 2738,0,72,44, Time Machine at 2534,0,80,44) |
| disabled / dimmed | no | [I] glyph at the disabled menu text opacity |
| on the login screen (no bar material) | yes | 10-15-Catalina-Light-Fast-User-Switching.png @ 2980,10,370,36 (white text and glyphs directly on the picture) |

## Measurements
### Geometry (pt)
Ink boxes in `10-15-Catalina-Light-Desktop.png` (clock reads "Thu 10:07 AM"). Cells marked [M] are the measured highlight extents of the open item; cells marked [C] are derived from the neighbouring measured cells and the ink centres.

| Item | Ink box (px: x range, y range) | Ink size (pt) | Cell (px) | Cell width (pt) | Tag |
|---|---|---|---|---|---|
| Time Machine | 2538..2574, 6..37 | 18.5 x 16 | 2518..2597 | 40 | [M] ink; [M] cell (10-15-Catalina-Light-Time-Machine-Menu.png @ 2518,0,80,44) |
| Wi-Fi | 2607..2646, 7..35 | 20 x 14.5 | 2598..2655 | 29 | [M] ink; [C] cell |
| AirPlay | 2672..2707, 8..35 | 18 x 14 | 2656..2721 | 33 | [M] ink; [C] cell |
| Battery (charging) | 2738..2782, 10..33 | 22.5 x 12 | 2722..2793 | 36 | [M] ink; [M] cell (10-15-Catalina-Light-Menu-Bar-Battery.png @ 2722,0,72,44) |
| Clock "Thu 10:07 AM" | 2813..2987, 11..31 | 87.5 x 10.5 | 2794..3007 | 107 (text + about 9.5 pt each side) | [M] ink; [C] cell |
| User name "Stephen" | 3018..3124, 11..36 | 53.5 x 13 | 3008..3135 | 64 (text + 5 pt left, 5.5 pt right of ink) | [M] ink; [M] cell (10-15-Catalina-Light-Fast-User-Switching-Menu.png @ 3008,0,128,44) |
| Spotlight | 3159..3185, 9..35 | 13.5 x 13.5 | 3136..3207 | 36 | [M] ink; [C] cell |
| Siri | 3222..3253, 6..37 | 16 x 16 (full-colour orb) | 3208..3267 | 30 | [M] ink; [C] cell |
| Notification Center | 3278..3313, 12..31 | 18 x 10 | 3268..3359 | 46; glyph right edge 23 pt from the screen edge | [M] ink; [C] cell |
| Location arrow (when shown) | 2479..2500, 11..32 (in 10-15-Catalina-Light-Spotlight.png, where Time Machine is at 2538..2559) | 11 x 11 | about 2460..2517 | about 29 | [M] ink (10-15-Catalina-Light-Spotlight.png @ 2479,11,22,22); [C] cell |

Other rules:

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Cell height | 22 (full bar) | [M] | 10-15-Catalina-Light-Menu-Bar-Battery.png @ 2725,0,1,44 |
| Glyph vertical centre | 10.5-11 pt from the top (ink boxes above are centred on y=21..22 px) | [M] | ink boxes above |
| Icon-only item padding | 5-10 pt each side of the ink; items abut | [M]/[C] | cells above |
| Highlight corner radius | 0 | [M] | 10-15-Catalina-Light-Menu-Bar-Battery.png @ 2722,0,6,6 |
| Menu position | menu left edge = cell left edge, top = bar bottom; flips to right-align when it would leave the screen (battery menu: cell 2722, menu 2722..3287) | [M] | 10-15-Catalina-Light-Menu-Bar-Battery.png @ 2722,44,566,254 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Glyph and text, normal | `#132d3d (sRGB #082d3f)`..`#2c373d (sRGB #29373e)` (vibrant; lighter toward the right where the bar is over cloud) | `#ffffff` | [M] | 10-15-Catalina-Light-Desktop.png @ 2561,36 `#132d3d (sRGB #082d3f)`; 2819,27 `#1f2f3d (sRGB #1b2f3e)`; 3020,16 `#23353c (sRGB #1e353d)`; 3289,20 `#2c373d (sRGB #29373e)`; 10-15-Catalina-Dark-Desktop.png @ 2556,7; 2830,12; 3289,13 |
| Highlight fill (blue accent) | `#518cef (sRGB #408bf7)`..`#558ff0 (sRGB #458ef8)` | `#2664c6 (sRGB #0662cd)` (`#2663c4 (sRGB #0861cb)`..`#2765c8 (sRGB #0863cf)`) | [M] | 10-15-Catalina-Light-Time-Machine-Menu.png @ 2521,0,1,44; 10-15-Catalina-Light-Fast-User-Switching-Menu.png @ 3011,0,1,44; 10-15-Catalina-Dark-Menu-Bar-Battery.png @ 2741,0,1,44 |
| Glyph and text, highlighted | `#ffffff` | `#ffffff` | [M] | 10-15-Catalina-Light-Fast-User-Switching-Menu.png @ 3030,24 |
| Login-screen items | `#ffffff` text and glyphs, no bar | same | [M] | 10-15-Catalina-Light-Fast-User-Switching.png @ 3200,17,142,21 |

Note: the status-item highlight is lighter than the app-menu title highlight in the same appearance (`#518cef (sRGB #408bf7)` against `#3f7ee7 (sRGB #2a7cef)` in light; `#2664c6 (sRGB #0662cd)` against `#2c6dd5 (sRGB #0e6bdc)` in dark). Both are the translucent selection material over different parts of the bar; reproduce with one accent token at about 0.82 opacity over the bar (see `menu-item`).

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Clock text | SF Pro Text 14 pt Regular (cap rows 12..31 = 20 px; T stem 2 px + edge) | same | [C] | 10-15-Catalina-Light-Desktop.png @ 2822,12,1,20; 2810,24,52,1 |
| User name text | SF Pro Text 14 pt Bold (stems 3 px solid + edges, e.g. x=3029..3031) | same | [C] | 10-15-Catalina-Light-Desktop.png @ 3015,24,111,1 |
| Battery percentage (login screen only) | 14 pt Regular, white, left of the battery glyph | same | [C] | 10-15-Catalina-Light-Fast-User-Switching.png @ 3001,17,69,21 |
| Glyph style | 1 pt-stroke template glyphs (Time Machine clock-arrow, Wi-Fi fan, AirPlay display, battery with bolt, magnifier, three-line list); Siri is a full-colour orb | same shapes, white | [M] presence; shapes are assets | 10-15-Catalina-Light-Desktop.png @ 2500,0,860,46 |

### Shadows and effects
None.

## Layout and spacing
Items are packed from the right edge: Notification Center cell ends at the screen edge, each further item abuts its right neighbour. Text items pad the text by about 5-10 pt per side. The clock width changes with the time string, which shifts every item to its left (compare Time Machine at px 2538 in 10-15-Catalina-Light-Desktop.png with 2556 in 10-15-Catalina-Dark-Menu-Bar-Battery.png, clock "Fri 10:18 AM") [M].

## Keyboard and accessibility
Control-F8 moves focus to the status menus; arrows move between items; Return/Down opens [D] (macOS keyboard shortcuts). AX role `AXMenuBarItem` inside the `AXMenuBar` of SystemUIServer / the owning app, with `AXTitle` or `AXDescription`. ARIA: `role="menuitem"` with `aria-haspopup`, and an `aria-label` for icon-only items.

## Browser notes
Glyphs must be supplied as SVG assets drawn on a 22 pt-high canvas and tinted with `currentColor`. The Siri orb is a raster asset. The clock should use tabular figures so the layout does not jitter (`font-variant-numeric: tabular-nums`); in the screenshots the colon sits slightly raised, which is SF's contextual colon [M] 10-15-Catalina-Light-Desktop.png @ 2871,12,67,20.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Desktop.png | 2500,0,860,46 | all extras, normal |
| dark | 10-15-Catalina-Dark-Desktop.png | 2500,0,860,46 | all extras, normal |
| light | 10-15-Catalina-Light-Menu-Bar-Battery.png | 2700,0,660,46 | battery item open |
| dark | 10-15-Catalina-Dark-Time-Machine-Menu.png | 2500,0,860,46 | Time Machine item open |
| light | 10-15-Catalina-Light-Fast-User-Switching-Menu.png | 2640,0,720,46 | user-name item open |
| light | 10-15-Catalina-Light-Spotlight.png | 2440,0,920,46 | with Location arrow |

# Share menu (`share-menu`)

- **Status:** present
- **AppKit:** `NSSharingServicePicker` shown from a Share toolbar button (`NSSharingServicePickerToolbarItem` in 10.15)
- **HIG:** https://web.archive.org/web/20200503180050/https://developer.apple.com/design/human-interface-guidelines/macos/extensions/share-extensions/
- **Appearances shown:** light, dark

## Purpose and behaviour
Share extensions give "a convenient way to share information from the current context to apps, social media accounts, and other services"; people reach them through a Share button in the toolbar or Share in a contextual menu [D]. The picker is an ordinary menu listing services with their icons, then a separator and "More...", which opens the Extensions preference pane [D]/[M]. Choosing a service shows its edit view or hands off to its app [D].

## Anatomy
A standard `menu` (material, radius, shadow) whose items have a 16 pt leading icon. Captured contents, in order: Add to Reading List, Add Bookmark, Email This Page, Messages (highlighted), AirDrop, Notes, Reminders, separator, More...

## Variants and parameters
| Variant | Shown |
|---|---|
| Safari page share (Reading List and Bookmark first) | yes |
| Finder/Preview file share (Mail, Messages, AirDrop, Notes, Add to Photos ...) | no; same layout [D] |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| open, one item highlighted | yes | `10-15-Catalina-Light-Safari-v13-Sharing.png @ 2285,101,364,372` |
| Share button while the menu is open | yes | pressed bezel in both appearances: darker than a resting button in light (`10-15-Catalina-Light-Safari-v13-Sharing.png @ 2284,40,80,50`), lighter in dark (`10-15-Catalina-Dark-Safari-v13-Sharing.png @ 2300,34,80,48`); values under Colours and fills |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Menu size (8 items + separator) | 182 x 186 (x 2285..2648, y 101..472) | [M] | `10-15-Catalina-Light-Safari-v13-Sharing.png @ 2278,300,17,1`, `@ 2640,300,22,1`, `@ 2500,96,1,17`, `@ 2500,466,1,17` |
| Position | top edge directly under toolbar separator y=100; menu leading edge x=2285, Share bezel leading edge x=2284: 0.5 pt inset | [M] edges; [C] inset | 10-15-Catalina-Light-Safari-v13-Sharing.png @ 2500,96,1,17; 10-15-Catalina-Light-Safari-v13-Sharing.png @ 2278,300,17,1; 10-15-Catalina-Light-Safari-v13-Sharing.png @ 2278,64,18,1 |
| Highlighted row height | 21 (y 231..272), the standard menu row with a 16 pt image (font size + 5 + 2) | [M] | `10-15-Catalina-Light-Safari-v13-Sharing.png @ 2600,231,1,42` (re-measured by the lead: `#4280e9 (sRGB #2e7ef1)` runs 42 px on column x=2600) |
| Icon | 16 x 16 box, ink x 2319..2349 on the first row; 17 from the menu's leading edge | [M] | `@ 2319,122,31,14` |
| Text start | 37.5 from the menu's leading edge (about x 2360) | [C] | icon box + 5 gap |
| Separator block | 12 high with a 1 pt line (y 409..412 region) | [M] | `@ 2600,400,1,25` |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Menu material over the page and desktop | `#b6c4d2 (sRGB #b3c4d4)`-`#cbe4f0 (sRGB #c5e5f2)` (bluish from the backdrop) | `#2a3545 (sRGB #283547)`-`#2d4056 (sRGB #284058)` | [M] | `10-15-Catalina-Light-Safari-v13-Sharing.png @ 2500,101,1,12`, `@ 2640,300,9,1`; `10-15-Catalina-Dark-Safari-v13-Sharing.png @ 2520,87,1,10`, `@ 2520,448,1,7` |
| Highlight | `#417fe8 (sRGB #2d7df0)` -> `#4280e9 (sRGB #2e7ef1)` | `#2868cd (sRGB #0766d4)` | [M] | `10-15-Catalina-Light-Safari-v13-Sharing.png @ 2600,236,1,37`; `10-15-Catalina-Dark-Safari-v13-Sharing.png @ 2620,216,1,41` |
| Text | black (`#000203` darkest), white on the highlight | white | [M] | `@ 2350,110,280,36` |
| Separator line | `#bed0dd (sRGB #bad0df)` | lighter than the material | [M] | `10-15-Catalina-Light-Safari-v13-Sharing.png @ 2600,409` |
| Dark edge: hairline / inner highlight | n/a | `#070707`, then 1 pt `#4b525f (sRGB #4a5260)` | [M] | `10-15-Catalina-Dark-Safari-v13-Sharing.png @ 2520,84`, `@ 2520,85` |
| Share button bezel while the menu is open (sRGB) | fill `#e5e5e5` -> `#d6d6d6` under a `#cacaca` top edge and two first rows `#f2f2f2`, `#ebebeb`, last row `#d1d1d1`; glyph `#222222`; the resting button beside it is `#f9fafa` | fill `#838486` -> `#767779` under two first rows `#989a9d`, `#868a8a`, no border; glyph `#f7f9fa`; the resting button beside it is `#656768` | [M] | `10-15-Catalina-Light-Safari-v13-Sharing.png @ 2330,50,1,46`, `@ 2376,64`; `10-15-Catalina-Dark-Safari-v13-Sharing.png @ 2346,35,1,44`, `@ 2394,58` |
| The same without the open menu's shadow, which lies over the button's lower half | `#e5e5e5` -> `#dfdfdf`, last row `#d9d9d9` | white at 36.6% -> 35.6% over the bar | [C] | fitted so that the library's button under the library's menu shadow matches the two crops above |

Neutral material values, radius, padding and the shadow are specified in `menu` and `material` (system group); shadow fit in `window-shadow`.

### Text and icons
Menu item text 14 pt Regular (menu font) [C] from the 19 pt row module. Icons: Reading List glasses, Bookmark book (template glyphs), Mail, Messages, AirDrop, Notes, Reminders app icons at 16 pt, More... as an ellipsis in a circle.

### Shadows and effects
Reuse the menu-class fitted shadow in `window-shadow` [C]; the share picker does not add a second popover shadow or arrow. The observed menu material remains backdrop-dependent [M] (colours above).

## Layout and spacing
Opens below the Share button like a pull-down menu; may extend beyond the window (here 67 pt past the right edge, over the desktop).

## Keyboard and accessibility
As `menu`: arrow keys, Return, Escape, type-select [D]. The button is an `AXMenuButton` titled "Share". ARIA: `button[aria-haspopup="menu"]` + `role="menu"` with `menuitem`s.

## Browser notes
Service icons are app icons (assets). The Web Share API cannot populate a custom menu; build the list statically.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Safari-v13-Sharing.png` | 2270,30,392,460 | Share button and open menu |
| dark | `10-15-Catalina-Dark-Safari-v13-Sharing.png` | 2290,20,394,450 | same |

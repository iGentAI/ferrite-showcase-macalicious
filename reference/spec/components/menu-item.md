# Menu item (`menu-item`)

- **Status:** present
- **AppKit:** `NSMenuItem` (`title`, `keyEquivalent`, `keyEquivalentModifierMask`, `state`, `image`, `isEnabled`, `isAlternate`, `submenu`, `NSMenuItem.separator()`, `indentationLevel`)
- **HIG:** https://web.archive.org/web/20200503171533/https://developer.apple.com/design/human-interface-guidelines/macos/menus/menu-anatomy/
- **Appearances shown:** light, dark

## Purpose and behaviour
A menu item starts an action, toggles a state, or opens a submenu. Titles use title-style capitalisation; an ellipsis marks items that need more input; a checkmark shows an on state, a dash a mixed state; unavailable items are dimmed, not removed (HIG, Menu Anatomy) [D].

## Anatomy
```
|<- 21 ->Title text ............ [mods][key]<-8.5->|   19 pt row (14 pt text)
|<-6->v<..>Title                                    |   checkmark column inside the 21 pt inset
|<- 21 ->[icon 16]<-5->Title ........ shortcut      |   21 pt row when the item has a 16 pt image
|<- 21 ->Title ................................ > <-12->|   submenu arrow
|===================================================|   separator item, 12 pt, 2 pt line
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| kind | command, separator, section header (disabled title), submenu parent | command | `NSMenuItem` / `.separator()` | all |
| state | off, on (checkmark), mixed (dash) | off | `state` | off, on (Print, Contacts); mixed not shown |
| image | none, 16 pt image, custom view | none | `image`, `view` | Go menu icons, battery menu app icons, user rows (32 pt avatars, custom view) |
| key equivalent | none or modifiers + key | none | `keyEquivalent` | many |
| enabled | yes/no | yes | `isEnabled` | both |
| font size | 14 (menu bar and contextual menus), 13 (regular pop-up menus), 12 (small) | 14 | `NSMenu.font` | 14, 13, 12 |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes | 10-15-Catalina-Light-Apple-Menu.png @ 20,476,416,38 (Lock Screen) |
| highlighted | yes | 10-15-Catalina-Light-Apple-Menu.png @ 20,52,416,38; 10-15-Catalina-Dark-Apple-Menu.png @ 20,52,416,38 |
| disabled | yes | 10-15-Catalina-Light-Finder-Menu.png @ 90,176,358,38 (Empty Trash...); 10-15-Catalina-Dark-Finder-Menu.png @ 90,300,358,38 (Hide Finder) |
| on (checkmark) | yes | 10-15-Catalina-Light-Print.png @ 975,306,488,36; 10-15-Catalina-Light-Contacts.png @ 976,432,190,34 (checked and highlighted) |
| mixed (dash) | no | [I] 8 x 1.5 pt horizontal bar centred in the checkmark box |
| with image | yes | 10-15-Catalina-Light-Finder-Go-Menu.png @ 482,190,402,462; 10-15-Catalina-Dark-Menu-Bar-Battery.png @ 2738,190,566,84 |
| section header | yes | 10-15-Catalina-Dark-Menu-Bar-Battery.png @ 2738,152,566,38 ("Using Significant Energy") |
| alternate (Option held) | no | [D] `isAlternate` items replace their neighbour while the modifier is held |
| each accent colour | yes | table below |
| pressed / chosen blink | no | [I] highlight turns off and on once (about 80 ms each) before the menu closes |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Row height, 14 pt menus | 19 (38 px: highlight y=52..89) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 400,52,1,38; 10-15-Catalina-Light-Finder-Go-Menu.png @ 488,128,1,38 |
| Row height with a 16 pt image | 21 (42 px: 11 rows fill y=190..651; highlight y=190..231 in the battery menu) | [M] | 10-15-Catalina-Light-Finder-Go-Menu.png @ 488,190,1,462; 10-15-Catalina-Dark-Menu-Bar-Battery.png @ 2744,190,1,42 |
| Row height, 13 pt pop-up menu | 18 (36 px: y=402..437) | [M] | 10-15-Catalina-Light-Print.png @ 981,402,1,36 |
| Row height, 12 pt small pop-up menu | 17 (34 px: y=432..465) | [M] | 10-15-Catalina-Light-Contacts.png @ 1106,432,1,34 |
| Row height, user row with 32 pt avatar | 34 (68 px: y=52..119) | [M] | 10-15-Catalina-Light-Fast-User-Switching-Menu.png @ 2674,52,1,68 |
| Text baseline (19 pt row) | 14 pt below the row top, 5 pt above the row bottom (L of "Lock Screen": ink y=484..503 in row 476..513) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 65,476,1,38 |
| Text baseline (21 pt row) | 15 pt below the row top | [M] | 10-15-Catalina-Light-Finder-Go-Menu.png @ 566,200,34,20 (Recents: cap rows 200..219 in row 190..231) |
| Left text inset | 21 (first ink column 22 pt: x=64 in a menu starting at 20) | [M] ink, [C] origin | 10-15-Catalina-Light-Apple-Menu.png @ 60,495,12,1 |
| Image position | 16 x 16 pt at x=21 (ink px 524..555 in a menu starting at 482), vertically centred (2.5 pt above and below in the 21 pt row) | [M] | 10-15-Catalina-Light-Finder-Go-Menu.png @ 524,321,32,32 (Downloads) |
| Text inset after an image | 42 (ink from px 565/566 = 21 + 16 + 5 gap) | [M] | 10-15-Catalina-Light-Finder-Go-Menu.png @ 566,326,33,20 |
| Checkmark position | ink starts 6 pt from the menu's left edge (px 987 in a menu at 975), 9 x 9 pt box at 13 pt, 8.5 x 8.5 pt at 12 pt | [M] | 10-15-Catalina-Light-Print.png @ 987,314,18,18; 10-15-Catalina-Light-Contacts.png @ 990,441,17,17 |
| Key equivalent: key glyph column | left-aligned 18 pt from the menu's right edge (key ink starts 36 px from the edge: Q at 399 with edge 435; H at 412 with edge 447; F at 848 with edge 883) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 399,483,20,24; 10-15-Catalina-Light-Finder-Menu.png @ 412,307,17,21; 10-15-Catalina-Light-Finder-Go-Menu.png @ 848,199,13,21 |
| Key equivalent: modifier glyphs | right-aligned against the key column: Command ink 11 pt wide ending 20.5 pt from the right edge (px 373..394 / edge 435); next modifier 14.5 pt further left (Shift ink 344..367, Option 342..365, Control 351..366) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 342,283,81,22 (Force Quit); 344,520,75,25 (Log Out) |
| Right margin of the widest key | 8.5 (Q ink ends px 418, edge 435); narrow keys leave more | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 399,483,20,24 |
| Submenu arrow | filled triangle 9 x 10 pt (ink px 394..411, y=223..242), right inset 12 pt (edge 435), vertically centred | [M] | 10-15-Catalina-Dark-Apple-Menu.png @ 392,220,22,24 |
| Separator item height | 12 (24 px: y=90..113) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 400,90,1,24 |
| Separator line | 2 pt thick (4 px: y=100..103), 5 pt above and below, full menu width (x=20..435) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 26,98,1,8; 18,101,12,1; 428,101,10,1 |
| Highlight extent | full row height and full menu width, square (x=20..435) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 0,66,460,1 |

Glyph geometry (pt, origin at the top-left of the glyph box) [M]:
- Checkmark, 12 pt menu (8.5 x 8.5 box): polyline (0.25,4.0) -> (3.5,7.75) -> (7.5,0.25), stroke 1.5, butt ends. Evidence 10-15-Catalina-Light-Contacts.png @ 986,436,26,26 (ink px 990..1006, 441..457). Scale to 9 x 9 for 13 pt and about 9.7 x 9.7 for 14 pt menus [C].
- Submenu arrow (9 x 10 box): polygon (0,0) (9,5) (0,10); in px the left edge is x=394, the apex x=411 at y=233. Evidence 10-15-Catalina-Dark-Apple-Menu.png @ 392,220,22,24.

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title text, normal, over a neutral backdrop | `#34383b (sRGB #33383b)` (on fill `#eceded`); `#3c3b3d` (on `#eff0f0`) | `#ffffff` | [M] | 10-15-Catalina-Light-Print.png @ 1028,366; 10-15-Catalina-Light-Contacts.png @ 1016,528,115,28 (darkest); 10-15-Catalina-Dark-Print.png @ 1112,318 |
| Title text, normal, over the Day sky | `#042340 (sRGB #002342)`..`#1b3441 (sRGB #123542)` (vibrant: darker and bluer than over grey) | `#ffffff` | [M] | 10-15-Catalina-Light-Finder-Menu.png @ 137,122; 10-15-Catalina-Light-Apple-Menu.png @ 65,484,2,20; 10-15-Catalina-Dark-Apple-Menu.png @ 65,484 |
| Title text recipe | `rgba(0,0,0,0.85)` over the material (gives `#232323`-`#353535` on grey); exact vibrant result is backdrop dependent | `#ffffff` | [C]/[I] | from the two rows above |
| Disabled text | `#80a1ba (sRGB #78a2bd)` on fill `#badbf3 (sRGB #b2dcf6)`; `#7a9bb6 (sRGB #729cb9)` on `#b6d6f0 (sRGB #afd7f3)`; `#88a0b5 (sRGB #82a0b7)` on `#c4daee (sRGB #bfdaf0)` = about 32 % of the normal text over the fill | `#7488a3 (sRGB #7088a6)` on fill `#324461 (sRGB #2e4464)`; `#6f829d (sRGB #6b82a0)` on `#2c3e5b (sRGB #283e5e)`; `#5f728a (sRGB #5b728c)` on `#1e2d47 (sRGB #1a2d49)` = white at about 0.33 | [M] composites, [C] ratio | 10-15-Catalina-Light-Finder-Menu.png @ 180,189; 10-15-Catalina-Light-Finder-Go-Menu.png @ 537,61; 10-15-Catalina-Light-Menu-Bar-Battery.png @ 2777,61; 10-15-Catalina-Dark-Finder-Menu.png @ 136,321; 10-15-Catalina-Dark-Finder-Go-Menu.png @ 527,66; 10-15-Catalina-Dark-Menu-Bar-Battery.png @ 2787,79 |
| Disabled recipe | `rgba(0,0,0,0.26)` | `rgba(255,255,255,0.33)` | [C] | 0.32 x 0.85 in light; ratio above in dark |
| Section header text | same as disabled text (`#8fa2b9 (sRGB #8ba2bb)` on `#c8def0 (sRGB #c3def2)`) | same as disabled (`#64738b (sRGB #61738d)` on `#1f2f49 (sRGB #1b2f4b)`) | [M] | 10-15-Catalina-Light-Menu-Bar-Battery.png @ 2781,161; 10-15-Catalina-Dark-Menu-Bar-Battery.png @ 3074,166 |
| Highlight fill (blue), over neutral backdrops | `#5a92f1 (sRGB #4b91f8)` (over white window), `#528def (sRGB #418cf7)` (over sheet) | `#2969ce (sRGB #0967d5)` (over dark window), `#2d6fd7 (sRGB #0e6dde)` (over dark sheet) | [M] | 10-15-Catalina-Light-Contacts.png @ 1108,432,1,34; 10-15-Catalina-Light-Print.png @ 981,402,1,36; 10-15-Catalina-Dark-Contacts.png @ 1156,478,1,38; 10-15-Catalina-Dark-Print.png @ 895,372,1,36 |
| Highlight fill (blue), over wallpaper | `#3e7de7 (sRGB #297bef)` (Apple menu), `#4180e9 (sRGB #2c7ff1)` (Go), `#4885ec (sRGB #3584f4)` (battery), `#4583ea (sRGB #3182f2)` (Time Machine) | `#2c6dd5 (sRGB #0e6bdc)` (Apple), `#2b6dd4 (sRGB #0a6bdb)` (Go), `#2766c8 (sRGB #0664cf)` (battery), `#2867ca (sRGB #0865d1)` (Time Machine) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 400,52,1,38; -Light-Finder-Go-Menu @ 488,128,1,38; -Light-Menu-Bar-Battery @ 2728,252,1,38; -Light-Time-Machine-Menu @ 2524,190,1,38; dark: same coordinates except battery 2744,190,1,42 and Time Machine 2540,190,1,38 |
| Highlight recipe | accent `#377bee (sRGB #1d79f6)` at 0.82 over the blurred backdrop (replaces the menu tint under the row) | accent `#2a73e6 (sRGB #0071ee)` at 0.88 | [C] | solved from the white-backdrop and sky-backdrop composites above |
| Highlighted text, key equivalent, arrow, checkmark | `#ffffff` | `#ffffff` | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 68,66; 10-15-Catalina-Light-Contacts.png @ 1003,446 |
| Key equivalent glyphs, normal | same colour as the title | same | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 400,490 `#264150 (sRGB #1d4152)`..`#173441 (sRGB #0b3542)` (Q) |
| Separator line | fill darkened: `#dbdcde` on `#ebecee`; `#a8c9e2 (sRGB #a0cae5)` on `#b7d9f2 (sRGB #afdaf5)` = about `rgba(0,0,0,0.07)` | fill lightened: `#5f6265 (sRGB #5e6265)` on `#3b3e41 (sRGB #3a3e41)`; `#506380 (sRGB #4c6383)` on `#2d3f5c (sRGB #293f5f)` = about `rgba(255,255,255,0.18)` | [M] composites, [C] alpha | 10-15-Catalina-Light-Print.png @ 1100,388,8,4; 10-15-Catalina-Light-Apple-Menu.png @ 200,100,8,4; 10-15-Catalina-Dark-Print.png @ 1000,358,8,4; 10-15-Catalina-Dark-Apple-Menu.png @ 200,100,8,4 |
| Item image (Go menu) | monochrome template glyphs in the title colour | white | [M] | 10-15-Catalina-Light-Finder-Go-Menu.png @ 524,197,32,450; 10-15-Catalina-Dark-Finder-Go-Menu.png @ 524,197,32,450 |

Highlight fill per accent colour, item row of the System Preferences menu (mean 6x6 px at 94,54 of `10-15-Catalina-Theme-<Wallpaper>-<Accent>.png`) [M]:

| Accent | Light (Day) | Morning | Evening | Dark |
|---|---|---|---|---|
| Blue | `#3e7de7 (sRGB #297bef)` | `#4986ec (sRGB #3685f4)` | `#2e6dd8 (sRGB #156be0)` | `#2c6dd5 (sRGB #0e6bdc)` |
| Purple | `#925698 (sRGB #9c509c)` | `#9a60a0 (sRGB #a45ba4)` | `#824689 (sRGB #8c408d)` | `#793e80 (sRGB #823884)` |
| Pink | `#e06ba1 (sRGB #f160a3)` | `#e675a9 (sRGB #f76bab)` | `#d15b92 (sRGB #e14f94)` | `#c65388 (sRGB #d6478a)` |
| Red | `#cd5856 (sRGB #dd4e51)` | `#d46260 (sRGB #e4595c)` | `#be4746 (sRGB #cd3b41)` | `#b3403f (sRGB #c2343a)` |
| Orange | `#e38f4c (sRGB #f08b3a)` | `#e99857 (sRGB #f69447)` | `#d47f3c (sRGB #e17b26)` | `#c97635 (sRGB #d6721e)` |
| Yellow | `#ecbb5b (sRGB #f4ba45)` | `#f1c265 (sRGB #f9c151)` | `#ddab4b (sRGB #e5aa31)` | `#d1a143 (sRGB #d9a027)` |
| Green | `#82b865 (sRGB #70bb59)` | `#8bbf6f (sRGB #7bc264)` | `#72a955 (sRGB #5fac48)` | `#6a9f4d (sRGB #58a240)` |
| Graphite | `#939393` | `#9c9c9c` | `#848484` | `#66748a (sRGB #63748c)` |

(The Evening screenshots use the dark highlight with a light menu because the appearance was Auto during the transition; treat the Light and Dark columns as canonical.)

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title font, menu bar menus | SF Pro Text 14 pt Regular (cap height 20 px, stem 2 px + edge) | same | [C] | 10-15-Catalina-Light-Apple-Menu.png @ 65,484,1,20; 60,495,12,1 |
| Title font, pop-up button menu | 13 pt Regular (18 pt rows; ascender-to-baseline 20 px) | same | [C] | 10-15-Catalina-Light-Print.png @ 1019,408,192,20 |
| Title font, small pop-up menu | 12 pt Regular (17 pt rows; "home" 18 px) | same | [C] | 10-15-Catalina-Light-Contacts.png @ 1022,406,60,18 |
| Key equivalent font | 14 pt Regular, same baseline; glyphs: Shift U+21E7, Control U+2303, Option U+2325, Command U+2318, then the key (upper-case letter, or symbols such as U+232B delete, U+2191 up arrow, U+238B escape in Force Quit) | same | [M] presence, [D] glyph set (AppKit key equivalents) | 10-15-Catalina-Light-Apple-Menu.png @ 342,283,81,22; 10-15-Catalina-Light-Finder-Menu.png @ 356,182,86,22 |
| User-row name (fast user switching) | 14 pt Regular at x=65 pt (ink px 2796 in a menu at 2666), avatar 32 pt circle at x=24 pt | same | [M] | 10-15-Catalina-Light-Fast-User-Switching-Menu.png @ 2714,54,64,64; 2796,76,118,21 |
| Current-user badge | 14 pt filled circle with a checkmark at x=5 pt (ink px 2676..2703), row text dimmed like a disabled item | same geometry | [M] | 10-15-Catalina-Light-Fast-User-Switching-Menu.png @ 2676,140,28,28 |

### Shadows and effects
None on items.

## Layout and spacing
- Items stack with no gaps; the row height is font size + 5 pt (14 -> 19, 13 -> 18, 12 -> 17) and grows to 21 pt when the item has a 16 pt image [M].
- The menu width is 21 + widest title + (if any key equivalents: 20-28 pt gap + modifier glyphs + 18 pt key column) or + 12 pt arrow inset; the narrowest measured right text margin is 20.5 pt (Time Machine menu, last ink 3000 px, edge 3041) [M] 10-15-Catalina-Light-Time-Machine-Menu.png @ 2561,259,440,26.
- Indented items add 11 pt per `indentationLevel` [D] (AppKit).

## Keyboard and accessibility
Key equivalents fire without opening the menu and briefly highlight the menu title [D]. AX role `AXMenuItem` (`AXMenuItemCmdChar`, `AXMenuItemCmdModifiers`, `AXMenuItemMarkChar`). ARIA: `menuitem`, `menuitemcheckbox` (`aria-checked`), `aria-disabled`, `aria-keyshortcuts`, `aria-haspopup` for submenu parents.

## Browser notes
- The shortcut glyphs exist in SF Pro; on other platforms fall back to a font that has U+2318, U+2325, U+2303, U+21E7 (for example "Apple Symbols", "Segoe UI Symbol").
- Use a three-column grid per row (state/image | title | key equivalent) with the key column fixed at 18 pt and modifiers right-aligned, so letters line up as in AppKit.
- Vibrant text/selection colours are approximated with the neutral-backdrop values.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Apple-Menu.png | 20,44,416,516 | normal, highlighted, separators, arrow, key equivalents |
| dark | 10-15-Catalina-Dark-Apple-Menu.png | 20,44,416,516 | same, dark |
| light | 10-15-Catalina-Light-Finder-Menu.png | 90,44,358,378 | disabled items |
| dark | 10-15-Catalina-Dark-Finder-Menu.png | 90,44,358,378 | disabled items, dark |
| light | 10-15-Catalina-Light-Finder-Go-Menu.png | 482,44,402,778 | items with 16 pt images |
| dark | 10-15-Catalina-Dark-Menu-Bar-Battery.png | 2738,44,566,338 | section header and app-icon items |
| light | 10-15-Catalina-Light-Print.png | 975,298,488,244 | checkmark, 13 pt pop-up menu |
| light | 10-15-Catalina-Light-Contacts.png | 976,389,190,178 | checked + highlighted, 12 pt |
| light | 10-15-Catalina-Light-Fast-User-Switching-Menu.png | 2666,44,470,276 | user rows with avatars |

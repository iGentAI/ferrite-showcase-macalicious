# Handoff: group `system`

## Counts
- Screenshots viewed: **42 of 42** assigned (every preview opened with `view_files`; zoomed crops for menus, the fan stack, Desktop Stacks, the Contacts/Print pop-up menus). Additional screenshots opened for owned components: Theme-Morning-Blue, Theme-Evening-Blue, Theme-Dark-Blue (previews) and all 32 Theme files numerically; Light/Dark-Contacts, Light/Dark-Print, Light-Safari-v13-Sharing (previews) for detached menus.
- Component files written: **25** (`reference/spec/components/`): menu-bar, menu-bar-extra, menu, menu-item, submenu, contextual-menu, dock, dock-stack, dock-menu, desktop, desktop-icon, desktop-stack, spotlight, notification-center, today-widget, notification-banner, launchpad, launchpad-folder, mission-control, app-switcher, siri, dictation, login-window, time-machine-browser, material.
- App blueprints written: **11** (`reference/spec/apps/`): desktop-and-dock, menu-bar-menus, spotlight, notification-center, launchpad, mission-control, app-switcher, siri, dictation, login-window, time-machine.
- Coverage: `reference/spec/coverage/system.json` (42 entries, valid JSON, all ids exist in seed.json, every `clean` entry has an in-bounds crop; checked by script).

## New components
None. Every element seen maps to a seed id. Sub-elements that could become their own inventory entries if the lead wants finer granularity (all currently specified inside the parent file):

| Candidate id | Apple name | Where specified now | Owner family |
|---|---|---|---|
| dock-separator / dock-running-indicator | Dock separator, running indicator | `dock` | system |
| page-indicator | Launchpad page dots | `launchpad` | system |
| nc-clear-button | Notification Center clear button | `notification-center` | system |
| user-menu-row | Fast user switching menu row (avatar + check badge) | `menu-item` | system |

## Token candidates
Stored colour values (not converted). pt units.

| Suggested token | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| menubar.height | 22 | 22 | [M] | 10-15-Catalina-Light-Desktop.png @ 600,0,1,46 |
| menubar.title.font | 14 pt Regular; app name Bold | same | [C] | 10-15-Catalina-Light-Apple-Menu.png @ 112,12,1,20; 237,12,1,20 |
| menubar.title.paddingX | 10 | 10 | [M] | 10-15-Catalina-Light-Finder-Go-Menu.png @ 482,0,74,44 |
| menubar.leadingInset | 10 | 10 | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 20,0,70,44 |
| menubar.baseline | 16 from top | same | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 112,12,1,20 |
| menubar.material | `rgba(255,255,255,0.67)`, saturate 1.7, blur 20 | `rgba(30,28,34,0.78)`, saturate 1.8, blur 20 | [C] tint, [I] blur | components/menu-bar.md |
| menubar.fill.default (opaque, default wallpaper) | `#c5e0f1 (sRGB #bfe1f3)` | `#1b2237 (sRGB #1a2239)` | [M] | 10-15-Catalina-Light-Desktop.png @ 1200,4,40,36; 10-15-Catalina-Theme-Dark-Blue.png @ 1200,4,40,36 |
| menubar.shadowLine | 1 pt `rgba(0,0,0,0.16)` | 1 pt `rgba(0,0,0,0.36)` | [C] | 10-15-Catalina-Light-Desktop.png @ 600,44; 10-15-Catalina-Dark-Desktop.png @ 600,44 |
| menubar.text | `#122d40 (sRGB #072d42)` (default wallpaper) / `rgba(0,0,0,0.85)` | `#ffffff` | [M] / [I] | 10-15-Catalina-Light-Desktop.png @ 112,12 |
| menubar.highlight (blue) | `#3f7ee7 (sRGB #2a7cef)` | `#2c6dd5 (sRGB #0e6bdc)` | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 23,0,1,44; 10-15-Catalina-Dark-Apple-Menu.png @ 23,0,1,44 |
| statusitem.highlight (blue) | `#518cef (sRGB #408bf7)` | `#2664c6 (sRGB #0662cd)` | [M] | 10-15-Catalina-Light-Time-Machine-Menu.png @ 2521,0,1,44; 10-15-Catalina-Dark-Menu-Bar-Battery.png @ 2741,0,1,44 |
| menu.radius | 5 (bottom corners only when attached) | 5 | [M] | 10-15-Catalina-Dark-Apple-Menu.png @ 17,546,16,16; 10-15-Catalina-Dark-Contacts.png @ 1145,429,15,14 |
| menu.paddingY | 4 | 4 | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 400,44,1,8 |
| menu.material | `rgba(234,234,234,0.70)`, blur 22, saturate 1.8 | `rgba(62,63,64,0.70)`, blur 22, saturate 2.2 | [C] | components/menu.md (fit vs the Desktop captures) |
| menu.fill.opaque | `#f0f0f0` | `#343536` | [M] | 10-15-Catalina-Light-Contacts.png @ 1106,390,1,42; 10-15-Catalina-Dark-Contacts.png @ 1156,435,1,42 |
| menu.border.inner | 0.5 pt `rgba(255,255,255,0.17)` | 1 pt `rgba(255,255,255,0.15)` | [C] | 10-15-Catalina-Light-Apple-Menu.png @ 20,150; 10-15-Catalina-Dark-Apple-Menu.png @ 20,150,2,1 |
| menu.border.outer | 0.5 pt `rgba(0,0,0,0.15)` | 0.5 pt `rgba(0,0,0,0.80)` | [C] | 10-15-Catalina-Light-Apple-Menu.png @ 436,300; 10-15-Catalina-Dark-Apple-Menu.png @ 436,300 |
| menu.shadow | `0 3px 14px rgba(0,0,0,0.31)` | same | [C] | components/menu.md shadow table |
| menuitem.height | 19 (14 pt); 18 (13 pt); 17 (12 pt); 21 with 16 pt image | same | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 400,52,1,38; 10-15-Catalina-Light-Print.png @ 981,402,1,36; 10-15-Catalina-Light-Contacts.png @ 1106,432,1,34; 10-15-Catalina-Light-Finder-Go-Menu.png @ 488,190,1,462 |
| menuitem.font | 14 pt Regular | same | [C] | 10-15-Catalina-Light-Apple-Menu.png @ 65,484,1,20 |
| menuitem.insetLeft / image / textAfterImage | 21 / 16 at 21 / 42 | same | [M] | 10-15-Catalina-Light-Finder-Go-Menu.png @ 524,321,32,32 |
| menuitem.keyColumn | key glyph left edge 18 from the right edge; Command ink ends 20.5 from the right | same | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 342,283,81,22 |
| menuitem.submenuArrow | 9 x 10 triangle, right inset 12 | same | [M] | 10-15-Catalina-Dark-Apple-Menu.png @ 392,220,22,24 |
| menuitem.checkmark | 9 x 9 box at x=6, stroke 1.5 | same | [M] | 10-15-Catalina-Light-Print.png @ 987,314,18,18; 10-15-Catalina-Light-Contacts.png @ 986,436,26,26 |
| menuitem.text | `#34383b (sRGB #33383b)` on neutral / `rgba(0,0,0,0.85)` | `#ffffff` | [M] / [C] | 10-15-Catalina-Light-Print.png @ 1028,366; 10-15-Catalina-Dark-Print.png @ 1112,318 |
| menuitem.text.disabled | `rgba(0,0,0,0.26)` (`#80a1ba (sRGB #78a2bd)` on `#badbf3 (sRGB #b2dcf6)`) | `rgba(255,255,255,0.33)` (`#7488a3 (sRGB #7088a6)` on `#324461 (sRGB #2e4464)`) | [M] composite, [C] alpha | 10-15-Catalina-Light-Finder-Menu.png @ 180,189; 10-15-Catalina-Dark-Finder-Menu.png @ 136,321 |
| menuitem.highlight (blue, neutral backdrop) | `#5a92f1 (sRGB #4b91f8)` (white) / `#528def (sRGB #418cf7)` (sheet) | `#2969ce (sRGB #0967d5)` / `#2d6fd7 (sRGB #0e6dde)` | [M] | 10-15-Catalina-Light-Contacts.png @ 1108,432,1,34; 10-15-Catalina-Light-Print.png @ 981,402,1,36; 10-15-Catalina-Dark-Contacts.png @ 1156,478,1,38; 10-15-Catalina-Dark-Print.png @ 895,372,1,36 |
| menuitem.highlight.recipe | accent `#377bee (sRGB #1d79f6)` at 0.82 | accent `#2a73e6 (sRGB #0071ee)` at 0.88 | [C] | components/menu-item.md |
| menuitem.highlight per accent (Day / Dark wallpaper) | blue `#3e7de7 (sRGB #297bef)`, purple `#925698 (sRGB #9c509c)`, pink `#e06ba1 (sRGB #f160a3)`, red `#cd5856 (sRGB #dd4e51)`, orange `#e38f4c (sRGB #f08b3a)`, yellow `#ecbb5b (sRGB #f4ba45)`, green `#82b865 (sRGB #70bb59)`, graphite `#939393` | blue `#2c6dd5 (sRGB #0e6bdc)`, purple `#793e80 (sRGB #823884)`, pink `#c65388 (sRGB #d6478a)`, red `#b3403f (sRGB #c2343a)`, orange `#c97635 (sRGB #d6721e)`, yellow `#d1a143 (sRGB #d9a027)`, green `#6a9f4d (sRGB #58a240)`, graphite `#66748a (sRGB #63748c)` | [M] | 10-15-Catalina-Theme-Light-<Accent>.png @ 94,54,6,6; 10-15-Catalina-Theme-Dark-<Accent>.png @ 94,54,6,6 |
| menu.separator | 12 pt item, 2 pt line, `rgba(0,0,0,0.07)` | `rgba(255,255,255,0.18)` | [M] geometry, [C] alpha | 10-15-Catalina-Light-Apple-Menu.png @ 26,98,1,8; 10-15-Catalina-Dark-Print.png @ 1000,358,8,4 |
| dock.height / tilePitch / tile / padding | 80 / 68 / 64 / 4 | same | [M] | 10-15-Catalina-Dark-Desktop.png @ 300,1940,1,160; 306,1960,380,112 |
| dock.separatorSlot | 30 wide, line 1 x 60 | same | [M] | 10-15-Catalina-Dark-Desktop.png @ 2768,1955,1,130 |
| dock.radius | 5 (top corners), 0 bottom | same | [M] | 10-15-Catalina-Dark-Desktop.png @ 279,1937,14,12 |
| dock.material | `rgba(255,255,255,0.27)`, saturate 1.7, blur 20 | `rgba(60,60,60,0.25)` [I] | [C] / [I] | components/dock.md |
| dock.fill.default | `#456689 (sRGB #3c668c)` | `#152137 (sRGB #122139)` | [M] | 10-15-Catalina-Light-Desktop.png @ 300,1945,8,6; 10-15-Catalina-Dark-Desktop.png @ 700,1945,8,6 |
| dock.border.inner | - | 1 pt `rgba(255,255,255,0.15)` | [C] | 10-15-Catalina-Dark-Desktop.png @ 300,1940,1,2 |
| dock.runningDot | 4 pt, `#000007 (sRGB #000008)` | 4 pt, `rgba(255,255,255,0.52)` (`#909bab (sRGB #8e9bad)`) | [M] | 10-15-Catalina-Light-Desktop.png @ 357,2091; 10-15-Catalina-Dark-Desktop.png @ 357,2091 |
| dock.separator.color | `#162d47 (sRGB #0f2d49)` (about `rgba(0,0,0,0.6)`) | `rgba(255,255,255,0.28)` (`#546375 (sRGB #516377)`) | [M]/[C] | 10-15-Catalina-Light-Desktop.png @ 2768,2000; 10-15-Catalina-Dark-Desktop.png @ 2768,2000 |
| stack.fan.pitch / pill.height / pill.paddingX / pill.radius | 64 / 26 / 16 / 4 | same (+1 pt outline) | [M] | 10-15-Catalina-Light-Stacks.png @ 2600,1818,1,53; 2496,1846,300,1 |
| stack.pill.fill | `rgba(255,255,255,0.58)` | `rgba(51,55,59,0.70)` | [C] | components/dock-stack.md |
| stack.pill.text | `#4c4c4c`, 13 pt | `#e3e3e3`, 13 pt | [M]/[C] | 10-15-Catalina-Light-Stacks.png @ 2529,1835; 10-15-Catalina-Dark-Stacks.png @ 2529,1846 |
| desktop.icon.size / gridPitchY / firstCell | 64 / 112 / centre 65.25 from right, 61.25 from top | same | [M] | 10-15-Catalina-Light-Desktop.png @ 3177,66,106,114 |
| desktop.label.font / color / shadow | 12 pt Bold / white / `0 1px 2px rgba(0,0,0,0.6)` | same | [C] | 10-15-Catalina-Light-Desktop.png @ 3141,211,1,22 |
| spotlight.size / radius / searchRow / list / preview | 680 x 430 / 6 / 56 / 289 / 390 | same | [M] | 10-15-Catalina-Dark-Spotlight.png (frame 112..1471 x 76..935) |
| spotlight.row / header | 26 / 16 | same | [M] | 10-15-Catalina-Dark-Spotlight.png @ 140,188,1,750 |
| spotlight.material | `rgba(224,222,218,0.65)`, blur 30, saturate 1.8 | base `#2b2c2d` | [C] / [M] | components/spotlight.md |
| spotlight.selection | `#3272dd (sRGB #1970e5)` | `#2d73e2 (sRGB #0971ea)` | [M] | 10-15-Catalina-Light-Spotlight.png @ 1010,566,1,52; 10-15-Catalina-Dark-Spotlight.png @ 140,222,1,52 |
| spotlight.queryFont / rowFont / headerFont | about 27 pt Light / 12 pt / 9 pt Semibold caps | same | [C] | components/spotlight.md |
| nc.width / header / footer / cardWidth / cardMargin / cardGap / cardRadius | 344 / 49 / 44 / 322 / 11 / 6 / 4 | same | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2655,1500,60,1; 2690,44,1,2056 |
| nc.material | `rgba(238,244,246,0.47)`, blur 25, saturate 1.7 | `rgba(58,58,56,0.42)`, blur 30, saturate 1.6 | [C] | components/notification-center.md |
| nc.card.fill (on panel) | `rgba(255,255,255,0.55)` | `rgba(0,0,0,0.21)` | [C] | components/today-widget.md |
| nc.segment.selected / unselected | `#eff6fc (sRGB #eef6fd)` / `#a5bcd0 (sRGB #a0bcd2)` | `#a6b8d6 (sRGB #a2b8d9)` / `#51617e (sRGB #4e6181)` | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2740,92; 3030,92; dark same |
| nc.widget.headerHeight / headerFont | 26 / 13 pt caps | same | [M]/[C] | 10-15-Catalina-Dark-Notification-Center-Today.png @ 3000,900,1,52 |
| nc.date.font | about 34 pt Thin, 38 pt pitch, `#466376 (sRGB #3e6478)` | `#a5b9dc (sRGB #a1b9df)` | [C]/[M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2764,519,282,50 |
| stocks.pill | 61 x 22, `#76d572 (sRGB #4bd964)` | same | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 3186,1495,1,42 |
| launchpad.grid | 7 x 5, column pitch 195, row pitch 166, icon 112, first column centre 254 | same | [M] | 10-15-Catalina-Light-Launchpad.png @ 448,387,2435,24 |
| launchpad.background | blur 30-45, saturate 1.8, `rgba(28,28,28,0.44)` | same | [C] | components/launchpad.md |
| launchpad.search | 250 x 25 at y=25, fill `rgba(255,255,255,0.07)`, border `rgba(255,255,255,0.2)` | same | [M]/[C] | 10-15-Catalina-Light-Launchpad.png @ 1430,50,500,50 |
| launchpad.pageDot | 8 pt, 20 pt pitch, `#ffffff` / `rgba(255,255,255,0.2)` | same | [M]/[C] | 10-15-Catalina-Light-Launchpad.png @ 1657,1836; 1697,1836 |
| launchpad.folder.panel | 1406 x 573 (3 rows), radius 30, `rgba(180,180,180,0.72)` blur 30 saturate 1.8 | same | [M]/[C] | 10-15-Catalina-Light-Launchpad-Folder.png @ 274,462,2812,1146 |
| missioncontrol.bar.height / thumb / pitch / ring | 146 / 144 x 90 / 176 / 3 pt `#5399f5 (sRGB #3b98fc)` with 1 pt gap | same | [M] | 10-15-Catalina-Light-Mission-Control.png @ 300,0,1,300; 985,140,1400,1 |
| missioncontrol.bar.fill | `#93cff8 (sRGB #82d0fc)` | `#2a4269 (sRGB #24426c)` | [M] | 10-15-Catalina-Light-Mission-Control.png @ 1040,262; 10-15-Catalina-Dark-Mission-Control.png @ 300,0 |
| appswitcher.panel | 440 x 186 (3 apps), radius 20, icon 128, pitch 133, padding 23/29 | same | [M]/[C] | 10-15-Catalina-Dark-Command-Tab.png @ 1240,864,880,372 |
| appswitcher.fill / selection | `#e5e5e3` / `rgba(0,0,0,0.15)` radius 8 | `#45484b (sRGB #44484b)` / `rgba(0,0,0,0.34)` | [M]/[C] | 10-15-Catalina-Light-Command-Tab.png @ 1262,1170; 1300,1170; 10-15-Catalina-Dark-Command-Tab.png @ 1262,1100; 1300,1100 |
| siri.window | 344 x 600, radius 7, chrome `#383838`, card 320 wide `#d6d6d6`, strips 28 / 59 | same | [M] | 10-15-Catalina-Light-Siri.png @ 38,36,688,1200 |
| dictation.hud | 84 x 95, mic area 63, Done area 31, pointer 10 x 19 | same | [M] | 10-15-Catalina-Light-Dictation.png @ 53,123,168,190 |
| login.avatar / field / cancel | 93 circle / 160 x 28 `rgba(255,255,255,0.38)` / 30 ring 1.5 pt | same | [M]/[C] | 10-15-Catalina-Light-Fast-User-Switching.png @ 1520,1022,320,56 |
| timemachine.button / arrowButton / tickPitch | 94 x 29 / 34 x 34 / 16 | same | [M] (button width [I]) | 10-15-Catalina-Light-Time-Machine.png @ 1470,1802,1,80; 2672,1092,90,1; 3350,1740,1,320 |

## Inferred values
By component (everything tagged [I] or [D] in the files; [C] values are listed in the token table):
- **menu-bar:** blur radius of the bar material (backdrop under the bar is never visible); neutral-page opaque fallbacks; disabled-title and inactive states; CSS approximation of vibrant title colour.
- **menu-bar-extra:** disabled glyph state; cell boundaries for Wi-Fi, AirPlay, clock, Spotlight, Siri and Notification Center are [C] from neighbouring measured highlights.
- **menu:** scroll-arrow row, open/close animation.
- **menu-item:** mixed-state dash, alternate items, chosen-item blink, 14 pt checkmark scale, `rgba(0,0,0,0.85)` text recipe, indentation step [D].
- **submenu:** everything about an *open* submenu (offsets, overlap, highlight of the parent, hover delay). No open submenu exists in the library.
- **contextual-menu:** not seen. All light values and the pointer-relative origin are [D]/[I]; dark geometry is measured on the closest analogue (a detached Contacts action menu).
- **dock-menu:** not seen. Entirely [D]/[I], including the claim that Catalina's Dock menus always use the dark material (from memory; flagged in the file).
- **dock:** dark material tint/alpha (dark backdrops too uniform to solve), neutral fallbacks, hover label, magnification, bounce.
- **dock-stack:** grid and list views, hover state, rotation of the upper fan items, thumbnail shadow.
- **desktop:** horizontal grid pitch (only one icon column exists), selection rectangle.
- **desktop-icon:** selected, renaming and dimmed states.
- **desktop-stack:** fan angles, sub-dimensions of the placeholder, light placeholder colours, scrub/selected states.
- **spotlight:** collapsed state, dark material alpha (window capture has no backdrop), preview body line pitch.
- **notification-center:** empty and edit states, footer gear geometry, neutral fallbacks.
- **today-widget:** stocks pill radius, summary line pitch and glyph, event bar, switch size (deferred to sysB `switch`), hover/edit states.
- **notification-banner:** hover and pressed states.
- **launchpad / launchpad-folder:** searching, pressed and jiggle states; label shadow; closed-tile geometry; rename state; the folder-open background recipe is a poor fit and marked approximate.
- **mission-control:** bar material recipe (no clean backdrop of that wallpaper), ring radius, hover states, collapsed bar, window extents.
- **app-switcher:** panel recipe alpha/blur (windows behind are not available un-covered).
- **siri:** chrome alpha, card corner radius, orb size, listening state. No HIG page was fetched (Siri is not under the macOS HIG section).
- **dictation:** corner radius, dark alpha, Done weight, pressed state, shadow.
- **login-window:** field radius, typing/error states, text shadow, name weight.
- **time-machine-browser:** background recipe, Restore-enabled state, button right edge/gap/radius, down-arrow offset, tick lengths.

## Not reproducible in a browser
| Item | Why | Closest approach |
|---|---|---|
| Behind-window vibrancy of real OS windows | a page cannot sample other windows | all surfaces live inside the demo desktop, so `backdrop-filter: blur() saturate()` + tint works; recipes in `material` |
| Vibrant text/selection blending (menu bar titles turn navy over blue sky; menu highlight shifts with the backdrop) | AppKit uses plus-darker/plus-lighter style blend filters per layer | fixed colours measured over the bundled wallpaper, or `rgba(0,0,0,0.85)` text and accent at 0.82 alpha |
| +-2 level dither on every material | renderer noise | ignore |
| 0.5 pt hairlines at 1x | sub-pixel | `box-shadow: 0 0 0 0.5px`; rounds to 1 px at 1x |
| Catalina dynamic desktop pictures, app icons, Siri orb, menu bar extra glyphs, Go-menu glyphs, avatars, thumbnails | Apple artwork | ship as licensed/substitute assets; note that material colours were measured over Apple's pictures |
| Command-Tab, Command-Space, Control-Up, Fn Fn triggers | reserved by the OS/browser | alternative shortcuts or on-screen triggers |
| Dictation and Siri function | speech services | static/animated mock |
| Live window thumbnails in Mission Control | no DOM snapshot API | clone and `transform: scale()` the window elements |
| SF Pro Text/Display (incl. key-equivalent glyphs) off Apple platforms | font licensing | `-apple-system`/system-ui stack; fall back to a symbol font for U+2318 U+2325 U+2303 U+21E7 U+238B U+232B |

## Open issues
- **No open submenu, contextual menu or Dock menu anywhere in the 294 screenshots** (checked the manifest's surface descriptions and all candidates I opened). These three are specified by reference to `menu` with [D]/[I] deltas.
- **Dock stack grid and list views, Dock magnification, Dock hover labels** are not shown.
- **Menu radius:** measured 5 pt on four menus (outline crossing the diagonal 3 px in); a build that uses 6 pt will be visibly rounder. Apparent radius read from the last straight pixel under-reads by about 1 pt, so 5-5.5 pt is the honest range.
- **Menu separators are 2 pt thick (4 px)** in every Catalina menu measured, not a hairline; easy to get wrong.
- **Status-item highlight differs from app-menu highlight** in the same appearance (`#518cef (sRGB #408bf7)` vs `#3f7ee7 (sRGB #2a7cef)` light; `#2664c6 (sRGB #0662cd)` vs `#2c6dd5 (sRGB #0e6bdc)` dark). I treat both as one translucent selection material over different backdrops; the lead may prefer two tokens.
- **Theme-Evening screenshots** show a light menu with the *dark* blue highlight (`#2e6dd8 (sRGB #156be0)`) and a differently enabled item set: an appearance-transition artefact; I treat Light and Dark columns as canonical.
- **Font sizes** for Spotlight (27 pt query, 12 pt rows, 9 pt headers), Notification Center date (34 pt), Launchpad folder title (28 pt), app-switcher label (15 pt), Siri temperature (56 pt) are [C] from ink heights with +-1 pt uncertainty where the sample letters have overshoot or ascenders; weights (Light/Thin) are judged by eye from crops.
- **Mission Control / Command-Tab captures use a different desktop picture** (a close-up coastal image), so their materials could not be fitted against a clean backdrop.
- **Time Machine**: Cancel/Restore button right edges and the down-arrow button were read from the half-scale preview, not pixel-measured.
- **Login window avatar** diameter is about 93 pt (px 1584..1769 at mid-height); the yin-yang's dark rim blends with the dark picture, so +-2 pt.
- Components of other families whose best or only examples are in my screenshots: translucent **segmented-control** variant (Notification Center header; sysA), **switch** on a translucent card (sysB), **secure-text-field** login style (sysB), **search-field** Launchpad style (sysB), **scope-bar** and focused **toolbar-search-field** (10-15-Catalina-Light-Spotlight-More.png; chrome), inactive vs key **window-controls/title-bar** side by side (Command-Tab captures; chrome), **ruler** (Dictation captures; views), **column-view** with preview inside Time Machine (views), **sidebar** over an inactive window (Command-Tab; views), **share-menu** container equals `menu` with 16 pt-image rows (chrome).

## Deviations from the assignment
- The assignment asked for the menu-bar material over "at least two different wallpapers": done for four (Day, Morning, Evening, Night), but the blur radius stays [I] because no screenshot shows the wallpaper under the bar.
- Sidebar material is listed in `material` only as a pointer to the views group (it is their component and I did not measure it).
- Siri: no HIG page fetched or cited (not part of the macOS section listed in the brief).
- HIG text was read from the copies already cached by another sub-agent in the scratch `hig/` folder (same archived snapshots, timestamps from its `log.txt`), not re-fetched.

## Concerns
- Recovered material recipes are least-squares fits with a simple model (Gaussian blur, linear saturation, one tint). Residuals are 0.4-3.6 levels where a clean backdrop exists; rows tagged [I] in `material` are educated estimates and should be tuned visually against the screenshots.
- Single-pixel evidence inside dithered fills can differ by 1-2 levels from the quoted run colour when re-sampled one pixel away; I re-sampled about 100 cited single pixels and corrected the mismatches found, but ranges (for example `#3e7de7 (sRGB #297bef)`..`#417fe8 (sRGB #2d7df0)`) are the reliable form.
- Many rectangle citations give the region scanned, not a region of uniform colour.

## Discoveries that affect other work
- The Desktop captures and most other full-screen captures share pixel-identical wallpaper, so any overlay (menus, Notification Center, Spotlight, Launchpad) can be differenced against `10-15-Catalina-Light-Desktop.png` / `-Dark-Desktop.png` to extract exact shadows and material recipes. Other groups can use the same trick for window shadows over the desktop.
- Row height rule for menus: font size + 5 pt (14 -> 19, 13 -> 18, 12 -> 17); +2 pt when the item carries a 16 pt image. This also governs pop-up button menus (sysA) and the Share menu (chrome).
- `reference/spec/components/dialog.md` (another group) cites `10-15-Catalina-Light-Finder-Open-iCloud.png @ 1646,1245,152,42`, which lies outside that 1822 x 1120 image (found by my bounds check; not edited).

## Assumptions made in place of questions
- "notification-banner" is specified as the card in the Notification Center list (as the seed describes); the on-screen banner/alert stays with the dialogs group's `notification-alert`.
- The Contacts field-label action menu is used as the stand-in for a contextual menu's container geometry.
- Evidence for values derived from scans is given as the scanned rectangle; values for dithered fills are the first colour of the run.
- Catalina's checkmark for 14 pt menus is assumed to scale linearly from the measured 12 pt and 13 pt instances.

## Acceptance checklist
- 42/42 screenshots viewed and listed in coverage: met.
- One component file per owned id (25): met; `contextual-menu` and `dock-menu` carry `Status: not seen`.
- 11 blueprints: met.
- Every value tagged; measured values cite screenshot and coordinates: met to the best of my checking (script confirmed all 1,298 evidence references in components/ and apps/ are inside their images, except the one in another group's file noted above).
- Unfinished: nothing structural; the [I] items above are the remaining gaps.

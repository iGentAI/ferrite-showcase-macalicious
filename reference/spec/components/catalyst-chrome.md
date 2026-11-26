# Mac Catalyst app chrome (`catalyst-chrome`)

- **Status:** present
- **AppKit:** UIKit for Mac (Mac Catalyst, macOS 10.15): a `UIWindowScene` hosted in an `NSWindow` with a unified `NSToolbar` (`UITitlebar.toolbar`), `UISplitViewController` primary column drawn as a sidebar, `UITableView` / `UICollectionView` content. News, Stocks, Home and Voice Memos (introduced in 10.14) use this stack.
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/ios/overview/mac-catalyst/ ; toolbars https://web.archive.org/web/20200503121036/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/toolbars/ ; sidebars https://web.archive.org/web/20200503160808/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/sidebars/
- **Appearances shown:** light, dark

## Purpose and behaviour
An iPad app running in a Mac window. The window frame, title bar, toolbar, traffic lights and menus are native AppKit; everything below the toolbar is the iPad view hierarchy. "To ensure that your text and interface elements are consistent with the macOS display environment, iOS views automatically scale down to 77%" [D, HIG Mac Catalyst], which is why content metrics are fractional in Mac points: an iOS 17 pt body renders at 13.1 pt, a 34 pt large title at 26.2 pt, a 44 pt row at 33.9 pt [C]. The HIG also asks Catalyst apps to move navigation to a sidebar, commands to the menu bar and toolbar, and to avoid iOS tab bars [D].

## Anatomy
```
+--------------------------------------------------------------------------+
|(o)(o)(o) [<] [sb]                 Title                     [share][Search]| 38 pt toolbar (AppKit)
+----------------+---------------------------------------------------------+
| Header         |                                                         |
| [i] Row        |   UIKit content scaled to 77%                           |
| [i] Row  (sel) |   (large titles, cards, tiles, custom controls)         |
+----------------+---------------------------------------------------------+
  sidebar (News 227 / Stocks 330)
```
1. Standard window frame and shadow (`window`, `window-shadow`).
2. Unified toolbar, 38 pt, with standard 39 x 23 pt toolbar buttons; the window title is centred in the toolbar row (News, Stocks, Voice Memos) or replaced by a centred segmented control (Home).
3. Optional sidebar (News, Stocks) with a hairline divider.
4. Content: full-bleed UIKit view; it may extend under a translucent toolbar (Home, Voice Memos).

## Variants and parameters
| Parameter | Values | Shown in screenshots |
|---|---|---|
| sidebar | none (Home, Voice Memos), source list (News), custom list (Stocks) | all |
| toolbar row | present, 38 pt (News, Stocks, Home, Voice Memos); absent, with the window controls over a full-height sidebar (Find My) | both |
| toolbar centre | window title (News, Stocks, Voice Memos); segmented control (Home) | both |
| toolbar leading items | back button (News, Stocks), sidebar toggle (News), pull-down (Home) | all |
| toolbar trailing items | share button (News, Stocks), search field (News), add button (Home), trim button (Voice Memos) | all |
| content appearance | follows system (News, Stocks); always dark (Voice Memos); wallpaper (Home) | all |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| key window, light and dark | yes | all eight files |
| inactive window | no | [I] toolbar flattens to `#f6f6f6` / `#2b2d2f` and controls grey out as in `media-app-chrome` (Books) |
| toolbar button disabled | yes | back and share buttons in News and Stocks (glyph `#acacac`) |
| toolbar button enabled | yes | News sidebar toggle (glyph `#565656`), Home add button |
| sidebar row selected | yes | News `Today` |
| iOS switch, slider, stepper, iOS segmented control | no | none of the four captures shows one; see "iOS-style controls" below for [I] values |
| scroll indicator | yes (News dark only) | `10-15-Catalina-Dark-News.png @ 2608,231,18,242` |

## Measurements
Evidence shorthand: `News`, `Stocks`, `Home`, `Voice Memos`, `Podcasts` before `@` (or before `row y=` / `col x=`) mean `10-15-Catalina-Light-<App>.png` (`Voice Memos` = `Voice-Memos`); `Dark` or `Dark-<App>` means `10-15-Catalina-Dark-<App>.png`; where a row gives both a Light and a Dark value with one location, the location holds in both files.

Window origin is image px (112, 76) in all eight files; values are pt from the window's top-left.

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Window frames | News 1222 x 842 (Light), 1257 x 842 (Dark); Stocks 1148 x 803; Home 914 x 768; Voice Memos 789 x 630 | [M] | `info` frame boxes: News `@ 112,76,2444,1684` / `@ 112,76,2514,1684`; Stocks `@ 112,76,2296,1606`; Home `@ 112,76,1828,1536`; Voice Memos `@ 112,76,1578,1260` |
| Toolbar height | 38 (37 + two 0.5 pt separator lines) in all four apps | [M] | News col x=700: y=76..149, lines 150, 151; same rows in Stocks col x=600, Home col x=500, Voice Memos col x=300 |
| Traffic lights | x 13, 33, 53; y 13 (12 pt circles, centred in the toolbar) | [M] | News row y=114: 138..161, 178..201, 218..241; col x=150: 102..125 |
| Without a toolbar row (Find My; window origin image px 112,76, Dark 68,52) | traffic lights x 8, 28, 48; y 5 (centred 11 pt down, the place of a 22 pt title bar's); sidebar 261 wide over the window's whole height, then a 1 pt line; two highlight rows along the window's top edge | [M] | `10-15-Catalina-Light-Find-My.png @ 112,76,600,72`: close button 128..151 x 86..109; line columns 634, 635; `10-15-Catalina-Dark-Find-My.png @ 68,52,600,72` (window not key) |
| Toolbar button | 39 x 23 (22 + bottom edge), y 7.5 | [M] | News back button `@ 267,91,78,46` |
| Back button | x 77.5 (24.5 pt after the zoom button) | [M] | News and Stocks x=267..344 |
| Sidebar toggle (News) | x 123.5 (7 pt after the back button) | [M] | News x=359..436 |
| Pull-down (Home: house glyph + chevron) | x 77.5, 47 x 23 | [M] | Home row y=100: 267..360 |
| Trailing button inset | 7.5 from the window's right edge | [M] | Stocks share x=2315..2392 (window ends 2407); Home add x=1847..1924 (1939); Voice Memos trim x=1597..1674 (1689); News search ends 2540 (2555) |
| News share button / search field | share 39 wide, then 7 pt gap, search 161 x 22 | [M] | News share x=2127..2204; search `@ 2219,91,322,46` |
| Centred title | SF Pro Text 13 pt, centred on the toolbar row; cap top y 14.5 | [M]/[C] | News `@ 1303,105,64,19`; Voice Memos `@ 799,104,204,25` |
| Home segmented control | x 312, y 7.5, 290 x 23; three 96.5 pt segments; centred in the window | [M] | Home `@ 736,91,580,46`; boundaries x=929, divider 1121..1122 |
| News sidebar width | 227 (Light), 234 (Dark, wider window) | [M] | News row y=400: 112..565; Dark 112..579 |
| Stocks sidebar width | 330 | [M] | Stocks row y=250: 112..771 |
| Sidebar divider | 1 pt | [M] | News x=566..567; Dark x=580..581 then a black px at 583 |
| News group header | 11 pt Semibold, left inset 8, cap top 13.5 pt below the toolbar | [M]/[C] | `Apple News` `@ 128,178,126,21`; cap 16 px |
| News row pitch | 26 | [M] | icon tops y=265, 317, 369 |
| News selection | 27 tall, full sidebar width, square | [M] | col x=500: y=204..257 |
| News row icon | 18.5 x 18.5 rounded square (app-icon shape), left inset 18 | [M] | `@ 148,265,37,37` |
| News row text | 13 pt Regular, starts 43 pt from the window edge | [M]/[C] | `S` of Saved `@ 198,274,15,19` |
| News group spacing | header cap top 18.5 pt below the previous row's icon | [M] | 405 -> 442 |
| Scroll indicator (UIKit) | 6 pt wide pill, 1.5 pt from the window edge, with a 0.5 pt lighter outline; length 117 pt here | [M] | `Dark-News` row y=400: fill 2611..2622, outline 2609 and 2624; col x=2612: 235..468 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Toolbar over white/dark content (News) | gradient `#e5e5e5` -> `#cdcdcd`; lines `#bebebe`, `#a6a6a6` | top rows `#848486`, `#757578`; gradient `#3f4041` -> `#333435`; lines `#292a2a`, `#000000` | [M] | News `@ 700,78`, `@ 700,149`, `@ 700,150`, `@ 700,151` (both files) |
| Toolbar (Stocks) | `#e4e4e4` -> `#cccbcc` | `#37393a` -> `#2d2f30`; lines `#242626`, `#000000` | [M] | Stocks `@ 600,78`, `@ 600,149` |
| Toolbar over the sidebar's column, against the same rows over the content | `#e3e3e3` beside `#e4e4e4` (one level: not drawn) | `#37393a` beside `#3e3f41` at the top, `#2e2f30` beside `#333435` at the bottom: black at 10 to 11%. The change is gradual and lies before the column's edge, half-way 24 to 26 pt before it (row y=88, Stocks: `#363839` to x=644, `#3d3e3f` from x=832, edge at x=772; News: `#36383a` to x=452, `#3d3e40` from x=604, edge at x=580) | [M]/[C] | Stocks col x=300 and col x=900, both files; `Dark-Stocks` row y=88; `Dark-News` row y=88 |
| Toolbar over black content (Voice Memos) | `#bcbcbc` -> `#a3a3a3`; lines `#949494`, `#807f7f` | `#393a3c` -> `#2e2f30`; lines `#252626`, `#000000` | [M] | Voice Memos col x=300 |
| Toolbar over the Home wallpaper | `#bed8e0 (sRGB #b8d9e1)` -> `#a6c1c9 (sRGB #a0c2ca)`; lines `#97b2b9 (sRGB #90b3ba)`, `#809ba3 (sRGB #799ca4)` | `#445d65 (sRGB #3d5e66)` -> `#374c52 (sRGB #314d53)`; lines `#2c3c42 (sRGB #283c43)`, `#000000` | [M] | Home col x=500 |
| Toolbar material, recovered | gradient `#e0e0e0` -> `#c3c3c3` at alpha 0.84 over the content beneath | about `#474849` -> `#3a3b3c` at alpha 0.8 | [C] | solved from the News (white content) and Voice Memos (black content) pairs above |
| Toolbar button (enabled) | fill `#fcfcfc` -> `#f3f3f3`, top edge `#c9c8c9`, bottom edge `#9e9e9d`, glyph `#565656` | fill `#626466` -> `#5c5e60`, top edge `#7d7e80`, glyph `#f2f4f6` | [M] | News col x=300 (both files); row y=114 @ 383, 393 |
| Toolbar button (disabled) glyph | `#acacac` | `#868789` | [M] | News row y=114 @ 298..300 (both files) |
| Title text | `#494949` | `#b6b7ba` | [M] | News `@ 1303,105,64,19`; Dark `@ 1338,105,63,19` |
| Home segment, selected | fill `#5d6c6f (sRGB #596c70)` -> `#536264 (sRGB #4f6364)`, text `#ffffff` | fill `#ceebf0 (sRGB #c7ecf1)` -> `#c6e0e4 (sRGB #c0e1e5)`, text `#3e585e (sRGB #37595f)` | [M] | Home col x=800 (both files) |
| Home segment, unselected | fill `#fbfcfc` -> `#eff2f3 (sRGB #eef2f3)`, text `#545556`, divider `#dfe1e2` | fill `#708e93 (sRGB #688f94)` -> `#698387 (sRGB #628488)`, text light | [M] | Home col x=1000; row y=100 @ 1121 |
| Sidebar background | News `#e7e8e9`; Stocks `#e7e8e9` | News `#2c2d30`; Stocks `#2c2d2f` | [M] | News `@ 300,700` (both); Stocks `@ 130,172`, Dark `@ 600,155` |
| Sidebar background and line, Find My (a translucent material; values over the captures' backdrop) | fill `#f8f7f4`; line `#e0dfdc`, `#e9e7e1` (two half points), then the map `#f9f5ed` | fill `#1f2021`; line `#353637`, `#323334`, then the map `#2b2d2f` | [M] | `10-15-Catalina-Light-Find-My.png @ 400,276` and row y=90 @ 634, 635; `10-15-Catalina-Dark-Find-My.png @ 356,452` and row y=60 @ 590, 591 |
| Sidebar divider | News `#a9a9a9` then `#c8c9cb`; Stocks `#d9dada` | News `#4e4f51` then `#000000`; Stocks `#313334` then `#151515` | [M] | News `@ 566,700`, `@ 568,700`; Dark `@ 580,700`, `@ 583,700`; Stocks `@ 771,1000`, Dark `@ 771,1000`, `@ 772,1000` |
| Sidebar divider (Stocks), as a recipe | the column's last half point at black 4.5% over the fill (`#dcdddd` over `#e7e8e9`), nothing after it | `#2a2b2d` over `#2c2d2f`, then the content | [M]/[C] | Stocks row y=170 @ 771, both files |
| Sidebar selection (News) | `#c7c8c9` | `#505154` | [M] | News `@ 300,230` (both) |
| Sidebar row text (News) | `#191919` (selected `#101010`) | `#e8e8e8` (selected `#efefef`) | [M] | `@ 198,274,79,19`; `@ 197,221,70,25` |
| Sidebar group header (News) | `#69696a` | `#adaeaf` | [M] | `@ 128,178,126,21` |
| Content background | News `#ffffff`; Stocks `#ffffff`; Voice Memos `#000000` | News `#1e1e1e`; Stocks `#1e1e1e`; Voice Memos `#000000` | [M] | News `@ 700,153`; Stocks row y=250; Voice Memos `@ 300,180` |
| Scroll indicator | not shown | fill `#0f0f0f`, outline `#3c3c3c` | [M] | `Dark-News` col x=2612 |
| iOS system red (Voice Memos) | `#ef4e3e (sRGB #ff3b30)` | `#ef4e3e (sRGB #ff3b30)` | [M] | Voice Memos `@ 901,500` (both) |
| iOS system green / red (Stocks badges) | `#65c366 (sRGB #35c759)` / `#ec4d3d (sRGB #ff3b30)` | same | [M] | Stocks `@ 745,395`, `@ 745,877`; Dark `@ 745,395`, `@ 745,975` |
| Link / tint blue | `#2f7cf6 (sRGB #027aff)` | `#2f7cf6 (sRGB #027aff)` | [M] | Podcasts `See All` (see `card-grid`) |

### Text and icons
Measured content type sizes (cap height in image px, size in Mac pt, and the iOS size that gives it at 77%):

| Role | Cap px | Mac pt | iOS pt x 0.77 | Weight | Tag | Evidence |
|---|---|---|---|---|---|---|
| Home large title (`Home`) | 37 | 26 | 34 | Bold | [C] | Home `@ 146,245,32,37` |
| Home status lines | 26 | 18.5 | 24 | Bold | [C] | Home `@ 144,349,20,26`; line pitch 22 pt |
| Home section header | 17 | 12 | 15-16 | Semibold | [C] | Home `@ 144,697,11,17` |
| Home tile title (scene) | 19-20 | 14 | 18 | Semibold | [C] | Home `@ 1105,773,15,20` |
| Home tile text (accessory) | 17 | 12 | 15-16 | Bold | [C] | Home `@ 605,1150,18,17` |
| Stocks / News `Top Stories` | 51 / 47 | 36 / 33 | 47 / 43 | Heavy | [C] | Stocks `@ 1100,199,76,51`; News `@ 745,414,72,47` |
| News masthead (`News`, date) | 46 | 33 | 43 | Heavy | [C] | News `N` `@ 807,192,42,46` |
| News lead headline | 31 | 22 | 28-29 | Bold | [C] | News `T` `@ 745,1188,36,31`; 24 pt line pitch |
| Stocks lead headline | 29 | 20.5 | 26-27 | Bold | [C] | Stocks `M` `@ 1101,920,30,29` |
| Secondary headline (News, Stocks) | 21-22 | 15.5 | 20 | Bold | [C] | Stocks `S` `@ 1100,1494,15,22`; 16-16.5 pt line pitch |
| Timestamp (`1h ago`) | 13 (News), 15-16 (Stocks) | 9 / 11 | 12 / 14 | Bold | [C] | News `@ 745,1350,5,13`; Stocks `@ 1100,1028,7,15` |
| Stocks symbol / price | 20 / 18-19 | 14 / 13 | 18 / 17 | Medium / Regular | [C] | Stocks `D` `@ 139,349,17,20` |
| Stocks company name | 18 | 12.5 | 16 | Regular | [C] | Stocks `@ 138,384,16,18` |
| Voice Memos timer | 49 | 34.5 | 45 | Bold | [C] | Voice Memos `@ 861,1047,38,49` |
| Voice Memos ruler labels | 19 | 13.5 | 17 | Regular | [C] | Voice Memos `@ 437,737,13,19` |
| Sidebar row (News) | 19 | 13 | 17 | Regular | [C] | above |

### Shadows and effects
- Toolbar: translucent title-bar material (see the recovered recipe); Home and Voice Memos show the content colour through it.
- No shadows inside the content of News, Stocks or Voice Memos. Home tiles are translucent panels (see `apps/home.md`).

## How Catalyst windows differ from AppKit windows
| Aspect | AppKit (see `toolbar`, `sidebar`) | Catalyst (measured here) | Tag |
|---|---|---|---|
| Toolbar height | 37-38 pt unified toolbar | 38 pt, identical buttons (39 x 23) and traffic-light position (x 13, y 13) | [M] |
| Sidebar row height | 24 pt (Music, Books; medium sidebar size) | 26 pt pitch, 27-28 pt selection (News, Podcasts) = 34 pt iOS row x 0.77 | [M]/[C] |
| Sidebar selection | grey `#c7c8c9` / `#505154` in these media apps too | same grey; never the accent colour | [M] |
| Sidebar row text | 13 pt | 13 pt (17 pt iOS x 0.77 = 13.1) | [C] |
| Sidebar width | 220 pt (Music) | 227-234 pt (News), 330 pt (Stocks) | [M] |
| Type sizes | integer points (11, 13) | fractional (11.5, 12.5, 15.5, 18.5, 34.5) | [C] |
| Controls in content | AppKit controls | custom / iOS-style: pills, tiles, large titles; system tints are the iOS colours | [M] |
| Scrollers | AppKit overlay scroller | UIKit scroll indicator (thinner: 6 pt pill with outline) | [M] |

## iOS-style controls (not seen in the screenshots)
None of the four apps shows a UIKit switch, slider, stepper or iOS segmented control in these captures. Values for completeness, all [I] (iOS 13 control sizes x 0.77); not shown: Home, News, Stocks and Podcasts contain no such controls:
- Switch (`UISwitch`): 39 x 24 pt track, fully rounded; on `#34c759 (sRGB #00cc47)`, off `rgba(120,120,128,0.16)` (light) / `rgba(120,120,128,0.32)` (dark); knob 21 pt white circle with shadow `0 2px 6px rgba(0,0,0,.15)`.
- Segmented control (`UISegmentedControl`, iOS 13 style): 25 pt tall, radius 7, track `rgba(118,118,128,0.12)` / `rgba(118,118,128,0.24)`, selected segment white (`#636366` in dark) with a small shadow, 10 pt Medium label.
- For the AppKit switch use `switch` (owned by sysB).

## Layout and spacing
- Content margins come from iOS layout margins x 0.77: 16 pt (Home), 12.5 pt (Stocks sidebar), centred reading columns in News (820 pt) and Stocks (493 pt).
- Toolbar items keep AppKit spacing: 7 pt between buttons, 7.5 pt trailing inset.

## Keyboard and accessibility
Standard Mac behaviour is supplied by Catalyst: menu bar commands, Cmd-W, Tab focus for text fields; table rows respond to arrow keys only where the app adopts focus [D, HIG Mac Catalyst "keyboard ... input, including key focus and keyboard navigation"]. Accessibility comes through the UIKit bridge (`AXGroup`, `AXButton`, `AXStaticText`). ARIA: `navigation` for the sidebar, `main` for content, `toolbar` for the toolbar.

## Browser notes
Use fractional `font-size` values as measured (browsers render 12.5 px and 18.5 px correctly). Heavy headline faces need SF Pro Display Heavy/Black; News and Stocks headlines use Apple News' condensed bold face in places, which has no web equivalent: use the system bold with `font-stretch: condensed` where available.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-News.png` | 112,76,2444,76 | toolbar: back, sidebar toggle, title, share, search |
| dark | `10-15-Catalina-Dark-News.png` | 112,76,2514,76 | same, dark |
| light | `10-15-Catalina-Light-News.png` | 112,152,456,1000 | Catalyst sidebar: headers, rows, selection |
| dark | `10-15-Catalina-Dark-News.png` | 112,152,470,1000 | same, dark |
| light | `10-15-Catalina-Light-Home.png` | 112,76,1828,76 | tinted toolbar with pull-down, segmented control, add button |
| dark | `10-15-Catalina-Dark-Home.png` | 112,76,1828,76 | same, dark |
| light | `10-15-Catalina-Light-Stocks.png` | 112,76,2296,76 | toolbar with back and share only |
| light | `10-15-Catalina-Light-Voice-Memos.png` | 112,76,1578,76 | toolbar over black content |
| dark | `10-15-Catalina-Dark-News.png` | 2600,220,26,260 | UIKit scroll indicator |
| light | `10-15-Catalina-Light-Find-My.png` | 112,76,600,72 | no toolbar row: window controls over the sidebar, plain line |
| dark | `10-15-Catalina-Dark-Find-My.png` | 68,52,600,72 | same, dark, window not key |

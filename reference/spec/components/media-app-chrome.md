# Media app window chrome (`media-app-chrome`)

- **Status:** present
- **AppKit:** custom. Music and TV are AppKit apps with a full-size content view and custom title-bar views; Podcasts has the same layout but its content metrics follow the Mac Catalyst 77% scale (fractional type sizes, 26 pt rows), so it is treated as a Catalyst app here [I]; Books uses a standard unified `NSToolbar`. Parts map to `NSSplitView` + source-list `NSOutlineView` (sidebar), `NSSearchField`, `NSSlider`, `NSSegmentedControl` (TV, Books), borderless image `NSButton`s (transport).
- **HIG:** toolbars https://web.archive.org/web/20200503121036/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/toolbars/ ; sidebars https://web.archive.org/web/20200503160808/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/sidebars/
- **Appearances shown:** light, dark

## Purpose and behaviour
The window chrome shared by the Catalina media apps that replaced iTunes. Two layouts exist:

- **Player layout** (Music, Podcasts): a full-height sidebar on the left (traffic lights and a search field sit inside it; there is no title) and, over the content pane only, a 55 pt playback bar with transport buttons, a now-playing display ("LCD"), a volume slider with AirPlay button and one or two trailing buttons. The sidebar selects the content shown in the pane [M].
- **Store layout** (TV, Books): a standard 37-38 pt unified toolbar across the whole window with a centred segmented control for top-level navigation and a search field at the trailing edge; Books adds a sidebar under the toolbar for the Library segment [M].

Sidebars follow the HIG sidebar guidance (a source list with titled groups; "consider using a sidebar ... to let people navigate" [D, HIG Sidebars]); the centred segmented control is the HIG's "segmented control ... to switch between views" in a toolbar [D, HIG Toolbars].

## Anatomy
```
Player layout (Music 1220 x 720, Podcasts 1137 x 764)
+-----------+--------------------------------------------------------------+
|(o)(o)(o)  |      <<  >  >>     [art][      LCD        ]   <) ---O (a)  [..] [=] | 55 pt bar
| [Search ] |--------------------------------------------------------------+ 0.5 pt line
| Header    |                                                              |
| [i] Row   |   content pane                                               |
| [i] Row   |                                                              |
+-----------+--------------------------------------------------------------+
  220/260 pt  1 pt divider

Store layout (TV 1294 x 876, Books library 1184 x 784)
+--------------------------------------------------------------------------+
|(o)(o)(o) [sb]        [ Seg | Seg | Seg | Seg | Seg ]            [Search] | 37-38 pt
+--------------------------------------------------------------------------+
| (Books: sidebar 220) |  content                                          |
```

## Variants and parameters
| Parameter | Values | Default | Shown in screenshots |
|---|---|---|---|
| layout | player, store | - | player: Music, Podcasts; store: TV, Books |
| sidebar width | 220 (Music, Books), 260 (Podcasts) | - | all three |
| transport set | previous/play/next (Music); back-15/play/forward-30 (Podcasts) | - | both; skip glyphs are plain circular arrows when nothing is loaded and show `15`/`30` when an episode is loaded |
| LCD state | idle (Apple logo), playing (title, subtitle, progress line) | idle | idle: Music both, Podcasts light; playing: Podcasts dark |
| trailing buttons | lyrics + up-next (Music); info + up-next (Podcasts) | - | both |
| segmented navigation | TV: Watch Now, Movies, TV Shows, Kids, Library; Books: Library, Book Store, Audiobook Store | first | both (Books in an inactive window) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| transport enabled / disabled | yes | Music: previous/next disabled (`#b7b7b7`), play enabled (`#555555`); Podcasts dark: all enabled (`#ffffff`) |
| transport pressed | no | [I] glyph darkens about 20% (lightens in dark) |
| playing (pause glyph) | no | [I] two bars replace the triangle, same 18 x 20 pt box |
| LCD idle / playing | yes | see Variants |
| LCD hover (scrubber, time labels appear) | no | [I] the progress line becomes a 3 pt scrubber with elapsed/remaining times in 10 pt at either end |
| sidebar row selected | yes | grey fill in all apps, key window |
| inactive window | yes (Books library) | `10-15-Catalina-Light-Books.png`: everything in the toolbar and sidebar turns grey |
| search field focused | no | see `search-field` |

## Measurements
Evidence shorthand: `Music @`, `Podcasts @`, `TV @`, `Books @` mean `10-15-Catalina-Light-<App>.png`; `Dark-<App>` or the word Dark before a location means `10-15-Catalina-Dark-<App>.png`; where a row gives both a Light and a Dark value with one location, the location holds in both files. A bare `@`, `row y=` or `col x=` takes the app named earlier in the same cell.

All positions are pt from the window's top-left corner. Window origin in image px: (112, 76) for Music, Podcasts, TV; Books library window (130, 98) in both Books files.

### Geometry: player layout (pt)
| Property | Music | Podcasts | Tag | Evidence (Light files unless noted) |
|---|---|---|---|---|
| Window frame | 1220 x 720 | 1137 x 764 | [M] | `Music @ 112,76,2440,1440`; `Podcasts @ 112,76,2274,1528` |
| Sidebar width | 220 | 260 | [M] | Music row y=130: sidebar 112..551; Podcasts 112..631 |
| Sidebar divider | 1 pt (2 px) | 1 pt | [M] | Music x=552..553; Podcasts x=632..633 |
| Playback bar height | 54.5 + 0.5 pt separator = 55 | same | [M] | Music col x=900: y=76..184 then separator y=185; Podcasts col x=1500: separator y=184 |
| Traffic lights | x 10, 30, 50; y 21 (12 pt circles, vertically centred on the bar) | same | [M] | row y=130: 132..155, 172..195, 212..235; Music col x=144: 118..141 |
| Transport, left glyph | x 316, y 21.5, 20 x 12 (double triangle) | x 341, y 16, 18 x 20 (circular arrow) | [M] | `Music @ 744,119,40,24`; `Podcasts @ 794,108,36,40` |
| Play glyph | x 352, y 17.5, 18 x 20 | x 375, y 17, 18 x 20 | [M] | `Music @ 816,111,36,40`; `Podcasts @ 862,110,36,40` |
| Transport, right glyph | x 382, y 21.5, 20 x 12 | x 405, y 16, 18 x 20 | [M] | `Music @ 876,119,40,24`; `Podcasts @ 922,108,36,40` |
| Transport spacing | 16 pt gap prev-play, 12 pt play-next | 16 pt, 12 pt | [C] | from the boxes above |
| Transport group position | centred between the sidebar edge and the LCD | same | [C] | Music: play centre 360.75 vs midpoint (221+498)/2 = 359.5; Podcasts 383.75 vs 381.75 |
| LCD frame | x 498, y 4.5, 400 x 45 | x 502.5, y 4.5, 351 x 45 | [M] | `Music @ 1108,85,800,90`; `Podcasts @ 1117,85,702,90` |
| LCD width rule | 40% of the content pane width | same | [C] | 400 / 999 and 351 / 876 |
| LCD artwork well | 44.5 x 44 at the LCD's left end | 44 x 44 | [M] | Music x=1109..1197; Podcasts x=1118..1205 |
| LCD border | 0.5 pt (1 px) all round, 2 pt corner radius (see `now-playing-lcd`) | same | [M] | Music row y=130 @ x=1108, 1907; col x=1300 @ y=85, 174 |
| LCD idle logo | Apple glyph 20 x 24, centred in the LCD body | 20 x 24 (same logo as Music; see `now-playing-lcd`) | [M] | `Music @ 1533,102,40,48`; Podcasts col x=1500: 115..147 |
| LCD progress line (playing) | - | 3 pt tall along the LCD body's bottom edge | [M] | `Dark-Podcasts` col x=1300: y=168..173; row y=171: 1206..1817 |
| Volume speaker glyph | x 972, y 21.5, 13 x 12 | x 908, y 22.5, 11 x 10 | [M] | `Music @ 2056,119,26,24`; `Podcasts @ 1928,121,22,20` |
| Volume slider | x 991, 66 wide; track 3 pt thick at y 26.5; knob 11 pt | x 927, 65 wide; track 3 pt at y 26; knob 11 pt | [M] | Music row y=130: track 2094..2203, knob 2204..2225; col x=2150: 129..134. Podcasts track 1966..2073, knob 2074..2095; col x=2000: 128..133 |
| AirPlay glyph | x 1062, y 21, 15 x 15 | x 998, y 20.5, 15 x 14.5 | [M] | `Music @ 2236,118,30,30`; `Podcasts @ 2108,117,30,29` |
| Trailing button 1 | lyrics (speech bubble with quote marks): x 1156, y 20.5, 15 x 14 | info (filled circle with `i`): x 1075, y 20, 14 x 14 | [M] | `Music @ 2424,117,30,28`; `Podcasts @ 2262,116,28,28` |
| Trailing button 2 (up next: three bullet lines) | x 1186, y 22.5, 14 x 9.5 | x 1104, y 22, 14 x 9.5 | [M] | `Music @ 2484,121,28,19`; `Podcasts @ 2320,120,28,19` |
| Trailing inset | 20 | 19 | [C] | window right edge minus glyph right edge |

### Geometry: sidebar (pt)
| Property | Music | Podcasts | Books (library) | Tag | Evidence |
|---|---|---|---|---|---|
| Search field | x 10.5, y 63.5, 199 x 23 | x 10, y 63, 240 x 23 | none (search is in the toolbar) | [M] | `Music @ 133,203,398,46`; `Podcasts @ 132,202,480,46` |
| Group header text | 11 pt Semibold; left inset 10.5; cap top at y 103.5 (first group) | same; cap top y 103.5 | 11 pt; left inset 10.5 | [M]/[C] | Music `Apple Music` `@ 133,283,130,21`; cap height 16 px (`L` of Library 488..503) |
| Row height (pitch) | 24 | 26 | 24 | [M] | Music icon tops y=316, 364, 412; Podcasts 370, 422; Books 272, 320, 368 |
| Selection height | 24 (full row) | 28 (1 pt taller than the row above and below) | 24 | [M] | Music col x=400: 610..657; Podcasts col x=500: 308..363; Books col x=300: 218..265 |
| Selection width | full sidebar width, square corners | same | same | [M] | Music row y=634 from x=112 |
| Row icon | 18 x 18 rounded square (radius about 4), left inset 18 | same | 18 x 18, left inset 18 | [M] | `Music @ 148,316,36,36`; `Books @ 166,272,36,36` |
| Row text | 13 pt Regular, starts 42 pt from the window edge (6 pt after the icon) | 13 pt, starts 43 pt | 13 pt, starts 46.5 pt (window-relative) | [M]/[C] | Music `R` of Recently Added `@ 196,529,14,19`; Podcasts `L` `@ 198,327,12,19` |
| Header to first row | 6.5 pt from header baseline to icon top | 7.5 | 6 | [M] | Music header ink bottom 303, icon top 316 |
| Gap between groups | 20 pt from last icon bottom to next header cap top | 18.5 | 19.5 | [M] | Music 447 -> 487; Podcasts 457 -> 494 |

### Geometry: store layout (pt)
| Property | TV | Books (library window, inactive) | Tag | Evidence |
|---|---|---|---|---|
| Window frame | 1294 x 876 | 1184 x 784 | [M] | `TV @ 112,76,2588,1752`; `Books @ 130,98,2368,1568` (right edge from the Dark file: x=2497) |
| Toolbar height | 37 (36 + 1 pt separator) | 38 (37 + two 0.5 pt lines) | [M] | TV col x=500: 76..147, separator 148..149; Books col x=700: 98..171, lines 172, 173 |
| Segmented control | x 403.5, y 6, 479 x 23 (22 + bottom edge) | x 400.5, y 7.5, 383 x 23 | [M] | `TV @ 919,88,958,46`; `Books @ 931,113,766,46` |
| Segment width | 95 (first and last 0.5-2.5 wider for the end caps) | 127.5 | [M] | TV dividers at x=1302, 1492, 1682 (2 px each); Books divider x=1440 |
| Segmented control position | 4 pt left of the window centre | centred | [C] | TV centre 643 vs 647; Books centre 592 vs 592 |
| Search field | x 1109.5, y 6.5, 176 x 22; right inset 8.5 | x 1018, y 8, 158 x 22; right inset 8 | [M] | `TV @ 2331,89,352,44`; `Books @ 2166,114,316,44` |
| Sidebar toggle button (Books) | - | x 77.5, y 7.5, 39 x 23 | [M] | `Books @ 285,113,78,46` |
| Segment label | 13 pt Regular, centred | 13 pt | [C] | cap height 19 px: TV `W` `@ 949,102,35,19`; Books `L` `@ 1018,128,11,18` |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Music playback bar | gradient `#ffffff` (top) -> `#fafafa` (middle) -> `#f4f4f4` (bottom) | 1 px `#787a7b`, 1 px `#676869`, then `#2b2d2f` -> `#252729` -> `#1e2022` | [M] | `Music @ 900,76`, `@ 700,130`, `@ 900,184`; Dark `@ 900,78`, `@ 700,130`, `@ 900,184` |
| Music bar separator | `#cfcfcf` | `#000000` | [M] | `@ 900,185` in both files |
| Music content pane | `#ffffff` | `#1e2022` | [M] | `@ 900,186` |
| Podcasts playback bar | flat `#ffffff` | flat `#1e1e1e` | [M] | `Podcasts @ 1500,100` is LCD; bar at row y=130 x=634..793 |
| Podcasts bar separator | `#dedede` | `#1a1a1a` (with `#353535` above) | [M] | `Podcasts @ 1500,184`; Dark col x=1500: y=183, 184 |
| Podcasts content pane | `#ffffff` | `#1e1e1e` | [M] | Podcasts row y=130 |
| Sidebar background | Music `#e8e9e9`; Podcasts `#e8e9e9` | Music `#2c2d30`; Podcasts `#2c2d2f` | [M] | `Music @ 300,400`; `Podcasts @ 400,500` (both files each) |
| Sidebar divider | Music `#cccccc` (`#c8c8c8` inside the bar); Podcasts `#bfbfbf` | `#000000` | [M] | `Music @ 552,400`; `Podcasts @ 632,500` |
| Sidebar selection | `#c7c8c9` | Music `#505154`; Podcasts `#505153` | [M] | `Music @ 300,634`; `Podcasts @ 400,330` |
| Sidebar row text | Music `#000000`; Podcasts `#242424` (selected `#1f1f1f`) | `#dfdfdf` (selected `#e4e4e5`) | [M] | Music `@ 196,372,86,20`, Dark same box; Podcasts `@ 198,379,86,19` |
| Sidebar group header | `#747475` | `#9fa0a1` | [M] | Music `@ 133,283,130,21` (darkest / lightest pixel) |
| Music search field | fill `#d2d3d3`, edge `#c0c2c2`, placeholder `#989999`, glyph `#3a3b3b` | fill `#3b3c3f`, top edge `#484a4d`, bottom edge `#67696c`, placeholder `#77787b`, glyph `#ffffff` | [M] | Music row y=226 and col x=300 @ y=203..248 |
| Podcasts search field | fill `#dadbdb`, 1 pt border `#aeafaf`, text `#6d6e6e`, glyph `#222222` | fill `#292a2c`, 1 pt border `#525355`, placeholder `#5d5e60`, glyph `#dededf` | [M] | Podcasts row y=224; col x=400 @ y=202..247 (both files) |
| Transport, enabled | Music `#555555`; Podcasts `#4c4c4c` | Music `#d8d8d8`; Podcasts `#ffffff` | [M] | `Music @ 830,130`; `Podcasts @ 880,130` |
| Transport, disabled | Music `#b7b7b7`; Podcasts `#a6a6a6` | Music `#6c6d6f` | [M] | `Music @ 750,130` |
| LCD body | `#ffffff` | Music gradient `#494b4c` -> `#404143`; Podcasts `#404040` | [M] | `Music @ 1300,130` (`#454648` dark mid); Dark-Podcasts `@ 1500,95` |
| LCD border | Music `#dddddd` sides, `#dfdfdf` top, `#d9d9d9` bottom; Podcasts `#cfcfcf` | Music `#1d1f20` sides, `#222325` top, `#1a1b1d` bottom; Podcasts `#181818` | [M] | Music row y=130 @ 1108; col x=1300 @ 85, 174 |
| LCD artwork well | `#e9e9e9`, note glyph `#c6c6c6` | `#6e6e6e`, note glyph `#929296` | [M] | `Music @ 1150,95`, col x=1150 @ y=111..120 |
| LCD idle logo | `#999999` | Music `#8f9091` | [M] | Music row y=130 @ 1534..1565 |
| LCD title / subtitle (playing) | not shown | `#e2e2e2` / `#a9a9a9` | [M] | `Dark-Podcasts @ 1334,101,356,20` and `@ 1282,132,460,22` |
| LCD progress: elapsed / remaining | not shown | `#b3b3b3` / `#575757` | [M] | `Dark-Podcasts` row y=171: 1206..1211 and 1212.. |
| Volume track | Music `#6a6a6a`; Podcasts `#7f7f7f` | Music `#b5b6b6`; Podcasts `#a5a5a5` | [M] | `Music @ 2150,131`; `Podcasts @ 2000,131` |
| Volume knob | `#ffffff` with a `#d5d5d5` top edge and `#bfbfbf` bottom edge | Music `#cacaca`; Podcasts `#cdcbcd` | [M] | `Music @ 2214,131`, col x=2214 @ y=120, 143 |
| Speaker glyph | Music `#aaaaaa`; Podcasts `#999999` | Music `#aaaaaa`; Podcasts `#787878` | [M] | Music row y=130 @ 2056..2067 |
| AirPlay / trailing glyphs | Music `#7d7d7d`; Podcasts `#4c4c4c` | Music `#9d9e9e` / `#7c7e7f`; Podcasts `#ffffff` / `#fafafa` | [M] | Music row y=130 @ 2237, 2424, 2485; Podcasts @ 2113, 2262, 2321 |
| TV toolbar | gradient `#e5e5e5` -> `#cdcdcd`; separator `#b8b8b8` | `#434547` -> `#363839` (top rows `#87888a`, `#77797a`); separator `#4a4b4c` | [M] | TV col x=500 (both files) |
| TV segment, selected | fill `#707070` -> `#656566`, text `#ffffff` | fill `#cfd1d3` -> `#c4c6c8`, text `#3b3c3f` | [M] | TV col x=1010 @ y=89..132; `@ 949,102,35,19` |
| TV segment, unselected | fill `#fdfdfd` -> `#f3f3f3`, text `#565656`, dividers `#dfdfdf`, bottom edge `#a1a1a1` | fill `#6d6f71` -> `#676869`, text `#fcfeff`, dividers `#5b5d5f` | [M] | TV col x=1200; row y=112 @ 1302, 1492 |
| TV search field | fill `#f7f7f7`, placeholder `#b9b9b9`, glyph `#565656` | fill `#696b6d`, placeholder `#8e9091`, glyph `#e9e9e9` | [M] | TV row y=112 @ 2332..2466 |
| Books toolbar (inactive window) | flat `#f6f6f6`; lines `#e7e7e7`, `#cecece` | flat `#2b2d2f`; lines `#222426`, `#000000` | [M] | Books col x=700 |
| Books segment, selected (inactive) | fill `#e3e3e3`, text `#a4a4a4`, border `#dbdbdb` | fill `#535557`, text `#2b2d2f` | [M] | Books col x=1000 |
| Books segment, unselected (inactive) | fill `#f6f6f6`, text `#b2b2b2` | fill `#3a3c3e`, text `#7b7d7f` | [M] | Books col x=1300 |
| Books sidebar (inactive) | bg `#f6f6f6`, selection `#d2d2d2`, row text `#777777` (selected `#535353`), header `#777777`, divider `#d5d5d5` | bg `#2c2e30`, selection `#505254`, row text `#a8aaac` (selected `#ccced0`), divider `#444648` | [M] | Books col x=300, row y=300 |

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Sidebar row label | SF Pro Text 13 pt Regular | [C] | cap height 19 px (Music `R` 529..547; Podcasts `L` 327..345) |
| Sidebar group header | SF Pro Text 11 pt Semibold | [C] | cap height 16 px; stem about 2.5 px |
| Search placeholder / text | 13 pt Regular; magnifier glyph 12 x 12 pt, 6 pt from the field's left edge; text starts 26 pt from the field edge | [M]/[C] | Music row y=226: glyph 145..164, text from 185 |
| LCD title (playing) | 13 pt Regular, centred in the LCD body; cap top 13 pt below the bar top | [C] | `I` 102..119 = 18 px |
| LCD subtitle (playing) | 13 pt Regular, centred; cap top 28 pt below the bar top; format `Show — Month D, YYYY` | [C] | `M` 132..149 |
| Sidebar icons | 18 pt rounded squares with a white glyph, vertical gradient, soft 1 pt shadow. Music: red/pink (Apple Music group), purple-to-blue (Library), magenta (Store). Podcasts: purple (first group), blue-violet (Library). Books: orange `#ec8131 (sRGB #fc7b00)` | [M] | `Music @ 148,316,36,36` (`#fa6978 (sRGB #ff5c75)` at 150,334; `#7a70eb (sRGB #7f6bf3)` at 150,634) |

### Shadows and effects
- No shadow between bar and content; the separator is a single hairline.
- Sidebar is the `sidebar` material (vibrant in a key window over the desktop; these captures show the opaque result `#e8e9e9` / `#2c2d30`).
- Volume knob: 0.5 pt darker rim plus a soft shadow under it (`#bfbfbf`, `#e1e1e1`, `#e6e6e6` on the three rows below the knob, `Music` col x=2214 @ y=143..145) = `box-shadow: 0 0.5px 1px rgba(0,0,0,.25)` [C].

## Layout and spacing
- Player bar: fixed 55 pt; all glyphs vertically centred on y = 27.5 pt.
- LCD: 5 pt above and below inside the bar; 40% of the pane width; the transport group floats in the middle of the space to its left; the volume group starts 74 pt (Music) / 54.5 pt (Podcasts) after the LCD's right edge; trailing buttons are pinned to the right with a 19-20 pt inset and 15-16 pt between them.
- Sidebar: search field 10 pt side insets, 8.5 pt below the traffic lights' bottom; first group header 16.5 pt below the field.
- Content pane margins: 39-40 pt (Music album grid starts 39 pt from the divider and 40 pt below the bar; Podcasts and TV use 40 pt side margins).

## Keyboard and accessibility
Space toggles play/pause; Cmd-Right / Cmd-Left next/previous; Cmd-Up / Cmd-Down volume; Cmd-F focuses the search field; Cmd-1.. select TV segments [D, app menus; not visible]. Transport buttons are `AXButton`s ("previous", "play", "next"), the volume control is an `AXSlider`, the LCD is a group with static text; the sidebar is an `AXOutline`. ARIA: `role="toolbar"` for the bar, `role="tree"` or `navigation` list for the sidebar, `role="tablist"` for the TV/Books segmented navigation.

## Browser notes
All reproducible. Sidebar vibrancy needs `backdrop-filter` only if the demo shows a desktop behind the window; otherwise use the opaque colours. Glyphs (transport, AirPlay, lyrics, list) should be SVG.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Music.png` | 554,76,1998,110 | playback bar, idle |
| dark | `10-15-Catalina-Dark-Music.png` | 554,76,1998,110 | playback bar, idle |
| light | `10-15-Catalina-Light-Music.png` | 112,76,442,760 | sidebar with search, three groups, selection |
| dark | `10-15-Catalina-Dark-Podcasts.png` | 634,76,1752,110 | playback bar with an episode loaded (LCD text, progress, 15/30 skip glyphs) |
| light | `10-15-Catalina-Light-Podcasts.png` | 112,76,522,700 | Podcasts sidebar, typed search text |
| light | `10-15-Catalina-Light-TV.png` | 112,76,2588,74 | toolbar with 5-segment navigation and search |
| dark | `10-15-Catalina-Dark-TV.png` | 112,76,2588,74 | same, dark |
| light | `10-15-Catalina-Light-Books.png` | 130,98,2368,76 | Books toolbar in an inactive window |
| dark | `10-15-Catalina-Dark-Books.png` | 130,98,2368,76 | same, dark |

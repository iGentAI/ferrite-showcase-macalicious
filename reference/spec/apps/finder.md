# Finder

- **Appearances:** light and dark in one blueprint [M]. The two appearances have different window sizes, grid wrapping, device lists and search results; preserve these captured differences [M].
- **Window:** unified title bar and toolbar, key window [M]. The following frame measurements are from `$M info` opaque-frame bboxes, not PNG canvas/shadows [M]. All window-local rects below are `(x,y,w,h)` pt; original image px evidence is stated separately. Every window capture has frame origin image `(112,76)` [M].

| Screenshot | Opaque frame bbox (px, exclusive trailing edges) | Frame (pt) | Tag |
|---|---|---|---|
| `10-15-Catalina-Light-Finder-Home.png` | 112,76 → 2322,1540 | 1105 × 732 | [M] |
| `10-15-Catalina-Dark-Finder-Home.png` | 112,76 → 2260,1420 | 1074 × 672 | [M] |
| `10-15-Catalina-Light-Finder-Network.png` | 112,76 → 1964,1498 | 926 × 711 | [M] |
| `10-15-Catalina-Dark-Finder-Network.png` | 112,76 → 2110,1494 | 999 × 709 | [M] |
| `10-15-Catalina-Light-Finder-Gallery-View.png` | 112,76 → 2580,1646 | 1234 × 785 | [M] |
| `10-15-Catalina-Dark-Finder-Gallery-View.png` | 112,76 → 2656,1622 | 1272 × 773 | [M] |
| `10-15-Catalina-Light-Finder-Search.png` | 112,76 → 2370,1504 | 1129 × 714 | [M] |
| `10-15-Catalina-Dark-Finder-Search.png` | 112,76 → 2024,1468 | 956 × 696 | [M] |
| `10-15-Catalina-Light-Applications.png` | 112,76 → 2272,1588 | 1080 × 756 | [M] |
| `10-15-Catalina-Dark-Applications.png` | 112,76 → 2342,1544 | 1115 × 734 | [M] |
| `10-15-Catalina-Light-Applications-Utilities.png` | 112,76 → 2272,1588 | 1080 × 756 | [M] |
| `10-15-Catalina-Dark-Applications-Utilities.png` | 112,76 → 2342,1544 | 1115 × 734 | [M] |

## Layout

One shared layout, with the captured exceptions tabulated. `W,H` are the measured frame dimensions above [C]. Component files own rendering; this file owns allocation and content.

```
traffic lights              folder icon / title
Back / Forward  [icon|list|column|gallery] [group v] [gear v] [share] [tags]    [Search]
[Recents | shackett (active) | Documents | +]                 Home only
+ sidebar --+ Shared Folder                                 Home / Gallery
|           | icon grid / columns / large gallery preview + info pane
|           | Search: scope bar above result grid
|           | blank status strip at bottom                 Search only
```

| Region | Rect / size (pt) | Light background | Dark background | Tag / evidence |
|---|---|---|---|---|
| Unified title/toolbar | (0,0,W,55), title allocation 22; toolbar remainder 33 | top `#e5e5e5` → lower `#cdcdcd`; Home slightly lighter, `#e6e6e6` → `#d5d5d5` | top `#404143` (Network/Search `#404142`, Gallery `#404144`) → lower `#343437` (Network/Search `#343435`, Home `#37383b`) | [M] light/dark window files @ 1150,78 and @ 1150,183; height from `10-15-Catalina-Light-Applications.png @ 800,76,1,127`, `10-15-Catalina-Dark-Finder-Home.png @ 800,76,1,215`; title-only division is an allocation [I], no hard line inside unified bar |
| Home tab bar | (0,55,W,25) | active `#d3d3d3`, inactive `#bebebe` near top; vertical gradient | active `#373839`, inactive `#1e1f20` near top; composite varies | [M] `10-15-Catalina-Light-Finder-Home.png @ 1150,190`, @ 800,186,1,50; dark same coords |
| Sidebar surface, except Network/Home light | (0,55,164,H−55); Home starts y80 | `#e7e8e8`; Gallery `#e7e9e9`, Applications/Utilities `#e7e8e9` | `#2c2d2f`; Gallery `#2c2d30` | [M] all files @ 130,800; divider row @ 432,700,19,1 in Applications, Home dark, Gallery light, Search light |
| Sidebar divider | x164,w1, from sidebar top to H | `#cfd0d0` (Applications `#cfd0d1`, Gallery `#cfd1d1`) | `#000000` | [M] same scans, image x440..441; content begins x442 |
| Home light / Network light sidebar exception | content starts x166; sidebar surface ends x164.5, divider 1 plus 0.5 trailing composite | `#e7e8e8`; divider `#cfd0d0` | not the corresponding dark allocation | [M] `10-15-Catalina-Light-Finder-Home.png @ 430,700,26,1`; `10-15-Catalina-Light-Finder-Network.png @ 430,600,26,1`: divider x441..442, trailing material x443, content x444 |
| Network dark sidebar exception | surface x0..132; divider (132,55,1,H−55); content starts x133 | — | `#2c2d2f`, divider black | [M] `10-15-Catalina-Dark-Finder-Network.png @ 365,600,21,1`: divider x376..377, content x378 |
| Shared Folder band | Home: x166 light /165 dark, y80, h25; Gallery: x165,y55,h25; extends to W | `#f0f0f0`; last rows `#e1e1e1`, `#cecece` | `#2b2e30 (sRGB #2a2e30)`; last rows `#3a3d3f (sRGB #393d3f)`, `#4d5052 (sRGB #4c5052)` | [M] light/dark Home @ 1150,236,1,55; Gallery @ 1300,200 / @ 1300,235 |
| Icon/gallery canvas | below band, or y55 without band; Search below scope | `#ffffff` | Home/Gallery/Applications/Utilities `#1e2022`; Network/Search `#1e1f21` | [M] all files @ 500,700 (Gallery sample is outside artwork) |
| Search scope bar | (165,55,W−165,32) | `#f0f0f0` | `#2b2c2f` | [M] `10-15-Catalina-Light-Finder-Search.png @ 1200,186,1,65`; dark same; dark last rows y248/249 `#3a3b3e`/`#4d4e51` |
| Search bottom status strip, blank | (165,H−24,W−165,24), separator above | `#f0f0f0`; separator image y1454/1455 `#cecece`/`#e1e1e1` | `#2b2c2f`; separator y1418/1419 `#4d4e51`/`#3a3b3e` | [M] light @ 1000,1430,1,75; dark @ 1000,1390,1,79 |

**Path bar is not shown in any of these twelve captures** [M]. No status bar is shown in Home, Network, Gallery, Applications or Utilities [M]. Search has the blank strip above, but no visible item-count/free-space string [M].

### Toolbar: exact order and placement

Table rects are the visible **body** extents (not exterior shadow or the light one-pixel outer border), measured on image row y130, with body y126..169 (22 pt) [M]. For the Search field, x is its straight-side body edge measured near y160; focused outer ring in dark Search is additional component rendering [M]. Back/Forward are a separated pair with 1 pt between bodies [M].

Evidence for common light geometry: `10-15-Catalina-Light-Finder-Home.png @ 124,130,957,1`, @ 146,120,1,56. Common dark: `10-15-Catalina-Dark-Finder-Home.png @ 124,130,957,1`, @ 146,120,1,56. Narrow dark Network: `10-15-Catalina-Dark-Finder-Network.png @ 124,130,887,1` [M].

| Item | Light rect (pt) | Dark rect (pt) | Dark Network rect (pt) | Tag |
|---|---|---|---|---|
| Back | (8,25,25,22) | same | same | [M] |
| Forward | (34,25,25,22) | same | same | [M] |
| View-mode segmented control | (170,25,110,22) | (169,25,110,22) | (137,25,110,22) | [M] |
| Group-by pop-up | (288,25,46,22) | (287,25,46,22) | (255,25,46,22) | [M] |
| Action gear pull-down | (342,25,46,22) | (341,25,46,22) | (309,25,46,22) | [M] |
| Share | (396,25,38,22) | (395,25,38,22) | (363,25,38,22) | [M] |
| Tags | (442,25,38,22) | (441,25,38,22) | (409,25,38,22) | [M] |
| Search field | (W−331,25,323,22) | same expression | same expression | [C] body scans below; 8 pt trailing margin |

Search x values, light/dark respectively: Home 774/743; Network 595/668; Gallery 903/941; Search 798/625; Applications and Utilities 749/784 pt [C]. Evidence straight-side bounds: `10-15-Catalina-Light-Finder-Home.png @ 1650,160,671,1` (body x1660..2305); `10-15-Catalina-Dark-Finder-Home.png @ 1590,160,669,1` (body x1598..2243). Other field starts are confirmed by each of the twelve files' row y128 scans [M].

Flexible gaps [C] from measured body edges: Forward → view control is 111 pt light, 110 pt dark, 78 pt dark Network; view → Group, Group → Action, Action → Share and Share → Tags each 8 pt. Tags → Search flexes: light Home/Network/Gallery/Search/Applications/Utilities = 294/115/423/318/269/269 pt; dark = 264/221/462/146/305/305 pt (dark Network uses Tags trailing x447, not x479). No other toolbar item is inserted in these gaps [M].

Four segment allocations within the measured body are widths 28,27,27,28 pt [C]; left edges light 170,198,225,252; dark 169,197,224,251; dark Network 137,165,192,219 [C] (measured pixel divider runs at light x508..509,562..563,616..617 and dark shifted −2 px, dark Network −66 px). Order: Icon, List, Column, Gallery [M]. Icon is selected in Home, Search, Applications and Utilities; Column in Network; Gallery in Gallery [M]. No List-view content capture is assigned [M]. Forward is disabled in every capture. Back is disabled in light Home/Gallery/Applications, enabled in light Network/Search/Utilities and in all six dark captures [M], strongest arrow ink measured inside image crops x143..164/y133..162 and x195..216/y133..162: light disabled `#ababab`, enabled `#555555`; dark Back near-white versus Forward near `#898988`. Share and Tags are disabled in Home/Search/Applications/Utilities, enabled in Gallery; Network has both disabled [M] (assigned previews).

### Home window tab bar

Only Home shows tabs [M]. Evidence: `10-15-Catalina-Light-Finder-Home.png @ 112,190,2210,1`, @ 800,186,1,50; `10-15-Catalina-Dark-Finder-Home.png @ 112,190,2148,1`, @ 800,186,1,50. All tabs occupy y55..80 pt [M].

| Tab / control | Light x,width (pt) | Dark x,width (pt) | State / tag |
|---|---|---|---|
| `Recents` | 0,372 | 0,362 | inactive [M] |
| `shackett` | 372,361 | 362,350 | active [M] |
| `Documents` | 733,349 | 712,339 | inactive [M] |
| `+` | 1082,23 | 1051,23 | add tab, including leading divider and window edge [M] |

Tab divider lines are included in these allocations [M]: light x854..855 and1576..1577; dark x834..835 and1534..1535. The first tab is wider because it spans the sidebar as well [C].

### Sidebar strings and positions

Row allocations are 24 pt high on 26 pt pitch [M], measured selected Applications row image y340..387 in `10-15-Catalina-Light-Applications.png @ 430,330,1,66` and dark same. Row tops below are window-relative; Home adds 25 pt to every y because of the tab bar [C]. Label leading x40.5, header x10 pt [M] (Applications label starts image x193, header x132). Headers' cap tops are used for their y positions, not a guessed text box [M].

| Section | Header cap-top y (pt) | Rows in exact order; row-top y (pt) | Tag |
|---|---|---|---|
| `Favorites` | 66 | `AirDrop` 80; `Recents` 106; `Applications` 132; `Desktop` 158; `Documents` 184; `Downloads` 210 | [M] |
| `iCloud` | 250.5 | `iCloud Drive` 266 | [M] |
| `Locations` | 306.5 | with Macintosh: `Macintosh HD` 320; `Time Machine` 346; `ismhpro` 372; `Network` 398 | [M] |
| `Locations`, no Macintosh | same | `Time Machine` 320; `ismhpro` 346; `Network` 372 | [C] one fewer measured 26 pt row |
| `Tags`, with Macintosh | 438.5 | `Blue` 453; `Work` 479; `Orange` 505; `Gray` 531; `Green` 557; `Home` 583; `Red` 609; `All Tags...` 635 | [M] |
| `Tags`, no Macintosh | 412.5 | same strings; subtract 26 from every row top above | [C] |

Evidence row/header flow: `10-15-Catalina-Light-Applications.png @ 130,186,290,1150`; `10-15-Catalina-Dark-Applications.png @ 130,186,290,1200`; Home same flow offset: `10-15-Catalina-Light-Finder-Home.png @ 130,236,290,1220`; dark Home @ 130,236,290,1160 [M].

Macintosh HD is present in light Home/Network/Gallery and dark Network/Search/Applications/Utilities; absent in light Search/Applications/Utilities and dark Home/Gallery [M]. In dark Network the narrow sidebar visibly truncates the first two device labels to `Macintosh...` and `Time Mach...` [M]. Selected rows: `Network` in Network, `Downloads` in Gallery, `Applications` in Applications; no sidebar selection in Home, Search or Utilities [M]. Selection fill is `#c7c8c8` / `#505153` [M] (Applications @ 430,350, both appearances). Home's Documents icon label carries a green tag dot in the content grid; that is not a sidebar selection [M]. Network sidebar row-top confirmation: `10-15-Catalina-Light-Finder-Network.png @ 430,860,1,71`, highlight starts image y872 (window y398) [M].

## Components used

`window`, `title-bar`, `window-controls`, `toolbar`, `toolbar-button` (Back/Forward/Share/Tags), `toolbar-segmented-control` (four views), `toolbar-pop-up` (Group-by/Action), `toolbar-search-field`, `window-tab-bar`, `sidebar`, `split-view`, `icon-view`, `column-view`, `gallery-view`, `scope-bar`, `push-button`, `image-button`, `label`, `image-view`, `tag-dot`, `window-banner` (Shared Folder), `status-bar` (blank Search strip) [M] (assigned previews). Components specify rendering and interaction; the tables here specify Finder-specific placement and strings.

## App-specific elements

### Icon views: Home, Applications, Utilities, Search

Icon sizes are the logical 160 pt (Home) and 64 pt (other icon grids) described in `icon-view` [C, that component's artwork/box derivation]. They are not flat visible squares: actual asset paint bounds differ. The first visible artwork bounds below are independently measured by selecting pixels more than 10 stored channel levels from the canvas colour within the cited crop [M]; this excludes the very faint baked shadow fringe. Use the actual icon assets, not a filled square equal to these paint bounds.

| Grid | Columns / rows shown | First artwork rect, window-local pt | Column / row pitch (pt) | First label ink top (window y pt) | Tag / original evidence |
|---|---|---|---|---|---|
| Home light | 5 / 2 | (189,139,147.5,117) | 186 / 226 | 289 | [M] `10-15-Catalina-Light-Finder-Home.png @ 470,330,330,275`, paint bbox x490..784,y354..587; following icons x862,1234,1606,1978, next row y806; label @ 591,654,90,25 |
| Home dark | 4 / 2 | (222.5,139,144,114) | 217 / 226 | 289 | [M] `10-15-Catalina-Dark-Finder-Home.png @ 535,330,330,275`, paint x557..844,y354..581; following x991,1425,1859, next row y806; label @ 654,654,90,25 |
| Applications light | 8 / 5 | (199,67,56,56.5), App Store | 113 / 116 | 137 | [M] `10-15-Catalina-Light-Applications.png @ 490,195,150,145`, paint x510..621,y210..322; labels first row @ 450,350,1810,25, later cap tops y582,814,1046,1278 |
| Applications dark | 8 / 5 | (202,67,56,56), App Store | 117 / 116 | 137 | [M] `10-15-Catalina-Dark-Applications.png @ 500,195,150,145`, paint x516..627,y210..321; first-row labels @ 450,350,1890,25 |
| Utilities light | 8 / 3 | (198.5,70.5,57,50), Activity Monitor | 113 / 116 | 137 | [M] `10-15-Catalina-Light-Applications-Utilities.png @ 490,195,150,145`, paint x509..622,y217..316; label row same placement as Applications |
| Utilities dark | 8 / 3 | (202,70.5,56,48.5), Activity Monitor | 117 / 116 | 137 | [M] `10-15-Catalina-Dark-Applications-Utilities.png @ 500,195,150,145`, paint x516..627,y217..313 |
| Search light | 6 / 1 | (201,96.5,46,60.5), first iBooks file | 112 / no second row shown | 169.5 | [M] `10-15-Catalina-Light-Finder-Search.png @ 495,260,130,142`, paint x514..605,y269..389; labels @ 450,415,1370,25 |
| Search dark | 5 / 1 | (201.5,96.5,45,59.5), first iBooks file | 112 / no second row shown | 169.5 | [M] `10-15-Catalina-Dark-Finder-Search.png @ 495,260,130,142`, paint x515..604,y269..387; labels @ 450,415,1370,25 |

First cell **nominal icon-box** origins, window-local pt: Home light `(183,121)`, dark `(214.5,121)`; Applications/Utilities light `(195,63)`, dark `(198,63)`; Search both `(192,95)` [C], using the measured first artwork centre and the logical component icon size, rounded to 0.5 pt. These are icon-box anchors, not invisible selection/hit-cell bounds [I]; the exact paint rects above are the reproducible visible placement. Home's nominal box top is 16 pt below the content top; other grids are 8 pt below their content top [C].

Labels are centred below their icon cells; two-line labels use a measured 16 pt line pitch [M] (`10-15-Catalina-Light-Applications.png @ 2081,1046,133,50`, Search @ 440,250,1400,235). Home first label cap is about 33 pt below painted art bottom, Applications about 13.5 pt, Search about 12.5 pt [C] from the paint and ink rectangles above. Home Documents label has a green dot at image `(929,652,20,20)` light; dark `(1054,652,20,20)` [M], before `Documents`. The banner reads `Shared Folder` at leading inset 10 pt of the content area [M] (Home light @ 464,252,190,22; Gallery light @ 462,202,190,22).

### Network column view

| Region | Light rect (pt) | Dark rect (pt) | Background / evidence / tag |
|---|---|---|---|
| First column, network devices | (166,55,203.5,H−55) | (133,55,204,H−55) | white / `#1e1f21`; [M] light `10-15-Catalina-Light-Finder-Network.png @ 430,600,971,1`; dark @ 365,600,846,1 |
| First divider | (369.5,55,1,H−55) | (337,55,1,H−55) | `#e7e6e7`/`#e6e6e5` / black; [M] same scans x851..852 / x786..787 |
| Second column | (370.5,55,252,H−55) | (338,55,204,H−55) | canvas fill as above; summary band below | [M] same scans |
| Second divider | (622.5,55,1,H−55) | (542,55,1,H−55) | `#e6e6e6` / black | [M] image x1357..1358 /1196..1197 |
| Remaining empty column area | (623.5,55,W−623.5,H−55) | (543,55,W−543,H−55) | canvas fill | [C] |
| Castle summary band in second column | (370.5,55,252,172) | (338,55,204,172) | light `#f5f5f5`, lower edge `#f0f0f0`; dark `#252628`, lower rows `#313133`/`#404042` | [M] light @ 900,180,1,371; dark @ 810,180,1,371 |
| `Connect As...` | (439,174,114,18) | (383,174,114,18) | band fill, component push-button outline | [M] light @ 990,424,228,36; dark @ 878,424,228,36 |
| `Share Screen...` | (439,201,114,18) | (383,201,114,18) | same | [M] light @ 990,478,228,36; dark @ 878,478,228,36 |

Network rows are 18 pt high [M] (light @ 444,186,408,148): light device list `brn30055c475bce`, `Castle` (selected), `ismhpro`, `merribook`; dark list `Castle` (selected), `ismhpro`, `merribook` [M]. Row tops: light y55,73,91,109; dark y55,73,91 [C]. Selected first-column fill is light `#2466d9 (sRGB #0164e1)`, dark `#1f5ac9 (sRGB #0357d0)` at the sampled row [M] (light @ 444,226,407,1; dark @ 378,198,408,1). Summary shows small Castle device image, bold `Castle`, `Not Connected`, then the two buttons [M]; image top at y89.5, title ink top around y137, subtitle y156.5 relative to frame [M] (light @ 1100,200,1,331; dark @ 990,200,1,331). No column headings, path bar or bottom status text [M].

### Gallery view

Gallery content starts at x165,y80 pt in both [M]. Region rects are window-local; Gallery window sizes above control the two separate layouts.

| Region | Light rect (pt) | Dark rect (pt) | Evidence / tag |
|---|---|---|---|
| Gallery / thumbnail area | (165,80,818,705) | (165,80,856,693) | [M] `10-15-Catalina-Light-Finder-Gallery-View.png @ 432,700,19,1`, @ 2068,300,23,1; dark @ 2144,300,23,1 |
| Info-pane divider | (983,80,1,705) | (1021,80,1,693) | `#d5d5d5` / `#000000` [M], same rows |
| Info pane | (984,80,250,705) | (1022,80,250,693) | white / `#1e2022` [M], same rows |
| Large wave image | (197,189.5,754,424) | (197,173,792,445.5) | [M] light @ 506,455,1508,848; dark @ 506,422,1584,891, top/bottom col @ 1300,413,1,23 / @ 1300,1308,1,15 |
| First thumbnail paint slot | x176, 48 wide; 36 high for first 4:3 asset | same x/width/height | [M] light @ 464,1540,96,72; dark @ 464,1516,96,72 |
| Strip centre line | y749.75 | y737.75 | [C] image centres y1575.5 /1551.5 from 72 px thumbnail height |
| Selected wave backdrop | (669,724,54,52) | (669,712,54,52) | light `#c0c0c0` / dark `#565759` [M]: light @ 1452,1500,1,141; dark @ 1452,1476,1,141; straight side row light @ 1444,1540,121,1 |

Thumbnail pitch is 62 pt (14 pt inter-thumbnail gap), 11 pt leading inset [M]; each 16:9 thumbnail is 48 × 27 pt, centred on the strip centre line [M] (`10-15-Catalina-Light-Finder-Gallery-View.png @ 464,1576,129,1`, @ 1500,1548,1,54; dark @ 464,1552,129,1). Wave is the ninth thumbnail [M]; light shows thirteen full thumbnails plus a narrow sliver, dark fourteen full thumbnails [M]. No thumbnail filename labels [M].

Pane content is inset 20 pt; filename thumbnail/title at y110/108 pt approximately (asset/ink bounds, not row allocations), first rule y174, Information heading cap top y186, row cap tops y212,232,252,272,292, next section rule y320, Tags cap top y331, Add Tags placeholder cap top y354 [M] (light @ 2100,275,450,550; dark same crop shifted +76 px in x). Rules light `#c0c0c0` / dark `#565759`; row separators light `#e6e6e6` / dark `#343638` [M] (light @ 2300,424 / @ 2300,528; dark @ 2400,424 / @ 2400,528). Values right-align to pane right−20 pt [M].

Pane strings in order [M]: `10-9.jpg`; `JPEG image - 9.4 MB`; `Information` and `Show More`; `Created` → `April 17, 2018 at 10:11 PM`; `Modified` → same timestamp; `Last opened` → `5/29/18, 10:33 AM`; `Dimensions` → `5120×2880`; `Resolution` → `240×240`; `Tags`; `Add Tags...`. Bottom Quick Actions in order `Rotate Left`, `Markup`, `More...`, with icon/label groups centred x1033.25,1109.25,1185.25 light; x1071.25,1147.25,1223.25 dark pt [C], from glyph boxes in light @ 2122,1534,394,70; dark @ 2198,1510,394,70. Label cap tops y753.5 light /741.5 dark [M]. `More...` is a Quick Action menu, not `Show More` metadata expansion [M].

### Search view

Scope string order: `Search:`, `This Mac`, selected `“Macintosh SSD”`, trailing `Save`, `+` [M]. Light title is `Searching “Macintosh SSD”`, field value `Aqua`; dark title same, field shows `NAME` pop-up token followed by `Aqua` with a caret and focus ring [M].

Scope-bar items: `Search:` ink begins window x173,y68; `This Mac` x232,y68; selected scope pill `(295,63,120,16)`; Save `(W−72,63,42,16)`; plus `(W−28,63,18,16)` pt [M]. Evidence `10-15-Catalina-Light-Finder-Search.png @ 440,218,1931,1`, @ 935,196,1,47, @ 2215,204,141,1; dark @ 440,218,1583,1 and @ 1869,204,141,1. Pill fill light `#9a9a9a` / dark `#b6b7ba` [M] (both @ 706,204). Scope labels are not search results; no additional filter row is visible [M].

Results use the icon grid above and no selected result [M]. Light has six results in this exact order [M]: `Aqua and Bondi.ibooks`; `Aqua and Bondi.pdf`; `Aqua and Bondi.pdf` (duplicate visible label, retained); `Aqua_and_Bondi-preview.ibooks`; `com.apple.AquaAppearanceHelper`; `com.apple.AquaAppearanceHelper` (two distinct folders with the same visible name). Dark has five [M]: `Aqua and Bondi.ibooks`; `Aqua and Bondi.pdf`; `Aqua_and_Bondi-preview.ibooks`; `com.apple.AquaAppearanceHelper`; `com.apple.AquaAppearanceHelper`. Wrap names exactly as visible: `Aqua and` / `Bondi.ibooks`; `Aqua and` / `Bondi.pdf`; `Aqua_and_Bondi-` / `preview.ibooks`; `com.apple.AquaA` / `ppearanceHelper` [M] (light @ 440,250,1400,235, dark @ 450,190,600,295). The third dark file has a cover thumbnail, whereas the fourth light result uses the generic iBooks document icon [M].

## Content in the screenshot

Visible titles: Home `shackett`; Network `Castle`; Gallery `Downloads`; Applications `Applications`; Utilities `Utilities`; Search `Searching “Macintosh SSD”` [M]. Toolbar field placeholder is `Search` except in the Search capture [M]. All lists below are transcribed from the assigned light/dark previews and the corresponding measured content regions above [M]. They are reading order, left to right then top to bottom, not sorted by an assumed current installation.

### Home folders

- Light row one: `Desktop`, `Documents` (green tag), `Downloads`, `Movies`, `Music`; row two: `Pictures`, `Public` [M].
- Dark row one: `Desktop`, `Documents` (green tag), `Downloads`, `Movies`; row two: `Music`, `Pictures`, `Public` [M].
- `Shared Folder` banner above both; tabs `Recents`, selected `shackett`, `Documents` [M].

### Applications, same strings in both appearances

| Row | Eight-column grid, exact left-to-right order | Tag |
|---|---|---|
| First | App Store; Automator; Books; Calculator; Calendar; Chess; Contacts; Dictionary | [M] |
| Second | FaceTime; Find My; Font Book; Home; Image Capture; Launchpad; Mail; Maps | [M] |
| Third | Messages; Mission Control; Music; News; Notes; Photo Booth; Photos; Podcasts | [M] |
| Fourth | Preview; QuickTime Player; Reminders; Safari; Siri; Stickies; Stocks; System Preferences | [M] |
| Fifth | TextEdit; Time Machine; TV; Utilities; Voice Memos | [M] |

`System Preferences` wraps as `System` / `Preferences` [M]. `Utilities` is a folder with the crossed-tools folder artwork, not an app icon [M]. The remaining labels fit one line [M].

### Utilities, same strings in both appearances

| Row | Eight-column grid, exact left-to-right order | Tag |
|---|---|---|
| First | Activity Monitor; AirPort Utility; Audio MIDI Setup; Bluetooth File Exchange; Boot Camp Assistant; ColorSync Utility; Console; Digital Color Meter | [M] |
| Second | Disk Utility; Grapher; Keychain Access; Migration Assistant; Screenshot; Script Editor; System Information; Terminal | [M] |
| Third | VoiceOver Utility | [M] |

Two-line wraps: `Bluetooth File` / `Exchange`; `Boot Camp` / `Assistant`; `Digital Color` / `Meter`; `Migration` / `Assistant`; `System` / `Information` [M]. The remaining labels fit one line [M]. Network, Gallery and Search strings are given with their layout in the sections above; retain duplicate Search filenames [M].

## Not reproducible / assets needed

Home folder artwork with embedded Desktop/Documents/Downloads/Movies/Music/Pictures/Public emblems, tagged Documents dot, the complete Catalina app and Utilities icon sets, network device artwork, document-cover thumbnails and gallery wallpaper images are needed as assets [M]. The gallery sequence depicts the historical macOS wallpapers: blue Aqua variants, two purple space images, two galaxies, selected wave, Yosemite, El Capitan, Sierra, High Sierra, and (dark's final full thumbnail) Mojave [M]; the thumbnail filenames are not visible, so do not invent them [I].

Only the assigned views/states are specified: no List view, renamed icon, expanded metadata, open Group-by/Action/More menu, path bar or item-count status text is captured [M]. Invisible selection-cell/hit extents cannot be recovered from these unselected icon screenshots; nominal icon-box anchors are explicitly computed/inferred, while the painted artwork and text positions are measured [I]. See cited component files for non-captured states, without treating their inferred states as additional evidence from these app captures.

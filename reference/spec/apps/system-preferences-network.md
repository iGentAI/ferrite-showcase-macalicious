# System Preferences — Network

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Network.png`; `10-15-Catalina-Dark-System-Preferences-Network.png` [M].
- **Window:** opaque frame `668 × 563 pt`, origin `112,76` image px, both appearances [M], each screenshot @ 112,76,1336,1126 (`info`). Unified title bar/toolbar [M]; reuse `title-bar`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-search-field` and `toolbar-segmented-control`; shared chrome is not remeasured here.
- **State comparison:** both show Wi-Fi selected and connected, an empty Network Name field, identical address and check states; Revert and Apply disabled [M]. Only appearance changes [M].

## Layout

```text
+---------------- shared Network toolbar ----------------+
|                  Location: [Automatic]                 |
| + services ----+ + Wi-Fi status / settings ------------+|
| | Wi-Fi        | | Status / Turn Wi-Fi Off              ||
| | Bluetooth PAN| | Network Name                        ||
| | USB / Bridge | | three checkboxes + explanation      ||
| |              | |                                    ||
| | + − gear     | | menu-bar checkbox   Advanced…   ?   ||
| +--------------+ +------------------------------------+|
|                                       Revert   Apply   |
+--------------------------------------------------------+
```

All rects below are `(x,y,w,h)` in pt relative to the frame [M]. E-L is `10-15-Catalina-Light-System-Preferences-Network.png`; E-D is `10-15-Catalina-Dark-System-Preferences-Network.png` [M]. Evidence coordinates remain image px; use the cited E-L/E-D filename with each crop [M]. Colours are stored PNG values [M], not converted CSS colours.

| Region | Rect [M] | Light / dark fill [M] | Evidence in E-L and E-D (px) |
|---|---|---|---|
| Content including bottom footer | (0,38,668,525) | `#ececec` / `#2f3031` | @ 130,250; @ 112,152,1336,1050 |
| Service list + action strip | (20,99,170,400) | `#ffffff` / `#1d1e1f` | @ 180,650; row 450 x145..500; @ 152,274,340,800 |
| Selected service | (21,100,168,42) | `#dcdcdc` / `#464646` | @ 160,300; col 162 y274..360 |
| Settings box | (198,99,450,400) | `#e2e2e2` / `#353637` | @ 600,450; row 450; col 520 y260..1090; @ 508,274,900,800 |
| List action strip | (20,478,170,21) | `#f9f9f9` / `#4c4d4e` | @ 312,1046; @ 152,1032,340,42 |

## Components used

`bordered-list`, `list-view`, `status-dot`, `image-view`, `pop-up-button`, `checkbox`, `label`, `box`, `push-button`, `help-button`, `gradient-button`, `pull-down-button`, `separator` [M]. Their component files define bezel, glyph and state rendering; the table below defines pane placement [M]. Shared toolbar title is “Network”, search placeholder “Search”; back enabled, forward disabled, Show All enabled [M], E-L/E-D @ 112,76,1336,76.

## Content in the screenshot — complete control table

Reading order [M]. Label-only rects are ink bounds; other rects are visible controls or cell bounds [M]. `x/B` gives first ink x and baseline y in frame pt [M] (for multiline text, first line baseline). R = regular `13 pt`, S = small `11 pt`, N = mini `10 pt` [C], cap-height mapping in CONVENTIONS and `label.md`; weight/state indicated separately. Button/pop-up titles use the component's centred label metrics [I], because those glyph baselines are delegated to the existing component spec. Table applies to both appearances [M].

| Control / component | Variant / state / type | Rect [M] | Exact visible text [M]; label x/B [M] | E-L crop (px); same placement confirmed E-D |
|---|---|---|---|---|
| label | R regular | (173.5,63,53.5,10) | Location:; 173.5/72.5 | @ 459,202,107,20 |
| pop-up-button | regular, enabled | (235,58.5,260,20) | Automatic | @ 581,192,522,42 |
| list-view + image-view + status-dot | selected, R + S | (21,100,168,42) | Wi-Fi; Connected; 44.5/118.5 and 44.5/132.5 | @ 154,276,336,84; ink @ 201,294,111,48 |
| list-view + image-view + status-dot | unselected, R + S | (21,142,168,42) | Bluetooth PAN; Not Connected; 45/160.5 and 45/174.5 | @ 154,360,336,84; ink @ 202,379,172,47 |
| list-view + image-view + status-dot | unselected, R + S | (21,184,168,42) | USB 10/…00 LAN; Not Connected; 45/202.5 and 45/216.5 | @ 154,444,336,84; crop @ 194,448,240,155 |
| list-view + image-view + status-dot | unselected, R + S | (21,226,168,42) | Thunde…lt Bridge; Not Connected; 44.5/244.5 and 45/258.5 | @ 154,528,336,84; same detail crop |
| label | R regular | (311,118.5,41,10) | Status:; 311/128 | @ 734,313,82,20 |
| label | R bold | (359.5,118,69,10.5) | Connected; 359.5/128 | @ 831,312,138,21 |
| push-button | regular enabled | (493.5,114.5,113,20) | Turn Wi-Fi Off | @ 1098,304,228,42; row 312, col 1110 |
| label | S regular, wrapped | (359.5,140.5,116,22.5) | Wi-Fi is connected to / address 192.168.7.167.; 359.5/148.5 | @ 831,357,232,45 |
| label | S regular | (521.5,140.5,74,8.5) | and has the IP; 521.5/148.5 | @ 1155,357,148,17 |
| label | R right aligned | (260,199.5,91.5,10) | Network Name:; 260/209 | @ 632,475,183,20 |
| pop-up-button | regular enabled, empty | (359.5,195.5,247,20) | (empty) | @ 830,466,496,42; row 482, col 840 |
| checkbox | regular on, R | (359,236,14,14) | Automatically join this network; 377.5/247.5 | @ 830,548,28,28; ink @ 867,552,368,25 |
| checkbox | regular on, R | (359,266,14,14) | Ask to join Personal Hotspots; 377.5/277.5 | @ 830,608,28,28; ink @ 867,612,353,25 |
| checkbox | regular off, R | (359,296,14,14) | Ask to join new networks; 377.5/307.5 | @ 830,668,28,28; ink @ 867,672,298,25 |
| label | N regular, wrapped | (377,320.5,223.5,35) | Known networks will be joined automatically. If / no known networks are available, you will have / to manually select a network.; 377/327.5 | @ 866,717,447,70 |
| gradient-button | add service enabled | (20,479,25,20) | + | @ 152,1034,50,40; row 1046 |
| gradient-button | remove service enabled | (45,479,25,20) | − | @ 202,1034,50,40 |
| pull-down-button | gear action enabled | (70,479,29,20) | gear + downward chevron (no text) | @ 252,1034,58,40 |
| checkbox | regular on, R | (225,470,14,14) | Show Wi-Fi status in menu bar; 243.5/481.5 | @ 562,1016,28,28; ink @ 599,1020,368,21 |
| push-button | regular enabled | (512.5,470,98,20) | Advanced… | @ 1136,1015,196,42; col 1148 |
| help-button | regular enabled | (619.5,471.5,17,17) | ? | @ 1351,1019,34,34; row 1034, col 1367 (halo excluded) |
| push-button | regular disabled | (505.5,522.5,67,20) | Revert | @ 1122,1120,136,42; row 1132, col 1140 |
| push-button | regular disabled | (585.5,522.5,62,20) | Apply | @ 1282,1120,126,42 |

### Layout grid

Location label right ink edge `227 pt`, control left `235 pt`; network label right ink edge `351.5 pt`, control left `359.5 pt`, giving `8 pt` gaps [C] from table. Sidebar margin `20 pt`, right box margin `20 pt`, inter-region gap `8 pt` [C]. Service pitch `42 pt`; setting checkbox pitch `30 pt`; explanatory line pitch `13 pt` [M], E-L/E-D @ 154,276,336,336 and @ 830,548,495,240. Right action row baseline alignment follows component metrics [I]. Bottom action row top `522.5 pt`, bottom margin `20.5 pt`, button gap `13 pt` [C]. List border `1 pt` [M], E-L/E-D row 450 x152..154. Help is inside the settings box, not the window footer [M].

## App-specific elements

Service status dots at image centres `(178,318)`, `(178,402)`, `(178,486)`, `(178,570)` [M], E-L/E-D @ 168,308,20,272; dot diameter `10 pt` [M], E-L/E-D row 318 x168..188 and col 178 y308..328 (includes anti-aliased edge, no separate border). Wi-Fi fan, Bluetooth lozenge and the two network-port images occupy the trailing service cell area [M], E-L/E-D @ 414,286,64,310. Network names are middle-truncated exactly as recorded, not end-truncated [M]. No lock footer appears [M].

### Embedded labels and explicit evidence

The following completes the button/popup label metrics: first ink x and baseline B in frame pt [M], R `13 pt` [C]. Light/dark ink edges were sampled independently; dark Advanced has a `0.5 pt` higher antialiased top but unchanged baseline [M]. Bezel rects exclude the external halo/shadow; larger evidence crops include it [M].

| Label | x / B [M] | Size [C] | Full evidence citation (light; dark same crop) |
|---|---|---|---|
| Automatic | 244 / 72.5 | R | `10-15-Catalina-Light-System-Preferences-Network.png @ 600,202,120,20` |
| Turn Wi-Fi Off | 507.5 / 128.5 | R | `10-15-Catalina-Light-System-Preferences-Network.png @ 1127,314,170,20` |
| Advanced… | 526 / 484 | R | `10-15-Catalina-Light-System-Preferences-Network.png @ 1164,1025,138,20` |
| Revert | 520.5 / 536.5 | R disabled | `10-15-Catalina-Light-System-Preferences-Network.png @ 1153,1131,75,19` |
| Apply | 599 / 536.5 [C], aligned with Revert before descender | R disabled | `10-15-Catalina-Light-System-Preferences-Network.png @ 1310,1131,68,24` |

Grouped geometry and colour evidence for all preceding tables [M]: `10-15-Catalina-Light-System-Preferences-Network.png @ 112,152,1336,1050`; `10-15-Catalina-Dark-System-Preferences-Network.png @ 112,152,1336,1050`. Smaller coordinate crops and run-length scans are given per row [M].

## Not reproducible / assets needed

The Wi-Fi, Bluetooth, port and gear artwork must be supplied as matching Catalina image assets [I]; a generic modern icon will not reproduce the screenshot. Blank SSID is preserved rather than guessed [M]. Hover, pressed, opened pop-up, other selected services and changed/dirty network settings are not shown [M]; do not infer their content. Non-Apple system-font fallback cannot guarantee identical glyph widths [I].

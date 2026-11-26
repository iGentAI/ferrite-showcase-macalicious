# System Preferences — Sharing

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Sharing.png`; `10-15-Catalina-Dark-System-Preferences-Sharing.png` [M].
- **Window:** opaque `668 × 530 pt`, image origin `112,76`, both [M], each @ 112,76,1336,1060 (`info`). Reuse shared `title-bar`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-segmented-control`, `toolbar-search-field`, `focus-ring`; title “Sharing”, search “Search” [M].
- **Differences:** light search has focus ring and insertion caret, dark search does not [M]. Light selected Shared Folder “shackett”, one visible row; dark selected “mhackett’s…blic Folder” plus “shackett” [M]. First Users row is Stephen in light, mhackett in dark [M]. Bluetooth Sharing precedes Internet Sharing in light; order reversed in dark [M]. File Sharing remains selected/on in both [M].

## Layout

```text
+-------------------- shared toolbar -------------------+
| Computer Name: [ismh15                              ] |
|                local-address explanation      Edit…  |
+-------------------------------------------------------+
| + On / Service ---+  green dot File Sharing: On       |
| | checkbox rows   |  connection explanation Options… |
| |                 |  Shared Folders:     Users:       |
| |                 |  [folder list]       [name | ACL] |
| |                 |  + −                + −          |
| +-----------------+                                  |
+-------------------------------------------------------+
|                                                    ? |
+-------------------------------------------------------+
```

E-L = `10-15-Catalina-Light-System-Preferences-Sharing.png`; E-D = `10-15-Catalina-Dark-System-Preferences-Sharing.png` [M]. All rects `(x,y,w,h)` are frame-relative pt [M]. Colours below are stored values [M].

| Region | Rect [M] | Light / dark fill [M] | Evidence E-L/E-D image px |
|---|---|---|---|
| Computer identity region | (0,38,668,96) | `#ececec` / `#2f3031` | @ 130,250; col 130 y155..344; @ 112,152,1336,192 |
| Sharing content band | (0,134,668,323) | `#e3e3e3` / `#353637` | @ 130,500; col 130 y344..990; @ 112,344,1336,646 |
| Footer | (0,457,668,73) | `#ececec` / `#2f3031` | @ 130,1050; @ 112,990,1336,146 |
| Service table | (20,155,195,285) | `#ffffff` / `#1d1e1f` | row 600; @ 160,600; @ 152,386,390,570 |
| Table header | (21,156,193,24) | `#f0f0f0` / `#2a2b2c` | @ 160,408; col 160 y388..436 |
| File Sharing selected row | (21,200,193,19) | `#dcdcdc` / `#464646` | @ 160,495; col 160 y476..514 |
| Shared Folders list | (234,272,162,139) | `#ffffff` / `#1d1e1f` | @ 600,700; row 882; col 590 y620..898; @ 580,620,324,278 |
| Users list / permissions | (405,272,242,139) | `#ffffff` / `#1d1e1f` | row 882; @ 1000,850; @ 922,620,484,278 |
| Selected folder cell | (235,273,160,18) | `#dcdcdc` / `#464646` | col 590 y622..658; @ 582,622,320,36 |

## Components used

`label`, `text-field`, `push-button`, `separator`, `table-view`, `table-header`, `checkbox`, `status-dot`, `list-view`, `bordered-list`, `image-view`, `pop-up-button`, `gradient-button`, `help-button` [M]. Permission selectors are borderless popups with up/down chevrons [M]. Shared chrome remains delegated to its component specifications.

## Content in the screenshot — complete control table

Rect and `x/B` (first glyph x / baseline y) are measured frame pt [M]. Label-only rects are ink extents [M]. R = `13 pt`, S = `11 pt`, T = `12 pt` table-cell text [C], from cap-height mapping and `label.md`; T is confirmed by File Sharing's flat F cap `17 image px` (E-L @ 248,485,11,17; E-D @ 248,484,11,18). Control-title metrics inside push buttons use the component [I]. Service checkbox size `14 pt` [M], row 450 x182..210 and col 189. Media Sharing and Internet Sharing are disabled off; other unchecked boxes are enabled [M], their paler/darker bezel distinction is sampled in col 189.

| Component | Variant / state / type | Rect [M] | Exact visible text [M]; x/B [M] | Evidence E-L/E-D image px |
|---|---|---|---|---|
| label | R right aligned | (48.5,68.5,101.5,12) | Computer Name:; 48.5/78 | @ 209,213,203,24 |
| text-field | regular enabled | (158.5,63.5,459,20) | ismh15; first glyph 163/77.5 | @ 429,203,918,40; ink @ 438,212,81,20; row 206, col 435 |
| label | S wrapped | (158.5,92.5,329.5,22.5) | Computers on your local network can access your computer at: / ismh15.local; 158.5/100 | @ 429,261,659,45 |
| push-button | regular enabled | (556.5,93.5,61,20) | Edit… | @ 1225,262,124,42; col 1235 |
| table-header + label | S | (21,156,21,24) | On; 35.5/170.5 | @ 154,388,42,48; ink @ 183,402,27,16 |
| table-header + label | S | (42,156,172,24) | Service; 68.5/170.5 | @ 196,388,344,48; ink @ 249,401,76,17 |
| table-view + checkbox + label | off enabled T | (21,180,193,20); box (35,183,14,14) | Screen Sharing; 67.5/192.5 | @ 154,436,386,40; @ 182,442,28,28; ink @ 247,444,169,20 |
| table-view + checkbox + label | on selected T | (21,200,193,20); box (35,203,14,14) | File Sharing; 68/212.5 | @ 154,476,386,40; @ 182,482,28,28; ink @ 248,484,129,20 |
| table-view + checkbox + label | off disabled T | (21,220,193,20); box (35,223,14,14) | Media Sharing; 68/232.5 | @ 154,516,386,40; @ 182,522,28,28; ink @ 248,524,158,20 |
| table-view + checkbox + label | off enabled T | (21,240,193,20); box (35,243,14,14) | Printer Sharing; 68/252.5 | @ 154,556,386,40; @ 182,562,28,28; ink @ 248,564,165,20 |
| table-view + checkbox + label | off enabled T | (21,260,193,20); box (35,263,14,14) | Remote Login; 68/272.5 | @ 154,596,386,40; @ 182,602,28,28; ink @ 248,604,151,20 |
| table-view + checkbox + label | off enabled T | (21,280,193,20); box (35,283,14,14) | Remote Management; 68/292.5 | @ 154,636,386,40; @ 182,642,28,28; ink @ 248,645,237,19 |
| table-view + checkbox + label | off enabled T | (21,300,193,20); box (35,303,14,14) | Remote Apple Events; 68/312.5 | @ 154,676,386,40; @ 182,682,28,28; ink @ 248,684,237,20 |
| table-view + checkbox + label | L enabled / D disabled, T | (21,320,193,20); box (35,323,14,14) | L: Bluetooth Sharing; D: Internet Sharing; 68/332.5 | @ 154,716,386,40; @ 182,722,28,28; ink @ 248,724,199,20 |
| table-view + checkbox + label | L disabled / D enabled, T | (21,340,193,20); box (35,343,14,14) | L: Internet Sharing; D: Bluetooth Sharing; 68/352.5 | @ 154,756,386,40; @ 182,762,28,28 |
| table-view + checkbox + label | off enabled T | (21,360,193,20); box (35,363,14,14) | Content Caching; 67.5/372.5 | @ 154,796,386,40; @ 182,802,28,28; ink @ 247,804,187,20 |
| status-dot + label | green, R | (237,157,116,14) | File Sharing: On; 258/167.5 | @ 586,390,232,28; ink @ 628,391,188,25 |
| label | S wrapped | (237.5,181.5,396.5,24.5) | Other users can access shared folders on this computer, and administrators / all volumes, at smb://192.168.7.167 | @ 587,439,793,49; first glyph 237.5/B190 |
| push-button | regular enabled | (562.5,223.5,84,20) | Options… | @ 1236,522,170,42; col 1245 |
| label | R | (235.5,253,93.5,10.5) | Shared Folders:; 235.5/263 | @ 583,582,187,21 |
| label | R | (407,253.5,37,10) | Users:; 407/263 | @ 926,583,74,20 |
| list-view + image-view | selected T | (235,273,160,18) | L: shackett; D: mhackett’s…blic Folder; first x257.5 L / 258 D, B285.5 | L @ 627,630,95,18; D @ 628,630,253,18 |
| list-view + image-view | normal T, D only | (235,291,160,19) | shackett; 257.5/304.5 | E-D @ 627,668,95,18 |
| list-view + image-view | T | (406,273,136,19) | L: Stephen; D: mhackett; x428.5 L /429 D, B285.5 | L @ 969,630,91,22; D @ 970,630,102,18 |
| pop-up-button | borderless enabled T | (543,273,103,19) | Read & Write; 550/286.5 | @ 1198,622,206,38; ink @ 1212,632,155,20; row 634 |
| list-view + image-view | T | (406,292,136,19) | Staff; 428.5/304.5 | @ 969,668,52,18 |
| pop-up-button | borderless enabled T | (543,292,103,19) | Read Only; 550/305.5 | @ 1198,660,206,38; ink @ 1212,671,121,24 |
| list-view + image-view | T | (406,311,136,19) | Everyone; 429/323.5 | @ 970,707,101,22 |
| pop-up-button | borderless enabled T | (543,311,103,19) | Read Only; 550/324.5 | @ 1198,698,206,38; ink @ 1212,709,121,24 |
| gradient-button | add folder enabled | (234,419,22,21) | + | @ 580,914,44,42; col 587, row 934 |
| gradient-button | remove folder enabled | (256,419,23,21) | − | @ 624,914,46,42 |
| gradient-button | add user enabled | (405,419,22,21) | + | @ 922,914,44,42 |
| gradient-button | remove user disabled | (427,419,23,21) | − | @ 966,914,46,42 |
| help-button | regular enabled | (625.5,483.5,20,20) | ? | @ 1363,1043,40,40; row 1062, col 1382 (halo excluded) |

### Layout grid

Computer label right ink edge `150 pt`, field left `158.5 pt`, gap `8.5 pt` [C]. Service table x`20 pt`; checkbox x`35 pt`; label x`68 pt`; row pitch `20 pt` [M], col 189. Details begin x`234–237.5 pt`; list gap `9 pt`; user/permission divider x`542 pt` (`1 pt` thick) [M], row 882 x1196..1198. Folder/user rows have `19 pt` pitch; lower action strips start `8 pt` below list bottom [C]. Large band separators at y`134 pt` and y`457 pt` [M], col 130. No lock is visible [M].

## App-specific elements

Home-folder icon, blue Public Folder icon and person/group silhouettes are custom cell assets [M], E-L/E-D @ 592,626,31,66 and @ 934,626,31,106. Folder name is middle-truncated in dark; retain the exact displayed form rather than guessing its hidden characters [M]. A small split-view drag handle lies between folder/user lists [M], @ 908,753,12,22.

### Embedded labels and explicit evidence

First glyph x / baseline B in frame pt [M], R `13 pt` [C]; both captures sampled [M]. These complete button-title metrics. The search field's focus-ring geometry is delegated to shared `focus-ring` and `toolbar-search-field` [I], but its focused state is directly shown [M].

| Label | x / B [M] | Full evidence citation |
|---|---|---|
| Edit… | 571/107.5 | `10-15-Catalina-Light-System-Preferences-Sharing.png @ 1254,272,63,20`; dark same |
| Options… | 576.5/237.5 | `10-15-Catalina-Light-System-Preferences-Sharing.png @ 1265,532,113,25`; dark same |

Grouped geometry/colour evidence for all earlier tables [M]: `10-15-Catalina-Light-System-Preferences-Sharing.png @ 112,152,1336,984`; `10-15-Catalina-Dark-System-Preferences-Sharing.png @ 112,152,1336,984`. Folder transcription was checked in enlarged crops `10-15-Catalina-Light-System-Preferences-Sharing.png @ 622,620,274,82` and `10-15-Catalina-Dark-System-Preferences-Sharing.png @ 622,620,274,82` [M]. Bezel rects exclude external halo/shadow; full crop bounds are retained as evidence [M].

## Not reproducible / assets needed

Matching Catalina home/public-folder and user/group icons are required [I]. Search focus differs by capture; do not force focus in dark [M]. Permission menus, Edit sheet, sharing Options, alternate service selections and unshown folders/users are not shown [M]. Help circle edge is measured independently from its outer halo [M], E-L/E-D row 1062, col 1382. Font fallback may alter truncation [I].

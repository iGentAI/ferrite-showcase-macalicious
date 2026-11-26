# Activity Monitor
- **Screenshots:** 10-15-Catalina-Light-Activity-Monitor.png, 10-15-Catalina-Dark-Activity-Monitor.png
- **Window:** 839 x 634 pt [M] (image x=112..1789, y=76..1343). Title bar + toolbar (55 pt), title "Activity Monitor (My Processes)".

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Title + toolbar | 55 (y=76..185), bottom line 1 px | gradient to `#c8c8c8`, lines `#b9b9b9` / `#a3a3a3` | `#363738`, line `#000000` | [M] @ 540,180,1,8 |
| Table header (`table-header`) | 23 + 1 (y=188..235) | `#efefef` | `#2d2f31` | [M] @ 540,188,1,48 |
| Process table (`table-view`) | y=236..1109, rows 18 | `#ffffff` / `#f4f5f5` | `#1e1f21` / `#292a2b` | [M] @ 540,236,1,180 |
| Rule | 1 (y=1110) | `#c6c6c6` | `#a6a6a6` | [M] @ 540,1110,1,2 |
| Footer panel | 116 high (y=1112..1343) | `#ececec` | `#303133` | [M] @ 540,1112,1,19 |
| Summary box in footer | 580 x 90 (x=371..1530, y=1136..1315), 1 pt border, three cells | white, border `#c6c6c6` | dark fill, light border | [M] Light-Activity-Monitor @ 1000,1136,1,180 and 350,1200,24,1 |

Columns (separator x in px -> width in pt): Process Name 112..593 (241); % CPU 596..749 (77, sorted descending); CPU Time 752..895 (72); Threads 898..1021 (62); Idle Wake Ups 1024..1223 (100); % GPU 1226..1379 (77); GPU Time 1382..1535 (77); PID 1538..1621 (42); User 1624..1789 (83) [M] (10-15-Catalina-Light-Activity-Monitor.png row y=196: separators at x=594, 750, 896, 1022, 1224, 1380, 1536, 1622). Header titles are centred; cells: name left-aligned with a 16 pt icon column, numbers right-aligned, PID right-aligned, user left-aligned.

Toolbar (px, row y=148): Quit Process 127..192 (33 pt); Inspect 207..272 (33 pt); Action gear pull-down 287..364 (39 pt); tab-style segmented control "CPU | Memory | Energy | Disk | Network" 624..1277 (327 pt, "CPU" selected); search field 1377..1774 (199 pt) [M].

```
            Activity Monitor (My Processes)
[x][i][gear v]      [CPU|Memory|Energy|Disk|Network]        [Search]
 Process Name | % CPU v | CPU Time | Threads | Idle Wake Ups | % GPU | GPU Time | PID | User
 [ic] Activity Monitor   28.3   1.67   20   3   0.0   0.00   2026  shackett   <- selected
 ...
 +-----------------+------ CPU LOAD ------+--------------------+
 | System:  1.00%  |                      | Threads:     1,384 |
 | User:    2.33%  |       (graph)        | Processes:     354 |
 | Idle:   96.67%  |                      |                    |
```

## Components used
`window`, `title-bar`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-pop-up` (gear), `toolbar-segmented-control`, `toolbar-search-field`, `table-header` (sort indicator), `table-view` (alternating rows, emphasized selection), `box`, `separator`, `label`.

## App-specific elements
- Footer summary box: left cell rows "System:", "User:", "Idle:" (labels left, values right-aligned; System value red, User value blue, others primary), row pitch 20 pt with 1 pt rules; middle cell title "CPU LOAD" 9 pt Semibold grey centred with a rule under it (y=1182) and a small history graph (red/blue area) at the bottom right; right cell "Threads:" / "Processes:". [M] rule: 10-15-Catalina-Light-Activity-Monitor.png @ 1000,1182,1,2; User value blue `#4facf2 (sRGB #1dadf8)` @ 680,1200.
- Process icons: 16 pt app icons or the generic document icon; rows without an icon keep the indent.

## Content in the screenshot
Light rows (name, %CPU, CPU time, threads, wake-ups, %GPU, GPU time, PID, user): Activity Monitor 28.3 1.67 20 3 0.0 0.00 2026 shackett (selected); iconservicesagent 0.8 2.09 6 0 .. 558; sharingd 0.2 1.40 4 0 .. 568; cfprefsd 0.1 1.93 3 0 .. 472; UserEventAgent 0.1 1.26 3 0 .. 476; sharedfilelistd 0.1 0.26 5 0 .. 572; useractivityd 0.1 0.40 3 0 .. 570; cloudpaird 0.1 0.32 2 0 .. 1741; mdworker_shared 0.1 0.08 3 0 .. 1935; Location Menu 0.1 0.39 4 0 .. 586; distnoted 0.0 0.84 2 0 .. 484; lockoutagent 0.0 0.45 3 1 .. 504; SafariBookmarksSyncAgent 0.0 1.10 7 1 .. 563; MTLCompilerService 0.0 0.10 3 0 .. 2028; Finder 0.0 14.90 9 1 .. 1711; universalaccessd 0.0 0.21 5 0 .. 487; EmojiFunctionRowIM 0.0 0.88 6 1 .. 657; appstoreagent 0.0 0.25 3 1 .. 828; Spotlight 0.0 15.03 21 0 .. 855; secd 0.0 1.30 2 0 .. 483; adprivacyd 0.0 0.16 3 1 .. 625; nsurlsessiond 0.0 1.04 5 0 .. 490; ViewBridgeAuxiliary 0.0 0.35 3 0 .. 557; QuickLookUIService (Spotlight) 0.0 0.31 7 0 .. 1896. Footer: System 1.00%, User 2.33%, Idle 96.67%, Threads 1,384, Processes 354. Dark: different process list with "Finder" selected (row 7); System 1.14%, User 1.89%, Idle 96.97%, Threads 1,414, Processes 386.

## Not reproducible / assets needed
Process icons; the CPU load graph is live data (draw a static placeholder).

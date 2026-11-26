# Console
- **Screenshots:** 10-15-Catalina-Light-Console.png, 10-15-Catalina-Dark-Console.png
- **Window:** 1000 x 500 pt [M] (image x=112..2111, y=76..1075). Title bar + icon-and-label toolbar (68 pt) + scope bar (23 pt). Title "Console (9,318 messages)" (dark: "Console (86 messages)").

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Title + toolbar | 68 (y=76..211) | gradient, bottom lines `#c4c4c4` / `#adadad` | dark gradient | [M] Light-Console @ 900,150,1,62 |
| Scope bar (`scope-bar`) | 23 (y=212..257) | `#d2d2d2` -> `#cccccc`, bottom lines `#bdbdbd` / `#a7a7a7` | `#3a3b3b` -> `#373839`, line `#000000` | [M] @ 900,212,1,46 |
| Sidebar (`sidebar`) | 180 wide (x=112..471) | `#e7e7e6` | `#2c2d2e` | [M] @ 300,700 |
| Divider | 1 | `#cfcfce` | `#000000` | [M] @ 472,268 |
| Message table header | 24 + 1 (y=258..307) | `#ffffff`, line `#d6d6d6` | `#323231`, line `#4a4a49` | [M] @ 900,258,1,50 |
| Message table (`table-view`) | y=308..529, rows 21 | `#ffffff` / `#f4f5f5` | `#1e1f20` / `#292a2a` | [M] @ 900,308,1,222 |
| Divider | 1 (y=530) | `#d5d5d5` | `#000000` | [M] @ 900,530,1,2 |
| Detail pane | y=532..1075 (272) | `#ffffff` | `#1e1f20` | [M] @ 900,560 |

Columns (px): Type 474..577 (52 pt); Time 580..923 (172); Process 926..1049 (62); Message 1052..2111. Header separators `#e5e5e5` at x=578, 924, 1050 [M] (row y=268). Header titles left-aligned 5 pt in.

Toolbar (px, button row y~126..170, labels beneath): Now 127..216 (45 pt wide buttons); Activities 235..324; Clear 423..512; Reload 527..616; Info 711..800; Share 833..922; search field 937..2096 (580 pt, flexible) [M] (row y=146). Labels 11 pt centred under each button ("Now", "Activities", "Clear", "Reload", "Info", "Share").

Scope bar: sidebar-toggle button at the left (x~145..175), then "All Messages" as the selected pill (`#858585`-grey fill, white 11 pt Semibold text, 16 pt high, y=218..249) and "Errors and Faults" plain [M] 10-15-Catalina-Light-Console.png @ 300,218,1,32.

```
                      Console (9,318 messages)
 [Now][Activities]   [Clear][Reload]   [Info]  [Share] [Search ......................]
 [=]  (All Messages)  Errors and Faults
+ Devices ----+ Type | Time            | Process | Message
| [] ismh15   |      | 15:07:45.459156-0500 | hidd | [HID] [MT] dispatchEvent ...
| Reports     | ...
|  Crash Rep. +---------------------------------------------------------
|  Spin Rep.  | deleted
|  Log Rep... | Subsystem: com.apple.cache_delete  Category: daemon  Details      2019-10-03 15:07:40.886354-0500
|  system.log | ------------------------------------------------
|             |  com.apple.coresymbolicationd.cache-delete : 0
```

## Components used
`window`, `title-bar`, `window-controls`, `toolbar`, `toolbar-labelled-item`, `toolbar-button`, `toolbar-search-field`, `scope-bar`, `sidebar` (grey selection on "ismh15"), `split-view` (vertical and horizontal thin dividers), `table-header`, `table-view`, `text-view` (detail), `separator`, `label`.

## App-specific elements
- Table text: Menlo 11 (monospaced), `#252525` / `#dddddd`; row 21 pt; the first visible row is scrolled half under the header.
- Detail pane: process name 13 pt Bold at 20.5 pt left inset (x~515), cap top 16 pt below the divider; metadata line 11 pt ("Subsystem: ...  Category: ..." primary, "Details" blue link, timestamp right-aligned 20 pt from the edge); 1 pt rule `#e6e6e6` at y=680 inset 20 pt both sides; message body Menlo 11 below. [M] rule: 10-15-Catalina-Light-Console.png @ 900,680,1,2.
- Sidebar icons: template glyphs 16-18 pt (laptop, warning triangle, spinner wheel, document, wrench-screwdriver, bar chart, file).

## Content in the screenshot
Sidebar: "Devices": ismh15 (selected); "Reports": Crash Reports, Spin Reports, Log Reports, Diagnostic Reports, Mac Analytics Data, system.log. Columns: Type, Time, Process, Message. Light rows: 15:07:45.459156-0500 hidd "[HID] [MT] dispatchEvent Dispatching event with 4 children, _eventMask=0x6..."; 15:07:45.585396-0500 tccd "PID[259] is checking access for target PID[1835]"; 15:07:45.585726-0500 tccd "Granting PID[1835] access to kTCCServiceScreenCapture via entitlement 'com..."; 15:07:45.609615-0500 kernel "[IGFB][INFO   ] [Flip_Transaction] CCS Param update: AuxOffset:0x0 AuxStri..."; 15:07:45.684375-0500 hidd "[HID] [MT] dispatchEvent Dispatching event with 3 children, _eventMask=0x6...". Detail: "deleted"; "Subsystem: com.apple.cache_delete  Category: daemon  Details"; "2019-10-03 15:07:40.886354-0500"; "com.apple.coresymbolicationd.cache-delete : 0". Dark: rows from "Report..."/"distno..."/hidd; detail "mds", "Subsystem: com.apple.spotlightserver  Category: QueryTask  Details", "2019-10-04 10:38:45.878798-0500", "directQueryFetchResultsReply 208975 1795162112 35 at qos 0x15".

## Not reproducible / assets needed
Toolbar and sidebar glyphs.

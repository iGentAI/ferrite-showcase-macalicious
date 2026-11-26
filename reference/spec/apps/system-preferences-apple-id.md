# System Preferences — Apple ID

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Apple-ID.png`; `10-15-Catalina-Dark-System-Preferences-Apple-ID.png` [M].
- **Window:** 668 × 598 pt, both appearances [M], opaque image rect `112,76,1336,1196`. Unified preferences toolbar: reuse `preferences-toolbar`, `preferences-window`, `title-bar`, `window-controls`, `toolbar-search-field` [I: component mapping]. Title “Apple ID” [M].
- **State differences:** both show Stephen Hackett’s iCloud page, all nine app checkboxes on, Optimize Mac Storage on, Media & Purchases disabled/not signed in, and the same storage figures [M]. Light search is focused with blue ring and insertion caret; dark search is unfocused [M]. Storage category colours are dimmer in dark; its available-space segment is black rather than grey [M].

## Layout

```text
+---------------- shared toolbar -------------------+
| tennis-ball avatar | Apps on this Mac using iCloud:|
| Stephen Hackett    | [✓] icon iCloud Drive Options…|
| account navigation | [✓] icon …                   |
| ———————————        | [✓] icon Siri                |
| iCloud (selected)  | [✓] Optimize Mac Storage      |
| Media & Purchases  |     explanatory copy         |
| ———————————        | iCloud Storage: …            |
| ismh15             | [storage bar] [Manage…]       |
|                    |                         (?) |
+---------------------------------------------------+
```

All rects are `(x,y,w,h)` pt relative to opaque frame [M unless explicitly I]. L/D abbreviate the full filenames above; all evidence rects are image pixels.

| Region | Rect pt [M] | Light stored fill [M] | Dark stored fill [M] | Evidence |
|---|---|---|---|---|
| Account sidebar | (0,38,193,560) | #ececec | #2f3031 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 112,152,386,1120; sample 160,190 |
| Sidebar dividing hairline | (192,38,1,560) | #d7d7d7 | #444546 / #4e4f50 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 496,190,2,1050 |
| Content background | (193,38,475,560) | #e3e3e3 | #363637 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 498,152,950,1120; sample 510,190 |
| App table outline | (215,86,433,318.5) | #c5c5c5 | #565656 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 542,248,866,637 |
| App table odd rows | (216,87,431,36), repeated | #ffffff | #1d1e1f | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 544,250,862,72; sample 560,260 |
| App table even rows | (216,123,431,36), repeated | #f4f5f5 | #28292a | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 544,322,862,72; sample 560,335 |
| Selected iCloud sidebar row | (0,382,192,32) | #d5d5d5 | #434445 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 112,840,384,64 |
| Storage bar | (215,517.5,338,19) | multicolour + #c9c9c9 | multicolour + #000000 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 542,1111,676,38 |

### Layout grid

Content left inset from sidebar divider 22 pt; right inset 20 pt [C], from table rect. Checkbox column x=225 pt; app icon column near x=252 pt; label ink x=292.5–293 pt [M]. App row pitch 36 pt, with last row clipped at table bottom after 28.5 pt [C], from vertical run x=1400 at y=250…885. Checkboxes have 14 pt square outer bounds [M]. Sidebar account text leading x=52.5–53 pt; navigation baseline pitch 34 pt, then separators and selected iCloud group [C]. Storage bar–Manage gap 8 pt [C]; help has right margin 20 pt and bottom margin 20 pt [C]. No lock [M].

## Components used

`sidebar`, `separator`, `label`, `image-view`, `table-view` (alternating rows), `checkbox`, `push-button`, `level-indicator`, `help-button`, shared chrome [I: inventory mapping]. Storage is a custom segmented capacity graphic, not a determinate progress animation [I: visible categories].

## Content in the screenshot

Complete pane inventory, reading order. Text rects describe measured ink [M]. Text anchors `(first ink x, baseline y)` and SF size classes [C] follow CONVENTIONS cap-height mapping; baseline excludes 3 pt regular/2 pt small descenders. Navigation hit cells with no visible outline are [I] fitted to the measured text rhythm. Repeated app checkbox coordinates are measured from `col` x=576 [M].

| Component id | Variant / state [M] | Rect pt | Exact visible text [M] | Text anchor / class pt [C] | Evidence image rect |
|---|---|---|---|---|---|
| image-view | circular profile | (47,65,98,98) [M] | — | — | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 206,206,196,196 |
| label | bold account name | (43.5,175,105,12.5) [M] | Stephen Hackett | (43.5,184.5), 13 bold | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 199,426,210,25 |
| sidebar + image-view | normal | ink (52.5,233,55.5,10.5) [M]; cell (0,221,192,34) [I] | Overview | (52.5,243.5), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 217,542,111,21 |
| sidebar + image-view | normal | ink (53,267,118.5,12.5) [M]; cell (0,255,192,34) [I] | Name, Phone, Email | (53,276.5), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 218,610,237,25 |
| sidebar + image-view | normal | ink (53,301,123,12.5) [M]; cell (0,289,192,34) [I] | Password & Security | (53,310.5), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 218,678,246,25 |
| sidebar + image-view | normal | ink (53,335,120,12.5) [M]; cell (0,323,192,34) [I] | Payment & Shipping | (53,344.5), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 218,746,240,25 |
| separator | horizontal | (15,369,167,0.5) [M] | — | — | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 142,814,334,1 |
| sidebar + image-view | selected | (0,382,192,32) [M] | iCloud | (52.5,402.5), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 112,840,384,64; ink @ 217,860,74,21 |
| sidebar + image-view | disabled | ink (53,420,115,10.5) [M]; cell (0,414,192,46) [I] | Media & Purchases | (53,430.5), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 218,916,230,21 |
| label | disabled subtitle | (53,435.5,69,11) [M] | Not Signed In | (53,444.5), 11 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 218,947,138,22 |
| separator | horizontal | (15,460,167,0.5) [M] | — | — | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 142,996,334,1 |
| sidebar + image-view | device normal | ink (52.5,477,41,10.5) [M]; cell (0,466,192,42) [I] | ismh15 | (52.5,487.5), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 217,1030,82,21 |
| label | device subtitle | (52,492.5,114.5,9) [M] | This MacBook Pro 15″ | (52,501.5), 11 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 216,1061,229,18 |
| label | bold table heading | (215.5,63,193,12.5) [M] | Apps on this Mac using iCloud: | (215.5,72.5), 13 bold | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 543,202,386,25 |
| checkbox + image-view + label | checked, regular | check (225,98,14,14) [M]; ink (293,100,72,10.5) [M] | iCloud Drive | (293,110.5), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 562,272,28,28; ink @ 698,276,144,21 |
| push-button | small normal | (549,97,85,18.5) [M] | Options… | (566.5,110), 11 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 1210,270,170,37; ink @ 1245,279,97,21 |
| checkbox + image-view + label | checked, regular | check (225,134,14,14) [M]; ink (293,136,41,10) [M] | Photos | (293,146), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 562,344,28,28; ink @ 698,348,82,20 |
| checkbox + image-view + label | checked, regular | check (225,170,14,14) [M]; ink (293,172,23,10) [M] | Mail | (293,182), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 562,416,28,28; ink @ 698,420,46,20 |
| checkbox + image-view + label | checked, regular | check (225,206,14,14) [M]; ink (292.5,208.5,53.5,10) [M] | Contacts | (292.5,218.5), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 562,488,28,28; ink @ 697,493,107,20 |
| checkbox + image-view + label | checked, regular | check (225,242,14,14) [M]; ink (292.5,244,59.5,10.5) [M] | Calendars | (292.5,254.5), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 562,560,28,28; ink @ 697,564,119,21 |
| checkbox + image-view + label | checked, regular | check (225,278,14,14) [M]; ink (293,280,62.5,10) [M] | Reminders | (293,290), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 562,632,28,28; ink @ 698,636,125,20 |
| checkbox + image-view + label | checked, regular | check (225,314,14,14) [M]; ink (292.5,316,33.5,10.5) [M] | Safari | (292.5,326.5), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 562,704,28,28; ink @ 697,708,67,21 |
| checkbox + image-view + label | checked, regular | check (225,350,14,14) [M]; ink (293,352.5,34.5,9.5) [M] | Notes | (293,362), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 562,776,28,28; ink @ 698,781,69,19 |
| checkbox + image-view + label | checked, regular | check (225,386,14,14) [M]; ink (292.5,388,18,10.5) [M] | Siri | (292.5,398.5), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 562,848,28,28; ink @ 697,852,36,21 |
| checkbox | checked, regular | (225,414.5,14,14) [M] | Optimize Mac Storage | (243.5,426), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 562,905,28,28; ink @ 599,909,266,25 |
| label | explanatory line 1 | (240.5,438,365,10) [M] | The full contents of iCloud Drive will be stored on this Mac if you have | (240.5,446), 11 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 593,952,730,20 |
| label | explanatory line 2 | (240.5,452,395.5,10) [M] | enough space. Older Documents will be stored only in iCloud when space is | (240.5,460), 11 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 593,980,791,20 |
| label | explanatory line 3 | (240.5,466,41,8.5) [M] | needed. | (240.5,474.5), 11 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 593,1008,82,17 |
| label | prefix bold, remainder regular | (215.5,496.5,246.5,12.5) [M] | iCloud Storage: 5 GB (4.81 GB Available) | (215.5,506), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 543,1069,493,25 |
| level-indicator + label | custom capacity graphic | (215,517.5,338,19) [M]; caption ink (388.5,523,31.5,7.5) [M] | 4.8 GB | (388.5,530.5), 10 [C] | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 542,1111,676,38; caption 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 889,1122,63,15 |
| push-button | regular normal | (561,516,87,21) [M] | Manage… | (575.5,530.5), 13 | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 1234,1108,174,42; ink @ 1263,1119,113,24 |
| help-button | normal | (627,557,21,21) [M] | ? | component typography | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 1366,1190,42,42 |

## App-specific elements

Profile tennis-ball artwork has non-background bounds 98 × 98 pt at (47,65) [M], identical in both. Artwork table below uses stored-pixel contrast greater than 12 channel levels against surrounding fill to exclude faint shadow tails [M]. The app Calendar icon reads “17”; Siri is clipped at table bottom [M].

| Asset | Light footprint rect pt [M] | Dark footprint rect pt [M] | Evidence image px L / D |
|---|---|---|---|
| Overview account tile | (18.5,227,23,23.5) | (18.5,227,23,23) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png @ 149,530,46,47; 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 149,530,46,46 |
| Name/phone tile | (18.5,261,23,23.5) | (18.5,261,23,23) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png @ 149,598,46,47; 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 149,598,46,46 |
| Password/security tile | (18.5,295,23,23.5) | (18.5,295,23,23) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png @ 149,666,46,47; 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 149,666,46,46 |
| Payment/shipping tile | (18.5,329,23,23.5) | (18.5,329,23,23) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png @ 149,734,46,47; 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 149,734,46,46 |
| iCloud navigation tile | (18.5,386.5,23,22.5) | (18.5,386,23,23) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png @ 149,849,46,45; 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 149,848,46,46 |
| Media/Purchases tile, disabled | (18.5,420,23,23) | (18.5,420,23,23) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 149,916,46,46 |
| Device laptop thumbnail | (19.5,483,21,13.5) | (19,483,21.5,13) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png @ 151,1042,42,27; 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 150,1042,43,26 |
| iCloud Drive | (252,95.5,32,20.5) | (252,95.5,32,20.5) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 616,267,64,41 |
| Photos | (253,126,30,30.5) | (253.5,126.5,29,29) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png @ 618,328,60,61; 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 619,329,58,58 |
| Mail | (255,161.5,29,31.5) | (255.5,162,25.5,30) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png @ 622,399,58,63; 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 623,400,51,60 |
| Contacts | (254.5,197,27,31.5) | (255,197,26,30.5) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png @ 621,470,54,63; 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 622,470,52,61 |
| Calendars | (253.5,234.5,28,29) | (254,234.5,27,28) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png @ 619,545,56,58; 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 620,545,54,56 |
| Reminders | (255,270.5,26.5,30) | (255.5,270.5,25,28.5) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png @ 622,617,53,60; 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 623,617,50,57 |
| Safari | (253,306,30,30.5) | (253.5,306.5,29,29) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png @ 618,688,60,61; 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 619,689,58,58 |
| Notes | (255,342,26.5,30.5) | (255.5,342,25.5,29.5) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png @ 622,760,53,61; 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 623,760,51,59 |
| Siri, visible portion | (253.5,378.5,29.5,25) | (254,379,28,24.5) | 10-15-Catalina-Light-System-Preferences-Apple-ID.png @ 619,833,59,50; 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 620,834,56,49 |

Storage category widths are 21 pt yellow (including left edge), 10 pt orange, 10 pt blue, then 297 pt available [C], from the horizontal run at image y=1128. Flat stored samples: yellow #f5c445 (sRGB #fdc30b) / #ba9031 (sRGB #c18f06), orange #ed8735 (sRGB #fc820a) / #b96426 (sRGB #c55f05), blue #2364f5 (sRGB #0b60fe) / #1b4eba (sRGB #084bc1), available #c9c9c9 / #000000 [M]; 10-15-Catalina-Light-System-Preferences-Apple-ID.png / 10-15-Catalina-Dark-System-Preferences-Apple-ID.png @ 545,1128; 585,1128; 605,1128; 1000,1128 respectively. Label in available segment is black light / white dark [M].

## Not reproducible / assets needed

Need tennis-ball avatar, account-category tiles, device thumbnail and nine app icons [I]. A segmented capacity graphic can be drawn, but screenshot values show the illustrated dataset only, not live usage [I]. Account actions, options contents, alternate sidebar pages and pressed states are not shown [M]. System typography may vary off macOS [I].

## Evidence

L = `10-15-Catalina-Light-System-Preferences-Apple-ID.png`; D = `10-15-Catalina-Dark-System-Preferences-Apple-ID.png` [M]; each abbreviated citation expands to those exact names. `info` measured both frames. Region `row` y=300, `col` x=1400, selected row `col` x=140 and checkbox `col` x=576 measured light and confirmed dark region geometry [M]. Button rows/columns at y=276/1128 and x=1250/1360 and help x=1398 bounded visible shapes [M]. Text and artwork bounds were computed directly over original stored pixels in the cited image rectangles [M].

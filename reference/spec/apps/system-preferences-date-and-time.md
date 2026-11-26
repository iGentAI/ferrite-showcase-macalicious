# System Preferences — Date & Time

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Date-and-Time.png`; `10-15-Catalina-Dark-System-Preferences-Date-and-Time.png` [M].
- **Window:** 668 × 528 pt both [M], opaque image rect `112,76,1336,1056`. Unified toolbar; reuse `preferences-toolbar`, `preferences-window`, `title-bar`, `window-controls`, `toolbar-search-field` [I: inventory mapping]. Title “Date & Time” [M].
- **State:** Date & Time tab selected; closed lock; automatic setting checked, form controls disabled [M]. Light has focused toolbar Search; dark does not [M]. **Dataset differs:** light date October 3, 2019, digital time 10:56:59 AM; dark date October 4, 2019, 10:30:38 AM, with matching calendar selection and different clock hands [M].

## Layout

```text
+---------------- shared toolbar -------------------+
|           [Date & Time][Time Zone][Clock]          |
| +------------------------------------------------+|
| | [✓] Set date and time automatically: [server v]||
| |       date [↕]              time [↕]            ||
| |       calendar             analogue clock       ||
| |                                                ||
| | format guidance          Open Language & Region…||
| +------------------------------------------------+|
| lock  Click the lock to make changes.          (?) |
+---------------------------------------------------+
```

Rectangles `(x,y,w,h)` are in frame-relative pt. L/D abbreviate full screenshot filenames above, with evidence in original pixels.

| Region | Rect pt [M] | Light stored fill [M] | Dark stored fill [M] | Evidence |
|---|---|---|---|---|
| Pane background | (0,38,668,490) | #ececec | #2f3031 | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 130,160,1300,950; sample 140,180 |
| Tab group box | (20,72,628,386) | #e3e3e3 | #363637 | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 152,220,1256,772; sample 180,300 |
| Calendar | (159.5,190.5,137.5,147) | #ffffff | near #232323–#242324 | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 431,457,275,294; sample 440,490 / 500,550 |
| Footer band | (0,458,668,70) | #ececec | #2f3031 | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 130,992,1300,120 |

Box outline #dedede light / #4e4f50 dark [M] at 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 152,400. Calendar outline #c8c8c8 light / dark low-contrast near #3e3e3f [M] at 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 431,600 (use dark `date-picker` appearance, not a white calendar). Selected tile flat fill is stored #2366d9 (sRGB #0064e1) light / #1e5bc9 (sRGB #0058d0) dark [M], 10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 600,540; 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 636,540. The calendar is not active just because its saved date is blue [I: surrounding controls and lock indicate the disabled form].

### Layout grid

Group box side margins 20 pt; bottom-to-footer gap is zero because the footer begins immediately after the box [C]. Tab strip center x=334.5 pt; calendar center x=228.25 pt; clock center x=450 pt [C], from measured bounds. Checkbox begins x=77 pt; its label starts x=95.5 pt; server begins x=298.5 pt [M]. Right edge of automatic-setting text is x=288.5 pt and gap to server is 10 pt [C]. Calendar weekday/day column pitch 18.5 pt and row baseline pitch 18 pt [C]. Footer lock x=25.5 pt; label x=61.5 pt; help right margin 20 pt and bottom margin 16 pt [C].

## Components used

`tab-view`, `segmented-control`, `box`, `checkbox`, `combo-box`, `date-picker`, `text-field`, `stepper`, `image-view`, `label`, `push-button`, `lock-button`, `help-button`, and shared toolbar components [I: visible-anatomy inventory mapping]. Calendar and analog clock are composed date-picker variants; do not substitute modern Big Sur controls [I].

## Content in the screenshot

Complete pane inventory. Rects and strings [M]; fonts and `(first ink x, baseline y)` anchors [C], from CONVENTIONS cap-height mapping and flat-glyph bottoms. Regular text is 13 pt; footer explanation/Open button 11 pt; calendar weekday/day 10 pt. Baselines exclude descenders. D text ink varies by up to 0.5 pt at antialiased edges [M]; content differences are explicit below.

| Component id | Variant/state [M] | Rect pt [M] | Exact visible text [M] | Anchor / size pt [C] | Evidence image rect |
|---|---|---|---|---|---|
| tab-view + segmented-control | first tab selected | (212,62,99,21) | Date & Time | (226,77), 13 | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 536,200,198,42; ink @ 564,210,145,20 |
| tab-view + segmented-control | unselected | (311,62,87,21) | Time Zone | (322.5,77), 13 | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 734,200,174,42; ink @ 757,210,126,20 |
| tab-view + segmented-control | unselected | (398,62,59,21) | Clock | (409.5,77.5), 13 | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 908,200,118,42; ink 10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 931,210,67,21; D height 20 |
| checkbox | checked, disabled | (77,111,14,14) | Set date and time automatically: | (95.5,122.5), 13 | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 266,298,28,28; ink @ 303,302,386,25 |
| combo-box | regular disabled | (298.5,109.5,275,20) | Apple Americas/U.S. (time.apple.com.) | L (302.5,124), D (302.5,124.5), 13 | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 709,295,550,40; ink 10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 717,305,464,23; 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 717,304,465,25 |
| text-field + date-picker | disabled segmented date | (181,158.5,79.5,23) | L: 10/ 3/2019; D: 10/ 4/2019 | (185,177), 13 | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 474,393,159,46; ink 10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 482,407,144,23; D width 145 |
| stepper | disabled, up/down halves | (264.5,158.5,12,23) | — | — | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 641,393,24,46 |
| text-field + date-picker | disabled segmented time | (399,158.5,85.5,23) | L: 10:56:59 AM; D: 10:30:38 AM | (403,174), 13 | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 910,393,171,46; ink @ 918,405,156,19 |
| stepper | disabled, up/down halves | (488.5,158,12,23) | — | — | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 1089,392,24,46 |
| date-picker + label | disabled calendar heading | ink L (163,195.5,57,9.5); D (162.5,195.5,57.5,9.5) | Oct 2019 | L (163,205), D (162.5,205), 12 bold | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 438,467,114,19; 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 437,467,115,19 |
| date-picker / image-button | previous month triangle | (257,197,5.5,6.5) | — | — | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 626,470,11,13 |
| date-picker / image-button | current month dot | (270.5,197,7,7) | — | — | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 653,470,14,14 |
| date-picker / image-button | next month triangle | (285.5,197,5.5,7) | — | — | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 683,470,11,14 |
| date-picker | weekday headings and six date rows | (159.5,190.5,137.5,147) | See exhaustive calendar matrix below | See matrix | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 431,457,275,294 |
| date-picker / image-view | analogue clock | L (390,207,120,119.5); D (390,206.5,120,120) | 1…12; AM | See clock table | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 892,490,240,239; 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 892,489,240,240 |
| label | format guidance | L (57.5,413.5,348.5,11); D (57.5,413.5,348.5,10.5) | To set date and time formats, use Language & Region preferences. | (57.5,422), 11 | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 227,903,697,22; D height 21 |
| push-button | small enabled | (415,409,159,18) | Open Language & Region… | (423,422), 11 | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 942,894,318,36; ink 10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 958,903,276,21; D width 277 |
| lock-button | closed/locked | (25.5,482.5,22,27.5) | — | — | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 163,1041,44,55 |
| label | footer lock explanation | L (61.5,495,190.5,12); D (62,495.5,189.5,11.5) | Click the lock to make changes. | L (61.5,504), D (62,504), 13 | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 235,1066,381,24; 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 236,1067,379,23 |
| help-button | normal circular | (627,491,21,21) | ? | library typography | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 1366,1058,42,42 |

### Calendar matrix: every visible label and date

All text [M]. Seven columns in left-to-right order; row rects derive from the measured grid [C]. Use regular 10 pt [C]. The listed leading x values are measured ink positions converted to pt [M]. Evidence is 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 438,500,254,240. Baselines [C] use the flat digit/capital bottoms, not the descender in weekday “Th” (none).

| Row | Text, left to right [M] | Leading ink x pt, light [M] | Baseline y pt [C] | Row rect pt [C] |
|---|---|---|---|---|
| Weekdays | Su · Mo · Tu · We · Th · Fr · Sa | 166.5,183,204,219.5,240.5,262,278 | 223 | (162.5,211,129.5,18) |
| Date row 1 | 29 · 30 · 1 · 2 · 3 · 4 · 5 | 168,186.5,212,229.5,248,265.5,284.5 | 241 | (162.5,229,129.5,18) |
| Date row 2 | 6 · 7 · 8 · 9 · 10 · 11 · 12 | 173.5,192.5,210.5,229,243,262.5,280 | 259 | (162.5,247,129.5,18) |
| Date row 3 | 13 · 14 · 15 · 16 · 17 · 18 · 19 | 169,187,205.5,224,243,261,280 | 277 | (162.5,265,129.5,18) |
| Date row 4 | 20 · 21 · 22 · 23 · 24 · 25 · 26 | 168,187.5,204.5,223,241.5,260,278.5 | 295 | (162.5,283,129.5,18) |
| Date row 5 | 27 · 28 · 29 · 30 · 31 · 1 · 2 | 168,186,204.5,223,243,267.5,285 | 313 | (162.5,301,129.5,18) |
| Date row 6 | 3 · 4 · 5 · 6 · 7 · 8 · 9 | 174,192,211,229,248,266.5,285 | 331 | (162.5,319,129.5,18) |

Dark leading ink x differences: weekday Su right edge +0.5 pt, other weekday leading y can differ 0.5 pt; row 1: 30 x=186 pt, selected 4 x=266 pt; row 2: 7 x=192 pt; row 5: 31 x=242.5 pt; row 6: 8 x=266 pt [M]. Remaining leading x agrees with light [M]. September 29/30 and November 1–9 are muted [M]. Light selected day 3 tile `(237,229,19,16)` pt; dark selected day 4 tile `(255.5,229,19,16)` pt [M], evidence 10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 586,534,38,32; 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 623,534,38,32. Matrix row allocations are not separately painted day hit rectangles [I].

### Clock labels

Static white face with black numerals in both appearances [M]. Font 13 pt [C]; coordinates below are measured light first-ink x with baseline from digit bottoms [C], in pt. Full clock evidence 10-15-Catalina-Light-System-Preferences-Date-and-Time.png / 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png @ 892,489,240,240. Clock digit rect widths/heights derive from the cited ink boxes [C]; use the asset for exact raster reproduction [I].

| Visible text [M] | Anchor pt [C] | Light ink evidence px [M] |
|---|---|---|
| 12 | (443.5,228) | 999,513,25,19 |
| 1 | (470.5,234.5) | 1053,526,7,19 |
| 2 | (485.5,250.5) | 1083,558,12,19 |
| 3 | (492,271) | 1096,599,13,19 |
| 4 | (484.5,293) | 1081,643,14,19 |
| 5 | (469,308.5) | 1050,674,12,19 |
| 6 | (446.5,315) | 1005,687,13,19 |
| 7 | (425.5,308.5) | 963,674,12,19 |
| 8 | (409,293) | 930,643,13,19 |
| 9 | (401.5,271) | 915,599,13,19 |
| 10 | (406.5,250.5) | 925,558,26,19 |
| 11 | (423.5,234.5) | 959,525,24,20 |
| AM | (440.5,289) | 993,635,37,19 |

## App-specific elements

Clock outer diameter 120 pt [M]; center approximately (450,267) pt [C: midpoint of frame]. Black hour/minute hands and thin red second hand [M]. Draw from the captured digital times rather than inventing a single shared pose [C: the displayed times above]. Exact bevel, face shadow and hands are best retained as appearance-specific clock assets [I]. Calendar navigation glyph footprints in the control table are measured in both appearances [M]; they do not establish an invisible button hit area [I].

## Not reproducible / assets needed

Need closed-lock art and clock face/bevel; optionally complete captured clock images [I]. The screenshot only shows Date & Time; Time Zone/Clock contents, unlocked state and server menu are not shown [M]. Disabled rendering must remain disabled; the enabled Language & Region action and help are distinct [M]. Off-macOS system-font substitution may change text metrics [I].

## Evidence

L = `10-15-Catalina-Light-System-Preferences-Date-and-Time.png`; D = `10-15-Catalina-Dark-System-Preferences-Date-and-Time.png` [M]; abbreviated citations refer to these exact files. `info`, region `row` y=400/`col` x=1300 in both appearances; small border runs around x=431/705, y=393/438/457/750; tab `col` x=550; checkbox `col` x=280; server x=1200; selected tiles `col` x=600/636; Open button x=1240; help x=1398 established visible shapes [M]. Text, clock and lock bounds were numerically sampled in the cited original-pixel regions [M].

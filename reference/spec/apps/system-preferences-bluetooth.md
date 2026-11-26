# System Preferences — Bluetooth

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Bluetooth.png`; `10-15-Catalina-Dark-System-Preferences-Bluetooth.png` [M].
- **Window:** 668 × 432 pt in both, opaque image rect `112,76,1336,864` [M]. Unified toolbar; reuse `preferences-toolbar`, `preferences-window`, `title-bar`, `window-controls`, `toolbar-search-field` [I: inventory mapping]. Title “Bluetooth” [M].
- **State:** Bluetooth On in both; menu-bar checkbox off; scanning spinner in Devices header [M]. **Content differs:** light device subtitle is “Connected - Charged”; dark is “Not Connected” [M]. The mouse asset and Bluetooth illustration have different shadow treatment [M].

## Layout

```text
+---------------- shared toolbar --------------------+
| Bluetooth artwork | Devices                 spinner|
|                   | mouse  Stephen's Magic Mouse 2 |
| Bluetooth: On     |        status                 |
| Turn Bluetooth Off|                               |
| Now discoverable… |                               |
| “ismh15”          |                               |
|                   +-------------------------------+
|                   [ ] Show Bluetooth… Advanced…(?)|
+---------------------------------------------------+
```

All rects `(x,y,w,h)` in frame-relative pt; evidence in original image px. L/D expand to the full filenames above. Geometry values are [M] except computed layout spacing and explicit inferred values.

| Region | Rect pt [M] | Light stored fill [M] | Dark stored fill [M] | Evidence |
|---|---|---|---|---|
| Pane | (0,38,668,394) | #ececec | #303031 | 10-15-Catalina-Light-System-Preferences-Bluetooth.png / 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 130,160,1300,760; sample 140,180 |
| Device list, outer border | (259,58,389,316) | #c5c5c5 | #565656 | 10-15-Catalina-Light-System-Preferences-Bluetooth.png / 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 630,192,778,632 |
| List header | (260,59,387,22) | #f0f0f0 | #2b2b2c | 10-15-Catalina-Light-System-Preferences-Bluetooth.png / 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 632,194,774,44; sample 640,220 |
| Header separator | (260,80,387,1) | #e1e1e1 / #cecece | #3a3a3b / #4d4d4e | 10-15-Catalina-Light-System-Preferences-Bluetooth.png / 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 632,236,774,2 |
| List content | (260,81,387,292) | #ffffff | #1e1e1f | 10-15-Catalina-Light-System-Preferences-Bluetooth.png / 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 632,238,774,584; sample 640,400 |
| Footer, no separate divider | (259,374,389,38) | #ececec | #303031 | 10-15-Catalina-Light-System-Preferences-Bluetooth.png / 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 630,824,778,76 |

### Layout grid

List right margin 20 pt; footer help right margin 20 pt; list top content inset from toolbar bottom 20 pt [C]. Left artwork/status column centers near x=131 pt [C: artwork and status bounds]. Device text leading x=313.5 pt; header first glyph x=269 pt; list checkbox x=259 pt [M]. List-to-footer checkbox gap 20 pt; checkbox/text gap 4.5 pt; Advanced-to-help gap 12 pt [C], from rects below. No lock, tab strip or right-aligned form label column is visible [M].

## Components used

`image-view`, `label`, `table-view`, `table-header`, `progress-spinner`, `push-button`, `checkbox`, `help-button`, and shared preferences chrome [I: visible-anatomy inventory mapping].

## Content in the screenshot

Complete controls and labels in reading order. Text rects are ink bounds [M]; button rects exclude diffuse shadow. Font classes and baselines [C] follow CONVENTIONS: regular 13 pt from capital height, header/subtitle 11 pt, status 13 pt bold. Baselines exclude 3 pt regular/2 pt small descenders. Text anchors are `(first ink x, baseline y)` pt. D is noted wherever its ink or data differs.

| Component id | Variant/state [M] | Rect pt [M] | Exact visible text [M] | Text anchor / size pt [C] | Evidence image rect |
|---|---|---|---|---|---|
| image-view | Bluetooth emblem | L (77.5,61.5,106.5,144.5); D (78.5,61.5,104.5,142) | — | — | 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 267,199,213,289; 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 269,199,209,284 |
| label | status bold | L (88,218,88,10.5); D (88.5,218,87.5,10) | Bluetooth: On | L (88,228.5), D (88.5,228), 13 bold | 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 288,512,176,21; 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 289,512,175,20 |
| push-button | regular normal | (62,239,141,21) | Turn Bluetooth Off | L (76.5,254), D (76,254), 13 | 10-15-Catalina-Light-System-Preferences-Bluetooth.png / 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 236,554,282,42; ink 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 265,564,222,20; 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 264,564,223,20 |
| label | centered regular | L (71,271,123.5,10); D (71,271,123,10) | Now discoverable as | (71,281), 13 | 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 254,618,247,20; 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 254,618,246,20 |
| label | centered hostname | L (106,297.5,53,10.5); D (106,297.5,53,10) | “ismh15” | L (106,308), D (106,307.5), 13 | 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 324,671,106,21; 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 324,671,106,20 |
| table-header + label | bold heading | (269,64,42.5,9) | Devices | (269,73), 11 bold | 10-15-Catalina-Light-System-Preferences-Bluetooth.png / 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 650,204,85,18 |
| progress-spinner | small indeterminate | (612,62.5,15,15) | — | — | 10-15-Catalina-Light-System-Preferences-Bluetooth.png / 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 1336,201,30,30 |
| image-view | device thumbnail | L (278.5,90.5,17,30); D (279,91,16,28.5) | — | — | 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 669,257,34,60; 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 670,258,32,57 |
| label | device name normal | (313.5,91,154.5,12.5) | Stephen's Magic Mouse 2 | (313.5,100.5), 13 | 10-15-Catalina-Light-System-Preferences-Bluetooth.png / 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 739,258,309,25 |
| label | secondary device status | L (313.5,109.5,112,10.5); D (314,109.5,77,8.5) | L: Connected - Charged; D: Not Connected | L (313.5,118), D (314,118), 11 | 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 739,295,224,21; 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 740,295,154,17 |
| checkbox | regular unchecked | (259,394,14,14) | Show Bluetooth in menu bar | L (277.5,406.5), D (277.5,406), 13 | 10-15-Catalina-Light-System-Preferences-Bluetooth.png / 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 630,864,28,28; ink 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 667,868,339,21; 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 667,868,339,20 |
| push-button | regular normal | (519,391,99,21) | Advanced… | L (533,406), D (533,406), 13 | 10-15-Catalina-Light-System-Preferences-Bluetooth.png / 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 1150,858,198,42; ink 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 1178,869,138,19; 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 1178,868,138,20 |
| help-button | circular normal | (630,391,21,21) | ? | component typography | 10-15-Catalina-Light-System-Preferences-Bluetooth.png / 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 1372,858,42,42 |

The one device cell has no painted selection/hit outline [M]; a full-width row hit area is inferred, not measured [I]. The spinner is a captured animation phase, not a fixed icon [I].

## App-specific elements

The Bluetooth artwork is a tall rounded blue plaque, white Bluetooth rune and soft shadow; actual non-background bounds differ by appearance as measured in the table [M]. Preserve the same interior blue art rather than recolouring it for dark mode [I: both images retain the blue emblem]. Mouse thumbnail has light grey outline and shadow in light, a high-contrast white silhouette in dark [M]. Exact assets are preferable to approximate glyphs [I].

## Not reproducible / assets needed

Need Bluetooth plaque and Magic Mouse thumbnail for both appearances [I]. Scanning progress can use the library spinner; no scan timing is measurable from a still [I]. Device connection actions, Advanced dialog, alternate on/off states and device selection are not shown [M]. Font rendering off macOS may differ [I].

## Evidence

L = `10-15-Catalina-Light-System-Preferences-Bluetooth.png`; D = `10-15-Catalina-Dark-System-Preferences-Bluetooth.png` [M]. Abbreviated citations expand to these full names. Both `info` frame measurements agree. `row` y=400 and `col` x=1300 measured the table/header in both appearances. Checkbox `row` y=877 and `col` x=644, button `row` y=574/880 and `col` x=500/1300, and help `col` x=1400 bounded controls [M]. Stored-pixel bounding within the cited image regions established text and artwork bounds for both images [M].

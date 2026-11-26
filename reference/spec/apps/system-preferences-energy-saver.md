# System Preferences — Energy Saver

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Energy-Saver.png`; `10-15-Catalina-Dark-System-Preferences-Energy-Saver.png` [M].
- **Window:** 668 × 505 pt both [M], opaque image rect `112,76,1336,1010`. Unified toolbar; reuse `preferences-toolbar`, `preferences-window`, `title-bar`, `window-controls`, `toolbar-search-field` [I: inventory mapping]. Title “Energy Saver” [M].
- **State/content:** Power Adapter selected; graphics switching on; prevent automatic sleep off; hard-disk sleep, Wi-Fi wake and Power Nap on; menu-bar battery status on; Restore Defaults disabled [M]. Slider pose agrees between appearances [M]. **Battery data differs:** light “Battery is charged.”; dark “Current battery charge: 95%  Estimated time until full: 0:34” [M]. Light toolbar Search focused, dark not focused [M].

## Layout

```text
+---------------- shared toolbar --------------------+
| [✓] Automatic graphics switching                   |
|     explanation                                    |
|             [Battery][Power Adapter]               |
| +------------------------------------------------+|
| | Turn display off after: ———▼—————————————————  ||
| |                         1 min … 15 min … Never  ||
| | [ ] Prevent computer…                          ||
| | [✓] Put hard disks…                            ||
| | [✓] Wake for Wi-Fi…                            ||
| | [✓] Enable Power Nap…                          ||
| |     explanation                                ||
| |                                                ||
| | battery status                 Restore Defaults||
| +------------------------------------------------+|
| [✓] Show battery status…           Schedule…  (?) |
+---------------------------------------------------+
```

Rectangles `(x,y,w,h)` in frame-relative pt. Evidence is in original image pixels; L/D expand to full filenames above.

| Region | Rect pt [M] | Light stored fill [M] | Dark stored fill [M] | Evidence |
|---|---|---|---|---|
| Pane exterior | (0,38,668,467) | #ececec | #2f3031 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 130,160,1300,900; sample 140,180 |
| Tab group box | (20,128,628,323) | #e3e3e3 | #363637 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 152,332,1256,646; sample 180,400 |
| Footer, continuous exterior fill | (0,451,668,54) | #ececec | #2f3031 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 130,978,1300,100 |

Box outline #dedede light / #4e4f50 dark [M] at 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 152,400. Large blank space between explanatory copy and battery status is intentional [M]; do not vertically center the controls in that area [I].

### Layout grid

Group side margins 20 pt [C]. Graphics checkbox x=20 pt, label/body x=38.5 pt; main option checkbox x=45 pt, label/body x=63.5–64 pt [M]. Right edge of slider label x=165 pt; track starts x=176 pt, gap11 pt [C]. Option row pitch23 pt; Power Nap explanation line pitch14 pt [C]. Slider track width434 pt; tick spacing alternates27.5/28 pt due image-pixel rounding [C]. Footer checkbox x=20 pt; Schedule right edge613 pt; help right margin20 pt; Schedule-to-help gap14 pt [C]. No lock [M].

## Components used

`checkbox`, `label`, `tab-view`, `segmented-control`, `box`, `slider` (tick marks and downward-pointing thumb), `push-button`, `help-button`, shared preferences chrome [I: visible-anatomy inventory mapping].

## Content in the screenshot

Complete control/label table. Text-only rects are ink bounds; control bounds exclude diffuse shadows [M]. `(first ink x, baseline y)` and SF classes [C] follow CONVENTIONS cap-height mapping: regular13 pt, explanation/battery11 pt, tick labels10 pt. Baselines exclude regular3 pt/small2 pt descenders. D AA-bound differences are recorded where relevant [M].

| Component id | Variant/state [M] | Rect pt [M] | Exact visible text [M] | Text anchor / size pt [C] | Evidence image rect |
|---|---|---|---|---|---|
| checkbox | regular checked | (20,60,14,14) | Automatic graphics switching | (38.5,71.5), 13 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 152,196,28,28; ink @ 189,200,354,25 |
| label | graphics explanation | (38.5,81.5,456.5,10.5) | Your computer will automatically switch between graphics modes for better battery life. | (38.5,90), 11 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 189,239,913,21 |
| tab-view + segmented-control | Battery unselected | (244,118,68,21) | Battery | (258,132.5), 13 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 600,312,136,42; ink @ 628,323,85,22 |
| tab-view + segmented-control | Power Adapter selected | (312,118,113,21) | Power Adapter | (324,132.5), 13 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 736,312,226,42; ink @ 760,323,175,22 |
| label | right-aligned slider label | (36.5,165,128.5,12.5) | Turn display off after: | (36.5,174.5), 13 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 185,406,257,25 |
| slider | continuous ticked/unfilled track | track (176,172,434,3); thumb (259.5,167,16,18) | — | — | track 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 464,420,868,6; thumb @ 631,410,32,36 |
| label | tick legend | L (171.5,195.5,24,7.5); D x172,width23.5 | 1 min | L (171.5,203), D (172,203), 10 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png @ 455,467,48,15; 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 456,467,47,15 |
| label | tick legend | L (280.5,195.5,30,7.5); D x281,width29.5 | 15 min | L (280.5,203), D (281,203), 10 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png @ 673,467,60,15; D x674,width59 |
| label | tick legend | (427.5,195.5,17,7.5) | 1 hr | (427.5,203), 10 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 967,467,34,15 |
| label | tick legend | (564,195.5,23.5,7.5) | 3 hrs | (564,203), 10 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 1240,467,47,15 |
| label | final tick legend | L (598,196,27,7); D y195.5,height7.5 | Never | (598,203), 10 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png @ 1308,468,54,14; 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 1308,467,54,15 |
| checkbox | regular unchecked | (45,225,14,14) | Prevent computer from sleeping automatically when the display is off | (64,236.5), 13 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 202,526,28,28; ink @ 240,530,833,25 |
| checkbox | regular checked | (45,248,14,14) | Put hard disks to sleep when possible | L (64,259.5), D (64,259), 13 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 202,572,28,28; ink 10-15-Catalina-Light-System-Preferences-Energy-Saver.png @ 240,576,453,25; D height24 |
| checkbox | regular checked | (45,271,14,14) | Wake for Wi-Fi network access | (63.5,283), 13 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 202,618,28,28; ink @ 239,622,372,20 |
| checkbox | regular checked | (45,294,14,14) | Enable Power Nap while plugged into a power adapter | (64,305.5), 13 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 202,664,28,28; ink 10-15-Catalina-Light-System-Preferences-Energy-Saver.png @ 240,668,650,25; D width649 |
| label | Power Nap explanation line1 | L (63.5,314.5,502,11); D height10.5 | While sleeping, your Mac can back up using Time Machine and periodically check for new email, | (63.5,323), 11 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png @ 239,705,1004,22; D height21 |
| label | Power Nap explanation line2 | (63.5,328.5,182.5,10.5) | calendar, and other iCloud updates | (63.5,337), 11 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 239,733,365,21 |
| label | light battery status only | (63,424.5,97.5,11) | Battery is charged. | (63,433.5), 11 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png @ 238,925,195,22 |
| label | dark battery status only | (62.5,424.5,309,10.5) | Current battery charge: 95%  Estimated time until full: 0:34 | (62.5,433), 11 | 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 237,925,618,21 |
| push-button | regular disabled | (503,415,132,21) | Restore Defaults | L (520,430), D (519.5,430), 13 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 1118,906,264,42; ink 10-15-Catalina-Light-System-Preferences-Energy-Saver.png @ 1152,917,197,19; 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 1151,916,198,20 |
| checkbox | regular checked | (20,468,14,14) | Show battery status in menu bar | (38.5,479.5), 13 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 152,1012,28,28; ink @ 189,1016,390,25 |
| push-button | regular enabled | (515,466,98,21) | Schedule… | (531,481), 13 | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 1142,1008,196,42; ink 10-15-Catalina-Light-System-Preferences-Energy-Saver.png @ 1174,1019,131,19; D y1018,height20 |
| help-button | normal circular | (627,463,21,21) | ? | library typography | 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 1366,1002,42,42 |

Slider track flat stored sample #b1b1b1 light / #525253 dark [M] at 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 470,423; thumb white light / #cccccc dark [M] at 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 640,423. There is no blue filled portion [M]. Sixteen ticks have measured image leading x positions `478,534,590,646,701,757,813,869,925,981,1037,1093,1148,1204,1260,1316` [M], 10-15-Catalina-Light-System-Preferences-Energy-Saver.png / 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 464,445,868,1. Each tick is 1 × 4 pt [M]; leading x values in pt are `183,211,239,267,294.5,322.5,350.5,378.5,406.5,434.5,462.5,490.5,518,546,574,602`, all at y=183 pt [C], computed from the image positions above and vertical evidence 10-15-Catalina-Light-System-Preferences-Energy-Saver.png @ 478,442,2,8. The thumb overlaps the fourth tick [M]. There is no printed numeric current delay [M]; do not infer a minutes value from the sparse logarithmic legend [I].

## App-specific elements

Battery status is dataset-specific text, not a capacity bar or icon [M]. All visual controls have library equivalents; no pane-specific artwork appears [M]. The dark estimate uses “0:34” exactly, not a localized duration phrase [M]. Preserve the status difference in appearance-specific sample data [I].

## Not reproducible / assets needed

No pane-specific image assets beyond standard library glyphs [I]. Actual graphics switching, sleep/wake settings, battery telemetry and scheduled power actions are OS capabilities that a browser demo can only model [I]. Battery tab contents, Schedule dialog, alternate slider positions and popup/hover/pressed states are not shown [M]. Off-macOS font substitution can affect metrics [I].

## Evidence

L = `10-15-Catalina-Light-System-Preferences-Energy-Saver.png`; D = `10-15-Catalina-Dark-System-Preferences-Energy-Saver.png` [M]. Every abbreviated citation expands to those exact filenames. Both `info` calls confirmed frames. Group `col` x=1380, slider `row` y=423 and option `col` x=216 measured both appearances [M]. Light graphics/footer `col` x=166, tab x=710, thumb x=647, button x=1300/1330, help x=1398 and edge rows y=924/1025 established control bounds [M]. Tick rows y=445 confirmed both; text original-pixel bounding measured both datasets and anchors [M].

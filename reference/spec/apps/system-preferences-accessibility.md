# System Preferences — Accessibility

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Accessibility.png`; `10-15-Catalina-Dark-System-Preferences-Accessibility.png` [M].
- **Window:** opaque frame **668 × 476 pt** in both appearances [M], image rect `112,76,1336,952`. Unified preferences toolbar; reuse `preferences-toolbar`, `title-bar`, `window-controls`, `toolbar-search-field` and `preferences-window`; do not rebuild their metrics here. Toolbar title “Accessibility” [M].
- **State:** Overview selected in both; identical visible content, row ordering and unchecked footer checkbox [M]. Only appearance changes [M]. The sidebar shows through Captions; additional categories are not shown [M].

## Layout

```text
+----------- shared preferences toolbar ------------+
| categories |            Overview                 |
| Overview   |         accessibility icon           |
| Vision     |          bold explanation            |
| …          |            body copy                 |
| Hearing …  |                                      |
+------------+--------------------------------------+
| [ ] Show Accessibility status in menu bar     (?) |
+---------------------------------------------------+
```

Rectangles below are `(x,y,w,h)` pt relative to the opaque frame [M]. Evidence uses original image pixels. L/D mean the two full screenshot filenames above, expanded in the Evidence section. Text-only rects are ink bounds, not clickable bounds [M].

| Region | Rect pt [M] | Light stored fill [M] | Dark stored fill [M] | Evidence image rect |
|---|---|---|---|---|
| Pane background | (0,38,668,438) | #ececec | #303031 | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 130,160,1300,865; sample 140,180 |
| Bordered category list | (16,58,194,370) | #ffffff | #1e1e1f | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 144,192,388,740; sample 160,300 |
| Selected Overview row, inside border | (17,59,192,39) | #dcdcdc | #464646 | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 146,194,384,78; sample 160,220 |
| Overview panel | (218,58,434,370) | #e3e3e3 | #363637 | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 548,192,868,740; sample 600,300 |
| Footer band, no separate border | (0,428,668,48) | #ececec | #303031 | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 130,940,1300,65; sample 150,950 |

List outline is #c5c5c5 light / #565656 dark [M] at 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 144,280. Panel outline is #dedede light / #4f4f50 dark [M] at 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 548,280. The light panel has a #e1e1e1 edge-adjacent strip [M] at 10-15-Catalina-Light-System-Preferences-Accessibility.png @ 600,280; do not replace its central #e3e3e3 fill with that strip.

### Layout grid

List left inset 16 pt, width 194 pt, panel gap 8 pt, panel right inset 16 pt [C], computed from the rects above. Sidebar label leading ink x is 64.5–65 pt [M]; icons occupy the preceding column. Vision rows have 40 pt baseline rhythm; VoiceOver baseline 145 pt, Zoom 184.5 pt, Display 224 pt, Speech 264 pt, Descriptions 304 pt [C], from ink bounds below. Hearing introduces a 21 pt heading gap before Audio [C]. Footer checkbox starts x=16 pt; text begins x=34.5 pt; help outer shape starts x=631 pt [M]. No lock appears [M].

## Components used

`outline-view`, `bordered-list`, `sidebar`, `image-view`, `label`, `box`, `checkbox`, `help-button`, plus shared chrome above [I: inventory mapping from visible anatomy]. No unshown states are specified.

## Content in the screenshot

**Complete pane control/label table.** All strings and ink bounds [M]. Font classes [C] use CONVENTIONS cap-height mapping: regular labels 13 pt, muted headings 11 pt, headline 15 pt bold. Baselines [C] are flat-glyph lower edges, excluding 3 pt descenders where present. “Text anchor” is `(first ink x, baseline y)` pt. Selectable rows other than Overview have no painted row bounds; their hit area is inferred from the list width and row rhythm [I], while their ink bounds are measured separately.

| Component id | Variant/state | Rect pt | Visible text [M] | Text anchor pt / size [C] | Evidence image rect |
|---|---|---|---|---|---|
| outline-view + image-view | Overview selected [M] | (17,59,192,39) [M] | Overview | (64.5,84), 13 regular | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 146,194,384,78; text 10-15-Catalina-Light-System-Preferences-Accessibility.png @ 241,223,111,21 |
| label | section heading [M] | (26.5,104.5,30.5,8.5) [M] | Vision | (26.5,113), 11 regular | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 165,285,61,17 |
| outline-view + image-view | VoiceOver normal [M] | ink (64.5,134.5,61.5,10.5) [M]; row (17,119,192,40) [I] | VoiceOver | (64.5,145), 13 regular | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 241,345,123,21 |
| outline-view + image-view | Zoom normal [M] | ink (65,175,33,9.5) [M]; row (17,159,192,40) [I] | Zoom | (65,184.5), 13 regular | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 242,426,66,19 |
| outline-view + image-view | Display normal [M] | ink (65,214.5,42.5,12.5) [M]; row (17,199,192,40) [I] | Display | (65,224), 13 regular | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 242,505,85,25 |
| outline-view + image-view | Speech normal [M] | ink (64.5,254.5,44,12.5) [M]; row (17,239,192,40) [I] | Speech | (64.5,264), 13 regular | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 241,585,88,25 |
| outline-view + image-view | Descriptions normal [M] | ink (65,294.5,74.5,12.5) [M]; row (17,279,192,40) [I] | Descriptions | (65,304), 13 regular | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 242,665,149,25 |
| label | section heading [M] | (27,325.5,39,10.5) [M] | Hearing | (27,333), 11 regular | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 166,727,78,21 |
| outline-view + image-view | Audio normal [M] | ink (64.5,355.5,33.5,10) [M]; row (17,340,192,40) [I] | Audio | (64.5,365.5), 13 regular | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 241,787,67,20 |
| outline-view + image-view | Captions normal [M] | ink (64.5,395.5,52.5,12) [M]; row (17,380,192,40) [I] | Captions | (64.5,404.5), 13 regular | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 241,867,105,24 |
| image-view | Overview emblem [M] | L (406.5,123,57,57.5); D (407,123,56,56.5) [M] | — | — | 10-15-Catalina-Light-System-Preferences-Accessibility.png @ 925,322,114,115; 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 926,322,112,113 |
| label | centered bold headline, line one [M] | (274.5,192,321.5,15) [M] | Accessibility features adapt your Mac to your | (274.5,204), 15 bold | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 661,460,643,30 |
| label | centered bold headline, line two [M] | (375.5,211,119,12.5) [M] | individual needs. | (375.5,223.5), 15 bold | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 863,498,238,25 |
| label | centered body, line one [M] | (252,244,365.5,12.5) [M] | Your Mac can be customized to support your vision, hearing, | (252,253.5), 13 regular | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 616,564,731,25 |
| label | centered body, line two [M] | (276.5,260,316.5,12.5) [M] | physical motor, and learning & literacy requirements. | (276.5,269.5), 13 regular | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 665,596,633,25 |
| checkbox | regular, unchecked/enabled [M] | (16,443,14,14) [M] | Show Accessibility status in menu bar | (34.5,454.5), 13 regular | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 144,962,28,28; text 10-15-Catalina-Light-System-Preferences-Accessibility.png @ 181,966,455,25 |
| help-button | circular normal [M] | (631,440,21,21) [M] | ? | component typography | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 1374,956,42,42 |

Main Overview text stem colour #232323 light / #e0e0e0 dark [M], palettes 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 548,192,868,740. Other labels inherit `label`; category headings are muted [M].

## App-specific elements

Sidebar icon artwork is category-specific [M]. The following are numerically sampled artwork footprints (stored-pixel contrast greater than 12 channel levels against the surrounding fill, excluding very faint shadow tails) [M]. Preserve appearance-specific art and align these measured footprints rather than treating every icon as a filled square [I].

| Asset | Light rect pt [M] | Dark rect pt [M] | Evidence image rect, L / D |
|---|---|---|---|
| Overview accessibility figure | (25.5,64.5,29,29.5) | (26,65,28,28.5) | 10-15-Catalina-Light-System-Preferences-Accessibility.png @ 163,205,58,59; 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 164,206,56,57 |
| VoiceOver symbol | (25,125,30,30.5) | (25,125,30,30) | 10-15-Catalina-Light-System-Preferences-Accessibility.png @ 162,326,60,61; 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 162,326,60,60 |
| Zoom magnifier/display | (24,166,31,28) | (24,166,31,28) | 10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 160,408,62,56 |
| Display | (24,209.5,32,25) | (24,209.5,32,24.5) | 10-15-Catalina-Light-System-Preferences-Accessibility.png @ 160,495,64,50; 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 160,495,64,49 |
| Speech bubble/display | (24,247.5,32,26) | (24,247.5,32,25) | 10-15-Catalina-Light-System-Preferences-Accessibility.png @ 160,571,64,52; 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 160,571,64,50 |
| Descriptions screen | (25,287,30,27.5) | (25,287,30,27) | 10-15-Catalina-Light-System-Preferences-Accessibility.png @ 162,650,60,55; 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 162,650,60,54 |
| Audio speaker | (25.5,346,28.5,31) | (25.5,345.5,29,31) | 10-15-Catalina-Light-System-Preferences-Accessibility.png @ 163,768,57,62; 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 163,767,58,62 |
| Captions balloon | (25,389,30,26) | (25,389,30,25.5) | 10-15-Catalina-Light-System-Preferences-Accessibility.png @ 162,854,60,52; 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ 162,854,60,51 |

The large emblem is a blue circular accessibility figure; its measured contrast footprint is in the control table [M].

## Not reproducible / assets needed

Need exact category icons and Overview emblem from lawful image assets [I]. Font rendering outside macOS may differ [I: system-font substitution]. Additional categories, navigation results, hover, pressed and alternate selection contents are not shown [M]; do not invent them.

## Evidence

- L = `10-15-Catalina-Light-System-Preferences-Accessibility.png`; D = `10-15-Catalina-Dark-System-Preferences-Accessibility.png` [M]. Every `10-15-Catalina-Light-System-Preferences-Accessibility.png / 10-15-Catalina-Dark-System-Preferences-Accessibility.png @ …` citation applies to both full filenames at the given pixel rectangle.
- `info` confirmed the two frame boxes; `row` at y=280 and y=400 and `col` at x=300/x=1000 established region edges and selection bounds [M]. Footer `row` y=976 and `col` x=158 established checkbox edges; help `row` y=980 and `col` x=1394 established its outer bounds [M]. Text ink was numerically bounded within each cited region; geometry shared by both appearances was confirmed by the dark region runs [M].

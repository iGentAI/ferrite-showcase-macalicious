# System Preferences — Dock

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Dock.png`; `10-15-Catalina-Dark-System-Preferences-Dock.png` [M].
- **Window:** 668 × 401 pt both [M], opaque image rect `112,76,1336,802`. Unified toolbar; reuse `preferences-toolbar`, `preferences-window`, `title-bar`, `window-controls`, `toolbar-search-field` [I: inventory mapping]. Title “Dock” [M].
- **State/content:** same selections and strings in both [M]: Magnification off; Bottom position; Genie effect; In Full Screen Only; title-bar double-click on with “zoom”; application-icon minimize off; Animate on; Automatically hide off; indicators on; recent apps on [M]. Size and magnification thumbs have matching coordinates across appearances [M].

## Layout

```text
+---------------- shared toolbar ----------------------+
|                 Size:  —————▼————————                |
|                        Small       Large              |
|      [ ]Magnification:  ———————————▼                  |
|                        Min           Max              |
|   Position on screen:   ( )    (●)    ( )             |
|                         Left  Bottom Right            |
| Minimize windows using: [Genie effect ↕]              |
| Prefer tabs when…:      [In Full Screen Only ↕]       |
|                        [✓] Double-click… [zoom ↕]     |
|                        [ ] Minimize windows…          |
|                        [✓] Animate…                   |
|                        [ ] Automatically hide…        |
|                        [✓] Show indicators…           |
|                        [✓] Show recent…           (?) |
+-------------------------------------------------------+
```

Rectangles `(x,y,w,h)` in frame-relative pt. L/D abbreviate the full screenshot names above; evidence in original image px.

| Region | Rect pt [M] | Light stored fill [M] | Dark stored fill [M] | Evidence |
|---|---|---|---|---|
| Entire pane below toolbar | (0,38,668,363) | #ececec | #303031 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 130,160,1300,690; sample 140,180 |

There is no sidebar, group-box border, tab strip, artwork, lock or footer divider [M]. Help sits in the same continuous background [M].

### Layout grid

Right-aligned label column ends x=256 pt; slider and popup leading edge x=265.5–266.5 pt [M]. Form-label-to-control gap 9.5–10.5 pt [C]. Checkbox square leading x=265.5 pt, text leading x=284–284.5 pt [M]. Lower checkbox top rhythm 22 pt then 20,20,20,21.5 pt [C] from y=262/284/304/324/344/365.5. Size-to-magnification track rhythm 48 pt; radio centers spaced 49 pt [C]. Help right and bottom margins 20 pt and 14 pt [C].

## Components used

`label`, `slider` (tick marks, downward-pointing thumb, unfilled track), `checkbox`, `radio-button`, `pop-up-button`, `help-button`, shared preferences chrome [I: inventory mapping].

## Content in the screenshot

Complete controls/labels in reading order. Text-only rects are measured ink, controls are visible outer shape bounds [M]. `(first ink x, baseline y)` and font classes [C] follow CONVENTIONS cap-height mapping: regular13 pt, endpoint labels10 pt. Baselines remove regular3 pt/small2 pt descenders. D antialias bounds can vary0.5 pt; listed frame geometry matches both [M].

| Component id | Variant/state [M] | Rect pt [M] | Exact visible text [M] | Text anchor / class pt [C] | Evidence image rect |
|---|---|---|---|---|---|
| label | right-aligned | L (228.5,61,27.5,10.5); D height10 | Size: | L (228.5,71.5), D (228.5,71), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png @ 569,198,55,21; D height20 |
| slider | ticked, unfilled track | track (266.5,65.5,202,3); thumb (346,61,16,18) | — | — | track 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 645,207,404,6; thumb @ 804,198,32,36 |
| label | slider lower endpoint | (262,86.5,25,7.5) | Small | (262,94), 10 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 636,249,50,15 |
| label | slider upper endpoint | L (448.5,87,26,9); D y86.5,height9.5 | Large | (448.5,94), 10 | 10-15-Catalina-Light-System-Preferences-Dock.png @ 1009,250,52,18; 10-15-Catalina-Dark-System-Preferences-Dock.png @ 1009,249,52,19 |
| checkbox | regular unchecked | (153.5,108,14,14) | Magnification: | (172.5,119.5), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 419,292,28,28; ink @ 457,296,167,25 |
| slider | ticked, unfilled, magnification off | track (266.5,113.5,202,3); thumb (453,109,16,18) | — | — | track 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 645,303,404,6; thumb @ 1018,294,32,36 |
| label | lower endpoint | (265,134.5,15.5,7.5) | Min | (265,142), 10 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 642,345,31,15 |
| label | upper endpoint | L (452.5,135,18.5,7); D y134.5,height7.5 | Max | (452.5,142), 10 | 10-15-Catalina-Light-System-Preferences-Dock.png @ 1017,346,37,14; 10-15-Catalina-Dark-System-Preferences-Dock.png @ 1017,345,37,15 |
| label | right-aligned | (143,161,113,10) | Position on screen: | (143,171), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 398,398,226,20 |
| radio-button | regular unselected | (282,159,16,16) | Left | (279,191), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 676,394,32,32; ink @ 670,438,44,20 |
| radio-button | regular selected | (331,159,16,16) | Bottom | (318,191), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 774,394,32,32; ink @ 748,439,84,19 |
| radio-button | regular unselected | (380,159,16,16) | Right | (373,190.5), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 872,394,32,32; ink @ 858,438,60,25 |
| label | right-aligned | (108.5,209,147.5,12.5) | Minimize windows using: | (108.5,218.5), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 329,494,295,25 |
| pop-up-button | regular enabled | (265.5,204,107.5,21) | Genie effect | (275,219), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 643,484,215,42; ink 10-15-Catalina-Light-System-Preferences-Dock.png @ 662,494,146,20; D width147 |
| label | right-aligned | (28,236,228,12.5) | Prefer tabs when opening documents: | (28,245.5), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 168,548,456,25 |
| pop-up-button | regular enabled | (265.5,231,146,21) | In Full Screen Only | (275.5,245.5), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 643,538,292,42; ink 10-15-Catalina-Light-System-Preferences-Dock.png @ 663,549,223,24; D y548,height25 |
| checkbox | regular checked | (265.5,262,14,14) | Double-click a window’s title bar to | (284.5,274), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 643,600,28,28; ink @ 681,604,421,20 |
| pop-up-button | regular enabled | (504.5,258.5,86.5,21) | zoom | L (514.5,273.5), D (514,273.5), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 1121,593,173,42; ink 10-15-Catalina-Light-System-Preferences-Dock.png @ 1141,609,62,14; 10-15-Catalina-Dark-System-Preferences-Dock.png @ 1140,608,64,15 |
| checkbox | regular unchecked | (265.5,284,14,14) | Minimize windows into application icon | L (284.5,295.5), D (284.5,295), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 643,644,28,28; ink 10-15-Catalina-Light-System-Preferences-Dock.png @ 681,648,466,25; D height24 |
| checkbox | regular checked | (265.5,304,14,14) | Animate opening applications | (284,315.5), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 643,684,28,28; ink @ 680,688,355,25 |
| checkbox | regular unchecked | (265.5,324,14,14) | Automatically hide and show the Dock | (284,335.5), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 643,724,28,28; ink @ 680,728,460,25 |
| checkbox | regular checked | (265.5,344,14,14) | Show indicators for open applications | L (284,355.5), D (284,355), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 643,764,28,28; ink 10-15-Catalina-Light-System-Preferences-Dock.png @ 680,768,452,25; D height24 |
| checkbox | regular checked | (265.5,365.5,14,14) | Show recent applications in Dock | L (284,377), D (284,376.5), 13 | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 643,807,28,28; ink 10-15-Catalina-Light-System-Preferences-Dock.png @ 680,811,401,25; D height24 |
| help-button | circular normal | (627,366,21,21) | ? | library typography | 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 1366,808,42,42 |

Two endpoint tick marks beneath each slider are 1 × 4 pt [M], 10-15-Catalina-Light-System-Preferences-Dock.png @ 659,230,2,8 and @1033,230,2,8; corresponding magnification marks are at y=125 pt [C] (image y=326…333, translated by the measured 48 pt track pitch) [C]. Track is neutral #b8b8b8 light / #4d4d4e dark [M], 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 650,209 and @650,305. Thumb interiors are white light / #cbcbcb dark [M], 10-15-Catalina-Light-System-Preferences-Dock.png / 10-15-Catalina-Dark-System-Preferences-Dock.png @ 820,209. The two tracks intentionally have no blue selected portion [M].

## App-specific elements

No custom artwork is present [M]. Downward-pointing thumbs rather than circular brightness thumbs are essential [M]; use the `slider` variant, not an application-specific asset [I]. Size values are not printed numerically [M]. Magnification checkbox state and slider pose are independent captured facts; behaviour when moving the off-state slider is not established by these stills [I].

## Not reproducible / assets needed

No pane-specific image asset needed beyond library glyphs [I]. Actual system Dock resizing/repositioning/minimization cannot be performed by a browser; a demo can model controls and animate its own Dock [I]. Popup contents, hover/pressed, alternate radio selection and inactive-window state are not shown [M]. System typography outside macOS can differ [I].

## Evidence

L = `10-15-Catalina-Light-System-Preferences-Dock.png`; D = `10-15-Catalina-Dark-System-Preferences-Dock.png` [M]. Abbreviated citations expand to these exact names. Both `info` frame measurements agree. Slider `row` y=209/`col` x=1040, checkbox `col` x=657, radio `row` y=410 measured both appearances [M]. Light popup edges at x=643/857/934/1121/1293, checkbox x=419/643, radio columns x=692/790/888 and help x=1398 established outer shapes [M]. Direct original-pixel text bounding confirmed content/anchors across both appearances [M].

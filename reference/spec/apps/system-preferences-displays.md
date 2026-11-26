# System Preferences — Displays

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Displays.png`; `10-15-Catalina-Dark-System-Preferences-Displays.png` [M].
- **Window:** 668 × 511 pt both [M], opaque image rect `112,76,1336,1022`. Unified preferences toolbar; reuse `preferences-toolbar`, `preferences-window`, `title-bar`, `window-controls`, `toolbar-search-field` [I: inventory mapping]. Toolbar title is **“Built-in Retina Display”**, not “Displays” [M].
- **State/content:** Display tab selected; Default for display selected; Automatically adjust brightness, True Tone and Show mirroring options checked; AirPlay Display Off [M]. Light Search is focused, dark not focused [M]. Laptop artwork shows light versus dark desktop/foreground window [M]. Brightness thumb is 4 pt farther right in light [M]; do not reuse one captured slider position for both.

## Layout

```text
+----------------- shared toolbar ------------------+
|              [Display][Color][Night Shift]         |
| +------------------------------------------------+|
| | laptop art       Resolution: (●) Default…       ||
| |                              ( ) Scaled        ||
| |                  Brightness: ———————●———       ||
| |                              [✓] Automatically…||
| |                              [✓] True Tone     ||
| |                                  explanation   ||
| |                                                ||
| +------------------------------------------------+|
| AirPlay Display: [Off                          ↕] |
| [✓] Show mirroring options…                   (?) |
+---------------------------------------------------+
```

Rectangles `(x,y,w,h)` in frame-relative pt. L/D expand to full screenshot filenames above; evidence in original image pixels.

| Region | Rect pt [M] | Light stored fill [M] | Dark stored fill [M] | Evidence |
|---|---|---|---|---|
| Pane exterior/footer | (0,38,668,473) | #ececec | #2f3031 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 130,160,1300,920; sample 140,180 |
| Tab group box | (20,68,628,366) | #e3e3e3 | #363637 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 152,212,1256,732; sample 180,300 |
| Footer below box | (0,434,668,77) | #ececec | #2f3031 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 130,944,1300,140 |

Group outline #dedede light / #4e4f50 dark [M], 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 152,400. Interior edge-adjacent strip differs from central fill [M]; prefer interior sample 180,300 rather than x=1380 at the rounded-right edge.

### Layout grid

Group box side margins 20 pt; outer footer has no lock [M]. Right-aligned Resolution/Brightness label column ends at x=360 pt; radio/control column begins x=371 pt; main text starts x=390.5–391.5 pt [M]. Gap label-to-radio 11 pt [C]. Resolution radio-row pitch 20 pt; checkbox pitch 25 pt; explanatory line pitch 14 pt [C]. Footer popup x=126.5 pt and width262 pt; AirPlay label ends x=117.5 pt, gap9 pt [C]. Footer checkbox x=20 pt; label x=38.5 pt; help right margin20 pt, bottom margin11 pt [C].

## Components used

`tab-view`, `segmented-control`, `box`, `image-view`, `label`, `radio-button`, `slider`, `checkbox`, `pop-up-button`, `help-button`, shared preferences chrome [I: visible-anatomy inventory mapping].

## Content in the screenshot

Complete pane controls/labels. Rects and strings [M]. Text ink bounds are not hit bounds [M]. `(first ink x, baseline y)` and classes [C] follow CONVENTIONS cap-height mapping: 13 pt regular, small explanation 11 pt. Baselines remove 3 pt regular/2 pt small descenders. Tiny light/dark AA-bound variations are listed [M].

| Component id | Variant/state [M] | Rect pt [M] | Exact visible text [M] | Text anchor / size pt [C] | Evidence image rect |
|---|---|---|---|---|---|
| tab-view + segmented-control | Display selected | (228,58,69,21) | Display | (242,71.5), 13 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 568,192,138,42; ink @ 596,202,85,23 |
| tab-view + segmented-control | Color unselected | (297,58,56,21) | Color | L (308.5,73.5), D (308.5,73), 13 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 706,192,112,42; ink 10-15-Catalina-Light-System-Preferences-Displays.png @ 729,202,64,21; D height20 |
| tab-view + segmented-control | Night Shift unselected | (353,58,88,21) | Night Shift | (364,71.5), 13 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 818,192,176,42; ink @ 840,202,127,23 |
| image-view | built-in laptop depiction | L (58,105,197,119.5); D (58,105,197,118.5) | — | — | 10-15-Catalina-Light-System-Preferences-Displays.png @ 228,286,394,239; D height237 |
| label | right-aligned | (294.5,106,65.5,10) | Resolution: | (294.5,116), 13 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 701,288,131,20 |
| radio-button | regular selected/enabled | (371,104,16,16) | Default for display | (391,116.5), 13 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 854,284,32,32; ink @ 894,290,218,25 |
| radio-button | regular unselected/enabled | (371,124,16,16) | Scaled | L (390.5,137.5), D (390.5,137), 13 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 854,324,32,32; ink 10-15-Catalina-Light-System-Preferences-Displays.png @ 893,330,79,21; D height20 |
| label | right-aligned | L (293,158,67,12.5); D (293.5,158,66.5,12.5) | Brightness: | L (293,167.5), D (293.5,167.5), 13 | 10-15-Catalina-Light-System-Preferences-Displays.png @ 698,392,134,25; D x699,width133 |
| slider | continuous horizontal enabled | track (372,163,240,3); thumb L (552.5,156.5,16,16), D (548.5,156.5,16,16) | — | — | track 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 856,402,480,6; light thumb 10-15-Catalina-Light-System-Preferences-Displays.png @ 1217,389,32,32; 10-15-Catalina-Dark-System-Preferences-Displays.png @ 1209,389,32,32 |
| checkbox | regular checked/enabled | (373,181,14,14) | Automatically adjust brightness | (391.5,192.5), 13 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 858,438,28,28; ink @ 895,442,378,25 |
| checkbox | regular checked/enabled | (373,206,14,14) | True Tone | (391.5,218), 13 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 858,488,28,28; ink @ 895,493,118,19 |
| label | explanation line1 | L (392,228.5,223.5,10.5); D (392.5,228.5,223,10.5) | Automatically adapt display to make colors | L (392,237), D (392.5,237), 11 | 10-15-Catalina-Light-System-Preferences-Displays.png @ 896,533,447,21; D x897,width446 |
| label | explanation line2 | (392.5,242.5,199,10.5) | appear consistent in different ambient | (392.5,251), 11 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 897,561,398,21 |
| label | explanation line3 | L (392.5,256.5,98.5,11); D (393,256.5,98,10.5) | lighting conditions. | L (392.5,265.5), D (393,265), 11 | 10-15-Catalina-Light-System-Preferences-Displays.png @ 897,589,197,22; D x898,width196,height21 |
| label | footer form label | (25.5,450,92,12.5) | AirPlay Display: | (25.5,459.5), 13 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 163,976,184,25 |
| pop-up-button | regular enabled | (126.5,445,262,21) | Off | L (136,460.5), D (136,460), 13 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 365,966,524,42; ink 10-15-Catalina-Light-System-Preferences-Displays.png @ 384,976,37,21; D height20 |
| checkbox | regular checked/enabled | (20,482,14,14) | Show mirroring options in the menu bar when available | (38.5,493.5), 13 | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 152,1040,28,28; ink @ 189,1044,659,25 |
| help-button | normal circular | (627,479,21,21) | ? | library typography | 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 1366,1034,42,42 |

Slider stored fill samples: selected track #4d8af5 (sRGB #3b89fd) light / #2e6bde (sRGB #1869e6) dark [M] at 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 860,405; unselected #b2b2b2 light / #525253 dark [M] at 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png @ 1320,405. Do not encode these samples as an entire thumb gradient; reuse `slider` for rendering [I]. Slider position difference is 8 image px =4 pt [C], from thumb left edges above; no numeric brightness value is visible [M].

## App-specific elements

Laptop asset contains bezel, keyboard/base, screen with Catalina wallpaper, menu bar, Dock and a foreground text window [M]. The light and dark assets are different raster content; outer non-background bounds are measured above [M]. Keep aspect and appearance-specific art rather than drawing a generic display icon [I]. The internal text is part of the illustrative image, not interactive labels in this pane [I].

## Not reproducible / assets needed

Need light/dark laptop illustration [I]. Color/Night Shift page contents, resolution alternatives, AirPlay menu, help contents, hover/pressed and disabled controls are not shown [M]. Changing True Tone in a browser cannot change physical panel colour temperature [I]; a demo can only model checkbox state. System-font substitution outside macOS can change metrics [I].

## Evidence

L = `10-15-Catalina-Light-System-Preferences-Displays.png`; D = `10-15-Catalina-Dark-System-Preferences-Displays.png` [M]. Each abbreviated citation expands to these full filenames. Both `info` calls confirmed frames. Group `col` x=1380, radio `row` y=301/`col` x=870 and slider `row` y=405/`col` x=1320 measured both appearances [M]. Light checkbox `col` x=867/166, popup `col` x=400, help x=1398 and tab boundary runs measured control bounds; thumb columns x=1232 light/x=1224 dark confirmed differing positions [M]. Direct original-pixel text/art bounding confirmed both appearances [M].

# System Preferences — Desktop & Screen Saver

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png`; `10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png` [M].
- **Window:** 668 × 562 pt both [M], opaque image rect `112,76,1336,1124`. Unified toolbar; reuse `preferences-toolbar`, `preferences-window`, `title-bar`, `window-controls`, `toolbar-search-field` [I: inventory mapping]. Title “Desktop & Screen Saver” [M].
- **State/content differences:** Desktop tab and Desktop Pictures source selected in both; Apple expanded, Photos/Folders collapsed, Change picture/Random order unchecked and disabled [M]. Light mode popup says “Dynamic” and shows explanatory sentence; dark says “Dark (Still)” and has **no explanatory sentence** [M]. Preview artwork is an unsplit dark Catalina image in light, split day/night Catalina in dark [M]. Gallery thumbnails and arrangement agree [M].

## Layout

```text
+----------------- shared toolbar -------------------+
|                [Desktop][Screen Saver]              |
| +--------------------------------------------------+|
| | framed preview   Catalina                        ||
| |                  [mode popup]                    ||
| |                  dynamic explanation (light only)||
| | +source tree------+wallpaper gallery-------------+||
| | | Apple           | Dynamic Desktop              ||
| | | Desktop Pictures| 3 thumbnails                 ||
| | | Colors …        | Desktop Pictures             ||
| | | Photos/Folders  | 4 + 4 thumbnails (clipped)    ||
| | +-----------------+------------------------------+||
| | [+][-]            [ ] Change picture: [interval] ||
| |                   [ ] Random order          (?) ||
| +--------------------------------------------------+|
+-----------------------------------------------------+
```

Rectangles `(x,y,w,h)` in frame-relative pt. L/D refer to full screenshot names above. Evidence coordinates are original image pixels.

| Region | Rect pt [M] | Light stored fill [M] | Dark stored fill [M] | Evidence |
|---|---|---|---|---|
| Pane exterior | (0,38,668,524) | #ececec | #2f3031 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 130,160,1300,1020; sample 150,180 |
| Tab group box | (13,66,642,486) | #e3e3e3 | #363637 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 138,208,1284,972; interior sample 160,600 |
| Source/gallery outer frame | (32,206,604,268) | #c5c5c5 / #c0c0c0 | #565656 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 176,488,1208,536 |
| Source interior | (33,207,171,266) | #ffffff | #1d1e1f | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 178,490,342,532; sample 190,600 |
| Selected source row | (33,227,171,20) | #dcdddc | #464746 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 178,530,342,40; sample 190,550 |
| Source divider | (204,207,1,266) | #c0c0c0 | #555656 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 520,490,2,532 |
| Gallery interior | (205,207,430,266) | #ffffff | #1d1e1f | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 522,490,860,532; sample 550,750 |
| Dynamic Desktop header | (205,207,430,22) | #f0f0f0 | #2a2b2c | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 522,490,860,44; sample 550,510 |
| Desktop Pictures header | (205,311,430,22) | #f0f0f0 | #2a2b2c | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 522,698,860,44 |

### Layout grid

Box side margins 13 pt; gallery/source side margins inside box 19 pt [C]. Source column width 172 pt including divider; gallery column width 431 pt including right border [C]. Gallery thumbnail leading positions x=218,322,426,530 pt; pitch 104 pt; gap 13 pt [C], from measured 91 pt-wide pictures. Gallery header-to-picture top gap 10.5 pt; picture row top pitch 73 pt [C]. Popup left x=204 pt, label x=204.5 pt; no right-aligned form-label column [M]. Plus/minus leading x=32 pt; change controls x=204 pt; help right margin to group box 19 pt [C]. There is no lock [M].

## Components used

`tab-view`, `segmented-control`, `box`, `image-view`, `image-well`, `label`, `pop-up-button`, `outline-view`, `disclosure-triangle`, `icon-view`, `table-header`, `push-button`, `checkbox`, `help-button` and shared preferences chrome [I: inventory mapping]. The gallery is a custom thumbnail grid, not modern wallpaper settings [I].

## Content in the screenshot

Complete control and label table. Text-only rects are ink bounds [M]; anchors `(first ink x, baseline y)` and SF classes [C] follow CONVENTIONS cap-height mapping. Regular pane text/tab/popup 13 pt; source/header/description 12 pt. Baselines exclude 3 pt regular/2 pt label descenders. Light/dark ink antialias extents can differ 0.5 pt [M]. Unpainted source hit cells below the selection are inferred [I].

| Component id | Variant/state [M] | Rect pt | Exact visible text [M] | Anchor / size pt [C] | Evidence image rect |
|---|---|---|---|---|---|
| tab-view + segmented-control | Desktop selected | (245,56,75,21) [M] | Desktop | (259,70), 13 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 602,188,150,42; ink @ 630,199,97,23 |
| tab-view + segmented-control | Screen Saver unselected | (320,56,104,21) [M] | Screen Saver | (331.5,71), 13 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 752,188,208,42; ink 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 775,199,158,19; D width 159 |
| image-well + image-view | current wallpaper preview | (49,93.5,139,89) [M] | — | — | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 210,263,278,178 |
| label | wallpaper name | L (204.5,106,47.5,10.5); D (204.5,106,47.5,10) [M] | Catalina | L (204.5,116.5), D (204.5,116), 13 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 521,288,95,21; D height 20 |
| pop-up-button | regular enabled | (204,127,170,21) [M] | L: Dynamic; D: Dark (Still) | L (214,141.5), D (214,144), 13 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 520,330,340,42; ink 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 540,340,102,25; 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 540,340,123,24 |
| label | dynamic explanation, light only | (204.5,157.5,385.5,11) [M] | This desktop picture changes throughout the day, based on your location. | (204.5,166.5), 12 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 521,391,771,22; D same region blank |
| outline-view + disclosure-triangle | Apple expanded | ink (52.5,211,31.5,11) [M]; row (33,207,171,20) [I] | Apple | (52.5,220), 12 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 217,498,63,22; row @ 178,490,342,40 |
| outline-view + image-view | Desktop Pictures selected | (33,227,171,20) [M] | Desktop Pictures | (81,240), 12 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 178,530,342,40; ink @ 274,538,190,22 |
| outline-view + image-view | Colors normal | ink (80.5,251,35,9) [M]; row (33,247,171,20) [I] | Colors | (80.5,260), 12 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 273,578,70,18 |
| outline-view + disclosure-triangle | Photos collapsed | ink (53,271,37.5,9) [M]; row (33,267,171,20) [I] | Photos | (53,280), 12 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 218,618,75,18 |
| outline-view + disclosure-triangle | Folders collapsed | ink (53,291,40,9) [M]; row (33,287,171,20) [I] | Folders | (53,300), 12 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 218,658,80,18 |
| table-header + label | gallery heading | L ink (208,213.5,98,11.5); D (208,213.5,97.5,11) [M] | Dynamic Desktop | (208,222.5), 12 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 528,503,196,23; D width 195,height 22 |
| icon-view + image-view | three dynamic wallpaper cells | See thumbnail table [M] | — | — | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 548,555,598,121 |
| table-header + label | gallery heading | ink (208,317.5,95,11) [M] | Desktop Pictures | (208,326.5), 12 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 528,711,190,22 |
| icon-view + image-view | eight still wallpaper cells | See thumbnail table [M] | — | — | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 548,763,806,259 |
| push-button + segmented-control | plus enabled | (32,481,25,21) [M] | + | library symbol typography | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 176,1038,50,42 |
| push-button + segmented-control | minus disabled | (57,481,26,21) [M] | − | library symbol typography | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 226,1038,52,42 |
| checkbox | regular off/disabled | (204,485,14,14) [M] | Change picture: | (222.5,496), 13 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 520,1046,28,28; ink @ 557,1050,190,24 |
| pop-up-button | regular disabled | (331,481,208,21) [M] | Every 30 minutes | L (341,496.5), D (341,496.5), 13 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 774,1038,416,42; ink 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 794,1049,206,24; 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 794,1048,207,25 |
| checkbox | regular off/disabled | (204,505,14,14) [M] | Random order | (223,517), 13 | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 520,1086,28,28; ink 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 558,1091,169,19; 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 558,1090,169,20 |
| help-button | normal circular | (615,508,21,21) [M] | ? | component typography | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 1342,1092,42,42 |

## App-specific elements

Preview actual picture rect `(59,101,119,74)` pt [M], 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 230,278,238,148. Frame has inset bevel and rounded corners; preserve those separately from the photo [M]. Artwork list below is exhaustive for the visible gallery; each is an image-only selectable cell with **no visible selected outline** [M]. The screenshot provides no text filename or caption for the thumbnails [M]; descriptive names below are inferred identifiers, not visible strings [I].

| Cell / descriptive asset [I] | Picture rect pt [M], both | Evidence L/D image rect |
|---|---|---|
| Dynamic Catalina island | (218,239.5,91,60.5) | 548,555,182,121 |
| Dynamic Mojave dunes, split day/night | (322,239.5,91,60.5) | 756,555,182,121 |
| Dynamic blue gradient, split light/dark | (426,239.5,91,60.5) | 964,555,182,121 |
| Still Catalina at dusk | (218,343.5,91,60.5) | 548,763,182,121 |
| Still Catalina at night | (322,343.5,91,60.5) | 756,763,182,121 |
| Mountain landscape | (426,343.5,91,60.5) | 964,763,182,121 |
| Sunlit rocky coast | (530,343.5,91,60.5) | 1172,763,182,121 |
| Dark striated rock/coast | visible (218,416.5,91,56.5) | 548,909,182,113 |
| Bay with green hillside | visible (322,416.5,91,56.5) | 756,909,182,113 |
| Dark clouds and beach | visible (426,416.5,91,56.5) | 964,909,182,113 |
| Cloudy sea/sunset | visible (530,416.5,91,56.5) | 1172,909,182,113 |

The last row is clipped by the viewport at y=473 pt [M]. Do not resize those photographs to the clipped height; underlying 60.5 pt height inferred from other rows [I]. Source icons/disclosures have the following sampled contrast footprints, excluding shadow tails with contrast at most 12 stored channel levels [M]:

| Asset | Light footprint pt [M] | Dark footprint pt [M] | Evidence image px |
|---|---|---|---|
| Expanded Apple triangle | (40.5,212.5,9,7.5) | same | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 193,501,18,15 |
| Desktop Pictures folder | (60.5,230,15,12.5) | (60.5,230,15,12) | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 233,536,30,25; 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 233,536,30,24 |
| Colors wheel | (61.5,249.5,13,13.5) | same | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 235,575,26,27 |
| Collapsed Photos triangle | (41.5,271.5,7.5,9) | same | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 195,619,15,18 |
| Collapsed Folders triangle | (41.5,291.5,7.5,9) | same | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png / 10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png @ 195,659,15,18 |

## Not reproducible / assets needed

Need current-wallpaper preview in both captured states, eleven gallery images, folder and colour-wheel icons [I]. Dynamic changes cannot be recovered from still captures [I]; show the captured photo/state rather than claiming a live day/night cycle. Screen Saver contents, popup menus, other source selections and hover/pressed states are not shown [M]. Font metrics off macOS may differ [I].

## Evidence

L = `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png`; D = `10-15-Catalina-Dark-System-Preferences-Desktop-and-Screen-Saver.png` [M]. All abbreviated citations expand to these names. `info`, source/gallery `row` y=600 and `col` x=1375 measured both appearances. Box `col` x=1400, tabs x=700, popup x=600, checkbox x=534, plus/minus x=260, interval x=800, help x=1360 and preview border x=460 bounded light controls [M]. Original-pixel text/artwork bounding confirmed corresponding dark placements and the absent dark explanatory text [M].

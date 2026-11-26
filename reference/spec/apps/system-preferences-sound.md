# System Preferences — Sound

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Sound.png`; `10-15-Catalina-Dark-System-Preferences-Sound.png` [M].
- **Window:** opaque frame 668 × 499 pt in both [M], `@ 112,76,1336,998`. Unified navigation toolbar, title “Sound”, Search, back/forward and Show All reuse `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` [I] (shared System Preferences shell; not the icon-and-label app-preferences toolbar).
- **State:** Sound Effects selected, Funk selected, same sound-output device and slider positions in both [M]. Mute is **off in light, on in dark** [M]; other checks agree. Output and Input contents are not shown [M].

## Layout

```text
+ navigation / Sound / Search --------------------------+
|                 [Sound Effects|Output|Input]           |
| +----------------------------------------------------+|
| | Select an alert sound:                              ||
| | Name                         Type                   ||
| | Basso ... Funk selected ... Glass   Built-in         ||
| | Play sound effects through: [Selected output device]||
| |             Alert volume: speaker ───────▼ speaker  ||
| |                           ☑ Play user interface ... ||
| |                           □ Play feedback ...   (?) ||
| +----------------------------------------------------+|
|              Output volume: speaker ──▼── speaker □Mute|
|                            □ Show volume in menu bar |
+-------------------------------------------------------+
```

All positions are pt relative to frame origin [C] (subtract image (112,76), divide by 2). Colours are stored PNG channels [M], not converted sRGB.

| Region | Rect (x,y,w,h) pt [M] | Light / dark fill [M] | Evidence |
|---|---|---|---|
| Body including footer | (0,38,668,461) | #ececec / #2f3031 | both frames `@ 112,152,1336,922`; samples `10-15-Catalina-Light-System-Preferences-Sound.png @ 120,180`, `10-15-Catalina-Dark-System-Preferences-Sound.png @ 120,180` |
| Tab content group | (20,68,628,344) | #e3e3e3 / #363637 | both `@ 152,212,1256,688`; column x=155, rows y=213..898; fills `@ 170,230` |
| Tab strip | (220,58.5,228.5,20) | selected blue gradient; unselected #ffffff / #636465 | both `@ 552,193,457,40`; rows y=197 and column x=560; reuse `tab-view` |
| Alert table header | (42,119,583,25) | #f0f0f0 / #2a2b2c | both `@ 196,314,1166,50`; samples `@ 300,350` |
| Alert table body | (42,144,583,115) | #ffffff / #1d1e1f | both `@ 196,364,1166,230`; samples `@ 300,390` |
| Funk selection | (43,224,581,19) | #dcdcdb / #464645 | both `@ 198,524,1162,38`; samples `@ 300,543` |

### Layout grid

Group left/right inset 20 pt [M]. Table left inset inside group 22 pt, right inset 23 pt [C]. Name first glyph x=47 pt, Type x=395.5 pt; header divider x=390 pt [M]. Table rows use 20 pt baseline pitch [M]. Right-aligned form-label edge x=219.5 pt; popup/checkbox column x=230.5/230 pt, text starts x=249 pt [M]. Alert and output tracks start x=262 pt, end x=446 pt, height 3 pt [M]; they share speaker artwork at x=230 and x=457 pt [M]. Group bottom y=412 pt, footer output-label baseline y=446.5 pt and final checkbox baseline y=476.5 pt [C]. No lock [M]. Help is inside the group rather than in the window footer [M].

## Components used

`tab-view`, `box`, `table-view`, `table-header`, `scroll-view`, `pop-up-button`, `slider`, `checkbox`, `help-button`, `label`, `image-view`, shared chrome [M].

### Complete control and label table

Geometry below [M], converted to pt [C]. R = 13 pt regular, H = 13 pt bold, S = 11 pt regular [C] (regular capitals about 18 px; table-header capitals 16 px). `b` is baseline in pt [C] (cap bottom, excluding descenders); labels give first-glyph x and baseline. Each rect cites `10-15-Catalina-Light-System-Preferences-Sound.png @ (112+2x),(76+2y),(2w),(2h)` and corresponding dark region [M]. Dark bezel edges can be inset 0.5 pt [M]; reuse each component's dark recipe rather than forcing its fill to the light bounds. Rows/columns sampled at image y=197,320,644,705,714,951 and x=155,560,580,640,1030,1120,1350 [M].

| Component / variant / state | Rect (x,y,w,h) pt; first glyph x / b / class | Exact visible text |
|---|---|---|
| tab-view / selected | (220,58.5,109,20); x=232.5, b=73, R | Sound Effects |
| tab-view / unselected | (329,58.5,65,20); x=340.5, b=73, R | Output |
| tab-view / unselected | (394,58.5,54.5,20); x=405.5, b=73, R | Input |
| label / heading | (43.5,98,139,10); b=107.5, H | Select an alert sound: |
| table-header / normal | (42,119,348,25); x=48, b=134.5, S | Name |
| table-header / normal | (390,119,235,25); x=395.5, b=134.5, S | Type |
| table-view / row normal | (43,144,581,20); x=47, b=158, R; Type x=395, same b | Basso ; Built-in |
| table-view / row normal | (43,164,581,20); x=47, b=178, R; Type x=395, same b | Blow ; Built-in |
| table-view / row normal | (43,184,581,20); x=47, b=198, R; Type x=395, same b | Bottle ; Built-in |
| table-view / row normal | (43,204,581,20); x=47, b=218, R; Type x=395, same b | Frog ; Built-in |
| table-view / selected, grey | (43,224,581,19); x=47, b=238, R; Type x=395, same b | Funk ; Built-in |
| table-view / clipped last row | (43,243,581,15); x=47, b=258, R; Type x=395, same b | Glass ; Built-in |
| label / R right aligned | (54,278,165,12.5); b=287 | Play sound effects through: |
| pop-up-button / regular normal | (230.5,273,256,20.5); x=239.5, b=287, R | Selected sound output device |
| label / R right aligned | (141,312.5,78.5,9.5); b=321.5 | Alert volume: |
| image-view / low speaker | (230,311.5,12.5,18.5) | — |
| slider / ticked, near maximum | track (262,316,184,3); thumb (430.5,311.5,16,19) | — |
| image-view / high speaker | (457,308.5,31,24) | — |
| checkbox / regular on | (230,355,14,14); x=249, b=366.5, R | Play user interface sound effects |
| checkbox / regular off | (230,379,14,14); x=249, b=390.5, R | Play feedback when volume is changed |
| help-button / normal | (614.5,378.5,20,20) | ? |
| label / R right aligned | (127.5,437.5,91.5,12); b=446.5 | Output volume: |
| image-view / low speaker | (230,432.5,12.5,18.5) | — |
| slider / ticked, mid-high | track (262,439,184,3); thumb (355.5,434.5,16,19) | — |
| image-view / high speaker | (457,429.5,31,24) | — |
| checkbox / regular off light, on dark | (498,435,14,14); x=517, b=446.5, R | Mute |
| checkbox / regular off | (230,465,14,14); x=248.5, b=476.5, R | Show volume in menu bar |

## App-specific elements

Speaker glyphs flank both tracks [M]. Low speaker is a solid template silhouette; high speaker includes three radiating arcs [M]. Track ticks appear beneath the line, not on it [M]; reuse `slider` geometry. Table separator at image x=892..893 [M] only divides header columns. The final row is vertically clipped by the scroll viewport [M]; do not shrink row text to fit. Slider settings are pixel positions, not recovered numeric volume percentages [I] (no numeric setting is visible).

## Content in the screenshot

All pane strings, rows and states are in the table [M]. No scrollbar thumb is visible [M]. Popup menu, additional alert-sound rows, Output/Input panes, hover, pressed, focus and inactive window are not shown [M]. Unchecked dark checkboxes are not evidence of disabled controls [I] (matching standard dark checkbox rendering).

## Not reproducible / assets needed

Speaker template artwork and shared toolbar glyphs are required [M]. Actual alert samples and audio routing cannot be obtained from still images [I]; a demo needs separately supplied sounds and cannot configure macOS audio hardware through browser controls [I]. Typography rasterization is platform dependent [I].

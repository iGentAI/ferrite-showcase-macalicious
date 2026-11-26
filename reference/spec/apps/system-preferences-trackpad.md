# System Preferences — Trackpad

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Trackpad.png`; `10-15-Catalina-Dark-System-Preferences-Trackpad.png` [M].
- **Window:** 668 × 515 pt both [M], opaque frame `@ 112,76,1336,1030`. Title “Trackpad”; shared unified shell uses `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` [I] (common System Preferences navigation rather than app-level icon preferences toolbar).
- **State:** Point & Click selected in both. Look up & data detectors, Secondary click and Force Click and haptic feedback checked; Tap to click unchecked [M]. Same slider positions [M]. **The pointed hover/preview callout highlights Secondary click in light, Look up & data detectors in dark** [M]. Preview photo and trackpad are similar, but on-screen desktop/window chrome differs [M].

## Layout

```text
+ navigation / Trackpad / Search ------------------------+
|             [Point & Click|Scroll & Zoom|More Gestures] |
| +----------------------------------------------------+|
| | ☑ Look up & data detectors     +------------------+ ||
| |   Force Click with one finger⌄| demonstration    | ||
| | ☑ Secondary click             | movie/photo      | ||
| |   Click with two fingers⌄     |                  | ||
| | □ Tap to click                | keyboard and     | ||
| |   Tap with one finger         | trackpad         | ||
| | -----------------------------|                  | ||
| |    Click      Tracking speed  +------------------+ ||
| |    ──▼──         ─▼────                            ||
| | Light Medium Firm  Slow Fast                        ||
| | -----------------------------                      ||
| | ☑ Force Click and haptic feedback                   ||
| |   two-line explanation                              ||
| +----------------------------------------------------+|
|                       [Set Up Bluetooth Trackpad...] (?)|
+-------------------------------------------------------+
```

Coordinates below are frame-relative pt [C] (subtract image (112,76), divide by 2). Stored PNG colours [M], not converted CSS colours.

| Region | Rect (x,y,w,h) pt [M] | Light / dark fill [M] | Evidence |
|---|---|---|---|
| Content and footer | (0,38,668,477) | #ececec / #2f3031 | both `@ 112,152,1336,954`; samples `10-15-Catalina-Light-System-Preferences-Trackpad.png @ 120,180`, `10-15-Catalina-Dark-System-Preferences-Trackpad.png @ 120,180` |
| Tab content group | (20,68,628,391.5) | #e3e3e3 / #363637 | both `@ 152,212,1256,783`; col x=155; fills `@ 170,230` |
| Tab strip | (173,58.5,322.5,20) | blue selected; unselected #ffffff / #636465 | both `@ 458,193,645,40`; row y=198 |
| Light pointed callout | (30,145,311,53) | #f0eff0 at sample | light `@ 172,366,622,106`; sample `@ 185,390`; row y=404/col x=180 |
| Dark pointed callout | (30,95,311,53) | #676868 at sample | dark `@ 172,266,622,106`; sample `@ 185,287`; col x=180 |
| Upper / lower option separators | (39,266,287,1), (39,352,287,1) | #cdcdcd / #4a4a4b | both `@ 190,608,574,2`, `@ 190,780,574,2`; samples `@ 200,608` and `@ 200,781` |
| Demonstration still | (374,113,236,301.5) | image asset, not solid fill | light/dark `@ 860,302,472,603`; row y=303 and columns x=862,1330 |

### Layout grid

Group margins 20 pt [M]. Gesture checkbox x=40 pt and title/subtitle first glyph x=65.5..66 pt [M]. Gesture rows have 50 pt pitch; subtitle baseline is 15 pt beneath primary-label baseline [M]. Final force checkbox is x=39 pt and text x=62 pt [M]. Sliders: Click track x=58..160 pt; Tracking speed x=212..314 pt; both track y=306 pt and height=3 pt [M]. Slider captions share baseline y=289.5 pt [C]. Small endpoint labels baseline y=330.5 pt [C]. Preview starts 33 pt beyond left-column separator end [C]. Setup footer button left=414.5 pt, help left=627.5 pt; inter-control gap=12 pt [C]. Last bezel bottom=495.5 pt, bottom frame margin=19.5 pt [C]. No lock or right-aligned form-label column [M].

## Components used

`tab-view`, `box`, `checkbox`, `label`, `pull-down-button` (unbordered subtitle menus), `separator`, `slider`, `image-view`, `push-button`, `help-button`, shared chrome [M]. The pointed hover backing is app-specific rather than a standard selected checkbox bezel [I] (surrounds title and subtitle and points at preview).

### Complete control and label table

Geometry [M], pt conversion [C]. R=13 pt regular; S=11 pt regular subtitles/explanation; T=10 pt regular tick labels [C] (from 18 px, 16 px and 14 px capitals). `b` is cap-derived baseline [C]; x is first glyph [M]. Every rect maps to `10-15-Catalina-Light-System-Preferences-Trackpad.png @ (112+2x),(76+2y),(2w),(2h)` and equivalent dark region [M], except the explicitly moved callout. Row/col confirmations: y=198,404,609,690,1032; x=155,180,197,230,320,601,1320 [M]. Dark push-button bezel is inset 0.5 pt from light [M].

| Component / variant / state | Rect (x,y,w,h) pt; glyph x / b / class | Exact visible text |
|---|---|---|
| tab-view / R selected | (173,58.5,101,20); x=187, b=73 | Point & Click |
| tab-view / R unselected | (274,58.5,109,20); x=285.5, b=73 | Scroll & Zoom |
| tab-view / R unselected | (383,58.5,112.5,20); x=394, b=73 | More Gestures |
| checkbox / R on; dark highlighted row | (40,114,14,14); x=66, b=115.5 | Look up & data detectors |
| pull-down-button / S borderless normal | ink (66,123.5,151.5,10); b=131.5; chevron at x=211 | Force Click with one finger |
| checkbox / R on; light highlighted row | (40,164,14,14); x=65.5, b=165.5 | Secondary click |
| pull-down-button / S borderless normal | ink (65.5,173.5,124.5,10); b=181.5; chevron at x=182.5 | Click with two fingers |
| checkbox / R off | (40,214,14,14); x=65.5, b=215.5 | Tap to click |
| label / S secondary description | (65.5,224,99.5,10); b=232 | Tap with one finger |
| label / R slider caption | (94.5,280,29,10); b=289.5 | Click |
| label / R slider caption | (217,280,91,12.5); b=289.5 | Tracking speed |
| slider / small ticked, middle setting | track (58,306,102,3); pointed thumb allocation (103,302,12,13) | — |
| slider / small ticked, toward Slow | track (212,306,102,3); pointed thumb allocation (242,302,12,13) | — |
| label / T endpoint | (52.5,323.5,23,9.5); b=330.5 | Light |
| label / T tick | (90.5,323.5,37,7.5); b=330.5 | Medium |
| label / T endpoint | (143.5,323.5,20,7.5); b=330.5 | Firm |
| label / T endpoint | (206.5,323.5,22,7.5); b=330.5 | Slow |
| label / T endpoint | (298.5,324,19,7); b=330.5 | Fast |
| checkbox / R on | (39,376,14,14); x=62, b=388 | Force Click and haptic feedback |
| label / S explanation | (61.5,397,246.5,10.5); b=405 | Click then press firmly for Quick Look, Look up, |
| label / S explanation | (61.5,411,181.5,10.5); b=419 | and variable speed media controls. |
| image-view / demonstration | (374,113,236,301.5) | — |
| push-button / regular normal | (414.5,474.5,201,20.5); x=429, b=488.5, R | Set Up Bluetooth Trackpad... |
| help-button / normal | (627.5,474.5,20,20) | ? |

The primary gesture labels sit **above** checkbox centres, with the checkbox vertically centred against the two-line title/subtitle block [M]. Do not align their text baseline like a one-line checkbox [I] (measured title/checkbox displacement). The two subtitle chevrons are part of the unbordered menu controls [M]. No menu affordance appears after Tap with one finger [M].

## App-specific elements

Pointed callout source light `@ 172,366,622,106`, dark `@ 172,266,622,106` [M]. It has a rounded left body and an arrow tip aimed into the gap before the preview [M]. Preserve the two distinct highlighted rows; hover/preview association is inferred [I] (only static stills, pointer absent). Use the respective full still assets at `@ 860,302,472,603` [M]; nested photo-library labels/icons are baked into this demonstration image, not live controls of this pane [I] (video preview). The keyboard/trackpad portion remains matching across appearances [M], while the miniature desktop/window appearance changes [M].

## Content in the screenshot

All pane controls, labels and endpoints are transcribed above [M]. Scroll & Zoom and More Gestures contents, menu choices, Bluetooth setup and gesture animation are not shown [M]. Slider values are reproduced by thumb positions, not claimed underlying numeric settings [I].

## Not reproducible / assets needed

Need separate light/dark demonstration stills (or original demonstration movie), plus shared toolbar glyphs [M]. Still images do not supply the gesture animation [M]; use the captured still for this state rather than invent video frames [I]. Browser controls cannot configure system trackpad pressure, tracking or haptics [I] (hardware/OS preferences).

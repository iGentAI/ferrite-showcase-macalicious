# Voice Memos waveform and playhead (`waveform-view`)

- **Status:** present
- **AppKit:** custom Voice Memos UIKit drawing hosted through Mac Catalyst; no public waveform class. A time-position control, not an AppKit audio level indicator.
- **HIG:** related sliders https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/selectors/sliders/ ; keyboard https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/user-interaction/keyboard/
- **Appearances shown:** light, dark; the content retains a black/dark appearance in both.

## Purpose and behaviour
Shows the recorded audio's amplitude against time, with a detailed waveform, time ruler and a compressed overview of the recording. Both captures have the playhead at the recording's end; the empty area to its right is future time, **not an unplayed waveform** [M]. Seeking by dragging the waveform or overview marker is inferred [I]; still captures do not establish gestures or live animation. Match the HIG slider pattern of exposing a current value and allowing keyboard adjustment [D, related HIG Sliders/Keyboard], rather than exposing individual bars as controls.

## Anatomy
Back to front: black surrounding content; dark detailed-waveform panel; amplitude bars mirrored around an undrawn centre axis; ruler ticks and second labels below the panel; red vertical playhead with circular end handles; dark rounded overview strip; dimmer miniature waveform; red overview position handle; start/end labels below the overview.

```
 panel:  |       ||||||||||||||||     | playhead     (future time empty)
         |       ||||||||||||||||     |
 ruler:  '  '  '  '  '  '  '  '  '  o '  '  '  '  '
         00:00     00:01 ...         00:03 ...
 overview: [ ~~~~~~~|                             ]
            00:00                           00:03
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| presentation | detailed + overview [M] | both [M] | custom | both |
| audio data | amplitude envelope [I] | supplied data [I] | custom | different recordings |
| time position | seconds [I] | current position [I] | slider value analogy | 3.09 s light / 3.06 s dark [M] |
| appearance | always-dark content [M] | dark content [M] | not a system material | both system appearances |
| played / unplayed styling | recorded bars red; future blank [M] | no split shown [M] | custom | no existing unplayed bars |
| zoom | detailed and compressed scales [M] | captured scales [M] | custom | only these two scales |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| current/end position | yes | Both main playheads at x=901 image px; overview markers differ with duration [M]. |
| playing / recording / paused | ambiguous | A pause-record button and a dim play triangle are present; a still does not establish movement [M]. |
| unplayed recorded audio | no | [I] use the same red bars unless another capture establishes a two-colour split; do not invent grey bars from the future region. |
| hover / pressed / dragging | no | [I] retain the captured handle; update position and time labels during drag. |
| selected / trim range | no | [I] selection overlays require separate evidence; neither capture establishes their colour. |
| disabled | no | [I] expose disabled interaction without assuming a measured dimming factor. |
| focused | no | [I] add an accessible focus indication outside the plot rather than altering measured bars. |
| inactive window | no | [I] retain the content colours; window-control changes belong to `window-controls`. |
| accent variants | no | [I] audio red is app-specific; do not substitute the system accent. |

## Measurements
All geometry is in pt. Evidence coordinates are original image px. `L` means `10-15-Catalina-Light-Voice-Memos.png`; `D` means `10-15-Catalina-Dark-Voice-Memos.png`. Window origin is (112,76) image px in both. A location labelled L/D is sampled in each file, not an assertion that their data is identical.

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Detailed panel | window-relative x 0, y 74.5; 789 x 244 | [M] | L/D @ 112,225,1578,488; col x=600: transition 225, flat 226..711, lower blended row 712 |
| Amplitude centre axis | window-relative y 196..196.25; no visible horizontal centre line | [M] | L col x=554: bars 375..561, midpoint 468; D col x=663: 386..551, midpoint 468.5; L/D @ 1000,468 is the unchanged panel fill |
| Detailed bar width | nominal 1.5; fractional alignment gives 2-3 core px plus edge antialiasing | [M] | L row y=468: first core 424..425, next 432..434; D first core 429..431, next 438..439 |
| Detailed bar pitch | 4.15 average; consecutive raster positions alternate 8 / 9 px | [M] | L row y=468: cores at 424,432,441,449,459,467,476,484; D at 430,438,447,455,465,473,481 |
| Detailed waveform extent | L first bar x=424, D first x=429; both end before x=901; height depends on audio | [M] | L/D @ 420,375,485,187; first samples centred on 425 / 430 |
| Main playhead | axis x=901 image px = window-relative x 394.5; nominal 1 pt stroke (one core px + asymmetric fringes), spans y=211..725 including dots | [M] | L/D row y=500: fringes 900,902, core 901; col x=901 y=211..725 |
| Main circular handles | nominal diameter 7.5; centred x=901, top centre y=218.5, lower centre y=718.5 | [M] | L/D @ 894,211,15,15 and @ 894,711,15,15; L row y=218 outer antialiasing 894..908 |
| Ruler tick pitch | 19.25 (quarter-second); major pitch 77 (one second) | [M] | L row y=716: major 423,577; minor 462,501,539; D major 429,583; minor 467,506,544 |
| Ruler tick width / height | nominal 1 x 10; 19 core rows plus antialiased end | [M] | L col x=423: y=712..730 core, 731..732 edge; minor col x=462 same height; D col x=429 same rows |
| Ruler label placement | cap top y=737 image px = window-relative y 330.5; left edge near each major tick; labels are not centred | [M] | L @ 422,737,65,19; D @ 428,737,65,19 |
| Overview strip | window-relative x 33, y 394; 723 x 44.5; corner radius about 4 | [M] | L/D @ 178,864,1446,89; grid L @ 177,863,8,14: left edge reaches x=178 at y=869, full x=179 |
| Overview amplitude axis | image y=908..908.5 = window-relative y 416..416.25; no separate centre line | [M] | L/D row y=908; blank portion L/D @ 1000,908 is panel fill |
| Overview bars | approximately 1.5 wide incl. blended edges; pitch 2.33 (4-5 image px); reduced brightness | [M] | L row y=900: bar cores at 225,230,234,239,244,248,253,258,261,266; D at 294,298,303,312,326,331 |
| Overview position handle | nominal 5 wide x 48.5 high, rounded ends; extends 2 above and below strip; centre L x=403, D x=399 | [M] | L row y=890: core 398..407 with fringes 397,408; D core 395..403 with fringes 394,404; cols x=403 / 399: solid y=861..955, ends 860,956 |
| Overview labels | left x=180, right ink ends x=1622; cap top y=971 image px (= window-relative y 447.5) | [M] | L/D @ 180,971,64,19 and @ 1560,971,63,19 |

### Colours and fills
Stored PNG colours, not converted sRGB. Small regular dithering and fractional alignment are retained as ranges rather than misreported as borders.

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Surrounding background | `#000000` | `#000000` | [M] | `10-15-Catalina-Light-Voice-Memos.png @ 300,180`; D same coordinate |
| Panel and overview fill | `#151515` | `#151515` | [M] | `10-15-Catalina-Light-Voice-Memos.png @ 300,400`; D same; overview L/D @ 1000,900 |
| Detailed bars, core | `#f24f3e (sRGB #ff3c30)` (other cores `#ef4e3e (sRGB #ff3b30)`..`#f34f3f (sRGB #ff3c31)`) | `#ef4e3e (sRGB #ff3b30)` (same range) | [M] | `10-15-Catalina-Light-Voice-Memos.png @ 425,468`; D @ 430,468 |
| Main playhead core | `#ef4e3e (sRGB #ff3b30)` (dither `#f04e3e (sRGB #ff3b30)`) | same | [M] | `10-15-Catalina-Light-Voice-Memos.png @ 901,500`; D same |
| Main playhead edge composites | left `#ad3a2f (sRGB #bb2e26)`, right `#dc4839 (sRGB #ee372d)` | same | [M] | `10-15-Catalina-Light-Voice-Memos.png @ 900,500`; L/D @ 902,500 |
| Main playhead, the pixel either side of those | sRGB `#000f13` before, `#000a10` after: darker than the panel's `#151515` | same | [M] | L/D row y=500 @ 899 and @ 903 |
| Main playhead, where its ink lies | from x=900.29 to x=902.93 (coverage 0.71 at 900, 0.93 at 902): centre 394.8 pt into the window, 1.32 pt wide | same | [C] | from the three rows above |
| Main end-dot fill | `#ec4d3d (sRGB #ff3b30)` | `#ec4d3d (sRGB #ff3b30)` | [M] | `10-15-Catalina-Light-Voice-Memos.png @ 901,218`; L/D @ 901,719 |
| Overview bars, representative core | `#ce4335 (sRGB #df3329)` (cores `#ca4234 (sRGB #db3329)`..`#d14436 (sRGB #e2342a)`) | `#ce4335 (sRGB #df3329)` (same observed range) | [M] | `10-15-Catalina-Light-Voice-Memos.png @ 230,900`; D @ 294,900 |
| Overview handle fill | `#ec4d3d (sRGB #ff3b30)` | `#ec4d3d (sRGB #ff3b30)` | [M] | `10-15-Catalina-Light-Voice-Memos.png @ 403,900`; D @ 399,900 |
| Major ruler tick core | `#424242` | `#454545` | [M] | `10-15-Catalina-Light-Voice-Memos.png @ 423,716`; D @ 429,716 (fractional phase differs) |
| Minor ruler tick core | `#2b2b2b` | `#2a2a2a` | [M] | `10-15-Catalina-Light-Voice-Memos.png @ 462,718`; D @ 467,718 |
| Ruler text brightest stems | `#5c5c5c` | `#5c5c5c` | [M] | L palette @ 422,737,65,19; D palette @ 428,737,65,19; small antialiased digits seldom reach a flat plateau |
| Overview label brightest stems | `#5d5d5d` | `#5d5d5d` | [M] | L/D palette @ 180,971,64,19; darkest field is black, brightest ink 93 per channel |
| Unplayed recorded bars | not shown | not shown | [I] | No measurement; use the recorded-bar colour provisionally, not a fabricated second palette. |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Ruler and overview font | SF Pro Text 13.5 pt Regular; tabular digits | same | [C] | cap height 19 image px / (2 x .705) = 13.48; L/D @ 180,971,64,19 |
| Ruler strings | `00:00` through `00:07`, clipped next label at right | same | [M] | L/D @ 422,737,1268,23 |
| Overview strings | `00:00`, `00:03` | same | [M] | L/D @ 180,971,64,19 and @ 1560,971,63,19 |
| Handle glyph | plain circles / capsule; no icon | same | [M] | handle crops above |

### Shadows and effects
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Plot/handle shadow | none; antialiased shape edges only | [M] | L/D @ 892,205,20,33 and @ 390,858,22,103; adjacent pixels return directly to black / panel fill |
| Overview clipping | waveform clipped to rounded strip | [M] | L @ 177,863,8,14; waveform begins at the strip's leading edge |

## Layout and spacing
The main playhead is fixed near the window centre; the waveform and ruler scroll beneath it [I, inferred from the two different recording durations with the same playhead x]. The ruler's first major tick is at x=423 in light and x=429 in dark [M], a 3 pt shift; neither screenshot establishes a different scale. The overview spans the window minus 33 pt on each side [M]. Its marker moves with time [I]; captured marker centres differ by 2 pt [M]. No minimum size or zoom interaction is shown [I]; preserve the measured pitch and clip overflowing ruler labels rather than compressing text. The panel/ruler and overview are separated by black space; overview top y=864 is 66 pt after tick bottom y=732 [C].

## Keyboard and accessibility
No focus or keyboard interaction is captured. Treat seeking as a time slider: Left/Right adjust a small step, Home/End go to bounds; step duration is an implementation choice [I]; not shown: the static Voice Memos captures contain no keyboard-seeking interaction or temporal step measurement. Expose one labelled slider (`aria-label="Recording position"`, `aria-valuemin="0"`, duration maximum, current time and human-readable `aria-valuetext`) and a descriptive waveform image, not hundreds of focusable bars [I]. Overview and detailed views share one value; avoid duplicate announcements [I]. Transport controls belong to the app blueprint.

## Browser notes
SVG rectangles/lines, circles and a rounded clip reproduce static geometry. Fractional x positions must be retained to match the varying bar/tick composites; native Core Animation and browser rasterisers can differ [I]. Use measured stored colours as evidence; colour-managed CSS equivalents are the lead's annotation step. Waveform shape requires audio/envelope data or an image asset; these screenshots do not provide original samples or an exact downsampling algorithm [I]. Do not claim a synthetic envelope matches either recorded waveform.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Voice-Memos.png` | 112,200,1578,560 | detailed panel, red bars, playhead dots, ruler |
| dark | `10-15-Catalina-Dark-Voice-Memos.png` | 112,200,1578,560 | same palette, different data and ruler phase |
| light | `10-15-Catalina-Light-Voice-Memos.png` | 178,860,1446,136 | overview, position handle, start/end labels |
| dark | `10-15-Catalina-Dark-Voice-Memos.png` | 178,860,1446,136 | overview handle shifted with recording duration |

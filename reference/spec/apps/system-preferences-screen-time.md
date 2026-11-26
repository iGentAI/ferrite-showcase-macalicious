# System Preferences — Screen Time

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Screen-Time.png`; `10-15-Catalina-Dark-System-Preferences-Screen-Time.png` [M].
- **Window:** opaque frame `668 × 613 pt` in both, origin `112,76` image px [M], each screenshot @ 112,76,1336,1226 (`info`). Reuse shared `title-bar`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-segmented-control`, `toolbar-search-field`; title “Screen Time”, search “Search” [M].
- **Capture differences:** both select App Usage and Apps [M]. Light date “Today, October 3”, total “48m”, avatar “SH”, updated “10:45 AM”; dark date “Today, October 4”, total “14m”, avatar has no initials, updated “10:26 AM” [M]. App rows and plotted usage differ as listed below; do not recolour one chart into the other [I].

## Layout

```text
+-------------------- shared toolbar -------------------+
| avatar / Stephen | + Usage          date ‹ Today › ---+|
| App Usage        | | total / weekly chart / day chart ||
| Notifications    | | category legend                 ||
| Pickups          | + Show: Apps Categories Time Limits+|
| ---------------- | | All Apps                        ||
| Downtime         | | app / elapsed time / limits      ||
| App Limits       | | …                               ||
| Always Allowed   | +---------------------------------+|
| Content & Privacy|              Updated today …   ?   |
| Options          |                                    |
+-------------------------------------------------------+
```

E-L = `10-15-Catalina-Light-System-Preferences-Screen-Time.png`; E-D = `10-15-Catalina-Dark-System-Preferences-Screen-Time.png` [M]. Rects `(x,y,w,h)` are frame pt [M]. Colours are stored PNG values [M].

| Region | Rect [M] | Light / dark fill [M] | Evidence E-L/E-D image px |
|---|---|---|---|
| Sidebar | (0,38,174,575) | `#ececec` / `#2f3031` | @ 130,450; row 200 x112..460; @ 112,152,348,1150 |
| Main backing / footer | (174,38,494,575) | `#e3e3e3` / `#363637` | @ 470,450; @ 460,152,988,1150 |
| Usage panel and table, including border | (196,58,452,494) | `#ffffff` / `#1d1e1f` | @ 520,600; row 200 x504..1408; col 510 y192..1180; @ 504,192,904,988 |
| Selected navigation row | (0,213,174,32) | `#d5d5d5` / `#434445` | @ 130,520; col 130 y502..566; @ 112,502,348,64 |
| Table header | (197,347.5,450,26) | `#ececec` / `#2f3031` | @ 560,796; col 510 y771..821; @ 506,771,900,52 |
| Selected All Apps row | (197,373.5,450,38) | `#dddcdc` / `#474646` (one-pixel texture) | @ 520,840; @ 506,823,900,74 |
| Alternating app rows | (197,411.5,450,139.5) | `#f4f5f5` / `#28292a`, alternate `#ffffff` / `#1d1e1f` | @ 520,930 and @ 520,1010; col 510 y899..1178 |

## Components used

`sidebar`, `list-view`, `image-view`, `label`, `separator`, `table-view`, `table-header`, `scope-bar` [M]. Also `push-button`, `image-button`, `stepper`, `help-button` [M]. Use `scope-bar` for Apps/Categories, not a blue tab-view. Charts are app-specific drawing [M].

## Content in the screenshot — complete control table

Rect and text `x/B` are frame pt [M]; label rects are ink extents. R = `13 pt` regular, S = `11 pt`, N = `10 pt`, V ≈ `27 pt` display [C], measured cap-height mapping and `label.md`. Embedded control text inherits component baselines [I]. Text marked L/D differs by capture [M].

| Component | Variant / state / type | Rect [M] | Exact visible text [M]; x/B [M] | Evidence E-L/E-D image px |
|---|---|---|---|---|
| image-view + label | circular avatar | (37,65,98,98) | L: SH; D: no initials | @ 186,206,196,196; row 300, col 284 |
| label | R centred | (62,176.5,48.5,11.5) | Stephen; 62/185 | @ 236,429,97,23 |
| list-view + image-view | selected R | (0,213,174,32) | App Usage; 52.5/233 | @ 112,502,348,64; ink @ 217,524,130,23 |
| list-view + image-view | normal R | (0,247,174,32) | Notifications; 53/266.5 | @ 112,570,348,64; ink @ 218,591,150,19 |
| list-view + image-view | normal R | (0,281,174,32) | Pickups; 53/300.5 | @ 112,638,348,64; ink @ 218,659,92,23 |
| separator | horizontal | (15,325,148,0.5) | no text | @ 142,726,296,1 |
| list-view + image-view | normal R | (0,338,174,32) | Downtime; 53/357.5 | @ 112,752,348,64; ink @ 218,773,117,19 |
| list-view + image-view | normal R | (0,372,174,32) | App Limits; 52.5/391.5 | @ 112,820,348,64; ink @ 217,841,126,23 |
| list-view + image-view | normal R | (0,406,174,32) | Always Allowed; 52.5/425.5 | @ 112,888,348,64; ink @ 217,909,183,24 |
| list-view + image-view | normal R | (0,440,174,32) | Content & Privacy; 53/459.5 | @ 112,956,348,64; ink @ 218,977,215,24 |
| list-view + image-view | Options enabled R | (0,572,174,32) | Options; 53/591.5 | @ 112,1220,348,64; ink @ 218,1241,91,23 |
| label | R | (213,75.5,36.5,11.5) | Usage; 213/85 | @ 538,227,73,23 |
| label | V display | L (213,95.5,50.5,19.5); D (213,96,46,18.5) | L: 48m; D: 14m; x213 / B114 [C] | L @ 538,267,101,39; D @ 538,268,92,37 |
| label | R date heading | (392.5,74.5,103.5,12.5) | L: Today, October 3; D: Today, October 4; x393 L /392.5 D, B84 | @ 897,225,207,25 |
| stepper | mini borderless up/down, enabled | (501,74,7,11) | upward/downward chevrons; no text | @ 1114,224,14,22; col 1117 y214..256 |
| image-button | previous day enabled | (521.5,69.5,23,20) | left chevron | @ 1154,214,48,42; row 225, col 1162 |
| push-button | regular enabled | (545.5,69.5,67,20) | Today | @ 1202,214,136,42 |
| image-button | next day disabled | (613.5,69.5,23,20) | right chevron | @ 1338,214,48,42 |
| image-view (custom chart) + label | weekly plot, N ticks | (212,141,393,65) | weekdays S M T W T F S; L vertical 2h, 1h, avg; D 4h, 2h, avg, 0 | @ 536,358,786,130; tick/weekday region @ 536,348,838,174 |
| image-view (custom chart) + label | daily plot, N ticks | (212,231,393,49) | 60m, 30m, 0; 12 AM, 6 AM, 12 PM, 6 PM | @ 536,538,786,98; labels @ 536,526,838,132 |
| image-view + label | legend S; blue in both | (212,301,94,30) | Productivity; 9m; first x227 / B309 [M]; value x226.5 / B328 [M] | @ 536,678,188,64 |
| image-view + label | legend S, L only | (358,301,62,30) | Other; 3m; first x373 / B309 [M]; value x373 / B328 [M] | E-L @ 828,678,124,64 |
| image-view + label | legend S, L only | (504,301,83,30) | Creativity; 27s; first x519 / B309 [M]; value x519.5 / B328 [M] | E-L @ 1120,678,166,64 |
| label | S | (211.5,356.5,30.5,8) | Show:; 211.5/364 | @ 535,789,61,16 |
| scope-bar | small selected | (251,351.5,43,18) | Apps | @ 614,779,86,36; row 794 |
| scope-bar | small unselected | (301,351.5,64,18) | Categories; 303/364 | @ 714,779,128,36; ink @ 718,788,120,23 |
| table-header / label | S | (453.5,356.5,24.5,8) | Time; 453.5/364 | @ 1019,789,49,16 |
| table-header / label | S | (566,356.5,29.5,8) | Limits; 566/364 | @ 1244,789,59,16 |
| table-view + image-view | selected row, R | (197,373.5,450,38) | All Apps; 250.5/397 | @ 506,823,900,76; ink @ 613,852,97,23 |
| table-view + image-view + label | R name / secondary time | (197,411.5,450,38) | Finder; L: 47m; D: 14m; name 251/435; time column x452.5 L /453 D [M], B435 [M] | @ 506,899,900,76; ink @ 614,928,74,19 |
| table-view + image-view + label | R | (197,449.5,450,38) | L: Safari, 11m; D: System Information, 9m; name 250.5/473; time x453 / B473 [M] | @ 506,975,900,76; L @ 613,1003,67,20; D @ 613,1003,232,25 |
| table-view + image-view + label | R | (197,487.5,450,38) | System Preferences; L: 10m; D: 6m; name 250.5/511; time x453 / B511 [M] | @ 506,1051,900,76; ink @ 613,1079,240,25 |
| table-view + image-view + label | R, bottom clipped | (197,525.5,450,25.5) | L: System Information, 8m; D: TextEdit, 1m; name 250.5/549.5; time x453 / B549 [M] | @ 506,1127,900,51; L @ 613,1155,232,23; D @ 613,1155,95,20 |
| label | S secondary | (474,579,141.5,10) | L: Updated today at 10:45 AM; D: Updated today at 10:26 AM; 474/586.5 | @ 1060,1234,283,20 |
| help-button | enabled regular | (627.5,572.5,20,20) | ? | @ 1367,1221,40,40; row 1240, col 1387 (halo excluded) |

## App-specific elements

Weekly and daily chart frames, axes, dotted vertical grid and legend are custom [M]. Use the exact per-appearance chart crops if reconstructing a static demo; chart totals are not sufficient to derive hourly or weekly samples [I]. Tall weekly Thursday bar differs: light grey top at y437, dark grey top y381 [M], E-L/E-D col 1010 y356..490. The bar straight width is `33 pt` [M], row 438 x1008..1074. Daily bar light x871..888 is `8.5 pt` straight width [M], row 574; dark bar occurs later vertically in the same x area [M], col 874. Plot horizontal grids use stored `#e6e6e6` light / `#333435` dark [M], col 1010 y358..360. Productivity fill `#2f7cf6 (sRGB #027aff)` / `#3686f7 (sRGB #0885ff)`; light Other `#f19938 (sRGB #ff9503)`, Creativity `#76c7f5 (sRGB #5ac8fa)` [M], E-L/E-D @ 542,683; E-L @ 834,683 and @ 1128,683. Other and Creativity are absent in dark, not zero-valued labels [M].

### Layout grid

Sidebar width `174 pt`; divider `1 pt`; panel left `196 pt`, leaving `22 pt` main inset; panel right margin `20 pt` [C]. Navigation row top pitch `34 pt`; chart/header left inset `16 pt`; table row pitch `38 pt`; app title column x≈`251 pt`; time column x`452.5 pt` light first row / `453 pt` otherwise [M]. Chart plot horizontal extent `393 pt`, daily grid pitch `12 pt`, weekly grid pitch `16 pt` [M], col 874 and col 1010. Footer updated label baseline `586.5 pt`, help centre y`582.5 pt`, help bottom margin `20.5 pt` [C].

### Additional label metrics and explicit evidence

This table completes embedded labels and chart annotations. First ink x / baseline B is frame-relative pt [M]; N `10 pt`, S `11 pt`, R `13 pt` [C]. The chart axis/weekday labels are noninteractive [M]. Single-character baselines come from sampled glyph bottoms; common baseline for matching axis rows is computed from those samples [C].

| Label | x / B [M unless indicated] | Evidence (image px) |
|---|---|---|
| Today | L 561/83.5; D 561.5/83.5 | `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 1234,225,71,24`; dark @ 1235,224,70,25 |
| Apps | 258.5/364.5 | `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 629,789,55,21`; dark same |
| Productivity; 9m | 227/309; 226.5/328 | `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 565,678,124,55`; dark same |
| Other; 3m (L only) | 373/309; 373/328 | `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 858,679,58,54` |
| Creativity; 27s (L only) | 519/309; 519.5/328 | `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 1150,679,98,54` |
| Weekly S M T W T F S, N | first x216 / B214.5; subsequent glyphs follow `56 pt` grid pitch [C] | `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 544,492,681,14`; dark same |
| Weekly hour ticks, N | first x607.5 / B144.5; middle B176.5 [C]; dark 0 at B208.5 [M] | `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 1327,352,22,78`; dark @ 1327,352,22,142 |
| avg annotation, N, green | x607.5 / B203 light, B199 dark [M], beside dashed line | `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 1327,471,32,16`; `10-15-Catalina-Dark-System-Preferences-Screen-Time.png @ 1327,463,32,16` |
| Daily 60m / 30m / 0, N | x607.5 L /608 D; B234.5 /258.5 /282.5 [C] | `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 1327,532,41,110`; dark @ 1328,532,39,110 |
| 12 AM / 6 AM / 12 PM / 6 PM, N | first x215.5 L /216 D, B288.5 | `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 543,640,634,14`; dark @ 544,640,633,14 |
| Table time column, R secondary | first row x452.5 L /453 D; later x453; baselines 435,473,511,549 | `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 1017,928,73,250`; `10-15-Catalina-Dark-System-Preferences-Screen-Time.png @ 1018,928,72,250` |
| Avatar SH (L only), display | first x66.5, ink top101.5, last cap row126 [M]; size ≈35.5 pt [C], cap `50 image px` / font-cap mapping | `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 245,279,80,50` |

Navigation icon allocations `24 × 24 pt` [M], E-L/E-D @ 148,510,48,48; subsequent icon allocations follow their row pitches [C]. The charts' exact raster crops include all per-appearance tick and bar differences [M]. Grouped geometry/colour evidence for every earlier table [M]: `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 112,152,1336,1150`; `10-15-Catalina-Dark-System-Preferences-Screen-Time.png @ 112,152,1336,1150`.

## Not reproducible / assets needed

Matching user avatar treatment, navigation icons, All Apps stack, Finder, Safari, System Preferences, System Information and TextEdit icons are required [I]. Charts require separate light/dark crops or explicit matching custom drawing; unshown underlying usage data must not be invented [I]. Options, other navigation selections, Categories state, earlier dates, hover/pressed and inactive states are not shown [M]. System font fallback may alter text and graph label metrics [I].

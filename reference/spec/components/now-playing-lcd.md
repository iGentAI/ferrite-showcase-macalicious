# Now Playing display (`now-playing-lcd`)

- **Status:** present (Music and Podcasts). **TV does not have one:** its toolbar holds only the segmented navigation and a search field (`10-15-Catalina-Light-TV.png @ 112,76,2588,74`), and playback happens in a separate player window that is not in the reference set.
- **AppKit:** custom view in Music.app / Podcasts.app, inherited from the iTunes "LCD" (no public class). Built from an `NSImageView` (artwork), two `NSTextField` labels and a custom progress/scrubber view.
- **HIG:** none specific. Related: toolbars https://web.archive.org/web/20200503121036/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/toolbars/ ; progress indicators https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/indicators/progress-indicators/
- **Appearances shown:** light (idle only), dark (idle and playing)

## Purpose and behaviour
The panel in the middle of the playback bar (see `media-app-chrome`) that shows what is playing. Idle, it shows a placeholder glyph in the artwork well and an Apple logo. With an item loaded it shows the artwork, the title, a subtitle (artist and album in Music; show and date in Podcasts) and a thin progress line along its bottom edge [M]. Moving the pointer over it turns the progress line into a scrubber with elapsed and remaining times at the two ends, and clicking the artwork opens the MiniPlayer [I] (never captured). The progress line is a determinate progress indicator in the HIG's sense, "a bar ... that changes in appearance to show the progression of a task with a known duration", with a custom fill as the HIG allows ("you can specify a custom tint for the fill") [D, HIG Progress Indicators]; scrubbing follows the slider model, a thumb dragged along a track for "position during media playback" [D, HIG Sliders https://web.archive.org/web/20200504054800/https://developer.apple.com/design/human-interface-guidelines/macos/selectors/sliders/].

## Anatomy
```
 400 pt (Music) / 351 pt (Podcasts) = 40% of the content pane
+--------+-----------------------------------------------------+
|        |                       Title                         |  45 pt
|  art   |                Subtitle - detail                    |
|  44pt  |=====------------------------------------------------|  3 pt progress
+--------+-----------------------------------------------------+
  well                     body
```
Back to front: (1) body fill; (2) artwork well at the leading end, clipped by the panel's left corners; (3) 0.5 pt border, radius as fitted under Geometry; (4) idle logo, or title and subtitle centred in the body; (5) progress line across the body's bottom edge (not under the artwork).

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| state | idle, playing | idle | - | idle: Music light and dark, Podcasts light; playing: Podcasts dark |
| app | Music (music-note placeholder, gradient body in dark), Podcasts (podcast placeholder, flat body, divider after the well) | - | - | both |
| progress | 0..1 | 0 | - | about 0.01 (Podcasts dark) |
| hover controls | hidden, shown (scrubber knob, time labels) | hidden | - | hidden only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| idle, light | yes | `10-15-Catalina-Light-Music.png @ 1108,85,800,90`; `10-15-Catalina-Light-Podcasts.png @ 1117,85,702,90` |
| idle, dark | yes (Music) | `10-15-Catalina-Dark-Music.png @ 1108,85,800,90` |
| playing, dark | yes (Podcasts) | `10-15-Catalina-Dark-Podcasts.png @ 1117,85,702,90` |
| playing, light | no | [I] light fills from the idle state with text `#000000` at 0.85 (title) and 0.5 (subtitle); progress elapsed `#7f7f7f`, remaining `#d9d9d9` |
| hover (scrubber + times) | no | [I] see "Hover controls" under Text and icons |
| inactive window | no | [I] unchanged except text and glyphs at about 0.5 opacity |

## Measurements
Evidence shorthand: `LM` = `10-15-Catalina-Light-Music.png`, `DM` = `10-15-Catalina-Dark-Music.png`, `LP` = `10-15-Catalina-Light-Podcasts.png`, `DP` = `10-15-Catalina-Dark-Podcasts.png`. Window origin is image px (112, 76) in all four; the playback bar is y=76..184.

### Geometry (pt)
| Property | Music | Podcasts | Tag | Evidence |
|---|---|---|---|---|
| Panel size | 400 x 45 | 351 x 45 | [M] | `LM` row y=130: border 1108 and 1907; col x=1300: border 85 and 174. `LP` row y=130: 1117 and 1818; col x=1500: 85 and 174 |
| Width rule | 40% of the content pane (400 / 999) | 40% (351 / 876) | [C] | pane widths from `media-app-chrome` |
| Position in the bar | 4.5 pt below the bar top, 5 pt above the bar's bottom separator | same | [M] | bar y=76..184, panel y=85..174 |
| Corner radius, light | 2.625, on the outer edge of the border. Least-squares fit with `tools/corner_fit.py`: best 2.625 (rms 0.63 levels; 0.77 at 2.5, 1.02 at 2.75, 2.94 at 2). The earlier value of 2 was a grid reading | 1.875 (rms 1.21 levels; 1.35 at 1.75, 1.72 at 2, 3.08 at 2.25) | [C] fit from [M] pixels | grid `LM @ 1106,83,8,8`: border on row 85 from x=1111, row 86 at 1110, row 87 at 1109, straight edge x=1108 from row 89. grid `LP @ 1115,83,8,8`: rows 85..88, straight from 89. Same shape at the other three corners (`DM @ 1902,169,8,8`). Fit corners `10-15-Catalina-Light-Music.png @ 1108,85,8,8` and `10-15-Catalina-Light-Podcasts.png @ 1117,85,8,8` |
| Corner radius, dark | 2.5 to 2.625: top-left best 2.5 (rms 0.66 levels; 3.09 at 2.25, 2.68 at 2.75), top-right best 2.625 (rms 0.54; 1.02 at 2.5, 0.87 at 2.75). The same as light within an eighth of a point (the light top-right corner also fits 2.625, rms 0.64) | 2.75 at the top-right corner (rms 1.05 levels; 1.69 at 2.5, 1.92 at 3), the only corner that can be fitted: the top-left lies under the artwork, and at the bottom the body is not flat. This is not the light capture's 1.875, which the light top-right and bottom-right corners repeat (rms 1.26); the two Podcasts captures show different radii and the reason is not established. Open observation: one corner of one capture, not a resolved value for the dark panel | [C] fit from [M] pixels | fit corners `10-15-Catalina-Dark-Music.png @ 1108,85,8,8` and `@ 1900,85,8,8`; `10-15-Catalina-Dark-Podcasts.png @ 1811,85,8,8`; light top-right `10-15-Catalina-Light-Music.png @ 1900,85,8,8` and `10-15-Catalina-Light-Podcasts.png @ 1811,85,8,8`. Before 3 October 2026 no dark corner was fitted and the family row said "same" |
| Corner radius to build with (CSS) | `2.5px` in both appearances: the fitted 2.625 (2.5 to 2.625 in dark) rounded to the nearest half point. A recommendation of this spec, not a measurement and not compared in a browser; the fitted rows above are unchanged | light `2px`: the fitted 1.875 rounded to the nearest half point. Dark: not settled. The light and dark captures disagree (1.875 against 2.75 at the one dark corner that can be fitted) and that is an open observation; until it is resolved, `2.5px` is a provisional stand-in that matches the Music panel (the dark fit lies halfway between 2.5 and 3), not a derived value. The same caveat | [I] | rounding of the rows above |
| Border | 0.5 (1 px) all round | 0.5 | [M] | single px at x=1108 / 1907 (`LM`), 1117 / 1818 (`LP`) |
| Artwork well | 44.5 x 44 inside the border (px 1109..1197) | 44 x 44 including a 0.5 pt trailing divider (px 1118..1204 + 1205) | [M] | `LM` row y=130; `LP` row y=130: `#e9e9e9` to 1204, `#d1d1d1` at 1205 |
| Artwork (playing) | - | fills the well: 44 x 44 (px 1118..1205 x 86..173), left corners clipped by the radius | [M] | `DP` row y=130; grid `DP @ 1115,83,8,8` |
| Placeholder glyph | music note 19.5 x 26, centred in the well | podcast glyph 29 x 32, centred | [M] | `LM @ 1132,106,39,52`; `LP @ 1133,98,58,64` |
| Idle logo (Apple) | 20 x 24; horizontally centred in the body; its box centre is 2 pt above the panel's centre line | same size and offsets | [M] | `LM @ 1533,102,40,48` (body 1198..1906, centre 1552; logo centre 1552.5); `LP @ 1492,102,40,48` (body 1206..1817) |
| Title line (playing) | - | cap top 8.5 pt below the panel top, baseline at 17.5 pt; centred in the body | [M] | `DP @ 1333,101,357,20`: cap `I` 102..119; ink centre x 1511 = body centre 1511.5 |
| Subtitle line (playing) | - | cap top 23.5 pt below the panel top, baseline at 32.5 pt (15 pt below the title baseline); centred | [M] | `DP @ 1282,131,460,24`: cap `M` 132..149 |
| Progress line | - | 3 pt tall, flush with the inside of the bottom border, from the well's trailing edge to the panel's trailing edge (306 pt) | [M] | `DP` col x=1600: `#575757` y=168..173, border y=174; row y=171: 1206..1817 |
| Elapsed part | - | 3 pt wide here (6 px of 612 = 1.0%) | [M] | `DP` row y=171: `#b3b3b3` 1206..1211 |
| Gap between title baseline and progress line | - | 24 pt (subtitle baseline to line top: 9 pt) | [C] | 120 -> 168 px; 150 -> 168 px |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Body, Music | `#ffffff` | gradient `#494b4c` (top) -> `#454648` (middle) -> `#404143` (bottom) | [M] | `LM @ 1300,130`; `DM` col x=1300: y=86, 130, 173 |
| Body, Podcasts | `#ffffff` | `#404040` (first row `#3f3f3f`) | [M] | `LP @ 1500,95`; `DP` col x=1500: y=86, 87 |
| Border, Music | top `#dfdfdf`, sides `#dddddd`, bottom `#d9d9d9` | top `#222325`, sides `#1d1f20`, bottom `#1a1b1d` | [M] | `LM` / `DM` col x=1300 @ y=85, 174; row y=130 @ x=1108, 1907 |
| Border, Podcasts | `#cfcfcf` all round | `#181818` all round | [M] | `LP` / `DP` col x=1500 @ y=85, 174; row y=130 @ x=1117, 1818 |
| Bar behind the panel | Music `#fafafa` (gradient, see `media-app-chrome`); Podcasts `#ffffff` | Music `#252729`; Podcasts `#1e1e1e` | [M] | row y=130 @ x=1100 (Music), x=1110 (Podcasts) |
| Artwork well | `#e9e9e9` (both apps) | Music `#6e6e6e`; Podcasts not shown idle | [M] | `LM @ 1150,95`; `LP @ 1150,95`; `DM @ 1150,95` |
| Well divider (Podcasts) | `#d1d1d1` | none visible (artwork runs to the body) | [M] | `LP @ 1205,130` |
| Placeholder glyph | Music `#c6c6c6`; Podcasts `#9c9c9c` | Music `#929296` | [M] | `LM` col x=1150: y=111..120; `LP` col x=1160: y=136..159; `DM` col x=1150: y=111..120 |
| Idle logo | `#999999` (both apps) | Music `#8f9091` (top) to `#8e8f90` | [M] | `LM` col x=1550: y=116..147; `LP` col x=1500: y=116..146; `DM` col x=1550 |
| Title text | not shown | `#e2e2e2` | [M] | `DP` row y=110: stems at 1334..1336, 1348..1354 |
| Subtitle text | not shown | `#a9a9a9` | [M] | `DP` row y=141: stems at 1282..1283, 1293..1294, 1310..1311 |
| Progress, elapsed | not shown | `#b3b3b3` | [M] | `DP @ 1208,170` (col x=1208: y=168..172) |
| Progress, remaining | not shown | `#575757` (last row `#565656`) | [M] | `DP @ 1600,170` |
| Title / subtitle as alphas | - | white at 0.85 / 0.55 over `#404040` | [C] | (0xe2 - 0x40) / (0xff - 0x40) = 0.85; (0xa9 - 0x40) / 0xbf = 0.55 |
| Progress as alphas | - | elapsed white at 0.60, remaining white at 0.12 over `#404040` | [C] | (0xb3 - 0x40) / 0xbf; (0x57 - 0x40) / 0xbf |

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Title font | SF Pro Text 13 pt Medium, single line, centred, truncated with an ellipsis | [C] | cap height 18 px (`I` 102..119); vertical stem 3 px solid (`I` 1334..1336) against 2 px in the subtitle |
| Subtitle font | SF Pro Text 13 pt Regular, single line, centred | [C] | cap height 18 px (`M` 132..149); stems 2 px solid + anti-aliasing (1282..1283) |
| Subtitle format | Podcasts: `<Show> — <Month D, YYYY>` (em dash with spaces). Music: `<Artist> — <Album>` | [M] Podcasts; [I] Music | `DP`: `Mac Power Users — September 29, 2019` |
| Title string shown | `I Saw Your Face on the Internet` | [M] | `DP @ 1333,101,357,20` |
| Music placeholder | two beamed eighth notes, 19.5 x 26 pt, flat fill | [M] | `LM @ 1132,106,39,52` |
| Podcasts placeholder | Apple Podcasts mark: a dot over a rounded pill, inside two open rings (2 pt strokes), 29 x 32 pt | [M] | `LP @ 1133,98,58,64` |
| Hover controls: time labels | elapsed at the body's leading edge, remaining (prefixed with `-`) at its trailing edge, on the subtitle baseline; SF Pro Text 10 pt Regular, tabular digits, subtitle colour; 6 pt inset | [I] | not captured; from Music 1.0 behaviour |
| Hover controls: scrubber | the 3 pt line gains a 3 x 9 pt rounded knob in the title colour at the elapsed position; dragging seeks | [I] | not captured |

### Shadows and effects
None outside the panel. The Music border is one step darker at the bottom than at the top (`#d9d9d9` vs `#dfdfdf`; dark `#1a1b1d` vs `#222325`) [M], which reads as a faint inset bevel; Podcasts uses one flat border colour. No inner shadow [M] (`LM` col x=1300: `#ffffff` from y=86).

## Layout and spacing
- Height fixed at 45 pt; width 40% of the content pane, so it scales with the window [C]. The transport buttons float in the space to its left and the volume group starts 54.5 to 74 pt after its trailing edge (see `media-app-chrome`).
- Artwork well: a 44 pt square at the leading end, inside the border.
- Text block: both lines centred on the body (the panel minus the well), not on the whole panel; 15 pt line pitch; the block's cap-top to baseline span (8.5 to 32.5 pt) leaves 9 pt above the progress line.
- Text has at least 6 pt side padding before truncating [I].

## Keyboard and accessibility
Not focusable. Space (play/pause) and Cmd-L (show the current item) act on the item it shows [D, Music menus; not visible]. Exposed as an `AXGroup` with two static texts, an image, and an `AXSlider` ("playback position", value in seconds) [I]. ARIA: `role="group" aria-label="Now Playing"`; progress as `role="slider"` with `aria-valuetext="1:02 of 1:46:00"`, operable with Left/Right when focused.

## Browser notes
Fully reproducible: `border:0.5px solid`, `border-radius` from the "to build with" row under Geometry (2.5px for Music; for Podcasts 2px in light and, provisionally, 2.5px in dark, where the radius is an open observation; this line said 2px, the grid reading from before the fits, until 3 October 2026), `overflow:hidden`, the artwork as a 44 px `<img>`, the progress line as a 3 px absolutely positioned bar. On 1x displays the 0.5 pt border becomes 1 px. Use `font-variant-numeric: tabular-nums` for the hover time labels.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Music.png` | 1108,85,800,90 | idle: note placeholder, Apple logo, white body |
| dark | `10-15-Catalina-Dark-Music.png` | 1108,85,800,90 | idle, dark gradient body |
| light | `10-15-Catalina-Light-Podcasts.png` | 1117,85,702,90 | idle: podcast placeholder, divider after the well |
| dark | `10-15-Catalina-Dark-Podcasts.png` | 1117,85,702,90 | playing: artwork, title, subtitle, progress line |
| dark | `10-15-Catalina-Dark-Podcasts.png` | 1200,150,60,30 | start of the progress line (elapsed vs remaining) |
| light | `10-15-Catalina-Light-TV.png` | 112,76,2588,74 | TV toolbar: no now-playing display |

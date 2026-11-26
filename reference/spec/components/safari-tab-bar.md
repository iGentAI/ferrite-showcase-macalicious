# Safari tab bar (`safari-tab-bar`)

- **Status:** present
- **AppKit:** custom Safari view (`TabBarView`), visually the same as the system window tab bar
- **HIG:** https://web.archive.org/web/20200503141343/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/
- **Appearances shown:** light, dark

## Purpose and behaviour
Shows one tab per open page under Safari's 38 pt toolbar; "a Safari window lets the user create separate tabs, each of which displays a different website" [D]. Clicking selects, dragging reorders or tears off, the + cell opens a new tab. Safari 13 shows a favicon only if enabled in Preferences (off in the captures) and a close button at the tab's leading edge on hover [D].

## Anatomy
Identical to `window-tab-bar`: 24 pt fill, 1 pt dividers, trailing + cell, two 0.5 pt bottom rows.

## Variants and parameters
| Parameter | Values | Shown in screenshots |
|---|---|---|
| tab count | 1 (bar hidden unless "Show Tab Bar"), 2+ | 3 tabs (Safari, Reader Mode); 2 tabs (Picture in Picture) |
| window state | key, inactive | both |
| pinned tabs, favicons, audio indicator | n/a | not shown |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| active tab, key window | yes | `10-15-Catalina-Light-Safari-v13.png @ 1004,152,864,50` |
| inactive tab, key window | yes | `@ 113,152,889,50` |
| inactive window | yes | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 316,180,1800,50` |
| hover / close button | no | [I] as `window-tab-bar` |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Height | 25 = 24 fill (y 152..199) + 2 rows (y 200, 201) | [M] | `10-15-Catalina-Light-Safari-v13.png @ 1400,152,1,50` |
| Bar top below window top | 38 (directly under the toolbar) | [M] | toolbar rows y 76..151 |
| Dividers | 1 (2 px) at x 1002..1003, 1868..1869, 2710..2711 | [M] | `@ 112,160,2648,1` |
| Tab widths in the capture (frame 1324 pt) | 444.5, 432, 420 (x 113..1001, 1004..1867, 1870..2709) | [M] | same row |
| New-tab cell | 23.5 wide (x 2712..2758) | [M] | same row |
| + glyph | 11 x 11 (x 2724..2745, y 166..187), 1.5 pt strokes (3 px) | [M] | `@ 2724,166,22,22`, `@ 2735,166,1,22` |
| Title | 11 pt, centred; ink rows y 167..184 | [M], [C] | `@ 1340,167,190,18` |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Inactive tab fill | `#c0c0c0` -> `#b8b8b8` | `#1f1f20` -> `#1c1d1e` | [M] | `10-15-Catalina-Light-Safari-v13.png @ 300,152,1,48`; `10-15-Catalina-Dark-Safari-v13.png @ 300,152,1,48` |
| Active tab fill | `#d6d6d6` -> `#cccccc` | `#38393b` -> `#343436` | [M] | `@ 1400,152,1,48` in both |
| Divider | `#afafaf` | `#5a5b5d` | [M] | `10-15-Catalina-Light-Safari-v13.png @ 1002,160`; `10-15-Catalina-Dark-Safari-v13.png @ 954,160` |
| Bottom rows | `#bdbdbd`, `#a7a7a7` | `#292a2b`, `#000000` | [M] | `@ 300,200`, `@ 300,201` |
| Toolbar rows above the bar | `#c7c7c7`, `#b2b2b2` | `#48494a`, `#555557` (lighter than the bar: a highlight, not a dark separator) | [M] | `@ 300,150`, `@ 300,151` |
| New-tab cell | `#bababa` -> `#b1b1b1` | `#262729` | [M] | `10-15-Catalina-Light-Safari-v13.png @ 2735,152,1,48`; `10-15-Catalina-Dark-Safari-v13.png @ 2572,160,46,1` |
| + glyph | `#626262` | `#949494` | [M] | `10-15-Catalina-Light-Safari-v13.png @ 2735,170`; `10-15-Catalina-Dark-Safari-v13.png @ 2574,154,44,44` |
| Inactive window: bar fill (inactive tab) / active tab | `#dddddd` / `#f6f6f6`-like lighter cell | `#1e1f21` | [M] for `#dddddd` and `#1e1f21`, [I] for the active cell | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 900,180,1,16`; `10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png @ 900,154,1,17` |
| Inactive window: bottom rows | `#e7e7e7`, `#cecece` | `#222326`, `#000000` | [M] | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 900,228`, `@ 900,229`; `10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png @ 900,202`, `@ 900,203` |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title font | SF Pro Text 11 pt Regular | same | [C] | ink height 18 px incl. ascenders |
| Active title | `#1c1c1c` | `#ffffff` | [M] | `10-15-Catalina-Light-Safari-v13.png @ 1400,183`; lightest pixel in `10-15-Catalina-Dark-Safari-v13.png @ 1200,156,300,40` |
| Inactive title | `#3a3a3a` | `#9a9b9b` | [M] | `10-15-Catalina-Light-Safari-v13.png @ 400,156,300,40`; `10-15-Catalina-Dark-Safari-v13.png @ 400,156,300,40` |
| Title, inactive window | `#a5a5a5` | `#545557` to `#5f6062` | [M] | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 900,196`; `10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png @ 900,172` |

### Shadows and effects
None.

## Layout and spacing
Same rules as `window-tab-bar`. In Tab Overview and with a single tab the bar is absent (`10-15-Catalina-Light-Safari-v13-Tab-Overview.png`).

## Keyboard and accessibility
Control-Tab, Command-Shift-[ and ] switch tabs, Command-T new tab, Command-W close [D]. ARIA `tablist`/`tab` as `window-tab-bar`.

## Browser notes
Reproducible.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Safari-v13.png` | 112,150,2648,52 | three tabs, middle active |
| dark | `10-15-Catalina-Dark-Safari-v13.png` | 112,150,2508,52 | same |
| light | `10-15-Catalina-Light-Safari-v13-Reader-Mode.png` | 112,150,2648,52 | third tab active |
| light | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png` | 316,178,1900,54 | inactive window |

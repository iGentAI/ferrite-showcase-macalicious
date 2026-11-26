# App Switcher (`app-switcher`)

- **Status:** present
- **AppKit:** Dock.app Command-Tab switcher (HUD-style panel)
- **HIG:** https://web.archive.org/web/20200503161456/https://developer.apple.com/design/human-interface-guidelines/macos/user-interaction/keyboard/
- **Appearances shown:** light, dark

## Purpose and behaviour
Holding Command and pressing Tab shows a centred translucent panel with one large icon per running app, most recently used first; each further Tab (or Shift-Tab, or arrows) moves the selection; releasing Command switches to the selected app. While it is up, Q quits and H hides the selected app [D] (macOS keyboard shortcuts).

## Anatomy
```
   _______________________________________
  /  [#########]                           \      panel 440 x 186 pt (3 apps), radius 20
  |  [# icon  #]   [ icon ]    [ icon ]    |      icons 128 pt on a 133 pt pitch
  |  [#########]                           |      selection square 136 pt, radius 8
  \    Terminal                            /      name of the selected app only
   ---------------------------------------
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| app count | 1..n (icons shrink when the row would exceed the screen) | - | - | 3 (Terminal, System Preferences, Finder) |
| selection | index | 1 (the previous app) | - | first icon |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| shown, first app selected | yes | 10-15-Catalina-Light-Command-Tab.png @ 1240,864,880,372; 10-15-Catalina-Dark-Command-Tab.png @ 1240,864,880,372 |
| app with a badge / hidden app | no | [I] the Dock badge is drawn on the icon; hidden apps look the same |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Panel size (3 apps) | 440 x 186 (px 1240..2119 x 864..1235) | [M] | 10-15-Catalina-Dark-Command-Tab.png @ 1225,1000,60,1; 2090,1000,45,1; 1900,850,1,35; 1900,1215,1,35 |
| Panel position | centred on the screen (centre px 1680, 1050) | [M] | same |
| Panel corner radius | 20 (top edge reaches y=864 at x=1280; left edge reaches x=1240 at y=903) | [M] | 10-15-Catalina-Dark-Command-Tab.png @ 1240,864,48,40 |
| Width rule | 2 x 23 + 128 x n + 5 x (n - 1) | [C] | 46 + 384 + 10 = 440 |
| Icon size | 128 (tile px 1286..1541 for the first icon; Terminal artwork ink y=952..1147) | [C] tile, [M] ink | 10-15-Catalina-Light-Command-Tab.png @ 1413,905,1,290 |
| Icon pitch | 133 (icon centres px 1413.5, 1679.5, 1945.5) | [M] first centre and panel edges; [C] pitch | 10-15-Catalina-Dark-Command-Tab.png @ 1278,1170,272,1 (selection 1278..1549) |
| Icon top | 29 below the panel top (tile y=922..1177) | [C] | selection box minus 4 pt |
| Selection square | 136 x 136 (px 1278..1549 x 914..1185), 4 pt larger than the icon on each side; radius 8 | [M] | 10-15-Catalina-Dark-Command-Tab.png @ 1262,1170,310,1; 1290,895,1,300; 1278,914,32,14 |
| App name | centred under the selected icon (ink px 1357..1469, centre 1413); ink rows y=1201..1222; baseline 6.5 pt above the panel bottom | [M] | 10-15-Catalina-Light-Command-Tab.png @ 1357,1201,113,22 |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Panel fill, observed | `#d4d4d4`..`#e7e6f0 (sRGB #e7e6f1)` (`#e5e5e3` over a white Finder window, `#dbe5ef (sRGB #d9e5f0)` over blue folder icons) | `#2f3031`..`#4f5c73 (sRGB #4c5c75)` (`#45484b (sRGB #44484b)` typical; `#3a3e43 (sRGB #393e44)` over a dark window) | [M] | 10-15-Catalina-Light-Command-Tab.png @ 1244,870,30,360; 1262,1170; 1262,880; 10-15-Catalina-Dark-Command-Tab.png @ 1244,870,30,360; 1240,1000,38,1 |
| Panel recipe | `backdrop-filter: blur(30px) saturate(1.8)` + `rgba(236,236,236,0.80)` | `backdrop-filter: blur(30px) saturate(1.8)` + `rgba(50,50,50,0.75)` | [I] | the windows behind the panel are not visible un-covered, so alpha is estimated from how much of the blue folder colour shows through (about 20-25 %) |
| Opaque fallback | `#e5e5e3` | `#45484b (sRGB #44484b)` | [M] | points above |
| Selection square | `#c3c1bf` on panel `#e5e5e3` = `rgba(0,0,0,0.15)` | `#34342f (sRGB #34342e)` on panel `#4f4e48 (sRGB #4f4e47)` = `rgba(0,0,0,0.34)` | [M] composite, [C] alpha | 10-15-Catalina-Light-Command-Tab.png @ 1300,1170; 1262,1170; 10-15-Catalina-Dark-Command-Tab.png @ 1300,1100; 1262,1100 |
| App name text | `#777574` | `#bababa` | [M] | 10-15-Catalina-Light-Command-Tab.png @ 1357,1201,113,22; 10-15-Catalina-Dark-Command-Tab.png @ 1357,1201,113,22 |
| Border | none visible | none visible | [M] | 10-15-Catalina-Dark-Command-Tab.png @ 1225,1000,20,1 (fill starts directly at 1240) |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| App name font | SF Pro Text about 15 pt Regular ("Terminal" 22 px including the l ascender) | same | [C] | 10-15-Catalina-Light-Command-Tab.png @ 1357,1201,113,22 |

### Shadows and effects
No drop shadow distinguishable against the windows behind [M] (same scans as the panel edges).

## Layout and spacing
Single row, centred; only the selected app's name is shown, in the 29 pt strip under the icons. With many apps the icons scale down so that the panel fits within the screen width minus margins [D].

## Keyboard and accessibility
Command-Tab / Command-Shift-Tab / arrows / Command-` (reverse); Q, H, Esc, Up or 1 for the selected app's windows [D]. ARIA: a modal `listbox` with `option`s (app names), `aria-activedescendant` on the selection; in a web demo, bind to a different chord, since browsers do not deliver Command-Tab.

## Browser notes
Command-Tab cannot be intercepted by a web page; the demo needs an alternative trigger. Icons are assets.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Command-Tab.png | 1200,840,960,420 | switcher over Finder, System Preferences and Terminal windows |
| dark | 10-15-Catalina-Dark-Command-Tab.png | 1200,840,960,420 | same, dark |

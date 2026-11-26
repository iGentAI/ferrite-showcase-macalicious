# Window (`window`)

- **Status:** present
- **AppKit:** `NSWindow`, `styleMask = [.titled, .closable, .miniaturizable, .resizable]`; unified title bar and toolbar when an `NSToolbar` is attached; `NSPanel` for panels
- **HIG:** https://web.archive.org/web/20200503141343/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/
- **Appearances shown:** light, dark

## Purpose and behaviour
A window is a frame area (title bar, toolbar, tab bar, rarely a bottom bar) around a body area. The HIG lists document windows, app windows, panels, dialogs and alerts, and three states: main, key and inactive. "Inactive windows are subdued and appear to fall backward"; the close/minimize/zoom controls are colourised only in the key window; vibrancy is disabled in inactive windows [D]. The user drags the frame to move and the edges to resize [D].

## Anatomy
```
  outer hairline (0.5 pt, outside the frame, part of the shadow)
 +--------------------------------------------------+  radius 5 pt on all four corners
 | inner highlight line (light 0.5 pt, dark 1 pt)   |
 | title bar / unified toolbar      (see title-bar) |
 | [tab bar] [scope bar]                            |
 | body (sidebar | content), clipped by the corners |
 | [bottom bar]                                     |
 +--------------------------------------------------+
  drop shadow (see window-shadow)
```
Drawing order: shadow, outer hairline, frame fill (clipped to the rounded rectangle), chrome, body, inner highlight line on top.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| state | key, main-not-key, inactive | key | `isKeyWindow`, `isMainWindow` | key: every window capture; main-not-key: Finder behind Quick Look; inactive: Safari in the Picture in Picture shots, Notes in Split Screen |
| chrome | plain title bar, unified toolbar, title-hidden toolbar, utility panel | plain | `titleVisibility`, `NSToolbar`, `.utilityWindow` | all four (see `title-bar`) |
| full screen | off, on | off | `toggleFullScreen(_:)` | on: Full Screen App, Split Screen Apps (see `full-screen-window`) |
| resizable | yes/no | yes | `.resizable` | no resize affordance is drawn in 10.15 |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| key | yes | all 184 transparent window captures |
| main, not key | yes | `10-15-Catalina-Light-Finder-Quick-Look.png @ 141,258,2470,1570` (Finder under the Quick Look panel): chrome identical to key, window controls grey |
| inactive | yes | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 316,104,2508,1728`; `10-15-Catalina-Light-Split-Screen-Apps.png @ 0,0,1480,2100` |
| full screen | yes | `10-15-Catalina-Light-Full-Screen-App.png` (no radius, border or shadow) |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Corner radius, top corners | 5, on the edge of the opaque frame, as a grid reading (the top row is opaque from 10 px in). A least-squares fit with `tools/corner_fit.py` to the alpha channel gives the same figure in light: the 0.5 pt translucent rim outside the frame fits 5.5 (rms 5.6 levels of alpha; 9.9 at 5.25, 7.9 at 5.75), and 5.5 less the 0.5 pt rim is 5. The fit is a coarse, model-dependent estimate and not a confirmation: the tool assumes a flat background, and the shadow outside this corner is not flat (alpha 7 to 25 in the compared square, entered as 18), which is what the rms of 5 to 6 levels reflects. In dark the outline fits 5.5 to 5.75 (rms 13 to 14, coarser still: the corner carries two partly transparent lines), which puts the frame at 5 to 5.25. Until 3 October 2026 this row called the fit a confirmation | [M] grid reading; [C] fit from [M] pixels, coarse | `10-15-Catalina-Light-Finder-Network.png @ 108,72,20,16`: top row y=76 becomes opaque at x=122, left column x=112 at y=86 (10 px); dark same crop; fit corners `10-15-Catalina-Light-Finder-Network.png @ 111,75,14,14` and `10-15-Catalina-Dark-Finder-Network.png @ 111,75,14,14` |
| Corner radius, bottom corners | 5.125, on the edge of the opaque frame, by a least-squares fit with `tools/corner_fit.py` to the alpha channel in light: the 0.5 pt rim fits 5.625 (rms 4.6 levels of alpha; 5.1 at 5.5, 6.0 at 5.75), and 5.625 less the 0.5 pt rim is 5.125. The grid reading is 5 (the bottom row is opaque from 10 px in). The fit is coarse and model-dependent for the same reason as at the top: the shadow outside this corner has alpha 38 to 54 in the compared square (entered as 46). The next candidate, rim 5.5 and frame 5, is 0.5 levels worse, so the fit prefers 5.125 only weakly. Until 3 October 2026 this row read "5, confirmed by the fit", which the fit does not say. Dark not fitted | [C] 5.125, fit from [M] pixels, coarse; [M] grid reading 5 | `10-15-Catalina-Light-Finder-Network.png @ 108,1484,16,16` (opaque from x=122 on row 1497, from y<=1487 on column 112); `10-15-Catalina-Dark-Finder-Network.png @ 108,1480,16,16`; fit corner `10-15-Catalina-Light-Finder-Network.png @ 111,1485,14,14` |
| Corner radius to build with, all four corners | 5. One value for the four corners is a choice, not a measurement: both grid readings and the top fit give 5, the bottom fit gives 5.125, and the difference (a quarter of a pixel at 2x) is smaller than either coarse fit can resolve | [I] | the two rows above; `tokens.md`, `--mac-radius-window` |
| Outer hairline width (light and dark) | 0.5 (1 px), outside the frame | [M] | light `10-15-Catalina-Light-Finder-Network.png @ 111,800` alpha 0.349 vs 0.239 one px further out; dark `10-15-Catalina-Dark-Finder-Network.png @ 111,800` alpha 0.965 vs 0.353 |
| Inner highlight width, light | 0.5 (1 px) | [M] | `10-15-Catalina-Light-Finder-Network.png @ 112,100` and `@ 112,800` |
| Inner highlight width, dark | 1 (2 px), left, right and bottom edges and round the corners | [M] | `10-15-Catalina-Dark-Finder-Network.png @ 112,800,2,1`, `@ 2108,800,2,1`, `@ 1200,1492,1,2` |
| Canvas margins of a window capture | 56 left, 38 top, 56 right, 74 bottom | [M] | `$M info`: `left 112, top 76, right 112, bottom 148` px for 184 captures |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Outer hairline | black @ 0.19 (composite alpha 0.35 side, 0.25 top, 0.45 bottom on top of the shadow) | black @ 0.95-0.98 | [C] light, [M] dark | light `10-15-Catalina-Light-Finder-Network.png @ 111,800` (0.349), `@ 1000,75` (0.255), `@ 1000,1498` (0.447); dark `10-15-Catalina-Dark-Finder-Network.png @ 111,800` (0.965), `@ 1200,75` (0.949), `@ 1200,1494` (0.984) |
| Inner highlight over the title bar side | `#e4e4e3` on `#dfdfdf` = white @ 0.16 | `#5f6061` on `#363738` = white @ 0.20 | [M] colours, [C] alpha | `10-15-Catalina-Light-Finder-Network.png @ 112,100`; `10-15-Catalina-Dark-Finder-Network.png @ 112,98` |
| Inner highlight over the sidebar | `#ebecec` on `#e7e8e8` | `#565759` on `#2c2d2f` | [M] | `@ 112,800` in both Finder-Network files |
| Inner highlight over content | not visible on `#ffffff` | `#4b4c4d` on `#1e1f21` | [M] | `10-15-Catalina-Dark-Finder-Network.png @ 2108,800` and `@ 1200,1492` |
| Top edge rows (title bar highlight + border) | `#f6f6f6`, `#ececec` | `#848586`, `#767677` | [M] | `@ 1200,76` and `@ 1200,77` (light), `@ 1300,76`, `@ 1300,77` (dark) |
| Window background (`windowBackgroundColor`) | `#ececec` | `#2f3031` to `#303031` (General pane), up to `#363637` in panes with a sidebar tint | [M] | `10-15-Catalina-Light-System-Preferences-General.png @ 900,152`; `10-15-Catalina-Dark-System-Preferences-General.png @ 900,152` |
| Content background (`controlBackgroundColor`, lists and icon views) | `#ffffff` | `#1e1f21` (Finder), `#1e1e1e` (TextEdit, graphite-free) | [M] | `10-15-Catalina-Light-Finder-Network.png @ 1500,800`; `10-15-Catalina-Dark-Finder-Network.png @ 1500,800`; `10-15-Catalina-Dark-TextEdit.png @ 1100,237` |
| Sidebar fallback | `#e7e8e8` | `#2c2d2f` | [M] | `@ 300,1450` light, `@ 200,1450` dark (Finder-Network) |

Dark window fills vary by a few levels between screenshots (title bar top `#404142` in Finder, `#424344` in System Preferences, `#434649 (sRGB #424649)` in TextEdit, `#4c4346 (sRGB #4e4346)` in the Safari tile of Split Screen) because dark-mode windows are tinted by the desktop picture ("wallpaper tinting") [M] for the values, [I] for the cause. Use the Finder values as the neutral token.

### Text and icons
None of its own (see `title-bar`).

### Shadows and effects
See `window-shadow`. There is no content border: the body meets the frame edge directly and is clipped by the 5 pt bottom corners (`10-15-Catalina-Light-Finder-Network.png @ 108,1484,16,16` shows the sidebar fill following the curve).

## Layout and spacing
- Frame size examples (pt): Finder 926x711, Safari 1324x940, System Preferences 668 wide, TextEdit 624x537 [M] (`$M info`).
- Chrome heights are listed in `title-bar`; the body starts immediately below the chrome's 0.5 pt separator.
- Minimum window size and resize behaviour are app-defined [D].

## Keyboard and accessibility
Command-W closes, Command-M minimises, Control-Command-F toggles full screen, Command-` cycles an app's windows [D]. AppKit exposes `AXWindow` (subrole `AXStandardWindow`, `AXDialog`, `AXFloatingWindow`); the ARIA match is `role="dialog"` for panels/dialogs and a labelled `region`/`application` for app windows, with focus trapped only for modal dialogs.

## Browser notes
- The dark inner highlight is `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2)` drawn above the content (use a pseudo-element with `pointer-events: none`), the outer hairline `0 0 0 0.5px` (rounds to 1 px on 1x displays).
- `border-radius: 5px; overflow: hidden` reproduces the clip (5 is the value to build with for all four corners; the bottom corners fit 5.125, see Geometry).
- Wallpaper tinting of dark windows cannot be reproduced without sampling the backdrop; use the neutral values.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Network.png` | 112,76,1852,1422 | key window, all four corners |
| dark | `10-15-Catalina-Dark-Finder-Network.png` | 112,76,1998,1418 | key window, inner and outer hairlines |
| light | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png` | 316,104,2508,1728 | inactive window over the desktop |
| dark | `10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png` | 344,78,2508,1806 | inactive window over the desktop |

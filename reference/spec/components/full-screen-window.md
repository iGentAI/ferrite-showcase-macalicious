# Full-screen window (`full-screen-window`)

- **Status:** present
- **AppKit:** `NSWindow.toggleFullScreen(_:)`, `collectionBehavior = .fullScreenPrimary`, `NSApplication.PresentationOptions` (`.autoHideToolbar`, `.autoHideMenuBar`)
- **HIG:** https://web.archive.org/web/20200503161459/https://developer.apple.com/design/human-interface-guidelines/macos/app-architecture/fullscreen-mode/
- **Appearances shown:** light, dark

## Purpose and behaviour
Full-screen mode gives a distraction-free environment: "toolbars, menus, and other standard controls are often hidden and revealed only when the user calls for them, such as by moving the pointer to the top of the screen" [D]. An app chooses whether the toolbar stays visible (Calendar) or hides (Preview) [D]. The Dock should remain revealable, Mission Control gestures keep working, and the app must not leave full screen on its own [D]. The window moves to its own Space.

The captures show Photos in full screen with the pointer at the top: the menu bar is revealed and the toolbar sits directly under it; the window controls show their hover glyphs, minimise is disabled and the green button carries the exit-full-screen glyph [M].

## Anatomy
```
 y 0..43     menu bar (22 pt, revealed)                         see menu-bar
 y 44..119   toolbar, 38 pt, title-hidden layout, full width
 y 120..     content to the screen's bottom edge; no Dock
```
No corner radius, hairline, inner highlight or window shadow.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| chrome policy | retained, auto-hidden/revealed | app-defined [D] | `.autoHideToolbar`, `.autoHideMenuBar` | revealed in Photos; hidden menu bar in Split View |
| role | primary, auxiliary | primary [D] | `.fullScreenPrimary`, `.fullScreenAuxiliary` | primary only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| menu bar and toolbar revealed | yes | `10-15-Catalina-Light-Full-Screen-App.png @ 0,0,3360,126` |
| menu bar hidden (toolbar at y=0, or hidden) | yes, in Split View | `10-15-Catalina-Light-Split-Screen-Apps.png @ 0,0,3360,76` |
| transition animation | no | [D] the window scales up to the screen over about 0.5 s |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Window frame | the whole screen, 1680 x 1050 | [M] | image size 3360 x 2100 |
| Menu bar (revealed) | 22 (y 0..43, last row `#436173 (sRGB #3b6275)` shadow line) | [M] | `10-15-Catalina-Light-Full-Screen-App.png @ 1000,40,1,4` |
| Toolbar | 38 (y 44..119) | [M] | `@ 1000,44,1,76` |
| Toolbar controls | 22 high, top 8 below the bar top (fill y 60..103) | [M] | `@ 2700,59,1,47` |
| Window controls | centres (19, 19) from the bar's top-left, 20 pitch | [M] | close x 26..49, y 70..93 |
| Shadow under the revealed bar | about 3 (6 px) fading | [M] | `@ 1000,120,1,6` |
| Corner radius / border / shadow | 0 / none / none | [M] | `@ 0,44,8,8` shows square corner |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Toolbar gradient | `#f4f4f4`, `#ebebeb`, then `#e5e5e5` -> `#cdcdcd`, `#bdbdbd`, `#a7a7a7` (same as a window's key bar) | `#65686b (sRGB #64686b)`, `#535559`, then `#414247` -> `#353638`, `#2a2b2d`, `#000000` | [M] | `10-15-Catalina-Light-Full-Screen-App.png @ 1000,44,1,76`; `10-15-Catalina-Dark-Full-Screen-App.png @ 1000,44,1,76` |
| Bar above the sidebar (light) | tinted `#dde5e5 (sRGB #dbe5e5)` -> `#cbd3d3 (sRGB #c9d3d3)` (the sidebar's vibrancy shows through) | n/a | [M] | `10-15-Catalina-Light-Full-Screen-App.png @ 38,46,1,48` |
| Shadow rows on white content | `#bdbdbd`, `#c0c0c0`, `#c4c4c4`, `#c7c7c7`, `#cacaca`, `#cecece` | none visible (content `#161719`) | [M] | `@ 1000,120,1,6` in both |

### Text and icons
Title ("My Albums") centred in the bar, 13 pt, title colours as `title-bar` [C].

### Shadows and effects
No outer window shadow [M] in the full-frame capture. The revealed toolbar's short content shadow is measured in the geometry and colour rows above; do not substitute the key-window shadow.

## Layout and spacing
Sidebars and content stretch; "take advantage of the extra screen space, but keep your interface transitions smooth" [D]. Auxiliary windows need `.fullScreenAuxiliary` to appear above [D].

## Keyboard and accessibility
Control-Command-F toggles; Escape leaves full screen in media apps [D]. The Fullscreen API (`element.requestFullscreen()`) is the browser equivalent; Escape is reserved by the browser to exit.

## Browser notes
A page cannot hide the real menu bar; the Fullscreen API hides browser chrome. Reveal-on-hover of the toolbar can be imitated with a top-edge hover zone.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Full-Screen-App.png` | 0,0,3360,2100 | Photos in full screen, menu bar revealed |
| dark | `10-15-Catalina-Dark-Full-Screen-App.png` | 0,0,3360,2100 | same |

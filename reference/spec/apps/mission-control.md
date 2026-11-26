# Mission Control
- **Screenshots:** 10-15-Catalina-Light-Mission-Control.png, 10-15-Catalina-Dark-Mission-Control.png
- **Window:** full-screen overlay 1680 x 1050 pt; menu bar replaced by the Spaces bar; Dock visible

## Layout
| Region | Position / size (pt) | Light | Dark | Tag | Evidence |
|---|---|---|---|---|---|
| Spaces bar | 0,0, 1680 x 146 | `#8ac9f8 (sRGB #78cafd)`..`#b1d8f8 (sRGB #a8d9fb)` | `#132648 (sRGB #0e264b)`..`#2a4269 (sRGB #24426c)` | [M] | 10-15-Catalina-Light-Mission-Control.png @ 0,0,3360,292; 10-15-Catalina-Dark-Mission-Control.png @ 0,0,3360,292 |
| Space thumbnails | 4 x (144 x 90) at x=504, 680, 856, 1032; y=28 | snapshots | snapshots | [M] | 10-15-Catalina-Light-Mission-Control.png @ 1008,56,1344,180 |
| Current-space ring | 152 x 98 around the current thumbnail, 3 pt `#5399f5 (sRGB #3b98fc)` | Photos | Desktop 1 | [M] | @ 2056,48,304,196 (light); 1000,48,304,196 (dark) |
| Labels | centred under each thumbnail, baseline y=136 | `#001b45 (sRGB #001a48)` | `#ffffff` | [M] | @ 1000,246,1400,40 |
| Add button | plus 20 x 20 centred at (1645.75, 72.75) | `#4c4c4c` | `#e5e5e5` | [M] | @ 3272,126,40,40 |
| Window area | below the bar: the space's windows scaled to fit, over the un-dimmed desktop picture | - | - | [M] | @ 0,294,3360,1640 |
| Dock | bottom, 21 tiles + 2 separators (1498 pt wide: px 182..3178) | Dock material | Dock material | [M] shelf x 182..3177 in both captures (row y=1950), 1498 pt; rule in `dock` | @ 170,1940,3020,160 |

## Components used
`mission-control`, `dock`, `material`; the thumbnails contain `window`, `toolbar` etc. (Maps window with an inactive title bar, System Preferences window: key in light, inactive in dark).

## App-specific elements
None beyond the component.

## Content in the screenshot
Spaces: "Desktop 1", "Desktop 2", "Notes & Safari", "Photos". Windows: Maps (search "Apple Park", callout "Apple Park / One Apple Park Way, Cupertino", Map | Transit | Satellite, weather 72 degrees AQI 48 in light, 73 degrees in dark) and System Preferences (main icon grid, "Stephen Hackett / Apple ID, iCloud"). Dock: Finder ... System Preferences, separator, Calculator (recent app, running), separator, Downloads, Trash; running dots under Finder, Safari, Maps, Photos, Notes, System Preferences and Calculator.

## Not reproducible / assets needed
Map tiles, app icons, space snapshots (render from the demo's own spaces).

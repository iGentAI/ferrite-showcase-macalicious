# Login window (fast user switching)
- **Screenshots:** 10-15-Catalina-Light-Fast-User-Switching.png, 10-15-Catalina-Dark-Fast-User-Switching.png (identical UI)
- **Window:** full screen 1680 x 1050 pt, no menu bar, no Dock

## Layout
| Region | Position / size (pt) | Appearance | Tag | Evidence |
|---|---|---|---|---|
| Background | full screen | Catalina Evening picture, not blurred | [M] | 10-15-Catalina-Light-Fast-User-Switching.png @ 0,0,3360,2100 |
| Status items | top right: "100%" + battery, Wi-Fi, clock; clock right edge 9 pt from the screen edge, text centred on y=13.5 | white | [M] | @ 2980,10,370,36 |
| Avatar | circle about 93 pt, centre (839.5, 391.5) | user picture | [M] | @ 1584,690,186,190 |
| Name | centred, ink y=459.5..472.5 | white about 20 pt | [M] | @ 1605,919,152,27 |
| Password field | 760, 511, 160 x 28 | `rgba(255,255,255,0.38)`, placeholder `rgba(255,255,255,0.4)` | [M]/[C] | @ 1520,1022,320,56 |
| Cancel ring | 30 pt circle centred at (839.75, 945.75) | 1.5 pt white ring, x glyph, `rgba(255,255,255,0.18)` fill | [M]/[C] | @ 1650,1862,60,60 |
| Cancel label | centred, cap rows y=972..981.5 | white 14 pt | [M] | @ 1638,1944,83,20 |

## Components used
`login-window`, `secure-text-field` (custom translucent style here), `desktop` (picture), `menu-bar-extra` glyphs (battery, Wi-Fi) without the bar.

## App-specific elements
None beyond the component.

## Content in the screenshot
Name "mhackett"; placeholder "Enter Password"; "Cancel"; status "100%" and "3:37 PM" (light session) / "10:57 AM" (dark session).

## Not reproducible / assets needed
Evening desktop picture; the yin-yang account picture.

# Siri
- **Screenshots:** 10-15-Catalina-Light-Siri.png, 10-15-Catalina-Dark-Siri.png (window captures with shadow)
- **Window:** 344 x 600 pt dark HUD panel, radius about 7; shown at the top-right of the screen under the menu bar [D]

## Layout
| Region | y range (px in the capture) | Height (pt) | Fill | Tag | Evidence |
|---|---|---|---|---|---|
| Top strip (close button) | 36..91 | 28 | `#353c3a (sRGB #333c3a)` | [M] | 10-15-Catalina-Light-Siri.png @ 38,36,688,56 |
| Result card (320 pt wide, x=62..701) | 92..1117 | 513 visible | `#d6d6d6` with a coloured glow near the top | [M] | @ 62,92,640,1026 |
| - card header "WEATHER" | 92..143 | 26 | `#cfe0de (sRGB #cbe1de)` | [M] | @ 62,92,640,52 |
| - summary block | 144..about 360 | about 108 | glow `#d8ece9 (sRGB #d3ede9)` | [M] | @ 62,144,640,216 |
| - hourly rows | from about 372, 78 px each | 39 each | `#d6d6d6` | [M] | @ 62,372,640,746 |
| Bottom strip (help, orb) | 1118..1235 | 59 | `#383838` | [M] | @ 38,1118,688,118 |

## Components used
`siri` (window, card), `material` (HUD); the card is Siri's Weather snippet.

## App-specific elements
Weather snippet: 48 pt sun glyph at the left (centre about x=75 pt of the window), city (14 pt semibold) and three condition lines (13-14 pt, secondary) from x=99 pt (window px 236), temperature in about 56 pt thin digits right-aligned to x=290.5 pt; hourly rows: hour label at x=30.5 pt, weather glyph centred at x=171 pt, value bold right-aligned to x=311 pt [M] 10-15-Catalina-Light-Siri.png @ 99,393,60,19; 380,399,1,180; 629,393,32,19.

## Content in the screenshot
Light: "WEATHER"; "Memphis"; "Sunny", "Chance of Rain: 20%", "High: 97 degrees Low: 64 degrees"; "95 degrees"; rows 4 PM 96 (partly cloudy), 5 PM 93 (partly cloudy), 6 PM 91 (sun), 7 PM 87 (cloudy night), 8 PM 84 (cloudy night), 9 PM 82 (moon), 10 PM 78, 11 PM 78, 12 AM 75, 1 AM 73 (moons).
Dark: "Memphis"; "Sunny", "Chance of Rain: 0%", "High: 84 degrees Low: 61 degrees"; "73 degrees"; rows 12 PM 75, 1 PM 78, 2 PM 80, 3 PM 82, 4 PM 82, 5 PM 80, 6 PM 78 (suns), 7 PM 75, 8 PM 73, 9 PM 71 (moons).

## Not reproducible / assets needed
Siri orb (animated), weather glyphs, live weather data.

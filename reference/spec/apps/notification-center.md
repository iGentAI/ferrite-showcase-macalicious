# Notification Center
- **Screenshots:** 10-15-Catalina-Light-Notification-Center-Today.png, 10-15-Catalina-Dark-Notification-Center-Today.png, 10-15-Catalina-Light-Notification-Center-Notifications.png, 10-15-Catalina-Dark-Notification-Center-Notifications.png
- **Window:** edge panel 344 pt wide, from y=22 pt (under the menu bar) to the screen bottom (1028 pt tall), flush with the right screen edge

## Layout
| Region | y range (px) | Height (pt) | Light | Dark | Tag | Evidence |
|---|---|---|---|---|---|---|
| Header with segmented control | 44..141 | 49 | panel material | panel material | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2672,44,688,98 |
| Divider | 142..143 | 1 | `#a3c2de (sRGB #9cc3e1)` | `#3e516f (sRGB #3a5172)` | [M] | @ 2690,142,1,2 |
| Scrolling content | 144..2009 | 933 | panel material | panel material | [M] | @ 2672,144,688,1866 |
| Divider | 2010..2011 | 1 | `#788aa0 (sRGB #748aa2)` | `#4d5968 (sRGB #4a596a)` | [M] | @ 2800,2010,1,2 |
| Footer | 2012..2099 | 44 | panel material | panel material | [M] | @ 2672,2012,688,88 |

Today view content (px, light) [M]:
| Block | y range | Notes |
|---|---|---|
| Switches card | 164..337 | rows "NIGHT SHIFT" (165..249) and "DO NOT DISTURB" (252..336), each with a switch at the right (both off) |
| Date | 443..568 | "Thursday," / "October 3" (dark: "Friday," / "October 4"), about 34 pt thin, 38 pt pitch, x=45 pt |
| Summary | 644..about 830 | weather glyph + two paragraphs, 12 pt, x=46 pt |
| Calendar widget | 900..1395 | header "CALENDAR"; hour grid 2 PM / 3 PM / (3:50 PM now line) / 5 PM |
| Stocks widget | 1408..about 1908 | header "STOCKS"; 5 rows + "Show More..." |
| Weather widget | about 1920.. | header "WEATHER", cut off by the footer |

Notifications view content (px) [M]: day heading at 170..209 with clear button at 3294..3321 x 176..203; notification card 228..381.

## Components used
`notification-center` (panel, header, footer), `today-widget` (cards), `notification-banner` (notification card), `segmented-control` (sysA, custom translucent styling here), `switch` (sysB), `material`; behind: `menu-bar`, `desktop`, `dock`.

## App-specific elements
- Calendar widget timeline: hour labels right-aligned at 66.5 pt, 44 pt per hour, event block with a 1 pt coloured bar at its left, red now-line with a dot and red time label [M] 10-15-Catalina-Light-Notification-Center-Today.png @ 2694,960,644,436.
- Stocks rows: symbol (13 pt semibold) at 18 pt, price right-aligned ending px 3160 (secondary colour), green pill 61 x 22 pt `#76d572 (sRGB #4bd964)` with white "+ 0.47%" (bold 12-13 pt) [M] @ 2694,1480,644,60.

## Content in the screenshot
Light, Today (Thu 3:50 PM): segmented control "Today | Notifications" (Today selected); "NIGHT SHIFT", "DO NOT DISTURB"; "Thursday, October 3"; "Partly Cloudy currently. The high will be 97 degrees. Fair tonight with a low of 64 degrees."; "The first thing on your calendar today is "Make Catalina Screenshots", and it started over an hour ago."; CALENDAR: "2 PM", "3 PM", "3:50 PM", "5 PM", event "Make Catalina Screenshots"; STOCKS: DOW J 26,201.04 + 0.47%; S&P 500 2,910.63 + 0.80%; AAPL 220.82 + 0.85%; BA 372.07 + 1.28%; BRK-B 204.98 + 0.93%; "Show More..."; WEATHER; footer "2 New" (with a blue dot) and a gear button.

Dark, Today (Fri 11:08 AM): "Friday, October 4"; "Fair currently. The high will be 84 degrees. Clear tonight with a low of 61 degrees."; "The first thing on your calendar today is "Make even more Screenshots", and it started over an hour ago."; CALENDAR "10 AM", "11:08 AM", "12 PM", "1 PM", event "Make even more Screenshots"; STOCKS: DOW J 26,439.08 + 0.91%; S&P 500 2,937.76 + 0.93%; AAPL 226.09 + 2.39%; BA 375.12 + 0.82%; BRK-B 206.83 + 0.90%; footer "Edit".

Notifications view: heading "Today" (light) / "Yesterday" (dark); card: app "MUSIC", time "now" / "Yesterday, 3:51 PM", title "Every Breaking Wave", body "U2 - Songs of Innocence" (em dash).

## Not reproducible / assets needed
Widget app icons (Calendar, Stocks, Weather, Music), weather glyphs, live data.

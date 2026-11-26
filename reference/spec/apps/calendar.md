# Calendar
- **Screenshots:** 10-15-Catalina-Light-Calendar.png, 10-15-Catalina-Dark-Calendar.png (week view; an event popover is open and extends past the window's right edge)
- **Window:** 1102 x 624 pt [M] (image x=112..2315, y=76..1323 in both). Unified toolbar with hidden title, 38 pt.

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Toolbar | 38 (y=76..151) | gradient to `#bdbdbd`, line `#a7a7a7` | dark gradient, line `#000000` | [M] Light-Calendar @ 250,76,1,76 |
| Calendar-list sidebar (`sidebar`) | 165 wide (x=112..441) | `#e8e9e9` | `#2c2d2e` | [M] @ 300,700 |
| Mini month (bottom of sidebar) | starts at a 1 pt rule y=996; about 163 high | rule `#d1d2d2` | - | [M] Light-Calendar @ 200,996,1,2 |
| Divider | 1 | `#d0d1d1` | `#000000` | [M] @ 442,700 |
| Week header | title row + day row, y=152..311 (80 pt) | `#ffffff` | `#1e1f20` | [M] @ 700,152,1,160 |
| All-day row | 22 (y=314..357), then a 3 pt band | band `#d9d9d9` | band `#404040` | [M] @ 700,312,1,52 |
| Time gutter | 74 wide (x=444..591) | `#ffffff` | `#1e1f20` | [M] @ 444,700,148,1 |
| Day columns | 7 x about 123-124 (separators at x=836, 1084, 1332, 1580, 1826, 2072) | weekdays `#ffffff`, weekend `#f5f5f5` | weekdays `#1e1f20`, weekend `#272828` | [M] Light-Calendar @ 592,700,1724,1 |
| Hour rows | 39.3 per hour (lines every 78-79 px from y=407) | line `#e0e0e0` | line `#404040` | [M] @ 700,407,1,870 |

```
[o o o] [Calendars] [+]            [Day|Week|Month|Year]                     [Search]
+ iCloud      + October 2019                                      [<][Today][>]
| [x] Home    |        Sun 29  Mon 30  Tue 1  Wed 2  Thu (3)  Fri 4  Sat 5
| [x] Work    | all-day        [Rosh Hashanah]
| Other       |  8 AM  |      |       |      |      |        |      |
| [x] US Hol. |  ...                               [2 PM Make Catalina Screenshots]
| < Oct 2019 >| 3:38 PM ------------------------------o-----------------
```

Toolbar items (px): "Calendars" 267..418 (76 pt); "+" 437..514 (39 pt); view segmented control 964..1459 (248 pt, 4 segments, "Week" selected); search field 1899..2300 (201 pt) [M] (10-15-Catalina-Light-Calendar.png row y=114).

## Components used
`window`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-segmented-control`, `toolbar-search-field`, `sidebar` (rows at 24 pt pitch), `checkbox` (calendar colour checkboxes, 14 pt), `split-view`, `date-picker` (graphical mini month), `popover` (event detail), `pop-up-button` (calendar colour in the popover), `segmented-control` ("< Today >"), `label`.

## App-specific elements (week grid)
- Title: "October" SF Pro Display about 32 pt Bold + "2019" same size Light, left edge 16 pt from the pane edge (x=476), line box y=181..228; colour `#262726` / white. [C] from cap height 46-48 px; 10-15-Catalina-Light-Calendar.png @ 476,181,393,48.
- Day header: "Mon 30" about 17 pt Regular, right-aligned in each column; weekend days grey; today's number in a 26 pt red disc (`#ec4d3d (sRGB #ff3b30)`, x=1711..1762) with white digits. [M] @ 1711,280,52,1.
- Time labels: 11 pt, light grey, right-aligned 8 pt before the grid (right edge x=575); "Noon" for 12. [M] @ 514,399,62,174.
- All-day event: 18 pt high pill-less rectangle, fill `#d7ebfc (sRGB #d3ebfe)`, text 11 pt Bold `#3d7ead (sRGB #207fb1)` (calendar colour). [M] @ 838,318,240,36.
- Timed event, selected (light): solid `#ba70d7 (sRGB #c768dd)` block with white text (time 11 pt, title 11 pt Bold), x=1592..1823, 2 pt from the column separators. Unselected (dark): fill `#3c2c44 (sRGB #3f2b46)` with a 2 pt left bar `#c07bdb (sRGB #cc74e1)` and tinted text; selected dark: `#7f5690 (sRGB #875294)`. [M] Light-Calendar @ 1593,1000,225,1; Dark-Calendar @ 1582,1000,242,1 and 1828,660,242,1.
- Current-time line: 1 pt `#ec4d3d (sRGB #ff3b30)` across all columns with the time label in red in the gutter and a 10 pt disc at today's column start (x=1574..1593). [M] @ 1000,1008,1,2 and 1574,1009,20,1.
- Mini month: header "October 2019" centred with chevrons; weekday initials; 6 date rows at 17 pt pitch (y=1104, 1148, 1182, 1216, 1250, 1284); today in an 18 pt red disc; other-month days grey `#afafb0`. [M] @ 134,1027,293,273.

## Content in the screenshot
Sidebar: "iCloud": Home (blue), Work (purple, selected row); "Other": US Holidays (blue, with a subscription glyph), Siri Suggestions (grey). Header "October 2019"; days "Sun 29, Mon 30, Tue 1, Wed 2, Thu 3, Fri 4, Sat 5" (today = Thu 3 in light, Fri 4 in dark). All-day: "Rosh Hashanah" (Mon 30). Hours 8 AM .. 7 PM with "Noon". Event "2 PM Make Catalina Screenshots" (Thu, 2-4:45 PM); dark adds "10 AM Make even more Screenshots" (Fri 10 AM-1 PM). Now line "3:38 PM" (light) / "10:57 AM" (dark). Popover (light): "Make Catalina Screenshots", "Add Location", "Oct 3, 2019  2 PM to 4:45 PM", "Add Invitees", "Add Notes, URL, or Attachments". Buttons "Calendars", "+", "Day/Week/Month/Year", "Today"; search placeholder "Search".

## Not reproducible / assets needed
None beyond glyphs (chevrons, subscription icon).

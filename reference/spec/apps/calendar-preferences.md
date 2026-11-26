# Calendar Preferences (General)

- **Screenshots:** 10-15-Catalina-Light-Calendar-Preferences.png, 10-15-Catalina-Dark-Calendar-Preferences.png
- **Window:** 537 x 542 pt (frame x 112..1185, y 76..1159 px); preferences window with toolbar; title "General"; close enabled, minimize and zoom disabled [M]

Shared measurements: `components/preferences-window.md`, `components/preferences-toolbar.md`.

## Layout

| Region | px (light) | Size pt | Light | Dark |
|---|---|---|---|---|
| Title bar + toolbar (General, Accounts, Alerts, Advanced) | y 76..231 | 537 x 78 | gradient | dark gradient |
| Content | y 232..1159 | 537 x 464 | `#ececec` | `#303032` |

Content rows (label right edge x 594, control column x 614..973 = 180 pt, all [M] from
10-15-Catalina-Light-Calendar-Preferences.png lay boxes and col 800):

| Row | y px (control top) | Control |
|---|---|---|
| Default calendar app: | 273 | pop-up 180 pt, Calendar icon + "Calendar" |
| Days per week: | 333 | pop-up "7" |
| Start week on: | 393 | pop-up "Sunday" |
| Scroll in week view by: | 453 | pop-up "Week" |
| separator | 534..535 | x 184..1113 |
| Day starts at: | 577 | pop-up "8:00 AM" |
| Day ends at: | 637 | pop-up "6:00 PM" |
| Show: | 697 | narrow pop-up "12" (x 614..719, 53 pt) + label "hours at a time" |
| separator | 778..779 | |
| Default Calendar: | 821 | pop-up "Selected calendar" |
| separator | 902..903 | |
| [ ] Show Birthdays calendar | 936 | checkbox at x 184 (36 pt from the left edge) |
| [x] Show Holidays calendar | 976 | checkbox (on) |
| separator | 1036..1037 | |
| [ ] Show alternate calendar: + pop-up "Chinese" (disabled) | 1079 | checkbox at x 184; disabled pop-up x ~540..897 |
| Help button | 1079 | x 1105..1144 |

## Components used

`preferences-window`, `preferences-toolbar`, `pop-up-button` (regular, with icon, narrow, disabled),
`checkbox`, `label`, `separator`, `help-button`, `window-controls`, `title-bar`.

## App-specific elements

Toolbar icons: General (light switch), Accounts (blue "@" disc), Alerts (megaphone), Advanced (gear).

## Content in the screenshot

As listed in the row table. Title "General". Toolbar labels "General", "Accounts", "Alerts", "Advanced".

## Not reproducible / assets needed

The four toolbar icons (32 pt) and the 16 pt Calendar app icon in the first pop-up.

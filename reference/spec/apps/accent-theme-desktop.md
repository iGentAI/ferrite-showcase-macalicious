# Accent theme desktop (the 32 "Theme" screenshots)

- **Screenshots:** `10-15-Catalina-Theme-<Variant>-<Accent>.png` for Variant in Morning, Light (captioned "Day"), Evening, Dark and Accent in Blue, Purple (file `10-15-Catalina-Theme-Evening-Purpe.png` for Evening), Pink, Red, Orange, Yellow, Green, Graphite. All 3360 x 2100 px full-screen (1680 x 1050 pt), opaque.
- **Window:** System Preferences, General pane: 668 x 678 pt, unified title bar/toolbar (back/forward, Show All grid button, centred title "General", search field), key window; the System Preferences application menu is open over the desktop.

Every accent-dependent colour is tabulated in `components/accent-colors.md`; the Highlight presets in
`components/highlight-color.md`. This file fixes positions.

## Layout

| Element | Morning / Evening (px) | Light(Day) / Dark (px) | Size pt | Tag |
|---|---|---|---|---|
| Menu bar | y 0..43 | same | 1680 x 22 | [M] |
| Open menu title highlight ("System Preferences", bold) | x 90..403, y 0..43 | same | 157 x 22 | [M] 10-15-Catalina-Theme-Light-Blue.png row 4 |
| Menu | x 90..561, y 44..358 | same | 236 x 157.5 | [M] 10-15-Catalina-Theme-Light-Blue.png row 200 (edges 89/90 and 561/562), col 95 (358/359) |
| Highlighted item ("About System Preferences") | x 90..561, y 52..89 | same | 236 x 19 | [M] col 95 |
| System Preferences window frame | x 970..2305, y 318..1673 | x 978..2313, y 324..1679 | 668 x 678 | [M] 10-15-Catalina-Theme-Morning-Blue.png row 700 / col 1300; 10-15-Catalina-Theme-Light-Blue.png row 700 / col 1200 |
| Window title bar + toolbar | 76 px tall: y 318..393 | y 324..399 | 38 | [M] col 1200: content from y 400 |
| Desktop icons (Macintosh SSD, Time Machine) | top right; measured in `components/desktop-icon.md` and `apps/desktop-and-dock.md` (icon 64 pt, first cell centre 65.25 pt from the right edge and 61.25 pt from the top, pitch 112 pt) | same | | [M] there |
| Dock | bottom centre; measured in `components/dock.md` and `apps/desktop-and-dock.md` | same | | [M] there |

The window is at screen position (485, 159) pt in Morning/Evening and (489, 162) pt in Day/Dark; it is
not centred (screen centre x would put the frame at 506 pt).

Menu items (identical geometry in all 32 files; 19 pt rows, 12 pt separator items with a 2 pt line) [M:
10-15-Catalina-Theme-Light-Blue.png @ 92,100,467,252]:

| Item | y px (row) | Text box px | Shortcut |
|---|---|---|---|
| About System Preferences (highlighted) | 52..89 | from x 134 | |
| separator | 90..113 (line y 100..103) | | |
| Services (submenu arrow at x 520..537) | 114..151 | 133,121 | |
| separator | 152..175 (line y 162..165) | | |
| Hide System Preferences | 176..213 | 134,183 | Command-H at x 499..542 |
| Hide Others | 214..251 | 134,221 | Option-Command-H at x 468..542 |
| Show All (disabled in Morning/Day/Dark) | 252..289 | 134,259 | |
| separator | 290..313 (line y 300..303) | | |
| Quit System Preferences | 314..351 | 133,321 | Command-Q at x 499..544 |

In the eight Evening files "Hide System Preferences" and "Hide Others" are disabled and "Show All" is
enabled instead (other apps were hidden when they were captured) [M: previews; for example
10-15-Catalina-Theme-Evening-Blue.png @ 92,170,467,120].

General pane contents (Day/Dark px; subtract (8, 6) for Morning/Evening, except pop-up widths, see
below). Labels are right-aligned ending x 1459; controls start x 1478..1480 [M:
10-15-Catalina-Theme-Light-Blue.png]:

| Row | y px (top of control) | Control |
|---|---|---|
| Appearance: | 433..526, captions 540..565 | three thumbnails 67 x 44 pt at x 1481, 1653, 1825 with captions "Light", "Dark", "Auto"; selected one has a 1.5 pt accent ring |
| Accent color: | 602..633 | eight 16 pt swatches at 24 pt pitch from x 1480; label starts x 1301 |
| Highlight color: | 661..700 | pop-up x 1479..1776 (149 pt) with 24 x 12 pt colour swatch + preset name |
| Sidebar icon size: | 725..764 | pop-up "Medium", same width (32 pt row pitch) |
| | 782 | checkbox (off) "Automatically hide and show the menu bar" at x 1478 |
| separator | 842..843 | x 1018..2273 (20 pt insets) |
| Show scroll bars: | 878, 918, 958 | radios "Automatically based on mouse or trackpad" (on), "When scrolling", "Always"; 20 pt pitch |
| Click in the scroll bar to: | 1026, 1066 | radios "Jump to the next page" (on), "Jump to the spot that's clicked" |
| separator | 1132..1133 | |
| Default web browser: | 1165..1204 | pop-up, Safari icon + "Safari" (Day/Dark) or "Safari (13.0.2)" (Morning/Evening) |
| separator | 1238..1239 | |
| | 1272, 1312 | checkboxes "Ask to keep changes when closing documents" (off), "Close windows when quitting an app" (on); 20 pt pitch |
| | 1361, 1389 | 11 pt note at x 1519, 2 lines, 14 pt pitch: "When selected, open documents and windows will not be restored when you re-open an app." |
| Recent items: | 1445..1484 | narrow pop-up "10" + "Documents, Apps, and Servers" (label starts x 1298) |
| | 1518 | checkbox (on) "Allow Handoff between this Mac and your iCloud devices" |
| separator | 1578..1579 | |
| | 1612 | checkbox (on) "Use font smoothing when available"; help button x 2233..2272, y 1607..1646 |

All rows [M] from the content layout of `10-15-Catalina-Theme-Light-Blue.png` @ 980,402,1332,1275
(blob boxes: 1308,433; 1301,602; 1278,661; 1249,725; 1478,782; 1018,842; 1480,878; 1480,918; 1480,958;
1480,1026; 1480,1066; 1018,1132; 1206,1165; 1018,1238; 1478,1272; 1478,1312; 1519,1361; 1298,1445;
1478,1518; 1018,1578; 1478,1612; 2233,1607). The authoritative control-level layout of this pane is
group sysA's General blueprint.

Pop-up width: 149 pt in Day/Dark (x 1479..1776), 157 pt in Morning/Evening (actual px x 1471..1784)
because the longer browser title widens the shared control column [M: row 680 of Light-Blue; row 674 of
10-15-Catalina-Theme-Morning-Blue.png].

## What differs between the 32 files

1. **Accent** (8 per variant): menu-bar title and menu item highlight; thumbnail ring and the thumbnail
   artwork's own highlight strip; selected swatch dot; Highlight pop-up swatch and name; all pop-up
   caps; "on" radios and checkboxes; graphite also greys the window's close/minimize buttons and the
   traffic lights drawn inside the thumbnails. Measured in `components/accent-colors.md`.
2. **Variant**: wallpaper (Catalina dynamic desktop at three times of day, and the night image for
   Dark), the vibrant menu bar and menu colours that follow it, menu-bar clock ("Fri 5:37 AM" Morning,
   "Fri 11:29 AM" Day, "Fri 6:41 PM" Evening, "Fri 11:31 AM" Dark), selected Appearance thumbnail
   (Auto in Morning/Evening, Light in Day, Dark in Dark), window position and pop-up width as above.
3. **Stray differences** (capture noise, not theme): a location-services arrow appears at the left of
   the menu-bar extras in the Morning files and in Light-Blue only.
4. **Dark Graphite** differs from the other Dark files across the whole window because graphite turns
   off wallpaper tinting (`#323232` vs `#303032`).

Pixel identity checks [M]: within one variant, files differ only inside the regions listed in 1 (block
diff of every file against the Blue file of its variant); Morning vs Evening windows are identical
except 111..113 corner pixels.

## Components used

`menu-bar` (open title), `menu-bar-extra`, `menu`, `menu-item` (highlighted, disabled, with shortcuts,
separators), `submenu` (arrow), `window`, `title-bar`, `window-controls` (normal and graphite),
`toolbar`, `toolbar-segmented-control` (back/forward), `toolbar-button` (Show All), `toolbar-search-field`,
`color-swatch-picker`, `pop-up-button`, `checkbox`, `radio-button`, `label`, `separator`, `help-button`,
`accent-colors`, `highlight-color`, `desktop`, `desktop-icon`, `dock`, `material`, `window-shadow`.

## App-specific elements

Appearance thumbnails: 67 x 44 pt pictures of a miniature desktop (menu bar strip with an accent
highlight, a window with three dots and a sidebar); "Auto" is split vertically, left half light, right
half dark, with a white divider line.

## Content in the screenshot

Menu bar: Apple, "System Preferences" (bold, open), "Edit", "View", "Window", "Help"; extras: Time
Machine, Wi-Fi, AirPlay, battery (charging), clock, "Stephen", Spotlight, Siri, Notification Center.
Dock (left to right): Finder, Launchpad, Safari, Mail, FaceTime, Messages, Maps, Photos, Contacts,
Calendar ("OCT 4"), Reminders, Notes, Music, Podcasts, TV, News, App Store, System Preferences
(running), separator, a desktop-picture stack/Downloads, Trash. Desktop icons: "Macintosh SSD", "Time
Machine".

## Not reproducible / assets needed

Four wallpapers (Catalina dynamic desktop: morning, day, evening, night), Dock and volume icons, the
appearance thumbnail artwork (or redraw it from primitives using the accent variables).

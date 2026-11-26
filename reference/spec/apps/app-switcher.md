# App Switcher (Command-Tab)
- **Screenshots:** 10-15-Catalina-Light-Command-Tab.png, 10-15-Catalina-Dark-Command-Tab.png
- **Window:** HUD panel 440 x 186 pt (3 apps), radius 20, centred on the 1680 x 1050 pt screen (x=620..1060, y=432..618)

## Layout
| Region | Position / size (pt, screen coordinates) | Light | Dark | Tag | Evidence |
|---|---|---|---|---|---|
| Panel | 620, 432, 440 x 186 | `#e5e5e3` (translucent) | `#45484b (sRGB #44484b)` (translucent) | [M] | 10-15-Catalina-Dark-Command-Tab.png @ 1240,864,880,372 |
| Selection square | 639, 457, 136 x 136, radius 8 | `rgba(0,0,0,0.15)` | `rgba(0,0,0,0.34)` | [M]/[C] | @ 1278,914,272,272 |
| Icons | 128 pt at x=643, 776, 909; y=461 | Terminal, System Preferences, Finder | same | [M]/[C] | @ 1286,922,788,256 |
| Name of the selection | centred under the selected icon, baseline y=611.5 | `#777574` | `#bababa` | [M] | 10-15-Catalina-Light-Command-Tab.png @ 1357,1201,113,22 |

## Components used
`app-switcher`, `material`; behind it: `menu-bar` (Terminal frontmost: Terminal, Shell, Edit, View, Window, Help), `window` x3 (Finder "shackett" inactive, System Preferences inactive, Terminal key), `sidebar`, `icon-view`, `dock` (21 tiles, Terminal appended and running), `desktop-icon`.

## App-specific elements
None.

## Content in the screenshot
Switcher order: Terminal (selected, label "Terminal"), System Preferences, Finder. Background windows: Finder window "shackett" (sidebar Favorites: AirDrop, Recents, Applications, Desktop, Documents, Downloads; iCloud: iCloud Drive; Locations: Time Machine / Macintosh HD, ismhpro, Network; Tags: Blue, Work, Orange, Gray, Green, Home, Red, All Tags...; content header "Shared Folder"; folders Desktop, Documents, Downloads, Movies, Music, Pictures, Public), System Preferences main window, Terminal window "shackett - -zsh - 80x24" with "Last login: Thu Oct  3 10:06:28 on console" and prompt "shackett@ismh15 ~ %".

## Not reproducible / assets needed
App icons at 128 pt (256 px). Command-Tab itself cannot be captured by a web page; bind the demo to another key chord.

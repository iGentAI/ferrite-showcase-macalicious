# System Preferences — Security & Privacy

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png`; `10-15-Catalina-Dark-System-Preferences-Security-and-Privacy.png` [M].
- **Window:** `668 × 573 pt` opaque frame in both, image origin `112,76` [M], each @ 112,76,1336,1146 (`info`). Shared unified chrome: `title-bar`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-segmented-control`, `toolbar-search-field`; title “Security & Privacy”, search “Search” [M]. Reuse chrome, do not remeasure it.
- **State comparison:** identical General tab and locked state [M]. Require password on; lock-screen message off/disabled; automatic login disabled/on; App Store and identified developers selected/disabled; Advanced disabled [M]. Change Password and password-delay popup remain enabled despite the lock [M].

## Layout

```text
+-------------------- shared toolbar -------------------+
|             General FileVault Firewall Privacy        |
| +----------------------------------------------------+|
| | password status / Change Password…                 ||
| | require password [5 minutes] after sleep…           ||
| | message / Set Lock Message… (disabled)             ||
| | disable automatic login (disabled)                 ||
| | ------------------------------------------------- ||
| | Allow apps downloaded from:                        ||
| | two disabled radio choices                         ||
| +----------------------------------------------------+|
| lock / Click the lock…                  Advanced…  ?  |
+-------------------------------------------------------+
```

Rect convention `(x,y,w,h)` is frame-relative pt [M]. E-L = `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png`; E-D = `10-15-Catalina-Dark-System-Preferences-Security-and-Privacy.png` [M]. Colours are stored pixel values [M].

| Region | Rect [M] | Light / dark fill [M] | Evidence E-L/E-D image px |
|---|---|---|---|
| Content / footer | (0,38,668,535) | `#ececec` / `#2f3031` | @ 130,600; @ 112,152,1336,1070 |
| General tab box | (20,73,628,430) | `#e3e3e3` / `#363637`, locally `#e2e2e2` / `#353637` | @ 180,600 and @ 300,950; row 500, col 160; @ 152,222,1256,860 |
| Tab strip, overlapping box top | (193,63,282,21) | tab-view component fills [M] | row 209, col 510; @ 498,202,564,42 |
| Divider | (43,309,582,0.5) | `#cdcdcd` / `#4a4a4b` | @ 200,694; @ 198,694,1164,1 |

## Components used

`tab-view`, `box`, `label`, `push-button`, `checkbox`, `pop-up-button`, `radio-button`, `separator`, `lock-button`, `help-button` [M]. Window is locked, not globally disabled [M].

## Content in the screenshot — complete control table

Every rect and `x/B` (first glyph x / baseline y) is frame-relative pt [M]. Label-only rects are ink extents [M]. R = `13 pt` regular [C], based on cap heights and `label.md`; bold/state as indicated. Control-title baselines inside buttons/popups/tabs inherit component metrics [I].

| Component | Variant / state | Rect [M] | Exact visible text [M]; x/B [M] for standalone/attached labels | Evidence E-L/E-D image px |
|---|---|---|---|---|
| tab-view | regular selected | (193,63,72,21) | General | @ 498,202,144,42 |
| tab-view | regular normal | (265,63,74,21) | FileVault | @ 642,202,148,42 |
| tab-view | regular normal | (339,63,68,21) | Firewall | @ 790,202,136,42 |
| tab-view | regular normal | (407,63,68,21) | Privacy | @ 926,202,136,42 |
| label | R | (82.5,115,260,12.5) | A login password has been set for this user; 82.5/124.5 | @ 277,306,520,25 |
| push-button | regular enabled | (354.5,110.5,146,20) | Change Password… | @ 820,296,294,42; row 302, col 835 |
| checkbox | regular on, R | (108,142,14,14) | Require password; 127/153.5 | @ 328,360,28,28; ink @ 366,364,212,25; col 340 |
| pop-up-button | regular enabled | (241,139.5,105,20) | 5 minutes | @ 593,354,212,42; row 360, col 600 |
| label | R sentence continuation | (354,144,204,12.5) | after sleep or screen saver begins; 354/153.5 | @ 820,364,408,25 |
| checkbox | regular off disabled, R | (108,166,14,14) | Show a message when the screen is locked; 126.5/177.5 | @ 328,408,28,28; ink @ 365,412,522,25 |
| push-button | regular disabled | (393.5,163.5,148,20) | Set Lock Message… | @ 898,402,298,42; row 418, col 912 |
| checkbox | regular on disabled, R | (108,188,14,14) | Disable automatic login; 127/199.5 | @ 328,452,28,28; ink @ 366,456,279,25 |
| label | R | (82.5,329,177,12.5) | Allow apps downloaded from:; 82.5/338.5 | @ 277,734,354,25 |
| radio-button | regular off disabled, R | (108,351,16,16) | App Store; 127.5/363.5 | @ 328,778,32,32; ink @ 367,785,119,24; row 796, col 343 |
| radio-button | regular on disabled, R | (108,373,16,16) | App Store and identified developers; 127.5/385.5 | @ 328,822,32,32; ink @ 367,828,432,25 |
| lock-button | locked, enabled | (25,525,23,27) | lock artwork, no text | @ 162,1126,46,54 |
| label | R secondary | (62,537.5,189.5,12) | Click the lock to make changes.; 62/547 | @ 236,1151,379,24 |
| push-button | regular disabled | (516.5,532.5,98,20) | Advanced… | @ 1144,1140,198,42; row 1155, col 1147 |
| help-button | regular enabled | (627.5,530.5,20,20) | ? | @ 1367,1137,40,40; row 1158, col 1387 (halo excluded) |

### Layout grid

Box margins `20 pt` left/right; top `73 pt`, bottom `503 pt`; tabs centred at window x`334 pt` [C]. Body text starts x`82.5 pt`; check/radio column x`108 pt`; title column x`127 pt`; checkbox title-to-box gap `5 pt` [C]. Require/message top pitch `24 pt`, message/automatic-login pitch `22 pt`, radio top pitch `22 pt` [M], E-L/E-D col 340 y360..480 and col 343 y778..854. Popup delay starts x`241 pt`; sentence continuation x`354 pt`, giving `8 pt` gap after popup right edge `346 pt` [C]. Divider horizontal inset `23 pt` from the box edge [C]. Footer button bottom `552.5 pt`, window bottom margin `20.5 pt`; lock label baseline `547 pt` [C].

## App-specific elements

Locked padlock artwork is warm metallic yellow in both and has a white/grey shackle [M], E-L/E-D @ 162,1126,46,54; use `lock-button` instead of a generic monochrome icon [I]. The disabled automatic-login checkbox retains a checkmark [M]. Radio selection and checkbox selection are distinct grey disabled treatments [M].

### Embedded labels and explicit evidence

First ink x / baseline B are frame-relative pt [M]; regular `13 pt` [C]. Both appearances sampled independently [M]. Disabled Lock Message and Advanced first ink starts `0.5 pt` farther right in dark; other first edges coincide [M]. Rounded push/pop-up rects exclude their external halo [M].

| Label | x / B [M] | Full evidence citation |
|---|---|---|
| General | 207/77.5 | `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 526,213,90,19` |
| FileVault | 277/77.5 | `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 666,212,99,20` |
| Firewall | 350/77.5 | `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 812,212,88,20` |
| Privacy | 418/77.5 | `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 948,212,85,25` |
| Change Password… | 367.5/124.5 | `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 847,306,235,25` |
| 5 minutes | 250/153.5 | `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 612,364,116,20` |
| Set Lock Message… | L 407 / D407.5; B177.5 | `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 926,412,239,25`; dark @ 927,412,238,25 |
| Advanced… | L 530 / D530.5; B545.5 | `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 1172,1149,138,19`; dark @ 1173,1149,137,19 |

Grouped geometry/colour evidence [M]: `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 112,152,1336,1070`; `10-15-Catalina-Dark-System-Preferences-Security-and-Privacy.png @ 112,152,1336,1070`. Every smaller table crop is inside these captured regions [M].

## Not reproducible / assets needed

Catalina padlock artwork is required [I]. Other tabs, unlocking/authentication, password-change dialog, delay menu, lock message sheet, pressed/hover, and inactive-window states are not shown [M]; no unseen content is inferred. SF system font fallback is not guaranteed to reproduce exact glyph widths [I].

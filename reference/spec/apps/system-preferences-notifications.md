# System Preferences — Notifications

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Notifications.png` and `10-15-Catalina-Dark-System-Preferences-Notifications.png` [M].
- **Window:** `668 × 528 pt` opaque frame in both, image origin `112,76` [M], each screenshot @ 112,76,1336,1056 (`info`). Reuse shared `title-bar`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-segmented-control`, `toolbar-search-field`; chrome title “Notifications”, placeholder “Search” [M].
- **Capture differences:** Do Not Disturb is selected in both, with identical settings [M]. Light app rows: Books, Calendar, FaceTime, Games, Home, Mail, Messages, Music; dark: Books, Calendar, FaceTime, Find My, Games, Home, Mail, Maps [M]. These are different app inventories, not a dark-mode reordering rule [I].

## Layout

```text
+------------------- shared toolbar ---------------------+
| Notification Center explanation (two lines)            |
| + app list ----------+ + Do Not Disturb settings ------+|
| | Do Not Disturb     | | heading              preview ||
| | app + subtitle    | | schedule + checkboxes         ||
| | …                 | | calls + explanatory copy     ||
| +-------------------+ +------------------------------+|
| Notification Center sort order: [Recents]           ?  |
+--------------------------------------------------------+
```

Rect notation `(x,y,w,h)` is frame-relative pt [M]. E-L = `10-15-Catalina-Light-System-Preferences-Notifications.png`; E-D = `10-15-Catalina-Dark-System-Preferences-Notifications.png` [M]. Evidence crops below apply to both unless noted; colours are stored pixels [M].

| Region | Rect [M] | Light / dark [M] | Evidence (E-L/E-D image px) |
|---|---|---|---|
| Content/footer | (0,38,668,490) | `#ececec` / `#2f3031` | @ 130,270; @ 112,152,1336,980 |
| App list | (20,110,232,362) | `#ffffff` / `#1d1e1f` | row 480 x152..616; @ 154,800; @ 152,296,464,724 |
| Selected Do Not Disturb | (21,111,230,40) | `#dcdcdc` / `#464646` | col 162 y296..378; @ 160,320 |
| Settings box | (260,110,388,362) | `#e3e3e3` / `#363637` | @ 640,600; row 480, col 640; @ 632,296,776,724 |
| Mini notification-center artwork | (526.5,130,100,55) | asset white in both [M] | row 340 x1165..1365; col 1165 y336..446; @ 1165,336,200,110 |

## Components used

`bordered-list`, `list-view`, `image-view`, `label`, `box`, `checkbox`, `date-picker`, `stepper`, `pop-up-button`, `help-button` [M]. Miniature notification-center image is artwork, not an interactive switch [I], because it is inside an explanatory preview. Shared toolbar is specified in the chrome components, not duplicated here.

## Content in the screenshot — complete control table

All rects and ink positions are [M]. For text, `x/B` is first glyph x / first line baseline in pt relative to the frame [M]. R = `13 pt` regular, S = `11 pt` regular [C], from sampled cap heights and `label.md`. Rects on label rows are measured ink extents; labels attached to controls may extend beyond the control rect [M]. Embedded control-title baselines inherit the referenced component [I].

| Component | Variant/state/type | Rect [M] | Exact visible text [M]; x/B [M] | Evidence E-L/E-D (px) |
|---|---|---|---|---|
| label | R, wrapped | (20.5,61,625,28.5) | Notification Center shows your alerts in the upper-right of your screen, without interrupting what you’re / doing. Show and hide Notification Center by clicking its icon in the menu bar.; 20.5/70.5 | @ 153,198,1250,57 |
| list-view + image-view | selected, R | (21,111,230,40) | Do Not Disturb; 74/136 | @ 154,298,460,80; ink @ 260,329,177,20 |
| list-view + image-view | normal, R/S | (21,151,230,41) | Books; Badges, Sounds, Banners; 74/167.5; subtitle 74/182.5 | @ 154,378,460,82; ink @ 260,393,265,49 |
| list-view + image-view | normal, R/S | (21,192,230,41) | Calendar; Badges, Sounds, Alerts; 73.5/208.5; subtitle 74/223.5 | @ 154,460,460,82; ink @ 259,475,242,49 |
| list-view + image-view | normal, R/S | (21,233,230,41) | FaceTime; Badges, Sounds, Banners; 74/249.5; subtitle 74/264.5 | @ 154,542,460,82 |
| list-view + image-view | normal, R/S | (21,274,230,41) | Light: Games; dark: Find My. Subtitle in both: Badges, Sounds, Banners; light 73.5/290.5, dark 74/290.5; subtitle 74/305.5 | @ 154,624,460,82 |
| list-view + image-view | normal, R/S | (21,315,230,41) | Light: Home; dark: Games. Badges, Sounds, Banners; light 74/331.5, dark 73.5/331.5; subtitle 74/346.5 | @ 154,706,460,82 |
| list-view + image-view | normal, R/S | (21,356,230,41) | Light: Mail; dark: Home. Badges, Sounds, Banners; 74/372.5; subtitle 74/387.5 | @ 154,788,460,82 |
| list-view + image-view | normal, R/S | (21,397,230,41) | Light: Messages; dark: Mail. Badges, Sounds, Banners; 74/413.5; subtitle 74/428.5 | @ 154,870,460,82 |
| list-view + image-view | bottom clipped, R/S | (21,438,230,33) | Light: Music; dark: Maps. Badges, Sounds, Banners; 74/454.5; subtitle 74/469.5 (partly clipped) | @ 154,952,460,66 |
| label | R, wrapped | (280.5,131,152.5,26.5) | Turn on Do Not Disturb in / Notification Center; 280.5/140.5 | @ 673,338,305,53 |
| label | S secondary | (281,171,194,22) | Banners and alerts will be hidden and / notification sounds will be silenced.; 281/178.5 | @ 674,418,388,44 |
| image-view | static preview | (526.5,130,100,55) | miniature Notification Center; no separate pane control text | @ 1165,336,200,110 |
| label | R | (280.5,213,142,10) | Turn on Do Not Disturb:; 280.5/222.5 | @ 673,502,284,20 |
| checkbox | regular off | (292,239,14,14) | From:; 311/250.5 (R) | @ 696,554,28,28; ink @ 734,559,65,19 |
| date-picker | time, regular enabled | (353.5,234.5,65,23) | 10:00 PM | @ 818,545,132,46; col 822 |
| stepper | regular enabled | (422,237,13,21) | up/down glyphs | @ 956,550,26,42; row 565 |
| label | R | (443,242,15,9) | to:; 443/250.5 | @ 998,560,30,18 |
| date-picker | time, regular enabled | (467.5,234.5,65,23) | 7:00 AM | @ 1046,545,132,46 |
| stepper | regular enabled | (536,237,13,21) | up/down glyphs | @ 1184,550,26,42 |
| checkbox | regular on, R | (292,263,14,14) | When the display is sleeping; 310.5/274.5 | @ 696,602,28,28; ink @ 733,606,342,25 |
| checkbox | regular off, R | (292,287,14,14) | When the screen is locked; 310.5/298.5 | @ 696,650,28,28; ink @ 733,654,316,20 |
| checkbox | regular on, R | (292,311,14,14) | When mirroring to TVs and projectors; 310.5/322.5 | @ 696,698,28,28; ink @ 733,702,452,25 |
| label | R | (280.5,342,206.5,10) | When Do Not Disturb is turned on:; 280.5/351.5 | @ 673,760,413,20 |
| checkbox | regular off, R | (292,363,14,14) | Allow calls from everyone; 310.5/374.5 | @ 696,802,28,28; ink @ 733,806,306,25 |
| checkbox | regular off, R | (292,387,14,14) | Allow repeated calls; 310.5/398.5 | @ 696,850,28,28; ink @ 733,854,240,25 |
| label | S secondary, wrapped | (312.5,412,301.5,22) | When enabled, a second call from the same person within / three minutes will not be silenced.; 312.5/419.5 | @ 737,900,603,44 |
| label | R | (21,495,180,10) | Notification Center sort order:; 21/504.5 | @ 154,1066,360,20 |
| pop-up-button | regular enabled | (210.5,490.5,132.5,20) | Recents | @ 532,1056,267,42; row 1080, col 543 |
| help-button | regular enabled | (627.5,491.5,20,20) | ? | @ 1367,1059,40,40; row 1078, col 1387 (halo excluded) |

### Layout grid

List and box top `110 pt`, bottom `472 pt`; leading and trailing window margins `20 pt`; inter-box gap `8 pt` [C] from measured regions. Settings text inset `20.5 pt`, checkbox inset `32 pt` [C]. Checkbox vertical pitch `24 pt` (sleep/locked/mirroring and calls/repeated), body line pitch `16 pt`, secondary line pitch `14 pt`, list app pitch `41 pt` [M], E-L/E-D @ 696,602,28,276; @ 153,198,1250,57; @ 674,418,388,44; @ 260,393,265,623. Footer label right ink edge `201 pt`, popup left `210.5 pt`, gap `9.5 pt`; popup bottom `510.5 pt`, frame bottom margin `17.5 pt` [C]. No lock is present [M].

## App-specific elements

Each app row pairs Catalina application artwork with title and smaller subtitle; Calendar is the JUL 17 icon [M], E-L/E-D @ 178,472,55,63. The dark Games icon has an opaque square white tile unlike the light presentation [M], E-L @ 178,638,55,60; E-D @ 174,716,64,66. The final visible row is clipped by the list edge rather than shortened [M].

### Embedded labels and explicit evidence

First ink x / baseline B in frame pt [M]; R `13 pt` [C]. These complete the date-picker and pop-up text metrics; both appearances were sampled [M].

| Label | x / B [M] | Full evidence citation |
|---|---|---|
| 10:00 PM | 357.5 / 250.5 | `10-15-Catalina-Light-System-Preferences-Notifications.png @ 827,559,115,19` |
| 7:00 AM | 479 / 250.5 | `10-15-Catalina-Light-System-Preferences-Notifications.png @ 1070,559,100,19` |
| Recents | 220 / 504.5 | `10-15-Catalina-Light-System-Preferences-Notifications.png @ 552,1067,94,19` |

Grouped geometry/colour evidence for all preceding tables [M]: `10-15-Catalina-Light-System-Preferences-Notifications.png @ 112,152,1336,980`; `10-15-Catalina-Dark-System-Preferences-Notifications.png @ 112,152,1336,980`. Table crops are narrower subsets of these [M]. Rects exclude the outer control halo; help circle and date-picker borders were independently scanned in both appearances [M].

## Not reproducible / assets needed

Matching Do Not Disturb, Books, Calendar, FaceTime, Find My, Games, Home, Mail, Messages, Music and Maps icons plus the miniature Notification Center preview are required [I]. Keep the preview light in the dark pane [M]. Other app selections, opened date-picker segments, pop-up choices, pressed/hover and inactive-window states are not shown [M]; their unobserved content is not specified. System font fallback may change line wrapping [I].

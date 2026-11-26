# System Preferences — Extensions

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Extensions.png`; `10-15-Catalina-Dark-System-Preferences-Extensions.png` [M].
- **Window:** 668 × 508 pt in both appearances [M]; opaque frame `@ 112,76,1336,1016`. Unified title bar/toolbar: reuse `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field`; do not substitute the app-preferences icon-and-label toolbar [I: different navigation arrangement]. Title is “Extensions” [M].
- **State:** Share Menu selected, same lists and scroll position [M]. Light has a blue dot beside Save to Books; dark does not [M]. Both show that item unchecked and Mail, Messages, AirDrop and Add People checked but disabled [M]. Touch Bar is clipped at the sidebar bottom [M].

## Layout

```text
+ shared navigation / title / Search ----------------+
| Use Apple and third-party extensions ...           |
| + category list + + sharing settings -------------+|
| | Share Menu    | | Select extensions ...          ||
| | selected      | | + checkbox / icon / name list +||
| |               | | |                            |||
| +---------------+ +------------------------------+|
|                                             (?)   |
+---------------------------------------------------+
```

Coordinates below are window-relative pt [C: subtract frame origin 112,76 from image coordinates and divide by 2]. Rectangles exclude shadows. All colours are stored PNG values [M]. Region evidence uses both named screenshots at the same coordinates.

| Region | Rect (x,y,w,h) [M] | Light / dark fill [M] | Evidence (image px) |
|---|---|---|---|
| Pane, including footer | (0,38,668,470) | #ececec / #2f3031 | `10-15-Catalina-Light-System-Preferences-Extensions.png @ 120,180`; `10-15-Catalina-Dark-System-Preferences-Extensions.png @ 120,180` |
| Category list | (20,89,220,363) | #ffffff / #1d1e1f | both screenshots `@ 152,254,440,726`; fill `@ 160,270` |
| Share Menu selection | (21,300,218,42) | #2365d9 (sRGB #0062e1) / #1e5ac9 (sRGB #0057d0) | both `@ 154,676,436,84`; fill `@ 160,690` |
| Sharing group | (248,89,400,363) | #e3e3e3 / #363637 | both `@ 608,254,800,726`; fill `@ 620,270` |
| Extension list | (268,135,360,297) | #ffffff / #1d1e1f | both `@ 648,346,720,594`; fill `@ 660,360` |

List border is 1 pt, #c5c5c5 light / #686869 dark [M], evidenced by `10-15-Catalina-Light-System-Preferences-Extensions.png @ 648,900,2,1` and `10-15-Catalina-Dark-System-Preferences-Extensions.png @ 648,900,2,1`. Group border/radius: reuse `box` [I: this is its tabless variant].

### Layout grid

- Sidebar left/right margins 20 / 428 pt; group left/right margins 248 / 20 pt; inter-region gap 8 pt [C from region rects].
- Sidebar titles start x=32.5–33 pt, secondary labels x=32–33 pt [M]; standard category pitch 42 pt, Finder follows the separator with 52 pt pitch [C from glyph positions below].
- Main label column x=345.5–346 pt; checkbox x=289 pt; artwork leading ink edge x=314–316.5 pt [M]. Rows repeat at 32 pt pitch [C from image y=366,430,…,878].
- Footer help bezel (627,467,20,20) pt [M], both screenshots `@ 1366,1010,42,42`; bottom margin 21 pt [C]. No lock is shown [M].

## Components used

`bordered-list`, `sidebar`, `box`, `checkbox`, `image-view`, `label`, `separator`, `help-button`, plus the shared chrome components above [M].

### Complete control and label table

For text, `ink rect` is visible glyph bounds (not a fabricated hit target); `b` is the raster baseline, measured at the last cap/x-height row, descenders excluded [M]. Font classes are computed using CONVENTIONS cap heights: R=13 pt regular, S=11 pt regular [C]. Rects and baselines are pt. All rows are [M] from the light screenshot at `@ (112+2x),(76+2y),(2w),(2h)`; dark confirms the same control geometry [M]. Secondary text is smaller, not a second selectable row. Sidebar row hit areas span x=21..239 pt [M]. Shared chrome is delegated, not omitted.

| Component / variant / state | Rect or ink rect (x,y,w,h); baseline | Exact visible text |
|---|---|---|
| label / R | (21,61,369,12.5); b=70 | Use Apple and third-party extensions to customize your Mac. |
| sidebar + label / R | (32.5,98.5,13.5,9.5); b=107.5 | All |
| label / S secondary | (32.5,114,131.5,10); b=121.5 | All third-party extensions |
| sidebar + label / R | (32.5,140,44,10); b=149.5 | Actions |
| label / S secondary | (33,156,37.5,10); b=163.5 | Markup |
| sidebar + label / R | (33,182,105.5,10); b=191.5 | Finder Extensions |
| label / S secondary | (33,198,62,8); b=205.5 | iCloud Drive |
| sidebar + label / R | (33,224,85.5,12.5); b=233.5 | Photos Editing |
| label / S secondary | (33,240,37.5,10); b=247.5 | Markup |
| sidebar + label / R | (32.5,266,67,11); b=275.5 | Quick Look |
| label / S secondary | (33,282,91,8); b=289.5 | Mail and 4 more... |
| sidebar + label / R selected | (32.5,308,71,10.5); b=317 | Share Menu |
| label / S selected secondary | (32,323.5,197.5,11); b=331.5 | Add to Reading List, Mail, and 6 mor... |
| sidebar + label / R | (32.5,350.5,35.5,12); b=359.5 | Today |
| label / S secondary | (33,366,137,10); b=373.5 | Calendar, Stocks, Weather |
| separator | (27,388,206,0.5) | — |
| sidebar + label / R | (33,402,37,10); b=411.5 | Finder |
| label / S secondary | (33,418,166.5,8.5); b=425.5 | Quick Actions and Preview Pane |
| sidebar + label / R clipped | (32.5,444.5,60,6.5 visible); baseline clipped | Touch Bar |
| label / R | (268.5,107,249,12.5); b=116 | Select extensions for sharing with others: |
| checkbox / regular enabled on | (289,145,14,14) | Add to Reading List |
| image-view + label / R | artwork ink (314,146,24,10.5); ink (345.5,147,116.5,12.5); b=156 | Add to Reading List |
| checkbox / disabled on | (289,177,14,14) | Mail |
| image-view + label / R | artwork ink (316.5,172.5,21.5,23.5); ink (346,179,23,10); b=188.5 | Mail |
| checkbox / disabled on | (289,209,14,14) | Messages |
| image-view + label / R | artwork ink (315,206,21.5,20.5); ink (346,211.5,59.5,12); b=220.5 | Messages |
| checkbox / disabled on | (289,241,14,14) | AirDrop |
| image-view + label / R | artwork ink (314.5,236.5,23,21.5); ink (345.5,243,45,12.5); b=252 | AirDrop |
| checkbox / enabled on | (289,273,14,14) | Notes |
| image-view + label / R | artwork ink (316.5,268.5,19.5,23); ink (346,275.5,34,9.5); b=284.5 | Notes |
| checkbox / enabled on | (289,305,14,14) | Add to Photos |
| image-view + label / R | artwork ink (314.5,301,23,22.5); ink (345.5,307.5,84.5,9.5); b=316.5 | Add to Photos |
| checkbox / disabled on | (289,337,14,14) | Add People |
| image-view + label / R | artwork ink (314,334,24,21.5); ink (345.5,339.5,68,12); b=348.5 | Add People |
| checkbox / enabled on | (289,369,14,14) | Reminders |
| image-view + label / R | artwork ink (316.5,365,19.5,22.5); ink (346,371,62.5,10); b=380.5 | Reminders |
| checkbox / enabled off | (289,401,14,14) | Save to Books |
| image-view + label / R | artwork ink (315.5,397.5,21.5,21); ink (345.5,403.5,84.5,9.5); b=412.5 | Save to Books |
| help-button / normal | (627,467,20,20) | ? |

## App-specific elements

A 24 pt nominal image canvas is inferred from the widest 48-image-px icon ink and regular row alignment [I]; actual visible ink rectangles are measured individually in the control table [M]: reading glasses, Mail stamp, Messages bubbles, AirDrop rings, Notes paper, Photos flower, Contacts-add person, Reminders sheet and Books disc. Preserve image padding instead of stretching all ink to the nominal canvas [I: preserves the measured row alignment]. Light artwork evidence: `10-15-Catalina-Light-System-Preferences-Extensions.png @ 740,368,48,21`; `@ 745,421,43,47`; `@ 742,488,43,41`; `@ 741,549,46,43`; `@ 745,613,39,46`; `@ 741,678,46,45`; `@ 740,744,48,43`; `@ 745,806,39,45`; `@ 743,871,43,42` [M]. Blue new-item dot in light only: centered near (279,408) pt [M], `10-15-Catalina-Light-System-Preferences-Extensions.png @ 663,885,14,14`; it is not a checkbox or radio button [I: separate marker].

## Content in the screenshot

All visible strings are in the control table [M]. The selected sidebar summary is visibly truncated; do not expand it. There are no visible scrollbars although Touch Bar is clipped [M]. Pressed, focused, mixed and inactive-window states are not shown [M]; use component recipes rather than inventing pane-specific states [I].

## Not reproducible / assets needed

Use separate image assets for the nine share-extension icons [I: system/app artwork cannot be reproduced by native controls]. Typography depends on the installed Catalina SF font; another system font changes ink bounds [I]. Sidebar row metadata and clipped scrolling content are application-specific [M].

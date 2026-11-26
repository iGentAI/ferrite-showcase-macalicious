# System Preferences — Spotlight

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Spotlight.png`; `10-15-Catalina-Dark-System-Preferences-Spotlight.png` [M].
- **Window:** 668 × 597 pt both appearances [M], opaque frame `@ 112,76,1336,1194`. Title “Spotlight”; unified System Preferences navigation shell reuses `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` [I] (common shell; do not use the app-level icon preferences toolbar).
- **State:** Search Results selected in both; all visible category checkboxes and Allow Spotlight Suggestions are on [M]. Same scroll position/content [M]. Privacy contents are not shown [M].

## Layout

```text
+ navigation / Spotlight / Search -----------------------+
| (Spotlight) explanation, two lines                     |
|                    [Search Results|Privacy]            |
| +----------------------------------------------------+|
| | Only selected categories ...                        ||
| | +------------------------------------------------+ ||
| | | ☑ Applications                                 | ||
| | | ☑ Bookmarks & History ... ☑ Music               | ||
| | | ☑ Other (clipped)                               | ||
| | +------------------------------------------------+ ||
| | ☑ Allow Spotlight Suggestions in Look up            ||
| +----------------------------------------------------+|
| [Keyboard Shortcuts...]  [About Search & Privacy...] (?)|
+-------------------------------------------------------+
```

Rect coordinates below are pt relative to the frame [C] (image minus (112,76), divided by 2). All colours are stored channels [M].

| Region | Rect (x,y,w,h) pt [M] | Light / dark background [M] | Evidence |
|---|---|---|---|
| Content and footer | (0,38,668,559) | #ececec / #2f3031 | both `@ 112,152,1336,1118`; samples `10-15-Catalina-Light-System-Preferences-Spotlight.png @ 120,180`, `10-15-Catalina-Dark-System-Preferences-Spotlight.png @ 120,180` |
| Tab content group | (20,122,628,422.5) | #e3e3e3 / #363637 | both `@ 152,320,1256,845`; col x=155 gives top/bottom; fills `@ 170,350` |
| Category viewport including border | (88,171,492,317) | alternating white and off-white / near-black and charcoal | both `@ 288,418,984,634`; row y=420; col x=1267 |
| Odd rows | first (89,172,490,22), repeat every 44 pt | #ffffff / #1d1e1f | both `@ 290,420,980,44`; sample `@ 500,430` |
| Even rows | first (89,194,490,22), repeat every 44 pt | #f3f5f5 / #272829 at cited point | both `@ 290,464,980,44`; sample `@ 500,474`; dithering varies up to 2 channels across row [M] |
| Tab strip | (242,112,184,20) | selected accent / unselected white / dark #636465 | both `@ 596,300,368,40`; row y=306 |

Viewport border stored light #c5c5c5, dark #565656 at image (288,420) [M]. A white partial next row remains beneath Music [M]. There is no visible scrollbar thumb [M].

### Layout grid

Group edge margins 20 pt [M]. Viewport left=88 pt, right=580 pt; caption first glyph x=88.5 pt [M]. Checkbox left=94 pt, checkbox-title first glyph x=115.5..116 pt; category baseline pitch=22 pt [M]. Viewport top border to first checkbox top=5 pt [C]. Suggestions checkbox left=88 pt, its label first glyph x=106.5 pt [M]. Footer Keyboard button x=26 pt, About button x=429 pt, help x=622.5 pt [M]. Footer button top=557.5 pt, bottom=578 pt; bottom frame margin=19 pt [C]. No lock or right-aligned form-label column [M].

## Components used

`image-view`, `label`, `tab-view`, `box`, `scroll-view`, `table-view` (alternating rows), `checkbox`, `push-button`, `help-button`, shared chrome [M].

### Complete control and label table

R=13 pt regular, S=11 pt regular [C] (18 px and 16 px capitals). Geometry [M], pt conversion [C]. `b` gives cap-derived baseline [C]; x gives first glyph [M]. Every rect maps to `10-15-Catalina-Light-System-Preferences-Spotlight.png @ (112+2x),(76+2y),(2w),(2h)` and the corresponding dark rect [M]. Confirmed rows/columns: y=306,420,439,1200,1210, x=155,306,308,455,1267 [M]. Painted dark push-button bezels are inset 0.5 pt [M]; use component appearance recipes.

| Component / variant / state | Rect (x,y,w,h) pt; ink x / b / class | Exact visible text |
|---|---|---|
| image-view / Spotlight artwork | (24,50,50,50) | — |
| label / R introductory line | (86.5,61,540.5,12.5); b=70.5 | Spotlight helps you quickly find things on your computer and shows suggestions from the |
| label / R introductory line | (87,77,446,12.5); b=86.5 | Internet, iTunes, App Store, movie showtimes, locations nearby, and more. |
| tab-view / selected | (242,112,115,20); x=255.5, b=126.5, R | Search Results |
| tab-view / unselected | (357,112,69,20); x=368, b=126.5, R | Privacy |
| label / S | (88.5,151.5,332,10.5); b=159.5 | Only selected categories will appear in Spotlight search results. |
| checkbox / R on, row 1 | (94,176,14,14); x=115.5, b=185.5 | Applications |
| checkbox / R on, row 2 | (94,198,14,14); x=116, b=207.5 | Bookmarks & History |
| checkbox / R on, row 3 | (94,220,14,14); x=116, b=229.5 | Calculator |
| checkbox / R on, row 4 | (94,242,14,14); x=115.5, b=251.5 | Contacts |
| checkbox / R on, row 5 | (94,264,14,14); x=116, b=273.5 | Conversion |
| checkbox / R on, row 6 | (94,286,14,14); x=116, b=295.5 | Definition |
| checkbox / R on, row 7 | (94,308,14,14); x=116, b=317.5 | Documents |
| checkbox / R on, row 8 | (94,330,14,14); x=116, b=339.5 | Events & Reminders |
| checkbox / R on, row 9 | (94,352,14,14); x=116, b=361.5 | Folders |
| checkbox / R on, row 10 | (94,374,14,14); x=116, b=383.5 | Fonts |
| checkbox / R on, row 11 | (94,396,14,14); x=116, b=405.5 | Images |
| checkbox / R on, row 12 | (94,418,14,14); x=116, b=427.5 | Mail & Messages |
| checkbox / R on, row 13 | (94,440,14,14); x=116, b=449.5 | Movies |
| checkbox / R on, row 14 | (94,462,14,14); x=116, b=471.5 | Music |
| checkbox / on, clipped next row | visible top (94,484,14,3); title ink starts x=116.5, y=484.5; baseline outside viewport [M] | Other [I] (completion of visibly clipped word; only upper glyph strokes are captured) |
| checkbox / R on | (88,508,14,14); x=106.5, b=519 | Allow Spotlight Suggestions in Look up |
| push-button / regular normal | (26,557.5,160,20.5); x=41, b=570.5, R | Keyboard Shortcuts... |
| push-button / regular normal | (429,557.5,181,20.5); x=443, b=570.5, R | About Search & Privacy... |
| help-button / normal | (622.5,557.5,20,20) | ? |

## App-specific elements

Spotlight circular blue magnifier artwork occupies 50 × 50 pt at (24,50) [M], image `@ 160,176,100,100`; row y=225 confirms painted diameter x=160..259 [M]. Its lens/rim is artwork rather than the search-field template glyph [M]. Intro line pitch=16 pt [M]. List uses integral row heights, not independently spaced checkboxes [I] (repeated stripe and checkbox pitch coincide).

## Content in the screenshot

Exact pane strings and visible list items appear above [M]. Both captures have the same list clipping [M]. Categories below the partial Other row, Privacy content, shortcut dialog, about dialog and menus are not shown [M]. Focus/pressed/hover/inactive states are not captured [M].

## Not reproducible / assets needed

Need Spotlight icon artwork plus shared chrome glyphs [M]. Browser controls can model category selection but cannot change the Mac's Spotlight indexing or online suggestion policy [I] (these are operating-system preferences). Off-platform font rasterization may differ [I].

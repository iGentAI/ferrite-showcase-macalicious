# System Preferences — Language & Region

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Language-and-Region.png`; `10-15-Catalina-Dark-System-Preferences-Language-and-Region.png` [M].
- **Window:** 668 × 517 pt, both [M]; opaque frame `@ 112,76,1336,1034`. Title “Language & Region” [M]. Unified shell uses `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` [I: shared System Preferences chrome].
- **State/content:** General tab selected in both; English primary language, United States region, Sunday first day, Gregorian calendar, 24-Hour Time unchecked, Fahrenheit temperature [M]. Date/time examples differ: light Thursday October 3, dark Friday October 4; exact strings below [M].

## Layout

```text
+ navigation / Language & Region / Search --------------+
| [flag] Language & Region preferences control ...      |
|                        [General|Apps]                |
| +---------------------------------------------------+|
| | Preferred languages: |       Region: [US       ↕]  ||
| | + English ---------+ |First day ...: [Sunday   ↕]  ||
| | | Primary          | |     Calendar: [Gregorian↕]  ||
| | |                  | |  Time format: □ 24-Hour ... ||
| | |                  | |  Temperature:[°F ...   ↕]  ||
| | |                  | |                            ||
| | +------------------+ |       formatting examples  ||
| | | + | − |          | |                            ||
| +---------------------------------------------------+|
|               [Keyboard Preferences...] [Advanced] (?)|
+------------------------------------------------------+
```

All positions are pt relative to frame origin (112,76), divide image pixel offsets by 2 [C]. Colours are stored values [M].

| Region | Rect (x,y,w,h) [M] | Light / dark fill [M] | Evidence |
|---|---|---|---|
| Pane/header/footer | (0,38,668,479) | #ececec / #2f3031 | both `@ 112,152,1336,958`; samples `10-15-Catalina-Light-System-Preferences-Language-and-Region.png @ 120,180`, `10-15-Catalina-Dark-System-Preferences-Language-and-Region.png @ 120,180` |
| Tab content group | (20,117,628,347) | #e3e3e3 / #363637 | both `@ 152,310,1256,694`; sample `@ 910,820`; column x=160, image y=310..1003 |
| Tab strip | (270.5,107.5,127,20) | accent selected; #ffffff / #636465 unselected | both `@ 653,291,254,40` |
| Preferred languages list | (40,158,200,251) | #ffffff / #1d1e1f | both `@ 192,392,400,502`; fill `@ 200,850` |
| Add/remove strip | (40,409,200,20) | #f8f8f8 / #3c3c3c at row centre | both `@ 192,894,400,40`; sample `@ 400,910`; top border y=892..893 |

### Layout grid

Group margins 20 pt; language list inset 20 pt within group [C]. Setting labels right edge x=383 pt; popup left x=396 pt (13 pt gap); popup right x=600 pt, leaving 48 pt to group edge [C from glyph/control rects]. Four settings rows have 31 pt pitch, including the unboxed checkbox row [C: image y=401,463,525,587,649]. List labels x=49 pt; title x=41 pt [M]. Footer buttons sit 15 pt below group bottom and 20 pt above window bottom [C]. Help right inset 21 pt [C]. No lock [M].

## Components used

`image-view`, `label`, `tab-view`, `box`, `bordered-list`, `gradient-button`, `pop-up-button`, `checkbox`, `push-button`, `help-button`, shared shell [M].

### Complete control and label table

Visible ink rectangles for text; bezel rectangles for controls, in pt [M]. `b` is the raster baseline excluding descenders [M]. R=13 pt regular; S=11 pt regular [C from 18/16 px capitals and CONVENTIONS]. Evidence for every row is the light filename above `@ (112+2x),(76+2y),(2w),(2h)`; corresponding dark region confirms alignment except changing example text widths and the normal 0.5 pt dark bezel inset [M]. Text within popups has first glyph x=405 pt [M].

| Component / variant / state | Rect (x,y,w,h); ink / b | Exact visible text |
|---|---|---|
| image-view / pane flag | (23.5,57.5,41,37) | globe flag artwork |
| label / R line one | (89,62,555,12.5); b=71 | Language & Region preferences control the language you see in menus and dialogs, and the |
| label / R line two | (88,78,240,12.5); b=87 | formats of dates, times, and currencies. |
| tab-view / R selected | (270.5,107.5,71.5,20); first glyph x=284, b=121.5 | General |
| tab-view / R unselected | (342,107.5,55.5,20); ink (353.5,112.5,30,12), b=121.5 | Apps |
| label / R | (41,138,124.5,12.5); b=147 | Preferred languages: |
| bordered-list / primary row, unselected | allocation (41,159,198,38) | English |
| label / R | (49,164,42,12.5); b=173 | English |
| label / S secondary | (49,181,120.5,10); b=188.5 | English (US) — Primary |
| label / R right-aligned | (342.5,167.5,40,12.5); b=176.5 | Region: |
| pop-up-button / regular normal | light (396.5,162.5,203,20), dark (397,163,202,19); ink (405.5,167,80.5,10), b=176.5 | United States |
| label / R right-aligned | (281.5,198.5,101.5,12.5); b=207.5 | First day of week: |
| pop-up-button / regular normal | light (396.5,193.5,203,20), dark (397,194,202,19); ink (405,198.5,44,12), b=207.5 | Sunday |
| label / R right-aligned | (329.5,229.5,53.5,10.5); b=239 | Calendar: |
| pop-up-button / regular normal | light (396.5,224.5,203,20), dark (397,225,202,19); ink (405,229,58,12.5), b=238.5 | Gregorian |
| label / R right-aligned | (310,260.5,73,10); b=270 | Time format: |
| checkbox / regular off | (396,258.5,14,14); ink (414.5,260.5,83.5,10), b=270 | 24-Hour Time |
| label / R right-aligned | (306.5,292,76,12); b=301 | Temperature: |
| pop-up-button / regular normal | light (396.5,286.5,203,20), dark (397,287,202,19); ink (405.5,291,95.5,10), b=300.5 | °F — Fahrenheit |
| label / S tertiary example | light (317.5,386,246,10), dark (326,385.5,230,10.5); b=393.5 | light: Thursday, October 3, 2019 at 10:43:31 AM CDT; dark: Friday, October 4, 2019 at 10:24:27 AM CDT |
| label / S date example | light (328.5,400,93,10), dark (329,399.5,93,10.5); b=407.5 | light: 10/3/19, 10:43 AM; dark: 10/4/19, 10:24 AM |
| label / S number example | (439.5,400,44,10); b=407.5 | 1,234.56 |
| label / S currency example | (501.5,399.5,51,10.5); b=407.5 | $4,567.89 |
| gradient-button / small add normal | (40,409,25,20) | + |
| gradient-button / small remove disabled | (65,409,24,20) | − |
| push-button / regular normal | light (331.5,476.5,172,20), dark same allocated rect; ink (346,481,142,12.5), b=490 | Keyboard Preferences... |
| push-button / regular normal | light (516.5,476.5,98,20), dark same allocated rect; ink (530,481.5,69,9.5), b=490.5 | Advanced... |
| help-button / normal | (627,476,20,20) | ? |

Control evidence: popup row y=404, x=904..1311; col x=910 gives light y=401..440, dark y=402..439 [M]. Checkbox column x=908, y=593..620 light / y=593..620 dark [M]. Tab divider at image x=796 [M]. Add/remove row y=910 has separators x=240..241 and x=288..289 [M]. Footer row y=1034 spans image x=775..1118 and 1145..1340; col x=780 gives y=1029..1068 [M].

## App-specific elements

The blue globe-on-flag pane icon (with flagpole) is custom 41 × 37 pt ink [M], both `@ 159,191,82,74`; retain the pole instead of substituting a square emoji [I]. Preferred-language cell has two text lines with 17 pt pitch [C], no selection highlight [M]. Formatting examples are centered collectively below settings, not editable text fields [I: no field border and tertiary text rendering]. They intentionally use dates from different captures [M].

## Content in the screenshot

All exact strings, punctuation and changing examples appear in the table [M]. Apps tab content, add-language sheet, Advanced formatting panel, keyboard preferences destination and popup menus are not shown [M]. Pressed, focused and inactive pane states are not shown [M].

## Not reproducible / assets needed

Requires globe/flag pane icon [I: custom artwork]. Underlying locale formatting rules and live clock cannot be reconstructed from one observed example per appearance [I]; reproduce the listed capture data, not fabricated current timestamps. Font rasterization is platform-dependent [I].

# System Preferences — Keyboard

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Keyboard.png`; `10-15-Catalina-Dark-System-Preferences-Keyboard.png` [M].
- **Window:** 668 × 581 pt in both [M]; opaque frame `@ 112,76,1336,1162`. Title “Keyboard”; unified navigation toolbar reuses `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` [M/I: shared shell, no pane-specific chrome].
- **State:** Keyboard tab selected in both. Same slider positions and options, including checked brightness adjustment and Show Control Strip, unchecked timed backlight and viewers [M]. Dark control fills look muted but are not evidence of disabled controls [I: standard dark rendering].

## Layout

```text
+ navigation / Keyboard / Search ------------------------+
|       [Keyboard|Text|Shortcuts|Input Sources|Dictation] |
| +----------------------------------------------------+|
| |       Key Repeat           Delay Until Repeat       ||
| |       ──────▼─             ───▼──────                ||
| |       Off Slow Fast        Long Short               ||
| | ☑ Adjust keyboard brightness ...                   ||
| | □ Turn keyboard backlight off after [5 secs] ...    ||
| | Touch Bar shows [App Controls] ☑ Show Control Strip ||
| | Press Fn key to [Show F1, F2, etc. Keys]             ||
| | □ Show keyboard and emoji viewers ...              ||
| |             [Customize Control Strip...] [Modifier] ||
| +----------------------------------------------------+|
|                     [Set Up Bluetooth Keyboard...] (?)|
+-------------------------------------------------------+
```

Coordinates are pt relative to the frame [C: subtract 112,76 and halve]. Stored colours [M].

| Region | Rect (x,y,w,h) pt [M] | Light / dark fill [M] | Evidence |
|---|---|---|---|
| Pane and footer | (0,38,668,543) | #ececec / #2f3031 | both screenshot frames `@ 112,152,1336,1086`; samples `10-15-Catalina-Light-System-Preferences-Keyboard.png @ 120,180`, `10-15-Catalina-Dark-System-Preferences-Keyboard.png @ 120,180` |
| Tab content box | (20,73,628,451.5) | #e3e3e3 / #363637 | both `@ 152,222,1256,903`; background sample `@ 200,450`; column x=160 gives y=222..1124 |
| Tab strip | (136.5,63,396,20) | selected accent / unselected #ffffff / dark #636465 | both `@ 385,202,792,40`; component `tab-view` supplies gradient and border |

Group corner pixels near `@ 160,240` are #e4e4e4 / #353637 [M]; do not sample this near-edge antialias as the flat fill. Reuse `box` and `tab-view` edges [I: matching library variants].

### Layout grid

Group edge margins 20 pt [M]. Main checkbox column x=88 pt, label column x=106.5 pt [M]. Touch Bar and Fn labels start x=88.5/89 pt, but their right edges differ; corresponding popup left edges x=199.5 and 189 pt [M], not one universal right-aligned column. Slider centres x=213.5 and 454 pt [C from tracks]. Slider track top y=141.5 pt, label baselines y=123 pt and tick-label baselines y=169.5 pt [M]. Button row near group bottom has 6.5 pt inter-button gap and 20 pt right inset [C]. Footer Setup button is 9 pt from help; footer control row is about 18 pt below group bottom [C]. No lock [M].

## Components used

`tab-view`, `box`, `slider` (linear with pointed thumb/ticks), `checkbox`, `pop-up-button`, `push-button`, `help-button`, `label`, shared chrome [M].

### Complete control and label table

Rectangles are visible bezel/track allocation or label ink, pt [M]; `b` is raster baseline, excluding descenders [M]. R=13 pt regular, S=10 pt regular [C from 18/14 px capitals]. Evidence for each row: `10-15-Catalina-Light-System-Preferences-Keyboard.png @ (112+2x),(76+2y),(2w),(2h)` and equivalent dark region [M]; dark agrees within 0.5 pt on painted control edges [M]. Where control glyphs sit within a bezel, first glyph x and b are also supplied.

| Component / variant / state | Rect (x,y,w,h); ink / b | Exact visible text |
|---|---|---|
| tab-view / R selected | (136.5,63,81.5,20); first glyph x=150, b=77.5 | Keyboard |
| tab-view / R unselected | (218,63,49,20); ink (229.5,68.5,24,9.5), b=77.5 | Text |
| tab-view / R unselected | (267,63,82,20); ink (277.5,68.5,58,9.5), b=77.5 | Shortcuts |
| tab-view / R unselected | (349,63,106,20); ink (360,68.5,82,12), b=77.5 | Input Sources |
| tab-view / R unselected | (455,63,77.5,20); ink (466,68,52.5,10), b=77.5 | Dictation |
| label / R | (180,113.5,66.5,12); b=123 | Key Repeat |
| label / R | (399,113,109.5,12.5); b=122.5 | Delay Until Repeat |
| slider / regular ticked, thumb near Fast | track (139,141.5,148,2); thumb (252.5,136.5,16,19) | — |
| label / S endpoint | (138,162.5,15,7.5); b=169.5 | Off |
| label / S endpoint | first glyph x=159, b=169.5 | Slow |
| label / S endpoint | (271,163,19,7); b=169.5 | Fast |
| slider / regular ticked, thumb near Long | track (380,141.5,148,2); thumb (432.5,136.5,16,19) | — |
| label / S endpoint | (375,163,22,9); b=169.5 | Long |
| label / S endpoint | (506,162.5,26,7.5); b=169.5 | Short |
| checkbox / regular on | (88,202,14,14); ink (106.5,204,233,12.5), b=213 | Adjust keyboard brightness in low light |
| checkbox / regular off | (88,228,14,14); ink (106.5,230,198,12.5), b=239 | Turn keyboard backlight off after |
| pop-up-button / regular normal | light (311.5,225.5,80,20), dark (312,226,79,19); ink (321,230.5,38,9.5), b=239.5 | 5 secs |
| label / R | (398.5,230,69.5,12.5); b=239 | of inactivity |
| label / R | (88.5,273,101.5,10); b=282.5 | Touch Bar shows |
| pop-up-button / regular normal | light (199.5,268.5,173,20), dark (200,269,172,19); ink (208.5,273.5,78,12), b=282.5 | App Controls |
| checkbox / regular on | (388,271,14,14); ink (407,273.5,112.5,12.5), b=282.5 | Show Control Strip |
| label / R | (89,304,90.5,12.5); b=313 | Press Fn key to |
| pop-up-button / regular normal | light (189,299.5,167,20), dark (189.5,300,166,19); ink (198,304.5,133.5,12), b=313.5 | Show F1, F2, etc. Keys |
| checkbox / regular off | (88,346,14,14); ink (106.5,348,278.5,12.5), b=357 | Show keyboard and emoji viewers in menu bar |
| push-button / regular normal | light (312.5,484,182,20), dark (313,484.5,181,19); ink (326,488.5,153,12.5), b=497.5 | Customize Control Strip... |
| push-button / regular normal | light (507.5,484,120,20), dark (508,484.5,119,19); first glyph x=521.5, b=497.5 | Modifier Keys... |
| push-button / regular normal | light (409.5,543,202,20), dark (410,543.5,201,19); ink (423,547.5,173,12), b=556.5 | Set Up Bluetooth Keyboard... |
| help-button / normal | (625,542.5,20,20) | ? |

Slider evidence: both row y=360, x=385..695 and x=865..1175; thumb column x=632, y=349..388 [M]. Painted thumb edges/falloff below it differ between appearances [M]; use `slider` recipe, not a rectangular knob. Track repeats ticks: Key Repeat image x=404,442,480,518,556,594,632,670; Delay image x=884,937,992,1046,1100,1154 [M], each tick approximately 1 × 4 pt [M], image y=381..388. The selected position itself is a screenshot observation, not a recovered underlying integer setting [I].

## App-specific elements

No large pane artwork [M]. Touch Bar options and Fn popup are application-specific text [M]; the actual hardware Control Strip editor is not shown [M]. The large blank lower half is deliberate [M]; do not collapse the group to content height [I: measured bottom remains y=524.5 pt].

## Content in the screenshot

All visible tabs, controls, slider labels and footer strings are transcribed above [M]. Other tabs’ contents, popup menus, modifier-key dialog and Bluetooth setup flow are not shown [M]. Focused, pressed, disabled and inactive pane states are not captured [M].

## Not reproducible / assets needed

No custom image assets beyond shared shell icons and slider glyphs [M]. Hardware-side brightness and Touch Bar behavior cannot be inferred from static pixels [I]; the demo can reproduce controls but not macOS device configuration. Font rasterization remains platform dependent [I].

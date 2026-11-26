# System Preferences — Mouse

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Mouse.png`; `10-15-Catalina-Dark-System-Preferences-Mouse.png` [M].
- **Window:** 668 × 512 pt, both [M], opaque frame `@ 112,76,1336,1024`. Title “Mouse” [M]; shared unified navigation toolbar uses `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` [I: shared shell].
- **State:** Point & Click selected in both; natural scrolling on, Secondary click off, Smart zoom off, tracking slider near Slow, battery 100% [M]. Natural-scroll row is highlighted with a pointed callout in both [M]. Instructional preview differs in its embedded desktop/window appearance, not in the pane option state [M].

## Layout

```text
+ navigation / Mouse / Search -------------------------+
|                  [Point & Click|More Gestures]        |
| +---------------------------------------------------+|
| | > ☑ Scroll direction: Natural   + preview -------+ ||
| |     Content tracks ...         | Safari / desk   | ||
| |   □ Secondary click            |                 | ||
| |     Click on right side v      | white mouse     | ||
| |   □ Smart zoom                 |                 | ||
| |     Double-tap ...             +-----------------+ ||
| |          Tracking speed                           ||
| |          ───▼──────   Slow / Fast                 ||
| +---------------------------------------------------+|
| Mouse battery level: [charging] 100% [Setup Mouse] (?) |
+------------------------------------------------------+
```

Coordinates are frame-relative pt [C: image offsets from 112,76 divided by 2]; colours are stored PNG values [M].

| Region | Rect (x,y,w,h) pt [M] | Light / dark fill [M] | Evidence |
|---|---|---|---|
| Pane/footer | (0,38,668,474) | #ececec / #2f3031 | both screenshots `@ 112,152,1336,948`; samples `10-15-Catalina-Light-System-Preferences-Mouse.png @ 120,180`, `10-15-Catalina-Dark-System-Preferences-Mouse.png @ 120,180` |
| Tab content group | (20,60,628,392) | #e3e3e3 / #363637 | both `@ 152,196,1256,784`; sample `@ 160,200`; column x=160 gives y=196..979 |
| Tab strip | (227.5,50.5,214,20) | accent selected; #ffffff / #636465 unselected | both `@ 567,177,428,40` |
| Natural-scroll callout | bounding rect (30,87,311,53) | #f0f0f0 / #676768 | both `@ 172,250,622,106`; fill `@ 180,260`; tip at `@ 793,302` |
| Instructional preview | (376,106,236,301) | image, not a flat fill | both `@ 864,288,472,602`; photographic sample light/dark `@ 880,590` = #d4c6b2 (sRGB #d7c6b0) |

### Layout grid

Group margins 20 pt; option checkbox x=39 pt; first glyph x=65.5 pt; checkbox-to-label gap 12.5 pt [C from controls below]. Option row pitch 50 pt [C: checkbox y=288,388,488 image px]. Left option allocation reaches the callout tip x=341 pt; preview left x=376 pt gives 35 pt gap [C]. Slider centre x=165.5 pt [C from track endpoints]; heading baseline y=301 pt [M]. Footer has left label x=20.5 pt and setup button right margin 48.5 pt, help right margin 16 pt [C]. No lock, right-aligned label column or sidebar [M].

## Components used

`tab-view`, `box`, `checkbox`, `label`, `pop-up-button` (borderless small secondary-click choice), `slider`, `image-view`, `push-button`, `help-button`; battery illustration and row callout are custom [M]. Shared shell components are delegated [I].

### Complete control and label table

Pt geometry [M]; labels use visible glyph bounds, controls painted bezel/track rectangles. `b` is raster baseline excluding descenders [M]. R=13 pt regular, S=11 pt regular, T=10 pt regular [C from 18/16/14 image-px capitals, CONVENTIONS]. Every row cites `10-15-Catalina-Light-System-Preferences-Mouse.png @ (112+2x),(76+2y),(2w),(2h)` and its dark counterpart [M]. Control positions match in dark, with 0.5 pt insets for dark painted bezels [M].

| Component / variant / state | Rect (x,y,w,h); ink / b | Exact visible text |
|---|---|---|
| tab-view / R selected | (227.5,50.5,100.5,20); ink (241,55,75.5,10), b=64.5 | Point & Click |
| tab-view / R unselected | (328,50.5,113.5,20); ink (340,55.5,87.5,9.5), b=64.5 | More Gestures |
| checkbox / regular on, row highlighted | (39,106,14,14); ink (65.5,98,141,10.5), b=107.5 | Scroll direction: Natural |
| label / S secondary | (65.5,115.5,168,10.5); b=123 | Content tracks finger movement |
| checkbox / regular off | (39,156,14,14); ink (65.5,148,95.5,12.5), b=157 | Secondary click |
| pop-up-button / small borderless, inactive choice | ink (65.5,165.5,95.5,10); chevron near x=164.5, b=173 | Click on right side |
| checkbox / regular off | (39,206,14,14); ink (65.5,198.5,72,10), b=208 | Smart zoom |
| label / S secondary | (66,215.5,139.5,11); b=223 | Double-tap with one finger |
| label / R centered over slider | (119.5,292,91,12.5); b=301 | Tracking speed |
| slider / regular ticked, near Slow | track (93.5,315.5,144,2); thumb (136.5,310.5,16,19) | — |
| label / T endpoint | (91.5,338.5,22,8); b=345.5 | Slow |
| label / T endpoint | (223,338.5,19,7.5); b=345.5 | Fast |
| image-view / instructional preview | (376,106,236,301) | embedded video frame; artwork text is not pane UI |
| label / R footer | (20.5,477.5,120.5,12); b=486.5 | Mouse battery level: |
| image-view / charging battery | (148,477,23,12) | charging lightning glyph |
| label / R footer | (178.5,477.5,32,9.5); b=486.5 | 100% |
| push-button / regular normal | light (434.5,471.5,185,20), dark same allocation; ink (448.5,476,156.5,12.5), b=485 | Set Up Bluetooth Mouse... |
| help-button / normal | (632,471,20,20) | ? |

Secondary choice is grey in both captures [M]; treating it as disabled while Secondary click is off is inferred [I: parent option unchecked]. Checkbox column x=193 gives painted boundaries y=288..315,388..415,488..515 [M]. Slider row y=710 and thumb column x=399 give track image x=299..586 and thumb y=697..736 [M]. Slider ticks at image x=313,342,370,399,428,456,485,514,542,571, y=729..736 [M], approximately 1 × 4 pt each [M]. Setup button probe row y=1024 x=981..1350, column x=987 y=1019..1058 [M].

## App-specific elements

Natural-scroll callout uses a rounded rectangular left body with a right-pointing tip [M]. Polygon straight-edge vertices in window-relative pt: (30,87), upper right shoulder approximately (316.5,87), tip (340.5,113), lower shoulder approximately (316.5,139.5), left bottom (30,139.5) [C from boundary runs `@ 172,250`, `@ 744,250`, `@ 793,302`, `@ 744,355`]. Use rounded left corners and the `box`-like thin light border; dark fill has no high-contrast outline [I: matching observed edge treatment]. The checkbox is vertically centered in the two-line highlighted option, not aligned with the primary text baseline [M].

The preview is a captured tutorial frame showing a web browser, Dock, wood tabletop and white Magic Mouse [M]. Light/dark images have different miniature window/menu-bar chrome, while the photographic mouse remains similar [M], e.g. `@ 880,310` = #4f5475 (sRGB #4e5378) light / #2d344b (sRGB #2c344d) dark; `@ 1000,850` = #c7b99e (sRGB #cab99b) light / #c7b99f (sRGB #cab99c) dark. Its shadow must remain outside the 236 × 301 pt image rect [M]. Use the image asset rather than rebuilding the tiny embedded page text as pane controls [I].

## Content in the screenshot

All pane strings, states and battery data are transcribed above [M]. More Gestures contents, secondary-click menu, Bluetooth setup, animation sequence, focus/pressed and inactive-window states are not shown [M]. The preview’s tiny embedded page is incidental image content [I], not additional interactive preferences controls.

## Not reproducible / assets needed

Requires one tutorial frame per appearance and charging-battery glyph [I: custom images]. Device battery polling and actual mouse configuration cannot be implemented by a normal web page [I]. Animation cannot be recovered from static captures [I]; use the captured still rather than inventing motion.

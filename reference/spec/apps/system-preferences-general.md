# System Preferences — General

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-General.png`; `10-15-Catalina-Dark-System-Preferences-General.png` [M].
- **Window:** 668 × 678 pt in both [M], opaque frame `@ 112,76,1336,1356`. Unified title/navigation toolbar: reuse `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` [I: shared shell]. Title “General” [M].
- **State differences:** Light appearance selected in light; Dark selected in dark. Browser popup reads “Safari” in light and “Safari (13.0.2)” in dark. Highlight, sidebar-size and browser popup arrow columns are 8 pt farther right in dark; their painted widths are 149 pt light / 156 pt dark. Recent items is unchanged. Other settings and content match [M].

## Layout

```text
+ navigation / General / Search ---------------------+
|         Appearance: [Light] [Dark] [Auto]           |
|       Accent color: ○ ○ ○ ○ ○ ○ ○ ○                |
|    Highlight color: [Blue           ↕]             |
|  Sidebar icon size: [Medium         ↕]             |
|                     □ Automatically hide ...      |
| ------------------------------------------------- |
|   Show scroll bars: ◉ Automatically ...            |
|                     ○ When scrolling   ○ Always   |
| Click in scroll...: ◉ Jump ...   ○ Jump ...         |
| ------------------------------------------------- |
| Default web browser:[Safari         ↕]             |
| ------------------------------------------------- |
|                     □ Ask ...  ☑ Close ...         |
|                     explanatory text              |
|       Recent items: [10 ↕] Documents, Apps, ...     |
|                     ☑ Allow Handoff ...            |
| ------------------------------------------------- |
|                     ☑ Use font smoothing ...  (?)  |
+---------------------------------------------------+
```

| Region | Rect (x,y,w,h) pt [M] | Light / dark fill [M] | Evidence |
|---|---|---|---|
| Entire pane | (0,38,668,640) | #ececec / #2f3031 | `10-15-Catalina-Light-System-Preferences-General.png @ 120,180`; `10-15-Catalina-Dark-System-Preferences-General.png @ 120,180`; body extent both `@ 112,152,1336,1280` |
| Appearance/settings block | (20,46,628,213) | same pane fill | both `@ 152,168,1256,426` |
| Scroll settings block | (20,260,628,144) | same pane fill | both `@ 152,596,1256,288` |
| Browser row | (20,405,628,52) | same pane fill | both `@ 152,886,1256,104` |
| Document/recent/Handoff block | (20,458,628,169) | same pane fill | both `@ 152,992,1256,338` |
| Font-smoothing/footer | (20,628,628,50) | same pane fill | both `@ 152,1332,1256,100` |

Block rects divide the pane at separator rows rather than imply independent boxes [I]. Window-relative positions subtract (112,76) and halve [C].

### Layout grid

Right-aligned label ink ends at image x=587, or window x=237.5 pt; control left x=250 pt, giving 12.5 pt label/control gap [C]. Checkbox text starts x=268.5 pt, radio text x=270.5 pt [M]. Popup row pitch 32 pt; radio row pitch 20 pt; checkbox document-row pitch 20 pt [C from table]. Separators span x=20..648 pt and are 1 pt tall, light #d5d5d5 / dark #434445 [M], both screenshots `@ 155,594,1,2`, `@ 155,884,1,2`, `@ 155,990,1,2`, `@ 155,1330,1,2`. Help is (627,642,20,20) pt, 21 pt right and 16 pt bottom inset [C]. No lock, sidebar, tab strip or enclosing group box [M].

## Components used

`image-button`, `image-view`, `accent-colors`, `highlight-color`, `pop-up-button`, `checkbox`, `radio-button`, `label`, `separator`, `help-button`; shared chrome components above [M].

### Complete control and label table

All geometry below is pt [M], window-relative [C]. Labels use visible ink rectangles; `b` gives the raster baseline (cap/x-height bottom; excludes descenders) [M]. R=13 pt regular, S=11 pt regular [C from 18/16 px cap heights, CONVENTIONS]. Evidence for each row is `10-15-Catalina-Light-System-Preferences-General.png @ (112+2x),(76+2y),(2w),(2h)` and its dark counterpart [M]. Dark rect overrides are explicit; otherwise geometry matches [M]. For checkbox/radio rows the label rect follows the control rect, so no visible copy is omitted.

| Component / size / state | Rect (x,y,w,h); label ink / b | Exact text |
|---|---|---|
| label / R | (165.5,87.5,72,12); b=96.5 | Appearance: |
| image-button + label / R, light selected in light | selected outline (250,54.5,70,47); art (251,56,68,44); ink (270.5,108,29,12.5), b=117 | Light |
| image-button + label / R, dark selected in dark | selected outline (336,54.5,70,47); art (337,56,68,44); ink (358,108,27,10), b=117.5 | Dark |
| image-button + label / R unselected | art (423,56,68,44); ink (443.5,108.5,27,9.5), b=117.5 | Auto |
| label / R | (162,141,75.5,10); b=150.5 | Accent color: |
| accent-colors / selected Blue | (251,139,16,16) | Blue (no visible label) |
| accent-colors / unselected Purple | (275,139,16,16) | — |
| accent-colors / unselected Pink | (299,139,16,16) | — |
| accent-colors / unselected Red | (323,139,16,16) | — |
| accent-colors / unselected Orange | (347,139,16,16) | — |
| accent-colors / unselected Yellow | (371,139,16,16) | — |
| accent-colors / unselected Green | (395,139,16,16) | — |
| accent-colors / unselected Graphite | (419,139,16,16) | — |
| label / R | (150,173,87.5,12.5); b=182.5 | Highlight color: |
| pop-up-button / regular normal + highlight-color swatch | light (250.5,168.5,149,20), dark (251,169,156,19); ink (288,173.5,25,9.5), b=182.5; swatch (259,172,24,11) | Blue |
| label / R | (135.5,205,102,10); b=214.5 | Sidebar icon size: |
| pop-up-button / regular normal | light (250.5,200.5,149,20), dark (251,201,156,19); ink (260,205,46.5,10), b=214.5 | Medium |
| checkbox / regular off | (250,229,14,14); ink (268.5,231,256,12.5), b=240 | Automatically hide and show the menu bar |
| separator | (20,259,628,1) | — |
| label / R | (138.5,279,98.5,10); b=288.5 | Show scroll bars: |
| radio-button / regular selected | (251,277,16,16); ink (270.5,279,257,12.5), b=288 | Automatically based on mouse or trackpad |
| radio-button / regular off | (251,297,16,16); ink (270.5,300,88.5,12.5), b=309 | When scrolling |
| radio-button / regular off | (251,317,16,16); ink (270.5,320,41,12.5), b=329 | Always |
| label / R | (95.5,353,141.5,10); b=362.5 | Click in the scroll bar to: |
| radio-button / regular selected | (251,351,16,16); ink (270.5,353,134.5,12.5), b=362 | Jump to the next page |
| radio-button / regular off | (251,371,16,16); ink (270.5,374,185,12.5), b=383 | Jump to the spot that’s clicked |
| separator | (20,404,628,1) | — |
| label / R | (114,425,123.5,10); b=434.5 | Default web browser: |
| pop-up-button / regular normal, Safari icon | light (250.5,420.5,149,20), dark (251,421,156,19); label first glyph x=279.5, b=434.5 | light: Safari; dark: Safari (13.0.2) |
| separator | (20,457,628,1) | — |
| checkbox / regular off | (250,474,14,14); ink (268.5,476,278.5,12.5), b=485 | Ask to keep changes when closing documents |
| checkbox / regular on | (250,494,14,14); ink (268.5,496,219.5,12.5), b=505 | Close windows when quitting an app |
| label / S line one | (270.5,518.5,346,10.5); b=526 | When selected, open documents and windows will not be restored |
| label / S line two | (270.5,532.5,135.5,10.5); b=540 | when you re-open an app. |
| label / R | (160.5,565,77,10); b=574.5 | Recent items: |
| pop-up-button / regular normal | light (250.5,560.5,65,20), dark (251,561,64,19); ink (259.5,565.5,12.5,9.5), b=574.5 | 10 |
| label / R | (324.5,566,185,12.5); b=575 | Documents, Apps, and Servers |
| checkbox / regular on | (250,597,14,14); ink (268.5,599,343,12.5), b=608 | Allow Handoff between this Mac and your iCloud devices |
| separator | (20,627,628,1) | — |
| checkbox / regular on | (250,644,14,14); ink (269,646,209.5,12.5), b=655 | Use font smoothing when available |
| help-button / normal | (627,642,20,20) | ? |

Popup evidence additionally: light/dark rows at image y=430 and columns x=890 (light popup interior; dark unselected body), image y=413..452 light / 414..451 dark [M]. Checkbox probe `@ 612,544,28,1`, radio column `@ 620,630,1,110`, both captures [M].

## App-specific elements

Appearance previews need three screenshot-art assets, 67 × 44 pt each [M] (image x 615..748 in `10-15-Catalina-Light-System-Preferences-General.png` row 230); the selected outline is a 1.5 pt ring outside the artwork [M] (ring x 612..614 and 749..751). Evidence both `@ 612,185,140,94`, `@ 784,185,140,94`, `@ 958,188,136,88` [M]. These are miniature window/desktop compositions, not gradients that can substitute for the artwork [I].

Accent centre samples (Purple through Graphite), light: #8a4591 (sRGB #953d95), #e55d9d (sRGB #f74e9f), #cf4745 (sRGB #e0383e), #e9873b (sRGB #f8821e), #f2ba4b (sRGB #fbb927), #78b657 (sRGB #62b947), #989898; dark: #9a57a2 (sRGB #a550a6), #e55e9b (sRGB #f7509d), #ed5f5d (sRGB #ff5257), #e98839 (sRGB #f88318), #f3ba4a (sRGB #fdb925), #78b755 (sRGB #62ba44), #8c8c8c [M], both screenshots `@ 676,370`, `@ 724,370`, `@ 772,370`, `@ 820,370`, `@ 868,370`, `@ 916,370`, `@ 964,370`. Blue contains the white selected centre [M]; use `accent-colors` for its ring recipe.

## Content in the screenshot

All pane labels and values are in the table [M]. Appearance, scroll mode, jump behavior, document options, Handoff and smoothing are independently represented; do not interpret dark-mode checkbox shading as disabled [I: it is normal dark control rendering]. Pressed, hover, keyboard-focus and inactive-window pane states are not captured [M].

## Not reproducible / assets needed

Needs Light/Dark/Auto artwork and Safari icon [I]. Use the shared colour-component recipes for accent circles and highlight swatch; stored saturated colours above require the project’s centralized colour-profile conversion before CSS [I: CONVENTIONS policy]. Native font rendering affects exact label bounds [I].

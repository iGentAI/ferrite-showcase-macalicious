# TextEdit

- **Screenshots:** `10-15-Catalina-Light-Text-Edit.png`; `10-15-Catalina-Dark-TextEdit.png` [M]. Both show a key rich-text document, format bar and horizontal ruler; no window tab bar [M].
- **Window:** light **624 × 537 pt**, dark **597 × 507 pt** [M], opaque frame from `$M info`: light `10-15-Catalina-Light-Text-Edit.png @ 112,76,1248,1074`; dark `10-15-Catalina-Dark-TextEdit.png @ 112,76,1194,1014`. Do not use the larger shadow-inclusive image size.
- **Coordinates:** rectangles below are `(x,y,w,h)` in pt relative to the opaque frame [C], computed by subtracting image origin `(112,76)` [M] then dividing by two. Colours are stored PNG values [M].

## Layout

| Region | Rect / size (pt) [C] | Light background [M] | Dark background [M] | Evidence / provenance |
|---|---|---|---|---|
| Title bar | `(0,0,W,22)` | gradient sample `#e3e3e3` | `#424548 (sRGB #414548)` | [M] `10-15-Catalina-Light-Text-Edit.png @ 1200,90`; `10-15-Catalina-Dark-TextEdit.png @ 1200,90`; title/format split at image y=120, format controls start y=130 |
| Format bar | `(0,22,W,26)` | `#d9d9d9` near top; bottom `#bebebe`, then `#a7a7a7` separator | `#3e4043` near top; bottom `#2c2e30`, then black separator | [M] light and dark same filename stems above `@ 1200,120`, `@ 1200,170`; `$M col … 1250 76 246` |
| Ruler | `(0,48,W,32)` | `#f0f0f0`; rule `#b5b5b5`; bottom `#d9d9d9` | `#2c2e31`; rule sample `#5f6163`; bottom `#404245` | [M] `10-15-Catalina-Light-Text-Edit.png @ 1200,180`, `@ 1200,202`, `@ 1200,234`; dark same coordinates |
| Text view | light `(0,80,624,457)`; dark `(0,80,597,427)` | `#ffffff` | `#1e1e1f` (local stored variation around `#1e1e1e`) | [M] `10-15-Catalina-Light-Text-Edit.png @ 1200,300`; `10-15-Catalina-Dark-TextEdit.png @ 1200,300`; frame bottoms from info; [C] heights |

```text
[traffic lights]              document icon  512 Pixels
[¶ v][Helvetica][Regular][12 v][colour][a/][B|I|U][left|centre|right|justify][1.0][list v]
[indents]----------0----1----2----3----4----5----6----7----8----[tail]
Here's to the crazy ones...
                         empty text view
```
Arrangement and strings [M], evidenced by `10-15-Catalina-Light-Text-Edit.png @ 112,76,1248,190` and dark counterpart.

### Title and format controls

Title is **“512 Pixels”**, with a document proxy icon immediately before it, centred as a group [M] (`10-15-Catalina-Light-Text-Edit.png @ 650,82,175,32`; dark `@ 624,82,175,32`). Title font/rendering and traffic-light positions use `title-bar` and `window-controls`, not a second custom style.

All light format controls have y=**27 pt**, height **16 pt** [C] (outer image y=130..161). The table gives light outer rects; dark controls omit the light border, so their observed x and y are **0.5 pt later**, width and height **1 pt smaller** [C] (dark image y=131..160). Evidence: `$M row` at y=154 and y=132 on both PNGs and `$M col … 340 125 167`; listed image boxes include rounded-edge extent, not ink.

| Order / component | Visible value or state [M] | Light rect (pt) [C] | Image-pixel evidence [M] |
|---|---|---|---|
| Paragraph style `pop-up-button` | ¶, down chevron | `(4.5,27,25,16)` | `10-15-Catalina-Light-Text-Edit.png @ 121,130,50,32` |
| Font family `pop-up-button` | Helvetica, paired arrows | `(36.5,27,98,16)` | `@ 185,130,196,32` |
| Typeface `pop-up-button` | Regular, paired arrows | `(137.5,27,78,16)` | `@ 387,130,156,32` |
| Size `combo-box` | 12, down chevron | `(218.5,27,44,16)` | `@ 549,130,88,32` |
| Text `color-well` | black light; white dark | `(269.5,27,22,16)` | `@ 651,130,44,32`; dark `10-15-Catalina-Dark-TextEdit.png @ 652,130,43,32` |
| Background/highlight colour control `color-well` | italic a crossed with a red diagonal; no colour applied | `(294.5,27,22,16)` | `10-15-Catalina-Light-Text-Edit.png @ 701,130,44,32` |
| `segmented-control` | B / I / U, all off | `(323.5,27,57,16)` | `@ 759,130,114,32`; internal splits x=796..797 and 834..835 |
| Alignment `segmented-control` | left selected / centre / right / justified | `(387.5,27,76,16)` | `@ 887,130,152,32`; splits x=926,962..963,1000..1001 |
| Line spacing `pop-up-button` | 1.0, paired arrows | `(470.5,27,37,16)` | `@ 1053,130,74,32` |
| List `pop-up-button` | bulleted-list glyph, down chevron | `(510.5,27,35,16)` | `@ 1133,130,70,32` |

Evidence shorthand `@` in the table continues the full filename in that row or preceding light row. Colour-well centres: light black **`#000000`**, dark white **`#feffff`** [M] at `10-15-Catalina-Light-Text-Edit.png @ 670,145` and `10-15-Catalina-Dark-TextEdit.png @ 670,145`. Control text is **11 pt** [C], small-control cap-height module; actual bezel, glyphs and state fills come from the cited component files.

### Ruler and document

- Ruler origin is **5 pt** from the window's left edge [C], image x=122. Numbers **0, 1, 2, 3, 4, 5, 6, 7, 8** are shown [M]. Inch positions start at x=122 then x=266,410,554,698,842,986,1130,1274: **72 pt pitch**; minor ticks **9 pt pitch** [C] (`10-15-Catalina-Light-Text-Edit.png @ 112,202,1248,28`).
- First-line/head-indent stack at image `(114,182,18,20)` → frame rect **`(1,53,9,10)` pt** [C]. Visible left-tab markers at x=266,410,554,698,842,986 have **72 pt pitch** [C]; tail indent at light `(1342,190,17,12)` → **`(615,57,8.5,6)` pt** [C]. Dark tail is at the smaller window's right edge [M] (`10-15-Catalina-Dark-TextEdit.png @ 1288,190,17,12`). Reuse `ruler` for marker/tick drawings.
- This is a continuous text area, not a centred paper sheet [M]. Text container inset is **5 pt horizontal**, and the text line's ink starts **2 pt** below the text-view top [C]: first H at image x=121..137, y=240..257 (`10-15-Catalina-Light-Text-Edit.png @ 121,236,280,28`; same dark coordinates). The right ruler margin is also **5 pt** [C], measured from tail origin to frame edge. No selection, caret, vertical scroll thumb, pagination, second line or tab bar is visible [M].
- Text reads exactly **“Here's to the crazy ones...”** [M]. Font **Helvetica Regular 12 pt** [M] is explicitly displayed by the controls; H ink height **18 image px** [M] (`$M col … 123 237 263`). Text stems **`#000000` / `#ffffff`** [M], from `$M palette` of both text crops `(121,239,280,24)`. Do not replace the explicit Helvetica choice with SF Pro.

## Components used

`window`, `title-bar`, `window-controls`: standard document frame and proxy title; `pop-up-button`, `combo-box`, `color-well`, `segmented-control`: inspector controls; `ruler`: horizontal scale and markers; `text-view`: continuous rich-text document. `window-tab-bar` is **not shown** [M]. Component files own rendering; this blueprint supplies arrangement and captured values only.

## App-specific elements

The rich-text inspector's arrangement and document values above [C]; no additional custom artwork. The title is a saved document, not an “Untitled” placeholder [M].

## Content in the screenshot

Exact strings are “512 Pixels”, “Helvetica”, “Regular”, “12”, “B”, “I”, “U”, “1.0”, ruler “0” through “8”, and “Here's to the crazy ones...” [M], both screenshots' title/control/text crops cited above. Style and list controls show glyphs only, not an English style name [M].

## Not reproducible / assets needed

Use a document proxy icon and the component glyph assets for the inspector [I] (implementation requirement). No document imagery is needed. Helvetica availability and platform font rasterisation can alter the text appearance [I]; do not invent a bundled font requirement. No hidden inspector menu contents or window-tab state can be measured from these captures [M].

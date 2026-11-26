# Dictation
- **Screenshots:** 10-15-Catalina-Light-Dictation.png, 10-15-Catalina-Dark-Dictation.png (region captures: the HUD beside a TextEdit window)
- **Window:** HUD 84 x 95 pt with a 10 pt pointer on its right edge, placed left of the document window

## Layout
| Region | Position (px in the light capture) | Size (pt) | Light | Dark | Tag | Evidence |
|---|---|---|---|---|---|---|
| HUD body | 53..220 x 123..312 | 84 x 95 | `#c1e7f5 (sRGB #b8e8f7)`..`#c5e2f6 (sRGB #bee3f8)` | `#29292b` | [M] | 10-15-Catalina-Light-Dictation.png @ 53,123,168,190; 10-15-Catalina-Dark-Dictation.png @ 29,117,168,190 |
| Microphone area | 123..248 | 63 high | same | same | [M] | @ 132,123,1,128 |
| Divider | 249..250 | 1 | `#aecce0 (sRGB #a7cde2)` | `#4b4b4d` | [M] | @ 132,249,1,2 |
| Done area | 251..312 | 31 high | same | same | [M] | @ 132,251,1,62 |
| TextEdit window | from x=251 (light), 12 pt right of the HUD body | 549 x 468 visible | see chrome/views specs | - | [M] position | @ 250,40,1100,940 |

## Components used
`dictation`; the document window uses `window`, `title-bar` (title "Untitled - Edited"), `window-controls`, `ruler` (TextEdit format bar and ruler), `text-view`, `toolbar-pop-up`, `segmented-control`, `color-well`.

## App-specific elements
None beyond the component.

## Content in the screenshot
HUD: microphone glyph, "Done". TextEdit (light): title "Untitled - Edited" ("Edited" in the secondary colour), format bar: paragraph-style pop-up, "Helvetica", "Regular", "12", colour wells, B / I / U, alignment (left selected), "1.0" spacing, list pop-up; ruler 0..7; text "This is some dictation". Dark: text "This is me using dictation" with the insertion point.

## Not reproducible / assets needed
Speech recognition. The microphone glyph is a simple SVG (see `dictation`).

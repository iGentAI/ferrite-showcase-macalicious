# Ruler and format bar (`ruler`)

- **Status:** present (TextEdit, light and dark)
- **AppKit:** `NSRulerView` (horizontal ruler of an `NSScrollView`, `NSRulerMarker` for tabs and indents) with `NSTextView.usesRuler = true`; the row of controls above it is the text view's format bar (`NSTextView.usesInspectorBar` / the "inspector bar"), hosted as a title-bar accessory in Catalina
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/ (no dedicated page)
- **Appearances shown:** light, dark

## Purpose and behaviour
The ruler shows the horizontal measurement of the text container (inches by default) and holds draggable markers for the first-line indent, head indent, tail indent and tab stops of the selected paragraphs. The format bar gives paragraph style, font family, typeface, size, text colour, highlight colour, bold/italic/underline, alignment, line spacing and list style [D] (AppKit `NSRulerView`, `NSTextView`).

## Anatomy
```
 title bar (22 pt)
 format bar: [P v] [Helvetica  ^v] [Regular ^v] [12 v]  [col][a]  [B|I|U]  [=|=|=|=]  [1.0 ^v] [list v]
 ruler upper half 15 pt:  indent markers and tab markers sit on the rule
 ---------------------------------------------- rule 1 pt
 ruler lower half 15 pt:  ticks hang down from the rule, numbers right of each inch tick
 ============================================== bottom border 1 pt
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown |
|---|---|---|---|---|
| Units | inches / centimetres / points / picas | locale | `NSRulerView.measurementUnits` | inches |
| Visibility | shown / hidden (Format > Text > Show Ruler, Command-R) | shown for rich text | `isRulerVisible` | shown |
| Markers | left / centre / right / decimal tab; first-line indent; head indent; tail indent | left tabs every inch in this document | `NSRulerMarker` | left tab, indents |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Key window | yes | both appearances |
| Marker dragging | no | marker follows the pointer, snapping to ticks; a guide line drops through the text [I] |
| Inactive window | no | same colours; format-bar controls lose their emphasis [I] |

## Measurements
### Geometry (pt)
Window left edge is image x=112; the ruler starts at y=172 in both TextEdit captures.

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Ruler height | 31 fill + 1 bottom border = 32 | [M] | 10-15-Catalina-Light-Text-Edit.png @ 400,172,1,64; 10-15-Catalina-Dark-TextEdit.png @ 400,172,1,64 |
| Rule (base line) | 1 thick, 15 below the ruler top (y=202..203) | [M] | same |
| Origin (0) | 5 from the window's left edge (x=122), i.e. the text container's left padding | [M] | 10-15-Catalina-Light-Text-Edit.png @ 122,202,2,22 |
| Tick spacing | 9 (18 px) = 1/8 inch at 72 pt per inch | [M] | 10-15-Catalina-Light-Text-Edit.png @ 112,204,310,1 (ticks at x=122, 140, 158, ... 410) |
| Tick width | 1 (2 px) | [M] | same |
| Tick lengths below the rule top | inch 11 (y=202..223); half inch 4.5 (to y=210); quarter 3.5 (to y=208); eighth 2.5 (to y=206) | [M] | columns x=266, 194, 158, 140 of 10-15-Catalina-Light-Text-Edit.png, y=202..224 |
| Number position | left edge 3.5 right of its inch tick (x=273 for the tick at 266), cap top 6.5 below the rule top (y=215..227) | [M] | 10-15-Catalina-Light-Text-Edit.png @ 273,215,5,13 |
| Left tab marker | 6 x 9 (12 x 18 px) right-pointing triangle sitting on the rule, its left edge on the tab position | [M] | 10-15-Catalina-Light-Text-Edit.png @ 266,184,12,18 |
| Indent markers at 0 | stack 9 wide x 10 tall (x=114..131, y=182..201): first-line indent bar (4 pt, lighter) above the head-indent triangle (5.5 pt, darker), centred on the origin | [M] | 10-15-Catalina-Light-Text-Edit.png @ 114,182,18,20 and column @ 122,182,1,20 |
| Tail indent marker | 8.5 x 6 (17 x 12 px) down-pointing triangle, sitting on the rule (x=1342..1358) | [M] | 10-15-Catalina-Light-Text-Edit.png @ 1342,190,17,12 |
| Format bar | controls are small-size (pop-ups 16 pt tall incl. borders, y=130..161); bar occupies y=120..171 under the 22 pt title bar; total title + format bar 48 | [M] | 10-15-Catalina-Light-Text-Edit.png @ 400,100,1,72 |
| Format bar item extents (px, row y=146) | style 121..170; family + typeface + size 185..636; colours 651..744; B/I/U 759..872; alignment 887..1038; spacing + lists 1053..1202 | [M] | 10-15-Catalina-Light-Text-Edit.png @ 112,146,1248,1 |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Ruler fill | `#f0f0f0` | `#2c2e31` | [M] | Light-Text-Edit @ 400,180; Dark-TextEdit @ 400,180 |
| Rule and ticks | `#b5b5b5` | `#606164` (also #606264) | [M] | Light-Text-Edit @ 400,202 and 140,204; Dark-TextEdit @ 400,202 and 140,204 |
| Bottom border | `#d9d9d9` (also #d8d8d8) | `#404245` | [M] | Light-Text-Edit @ 400,234; Dark-TextEdit @ 400,234 |
| Numbers | `#242424` | `#dfdfdf` | [M] | Light-Text-Edit @ 273,215,5,13; Dark-TextEdit bbox @ 114,182,186,47 |
| Tab and tail-indent markers | `#787878` | tab body `#a0a1a2`; tail body `#a0a0a2`, highlight/ink maximum `#b3b4b5` | [M] | 10-15-Catalina-Light-Text-Edit.png @ 268,190; 10-15-Catalina-Dark-TextEdit.png @ 268,190; 10-15-Catalina-Dark-TextEdit.png @ 1295,195; lightest tail ink in 10-15-Catalina-Dark-TextEdit.png @ 1288,190,17,12 |
| Indent markers | `#777778` (first-line bar) and `#3c3c3c` (head-indent triangle) | `#a0a0a2` bar / `#d4d5d5` triangle | [M] | 10-15-Catalina-Light-Text-Edit.png @ 122,184; 10-15-Catalina-Light-Text-Edit.png @ 122,195; 10-15-Catalina-Dark-TextEdit.png @ 122,184; 10-15-Catalina-Dark-TextEdit.png @ 122,195 |

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Ruler numbers | SF Pro Text 9 pt Regular (cap 13 px) | [C] | 10-15-Catalina-Light-Text-Edit.png @ 273,215,5,13 |
| Format bar text | 11 pt (small control size) | [C] | owned by `pop-up-button` / `segmented-control` |

### Shadows and effects
None.

## Layout and spacing
The ruler spans the full scroll-view width and scrolls horizontally with the text. One inch = 72 pt regardless of display scale. The text view begins immediately below the bottom border.

## Keyboard and accessibility
Not focusable; markers are adjustable through Format > Text and via VoiceOver (`AXRuler` with `AXRulerMarker` children, each with an `AXValue`). ARIA: decorative ruler `aria-hidden`; expose indents through form controls or `role="slider"` markers.

## Browser notes
Ticks can be drawn with a repeating linear gradient (9 px period) plus two overlays for the longer ticks, or with a small SVG pattern; markers are inline SVG triangles.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Text-Edit.png | 112,120,1248,116 | format bar and ruler |
| dark | 10-15-Catalina-Dark-TextEdit.png | 112,120,1194,116 | same, dark |

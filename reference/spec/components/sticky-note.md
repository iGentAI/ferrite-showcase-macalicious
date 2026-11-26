# Stickies note window (`sticky-note`)

- **Status:** present
- **AppKit:** custom borderless `NSWindow` subclass in Stickies.app with an `NSTextView` body (no public class).
- **HIG:** none (app-specific).
- **Appearances shown:** light, dark (desktop appearance). The note itself does not change with the appearance; only its outline/shadow treatment does.

## Purpose and behaviour
A small coloured rectangle that floats on the desktop and holds rich text. Notes have square corners, no standard title bar and no traffic lights. The **frontmost note of the active app** shows a 12 pt title strip, in a more saturated shade of the note colour, with three small square widgets (close, zoom, collapse). Notes that are not key (another note is in front, or another app is active) show no strip and no widgets: the body colour runs to the top edge [M] (yellow note: strip present in the Light capture where Stickies is frontmost, absent in the Dark capture where Finder is frontmost; the blue note behind has no strip in either). Double-clicking the strip collapses the note to the strip ("To collapse this note, double click the title bar." is the note's own text). Colour is chosen from the Color menu: Yellow, Blue, Green, Pink, Purple, Gray [D, Stickies Color menu]; only Yellow and Blue are shown.

## Anatomy
```
+--------------------------------------------------+
| [ ]                                       [/] [=] |  title strip, 12 pt, only when key
+--------------------------------------------------+
|  Make a note of it!                               |
|                                                   |  body, same hue, lighter
|  Stickies lets you keep notes ...                 |
+--------------------------------------------------+
```
1. Body rectangle (square corners), note colour.
2. Title strip (key note only): full width, 12 pt tall, strip colour.
3. Widgets in the strip: close box (left), zoom triangle box and collapse box (right).
4. Text view inset about 11.5 pt from the left edge.
5. Light desktop appearance: a soft drop shadow. Dark desktop appearance: additionally a 0.5 pt near-black outline just outside the note.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| color | yellow, blue, green, pink, purple, gray | yellow | Color menu | yellow, blue |
| key | true (strip + widgets), false | - | key window | both |
| collapsed | false, true (strip only) | false | Window > Collapse (Cmd-M) | expanded only; collapsed **not shown** |
| translucent | false, true | false | Window > Translucent Window | opaque only; translucent **not shown** |
| floating | false, true | false | Window > Float on Top | not distinguishable |
| size | free; default about 352 x 260 | - | resizable from all edges, no grow box | 352 x 260 (yellow), 355 x 268 (blue) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| key note (strip visible) | yes | `10-15-Catalina-Light-Stickies.png @ 138,606,704,24` |
| non-key note (no strip) | yes | `10-15-Catalina-Dark-Stickies.png @ 138,606,704,24` (yellow, Finder frontmost); blue note in both files `@ 96,562,710,40` |
| widget hover / pressed | no | [I] the widget border darkens; no glyph appears |
| collapsed | no | [I] window height = strip height (12 pt), strip shows the first line of text in 9 pt |
| text selection, insertion point | insertion point only | `10-15-Catalina-Light-Stickies.png @ 160,978,2,28` |

## Measurements
Evidence shorthand: `Light @` = `10-15-Catalina-Light-Stickies.png`, `Dark @` = `10-15-Catalina-Dark-Stickies.png`; a bare `@`, `row y=` or `col x=` refers to the Light file. Coordinates are image px of the 3360 x 2100 full-screen captures.

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Yellow note frame | 352 x 260 | [M] | `10-15-Catalina-Light-Stickies.png @ 138,606,704,520` (row y=700: 138..841; col x=500: 606..1125) |
| Blue note frame | 355 x 268 | [M] | `@ 96,562,710,536` (row y=580: 96..805; col x=120: 562..1097) |
| Corner radius | 0 | [M] | corners are square in both files (`@ 138,606` is already the strip colour) |
| Title strip height | 12 | [M] | col x=500 (Light): `#fbe961 (sRGB #feea3d)` y=606..629, body from y=630 |
| Widget size | 8 x 8, drawn as a 1 pt border around a 6 x 6 body-coloured centre | [M] | `Light @ 162,610,16,16` |
| Close box position | left inset 12, top inset 2 | [M] | x 162..177, y 610..625 (note left edge 138, top 606) |
| Collapse box position | right inset 12, top inset 2 | [M] | `@ 802,610,16,16` (note right edge 841) |
| Zoom box position | 4 pt left of the collapse box | [M] | `@ 778,610,16,16` |
| Zoom glyph | right triangle: 1 pt strokes along the right and bottom edges plus the diagonal from bottom-left to top-right; body-colour fill inside | [M] | grid `@ 774,608,22,20` |
| Collapse glyph | 8 x 8 box split by a 1 pt horizontal bar 2.5 pt below the top (rows 615..616) | [M] | grid `@ 798,608,20,20` |
| Text left inset | 11.5 (first glyph ink at 23 px) | [M] | first line ink x=161 (note edge 138) |
| First baseline | 29 pt below the note top (17 pt below the strip) | [M] | `M` of the bold heading: y=646..663 |
| Line pitch | 14 | [M] | text line tops y=702, 730, 758, 786 |
| Insertion point | 1 x 14 | [M] | `@ 160,978,2,28` |

### Colours and fills
| Part / state | Value (same in both desktop appearances) | Tag | Evidence |
|---|---|---|---|
| Yellow body | `#fdf3a7 (sRGB #fef49c)` | [M] | `Light @ 500,900`; `Dark @ 500,900` |
| Yellow title strip | `#fbe961 (sRGB #feea3d)` | [M] | `Light @ 500,610` |
| Yellow widget border | `#d8c542 (sRGB #dbc606)` (dithered +-1, e.g. `#d8c441 (sRGB #dbc501)`) | [M] | `Light @ 162,618` |
| Yellow widget centre | `#fcf3a7 (sRGB #fdf49c)` (body colour, dithered +-1) | [M] | `Light @ 170,618` |
| Blue body | `#bcf2fd (sRGB #aef4ff)` | [M] | `Light @ 100,566`; `Dark @ 300,566` |
| Blue strip, widgets | not shown | [I] | strip about `#8eeafc (sRGB #6decff)`, widget border about `#5fc3d8 (sRGB #2ac5db)` (same lightness steps as yellow) |
| Green / Pink / Purple / Gray body | not shown: sRGB `#b2ffa1 (sRGB #99ff96)` / `#ffc7c7 (sRGB #ffc4c6)` / `#b6caff (sRGB #b2caff)` / `#eeeeee` | [I] | Stickies' built-in palette as remembered; not shown: all Stickies body colours captured are yellow or blue. Derive strip and widget border with the yellow ratios |
| Text | `#000000` | [M] | `Light @ 500,708` |
| Dark-appearance outline | near-black 0.5 pt line outside the fill: `#030304` over wallpaper, `#192022 (sRGB #172022)` over the blue note | [M] | `Dark @ 842,900`, `Dark @ 137,900`, `Dark @ 300,605`, `Dark @ 500,1126` (`#06090d (sRGB #05090d)`) |
| Light-appearance outline | none (only shadow) | [M] | `Light @ 842,900` is `#44402d (sRGB #45402a)` over rock, `Light @ 95,700` `#435f7c (sRGB #3c5f7f)` over sky: darkened wallpaper, not a line |

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Body font | Helvetica 12 pt Regular | [C] | line pitch 28 px = 14 pt (Helvetica 12 default leading); cap height 18 px (`M` 646..663); x-height 13 px. Stickies' default font is Helvetica 12 [D, Stickies Font menu default] |
| Heading line | Helvetica Bold 12 pt | [C] | "Make a note of it!" `@ 161,646,194,19` |
| Text colour | `#000000` | [M] | see above |
| Paragraph spacing | one empty line (14 pt) between paragraphs | [M] | line tops 786 then 842 |

### Shadows and effects
- Light: soft shadow, strongest directly below and to the right. Samples next to the yellow note over wallpaper: 1 px outside the right edge `#44402d (sRGB #45402a)` vs `#6a634c (sRGB #6b6349)` 2 px further (`Light` row y=900, x=842..845); below the bottom edge `#253850 (sRGB #203852)` then `#334a66 (sRGB #2d4a69)` (`Light` col x=300, y=1126..1127). Next to the blue note's left edge over sky `#435f7c (sRGB #3c5f7f)` at 1 px, `#4d6d8e (sRGB #456d91)` at 2 px, `#55759a (sRGB #4d759d)` at 5 px (row y=700, x=91..95). Fitted CSS: `box-shadow: 0 1px 4px rgba(0,0,0,.35)` [C] (cannot be separated exactly from the photographic wallpaper).
- The yellow note also shades the blue note beneath it: blue body `#bcf2fd (sRGB #aef4ff)` falls to `#a7d8e1 (sRGB #9adae3)` in the last 4 px before the yellow edge (`Light` row y=700, x=128..137) [M].
- Dark: the same shadow plus the 0.5 pt outline listed above: `box-shadow: 0 0 0 0.5px rgba(0,0,0,.9), 0 1px 4px rgba(0,0,0,.35)` [C].

## Layout and spacing
- Strip widgets: 12 pt from either side edge, 2 pt from the top, 4 pt between the two right-hand widgets.
- Text view fills the note below the strip with about 11.5 pt left padding; text wraps at the same inset on the right [I]. When the strip is hidden the text does not move (the 12 pt band stays, in body colour) [M] (heading at y=646 in both files).
- New notes cascade about 10 pt right and 10 pt down from the previous one [I] (the two default notes are offset 21 pt horizontally and 22 pt vertically: blue at 96,562, yellow at 138,606 px [M]).

## Keyboard and accessibility
Cmd-N new note, Cmd-W close (prompts to save), Cmd-M collapse/expand, Cmd-Option-F float on top, Cmd-Option-T translucent, Cmd-1..6 note colour [D, Stickies menus; not visible]. Each note is a window (`AXWindow`) containing a text area. ARIA: `role="dialog"` or a plain region with `aria-label` from the first line, containing a `contenteditable` `role="textbox" aria-multiline="true"`.

## Browser notes
Fully reproducible with CSS. Helvetica is not installed on Windows/Android: fall back to Arimo or Arial (metrics match). The 0.5 pt dark outline needs a 2x display; round to 1 px at 1x.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Stickies.png` | 138,606,704,520 | yellow note, key, with strip and widgets |
| light | `10-15-Catalina-Light-Stickies.png` | 130,596,720,60 | title strip close-up |
| light | `10-15-Catalina-Light-Stickies.png` | 96,562,710,536 | blue note behind (non-key, mostly covered) |
| dark | `10-15-Catalina-Dark-Stickies.png` | 138,606,704,520 | yellow note, non-key (no strip), dark outline |
| dark | `10-15-Catalina-Dark-Stickies.png` | 90,555,760,100 | both notes' top edges with outline |

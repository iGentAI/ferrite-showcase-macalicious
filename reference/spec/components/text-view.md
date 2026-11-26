# Text View (`text-view`)

- **Status:** present
- **AppKit:** `NSTextView` in an `NSScrollView` (`textContainerInset`, `isRichText`, `usesRuler`, `insertionPointColor`, `selectedTextAttributes`), colours `textBackgroundColor`, `textColor`, `selectedTextBackgroundColor`
- **HIG:** https://web.archive.org/web/20200503141651/https://developer.apple.com/design/human-interface-guidelines/macos/fields-and-labels/text-fields/
- **Appearances shown:** light, dark

## Purpose and behaviour
Multi-line editable (or read-only) text filling a pane: documents (TextEdit), notes, source code (Script Editor), message bodies (Mail compose), log detail (Console), sticky notes. It has no bezel; it scrolls vertically, wraps to the view width (or to a page), supports rich text, spelling marks, find bar, ruler and the standard Edit menu commands [D] (AppKit `NSTextView`; the HIG covers text input under Text Fields).

## Anatomy
1. Background (`textBackgroundColor`), edge to edge in its pane.
2. Text, inset by the text container inset plus 5 pt line-fragment padding.
3. Selection highlight rectangles behind selected glyph runs (full line height).
4. Insertion point: a 1 pt vertical bar, blinking.
5. Optional ruler above (`ruler`), overlay scroller (`scroll-view`).

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| Rich / plain text | rich, plain | rich | `isRichText` | rich: TextEdit, Notes, Mail, Stickies; plain styled: Script Editor, Console |
| Background | system text background / custom (paper, sticky colour, always-white) | system | `backgroundColor`, `drawsBackground` | all four |
| Editable | yes / no | yes | `isEditable` | yes; read-only: Console detail, Dictionary definition, System Information report |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Idle with insertion point | yes | Stickies (light), Mail compose subject line (dark), Dictionary search field (light) |
| Text selected, key window | yes (light only) | Contacts "Phone" field text selected; Mail address token |
| Text selected, dark | no | `#3f638b (sRGB #35638f)` [I] (system `selectedTextBackgroundColor` for blue accent in dark mode; not captured) |
| Text selected, inactive window | no | `#dcdcdc` light / `#464646` dark (same as unemphasized selection) [I] |
| Focus ring | n/a | text views that fill a pane draw no focus ring [D] |
| Disabled / read-only | yes | read-only views look identical; no insertion point |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Text left inset (TextEdit) | 5.5 (first glyph x=123, window edge x=112): 5 pt line-fragment padding + side bearing | [M] | 10-15-Catalina-Light-Text-Edit.png @ 123,240,276,23 |
| First line top (TextEdit) | text box top 2 pt below the ruler's bottom border (glyph top y=240, view top y=236) | [M] | same |
| Insertion point width | 1 (2 px) | [M] | 10-15-Catalina-Light-Stickies.png @ 160,990,2,1; 10-15-Catalina-Dark-Mail.png @ 998,556,2,1; 10-15-Catalina-Light-Dictionary.png @ 1002,148,2,1 |
| Insertion point height | line height: 14 for Helvetica 12 (Stickies), 16 for system 13 (Mail subject) | [M] | 10-15-Catalina-Light-Stickies.png @ 161,978,1,28; 10-15-Catalina-Dark-Mail.png @ 998,542,1,32 |
| Line pitch, Helvetica 12 (TextEdit default) | 14 [C from the 14 pt caret]; Script Editor Verdana 12: 15 | [M] Script Editor | 10-15-Catalina-Light-Script-Editor.png @ 125,253,700,84 (line tops y=253, 283, 313) |
| Selection rect | full line height of the run, flush to the glyph advance; 19 pt high for a 13 pt field/token | [M] | 10-15-Catalina-Light-Mail.png @ 700,418,1,38 |
| Script Editor indent step | 29 (58 px per nesting level: x=125, 182, 240, 299) | [M] | 10-15-Catalina-Light-Script-Editor.png @ 125,253,700,100 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Background | `#ffffff` | `#1e1e1e` | [M] | 10-15-Catalina-Light-Text-Edit.png @ 600,600; 10-15-Catalina-Dark-TextEdit.png @ 600,600 |
| Background, Mail compose | `#ffffff` | `#1e1e20` | [M] | 10-15-Catalina-Light-Mail.png @ 1400,900; 10-15-Catalina-Dark-Mail.png @ 1400,900 |
| Background, Notes editor | paper texture around `#f9f9f7` | `#232425` (subtle texture) | [M] | 10-15-Catalina-Light-Notes.png @ 1040,170,900,4; 10-15-Catalina-Dark-Notes.png @ 1500,300 |
| Background, Script Editor | `#ffffff` | `#ffffff` (the editor stays white in dark mode in this capture) | [M] | 10-15-Catalina-Dark-Script-Editor.png @ 1480,700 |
| Background, Stickies yellow | `#fdf3a7 (sRGB #fef49c)` | - | [M] | 10-15-Catalina-Light-Stickies.png @ 170,990 |
| Text | `#000000` (TextEdit stores #010000) | `#ffffff` | [M] | 10-15-Catalina-Light-Text-Edit.png @ 123,240,276,23; 10-15-Catalina-Dark-TextEdit.png same box |
| Insertion point | `#000000` | `#ffffff` (#fffffe) | [M] | 10-15-Catalina-Light-Stickies.png @ 160,990; 10-15-Catalina-Dark-Mail.png @ 998,556 |
| Selected text background (blue accent, key) | `#b9d7fb (sRGB #b2d7ff)` | `#3f638b (sRGB #35638f)` [I] | [M] light | 10-15-Catalina-Light-Contacts.png @ 1126,344 and 1140,344 |
| Selected text colour | unchanged (`#000000`) | unchanged | [M] | 10-15-Catalina-Light-Contacts.png @ 1130,344 |
| Address token fill (Mail "Stephen Hackett") | `#c0d7fc (sRGB #bbd7ff)`, text `#1d2026 (sRGB #1c2027)` | fill `#253d60 (sRGB #1e3d63)`, text `#dee1e7 (sRGB #dde1e8)` | [M] | 10-15-Catalina-Light-Mail.png @ 605,436; 10-15-Catalina-Light-Mail.png @ 617,436; 10-15-Catalina-Dark-Mail.png @ 614,428; lightest ink in 10-15-Catalina-Dark-Mail.png @ 614,410,215,34 |
| Script Editor syntax colours | keywords bold `#000000`; application/command terms `#003ef6 (sRGB #0432ff)` (stored; italic for class names); variables `#5e8c27 (sRGB #4e8f00)`; comments `#5e6060` | same (white editor) | [M] | 10-15-Catalina-Light-Script-Editor.png @ 1000,292 (#013ef6 (sRGB #0532ff)); @ 1000,349; comment bbox @ 357,463,296,24 |

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| TextEdit default font | Helvetica 12 (shown in the format bar) | [M] via UI text | format bar pop-ups "Helvetica", "Regular", "12" |
| Notes body title | SF Pro Display about 17 pt Bold `#444545` light / light grey dark; date line 12 pt `#909190` centred | [C] | 10-15-Catalina-Light-Notes.png @ 1040,221,890,34 and 1395,174,312,22 |
| Script Editor | Verdana 12 with AppleScript formatting styles | [C] | line box 24 px |
| Console detail | Menlo 11 | [C] | apps/console.md |

### Shadows and effects
Insertion point blinks: about 0.5 s on, 0.5 s off [I]. No inner shadow in a pane-filling text view.

## Layout and spacing
Fills its pane; with wrap-to-window the text container width is the view width minus 2 x 5 pt padding. With a ruler the view starts under the ruler's bottom border.

## Keyboard and accessibility
Standard Cocoa text key bindings (arrows, Option/Command modifiers, Emacs-style Control keys), Tab inserts a tab (Control-Tab leaves the view) [D]. AX role `AXTextArea`. ARIA: `<textarea>` or `contenteditable` with `role="textbox" aria-multiline="true"`.

## Browser notes
- Use `caret-color` and `::selection { background: #b9d7fb (sRGB #b2d7ff); }`; browsers draw the caret 1 CSS px wide, matching 1 pt.
- Inactive-window selection colour requires a blur-state class (`::selection` cannot detect window focus except via `:window-inactive` in WebKit).
- Notes' paper texture is a bitmap.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Text-Edit.png | 112,236,1248,914 | document text view |
| dark | 10-15-Catalina-Dark-TextEdit.png | 112,236,1194,854 | same, dark |
| light | 10-15-Catalina-Light-Script-Editor.png | 112,224,1400,840 | styled source text |
| light | 10-15-Catalina-Light-Stickies.png | 138,606,704,520 | sticky note text with insertion point (full-screen capture) |
| dark | 10-15-Catalina-Dark-Mail.png | 508,390,1770,1100 | compose body and insertion point |
| light | 10-15-Catalina-Light-Contacts.png | 1110,320,110,50 | selected text highlight |

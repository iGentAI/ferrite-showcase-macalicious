# Assistant window (`assistant-window`)

- **Status:** present (Boot Camp Assistant, Introduction step; light and dark)
- **AppKit:** plain `NSWindow` (`.titled`, `.closable`, `.miniaturizable`; not resizable) with a custom step view; text in a bordered, non-editable `NSTextView` inside an `NSScrollView` (`borderType = .lineBorder`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/app-architecture/onboarding/
- **Appearances shown:** light, dark

## Purpose and behaviour

An assistant walks the user through a task one step at a time: a heading names the step, a text or
control area fills the body, and navigation buttons sit at the bottom right ("Continue", and "Go Back"
from the second step on). Secondary actions (help) sit at the bottom left of the content column.
Branding artwork fills a fixed left column. The HIG's onboarding guidance applies: keep steps few,
state what will happen, and let the user leave at any point [D].

## Anatomy

```
+ (o)(o)(o)                  Boot Camp Assistant                         +  title bar 22 pt
|            | Introduction                                              |  bold 13 pt heading
|  artwork   | +-------------------------------------------------------+ |
|  column    | | body text (13 pt) in a bordered box                   | |
|  174.5 pt  | |                                                       | |
|            | +-------------------------------------------------------+ |
|            | [Open Boot Camp Help]                         [Continue] |
+------------+-----------------------------------------------------------+
```

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| step | Introduction, task selection, progress, done | Introduction | - | Introduction |
| navigation | Continue only; Go Back + Continue | Continue | - | Continue only |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| First step, key window | yes | 10-15-Catalina-Light-Boot-Camp-Assistant.png, 10-15-Catalina-Dark-Boot-Camp-Assistant.png |
| Continue as default (accent) button | no: "Continue" is drawn as a normal push button here | 10-15-Catalina-Light-Boot-Camp-Assistant.png @ 1467,1093,170,41 |
| Later steps (Go Back, progress bar) | no | [I] "Go Back" 13 pt to the left of "Continue" |

## Measurements

Frame: x 112..1677, y 76..1171 px = **783 x 548 pt** [M].

### Geometry (pt)

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Title bar | 22 pt (y 76..119); window controls with zoom disabled | [M] | 10-15-Catalina-Light-Boot-Camp-Assistant.png col 1000 |
| Artwork column | from the left edge to the content column at x 461 (174.5 pt); artwork (four glossy diamonds) is cropped by the left window edge and overlaps the text box's left edge by about 44 pt | [M] | @ 112,250,530,760 |
| Heading | cap top 44.5 pt, baseline 53.5 pt below the window top (y 165..183); left x 468 (3.5 pt right of the box edge) | [M] | 10-15-Catalina-Light-Boot-Camp-Assistant.png @ 468,161,167,24 |
| Text box | x 461..1645, y 206..1051 = 592.5 x 423 pt, 1 pt (2 px) border; top 43 pt below the title bar; right margin 16 pt (1645 -> 1677) | [M] | col 1000: border rows 206..207 and 1050..1051; row 700: border 1644..1645 |
| Body text inset | 7.5 pt from the box edge (text x 476); first baseline 20.5 pt below the box top (y 247); line pitch 16 pt (line boxes y 228, 260, 292) | [M] | @ 476,228,1115,90 |
| Button row | 20 pt buttons at y 1093..1132: 21 pt below the box, 19.5 pt above the window bottom | [M] | col 1500 |
| Left button ("Open Boot Camp Help") | 163 pt (x 461..786), left-aligned with the box | [M] | row 1112 |
| Right button ("Continue") | 85 pt (x 1467..1636), right margin 20.5 pt (so it sits 4.5 pt inside the box's right edge) | [M] | row 1112 |

### Colours and fills

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Window background | `#ececec` | `#303132` | [M] | 10-15-Catalina-Light-Boot-Camp-Assistant.png @ 1000,150 `#ececec`; 10-15-Catalina-Dark-Boot-Camp-Assistant.png @ 1000,150 `#303132` |
| Text box fill | `#d5d5d5` | `#444546` | [M] | 10-15-Catalina-Light-Boot-Camp-Assistant.png @ 1000,600 `#d5d5d5`; 10-15-Catalina-Dark-Boot-Camp-Assistant.png @ 1000,600 `#444546` |
| Text box border | `#999999` | `#999999` | [M] | 10-15-Catalina-Light-Boot-Camp-Assistant.png @ 1000,206 `#999999`; 10-15-Catalina-Dark-Boot-Camp-Assistant.png @ 1000,206 `#999999` |
| Artwork | greyscale glossy diamonds, lighter set in dark mode | - | [M] | @ 112,250,530,760 in both files |

### Text and icons

| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title | "Boot Camp Assistant", 13 pt regular, centred | same | [M] | @ 770,84,250,28 |
| Heading ("Introduction") | SF Pro Text Bold 13 pt (ascender box 22 px, stem 4..5 px), `#242424` | `#dfdfe0` | [M], [C] | @ 468,161,167,24 in both files |
| Body | SF Pro Text Regular 13 pt (x-height 14 px, stem 2..3 px), `#000000`, left-aligned, paragraphs separated by a blank line | `#ffffff` | [M], [C] | @ 476,229,54,20 in both files |
| Button titles | 13 pt, `#262626` | light | [M] | col 1500: text rows 1107..1118 |

### Shadows and effects

Standard window shadow. No inner shadow on the text box.

## Layout and spacing

Fixed-size window; the content column (box and buttons) starts at 174.5 pt and ends 16 pt from the
right edge; the heading, box and left button share the left edge.

## Keyboard and accessibility

Return activates Continue when it is the default button, Escape/Command-period goes back or cancels,
Tab reaches the buttons with full keyboard access [D]. AX: AXWindow with AXStaticText heading and
AXTextArea. ARIA: a `dialog` or `main` region with an `h1` step heading and `aria-live="polite"` on
step change.

## Browser notes

The diamond artwork must be an image asset (two variants). Everything else is standard boxes.

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Boot-Camp-Assistant.png | 112,76,1566,1096 | Introduction step |
| dark | 10-15-Catalina-Dark-Boot-Camp-Assistant.png | 112,76,1566,1096 | same, dark |

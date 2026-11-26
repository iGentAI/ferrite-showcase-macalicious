# Popover (`popover`)

- **Status:** present
- **AppKit:** `NSPopover` (`behavior = .transient | .semitransient | .applicationDefined`, `appearance`), anchored with `show(relativeTo:of:preferredEdge:)`
- **HIG:** https://web.archive.org/web/20200503140859/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/popovers/
- **Appearances shown:** light, dark

## Purpose and behaviour
A view that appears above other content when a control or area is clicked, usually with an arrow pointing at its origin; it supports vibrancy [D]. It closes on any outside interaction (transient), on interaction with its source (semitransient) or under app control; it can be detachable and then becomes a panel [D]. Show one at a time, never a popover from a popover, keep it small, do not cover the element that opened it, and do not use it as an alert [D].

## Anatomy
Rounded rectangle body with an arrow on one edge, all one shape: fill, 0.5 pt outer hairline, (dark) 1 pt inner highlight, small drop shadow. Content is laid out by the app.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| arrow edge | left, right, top, bottom, none | chosen from `preferredEdge` and available space | `preferredEdge` | arrow on the left edge (Calendar, Reminders), on the right edge (Maps) |
| behaviour | transient, semitransient, app-defined, detachable | app-defined | `behavior`, `popoverShouldDetach` | not distinguishable |
| appearance | follows the app | | `appearance` | light, dark |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| open | yes | `10-15-Catalina-Light-Calendar.png @ 1820,820,640,360` |
| detached (panel with title bar) | no | [D] |
| opening / closing animation | no | [D] scale-and-fade from the anchor, about 0.2 s |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Corner radius | 6 (6.5 by the row-count rule: the top row reaches full opacity 13 px from the corner, 0.95 opacity at 10 px) | [M] | `10-15-Catalina-Light-Calendar.png @ 2410,828,23,1`, `@ 2429,826,1,21` |
| Arrow protrusion | 13 (apex x about 1826, body edge x=1852) | [M] | `10-15-Catalina-Light-Calendar.png @ 1820,960,40,60` |
| Arrow base width | 28-29 (the outline leaves the body edge at y about 961 and returns at y about 1018) | [M] | same crop |
| Arrow sides | straight at 45 degrees, joined to the body with a small concave fillet and to each other with a tip radius of about 2 | [M] shape, [C] radius | same crop: the edge moves 24 px in x over 25 rows |
| Arrow as SVG (pt; body edge at x=13, apex at x=0, centre y=14.5) | `M 13 0 C 13 2.5 12 3.5 10.5 5 L 1.4 13.1 C 0.6 13.9 0.6 15.1 1.4 15.9 L 10.5 24 C 12 25.5 13 26.5 13 29 Z` | [C] | fitted to the mask of the crop above |
| Arrow position | centred on the anchor; in Calendar its centre is 80.5 below the body top (y 989.5 vs 828) | [M] | same |
| Outer hairline | 0.5 | [M] | `@ 1851,900` (light), `10-15-Catalina-Dark-Calendar.png @ 2097,560` |
| Inner highlight (dark only) | 1 (2 px) all round, including the arrow | [M] | `10-15-Catalina-Dark-Calendar.png @ 2098,560,2,1`, `@ 2600,504,1,2`, `@ 2089,700,4,1` |
| Example sizes | Calendar event 289 x 162 (light), 289 x 182 (dark, two-line title); Reminders detail 290 wide; Maps place card 320 wide | [M] Calendar, [C] others from previews | `10-15-Catalina-Light-Calendar.png` body x 1852..2429, y 828..1151; `10-15-Catalina-Dark-Calendar.png` body x 2098..2675, y 504..867 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill (popover material, observed) | `#f2f2f2` over the white Calendar grid, over the Reminders list and over the Maps toolbar and map | `#282828` in Calendar, Reminders and Maps | [M] | `10-15-Catalina-Light-Calendar.png @ 2380,900`; `10-15-Catalina-Light-Reminders.png @ 1900,440`; `10-15-Catalina-Light-Maps.png @ 560,160`; `10-15-Catalina-Dark-Calendar.png @ 2565,560`; `10-15-Catalina-Dark-Reminders.png @ 1900,440`; `10-15-Catalina-Dark-Maps.png @ 700,300` |
| Top inner rows (light) | `#f3f3f3`-`#f6f6f6` on the first row | n/a | [M] | `10-15-Catalina-Light-Calendar.png @ 2410,828,7,1` |
| Outer hairline | `#b9b9b9` over white (black @ 0.27 including shadow; hairline itself about black @ 0.19) | `#050505` over the window (left edge); pure black at alpha 0.86-0.87 where the line lies outside the window over the capture's transparent background (right and top edges) | [M] | `10-15-Catalina-Light-Calendar.png @ 1851,900`; `10-15-Catalina-Dark-Calendar.png @ 2097,560`, `@ 2676,560`, `@ 2600,503` |
| Inner highlight | none | `#535353` = white @ 0.20 on the fill | [M], [C] | `10-15-Catalina-Dark-Calendar.png @ 2098,560` |
| Recommended opaque fallback | `#f2f2f2` | `#282828` | [M] | above |
| Material recipe | `backdrop-filter: blur(30px) saturate(1.5)` under `rgba(242,242,242,0.94)` | same blur under `rgba(40,40,40,0.94)` | [I] | the three backdrops measured give the same value to within one level, so the tint is nearly opaque; blur radius is not recoverable |

### Text and icons
App content. Calendar's event title is 15 pt Regular `#3f3f3f` light / `#ffffff` dark, secondary rows 13 pt, placeholders in tertiary grey [C]/[M] (`10-15-Catalina-Light-Calendar.png @ 1885,858,421,27`; `10-15-Catalina-Dark-Calendar.png @ 2129,534,255,66`). Hairline separators inside the popover span its full width.

### Shadows and effects
Small shadow class, see `window-shadow`: `0 0 0 0.5px rgba(0,0,0,0.19), 0 4px 16px rgba(0,0,0,0.26)` light; `0 0 0 0.5px rgba(0,0,0,0.86), 0 4px 16px rgba(0,0,0,0.30)` plus `inset 0 0 0 1px rgba(255,255,255,0.2)` dark [C] (dark fit RMS 0.002 on `10-15-Catalina-Dark-Calendar.png`). The shadow follows the arrow's outline.

## Layout and spacing
The arrow tip touches the anchor rectangle's edge midpoint (Calendar: the event block's right edge at x=1823, tip at x about 1826). The popover may extend beyond the parent window's frame (Calendar: 56.5 pt past the right edge; Reminders: 285 pt past the right edge; Maps: 15 pt above the top) [M]. Content padding is app-defined: Calendar uses 15 pt left padding [C].

## Keyboard and accessibility
Escape closes a transient popover; focus moves into the popover when it opens and returns to the anchor when it closes [D]. `AXPopover`. ARIA: non-modal `role="dialog"` with `aria-labelledby`, anchor button with `aria-expanded` and `aria-controls`.

## Browser notes
The arrow and body must be one path so the hairline and shadow follow the outline: use an SVG background or `clip-path` plus `filter: drop-shadow(0 4px 8px rgba(0,0,0,0.26))` (drop-shadow's blur parameter is a standard deviation, so 8px corresponds to a 16px box-shadow blur). Behind-window vibrancy is not available in a page; `backdrop-filter` only sees page content.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Calendar.png` | 1820,820,640,360 | event popover, arrow on the left edge, extends past the window |
| dark | `10-15-Catalina-Dark-Calendar.png` | 2060,496,660,400 | same, with inner highlight |
| light | `10-15-Catalina-Light-Reminders.png` | 1600,390,650,640 | reminder detail popover with controls |
| light | `10-15-Catalina-Light-Maps.png` | 420,60,660,1210 | place card, arrow on the right edge, extends above the window |

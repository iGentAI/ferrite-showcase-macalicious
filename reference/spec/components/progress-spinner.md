# Progress Indicator, spinning (`progress-spinner`)

- **Status:** present (indeterminate, small size)
- **AppKit:** `NSProgressIndicator` with `style = .spinning` (`isIndeterminate`, `controlSize`, `isDisplayedWhenStopped`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/indicators/progress-indicators/
- **Appearances shown:** light, dark

## Purpose and behaviour
The spinning indicator shows that work of unknown duration is under way (indeterminate), or, in its determinate form, a circle that fills clockwise. Use it where space is tight (next to a control, in a list row); hide it when the operation finishes; do not switch between a spinner and a bar for the same task. [D] (HIG, Progress Indicators)

## Anatomy
Twelve rounded spokes at 30 degree steps around a centre. One spoke is the head (strongest); the eleven behind it fade progressively. The head advances one spoke clockwise per step.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| controlSize | regular (32 pt), small (16 pt), mini (10 pt) | regular | `controlSize` | small |
| mode | indeterminate, determinate (pie) | indeterminate | `isIndeterminate` | indeterminate |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| spinning (one frame) | yes, light + dark | `10-15-Catalina-Light-Notes.png @ 215,166,32,32`; `10-15-Catalina-Dark-System-Preferences-Startup-Disk.png @ 1372,188,32,32` |
| stopped | not shown | hidden by default (`isDisplayedWhenStopped = false`) [D] |
| determinate pie | not shown | [I] 16 pt circle outline 1 pt with a filled sector from 12 o'clock clockwise, in the secondary label colour |

## Measurements
### Geometry (pt)
| Property | Value (small) | Tag | Evidence |
|---|---|---|---|
| Overall diameter | 16 | [M] | Dark Startup Disk grid `@ 1370,184,36,36`: ink x 1372..1403, y 188..219 |
| Spokes | 12, every 30 degrees, first at 12 o'clock | [M] | same grid: spokes at 12, 1, 2, 3 ... o'clock |
| Spoke length | 4.5 (inner end 3.5 pt from the centre, outer end 8 pt) | [M] | same grid: vertical spoke y 188..196, centre y=203.5 |
| Spoke width | 1.5, round ends | [M] | same grid: vertical spoke full at x 1387..1388 with half-covered pixels at 1386 and 1389; end rows lighter |
| Regular size | 32 diameter: spoke length 9, width 3 [I] | [I] | AppKit scales the same artwork by 2; not shown |
| Mini size | 10 diameter [I] | [I] | not shown |

### Colours and fills
Spoke opacity by position, counted from the head and going backwards (anticlockwise), sampled on one frame of each appearance:

| Spoke | Light: value on `#e7e7e7` -> black alpha | Dark: value on `#303030`-class -> white alpha | Tag | Evidence |
|---|---|---|---|---|
| head | `#494949` -> 0.68 | `#a2a2a2` -> 0.55 | [M] / [C] | Light Notes grid `@ 212,166,36,36` (head at 9 o'clock); Dark Startup Disk grid (head at 3 o'clock) |
| 2 | `#515151` -> 0.65 | `#939393` -> 0.48 | [M] / [C] | same grids |
| 3 | `#5d5d5d` -> 0.60 | `#858585` -> 0.41 | [M] / [C] | |
| 4 | `#696969` -> 0.55 | `#787878` -> 0.35 | [M] / [C] | |
| 5 | `#777777` -> 0.48 | `#6c6c6c` -> 0.29 | [M] / [C] | |
| 6 | `#858585` -> 0.42 | `#636363` -> 0.25 | [M] / [C] | |
| 7 | `#949494` -> 0.36 | `#5a5a5a` -> 0.20 | [M] / [C] | |
| 8 | `#a2a2a2` -> 0.30 | `#535353` -> 0.17 | [M] / [C] | |
| 9 | `#b0b0b0` -> 0.24 | `#4c4c4c` -> 0.14 | [M] / [C] | |
| 10 | `#bdbdbd` -> 0.18 | `#494949` -> 0.12 | [M] / [C] | |
| 11 | `#c8c8c8` -> 0.13 | `#454545` -> 0.10 | [M] / [C] | |
| 12 (just ahead of the head) | `#d0d0d0` -> 0.10 | `#434343` -> 0.09 | [M] / [C] | |

(The grids were dumped as luminance, so the values are grey levels; the spokes are neutral.)

### Text and icons
None.

### Shadows and effects
Animation: the pattern advances one spoke (30 degrees) clockwise per step, 12 steps per revolution; AppKit runs it at about one revolution per second. [I] (a still image cannot show the rate; direction follows from the fade order in both samples)

## Layout and spacing
Startup Disk: the spinner sits in the top right corner of the pane, right edge aligned with the content box (x 1403 vs box 1407), vertically centred on the heading line [M]. Notes: spinner ink x=215..246, y=166..197, centre (230.5,181.5); 9 pt blank gap after the "iCloud" heading ending x=196, with the same vertical ink centre (heading rows 174..189) [M] extents, [C] gap/alignment; `10-15-Catalina-Light-Notes.png @ 196,182,53,1` and `10-15-Catalina-Light-Notes.png @ 210,164,39,36`.

## Keyboard and accessibility
Not focusable. Role `AXProgressIndicator` (indeterminate) or `AXBusyIndicator`. ARIA: `role="progressbar"` without a value, or `aria-busy="true"` on the region with a visually hidden "Loading" label. [D]

## Browser notes
Draw 12 SVG `<line>`s with `stroke-linecap: round` and step the opacities with `animation-timing-function: steps(12)`; do not rotate smoothly, the native indicator steps.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Notes.png | 210,164,40,40 | small spinner in the sidebar |
| dark | 10-15-Catalina-Dark-System-Preferences-Startup-Disk.png | 1370,184,36,36 | small spinner at the top right of the pane |

# Progress Indicator, bar (`progress-bar`)

- **Status:** present (determinate only)
- **AppKit:** `NSProgressIndicator` with `style = .bar` (`isIndeterminate`, `minValue`, `maxValue`, `doubleValue`, `controlSize`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/indicators/progress-indicators/
- **Appearances shown:** light, dark

## Purpose and behaviour
Shows that the app has not stalled and how long the user will wait. A determinate bar fills from the leading edge for tasks of known duration and must report progress accurately; an indeterminate bar (a moving pattern) is for unquantifiable tasks. Use progress indicators in views, not window frames; keep them in consistent places; pair them with a Cancel button, or a Stop Progress icon button when interrupting has side effects. People do not interact with the indicator itself. [D] (HIG, Progress Indicators)

## Anatomy
1. Track: a 6 pt capsule.
2. Fill: accent-coloured, from the leading end to the current fraction.
3. Usually followed by a 14 pt Stop Progress button (x in a grey disc) and a status line below.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| mode | determinate, indeterminate | indeterminate | `isIndeterminate` | determinate |
| controlSize | regular, small | regular | `controlSize` | regular |
| value | 0..1 | - | `doubleValue` | 0.03 (Finder Copy light), 0.08 (Finder Copy dark), 0.64 (Time Machine) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| determinate, key window | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Time-Machine.png @ 914,353,398,12`; `10-15-Catalina-Light-Finder-Copy.png @ 226,157,614,12`; `10-15-Catalina-Dark-Finder-Copy.png @ 226,157,614,12` |
| indeterminate | not shown | [I] the track carries a lighter accent band about 30 % of the width sweeping left to right every 1.5 s (Catalina replaced the old barber pole with this sweep) |
| inactive window | not shown | [I] fill becomes grey (`#9b9b9b` light, `#6a6a6a` dark) |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Height | 6 | [M] | Light Time Machine col 1000: y 353..364; Light Finder Copy col 236: y 157..168 |
| End radius | 3 (capsule) | [M] | Light Time Machine grid `@ 912,352,6,12`: leftmost fill pixel at y 358..359 (x=914); the top and bottom rows start 3 px further in |
| Track border | 0.5 (light only) | [M] | Light Time Machine col 1250: y=353 and y=364 `#b7b7b7` |
| Fill border | 0.5, darker accent (light only) | [M] | Light Time Machine col 1000: y=353 and y=364 `#4378d5 (sRGB #3477dc)` |
| Fill trailing edge | one blended pixel at the centre row (the edge is vertical, not rounded, within the resolution sampled) | [M] | Light Time Machine row 358: x=1169 `#93b0e3 (sRGB #8db0e8)`; Light Finder Copy row 162: x=243 `#6196f2 (sRGB #5395f9)` |
| Lengths seen | 199 (Time Machine), 307 (Finder Copy) | [M] | rows cited above |
| Small size height | 4 [I] | [I] | AppKit small bar; not shown |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Track fill | `#d3d3d3` on `#e3e3e3`; `#dbdbdb` on `#ececec` = `rgba(0,0,0,0.07)` | `#4c4f52 (sRGB #4b4f52)` on `#2f3235 (sRGB #2e3235)` = `rgba(255,255,255,0.14)` | [M] / [C] | Time Machine col 1250; Finder Copy col 600 (light, dark) |
| Track border | `#b7b7b7` on `#e3e3e3`; `#bfbfbf` on `#ececec` = `rgba(0,0,0,0.19)`; end cap `#b9b9b9` | none | [M] / [C] | Time Machine col 1250 y 353; Finder Copy col 600 y 157; row 358 x=1311 |
| Fill | `#4d8af5 (sRGB #3b89fd)` | `#2e6bde (sRGB #1869e6)` | [M] | Time Machine col 1000 y 354..363; Dark Finder Copy col 236 |
| Fill border | `#4378d5 (sRGB #3477dc)` (top, bottom), `#477bd5 (sRGB #387adc)` (leading end) | none (leading pixel `#2e6ada (sRGB #1968e2)`) | [M] | Time Machine col 1000 y 353; row 358 x=914 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Status line under the bar | 11 pt regular, secondary label colour (`#717171` on `#e3e3e3`) | white @ 0.55 | [M] | Time Machine `@ 914,387,387,24` |
| Stop Progress button | 14 pt disc `#ababab` with a white x, 16.5 pt after the bar's trailing end, vertically centred on the bar | not shown (the dark Time Machine capture has no backup in progress) | [M] | Light Time Machine row 360: disc x 1345..1372; bar ends x=1311 |

### Shadows and effects
None.

## Layout and spacing
Time Machine: the bold title's cap top is 43 pt above the bar (y 267 vs 353); the secondary line above ends 14 pt above the bar (y 325); the first status line's cap top is 11.5 pt below the bar's bottom edge (y 364 vs 387). [M] The Finder Copy window layout is in `progress-window` (owner: dialogs).

## Keyboard and accessibility
Not focusable. Role `AXProgressIndicator` with `AXValue` (0..1) or indeterminate. ARIA: `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`; omit `aria-valuenow` when indeterminate. [D]

## Browser notes
Use two nested `div`s rather than `<progress>` (its pseudo-elements differ per engine). Animate width changes over about 0.25 s linear, as AppKit does.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Time-Machine.png | 914,353,460,14 | bar at 64 % with Stop button |
| light | 10-15-Catalina-Light-Finder-Copy.png | 226,157,614,12 | bar at 3 % in a progress window |
| dark | 10-15-Catalina-Dark-Finder-Copy.png | 226,157,614,12 | bar at 8 % |

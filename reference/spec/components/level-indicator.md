# Level Indicator (`level-indicator`)

- **Status:** the standard `NSLevelIndicator` is not seen in the screenshots. The Sound pane is captured on its Sound Effects tab (the input level meter is on the Input tab), About This Mac on Overview (not Storage), and no rating or relevance indicator appears. The closest visible element is Disk Utility's custom capacity bar, measured below as a reference for the continuous capacity style.
- **AppKit:** `NSLevelIndicator` (`levelIndicatorStyle`: `.continuousCapacity`, `.discreteCapacity`, `.rating`, `.relevancy`; `minValue`, `maxValue`, `warningValue`, `criticalValue`, `numberOfTickMarks`, `fillColor`, `warningFillColor`, `criticalFillColor`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/indicators/level-indicators/
- **Appearances shown:** light, dark (Disk Utility bar only)

## Purpose and behaviour
Graphically represents a value within a range. Three styles: capacity (continuous: a translucent track that fills with a coloured bar, often with tick marks; discrete: a row of equal segments that fill completely, never partially), rating (stars), and relevance (shaded bars). The default capacity fill is green; it can change at warning and critical levels (yellow, red) for the whole bar or in tiers. Use the continuous style for large ranges and tick marks only with the continuous style. Use level indicators in views, not window frames. [D] (HIG, Level Indicators)

## Anatomy
Continuous capacity: track, fill from the leading edge, optional tick marks below. Discrete capacity: N rounded segments with 1..2 pt gaps. Rating: N star glyphs. Relevance: a row of thin vertical bars.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| style | continuous capacity, discrete capacity, rating, relevance | continuous capacity | `levelIndicatorStyle` | none standard; custom continuous bar in Disk Utility |
| level colours | normal, warning, critical | green, yellow, red | `fillColor`, `warningFillColor`, `criticalFillColor` | no |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| custom capacity bar (Disk Utility) | yes, light + dark | `10-15-Catalina-Light-Disk-Utility.png @ 688,494,1200,48`; `10-15-Catalina-Dark-Disk-Utility.png @ 688,494,1200,48` |
| standard styles | not shown | values below are [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Disk Utility bar: size | 600 x 24 | [M] | Light Disk Utility row 518: x 688..1887; col 1200: y 494..541 |
| Disk Utility bar: border | 1 | [M] | col 1200: y 494..495 and 540..541 `#d1d1d1`; row 518 x 1886..1887 |
| Disk Utility bar: corner radius | Fitted by end and appearance, on the outer edge of the 1 pt border, range 4.75 to 5.125. Least-squares fit with `tools/corner_fit.py` over eight corners: the used (leading) end fits 4.75 in light (rms 1.68 levels; 3.64 at 5, 4.57 at 4.5, 15.9 at 3.5) and 4.875 in dark (rms 1.83; 2.20 at 5, 8.56 at 4.5); the empty (trailing) end fits 5.125 in light (rms 0.86; 1.16 at 5, 4.08 at 4.5) and 5 in dark (rms 0.74; 4.03 at 4.75, 3.40 at 5.25); top and bottom corners agree. The earlier value of 3.5 misread the grid: it took y=501, where the left edge is still blended, as the end of the arc, and the edge reaches its straight colour at y=503 | [C] fit from [M] pixels | `10-15-Catalina-Light-Disk-Utility.png @ 686,492,16,16`; `10-15-Catalina-Dark-Disk-Utility.png @ 686,492,16,16`; the other corners of both captures `@ 1874,492,16,16`, `@ 686,528,16,16`, `@ 1874,528,16,16` |
| Disk Utility bar: corner radius to build with | 5: one value for both ends and both appearances, the fitted 4.75 to 5.125 rounded. A rounded value, not a measurement; only the empty end in dark fits exactly 5. Until 3 October 2026 the row above led with "5" tagged [C] | [I] | the row above |
| Disk Utility bar: used segment | starts at the leading edge with its own 1 pt darker (light) or brighter (dark) outline; trailing edge square | [M] | row 518: x 688..689 `#47a0e3 (sRGB #12a1e9)`, fill 690..779; col 740: y 494..495 and 540..541 |
| Standard continuous capacity | 12 high track, radius 2, tick marks 1 x 4 below [I] | [I] | AppKit default height 12 pt (18 with ticks); not shown |
| Standard discrete capacity | 12 high segments, 2 pt gaps, radius 2 [I] | [I] | not shown |
| Rating | 13 pt stars, 16 pt pitch [I] | [I] | not shown |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Disk Utility bar: empty | `#ffffff` | `#38393a` (window `#303132`) | [M] | Disk Utility col 1200 y 496..539 |
| Disk Utility bar: border | `#d1d1d1` | `#808080` | [M] | col 1200 y 494 |
| Disk Utility bar: used fill | `#4eacf2 (sRGB #19adf8)` | `#3f6f92 (sRGB #2f7095)` | [M] | col 740 y 496..539 |
| Disk Utility bar: used outline | `#47a0e3 (sRGB #12a1e9)` | `#4eacf2 (sRGB #19adf8)` | [M] | col 740 y 494..495 |
| Standard track | `rgba(0,0,0,0.07)` with `rgba(0,0,0,0.19)` hairline | `rgba(255,255,255,0.14)` | [I] | reuses the measured `progress-bar` track, which AppKit draws with the same recipe |
| Standard fill: normal / warning / critical | `systemGreen` / `systemYellow` / `systemRed` (stored values in the lead's token sheet; the green status dot measured here is `#61c554`) | same system colours, dark variants | [D] / [I] | HIG: default fill is green, with yellow and red tiers |

### Text and icons
None in the control. Disk Utility's legend (10 pt colour squares with bold 13 pt names and sizes) is app-specific; see `apps/disk-utility.md`.

### Shadows and effects
None.

## Layout and spacing
A level indicator is introduced by a right-aligned label ending in a colon and centred on the bar. [D]

## Keyboard and accessibility
Read-only by default (editable ones accept arrow keys and clicks). Role `AXLevelIndicator` with value, min and max. ARIA: `role="meter"` (`<meter>`) with `aria-valuenow`, `low`, `high`, `optimum`. [D]

## Browser notes
`<meter>` styling is inconsistent across engines; build from `div`s. Discrete segments are easiest as a flex row with `gap: 2px`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Disk-Utility.png | 688,494,1200,48 | custom capacity bar (not `NSLevelIndicator`) |
| dark | 10-15-Catalina-Dark-Disk-Utility.png | 688,494,1200,48 | same, dark |

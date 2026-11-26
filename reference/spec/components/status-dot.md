# Status dot (`status-dot`)

- **Status:** present. New component (not in seed.json); family: indicators (sysB).
- **AppKit:** an `NSImageView` showing `NSImage.statusAvailableName`, `statusPartiallyAvailableName`, `statusUnavailableName` or `statusNoneName` (`NSStatusAvailable`, `NSStatusPartiallyAvailable`, `NSStatusUnavailable`, `NSStatusNone`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/icons-and-images/system-icons/
- **Appearances shown:** light, dark

## Purpose and behaviour
A small coloured disc that reports the state of a service or device: green for available / on / connected, yellow for partially available, red for unavailable / not connected, grey for none. It is not interactive. The colour must be accompanied by text ("Connected", "File Sharing: On") so that state is not conveyed by colour alone. [D] (AppKit system images; HIG system icons)

## Anatomy
A flat disc with a half-point darker rim of the same hue.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| status | available (green), partially available (yellow), unavailable (red), none (grey) | - | image name | green, red |
| size | 10 pt (list rows, status lines), 6 pt (compact row subtitle) | 10 | image size | both |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| green | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Network.png @ 168,308,20,20`; `...Sharing.png @ 586,392,20,20`; Dark same |
| red | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Network.png @ 168,392,20,20`; Dark same |
| yellow, grey | not shown | [I] yellow fill `#f5bf4f (sRGB #febe2d)`-class with rim 12 % darker; grey `#b0b0b0` |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Diameter | 10 | [M] | Light Network row 402: x 168..187; col 178: y 392..411 |
| Rim | 0.5 | [M] | Light Network row 402: x=168 and x=187 `#d24c42 (sRGB #e33f39)`, fill between |
| Compact diameter | 6 | [M] | `10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png` row 292: x 248..259; col 254: y 286..297 |
| Gap to following text | 6.5 (10 pt dot), 7 (6 pt dot) | [M] | Light Network: dot ends x=187, title ink x=201; Light Printers: dot ends 259, text ink 274 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Green fill | `#61c554 (sRGB #25c93f)` | `#61c454 (sRGB #27c840)` | [M] | Network `@ 178,318`; Sharing `@ 596,402` |
| Green rim | `#57ad48 (sRGB #28b135)` | `#51a642 (sRGB #1faa2e)` | [M] | Network row 318 x=168 |
| Red fill | `#ea564b (sRGB #fd4742)` | `#e9564c (sRGB #fc4743)` | [M] | Network `@ 178,402` |
| Red rim | `#d24c42 (sRGB #e33f39)` | `#c74237 (sRGB #d7332d)` | [M] | Network row 402 x=168 |
| Compact green fill / rim | `#63c756 (sRGB #29cb42)` / `#5eba51 (sRGB #2cbe3e)` | `#63c756 (sRGB #29cb42)` / `#5ab64c (sRGB #25ba38)` | [M] | Printers & Scanners row 292 |

### Text and icons
None.

### Shadows and effects
None.

## Layout and spacing
In list rows the dot is vertically centred on the row's two text lines (Network: row y 276..359, dot y 308..327). In a status line it is centred on the cap height of the bold status text (Sharing: dot y 392..411, text caps 391..415). [M]

## Keyboard and accessibility
Not focusable. Role `AXImage` with a description such as "connected"; never rely on colour alone. ARIA: `role="img"` with `aria-label`, or hide it and expose the text. [D]

## Browser notes
`width: 10px; height: 10px; border-radius: 50%; background: #61c554 (sRGB #25c93f); box-shadow: inset 0 0 0 0.5px #57ad48 (sRGB #28b135)`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Network.png | 168,300,20,120 | green and red dots in list rows |
| light | 10-15-Catalina-Light-System-Preferences-Sharing.png | 586,392,20,20 | green dot in a status line |
| light | 10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png | 248,286,12,12 | compact green dot |
| dark | 10-15-Catalina-Dark-System-Preferences-Network.png | 168,300,20,120 | green and red dots |
| dark | 10-15-Catalina-Dark-System-Preferences-Sharing.png | 586,392,20,20 | green dot |

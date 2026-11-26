# Finder folder banner (`window-banner`)

- **Status:** present (new component, not in the seed list)
- **AppKit:** custom Finder accessory view between the tab bar and the browser view ("Shared Folder" header shown for folders shared through File Sharing); the same strip style carries other Finder banners (for example AirDrop, iCloud Drive status, "Burn" for burn folders) [D] (Finder behaviour)
- **HIG:** https://web.archive.org/web/20200503170015/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/finder/ (no dedicated page)
- **Appearances shown:** light, dark

## Purpose and behaviour
An informational strip at the top of a Finder window's content area that states a property of the folder being shown. It is not interactive in the captured form.

## Anatomy
Flat strip the width of the content area (right of the sidebar), bold small text at the leading edge, two 0.5 pt rows at the bottom. It has the same colours and separator rows as the Finder scope bar.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| placement | under toolbar, under tab bar | follows enabled chrome [M] | custom accessory view | Gallery / Home respectively |
| content | information text, optional action | app-defined [I] | custom view | Shared Folder text only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| text only | yes | `10-15-Catalina-Light-Finder-Home.png @ 442,236,1880,50` |
| with a trailing button | no | [I] round-rect scope button as in `scope-bar` |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Height | 25 = 24 fill (y 236..283) + two 0.5 rows (y 284, 285) | [M] | `10-15-Catalina-Light-Finder-Home.png @ 1000,236,1,50` |
| Height without tab bar | same module at y 186..235 | [M] | `10-15-Catalina-Light-Finder-Gallery-View.png @ 1200,230,1,6` (rows `#e1e1e1`, `#cecece` at y 234, 235) |
| Text leading inset | 11 from the content edge (ink x 464, content from 442) | [M] | `10-15-Catalina-Light-Finder-Home.png @ 464,252,167,19` |
| Text cap height | 15 px -> 11 pt, Bold; baseline 17 below the strip top | [C] | same crop (ink rows y 252..270 with descender) |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill | `#f0f0f0` | `#2b2e30 (sRGB #2a2e30)` | [M] | `10-15-Catalina-Light-Finder-Home.png @ 1000,250`; `10-15-Catalina-Dark-Finder-Home.png @ 1000,250` |
| Bottom rows | `#e1e1e1`, `#cecece` | `#3a3d3f (sRGB #393d3f)`, `#4d5052 (sRGB #4c5052)` | [M] | `@ 1000,284`, `@ 1000,285` in both |
| Text | `#717171` | `#a7aaac (sRGB #a6aaac)` | [M] | darkest/lightest ink in `10-15-Catalina-Light-Finder-Home.png @ 450,240,300,44`; `10-15-Catalina-Dark-Finder-Home.png @ 462,244,400,30` |

### Text and icons
The measured label style is the 11 pt Bold row above [C]; this variant contains no icon [M] in the evidence crops. Dark text colour is still inferred [I], not a sampled RGB value.

### Shadows and effects
No independent banner shadow [M]; the two measured bottom separator rows meet the browser content directly. Reuse `scope-bar` separation, not `window-shadow`.

## Layout and spacing
Below the tab bar (or toolbar) and above the browser view; does not cover the sidebar.

## Keyboard and accessibility
Static text (`AXStaticText`); in HTML a `<div role="note">`.

## Browser notes
Reproducible.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Home.png` | 442,236,1880,50 | "Shared Folder" banner under the tab bar |
| dark | `10-15-Catalina-Dark-Finder-Home.png` | 442,236,1818,50 | same |
| light | `10-15-Catalina-Light-Finder-Gallery-View.png` | 442,186,2138,50 | banner directly under the toolbar |

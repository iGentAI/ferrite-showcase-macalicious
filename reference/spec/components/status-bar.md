# Status bar, window bottom bar (`status-bar`)

- **Status:** present as app-specific bottom bars; Finder's item-count/free-space status bar is not seen in the screenshots
- **AppKit:** custom `NSView` at the bottom of the content (Finder's View > Show Status Bar); a true frame-level bottom bar is `NSWindow.setContentBorderThickness(_:for: .minY)`
- **HIG:** https://web.archive.org/web/20200503141343/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/ ("Bottom Bar")
- **Appearances shown:** light, dark for the Automator, Script Editor and System Information bottom bars. Checked all eight Finder window surfaces in both appearances (Network, Home, Gallery View, Search, Applications, Utilities, Quick Look, Quick Look Markup) and the Open panels: none shows the "N items, X GB available" strip; the only bottom strip is the empty path bar in Finder Search (see `path-bar`).

## Purpose and behaviour
"In rare cases, a window may include a bottom bar that resides below the body area and includes controls for affecting the content of the window" [D]. Finder's status bar is informational: item count and free space, centred, plus an icon-size slider at the trailing end in icon view [D] (Finder behaviour).

## Anatomy
Top separator, flat bar, centred small text, optional trailing slider.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| role | informational status, bottom command strip, breadcrumb strip | app-defined [D] | custom `NSView` / content border | Automator command strip, Script Editor command strip, System Information breadcrumb strip |
| Finder count/free-space variant | hidden, shown | app-defined [D] | View > Show Status Bar | not shown; provisional values below remain [I] |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Finder count/free-space variant | no | values below are [I], modelled on the measured path bar, which is the neighbouring Finder strip |
| Automator / Script Editor / System Information normal bottom bar | yes, both appearances | measured additions below; toolbar-like buttons in the first two, noninteractive breadcrumb in the third |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Basis |
|---|---|---|---|
| Height | 23 (22 fill + 1 separator) | [I] | Finder status bar; path bar measured at 24 + 1 |
| Text | 11 pt Regular, centred horizontally and vertically | [I] | small system font |
| Icon-size slider | small slider, 64 wide, 8 from the trailing edge | [I] | |

### Colours and fills
| Part | Light | Dark | Tag | Basis |
|---|---|---|---|---|
| Fill | `#f0f0f0` | `#2b2c2f` | [I] | path bar fill, measured in `path-bar` |
| Top rows | `#cecece`, `#e1e1e1` | `#4d4e51`, `#3a3b3e` | [I] | path bar |
| Text | `#717171` | `#a7a8ab` | [I] | secondary text measured in `scope-bar` |

### App bottom bars actually shown
Do not implement these as Finder's count/free-space strip. Automator contains an action-menu gear and a small checkbox-like control at the leading edge, then two view toggles for the workflow log. Script Editor contains Info, return/result and list/log glyph buttons. System Information contains a small computer icon and the breadcrumb `ismh15 > Hardware`. Their control behaviours are app-specific [I] from the displayed affordances; the captures show no interaction.

| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Automator height, including separator and window bottom highlight | 21 pt, y 1770..1811 | same | [M] | `10-15-Catalina-Light-Automator.png @ 1200,1764,1,49`; `10-15-Catalina-Dark-Automator.png @ 1200,1764,1,49` |
| Automator top two separator rows | `#cfcfcf`, `#cecece` | `#626465`, `#636364` | [M] | `10-15-Catalina-Light-Automator.png @ 1200,1770`; `10-15-Catalina-Light-Automator.png @ 1200,1771`; `10-15-Catalina-Dark-Automator.png @ 1200,1770`; `10-15-Catalina-Dark-Automator.png @ 1200,1771` |
| Automator fill gradient after separator | `#e4e4e4` at y=1772 to `#cdcdcd` at y=1810 | `#3e4041` at y=1772 to `#333536` at y=1809 (before two inner-highlight rows) | [M] | columns above; this bar is not a flat Finder path-bar fill |
| Script Editor height, including top separator | 23 pt, y 1440..1485 | same | [M] | `10-15-Catalina-Light-Script-Editor.png @ 800,1434,1,53`; `10-15-Catalina-Dark-Script-Editor.png @ 800,1434,1,53` |
| Script Editor separator / flat fill sample | `#b2b2b2` / `#ececeb` | `#646465` / `#323232` | [M] | `10-15-Catalina-Light-Script-Editor.png @ 800,1440`; `10-15-Catalina-Light-Script-Editor.png @ 800,1441`; `10-15-Catalina-Dark-Script-Editor.png @ 800,1440`; `10-15-Catalina-Dark-Script-Editor.png @ 800,1441` |
| System Information height, including two top separator rows | 21 pt, y 1074..1115 | same | [M] | `10-15-Catalina-Light-System-Information.png @ 800,1066,1,51`; `10-15-Catalina-Dark-System-Information.png @ 800,1066,1,51` |
| System Information separator / fill | `#d5d5d5` (two rows) / `#ececec` | `#444546` (two rows) / `#303132` | [M] | `10-15-Catalina-Light-System-Information.png @ 800,1074`; `10-15-Catalina-Light-System-Information.png @ 800,1090`; `10-15-Catalina-Dark-System-Information.png @ 800,1074`; `10-15-Catalina-Dark-System-Information.png @ 800,1090` |
| System Information breadcrumb stem sample | `#757575` | `#a2a3a3` | [M] | `10-15-Catalina-Light-System-Information.png @ 177,1098`; `10-15-Catalina-Dark-System-Information.png @ 311,1099` |

### Text and icons
Finder's hypothetical text size is the inferred 11 pt row above. System Information uses a small secondary breadcrumb label; exact font size is not derived here [I]. Automator and Script Editor bottom strips use image-only buttons (reuse `image-button`); do not add an item-count label absent from the capture.

### Shadows and effects
No separately measurable bottom-bar shadow [M] in the columns cited above. The bottom rows are the parent window's edge highlight; reuse `window` and its external `window-shadow`, not a second bar shadow.

## Layout and spacing
Bottom of the window, below the path bar; clipped by the window's bottom corners.

## Keyboard and accessibility
`AXStaticText`; in HTML `role="status"` with `aria-live="polite"` so count changes are announced.

## Browser notes
Nothing special.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Automator.png` | 112,1770,2000,42 | workflow/library bottom command strip |
| dark | `10-15-Catalina-Dark-Automator.png` | 112,1770,2000,42 | same |
| light | `10-15-Catalina-Light-Script-Editor.png` | 112,1440,1400,46 | Info/result/log bottom command strip |
| dark | `10-15-Catalina-Dark-Script-Editor.png` | 112,1440,1400,46 | same |
| light | `10-15-Catalina-Light-System-Information.png` | 112,1074,1502,42 | computer icon and hardware breadcrumb |
| dark | `10-15-Catalina-Dark-System-Information.png` | 112,1074,1502,42 | same |

No Finder count/free-space status bar is shown. The earlier Finder-specific numbers are explicitly provisional, not measurements.

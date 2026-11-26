# Toolbar (`toolbar`)

- **Status:** present
- **AppKit:** `NSToolbar` (`displayMode = .iconOnly | .iconAndLabel | .labelOnly`, `sizeMode`), unified with the title bar; `window.titleVisibility = .hidden` for the one-row variant
- **HIG:** https://web.archive.org/web/20200503121036/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/toolbars/
- **Appearances shown:** light, dark

## Purpose and behaviour
A toolbar gives quick access to frequent commands and sits in the frame below, or integrated with, the title bar [D]. Items are either image buttons or the toolbar-specific system controls: textured rounded push button, textured rounded or separated segmented control, textured rounded pop-up and pull-down button, and search field; these styles must not be used in the window body [D]. Toolbars are usually customisable (icons, text, or both), can be hidden, and may be hidden automatically in full screen and revealed with the menu bar [D]. Clicking an item acts immediately; only segmented controls keep a selected appearance [D]. A toolbar above a scroll view becomes translucent [D].

## Anatomy
The toolbar has no background of its own: it shares the title bar gradient (see `title-bar`). Contents, leading to trailing: [window controls in the title-hidden variant] items and groups, flexible space, trailing items (search field last).

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| display mode | icon only, icon and text, text only | icon only | `displayMode` | icon only (Finder, Safari, Preview); icon and text (Disk Utility, Automator); text only not shown |
| title | visible (55 pt chrome), hidden (38 pt chrome) | visible | `titleVisibility` | both |
| size mode | regular, small | regular | `sizeMode` | regular only |
| full screen | always shown, auto-hidden | app-defined | `NSWindow.Delegate` | shown with menu bar revealed (Photos) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| key | yes | all window captures |
| main, not key | yes | Finder in `10-15-Catalina-Light-Finder-Quick-Look.png @ 141,258,1340,110`: identical to key |
| inactive | yes | Safari in `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 316,104,1900,76`: flat bar, outlined flat buttons, grey glyphs (see `toolbar-button`) |
| customisation sheet | no | [D] |
| hidden | no | [D] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Control height (all toolbar controls) | 22 fill, 23 with the 0.5 pt light-appearance borders | [M] | `10-15-Catalina-Light-Finder-Network.png @ 135,125,1,47` |
| Item row top, title visible | 25 below window top | [M] | fill starts y=126, frame top 76 |
| Item row top, title hidden | 8 below window top | [M] | `10-15-Catalina-Light-Safari-v13.png @ 300,91,1,47` (fill y 92..135) |
| Item row top, utility panel (Help) | 19 | [M] | `10-15-Catalina-Light-Help.png @ 90,75,1,47` (fill y 76..119, frame top 38) |
| Item row top, icon-and-text mode | 26 (Disk Utility), 25 (Automator) | [M] | `10-15-Catalina-Light-Disk-Utility.png @ 150,127,1,47`; `10-15-Catalina-Light-Automator.png @ 150,125,1,47` |
| Space below the controls to the chrome's bottom edge | 8 (16 px: border, 13 px of bar, shadow row, separator) | [M] | `10-15-Catalina-Light-Finder-Network.png @ 135,170,1,16` |
| Leading and trailing margin | 8 | [M] | first fill x=128 (frame left 112); search fill ends x=1947, frame right 1963 |
| Gap between adjacent items/groups | 8 (Finder, Preview, Help, System Preferences); 10 between the Back/Forward pair and the sidebar button in Safari | [M] | Finder fills end/start 671/688, 779/796, 887/904, 979/996 at y=150; Safari 369/390 at y=100 |

Finder default toolbar (fill extents in px at y=150, `10-15-Catalina-Light-Finder-Network.png`, frame x 112..1963) [M]:
| Item | x from..to (px) | Width (pt) | Offset of leading edge from window left (pt) |
|---|---|---|---|
| Back | 128..177 | 25 | 8 |
| Forward | 180..229 | 25 | 34 |
| View switcher (4 segments) | 452..671 | 110 | 170 |
| Group (arrange) pull-down | 688..779 | 46 | 288 |
| Action pull-down | 796..887 | 46 | 342 |
| Share | 904..979 | 38 | 396 |
| Edit Tags | 996..1071 | 38 | 442 |
| Search field | 1302..1947 | 323 | window width - 331 |

### Colours and fills
Background: see `title-bar` (key gradient, inactive flat fill, translucency note). Items: see `toolbar-button`, `toolbar-segmented-control`, `toolbar-pop-up`, `toolbar-search-field`, `toolbar-labelled-item`.

### Text and icons
Glyphs are template images about 14 x 10 to 16 x 15 pt drawn in the control text colour (`#555555` light, near white in dark) [M] (see `toolbar-button`).

### Shadows and effects
None in a window. In full screen the bar (revealed together with the menu bar) casts a shadow on the content: rows below the separator read `#bdbdbd`, `#c0c0c0`, `#c4c4c4`, `#c7c7c7`, `#cacaca`, `#cecece` over white [M] `10-15-Catalina-Light-Full-Screen-App.png @ 1000,120,1,6`.

## Layout and spacing
- Leading items start 8 pt from the window edge (or 13 pt after the zoom button in the title-hidden variant); the search field is right-aligned with an 8 pt margin.
- Items keep their size; a flexible space absorbs width changes; when the window is too narrow, trailing items move into a `>>` overflow menu (visible in `10-15-Catalina-Light-Split-Screen-Apps.png @ 1436,18,40,40`, Notes) [M].
- Empty toolbar areas drag the window [D].

## Keyboard and accessibility
Toolbar items are reachable with Full Keyboard Access (Control-F5 moves focus to the toolbar) [D]; every item must also exist as a menu command [D]. `AXToolbar` containing `AXButton`, `AXRadioGroup` (segmented), `AXPopUpButton`/`AXMenuButton`, `AXTextField` (search). ARIA: `role="toolbar"` with roving tabindex and arrow-key navigation.

## Browser notes
Use `-webkit-app-region: drag` equivalents only in Electron; in a page the bar is a plain flex row. The translucent state over scrolled content needs `backdrop-filter`; the opaque gradient is the fallback.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Network.png` | 112,76,1852,110 | icon-only toolbar under a title |
| dark | `10-15-Catalina-Dark-Finder-Network.png` | 112,76,1998,110 | same |
| light | `10-15-Catalina-Light-Safari-v13.png` | 112,76,2648,76 | title-hidden toolbar |
| light | `10-15-Catalina-Light-Disk-Utility.png` | 112,76,1852,140 | icon-and-text mode |
| light | `10-15-Catalina-Light-Full-Screen-App.png` | 0,44,3360,82 | full-screen toolbar with shadow |

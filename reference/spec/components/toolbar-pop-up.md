# Toolbar pop-up and pull-down buttons (`toolbar-pop-up`)

- **Status:** present
- **AppKit:** `NSPopUpButton` with `bezelStyle = .texturedRounded`; `pullsDown = true` for the Group and Action buttons; `NSMenuToolbarItem` (10.15) for menu items
- **HIG:** https://web.archive.org/web/20200503121036/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/toolbars/ ; https://web.archive.org/web/20200503154252/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/pull-down-buttons/ ; https://web.archive.org/web/20200503110755/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/pop-up-buttons/
- **Appearances shown:** light, dark

## Purpose and behaviour
A textured rounded button that opens a menu. A pull-down shows an icon (often the Action gear) and a downward chevron and lists commands; a pop-up shows the current choice [D]. The HIG recommends an Action pull-down in the toolbar instead of an app-specific toolbar contextual menu [D]. The menu opens below the button (see `menu`).

## Anatomy
`toolbar-button` bezel; glyph (or title) leading; single downward chevron trailing. Split variant: a main button and a narrow chevron segment separated by a 1 pt divider.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| kind | pull-down (icon + chevron), pop-up (title + chevron), split (action + menu segment) | pull-down | `pullsDown`, `NSSegmentedControl` with menu | pull-down: Finder Group and Action, Preview sidebar menu, Disk Utility View; split: Preview Highlight; pop-up with title: not shown in a toolbar (TextEdit's format bar pop-ups belong to `ruler`) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes | `10-15-Catalina-Light-Finder-Network.png @ 687,125,94,47` (Group), `@ 795,125,94,47` (Action) |
| disabled | yes | Preview Highlight split button with nothing selectable, `10-15-Catalina-Light-Preview.png @ 1124,125,106,47` |
| open (menu shown) | no | [I] bezel as `toolbar-button` on-state while the menu is open |
| inactive window | no | [I] as `toolbar-button` inactive |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Height / radius | 22 / light 4.25, on the outer edge of the 0.5 pt border; dark 3.75, on the edge of the fill, which has no border in dark (the same shape as the light fill inside its border). Least-squares fits with `tools/corner_fit.py` to the top-left corner of the Finder Group pop-up: light best 4.25 (rms 1.3 levels; 2.5 at 4, 2.3 at 4.5); dark best 3.75 (rms 1.6; 2.2 at 3.5, 3.0 at 4). The toolbar behind the control is a gradient within 4 levels over the compared square and was taken as flat. The other corners and captures are not fitted. Until 3 October 2026 this row gave 4.25 for both appearances, carried over from `toolbar-button` and tagged [I]; before the fits it gave 4 tagged [M], which was taken by reference to `toolbar-button` and was not a direct measurement of this control | [M] height; [C] radius, fit from [M] pixels | height as `toolbar-button`; fit corners `10-15-Catalina-Light-Finder-Network.png @ 687,125,12,12` and `10-15-Catalina-Dark-Finder-Network.png @ 622,126,12,12` |
| Width, Finder Group and Action | 46 (fill x 688..779 and 796..887 at y=150) | [M] | `10-15-Catalina-Light-Finder-Network.png @ 684,150,100,1` |
| Width, Preview sidebar menu | 36 (fill x 128..199 at mid-height; the cited row, 2 px below the bezel top, reads 130..197 because of the corner curve) | [M] | `10-15-Catalina-Light-Preview.png @ 126,128,76,1` |
| Width, Disk Utility View | 46 (fill x 128..219) | [M] | `10-15-Catalina-Light-Disk-Utility.png @ 122,150,100,1` |
| Split button (Preview Highlight) | main part 33 + 1 divider + chevron part 19 (fill x 1124..1229 at mid-height, 1126..1227 on the cited row; divider x 1190..1191) | [M] | `10-15-Catalina-Light-Preview.png @ 1122,128,110,1` |
| Glyph + chevron group width | 31 (62 px) centred: icon, 6-7 pt gap, chevron | [M] | `10-15-Catalina-Light-Finder-Network.png @ 708,136,62,26` |
| Chevron | 7.5 wide x 4.5 high (15 x 9 px), stroke 1.5, pointing down, its vertical centre on the button centre | [M] | `10-15-Catalina-Light-Finder-Network.png @ 757,144,15,9` |
| Chevron as SVG (pt) | `M 0.75 0.75 L 3.75 3.75 L 6.75 0.75` stroke-width 1.5, square caps | [C] | from the same mask |
| Chevron inset from the trailing fill edge | 4 (x 771 -> 779) | [M] | same |

### Colours and fills
Bezel, glyph and disabled colours exactly as `toolbar-button` [M] (`10-15-Catalina-Light-Finder-Network.png @ 799,128,86,40`: glyph `#555555`; `10-15-Catalina-Dark-Finder-Network.png @ 733,128,86,40`: glyph `#faf9fb` on `#666768`). Split divider: `#e2e2e2` light [M] `10-15-Catalina-Light-Preview.png @ 1190,128`; dark `#5d5e60` [M] `10-15-Catalina-Dark-Preview.png @ 1936,128`.

### Text and icons
Action gear glyph 14 x 14 pt (28 px rows y 134..161) [M]; Group glyph 14 x 13 pt. A title, when used, is 13 pt Regular [I].

### Shadows and effects
As `toolbar-button`.

## Layout and spacing
The menu's leading edge aligns with the button's leading edge and its top sits just below the button [D]. 8 pt to neighbouring items.

## Keyboard and accessibility
Space or Down Arrow opens the menu when focused; arrow keys and Return choose; Escape closes [D]. `AXMenuButton` / `AXPopUpButton`. ARIA: `<button aria-haspopup="menu" aria-expanded>` controlling a `role="menu"`.

## Browser notes
Reproducible; the chevron is an inline SVG, not a font glyph.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Finder-Network.png` | 684,122,208,52 | Group and Action pull-downs |
| dark | `10-15-Catalina-Dark-Finder-Network.png` | 618,122,208,52 | same |
| light | `10-15-Catalina-Light-Preview.png` | 1120,122,112,52 | split Highlight button (disabled) |
| light | `10-15-Catalina-Light-Disk-Utility.png` | 124,124,100,52 | View pull-down in icon-and-text mode |

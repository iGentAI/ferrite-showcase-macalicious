# Submenu (`submenu`)

- **Status:** present (parent items with the disclosure arrow are shown; no screenshot has a submenu open)
- **AppKit:** `NSMenuItem.submenu`, `NSMenu.setSubmenu(_:for:)`
- **HIG:** https://web.archive.org/web/20200503171533/https://developer.apple.com/design/human-interface-guidelines/macos/menus/menu-anatomy/
- **Appearances shown:** light, dark (closed state only)

## Purpose and behaviour
A submenu groups related commands under one parent item. The parent shows a right-pointing triangle at its trailing edge; pointing at it (after a short delay) or pressing Right opens the submenu beside the parent. The HIG advises one level of submenus at most and at least a handful of items per submenu [D].

## Anatomy
Parent `menu-item` with a 9 x 10 pt filled triangle in place of a key equivalent, plus (when open) a detached `menu` container placed to the right.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| side | right of parent; left when there is no room | right | automatic | not shown |
| parent state | normal, highlighted (stays highlighted while the submenu is open), disabled | normal | - | normal only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| closed, parent normal | yes | Recent Items: 10-15-Catalina-Light-Apple-Menu.png @ 20,214,416,38; Services: 10-15-Catalina-Light-Finder-Menu.png @ 90,238,358,38; Recent Folders: 10-15-Catalina-Light-Finder-Go-Menu.png @ 482,676,402,38 (dark: same coordinates in the Dark-* files) |
| open | no | [I] below |
| parent highlighted | no | [I] parent row uses the normal highlight fill with a white arrow (same rule as highlighted key equivalents, see `menu-item`) |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Arrow size | 9 wide x 10 high (ink px 394..411, y=223..242) | [M] | 10-15-Catalina-Dark-Apple-Menu.png @ 392,220,22,24 |
| Arrow shape | filled triangle, vertices (0,0) (9,5) (0,10) | [M] | same grid: left edge solid from y=224 to 241, apex at x=411, y=233 |
| Arrow right inset | 12 from the menu's right edge (ink ends 411, 423, 859 px with edges 435, 447, 883) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 394,223,18,20; 10-15-Catalina-Light-Finder-Menu.png @ 406,247,18,20; 10-15-Catalina-Light-Finder-Go-Menu.png @ 842,685,18,20 |
| Arrow vertical position | centred in the 19 pt row (rows 223..242 in row 214..251) | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 394,214,18,38 |
| Open submenu: horizontal offset | left edge of the submenu at the parent menu's right edge minus 1 pt (the hairlines overlap) | [I] | not shown; AppKit places submenus flush with a hairline overlap |
| Open submenu: vertical offset | submenu top = parent row top - 4 pt, so the first submenu item is level with the parent item | [I] | not shown; follows from the 4 pt top padding measured in `menu` |
| Open submenu container | detached `menu`: all corners 5 pt, same material, border and shadow | [D]/[I] | same `NSMenu` window class |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Arrow, normal | title colour (`#0d2c40 (sRGB #002c42)` on the sky-backed menu) | `#ffffff` | [M] | 10-15-Catalina-Light-Apple-Menu.png @ 400,228,1,11; 10-15-Catalina-Dark-Apple-Menu.png @ 400,228 |
| Arrow, parent highlighted | `#ffffff` | `#ffffff` | [I] | by analogy with highlighted key equivalents |
| Arrow, parent disabled | disabled text colour | disabled text colour | [I] | - |

### Text and icons
As `menu-item`.

### Shadows and effects
As `menu`.

## Layout and spacing
The arrow occupies the key-equivalent area; an item cannot have both. Submenu opens after about 0.2 s of hover [I] and closes when the pointer leaves toward another item (with the usual diagonal-movement tolerance [I]).

## Keyboard and accessibility
Right or Return opens and moves into the submenu; Left or Esc closes it and returns to the parent [D]. AX: parent `AXMenuItem` has an `AXMenu` child. ARIA: parent `aria-haspopup="menu"` + `aria-expanded`; child `role="menu"`.

## Browser notes
Implement the hover-intent triangle (safe area between pointer and submenu) in script; CSS alone closes the submenu on diagonal moves.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Apple-Menu.png | 20,214,416,38 | "Recent Items" parent row |
| dark | 10-15-Catalina-Dark-Apple-Menu.png | 20,214,416,38 | same, dark |
| light | 10-15-Catalina-Theme-Light-Blue.png | 91,114,470,38 | "Services" parent row in the System Preferences menu |

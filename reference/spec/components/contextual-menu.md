# Contextual menu (`contextual-menu`)

- **Status:** not seen in the screenshots (no Control-click menu is open in any of the 294 files). The closest sighting is a detached action menu opened from a field label in Contacts, which uses the same `NSMenu` pop-up container.
- **AppKit:** `NSMenu.popUpContextMenu(_:with:for:)`, `NSView.menu`, `NSResponder.menu(for:)`
- **HIG:** https://web.archive.org/web/20200503161507/https://developer.apple.com/design/human-interface-guidelines/macos/menus/contextual-menus/
- **Appearances shown:** none directly; dark via the Contacts action menu

## Purpose and behaviour
A contextual (shortcut) menu gives access to frequently used commands for the item under the pointer; it opens on Control-click or secondary click. The HIG asks that every contextual command also exists in the menu bar, that the menu stays short, that unavailable items are omitted or dimmed, and that key equivalents are not displayed in contextual menus [D].

## Anatomy
A detached `menu` (all four corners rounded) whose top-left corner sits at the pointer; `menu-item` rows at 14 pt; no key-equivalent column.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| font | 14 pt (system menu font) or the view's control-size font when `NSMenu.font` is set | 14 | `NSMenu.font` | 14 pt in the Contacts action menu |
| position | pointer location; flips up/left near screen edges | below-right of pointer | automatic | not shown |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| open (Control-click) | no | - |
| closest analogue: detached action menu | yes (dark) | 10-15-Catalina-Dark-Contacts.png @ 1148,432,358,130 ("Send Email", "Send Message" highlighted, "Search with Spotlight") |

## Measurements
All values are those of `menu` and `menu-item`; the ones confirmed on the detached Contacts menu are tagged [M], the rest [D]/[I].

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Corner radius | 5 on all four corners | [M] | 10-15-Catalina-Dark-Contacts.png @ 1145,429,15,14 |
| Padding top / bottom | 4 / 4 (fill y=435..558, rows 440..553) | [M] | 10-15-Catalina-Dark-Contacts.png @ 1156,432,1,130 |
| Row height | 19 (highlight y=478..515) | [M] | 10-15-Catalina-Dark-Contacts.png @ 1156,478,1,38 |
| Left text inset | 21 (ink from px 1191 in a menu starting at 1148) | [M] | 10-15-Catalina-Dark-Contacts.png @ 1191,485,188,27 |
| Right text margin | 20.5 (longest title ends px 1464, edge 1505) | [M] | 10-15-Catalina-Dark-Contacts.png @ 1191,522,274,28 |
| Width | 179 for these three titles | [M] | 10-15-Catalina-Dark-Contacts.png @ 1148,484,358,1 |
| Origin relative to pointer | top-left corner at the pointer hot spot, 1 pt right and below | [I] | AppKit behaviour; not shown |
| Key equivalents | none displayed | [D] | HIG, Contextual Menus |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill | as `menu` (`#f0f0f0` fallback) | `#333536` over a dark window | [D] light / [M] dark | 10-15-Catalina-Dark-Contacts.png @ 1156,435,1,42 |
| Inner border | 0.5 pt `rgba(255,255,255,0.17)` | 1 pt lighter line all round (`#545454`, `#4a4c4f` on rows y=433..434) | [I] light / [M] dark | 10-15-Catalina-Dark-Contacts.png @ 1154,433,1,2 |
| Outer hairline | 0.5 pt `rgba(0,0,0,0.15)` | 0.5 pt near-black (`#050506` at x=1147) | [I] light / [M] dark | 10-15-Catalina-Dark-Contacts.png @ 1147,484 |
| Highlight | as `menu-item` | `#2969ce (sRGB #0967d5)` | [D] light / [M] dark | 10-15-Catalina-Dark-Contacts.png @ 1156,478,1,38 |
| Text | as `menu-item` | `#ffffff` | [D] / [M] | 10-15-Catalina-Dark-Contacts.png @ 1191,446,140,23 |

### Text and icons
14 pt Regular (cap + ascender 23 px on "Send Email") [C] 10-15-Catalina-Dark-Contacts.png @ 1191,446,140,23.

### Shadows and effects
As `menu` [D].

## Layout and spacing
Items that apply to the clicked object come first; separators group them; common tail items (Services, Share) come last [D].

## Keyboard and accessibility
Control-click, secondary click, or VO-Shift-M (VoiceOver) opens it; arrows/Return/Esc as any menu [D]. ARIA: `role="menu"` opened from a `contextmenu` event; return focus to the invoking element on close.

## Browser notes
Suppress the browser's own context menu with `preventDefault()` on `contextmenu`; position with `position: fixed` and clamp to the viewport.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| dark | 10-15-Catalina-Dark-Contacts.png | 1136,420,384,154 | detached action menu (closest analogue) |
| light | - | - | not shown; see `menu` (10-15-Catalina-Light-Print.png @ 960,285,520,270 for a detached light menu) |

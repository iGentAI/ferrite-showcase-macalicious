# Favorites bar (`favorites-bar`)

- **Status:** not seen in the screenshots
- **AppKit:** custom Safari view (`FavoritesBarView`); in other apps a bookmarks bar is a plain accessory view under the toolbar (`NSTitlebarAccessoryViewController`, `layoutAttribute = .bottom`)
- **HIG:** https://web.archive.org/web/20200503121036/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/toolbars/ (no dedicated page)
- **Appearances shown:** none. All fourteen Safari captures have View > Hide Favorites Bar in effect: the tab bar starts directly under the 38 pt toolbar (`10-15-Catalina-Light-Safari-v13.png @ 112,150,2648,4`). The Favorites *page* and the Bookmarks sidebar in `10-15-Catalina-Light-Safari-v13-Favorites.png` are different elements, described in `apps/safari.md`.

## Purpose and behaviour
A one-line strip of bookmark titles (and folder pull-downs) between the toolbar and the tab bar. Clicking a title opens the page; a folder opens a menu; items that do not fit go into a trailing `>>` overflow menu; items can be dragged to reorder [D] (Safari User Guide behaviour, not a HIG component).

## Anatomy
Bar background continuing the toolbar surface; text-only buttons separated by spacing; optional folder chevrons; overflow button.

## Variants and parameters
| Parameter | Values | Shown |
|---|---|---|
| item | bookmark (title), folder (title + chevron) | no |
| overflow | `>>` menu | no |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, hover, pressed, inactive | no | all values below are [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Basis |
|---|---|---|---|
| Height | 25 (24 fill + 1 separator), the same module as the tab bar | [I] | Safari 13 stacks toolbar 38, favorites bar, tab bar 25; the tab bar module measured in `safari-tab-bar` |
| Item text | 12 pt Regular, centred vertically | [I] | Safari 13 uses small system text in this bar |
| Item padding / gap | 8 horizontal padding, 4 between items; first item 8 from the window edge | [I] | toolbar margins measured in `toolbar` |
| Hover / pressed pill | height 19, radius 4 | [I] | |

### Colours and fills
| Part / state | Light | Dark | Tag | Basis |
|---|---|---|---|---|
| Bar fill | continues the title bar gradient end, `#cdcdcd`-like flat `#d0d0d0` | `#343536` | [I] | bottom of the toolbar gradient in `title-bar` |
| Bottom rows | `#bdbdbd`, `#a7a7a7` | `#2a2a2a`, `#000000` | [I] | separator colours in `title-bar` |
| Item text | `#4c4c4c` | `#ffffff` @ 0.85 | [I] | Smart Search field text colours |
| Pressed pill | black @ 0.10 | white @ 0.10 | [I] | |

### Text and icons
The provisional text size and colours are in the tables above [I]; folder chevrons may reuse `toolbar-pop-up` glyph geometry [I]. No Favorites bar text or icon is visible to measure.

### Shadows and effects
No independent shadow is assumed [I]; use the inferred separator rows above. Focus treatment follows the contained link or menu button [I].

## Layout and spacing
Full window width, between toolbar and tab bar.

## Keyboard and accessibility
Command-Option-1..9 open the first nine favorites [D]. ARIA: `role="toolbar"` of links/buttons; folders are `aria-haspopup="menu"`.

## Browser notes
Nothing special.

## Evidence
None available. Build this last and treat every number as provisional.

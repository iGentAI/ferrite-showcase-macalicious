# Section header (`section-header`)

- **Status:** present (added by the inventory gap closure, 6 October 2026: Finder's grouped search results show it in both appearances, and no row covered it)
- **AppKit:** the section header of an `NSCollectionView` (`NSCollectionView.elementKindSectionHeader`, a supplementary view; `NSCollectionViewFlowLayout.sectionHeadersPinToVisibleBounds` pins it); Finder's "Use Groups"
- **HIG:** https://web.archive.org/web/20200503153039/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/table-views/
- **Appearances shown:** light, dark

## Purpose and behaviour
The header of one group in a grouped collection or list: the group's title in bold at the leading edge and, where the group is cut short, a text action at the trailing edge ("Show All (553)"). The header of the group at the top of the view stays pinned there while the group scrolls under it, and is then drawn as a band. [D] The title is not interactive; the action is a button. [I]

## Anatomy
A bar as wide as the view. Title: one line, bold. Accessory at the trailing edge: a text button without a bezel. A plain header has a hairline rule above it; a pinned header is a filled band with a separator under it.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| variant | plain, pinned | plain | header in the content / header pinned to the visible bounds | both |
| accessory | none, text action | none | a button in the header view | both ("Folders" has none; "Documents", "PDF Documents", "Images" have "Show All") |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, plain | yes, light + dark | `10-15-Catalina-Light-Spotlight-More.png @ 442,592,600,64`; Dark same |
| normal, pinned | yes, light + dark | `10-15-Catalina-Light-Spotlight-More.png @ 442,250,600,64`; Dark same |
| action pressed, disabled, focused | not shown | [I] label colour when pressed, tertiary label colour when disabled, the standard focus ring |
| inactive window | not shown | [I] label colours do not change with the window state (see `label`) |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Bar height | 31 | [M] | `10-15-Catalina-Light-Spotlight-More.png`: pinned band y 250..311 at x=1500 |
| Separator under a pinned band | 1, drawn as two device-pixel hairlines | [M] | same column, y 312 and 313 |
| Rule above a plain header | 1 | [M] | same column, y 592..593 |
| Title inset from the view's leading edge | 13 to the ink, 12 to the text box | [M] | view edge x=442, ink of "Folders" starts x=468 |
| Title capitals | 10 high, starting 10 under the top of the bar | [M] | "Folders" in the pinned band |
| Action inset from the view's trailing edge | 16 to the ink, 15 to the text box | [M] | ink of "Show All (553)" ends x=2370 in the light capture (view edge 2402) and x=2024 in the dark one (view edge 2056) |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Pinned band fill | `#f0f0f0` | `#2b2c2f` | [M] | `10-15-Catalina-Light-Spotlight-More.png @ 1500,280`; `10-15-Catalina-Dark-Spotlight-More.png @ 1500,280` |
| Separator under the band, inner hairline | `#e1e1e1` | `#3a3b3e` | [M] | `@ 1500,312` in both captures |
| Separator under the band, outer hairline | `#cecece` | `#4d4e51` | [M] | `@ 1500,313` in both captures |
| Rule above a plain header | `#e6e6e6` | `#343537` | [M] | `@ 1500,592` in both captures |
| Content behind a plain header | `#ffffff` | `#1e1f21` | [M] | `@ 1500,620` in both captures |
| Title | label colour | label colour | [C] | darkest ink of "Folders" matches the label colour over the band |
| Action text | `#808080` (secondary label) | `#9a9a9b` | [M] | darkest ink of "Show All (553)" at y 606..624 in both captures |

### Text and icons
Title: 14 pt system font, bold (capitals 10 pt high). [C] Action: 11 pt system font, regular; a first attempt at 13 pt was visibly too large against the capture. [C]

### Shadows and effects
None.

## Layout and spacing
The header spans the view. Finder's groups follow at y=594, 936 and 1278 in the light capture: a header sits directly above the first row of its group's icons and directly under the last row of the group before it, with no extra space of its own. [M]

## Keyboard and accessibility
The title is not focusable; the action is a button in the key-view loop. AppKit exposes the header as a group title. ARIA: a heading for the title, with the group referring to it through `aria-labelledby`; the action is a `button`, with `aria-expanded` when it expands the group. [D]

## Browser notes
`position: sticky` on a pinned header reproduces the pinning. The two hairlines under the band are a box shadow of half a point and one point, so they stay device-pixel lines at 2x.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Spotlight-More.png | 442,250,600,64 | pinned "Folders" band, leading end |
| light | 10-15-Catalina-Light-Spotlight-More.png | 442,592,600,64 | plain "Documents" header, leading end |
| light | 10-15-Catalina-Light-Spotlight-More.png | 1770,592,600,64 | plain header, trailing end with "Show All (553)" |
| dark | 10-15-Catalina-Dark-Spotlight-More.png | 442,250,600,64 | pinned band |
| dark | 10-15-Catalina-Dark-Spotlight-More.png | 442,592,600,64 | plain header, leading end |
| dark | 10-15-Catalina-Dark-Spotlight-More.png | 1424,592,600,64 | plain header, trailing end |

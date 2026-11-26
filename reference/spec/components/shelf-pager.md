# Shelf paging chevrons (`shelf-pager`)

- **Status:** present
- **AppKit:** custom, app-drawn buttons beside an `NSCollectionView` shelf (TV.app, Podcasts.app, App Store.app); no public class.
- **HIG:** none specific. Related: image buttons https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/image-buttons/
- **Appearances shown:** light, dark
- **Provenance:** split out of `card-grid` on 2026-10-06, when the chevrons were built as a component of their own (`src/components/shelf-pager/`). `card-grid.md` records the chevron's box, stroke and colours; the path of the strokes and the distance from the window's edge were re-measured for this file.

## Purpose and behaviour
Two thin angle brackets in the side margins of a shelf or hero that continues sideways. Clicking one pages the shelf by what is in view [I]. A chevron is dimmed when there is nothing further in its direction [M]: TV light shows the hero's shelf at its start (left dim, right dark); TV dark shows the first shelf after paging.

## Anatomy
```
| margin 40 |  [ card ][ card ][ card ][ card ]  | margin 40 |
|    <      |                                    |      >    |
  13.5 pt from the window edge to the chevron's outer edge
```
Two straight 1 pt strokes that meet at the middle of the outer edge of a 13 x 29 pt box. No bezel, no background.

## Variants and parameters
| Parameter | Values | Default | Shown in screenshots |
|---|---|---|---|
| direction | previous (leading margin), next (trailing margin) | - | both |
| enabled | true, false (dimmed) | true | both |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| enabled | yes | `10-15-Catalina-Light-TV.png @ 2647,1149,26,58`; `10-15-Catalina-Dark-TV.png @ 2647,379,26,58` |
| disabled | yes | `10-15-Catalina-Light-TV.png @ 139,1149,25,58`; `10-15-Catalina-Dark-TV.png @ 139,379,25,58` |
| hover | no | [I] no change |
| pressed | no | [I] 0.7 opacity |
| focused (full keyboard access) | no | [I] standard focus ring around the box, see `focus-ring` |
| inactive window | no | [I] unchanged |

## Measurements
Evidence shorthand: `TV` before `@` means `10-15-Catalina-Light-TV.png`, `Dark` the dark file. Window origin is image px (112, 76); the window is 112..2699 wide.

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Box | 13 x 29 (the strokes' ink spans 12.5 x 29) | [M] | TV `@ 2647,1149,26,58`: ink x=2647..2672, y=1149..1206 |
| Stroke | 1 pt, two straight segments; the stroke's centre runs from (0.25, -0.2) to (12.34, 14.5) to (0.25, 29.2) in the box, cut level at the box's top and bottom | [C] | weighted centre of the stroke's pixels: x=2649.87 on row 1151, 2671.3 on row 1177, 2670.46 on row 1179; slope 0.824 px per px |
| Distance from the window's edge | 13.5 from the edge to the box's outer edge | [M] | TV: ink ends x=2672, window ends x=2699 (27 px); mirrored at the left: ink starts x=139, window starts x=112 |
| Vertical position | centred on the shelf's cards | [M] | TV hero y=714..1623 (middle 1169) against chevron 1149..1206 (middle 1178): 4.5 pt below; Dark first shelf cards y=246..570 (middle 408), chevron 379..437 (middle 408) |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Chevron, enabled | `#262626` | `#dddede` | [M] | `10-15-Catalina-Light-TV.png @ 2671,1178`; `10-15-Catalina-Dark-TV.png @ 2670,409` |
| Chevron, disabled | `#d4d4d4` (Podcasts `#e6e6e6`) | `#444647` | [M] | `10-15-Catalina-Light-TV.png @ 141,1179`; `10-15-Catalina-Dark-TV.png @ 140,407`; Podcasts: `card-grid.md` |

## Layout and spacing
- The chevrons stand in the page's 40 pt side margins and never over the cards.
- TV's hero chevrons sit 4.5 pt below the hero's middle; the first shelf's are level with its cards' middle. [I] The chevrons are centred on the shelf's own box, which for the hero includes the 9 pt of the row above it.

## Keyboard and accessibility
Buttons (`AXButton`) named for their direction; a dimmed chevron is unavailable [I]. ARIA: two `button`s, `aria-disabled` when dimmed, kept in the tab order so that focus is not lost when a page turn disables the focused one.

## Browser notes
- At 1x a 1 pt slanted stroke is antialiased over two pixels; the 2x rendering is the one to compare.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-TV.png` | 2647,1149,26,58 | trailing chevron, enabled |
| dark | `10-15-Catalina-Dark-TV.png` | 2647,379,26,58 | trailing chevron, enabled |
| light | `10-15-Catalina-Light-TV.png` | 139,1149,25,58 | leading chevron, disabled |
| dark | `10-15-Catalina-Dark-TV.png` | 139,379,25,58 | leading chevron, disabled |

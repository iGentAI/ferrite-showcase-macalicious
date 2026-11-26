# Gradient Button (`gradient-button`)

- **Status:** present
- **AppKit:** `NSButton`, `bezelStyle = .smallSquare` (`NSSmallSquareBezelStyle`), image-only, template images `NSImage.addTemplateName` (`NSAddTemplate`), `NSImage.removeTemplateName`, `NSImage.actionTemplateName`; in practice often an `NSSegmentedControl` with `segmentStyle = .smallSquare`
- **HIG:** https://web.archive.org/web/20200504054756/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/gradient-buttons/
- **Appearances shown:** light, dark

Short file names: `L-SP-<Pane>` / `D-SP-<Pane>` = `10-15-Catalina-Light-System-Preferences-<Pane>.png` / Dark.

## Purpose and behaviour
A gradient button starts an immediate action tied to a view, typically adding or removing rows of the table directly above it. It contains an icon (a system template image), not text, can act as a push button, a toggle or a pop-up (Action menu), sits inside or directly beneath its view, needs no introducing label, and is not used in toolbars or status bars. [D] (HIG, Gradient Buttons)

In Catalina the name is historical: the fill is almost flat. The buttons are square-cornered cells that share 1 pt borders with each other and with the list above, followed by an empty filler cell that extends the bar to the list's right edge (the whole assembly is `bordered-list`).

## Anatomy
```
  list ...........................................
  +------+------+--------------------------------+   1 pt border (shared with the list frame)
  |  +   |  -   |          filler                |   19 pt fill
  +------+------+--------------------------------+   1 pt border
   23-24   23-24
```
Back to front: 1 pt border lines (top, bottom, between cells), near-flat fill, centred 11 pt template glyph.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| glyph | add (+), remove (-), action (gear + chevron), any 11 to 14 pt template image | - | `image` | add, remove; Network action gear 13 x 13 pt, chevron 7 x 4.5 pt [M], ink x=258..283/y=1042..1067 and x=288..301/y=1049..1057: `10-15-Catalina-Light-System-Preferences-Network.png @ 256,1040,29,30`; `10-15-Catalina-Light-System-Preferences-Network.png @ 286,1047,18,17` |
| enabled | true, false | true | `isEnabled` | both |
| behaviour | momentary, toggle, pull-down | momentary | `setButtonType` | momentary |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes, light + dark | `L-SP-Language-and-Region @ 192,892,50,42` (add); `D-SP-Language-and-Region @ 192,892,50,42` |
| disabled | yes, light + dark | `L-SP-Language-and-Region @ 240,892,50,42` (remove); `L-SP-Internet-Accounts @ 152,966,102,42` (both); Dark files, same crops |
| pressed | not shown | [I] fill darkens to about `#d9d9d9` (light) / lightens to `#5a5a5a` (dark) while the mouse is down; AppKit draws the small-square bezel with a darker flat fill when highlighted |
| on (toggle) | not shown | [I] same as pressed, held |
| inactive window | not shown | [I] unchanged |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Cell width (fill only, between borders) | 23 (Language & Region), 24 (Internet Accounts) | [M] | `L-SP-Language-and-Region` row y=913: border x 192..193, fill x 194..239 (46 px), border x 240..241, fill x 242..287, border x 288..289; `L-SP-Internet-Accounts` row y=987: border x 152..153, fill x 154..201 (48 px), border 202..203, fill 204..251, border 252..253 |
| Border width | 1 (2 px) on all sides and between cells | [M] | same rows; `L-SP-Language-and-Region` col x=210: border y 892..893 and y 932..933 |
| Height | 19 fill + 1 + 1 borders = 21 | [M] | `L-SP-Language-and-Region` col x=210: fill y 894..931 (38 px); `L-SP-Internet-Accounts` col x=170: border y 966..967, fill y 968..1005, border y 1006..1007 |
| Corner radius | 0 | [M] | borders run to the corner in the same rows and columns (no anti-aliased pixels at `L-SP-Internet-Accounts @ 152,1006`) |
| Glyph box | 11 x 11, centred in the cell | [M] | `L-SP-Language-and-Region` row y=913: plus ink x 206..227 (22 px) inside the cell x 194..239; col x=210: ink y 912..913 (horizontal bar of the plus) |
| Plus glyph | two 11 x 1 bars crossing at the centre (22 x 2 px each), square ends | [M] | `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 190,1048,22,22`: horizontal bar y 1058..1059, vertical bar x 200..201 |
| Minus glyph | one 11 x 1 bar at the vertical centre | [M] | `L-SP-Language-and-Region` row y=913: ink x 254..275; `10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 242,1058,22,2` |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill | `#f9f9f9` (top) -> `#f7f7f7` (middle) -> `#f3f3f3` (bottom) | `#3c3c3c` flat | [M] | `L-SP-Language-and-Region` col x=210 y 894..931; `D-SP-Language-and-Region` col x=210 y 894..931 |
| Border, outer and top/bottom | `#b4b4b4` | `#7f7f7f` | [M] | `L-SP-Language-and-Region @ 192,913`, `@ 210,892`; `D-SP-Language-and-Region @ 192,913`, `@ 210,892` |
| Border between cells | `#b7b7b7` | `#7f7f7f` | [M] | `L-SP-Language-and-Region @ 240,913`; `D-SP-Language-and-Region @ 240,913` |
| Glyph, enabled | `#262626` (`rgba(0,0,0,0.85)`) | `#e1e1e1` (`rgba(255,255,255,0.85)` over `#3c3c3c`) | [M] | `L-SP-Language-and-Region @ 215,913`; `D-SP-Language-and-Region @ 215,913` |
| Glyph, disabled | `#b9b9b9` (`rgba(0,0,0,0.25)` over `#f7f7f7`) | `#6d6d6d` (`rgba(255,255,255,0.25)`) | [M] | `L-SP-Language-and-Region @ 260,913`; `L-SP-Internet-Accounts @ 175,987`; `D-SP-Language-and-Region @ 260,913` |
| Network pane bar: fill | `#fafafa` (first row) -> `#f7f7f7` (middle) -> `#f5f5f5` (last row) | `#4e4f50` (first row) -> `#4b4c4c` (middle) -> `#48494a` (last row), a gradient where the other panes are flat | [M] | `10-15-Catalina-Light-System-Preferences-Network.png @ 220,1034`, `@ 220,1055`, `@ 220,1071`; `10-15-Catalina-Dark-System-Preferences-Network.png @ 220,1034`, `@ 220,1055`, `@ 220,1071` |
| Network pane bar: top line | `#b4b4b4` | `#808080`, running the full width of the bar, over the side borders too | [M] | `10-15-Catalina-Light-System-Preferences-Network.png @ 220,1032`; `10-15-Catalina-Dark-System-Preferences-Network.png @ 400,1032`, `@ 153,1032` |
| Network pane bar: bottom and outer side borders | `#b4b4b4` | `#636465` | [M] | `10-15-Catalina-Light-System-Preferences-Network.png @ 220,1072`, `@ 152,1055`; `10-15-Catalina-Dark-System-Preferences-Network.png @ 220,1072`, `@ 153,1055`, `@ 490,1055` |
| Network pane bar: borders between cells | `#b4b4b4` | `#8a8b8c`, down through the bottom border; `#a0a0a1` where they cross the top line | [M] | `10-15-Catalina-Light-System-Preferences-Network.png @ 202,1055`; `10-15-Catalina-Dark-System-Preferences-Network.png @ 202,1055`, `@ 252,1055`, `@ 310,1055`, `@ 202,1072`, `@ 202,1032` |
| Network pane bar: glyph, enabled | `#252525` | `#e4e4e4` | [M] | `10-15-Catalina-Light-System-Preferences-Network.png @ 177,1055`; `10-15-Catalina-Dark-System-Preferences-Network.png @ 177,1055` |

The Network pane's bar (add, remove, Action and a filler cell under the service list; geometry as above, 1 + 19 + 1 high, bar x 152..491, y 1032..1073) is not drawn like the bars of the other panes, in either appearance. Measured 3 October 2026 at the request of the buttons batch, which had seen the lighter dark bar.

- Dark: the flat `#3c3c3c` fill with `#7f7f7f` borders is what four other dark captures show: `10-15-Catalina-Dark-System-Preferences-Language-and-Region.png @ 210,900`, `@ 210,892`; `10-15-Catalina-Dark-System-Preferences-Internet-Accounts.png @ 170,975`, `@ 170,966`; `10-15-Catalina-Dark-System-Preferences-Sharing.png @ 600,925`, `@ 600,914`; `10-15-Catalina-Dark-System-Preferences-Users-and-Groups.png @ 170,870`, `@ 170,860`. The Network bar is lighter and has three different line colours where those have one. [M]
- Light: the difference is small and easy to miss: one or two levels in the fill, three or four in the borders between cells. The other panes' fill starts at `#f9f9f9` and ends at `#f3f3f3` (`10-15-Catalina-Light-System-Preferences-Language-and-Region.png @ 210,894`, `@ 210,931`) and their borders between cells are `#b7b7b7` (`10-15-Catalina-Light-System-Preferences-Language-and-Region.png @ 240,913`), where the Network bar has `#fafafa`, `#f5f5f5` and `#b4b4b4` in the rows above. [M]
- The window behind the bar is the same in both kinds of pane (`#2f3031` dark: `10-15-Catalina-Dark-System-Preferences-Network.png @ 130,1055`; `10-15-Catalina-Dark-System-Preferences-Language-and-Region.png @ 130,600`), so the difference is in the bar itself and not in a tinted background. [M]
- Why the Network pane differs is not established. Nothing in the screenshots says whether it is another AppKit class, another bezel style or the pane's own drawing, and no documentation was found that settles it; treat any explanation as a guess. If the dark bar were a translucent white layer over the window background `#2f3031`, which is an assumption [I], its colours would correspond to white at 0.15 falling to 0.12 for the fill, 0.39 for the top line, 0.25 for the bottom and side borders and 0.44 for the borders between cells [C].
- Which to build: this spec's gradient-button recipe stays the one in the four captures (and the buttons batch builds that). The Network values are recorded as a variant of one pane so that a rebuilt Network pane can match its screenshot; they are not a correction to the rows above.

### Shadows and effects
None. [M] no shadow rows below the bottom border: `L-SP-Internet-Accounts` col x=170: y=1008 is the window background `#ececec`.

## Layout and spacing
- The bar is attached to the bottom of its list with no gap; its top border is the list's bottom border, and its left border continues the list's left border. [M] `L-SP-Internet-Accounts` col x=170: list white ends y=965, border y 966..967.
- Order: add, remove, then Action if present; the filler cell takes the remaining width. [M] `L-SP-Internet-Accounts` row y=987: fill continues from x=254 to the list's right border.
- A standalone add / remove pair that is not attached to a list uses the rounded `segmented-control` instead (Desktop & Screen Saver, Connect to Server).

## Keyboard and accessibility
Space activates the focused cell (Full Keyboard Access). Delete in the list normally triggers the same action as the remove button. AppKit role `AXButton` with descriptions "add" and "remove". Web: `<button aria-label="Add">`. [D]

## Browser notes
Nothing unusual: flat fill, 1 px (2 device px) borders. On a 1x display keep the 1 px borders.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-System-Preferences-Language-and-Region.png` | 192,892,98,42 | add enabled, remove disabled |
| light | `10-15-Catalina-Light-System-Preferences-Internet-Accounts.png` | 152,966,420,42 | both disabled, with filler cell |
| dark | `10-15-Catalina-Dark-System-Preferences-Language-and-Region.png` | 192,892,98,42 | add enabled, remove disabled |
| dark | `10-15-Catalina-Dark-System-Preferences-Internet-Accounts.png` | 152,966,420,42 | both disabled |
| light | `10-15-Catalina-Light-System-Preferences-Network.png` | 152,1032,340,42 | Network pane variant: add, remove, Action, filler |
| dark | `10-15-Catalina-Dark-System-Preferences-Network.png` | 152,1032,340,42 | Network pane variant: lighter gradient bar |

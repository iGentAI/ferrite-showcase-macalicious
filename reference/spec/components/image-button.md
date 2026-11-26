# Image Button (`image-button`)

- **Status:** present
- **AppKit:** `NSButton` with `isBordered = false`, `image` set, `imagePosition = .imageOnly` or `.imageAbove`; `setButtonType(.momentaryChange)` or `.momentaryPushIn`
- **HIG:** https://web.archive.org/web/20200503180052/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/image-buttons/
- **Appearances shown:** light, dark

Short file names: `L-SP-<Pane>` / `D-SP-<Pane>` = `10-15-Catalina-Light-System-Preferences-<Pane>.png` / Dark.

`L-SP-0` is `10-15-Catalina-Light-System-Preferences-0.png`; `D-SP-0` the Dark file.

## Purpose and behaviour
An image button shows an image or icon in a view and starts an immediate action. It has no border and can behave as a push button, a toggle or a pop-up. The whole frame is clickable, not just the image, so leave about 10 px of padding between the image and the frame edges and keep other controls far enough away. A label, if any, goes below the image. Image buttons are for views, not toolbars or status bars. [D] (HIG, Image Buttons)

## Anatomy
A transparent rectangular hit area, the image centred in it, and optionally a label centred below. Nothing is drawn in the normal state besides the image and label.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| content | image only; image above label; logo row (full-width) | image only | `imagePosition` | all three |
| behaviour | momentary, toggle | momentary | `setButtonType` | momentary |
| enabled | true, false | true | `isEnabled` | enabled |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes, light + dark | see Evidence |
| pressed | not shown | [I] the image is darkened: AppKit composites the image with black at about 0.3 alpha (`highlightsBy = .contentsCellMask`); the label does not change |
| disabled | not shown | [I] image and label at 0.5 alpha |
| focused | not shown | [I] `focus-ring` around the image bounds |

## Measurements
### Geometry (pt) of the three uses in the assigned screenshots
| Use | Property | Value | Tag | Evidence |
|---|---|---|---|---|
| Preference pane icon (System Preferences grid) | image | 32 x 32 nominal icon in a 40 pt cell; visible artwork up to 37 x 37.5 | [M] artwork bounds, [I] nominal size | `L-SP-0 @ 168,415,74,74` (General), `@ 989,415,72,72` (Language & Region) |
| | column pitch | 82 | [M] | `L-SP-0`: icon left edges x=168, 332, 496, 660, 824 (General .. Siri) |
| | label | 12 pt regular, centred under the icon, up to two lines 14 pt apart; first line's top ink 9.5 pt below the artwork | [C] size (ascender height 18 to 19 px), [M] positions | `L-SP-0 @ 162,508,85,18` (`General`, ink y 508..525); two-line label `@ 312,507,116,23` and `@ 295,535,148,19` |
| | label colour | `#727272` on `#e5e5e5`, `#767676` on `#ececec` (black 0.50) | [M] | `L-SP-0 @ 245,525`; blobs in the bottom band, e.g. `@ 155,911,99,19` |
| | label colour, dark | `#a4a4a5` on `#353637` (white 0.55) | [M] | `D-SP-0 @ 245,525` |
| Account header icons (Apple ID, Family Sharing) | image | 37 x 37 artwork | [M] | `L-SP-0 @ 1152,191,74,74`, `@ 1316,191,74,74` |
| | label | 12 pt, `#767676`, centred, top ink 9.5 pt below the image | [M] | `L-SP-0 @ 1141,284,94,23` |
| Account provider rows (Internet Accounts) | row | full box width (410 pt) x 54, rows separated by 2 pt lines (56 pt pitch) | [M] | `L-SP-Internet-Accounts` col x=620: dividers y 384..387, 496..499, 608..611, 720..723, 832..835; box x 588..1407 |
| | logo | centred horizontally in the row, 24 to 37 pt tall | [M] | `L-SP-Internet-Accounts @ 879,302,246,50` (iCloud), `@ 848,410,301,66` (Exchange), `@ 889,522,233,74` (Google) |
| | text row | "Add Other Account…" 13 pt, `#232323`, centred | [M] | `L-SP-Internet-Accounts @ 847,879,301,25` |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Button background | none (shows the parent: `#e3e3e3` box, `#ececec` / `#e5e5e5` window bands) | none (`#363637`, `#2f3031` / `#353637`) | [M] | `L-SP-Internet-Accounts @ 620,330`; `D-SP-Internet-Accounts @ 620,330` |
| Row divider (Internet Accounts) | `#cdcdcd` | `#4a4a4b` | [M] | `L-SP-Internet-Accounts @ 620,385`; `D-SP-Internet-Accounts @ 620,385` |

### Shadows and effects
None drawn by the button. The artwork may contain its own shadow.

## Layout and spacing
- Keep at least 10 px (5 pt at 2x, written as pixels in the HIG) of transparent padding around the image inside the frame. [D]
- Label below the image, centred. [D]; measured centring: `General` icon centre x=205, label centre x=204 (`L-SP-0 @ 168,415,74,74`, `@ 162,508,85,18`). [M]

## Keyboard and accessibility
Space activates the focused button. Role `AXButton` (pane icons expose the pane name as title). The image needs an accessible name. Web: `<button>` containing an `<img alt>` and optional visible label. [D]

## Browser notes
Artwork is required as image assets (pane icons, provider logos). The pressed darkening can be done with `filter: brightness(0.7)` on `:active`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-System-Preferences-0.png` | 152,410,110,150 | pane icon with label |
| light | `10-15-Catalina-Light-System-Preferences-0.png` | 1141,191,94,116 | Apple ID icon with label |
| light | `10-15-Catalina-Light-System-Preferences-Internet-Accounts.png` | 590,274,816,110 | provider logo row |
| dark | `10-15-Catalina-Dark-System-Preferences-0.png` | 152,410,110,150 | pane icon with label |
| dark | `10-15-Catalina-Dark-System-Preferences-Internet-Accounts.png` | 590,274,816,110 | provider logo row |

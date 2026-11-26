# Round-rect button (`round-rect-button`)

- **Status:** present (added by the inventory gap closure, 6 October 2026: Finder's Network window shows it on its own, outside a scope bar, and no row covered it)
- **AppKit:** `NSButton` with `bezelStyle = .roundRect` (`NSBezelStyle.roundRect`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/push-buttons/
- **Appearances shown:** light, dark

## Purpose and behaviour
A small outlined button for an action that belongs to the content it sits in or beside: "Connect As…" and "Share Screen…" under a server in Finder's preview column, Save and + in a search's scope bar, the previous, next and Done buttons of Preview's find bar. It starts an action when clicked; it is never the default button. [D]

## Anatomy
A 1 pt outline with rounded corners around a title (or a template image). No fill and no shadow.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| content | title, image | title | `title`, `image` | title (Finder Network, Finder Search "Save"); image (Finder Search "+", Preview's find bar chevrons) |
| size | one | 18 pt high | regular control size | one size |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes, light + dark | `10-15-Catalina-Light-Finder-Network.png @ 983,416,244,106`; `10-15-Catalina-Dark-Finder-Network.png @ 870,416,244,106` |
| pressed | not shown | [I] a faint tint inside the outline, as the scope bar's round-rect actions |
| disabled | not shown | [I] outline at half strength, disabled control text colour |
| inactive window | yes, light + dark | the square add button under Collections in Books' sidebar: `10-15-Catalina-Light-Books.png @ 160,566,48,48`; `10-15-Catalina-Dark-Books.png @ 160,566,48,48`. Fainter outline and content |
| main window, not key | not shown | [I] as the key window |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Height | 18 | [M] | `10-15-Catalina-Light-Finder-Network.png`: "Connect As…" y 424..459 |
| Width in Finder's preview column | 114 | [M] | same button, x 991..1218 |
| Outline width | 1 | [M] | same button, two device pixels on each side |
| Corner radius | 4.25 | [C] | fitted against the capture: the masked comparison differs in 0.76% of pixels at 4 pt, 0.06% at 4.25 pt and 0.83% at 4.7 pt |
| Pitch of the two buttons | 27 (9 between them) | [M] | "Connect As…" top y=424, "Share Screen…" top y=478 |
| Square add button (Books' sidebar) | 18 x 18 around a plus 10 long and 1 thick | [M] | `10-15-Catalina-Light-Books.png`: outline x 166..201, y 572..607; plus x 174..193, rows y 589..590 |
| Horizontal padding | 7 | [I] | Finder's buttons have a fixed width; no capture shows one sized to its title |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Outline | `#ababab` over `#f5f5f5`: black at 30% | `#676869` over `#252628`: white at 30% | [M] | `10-15-Catalina-Light-Finder-Network.png @ 1100,424`; `10-15-Catalina-Dark-Finder-Network.png @ 990,424` |
| Fill | none (the column's `#f5f5f5` shows through) | none (`#252628`) | [M] | `@ 1000,430` light; `@ 890,430` dark |
| Title | `#252525` | `#dfdfdf` | [M] | darkest and lightest ink of "Connect As…" in the two captures |
| Outline, inactive window | `#dfdfdf` over `#f6f6f6`: black at 9.3% | `#515355` over `#2c2e30`: white at 16.7% | [M], [C] alphas | `10-15-Catalina-Light-Books.png @ 180,573`; `10-15-Catalina-Dark-Books.png @ 180,573` |
| Content, inactive window | `#777777` over `#f6f6f6`: black at 51.6% | `#aaaaaa` over `#2c2e30`: white at 59% | [M], [C] alphas | the plus, `10-15-Catalina-Light-Books.png @ 183,590`; `10-15-Catalina-Dark-Books.png @ 183,590` |

### Text and icons
Title: 11 pt system font, medium weight: the capitals of "Connect As…" are 8 pt high (y 434..449 in the crop's pixels) and the title's ink is 67 pt wide, which the fallback font matches at 11 pt medium to within a point. [C] The scope bar's spec reads the same bezel's "Save" as 12 pt regular; the two readings are within the error of a fallback font. [C]

### Shadows and effects
None.

## Layout and spacing
In Finder's preview column the buttons are centred under the preview, one under the other, 9 pt apart. [M] In a scope bar they sit at the trailing edge (see `scope-bar`).

## Keyboard and accessibility
A button: in the key-view loop with full keyboard access, pressed with Space. ARIA: `button`; a button that shows only an image needs a name. [D]

## Browser notes
A border in the label colour at 30% reproduces the outline over any background in both appearances. The fitted radius is not a whole number of points.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Finder-Network.png | 983,416,244,106 | "Connect As…" and "Share Screen…" |
| light | 10-15-Catalina-Light-Finder-Search.png | 1880,202,124,32 | Save and + in the scope bar |
| light | 10-15-Catalina-Light-Preview-Search.png | 2664,200,182,34 | previous, next and Done in the find bar |
| dark | 10-15-Catalina-Dark-Finder-Network.png | 870,416,244,106 | the same two buttons |
| light | 10-15-Catalina-Light-Books.png | 160,566,48,48 | the square add button in an inactive window |
| dark | 10-15-Catalina-Dark-Books.png | 160,566,48,48 | the same button |

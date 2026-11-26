# Desktop / Finder icon with label (`desktop-icon`)

- **Status:** present (normal state; selected state not shown on the desktop)
- **AppKit:** Finder icon-view cell (comparable to `NSCollectionViewItem` with image + text field)
- **HIG:** https://web.archive.org/web/20200503170015/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/finder/
- **Appearances shown:** light, dark (identical rendering: white label with shadow in both)

## Purpose and behaviour
Represents a volume, file, folder or stack on the desktop: a 64 pt icon with its name centred below. Click selects, double-click opens, drag moves, Return renames [D].

## Anatomy
```
   [ 64 x 64 icon ]
   Macintosh SSD        <- 12 pt bold, white, soft dark shadow, centred, up to 2 lines
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| icon | volume, document thumbnail, PDF preview, stack | - | - | external-drive volume icons, PDF thumbnails, stacks |
| label lines | 1 or 2 (wraps at word boundaries, middle-truncates beyond) | 1 | - | 1 line; 2 lines ("Aqua and" / "Bondi.pdf") |
| icon size | 16-128 | 64 | Finder view options | 64 |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes | 10-15-Catalina-Light-Desktop.png @ 3130,56,200,180; 10-15-Catalina-Dark-Desktop.png @ 3130,56,200,180 |
| two-line label | yes | 10-15-Catalina-Light-Desktop-Stacks.png @ 3150,1190,160,200 |
| selected | no | [I] icon gets a rounded 4 pt-radius backing of `rgba(0,0,0,0.2)` (light and dark) 4 pt larger than the icon; label gets an accent-colour (`selectedContentBackgroundColor`) rounded rectangle, radius 3 pt, 2 pt horizontal padding, white text without shadow. Basis: Finder icon-view selection as specified by the views group for `icon-view` |
| renaming | no | [I] label becomes a white text field with the name selected |
| dimmed (cut / hidden) | no | [I] icon at 50 % opacity |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Icon tile | 64 x 64 (the drive artwork's ink is 53 x 57: px 3177..3282 x 66..179) | [D] tile, [M] ink | 10-15-Catalina-Light-Desktop.png @ 3177,66,106,114 |
| Label cap-top | 44 pt below the icon tile centre (tile centre y=122.5 px, cap top y=211) = 12 pt below the tile bottom | [M] | 10-15-Catalina-Light-Desktop.png @ 3141,211,1,17 |
| Label baseline | 114 pt from the screen top for the first row (last ink row y=227 px) | [M] | 10-15-Catalina-Light-Desktop.png @ 3141,211,1,17 |
| Label horizontal position | centred on the icon (text px 3140..3317, centre 3228.5; icon centre 3229.5) | [M] | 10-15-Catalina-Light-Desktop.png @ 3140,209,178,19 |
| Second line pitch | 16 (line tops at y=1330 and 1362 px) | [M] | 10-15-Catalina-Light-Desktop-Stacks.png @ 3172,1330,116,54 |
| Max label width | about 110 (longest single line "ENERGY STAR.pdf" = 108: px 3121..3337) | [M] | 10-15-Catalina-Light-Desktop-Stacks.png @ 3121,1106,217,22 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Label text | white (`#fffeff` at the sampled stem) | white (`#fffeff`) | [M] | 10-15-Catalina-Light-Desktop.png @ 3141,215; 10-15-Catalina-Dark-Desktop.png @ 3141,215 |
| Label shadow (darkening of the picture under the baseline, light sky backdrop `#9eb8d4 (sRGB #98b8d7)`) | 1 px below: `#657687 (sRGB #617689)` (black at 0.36); 2 px: `#73879b (sRGB #6e879d)` (0.27); 3 px: `#889fb7 (sRGB #839fba)` (0.14); 4 px: `#97b1cb (sRGB #91b1ce)` (0.05) | same construction | [M] composites, [C] alpha | 10-15-Catalina-Light-Desktop.png @ 3141,228,1,5 |
| Fitted label shadow | `text-shadow: 0 1px 2px rgba(0,0,0,0.6), 0 0 1px rgba(0,0,0,0.3)` | same | [C] | from the falloff above |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Label font | SF Pro Text 12 pt Bold (cap height 17 px: rows 211..227; stems 3 px) | same | [C] | 10-15-Catalina-Light-Desktop.png @ 3141,211,1,17; 3136,218,64,1 |
| Alignment | centred, each line centred | same | [M] | 10-15-Catalina-Light-Desktop-Stacks.png @ 3172,1330,116,54 |

### Shadows and effects
Icons carry their artwork's own shadow; document thumbnails get a 1 px outline and a dog-ear [M] 10-15-Catalina-Light-Desktop-Stacks.png @ 3180,960,100,122.

## Layout and spacing
Placed on the `desktop` grid (112 pt vertical pitch). Label box sits 12 pt under the icon; total cell about 110 x 100 pt for one line.

## Keyboard and accessibility
Arrow keys move selection, Return edits the name, Space opens Quick Look, Command-Down opens [D]. AX: `AXImage`/`AXGroup` with `AXTitle` = name. ARIA: `role="gridcell"` or `option` with `aria-selected`.

## Browser notes
Use `text-shadow` for the label; Chrome does not darken as tightly as CoreText's shadow at 2x, so compare against the falloff table. Icons are assets.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Desktop.png | 3130,56,200,180 | "Macintosh SSD" volume icon and label |
| dark | 10-15-Catalina-Dark-Desktop.png | 3130,56,200,180 | same over the Night picture |
| light | 10-15-Catalina-Light-Desktop-Stacks.png | 3100,940,260,460 | PDF thumbnails, one- and two-line labels |

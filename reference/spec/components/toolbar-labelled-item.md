# Toolbar item with label below (`toolbar-labelled-item`)

- **Status:** present
- **AppKit:** `NSToolbarItem.label` with `NSToolbar.displayMode = .iconAndLabel`
- **HIG:** https://web.archive.org/web/20200503121036/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/toolbars/
- **Appearances shown:** light, dark

## Purpose and behaviour
In "Icon and Text" mode each toolbar item shows its label under the control. Labels are one or two words in title-style capitalisation without ending punctuation, verbs where possible [D]. The label is not a separate hit target in 10.15 for bezelled controls. The selectable icon+label items of preference windows are a different component (`preferences-toolbar`).

## Anatomy
A 22 pt toolbar control (button, segmented control or pull-down) with an 11 pt label centred beneath it.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| control | button, segmented control, pull-down | button | `view` | all three (Disk Utility: View pull-down, Volume +/- segments, First Aid ... buttons) |
| label only | text-only mode | off | `.labelOnly` | not shown |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes | `10-15-Catalina-Light-Disk-Utility.png @ 124,124,100,80` (View) |
| disabled | yes | Erase, Restore: `10-15-Catalina-Light-Disk-Utility.png @ 980,124,120,80` |
| inactive window | no | [I] label at the disabled colour |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Chrome height in this mode | 70 (Disk Utility), 68 (Automator) | [M] | `10-15-Catalina-Light-Disk-Utility.png @ 150,76,1,140`; `10-15-Catalina-Light-Automator.png @ 150,76,1,136` |
| Control top below window top | 26 (Disk Utility, fill y 128..171), 25 (Automator, y 126..169) | [M] | same columns |
| Label cap-top below control fill bottom | 6 (12 px: y 171 -> 183) | [M] | `10-15-Catalina-Light-Disk-Utility.png @ 149,183,50,17` |
| Label baseline below window top | 62 (last ink row y=199) | [M] | same |
| Label baseline above chrome bottom | 8 | [C] | 70 - 62 |
| Label cap height | 15-16 px -> 11 pt | [C] | "View" rows y 183..199 incl. no descender |
| Button width | 38 at mid-height (First Aid fill x 779..854, Partition 884..959, Erase 983..1058); the earlier 37 pt runs at y=132 were corner-inset cross-sections, not full widths | [M] | `10-15-Catalina-Light-Disk-Utility.png @ 775,150,385,1`; dark same row |
| Item pitch | max(control width, label width) + 12 to 16 between items (fill-to-fill gaps 31 and 25 px in the First Aid / Partition / Erase run) | [M] | same row |

### Measured icon-and-label layout cross-check
These are toolbar **items**, not selectable preference-pane icons. The measurements below use both Disk Utility and Console in both appearances; Console's compact chrome is a distinct height variant. The box is the visible control-and-label union, not a measured mouse hit rectangle [I]. Baselines below use the first clear background row after label ink as a raster baseline proxy [C].

| Property | Disk Utility (light / dark) | Console (light / dark) | Tag | Evidence |
|---|---|---|---|---|
| Chrome height (title strip + toolbar) | 70 / 70 pt; y 76..215 | 68 / 68 pt; y 76..211; the scope bar below y=212 is separate | [M] | `10-15-Catalina-Light-Disk-Utility.png @ 150,76,1,141`; `10-15-Catalina-Dark-Disk-Utility.png @ 150,76,1,141`; `10-15-Catalina-Light-Console.png @ 1950,76,1,183`; `10-15-Catalina-Dark-Console.png @ 1950,76,1,183` |
| Toolbar portion below the 22 pt title strip | 48 / 48 pt | 46 / 46 pt | [C] | measured chrome heights minus title strip in `title-bar` |
| Visible item box, control and label (First Aid / Now) | 38 x 36 pt, x 779..854, y 128..199 | 44 x 35 pt, x 128..215, y 126..195 | [M] | Disk Utility mid-row cited above; `10-15-Catalina-Light-Console.png @ 127,150,199,1`; `10-15-Catalina-Dark-Console.png @ 127,150,199,1`; label columns below |
| Control fill (First Aid / Now) | 38 x 22 pt; y 128..171 | 44 x 22 pt; y 126..169 | [M] | Disk Utility column x=150 y 127..173; Console column x=1950 y 125..171 (search bezel confirms shared row); mid-height rows above |
| Label last ink / baseline proxy | y 199 / 200 | y 195 / 196 | [M] ink, [C] baseline | `10-15-Catalina-Light-Disk-Utility.png @ 816,180,1,25`; dark same; `10-15-Catalina-Light-Console.png @ 468,178,1,23`; dark same |
| Baseline offset below control bottom edge | 14 pt (200 minus 172) | 13 pt (196 minus 170) | [C] | preceding two rows; lower bezel border is excluded |
| Inter-item fill-edge gap | First Aid to Partition 14.5 pt; Partition to Erase 11.5 pt | Now to Activities 10 pt | [M] | light and dark Disk Utility row at y=150: 855..883 and 960..982; light and dark Console row at y=150: 216..235 (light includes two borders) |
| Label cap height and size | 15–16 image px; SF Pro Text 11 pt Regular | 15–16 image px; SF Pro Text 11 pt Regular | [M] cap, [C] size | Disk Utility View label y=183..199; Console Clear label y=181..195, `10-15-Catalina-Light-Console.png @ 459,181,1,22`; dark same |
| Enabled label stem sample, stored colour | light `#424243`; dark `#b7b6b6` | light `#474847`; dark `#b5b6b5` | [M] | `10-15-Catalina-Light-Disk-Utility.png @ 816,198`; `10-15-Catalina-Dark-Disk-Utility.png @ 788,184`; `10-15-Catalina-Light-Console.png @ 468,195`; `10-15-Catalina-Dark-Console.png @ 480,184` |

Label shade varies slightly with toolbar tint and antialiasing; retain these stored samples rather than treating Console and Disk Utility as a single exact RGB token. Console Clear/Reload and Disk Utility First Aid/Partition prove that the component is a bezelled command plus a label. Automator Library/Media also use this presentation. Mail/Safari preference selectors remain `preferences-toolbar` [D] (`NSToolbar` selection vs immediate command semantics).

### Colours and fills
Controls as `toolbar-button`.

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Label font | SF Pro Text 11 pt Regular | same | [C] | cap height 16 px |
| Label colour, enabled | `#424343` (Disk Utility), `#3f3e3f` (Automator) | `#b6b4b7` | [M] | darkest pixel in `10-15-Catalina-Light-Disk-Utility.png @ 130,176,110,32`; `10-15-Catalina-Light-Automator.png @ 124,176,90,32`; `10-15-Catalina-Dark-Disk-Utility.png @ 130,176,110,32` |
| Label colour, disabled | `#8e8d8e` | `#7c7a7c` | [M] | `10-15-Catalina-Light-Disk-Utility.png @ 986,176,110,32`; `10-15-Catalina-Dark-Disk-Utility.png @ 986,176,110,32` |

### Shadows and effects
None.

## Layout and spacing
Label and control share a vertical centre line. The first item's control starts 8 pt from the window edge when its label is narrower than the control (Disk Utility View: fill x=128).

## Keyboard and accessibility
The label is the control's accessible title (`AXTitle`); in HTML use a visible `<span>` referenced by `aria-labelledby`, not a second focus stop.

## Browser notes
Reproducible with a column flexbox per item.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Disk-Utility.png` | 112,76,1000,140 | pull-down, segmented and button items with labels |
| dark | `10-15-Catalina-Dark-Disk-Utility.png` | 112,76,1000,140 | same |
| light | `10-15-Catalina-Light-Console.png` | 112,76,818,136 | compact icon-and-label toolbar; Now, Activities, Clear, Reload, Info, Share |
| dark | `10-15-Catalina-Dark-Console.png` | 112,76,818,136 | same controls and label geometry, tinted dark chrome |
| light | `10-15-Catalina-Light-Automator.png` | 112,76,400,136 | Library (selected, accent glyph) and Media |

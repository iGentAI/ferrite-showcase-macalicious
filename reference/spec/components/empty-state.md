# Empty-state / placeholder content text (`empty-state`)

- **Status:** present (one styled instance: Automator's workflow placeholder; plain empty panes are also shown)
- **AppKit:** custom: a non-editable `NSTextField` label centred in the pane (plain style), or a rounded background view containing a label (Automator)
- **HIG:** https://web.archive.org/web/20200503171535/https://developer.apple.com/design/human-interface-guidelines/macos/app-architecture/loading/
- **Appearances shown:** light, dark

## Purpose and behaviour
Text shown in the middle of a content area that has nothing to display, telling people what the area is for or what to do ("Drag actions or files here to build your workflow.", "No Selection", "No Message Selected"). It is static, not selectable and disappears as soon as content exists. The HIG's loading guidance asks apps never to leave people looking at a blank, unexplained area [D] (HIG loading page, paraphrased).

## Anatomy
Pill variant: rounded capsule filled with a mid grey, one line of text inside, horizontally and vertically centred in the pane. Plain variant: one line of large secondary-colour text centred in the pane, no background.

## Variants and parameters
| Variant | Where | Shown |
|---|---|---|
| Capsule with instruction text | Automator workflow area | yes, light and dark |
| Plain centred label ("No Selection", "No Message Selected", "No Results") | Mail viewer, Contacts card, Finder search, Notes | not shown in any reviewed screenshot |
| Blank pane (no text) | Finder Open panel for an empty iCloud Drive, Automator log | yes |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Normal | yes | Automator |
| Drag hovering over the pane | no | Automator highlights the drop area; text unchanged [I] |
| Inactive window | no | unchanged [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Capsule height | 26 | [M] | 10-15-Catalina-Light-Automator.png @ 1400,798,1,52; 10-15-Catalina-Dark-Automator.png @ 1400,798,1,52 |
| Capsule width | 317 for this string (text width 290 + 13.5 padding each side) | [M] | bbox 10-15-Catalina-Light-Automator.png @ 1177,798,634,52; text starts x=1204 |
| Corner radius | 13 (fully rounded ends) | [C] | height / 2; end pixel x=1177 on the centre row |
| Position | centred in the workflow pane: capsule centre x=1493.5 in a pane x=876..2111; centre y=823.5 in a pane y=212..1473 | [M] | same bbox; pane bounds from 10-15-Catalina-Light-Automator.png @ 1400,212,1,1262 |
| Plain label variant | single line, centred both ways; about 20 pt | [I] | not shown; typical AppKit apps use the system font at 18-22 pt in `tertiaryLabelColor` |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Capsule fill | `#b3b3b3` | `#515151` | [M] | 10-15-Catalina-Light-Automator.png @ 1190,822; 10-15-Catalina-Dark-Automator.png @ 1190,822 |
| Capsule text | `#ffffff` | `#7c7c7c` | [M] | 10-15-Catalina-Light-Automator.png @ 1204,822; 10-15-Catalina-Dark-Automator.png @ 1204,822 |
| Pane behind it | `#e7e9e9` | `#2c2d2f` | [M] | 10-15-Catalina-Light-Automator.png @ 1400,400; 10-15-Catalina-Dark-Automator.png @ 1400,400 |
| Plain label colour | `#000000` @ 0.25 (tertiary label) | `#ffffff` @ 0.25 | [I] | system tertiary label colour; not captured |

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Capsule text | SF Pro Text 13 pt Regular, one line, centred | [C] | line box y=813..836 (cap + descender 24 px): 10-15-Catalina-Dark-Automator.png @ 1204,813,580,24 |
| String | "Drag actions or files here to build your workflow." | [M] | visible text |

### Shadows and effects
None.

## Layout and spacing
Centre in the available pane; never wrap to more than two lines; keep at least 20 pt from the pane edges [I].

## Keyboard and accessibility
Not focusable. AX: static text. ARIA: plain text inside the region, or `role="status"` if it appears as the result of an action (for example an empty search).

## Browser notes
None.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Automator.png | 1150,780,690,90 | capsule placeholder |
| dark | 10-15-Catalina-Dark-Automator.png | 1150,780,690,90 | same, dark |
| light | 10-15-Catalina-Light-Finder-Open-iCloud.png | 424,160,1290,730 | blank empty browser (no text) |

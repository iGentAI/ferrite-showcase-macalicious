# Inline badge in lists (`sidebar-badge`)

- **Status:** present (one instance per appearance, in an inactive window)
- **AppKit:** `NSButton` with `bezelStyle = .inline` (the "inline" rounded-rect bezel) used as a non-interactive count badge in a source-list row; plain trailing `NSTextField` for the un-pilled count variant
- **HIG:** https://web.archive.org/web/20200503160808/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/sidebars/
- **Appearances shown:** light, dark

## Purpose and behaviour
Shows a count (unread messages, drafts) at the trailing edge of a sidebar row. It is informational; it does not take clicks separately from the row. Two renderings exist in Catalina's own apps: a filled pill with knocked-out digits (Mail) and a plain right-aligned number (Notes, Reminders).

## Anatomy
1. Pill: fully rounded rectangle filled with the row's secondary text colour.
2. Digits: 11 pt bold, drawn as a knock-out (they show the sidebar material through the pill).

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| Style | pill / plain number | pill | `.inline` bezel / label | pill: Mail "Drafts 1"; plain: Notes "5", Reminders "0 / 5 / 13" |
| Width | grows with digit count, minimum 24 pt | 24 | intrinsic size | 1 digit only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Unselected row, inactive window | yes | Mail light and dark |
| Unselected row, key window | no | same geometry; fill = secondary label colour on the sidebar, about `#8a8b8b` light [I] (the inactive value is lighter because the whole sidebar dims) |
| Selected row (grey highlight) | no | pill fill becomes the selected text colour at ~60 % and digits knock out to the highlight colour [I] |
| Selected row (accent highlight) | no | white pill with accent-coloured knocked-out digits [I] (documented AppKit behaviour of inline badges in emphasized rows) |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Pill width (1 digit) | 24 | [M] | 10-15-Catalina-Light-Mail.png @ 380,320,48,1; 10-15-Catalina-Dark-Mail.png @ 368,318,48,1 |
| Pill height | 16 | [M] | 10-15-Catalina-Light-Mail.png @ 402,304,1,32; 10-15-Catalina-Dark-Mail.png @ 380,302,1,32 |
| Corner radius | 8 (fully rounded ends) | [C] | height / 2; end caps are anti-aliased single pixels at x=380 and x=427 on the centre row |
| Trailing inset | pill right edge 12 from the sidebar divider | [M] | pill right edge x=427, divider at x=452 (10-15-Catalina-Light-Mail.png @ 427,320,26,1) |
| Vertical position | centred on the row (row rect 298..345 px, pill 304..335 px) | [M] | same |
| Plain-number variant | 13 pt regular digits, right edge 11-12.5 from the divider, baseline shared with the row label | [M] | 10-15-Catalina-Light-Notes.png @ 454,217,12,19; 10-15-Catalina-Light-Reminders.png @ 636,599,14,19 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Pill fill, inactive window | `#777777` | `#a8a9ab` | [M] | 10-15-Catalina-Light-Mail.png @ 390,320; 10-15-Catalina-Dark-Mail.png @ 380,318 |
| Digit (knock-out = sidebar colour) | `#f6f6f6` | `#2c2d2f` | [M] | 10-15-Catalina-Light-Mail.png @ 402,312; dark digit centre at x=392..394 on y=318 |
| Plain number, unselected | `#686867` | `#a8a9ab` [C, same as header colour] | [M] light | 10-15-Catalina-Light-Reminders.png @ 636,599,14,19 |
| Plain number, grey-selected row | `#8d8d8d` | n/a | [M] | 10-15-Catalina-Light-Notes.png @ 454,217,12,19 |
| Plain number, accent-selected row | `#ffffff` [I for light] | `#ffffff` | [M] dark | 10-15-Catalina-Dark-Notes.png @ 454,217,13,20 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Digit font | SF Pro Text 11 pt Bold, centred | same | [C] | digit "1" occupies y=311..313 gap in column x=402 and the pill is 16 pt; weight judged from the 3 px stem at 10-15-Catalina-Light-Mail.png @ 403,320,4,1 |

### Shadows and effects
None.

## Layout and spacing
Trailing-aligned in the row; the row label truncates before it with at least 4 pt gap [I].

## Keyboard and accessibility
Not focusable. Expose the count in the row's accessible name ("Drafts, 1 item"); ARIA: plain text inside the `treeitem`, or `aria-label` on the row.

## Browser notes
The knock-out can be done with a solid digit colour equal to the sidebar fallback colour; a true knock-out over a varying material needs `mask`/`mix-blend-mode` and is not necessary with the opaque fallback.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Mail.png | 370,296,70,48 | "1" pill on Drafts, inactive window |
| dark | 10-15-Catalina-Dark-Mail.png | 356,294,74,48 | same, dark |
| light | 10-15-Catalina-Light-Notes.png | 440,206,52,40 | plain count on a grey-selected row |
| dark | 10-15-Catalina-Dark-Notes.png | 440,206,52,40 | plain count on an accent-selected row |
| light | 10-15-Catalina-Light-Reminders.png | 600,590,70,180 | plain counts 0 / 5 / 13 |

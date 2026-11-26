# List (`list-view`)

- **Status:** present
- **AppKit:** view-based single-column `NSTableView` (no header, `selectionHighlightStyle = .regular`), custom `NSTableCellView` with two or three text lines; hairline row separators drawn by the cell or `gridStyleMask = .solidHorizontalGridLineMask`
- **HIG:** https://web.archive.org/web/20200503153039/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/table-views/
- **Appearances shown:** light, dark

## Purpose and behaviour
The middle "item list" column of three-pane apps (Mail messages, Notes, Contacts names, Messages conversations) and single-pane lists (Reminders, Find My people). Each row summarises one item on one to three lines; selecting a row shows the item in the detail pane. Behaviour (selection, keyboard, scrolling) is a single-column table view [D] (HIG table-views).

## Anatomy
```
| <inset> Title (bold)                    [thumb] |
| <inset> date  secondary text                    |
| <inset>------------------------------------------| 1 pt separator, inset on the leading side only
```
1. Pane background (opaque content colour, or sidebar-like material in Messages / Find My).
2. Selection highlight: full row width and full row height including the separator line.
3. Text lines; optional leading control (Reminders circle, Messages avatar) and trailing thumbnail (Notes) or date (Mail, Messages).
4. Separator hairline between rows, inset from the leading edge to the text start, running to the trailing edge.

## Variants and parameters
| Variant | Row height | Lines | Separator | Shown in |
|---|---|---|---|---|
| One-line name list | 24 | 1 (13 pt bold) | none | Contacts |
| Reminder list | 34 (expands for notes/images) | 1 (13 pt) + leading 18 pt circle | 1 pt, inset 50 | Reminders |
| Two-line note list | 56 | title 13 pt bold + date/snippet 12-13 pt | 1 pt, inset 25 | Notes |
| Three-line message list | at least 43 visible (partly covered) | sender 13 pt bold + subject + 2-line preview, 15 pt line pitch | not visible | Mail |
| Conversation list | 64 | name/date + snippet, leading 45 pt avatar | hairline (vibrant) | Messages |
| Person list | about 49 | name 13 pt bold + place, leading 30 pt avatar | 1 pt, inset 49 | Find My |
| Word list | 28 | 1 (13 pt) | none | Dictionary (sidebar material) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Normal | yes | all |
| Selected, unemphasized (grey) | yes | Notes (light and dark), Contacts (light and dark), Mail (inactive window, both), Reminders edited row |
| Selected, emphasized (accent) | yes | Messages conversation (blue with white text), light and dark. The Messages window is not key in either capture (the Preferences window is in front), so this list keeps the emphasised selection without the keyboard and in a window that is not key |
| Hover | partly | Reminders shows an info button (i) on the hovered/edited row; no background change |
| Disabled | no | n/a |
| Swipe actions (trackpad) | no | coloured action tiles slide in from the trailing edge [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Notes row height | 56 (separator pitch 112 px) | [M] | 10-15-Catalina-Dark-Notes.png @ 880,374,1,2 / 486 / 598 / 710 (#343536 lines); selected row 10-15-Catalina-Dark-Notes.png @ 880,152,1,112 |
| Notes separator | 1 pt, starts 25 pt from the pane's left edge, runs to the right edge | [M] | 10-15-Catalina-Dark-Notes.png @ 544,375,446,1 (pane x=494..989) |
| Notes text inset | 25.5 (x=545); title cap top 12.5 pt below the row top; second line 18 pt lower | [M] | 10-15-Catalina-Dark-Notes.png @ 545,177,299,26 and 545,213,185,24; light: 10-15-Catalina-Light-Notes.png @ 545,290,325,25 |
| Notes list pane width | 248 | [M] | 10-15-Catalina-Dark-Notes.png @ 494,250,496,1 |
| Reminders row pitch | 34 (33 + 1 separator) | [M] | 10-15-Catalina-Light-Reminders.png @ 1500,330,1,70 (#e6e6e6 x2, #ffffff x66, #e6e6e6 x2) |
| Reminders separator inset | 50 from the pane's left edge (x=774, pane starts x=674) | [M] | 10-15-Catalina-Light-Reminders.png @ 674,331,127,1 |
| Reminders completion circle | 18 diameter, 1 pt ring, left edge 17 from the pane edge, centred in the row | [M] | 10-15-Catalina-Light-Reminders.png @ 708,280,36,34 |
| Reminders expanded row | 69 (row with an image attachment) | [M] | 10-15-Catalina-Light-Reminders.png @ 1500,672,1,138 |
| Contacts row height | 24 | [M] | 10-15-Catalina-Light-Contacts.png @ 800,190,1,48; 10-15-Catalina-Dark-Contacts.png @ 860,210,1,48 |
| Contacts text inset | 29.5 (x=541, pane x=482) | [M] | 10-15-Catalina-Light-Contacts.png @ 541,204,203,25 |
| Mail sort bar above the list | 22 + 1 pt border | [M] | 10-15-Catalina-Light-Mail.png @ 1000,196,1,46 |
| Mail row text | three lines at 15 pt pitch (tops y=254, 284, 316), inset 24.5 (x=503, pane x=454), right inset 9.5 | [M] | 10-15-Catalina-Light-Mail.png @ 503,254,620,70 |
| Messages row height | 64 | [M] | 10-15-Catalina-Light-Messages.png @ 900,214,1,128; 10-15-Catalina-Dark-Messages.png @ 900,206,1,90 (cut by the window in front) |
| Messages avatar | 45 diameter (x=789..878, white ring around a grey disc x=814..853), left edge 21.5 from the pane edge | [M] | 10-15-Catalina-Light-Messages.png @ 789,260,90,1 |
| Find My row | name cap top y=251, subtitle y=285, separator y=324 (1 pt) | [M] | 10-15-Catalina-Light-Find-My.png @ 212,251,145,56 and 500,324,1,2 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| List background, standard | `#ffffff` | `#1e1f21` | [M] | 10-15-Catalina-Light-Reminders.png @ 1500,300; 10-15-Catalina-Dark-Notes.png @ 887,300; Dark-Contacts @ 860,100 (#1e1f20) |
| List background, Notes light (paper texture) | noise around `#f9f9f7`, range #f2f3f2 .. #fffffd | n/a (flat) | [M] | 10-15-Catalina-Light-Notes.png @ 494,375,60,1 |
| Separator | `#e6e6e6` | `#343537` (Reminders), `#343536` (Notes) | [M] | 10-15-Catalina-Light-Reminders.png @ 1500,330; 10-15-Catalina-Dark-Reminders.png @ 1500,330; Dark-Notes @ 880,374 |
| Selected, unemphasized | `#dcdcdc` (Contacts, Mail); Notes about `#e0e0de` (textured) | `#464646` (Contacts, Mail); Notes `#343537` | [M] | Light-Contacts @ 800,214; Light-Mail @ 1000,260; Dark-Contacts @ 860,234; Dark-Mail @ 1000,260; Dark-Notes @ 880,200 |
| Selected, emphasized (Messages, vibrant) | `#2866cd (sRGB #0b64d4)` .. `#3b7ae5 (sRGB #2678ed)` (left to right over the wallpaper) | `#2766c9 (sRGB #0664d0)` .. `#235ab1 (sRGB #0959b7)` | [M] | 10-15-Catalina-Light-Messages.png @ 760,260 and 1250,260; 10-15-Catalina-Dark-Messages.png @ 900,210 and 900,292 |
| Edited/hovered reminder row | `#f3f3f3` | `#303133` | [M] | 10-15-Catalina-Light-Reminders.png @ 1500,700; 10-15-Catalina-Dark-Reminders.png @ 1500,740 |
| Reminders circle ring | `#808080` | `#9a9a9b` | [M] | bbox extremes at 10-15-Catalina-Light-Reminders.png @ 708,280,36,34; Dark same box |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Primary line | SF Pro Text 13 pt Bold (Notes, Contacts, Mail sender, Find My); 13 pt Regular (Reminders, Dictionary) | same | [C] | cap/line boxes: Light-Contacts @ 541,204,203,25; Light-Reminders @ 774,278,66,36 |
| Primary colour | `#252525` (Notes), `#272727` (Contacts, Reminders), `#222122` (Mail) | `#dddddd` (Notes, Reminders) | [M] | Light-Notes @ 545,290,325,25; Dark-Notes same; Light-Reminders @ 708,278,132,36 |
| Primary colour on unemphasized selection | unchanged (`#212221`) | `#e0e0e0` | [M] | Light-Notes @ 545,177,298,26; Dark-Notes @ 545,177,299,26 |
| Secondary line | 12-13 pt Regular; date in primary colour, snippet in secondary grey | same | [C] | Light-Notes @ 546,326,193,22 |
| Mail third line (preview) | `#666666` | `#a6a7a7` (inactive list, only top of glyphs visible above compose window) | [M] | 10-15-Catalina-Light-Mail.png @ 504,316,413,8; lightest ink in 10-15-Catalina-Dark-Mail.png @ 490,313,420,8 |
| Text on emphasized selection | white; date and snippet `#c4d6f7 (sRGB #c0d6fa)` (white at reduced opacity over the blue) | white | [M] | Light-Messages @ 1168,234,90,19 and 900,265,248,23 |

### Shadows and effects
None. Notes thumbnails have a 0.5 pt grey outline (app-specific).

## Layout and spacing
- Leading text inset equals the separator inset except in Reminders/Find My/Messages, where the separator starts at the text and the control/avatar sits in the gutter.
- The list pane is separated from its neighbours by 1 pt split-view dividers (see `split-view`).
- A sort/filter bar (Mail "Sort by Date") or search field (Contacts, Messages) may sit above the rows inside the pane.

## Keyboard and accessibility
Up/Down select; Delete removes where applicable; Return edits (Reminders) or opens. AX role `AXTable`/`AXList` with `AXRow`s; ARIA `role="listbox"` with `option` rows (`aria-selected`).

## Browser notes
- Notes' light paper texture is a bitmap noise pattern; substitute a flat `#f9f9f7` or a subtle tiled noise image.
- Messages' blue selection is vibrant over the desktop; use a flat accent `#2f6fde (sRGB #166de6)`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Notes.png | 494,152,496,560 | two-line rows, thumbnails, separators |
| dark | 10-15-Catalina-Dark-Notes.png | 494,152,496,560 | same, dark |
| light | 10-15-Catalina-Light-Reminders.png | 674,250,970,1000 | reminder rows with circles and separators |
| dark | 10-15-Catalina-Dark-Reminders.png | 674,250,970,1000 | same, dark |
| light | 10-15-Catalina-Light-Contacts.png | 482,140,376,150 | one-line names, grey selection |
| dark | 10-15-Catalina-Dark-Contacts.png | 508,160,376,110 | same, dark |
| light | 10-15-Catalina-Light-Mail.png | 454,196,688,132 | sort bar and three-line message row |
| dark | 10-15-Catalina-Dark-Mail.png | 442,194,686,130 | same, dark |
| light | 10-15-Catalina-Light-Messages.png | 746,214,540,128 | emphasized conversation row |

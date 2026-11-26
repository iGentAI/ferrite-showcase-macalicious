# Form layout (`form`)

- **Status:** present (added by the inventory gap closure, 6 October 2026: every preferences window and most panes show it, and no row covered it)
- **AppKit:** `NSGridView` (10.12 and later), or controls and `NSTextField` labels aligned by hand in Interface Builder; `NSForm` is the legacy matrix of the same idea
- **HIG:** https://web.archive.org/web/20200503203715/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/boxes/
- **Appearances shown:** light, dark

## Purpose and behaviour
The layout of a preferences pane: a column of labels that end in a colon, each right-aligned against the control it names and on its baseline, and a column of controls that share a leading edge. Groups of rows are divided by a separator or by extra space. It is not a control: nothing in it is interactive except the controls it holds. [D]

## Anatomy
Two columns. Label column: `label` text, right-aligned, one line. Control column: one control, or several on one baseline (a pop-up button followed by text), or a stack (checkboxes). Optional explanatory text in the small system font under a control. A row without a label keeps its control in the control column.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| label alignment | end, start | end | `NSGridColumn.xPlacement` `.trailing` / `.leading` | end everywhere; start in System Information |
| row content | one control, several controls, a stack, static text | one control | grid cell content | all four |
| explanatory text | present, absent | absent | a second `NSTextField` under the control | Sharing, Energy Saver, Displays, Network |
| control size | regular, small, mini | regular | `NSControl.ControlSize` | regular; small only inside Finder's Get Info |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes, light + dark | `10-15-Catalina-Light-Calendar-Preferences.png @ 184,256,930,538`; Dark same |
| disabled row | yes, light + dark | Calendar Preferences, "Show alternate calendar:" with a disabled pop-up button; Date & Time locked |
| inactive window | not shown for a form of its own | [I] label colours do not change with the window state (see `label`) |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Label ink to control bezel | 10 (Calendar Preferences), 9.5 (Sharing) | [M] | Calendar Preferences: label right edge x=594, pop-up bezel x=614 (`apps/calendar-preferences.md`); `10-15-Catalina-Light-System-Preferences-Sharing.png` row 222: colon ends x=410, field edge x=429 |
| Label box to control box | 8 | [C] | the ink ends 1 pt before the label's box (the colon's side bearing) and the bezel starts 0.5 to 1 pt inside the control's alignment box; `--mac-space-label-gap` |
| Row pitch, 21 pt pop-up buttons | 30 | [M] | Calendar Preferences: control tops y=273, 333, 393, 453 |
| Row gap | 9 | [C] | 30 pt pitch less the 21 pt control box |
| Separator between groups | 20 above and 20 below, to the controls' boxes | [M] | Calendar Preferences: last control top y=453 (a 21 pt box), line y 534..535, next control top y=577 |
| Text after a control on the same row | starts 7 after the control | [M] | Calendar Preferences row "Show:": pop-up x 614..719, then "hours at a time" (measured by the Calendar demo, `demos/calendar/calendar-preferences.css`) |
| Explanatory text, horizontal | flush with the control's edge | [M] | Sharing: field edge x=429, text ink starts x=429 |
| Explanatory text, vertical | capitals start 9.5 under the field's edge; first line box 4.5 under the field's box | [M] | Sharing: field edge ends y=242, capitals of "Computers" start y=261; 11 pt text, 14 pt line pitch (second line's ink ends y=306) |
| Stacked checkboxes in one row | 20 pitch: 6 between two 14 pt boxes | [M] | Calendar Preferences: checkboxes at y=936 and 976 (see `checkbox`) |
| Labels under the ends of a slider | 11 pt text centred on the end tick marks; capitals start 6 under the marks; the labels' boxes start 2 under the slider's box | [M] | `10-15-Catalina-Light-System-Preferences-Dock.png`: marks end y=237, capitals of "Small" and "Large" start y=249; ink x 636..685 and 1008..1060 around marks at x=660 and 1033 |
| Rows of keys and values, 11 pt text | 22 pitch (8 between 14 pt lines) in the Printers & Scanners pane; 14 pitch in Finder's Get Info; 13 pitch in System Information | [M] | `10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png`: capitals start y=463, 507, 551; `10-15-Catalina-Light-Finder-Get-Info.png`: y=351, 379, 407, 435; `10-15-Catalina-Light-System-Information.png`: y=304, 330, 356, 382 |
| Key ink to value ink, Printers & Scanners | 10 | [M] | colon of "Location:" ends x=835, "Castle" starts x=855 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Label | label colour | label colour | [M] | as `label`: `#242424` on `#ececec` at `10-15-Catalina-Light-System-Preferences-Sharing.png @ 371,222` |
| Label of a disabled row | tertiary label colour | tertiary label colour | [I] | as `label`, disabled title |
| Explanatory text | label colour | label colour | [M] | Sharing: darkest ink `#242424` in both the label (x 209..411, y 213..236) and the text under the field (x 429..700, y 261..282) |

### Text and icons
Labels: 13 pt system font, regular. Explanatory text: 11 pt, 14 pt line pitch (sizes as in `label`). [C]

### Shadows and effects
None.

## Layout and spacing
| Pane | Label column ends (pt from frame) | Controls start | Tag | Evidence |
|---|---|---|---|---|
| Calendar Preferences, General | 241 | 251 | [M] | label right edge x=594, bezel x=614, frame x=112 |
| Sharing, Computer Name | 149 | 158.5 | [M] | colon x=410, field edge x=429, frame x=112 |
The label column is as wide as its longest label and the two columns are centred as a block in a preferences window (see `preferences-window`); in a System Preferences pane the block is placed by the pane.

## Keyboard and accessibility
Not focusable. Each label names its control (`NSAccessibility` title UI element); a label over several controls names the group. ARIA: a label associated with its control (`aria-labelledby`), `role="group"` for a row of several controls, explanatory text as the control's description. [D]

## Browser notes
A two-column CSS grid with rows as subgrids and `align-items: baseline` reproduces the layout: AppKit aligns label and control on their first baselines, and so does the grid.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Calendar-Preferences.png | 184,256,930,538 | seven rows of pop-up buttons in three groups, two separators |
| light | 10-15-Catalina-Light-System-Preferences-Sharing.png | 200,194,1000,118 | label, text field and two lines of explanatory text |
| dark | 10-15-Catalina-Dark-Calendar-Preferences.png | 184,256,930,538 | the same rows |
| dark | 10-15-Catalina-Dark-System-Preferences-Sharing.png | 200,194,1000,118 | the same row |
| light | 10-15-Catalina-Light-Calendar-Preferences.png | 176,928,360,84 | two stacked checkboxes |
| light | 10-15-Catalina-Light-System-Preferences-Dock.png | 626,190,444,84 | a slider with labels under its ends |
| light | 10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png | 700,452,520,128 | three rows of keys and values |

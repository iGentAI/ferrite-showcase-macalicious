# Date Picker (`date-picker`)

- **Status:** present
- **AppKit:** `NSDatePicker` (`datePickerStyle`: `.textFieldAndStepper`, `.textField`, `.clockAndCalendar`; `datePickerElements`: `.yearMonthDay`, `.yearMonth`, `.hourMinute`, `.hourMinuteSecond`, `.era`, `.timeZone`; `datePickerMode`: `.single`, `.range`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/selectors/date-pickers/
- **Appearances shown:** light, dark

## Purpose and behaviour
Lets the user choose a date, a time, both, or a range of dates. Two styles: textual (a field with date and time elements, by default with a stepper) for constrained space and precise entry; graphical (a month calendar and / or a clock face) for browsing, ranges, or where a clock suits the interface. In the textual style the user selects an element, then types or uses the Up / Down arrows or the stepper to change it; element order follows the user's locale. In the graphical style the user clicks a day or drags the clock hands. [D] (HIG, Date Pickers)

## Anatomy
```
textual:   [ 10:00 PM ] (^v)        field 23 pt high + stepper, 4 pt apart

graphical calendar (137.5 x 147):   graphical clock (120 x 120):
  Oct 2019            <  o  >         metallic rim, white face, 12 numerals,
  Su Mo Tu We Th Fr Sa                hour / minute hands black, second hand red,
  -------------------                 AM / PM label below centre
  29 30  1  2 [3] 4  5
   6  7  8  9 10 11 12  ...6 rows
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| style | text field + stepper, text field, clock and calendar | text field + stepper | `datePickerStyle` | text field + stepper (Notifications, Date & Time); clock and calendar (Date & Time) |
| elements | date, time, date and time (with or without seconds / day) | date and time | `datePickerElements` | hour-minute (Notifications), year-month-day and hour-minute-second (Date & Time) |
| mode | single, range | single | `datePickerMode` | single |
| enabled | true, false | true | `isEnabled` | enabled textual (Notifications); disabled textual and graphical (Date & Time, pane locked) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| textual, enabled, no element selected | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Notifications.png @ 819,545,164,46`; Dark same |
| textual, disabled | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 474,393,192,46`; Dark same |
| textual, element selected (editing) | not shown | [I] the selected element gets a rounded `selectedTextBackgroundColor`-style highlight (accent colour, white text when the field is key) |
| graphical calendar, disabled, with a selected day | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 431,457,275,294`; Dark same |
| graphical calendar, enabled | not shown | [I] month title at the primary label colour, navigation glyphs at the secondary label colour, selected day in the accent colour |
| graphical clock (disabled) | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 892,489,240,240`; Dark same |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Textual field height | 23 | [M] | Light Notifications col 880: border y 545..590; Light Date & Time col 480: y 393..438 |
| Textual field width | 65 ("10:00 PM"), 81.5 with the stepper | [M] | Light Notifications row 568: field x 819..948; stepper to x=981 |
| Field corner radius / border | 0 / 0.5 with a 0.5 inner line, as `text-field` | [M] | Light Notifications col 880 y 545..546 |
| Text inset | 3.5 (border to first ink); cap top 7 pt below the field top; baseline 17 below the top | [M] | Light Notifications `@ 822,550,124,36`: ink x from 826, rows y 559..578 for field x=819, y=545 |
| Stepper | see `stepper`: 12 x 21, 4 pt after the field, vertically centred | [M] | Light Notifications row 568 |
| Calendar outer size | 137.5 x 147 | [M] | Light Date & Time row 600: border x=431 and x=705; col 436: y 457..750 |
| Calendar border / corners | 0.5 line with 0.5 inner line; square corners | [M] | Light Date & Time grid `@ 430,456,5,5` |
| Month title | 13 pt bold, ink from 3.5 pt inside the left border, cap top 5 pt below the top border | [M] | Light Date & Time `@ 436,462,130,30`: x 438.., rows y 467..485 |
| Navigation glyphs | previous: left-pointing filled triangle 5.5 x 6; today: filled disc 7 pt; next: right-pointing triangle 5.5 x 6; centres 14.25 pt apart; right triangle ends 6 pt inside the right border; vertically centred on the title | [M] | Light Date & Time: triangle `@ 626,471,11,12`, disc `@ 653,470,14,14`, triangle `@ 683,471,11,12` |
| Weekday header | 11 pt bold, two-letter names right-aligned to the day columns; cap top 25 pt below the top border | [M] | Light Date & Time `@ 438,502,36,26` (rows y 507..521), `@ 668,502,36,26` |
| Header divider | 1 pt line 36.5 pt below the top border, inset 2.5 pt from each side border | [M] | Light Date & Time row 531: x 436.. `#e6e6e6`; col 436: y 530..531 |
| Day grid | 7 columns, pitch 18.5; 6 rows, pitch 18; digits right-aligned, right edge of column n at 19.5 + 18.5 n pt from the left border (n = 0..6) | [M] | Light Date & Time: digit right edges x 469, 506, 543, 580, 617, 654, 691; row cap tops y 543, 579, 615 |
| Day digits | 11 pt regular, digit height 16 px | [C] | Light Date & Time `@ 668,538,36,24` |
| Selected day cell | 19 wide x 16 high, square corners, covering its column from 15.5 pt left of the digit's right edge to 3 pt right of it, and from 4.5 pt above the digit top | [M] | Light Date & Time row 550: fill x 586..623 (digit right edge x=617); col 600: y 534..565 (digit top y=543) |
| Clock outer diameter | 120 | [M] | Light Date & Time row 610: x 892..1131; col 1012: y 489..728 |
| Clock rim thickness | 8.5 at the sides (the face starts 8.5 pt inside the outer edge); at 12 o'clock the shaded band is 15 pt deep including the top highlight | [M] | Light Date & Time row 610: rim x 892..908, face from 909; col 1012: y 489..518, face from 519 |
| Clock numerals | 13 pt-class bold digits (cap height 19 px), centres on a circle of radius about 45 pt | [M] / [C] | Light Date & Time `@ 1086,590,30,40` ("3": x 1096..1108, rows y 599..617; clock centre x=1011.5) |
| Clock AM / PM label | 13 pt regular, centred, cap top 13 pt below the centre | [M] | Light Date & Time `@ 990,626,50,34`: rows y 635..653, clock centre y=608.5 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Textual field: border | `#aaaaaa` on `#e3e3e3` = `rgba(0,0,0,0.25)`; inner line `#f0f0f0` | left `#49494a`, top `#4d4c4d`, bottom `#686869` | [M] / [C] | Notifications col 880 y 545, 590; row 568 x=819 |
| Textual field: fill | `#ffffff` | `#292929`..`#2a2a2a` (darker than the box behind it; this is not the `text-field` fill) | [M] | Notifications `@ 880,568` |
| Textual field: text | `#272727` = black @ 0.85 | `#dedfde` = white @ 0.85 | [M] / [C] | Notifications `@ 822,550,124,36` |
| Disabled field | border `#c8c8c8`, inner `#f2f2f2`, fill `#ffffff`, text `#c0c0c0` (black @ 0.25) | border `#3f4041` / bottom `#4d4d4d`, fill `#232323`, text `#595b5a` (white @ 0.25) | [M] / [C] | Date & Time col 480 y 393..438; `@ 478,400,150,34` |
| Calendar: border / inner line | `#c8c8c8` / `#f2f2f2` | `#3f4041` (top), `#3c3c3d` (sides), bottom `#4d4d4e` | [M] | Date & Time grid `@ 430,456,5,5`; col 436 y 750 |
| Calendar: background | `#ffffff` | `#232323` | [M] | Date & Time `@ 600,700` |
| Calendar: header divider | `#e6e6e6` | `#393939` | [M] | Date & Time row 531 |
| Calendar: month title, navigation glyphs (disabled) | `#c0c0c0` = black @ 0.25 | `#595b5a` = white @ 0.25 | [M] / [C] | Date & Time `@ 436,462,130,30` |
| Calendar: month title, navigation glyphs (enabled) | `rgba(0,0,0,0.85)` / `rgba(0,0,0,0.5)` | `rgba(255,255,255,0.85)` / `rgba(255,255,255,0.55)` | [I] | not shown; label colours measured elsewhere (`label`) |
| Calendar: weekday names | `#808080` = black @ 0.5 | `#9c9c9c` = white @ 0.55 | [M] / [C] | Date & Time `@ 438,502,36,26` |
| Calendar: days in month | `#272727` = black @ 0.85 | `#dedede` = white @ 0.85 | [M] / [C] | Date & Time `@ 668,538,36,24`; Dark col 598 |
| Calendar: days outside the month | `#c0c0c0` = black @ 0.25 | white @ 0.25 [C] | [M] | Date & Time `@ 438,538,34,24` |
| Calendar: selected day | fill `#2465d9 (sRGB #0362e1)`, text `#ffffff` | fill `#1e5ac8 (sRGB #0057cf)`, text `#ffffff` | [M] | Date & Time row 550 x 586..623 (light); Dark row 550 x 624.. |
| Clock: rim | vertical metallic gradient: top `#d6e7ed (sRGB #d2e8ee)`, `#929394` -> `#f2f3f4` inner bevel; bottom `#777777`; sides `#a5adae (sRGB #a3adae)` | same artwork | [M] | Date & Time col 1012 y 489..517, 718..728; row 610 x 893..901 |
| Clock: face | `#fcfdfe` | `#fcfdfe` (the face stays white in dark mode) | [M] | Date & Time `@ 950,560` (light, dark) |
| Clock: numerals and hands | `#000000`; second hand `#ec4d3e (sRGB #ff3b31)`; AM label `#aaaaaa` | same | [M] | Date & Time row 610; `@ 990,626,50,34` |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Field text | SF Pro Text 13 pt regular, tabular digits (elements are padded with a figure space: "10/ 3/2019") | same | [C] | Notifications `@ 822,550,124,36` (digit height 19..20 px) |
| Month title | SF Pro Text 13 pt bold | same | [C] | Date & Time `@ 436,462,130,30` |
| Weekday names | SF Pro Text 11 pt bold | same | [C] | cap height 15 px |
| Day digits | SF Pro Text 11 pt regular | same | [C] | digit height 16 px |

### Shadows and effects
None on the textual field or calendar. The clock rim is shaded artwork (see Browser notes).

## Layout and spacing
Date & Time places the textual date field centred above the calendar (10 pt gap) and the textual time field centred above the clock (26.5 pt gap); calendar and clock are 93 pt apart. [M] `10-15-Catalina-Light-System-Preferences-Date-and-Time.png`: field bottom y=438, calendar top 457; time field bottom 436, clock top 489; calendar right x=705, clock left 892.

## Keyboard and accessibility
Textual: Tab / Left / Right move between elements, Up / Down step the selected element, digits type a value. Graphical calendar: arrows move by day / week. Role `AXDateField` (textual) with an `AXIncrementor`; the calendar is an `AXGroup` of buttons. ARIA: segmented `role="spinbutton"` elements for the textual style; `role="grid"` with `aria-selected` cells for the calendar. [D]

## Browser notes
- `<input type="date">` cannot be styled to match; build the segmented field, the stepper and the grid.
- The clock face needs an SVG or image asset for the metallic rim; numerals and hands can be live.
- The dark textual field fill (`#2a2a2a`) differs from the dark `text-field` fill; keep them separate tokens.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Notifications.png | 819,545,164,46 | enabled time field with stepper |
| light | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png | 431,393,275,358 | disabled date field, stepper and calendar |
| light | 10-15-Catalina-Light-System-Preferences-Date-and-Time.png | 892,391,240,338 | disabled time field and clock |
| dark | 10-15-Catalina-Dark-System-Preferences-Notifications.png | 819,545,164,46 | enabled time field with stepper |
| dark | 10-15-Catalina-Dark-System-Preferences-Date-and-Time.png | 431,393,275,358 | disabled date field and calendar |

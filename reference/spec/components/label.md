# Label (`label`)

- **Status:** present
- **AppKit:** `NSTextField` configured as a label (`NSTextField(labelWithString:)`, `wrappingLabelWithString:`; `isEditable = false`, `isBezeled = false`, `drawsBackground = false`); colours `NSColor.labelColor`, `secondaryLabelColor`, `tertiaryLabelColor`, `quaternaryLabelColor`, `linkColor`, `textColor`; fonts `NSFont.systemFont(ofSize:)`, `NSFont.smallSystemFontSize` (11), `NSFont.labelFontSize` (10)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/fields-and-labels/labels/
- **Appearances shown:** light, dark

## Purpose and behaviour
A label is static text that describes an interface element or gives a short message; people cannot edit it but can sometimes copy it. Keep labels legible; use a colon when a label introduces a control (not when label and control form a sentence); use the four system label colours to show relative importance (label, secondary, tertiary for disabled text, quaternary for watermark text); make useful text such as addresses and error messages selectable. [D] (HIG, Labels)

## Anatomy
Text only. There is no background or border. Wrapping labels break on word boundaries and are left-aligned (centred in a few hero layouts).

## Variants and parameters
The styles found in window content. Sizes are derived from cap heights (px at 2x) and line pitch; colours are composites recovered to an alpha over the local background.

| Style | Size / weight | Line height | Colour token | Used for | Shown |
|---|---|---|---|---|---|
| control label | 13 regular | 16 | label | checkbox / radio titles, form labels, body copy | yes |
| form label (right-aligned) | 13 regular, ends with a colon | 16 | label | "Status:", "Network Name:", "Default printer:" | yes |
| emphasized | 13 bold | 16 | label | "Connected", printer name, "Your Mac is up to date...", pane titles under icons | yes |
| body, opaque | 13 regular | 16 | text (opaque) | Touch ID paragraph and "Use Touch ID for:" | yes |
| small | 11 regular | 14 | label | explanatory lines ("Wi-Fi is connected to..."), slider end labels | yes |
| small secondary | 11 regular | 14 | secondary | hints ("Banners and alerts will be hidden..."), list subtitles, status lines | yes |
| small form label | 11 bold, right-aligned | 22 pitch | tertiary | Printers "Location:", "Kind:", "Status:" | yes |
| mini | 10 regular | 13 | text (opaque) | Network "Known networks will be joined automatically..." | yes |
| secondary | 13 regular | 16 | secondary | "Click the lock to make changes.", "Add a fingerprint" | yes |
| disabled | 13 regular | 16 | tertiary | titles of disabled controls | yes |
| group header | 11 regular | - | tertiary | list group rows ("Current User", "Printers") | yes |
| link | 11 regular | 14 | link | "Details...", "See how your data is managed..." | yes |
| large value | about 27 regular (SF Pro Display) | - | label | Screen Time "48m" | yes |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| enabled, key window | yes, light + dark | evidence per style below |
| disabled (tertiary colour) | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png @ 364,408,524,30`; Dark same |
| inactive window | not shown in my screenshots | [I] unchanged: label colours do not depend on key state |
| link hover / pressed | not shown | [I] pointer becomes the pointing hand; pressed link darkens by about 15 % |
| selected text in a selectable label | not shown | see `highlight-color` |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| 13 pt: cap height | 18..20 px (9 pt; rounded letters overshoot) | [M] | `10-15-Catalina-Light-System-Preferences-Network.png @ 732,306,14,34` ("S": y 313..332); `...Wallet-and-Apple-Pay.png @ 806,298,18,30` ("A": y 305..323) |
| 13 pt: line pitch | 16 | [M] | `10-15-Catalina-Light-System-Preferences-Notifications.png @ 150,196,1260,70`: lines start y 198 and 230 |
| 11 pt: cap height | 15..16 px | [M] | `10-15-Catalina-Light-System-Preferences-Network.png @ 829,352,22,24` ("W": y 358..373); `...Software-Update.png @ 167,494,12,24` ("T": y 500..515) |
| 11 pt: line pitch | 14 | [M] | Light Network `@ 828,352,240,60`: lines start y 357 and 385; Light Startup Disk `@ 156,624,780,90`: 629, 657, 685 |
| 10 pt: cap height | 15 px | [M] | Light Network `@ 865,712,14,26` ("K": y 717..731) |
| 10 pt: line pitch | 13 | [M] | Light Network `@ 864,708,460,90`: lines start y 717, 743, 769 |
| Large value: digit height | 38 px -> about 27 pt | [M] / [C] | `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 537,262,26,48` ("4": y 267..304) |
| Regular stem width at 13 pt | 2 px | [M] | Light Network row 322: "t" stem x 752..753 |
| Bold stem width at 13 pt | 3..4 px | [M] | Light Network row 322: "n" stems x 850..854 |
| Bold stem width at 11 pt | 3 px | [M] | `10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png` row 471: "L" stem x 736..738 |

### Colours and fills
| Token | Light: composite -> recovered | Dark: composite -> recovered | Tag | Evidence |
|---|---|---|---|---|
| label (primary) | `#232323` on `#e3e3e3`, `#242424` on `#ececec`, `#262626` on `#ffffff` -> `rgba(0,0,0,0.85)` | `#e0e0e0` on `#363637`, `#dfdfdf` on `#2f3031`, `#dddddd` on `#1d1e1f` -> `rgba(255,255,255,0.85)` | [M] / [C] | Network `@ 700,306,120,34`, `@ 440,196,134,34`; Sharing `@ 244,440,180,28` |
| secondary | `#727272` on `#e3e3e3`, `#767676` on `#ececec`, `#7f7f7f`..`#808080` on `#ffffff` -> `rgba(0,0,0,0.5)` | `#a4a4a5` on `#363637`, `#a1a2a2` on `#2f3031`, `#999a9a` on `#1d1e1f` -> `rgba(255,255,255,0.55)` | [M] / [C] | Notifications `@ 670,410,420,60`; Security & Privacy `@ 230,1144,400,34`; Network `@ 200,404,200,30` |
| tertiary / disabled | `#a9a9a9`..`#aaaaaa` on `#e3e3e3`, `#bfbfbf`..`#c0c0c0` on `#ffffff` -> `rgba(0,0,0,0.25)` | `#686868` on `#363637`, `#565656` on `#1e1e1f` -> `rgba(255,255,255,0.25)` | [M] / [C] | Security & Privacy `@ 364,408,524,30`; Printers & Scanners `@ 720,458,120,30`, `@ 166,204,100,28` |
| quaternary | `rgba(0,0,0,0.10)` | `rgba(255,255,255,0.10)` | [D] / [I] | `quaternaryLabelColor`; not seen as text. The same alpha is measured for `separator` |
| text (opaque) | `#000000` | `#ffffff` | [M] | Touch ID `@ 542,186,860,70`; Network `@ 864,708,460,90` (light, dark) |
| link | `#266ad2 (sRGB #0068d9)` on `#ececec` | `#579cf9 (sRGB #419bff)` on `#303031` | [M] | Software Update `@ 250,580,110,28`; Wallet & Apple Pay `@ 878,586,340,30` (`#276ad3 (sRGB #0168da)`, `#589cf8 (sRGB #429bff)`) |
| table header text | `#171717` on `#f0f0f0` (black @ 0.90) | `#ffffff` on `#2a2b2c` | [M] | Sharing `@ 244,396,90,24`; Sound `@ 204,326,70,26` |

### Text and icons
| Style | Light sample | Dark sample | Tag | Evidence |
|---|---|---|---|---|
| control label, 13 regular | `#222222` on `#e3e3e3` | `#e1e1e1` on `#353637` | [M] | Network `@ 596,1014,380,34` |
| emphasized, 13 bold | `#232323` | `#e0e0e0` | [M] | Network `@ 828,306,150,34`; Software Update `@ 580,208,680,34` |
| small, 11 regular | `#232323` | `#e0e0e0` | [M] | Network `@ 828,352,240,60` |
| small secondary, 11 regular | `#727272` | `#a4a4a5` | [M] | Notifications `@ 670,410,420,60`; Time Machine `@ 910,304,320,28` |
| small form label, 11 bold | `#aaaaaa` | `#686868` | [M] | Printers & Scanners `@ 720,458,120,30` |
| group header, 11 regular | `#c0c0c0` on white | `#565656` on `#1e1e1f` | [M] | Users & Groups `@ 166,222,150,26` |
| secondary, 13 regular | `#767676` on `#ececec` | `#a1a2a2` on `#2f3031` | [M] | Security & Privacy `@ 230,1144,400,34` |
| link, 11 regular | `#266ad2 (sRGB #0068d9)` | `#579cf9 (sRGB #419bff)` | [M] | Software Update `@ 250,580,110,28` |
| large value | `#272727` on white | `#dcdddd` on `#1d1e1f` | [M] | Screen Time `@ 534,262,120,50` |

Font family: SF Pro Text below 20 pt, SF Pro Display at 20 pt and above; tracking is the system default for each size (SF Pro Text 13 pt: -0.08 pt; 11 pt: +0.06 pt; 10 pt: +0.12 pt) [D] (Apple's SF Pro tracking table). Text is greyscale anti-aliased (no subpixel colour fringes in any sample) [M].

### Shadows and effects
None. (Catalina does not emboss label text.)

## Layout and spacing
- Right-aligned form labels: the label's last ink (the colon) ends 7.5 pt before the control's left edge and shares the control's text baseline. [M] Light Network: "Network Name:" ends x=814, pop-up starts 830; "Location:" ends 565, pop-up starts 581; Light Siri: label ends 937, pop-up starts 953.
- Explanatory small text under a checkbox is left-aligned with the checkbox's title text (not with its box) and its first cap top is 11 pt below the box's bottom edge. [M] Light Network: checkbox box y 668..695, title ink x=867; "Known networks..." ink x=867, cap top y=717.
- A paragraph at the top of a pane is inset 20.5 pt from the window edge and 23 pt below the toolbar. [M] Light Notifications: ink x=153, cap top y=198.
- Wrapped lines are ragged-right; Wallet & Apple Pay centres its copy.

## Keyboard and accessibility
Not focusable unless selectable. Role `AXStaticText`; a label that names a control should be linked as its title (`AXTitleUIElement`). ARIA: `<label for>` for control labels, plain text otherwise; links are real `<a>` elements. [D]

## Browser notes
- Use `font-family: -apple-system, "SF Pro Text"` with `-webkit-font-smoothing: antialiased` to match the greyscale rendering; Catalina's default stem weight is slightly heavier than Chrome's on non-Apple platforms.
- Use the rgba label colours, not the composites, so text stays correct on boxes, lists and selected rows.
- Line heights 16 / 14 / 13 px for 13 / 11 / 10 px text reproduce the measured pitch.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Network.png | 700,306,400,100 | form label, bold value, small text |
| light | 10-15-Catalina-Light-System-Preferences-Network.png | 864,708,460,90 | 10 pt opaque text, three lines |
| light | 10-15-Catalina-Light-System-Preferences-Notifications.png | 670,332,420,130 | 13 pt label and 11 pt secondary hint |
| light | 10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png | 720,458,400,116 | small bold tertiary form labels with values |
| light | 10-15-Catalina-Light-System-Preferences-Software-Update.png | 160,456,300,150 | bold title, small text, link |
| light | 10-15-Catalina-Light-System-Preferences-Security-and-Privacy.png | 230,1144,400,34 | secondary 13 pt text |
| dark | 10-15-Catalina-Dark-System-Preferences-Network.png | 700,306,400,100 | same, dark |
| dark | 10-15-Catalina-Dark-System-Preferences-Notifications.png | 670,332,420,130 | same, dark |
| dark | 10-15-Catalina-Dark-System-Preferences-Software-Update.png | 160,456,300,150 | same, dark |

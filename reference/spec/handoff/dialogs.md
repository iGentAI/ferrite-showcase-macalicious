# Handoff: group "dialogs"

## Counts
- Screenshots covered: **72 of 72** assigned, all `viewed: true`, in `coverage/dialogs.json` (68 distinct component ids; checked by script against `seed.json`).
- Component files: **15** (`alert`, `dialog`, `sheet`, `open-panel`, `save-panel`, `print-panel`, `preferences-window`, `preferences-toolbar`, `inspector-panel`, `progress-window`, `notification-alert`, `about-window`, `assistant-window`, `accent-colors`, `highlight-color`). `save-panel` is `not seen in the screenshots`; the other 14 are present in light and dark.
- App blueprints: **15** (`finder-dialogs`, `finder-get-info`, `open-dialog`, `print-dialog`, `force-quit`, `storage-management`, `boot-camp-assistant`, `about-this-mac`, `calendar-preferences`, `mail-preferences`, `music-preferences`, `podcasts-preferences`, `safari-preferences`, `tv-preferences`, `accent-theme-desktop`).
- Audit, colours: **872** cited single-pixel values re-sampled by script (168 inline `file @ x,y` + hex citations in the 15 files; all 592 cells of the light and dark accent matrices, that is 8 accents x 74 rows; 48 Morning/Day/Evening cells; 32 picker-swatch cells; 32 highlight-preset cells). **872 reproduce within +/-2 per channel; 0 colour values needed correction.**
- Audit, geometry and text: about **180** further [M] values re-measured with `row`/`col`/`grid`/`info`, alpha runs and darkest/lightest-pixel scans (alert 20, dialog 32, sheet 11, print-panel 22, preferences-toolbar 11, notification-alert 20, open-panel 26, inspector-panel 20, accent geometry 12, preferences-window 5, highlight-color 3). **14 edits made in 6 files**: 6 geometry values changed, 6 coordinate citations fixed, 1 inferred value replaced by a measurement, 1 garbled sentence repaired (list under "Open issues", item 1).
- `build.py verify` on the dialogs files: 14 single-pixel lines checked, 14 reproduce, 0 mismatched, 0 missing files.

## New components
None. Every id used in `coverage/dialogs.json` and every component id referenced in the 15 component files and 15 blueprints is already in `seed.json` (script check: 0 ids outside the seed). All 15 ids owned by this group are seed ids with owner `dialogs`.

## Token candidates
Colours are **stored** pixel values (not sRGB); flat fills dither by +/-1. Dimensions are pt. In the Evidence column file names drop the `10-15-Catalina-` prefix and `.png` (so `Light-Print @ 700,1042` is `10-15-Catalina-Light-Print.png @ 700,1042`); the light citation comes first, then the dark one. Rows marked (new) were measured for this handoff and are not in a component file.

### Windows, title bars, window controls
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| window.background | `#ececec` | `#303031` | [M] | Light-Finder-Empty-Trash @ 530,200; Dark-Finder-Empty-Trash @ 530,200 |
| window.background.dark.tinted (General pane, seven colour accents) | - | `#303032` | [M] | Theme-Dark-Blue @ 2200,500 |
| window.background.dark.untinted (graphite accent) | - | `#323232` | [M] | Theme-Dark-Graphite @ 2200,500 |
| window.background.dark.tinted.sample.mail-preferences | - | `#303132` | [M] | Dark-Mail-Preferences @ 1100,260 |
| window.background.dark.tinted.sample.finder-copy | - | `#2f3235 (sRGB #2e3235)` | [M] | Dark-Finder-Copy @ 500,200 |
| window.background.dark.tinted.sample.get-info | - | `#323437` | [M] | Dark-Finder-Get-Info @ 400,130 |
| titlebar.fill.dark.tinted | - | `#424344` | [M] | Theme-Dark-Blue @ 1700,330 |
| titlebar.fill.dark.untinted | - | `#434343` | [M] | Theme-Dark-Graphite @ 1700,330 |
| titlebar.height | 22 pt | 22 pt | [M] | Light-Finder-Empty-Trash @ 530,76,1,44 |
| titlebar.height.with-tab-control | 38 pt | 38 pt | [M] | Light-About-This-Mac @ 1300,386,1,76 |
| titlebar.top-highlight | `#f5f5f5` | `#878787` | [M] | Light-Finder-Empty-Trash @ 530,76; Dark-Finder-Empty-Trash @ 530,76 |
| titlebar.gradient.start | `#e5e5e5` | `#424243` | [M] | Light-Finder-Empty-Trash @ 530,78; Dark-Finder-Empty-Trash @ 530,78 |
| titlebar.gradient.mid | `#d8d8d8` | `#3c3c3d` | [M] | Light-Finder-Empty-Trash @ 530,100; Dark-Finder-Empty-Trash @ 530,100 |
| titlebar.gradient.end | `#cdcdcd` | `#363637` | [M] | Light-Finder-Empty-Trash @ 530,117; Dark-Finder-Empty-Trash @ 530,117 |
| titlebar.line.1 | `#bebebe` | `#2b2c2c` | [M] | Light-Finder-Empty-Trash @ 530,118; Dark-Finder-Empty-Trash @ 530,118 |
| titlebar.line.2 | `#a8a8a8` | `#000000` | [M] | Light-Finder-Empty-Trash @ 530,119; Dark-Finder-Empty-Trash @ 530,119 |
| titlebar.title.font | 13 pt Regular, centred, baseline 15.5 pt below the window top | same | [C] | Light-Finder-Go-To-Folder @ 467,89,17,19 |
| titlebar.title.color | `#474747` | `#bbbcbc` | [M] | Light-Finder-Go-To-Folder @ 467,89,17,19; Dark-Finder-Go-to-Folder @ 467,89,17,19 |
| window.rim.dark | - | 1 pt `#59595a` inside a 0.5 pt black line at alpha 0.965 | [M] | Dark-Finder-Empty-Trash @ 112,230,2,1 |
| window-controls.size / pitch | 12 pt / 20 pt | same | [M] | Light-Finder-Copy @ 128,86,104,24 |
| window-controls.inset.22pt-bar | 8 pt from the left, 5 pt from the top | same | [M] | Light-Finder-Copy @ 128,86,104,24 |
| window-controls.inset.38pt-bar | 13 pt from the left, vertically centred | same | [M] | Light-About-This-Mac @ 1120,412,104,24 |
| trafficlight.close.fill | `#ee6a5e (sRGB #ff5f57)` | `#ed6659 (sRGB #ff5b51)` | [M] | Theme-Light-Blue @ 1016,361; Theme-Dark-Blue @ 1016,361 |
| trafficlight.close.edge | `#d25347 (sRGB #e3483f)` | `#df6257 (sRGB #f05850)` | [M] | Theme-Light-Blue @ 1016,350; Theme-Dark-Blue @ 1016,350 |
| trafficlight.minimize.fill | `#f5be4f (sRGB #febd2e)` | `#e0c04c (sRGB #e5c029)` | [M] | Theme-Light-Blue @ 1056,361; Theme-Dark-Blue @ 1056,361 |
| trafficlight.minimize.edge | `#d8a243 (sRGB #e1a126)` | `#d4b64a (sRGB #d9b62c)` | [M] | Theme-Light-Blue @ 1056,350; Theme-Dark-Blue @ 1056,350 |
| trafficlight.zoom.fill (new) | `#64c957 (sRGB #29cd43)` | `#72be47 (sRGB #53c22c)` | [M] | Light-Finder-Get-Info @ 212,98; Dark-Finder-Get-Info @ 212,98 |
| trafficlight.zoom.edge (new) | `#55a742 (sRGB #29ab2e)` | `#6db446 (sRGB #51b82e)` | [M] | Light-Finder-Get-Info @ 208,98; Dark-Finder-Get-Info @ 208,98 |
| trafficlight.disabled.fill | `#cfcfcf` | `#636465` | [M] | Theme-Light-Blue @ 1096,361; Theme-Dark-Blue @ 1096,361 |
| trafficlight.graphite.fill (close and minimize) | `#8d8d92` | `#a3a3a3` | [M] | Theme-Light-Graphite @ 1016,361; Theme-Dark-Graphite @ 1016,361 |
| trafficlight.graphite.edge | `#727376` | `#9d9d9c` | [M] | Theme-Light-Graphite @ 1016,350; Theme-Dark-Graphite @ 1016,350 |
| trafficlight.graphite.disabled.fill | `#cfcecf` | `#666666` | [M] | Theme-Light-Graphite @ 1096,361; Theme-Dark-Graphite @ 1096,361 |

### Dialog and alert layout, push buttons
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| dialog.margin (window edge to control edge, all four sides) | 20.5 pt | same | [M] | Light-Finder-Go-To-Folder @ 112,227,42,1 |
| dialog.top-margin (title bar to first label cap top) | 23.5 pt | same | [M] | Light-Finder-Go-To-Folder @ 153,120,1,48 |
| dialog.label-baseline-to-field | 11 pt | same | [M] | Light-Finder-Go-To-Folder @ 153,185,1,23 |
| dialog.field-to-button-row | 20 pt | same | [M] | Light-Finder-Go-To-Folder @ 600,246,1,42 |
| dialog.button.height | 20 pt + 1 pt shadow | 20 pt | [M] | Light-Finder-Go-To-Folder @ 571,287,166,41 |
| dialog.button.gap | 13 pt | same | [M] | Light-Finder-Go-To-Folder @ 737,306,26,1 |
| dialog.button.min-width.finder | 83 pt | same | [M] | Light-Finder-Go-To-Folder @ 571,287,166,41 |
| dialog.button.min-width.preferences-and-print | 69 pt | same | [M] | Light-Music-Preferences @ 835,579,138,40 |
| dialog.button-row.separator | 1 pt `#d5d5d5` | 1 pt `#444445` | [M] | Light-Music-Preferences @ 600,540; Dark-Music-Preferences @ 600,540 |
| dialog.label.font | 13 pt Regular `#242424` | `#dfdfdf` | [M], [C] | Light-Finder-Go-To-Folder @ 153,167,17,19; Dark-Finder-Go-to-Folder @ 153,167,17,19 |
| dialog.small-label.font | 11 pt Regular `#242424` | `#dfdfdf` | [M], [C] | Light-Finder-Connect-to-Server @ 153,227,173,18 |
| alert.width | 420 pt | same | [M] | Light-Finder-Empty-Trash @ 112,76,840,302 |
| alert.icon.size | 64 pt canvas | same | [C] | Light-Finder-Empty-Trash @ 178,155,92,121 |
| alert.icon.left / top | 24 pt / 15.5 pt below the title bar | same | [C] | Light-Finder-Empty-Trash @ 178,155,92,121 |
| alert.text.left | 106 pt | same | [M] | Light-Finder-Empty-Trash @ 324,158,567,53 |
| alert.text.right-limit | 20 pt | same | [C] | Light-Finder-Empty-Trash @ 324,158,567,53 |
| alert.message.font | 13 pt Bold `#242424` | `#dfdfdf` | [M], [C] | Light-Finder-Empty-Trash @ 325,159,17,19; Dark-Finder-Empty-Trash @ 325,159,17,19 |
| alert.message.first-baseline | 29 pt below the title bar | same | [M] | Light-Finder-Empty-Trash @ 325,159,17,19 |
| alert.message.line-pitch | 16 pt | same | [M] | Light-Finder-Empty-Trash @ 324,158,567,53 |
| alert.informative.font | 11 pt Regular `#242424` | `#dfdfdf` | [M], [C] | Light-Finder-Empty-Trash @ 325,238,24,16; Dark-Finder-Empty-Trash @ 325,238,24,16 |
| alert.message-to-informative (baseline to baseline) | 22 pt | same | [M] | Light-Finder-Empty-Trash @ 325,209,1,45 |
| alert.informative.line-pitch | 14 pt | same | [I] | single line shown |
| alert.informative-to-buttons (baseline to button top) | 24 pt | same | [M] | Light-Finder-Empty-Trash @ 560,253,1,49 |
| alert.button.gap | 15 pt | same | [M] | Light-Finder-Empty-Trash @ 655,320,30,1 |
| alert.margin.right | 20.5 pt | same | [M] | Light-Finder-Empty-Trash @ 910,320,42,1 |
| alert.margin.bottom | 18.5 pt | same | [M] | Light-Finder-Empty-Trash @ 560,340,1,38 |
| button.padding-x (title to edge, width = title + 2 x) | 19.5 pt | same | [M] | Light-Finder-Empty-Trash @ 685,320,226,1 |
| button.title.baseline | 14 pt below the top edge | same | [M] | Light-Finder-Empty-Trash @ 531,311,16,19 |
| button.title.color | `#262626` | `#e8e8e8` | [M] | Light-Finder-Empty-Trash @ 532,320; Dark-Finder-Empty-Trash @ 532,320 |
| button.fill | `#ffffff` | `#646465` | [M] | Light-Finder-Empty-Trash @ 500,320; Dark-Finder-Empty-Trash @ 500,320 |
| button.edge.top | `#c8c8c8` | `#2c2c2d` | [M] | Light-Finder-Empty-Trash @ 560,301; Dark-Finder-Empty-Trash @ 560,301 |
| button.edge.side | `#c1c1c1` | `#2a2a2b` | [M] | Light-Finder-Empty-Trash @ 489,320; Dark-Finder-Empty-Trash @ 489,320 |
| button.edge.bottom | `#aeaeae` | `#262627` | [M] | Light-Finder-Empty-Trash @ 560,340; Dark-Finder-Empty-Trash @ 560,340 |
| button.top-highlight.dark | - | `#838383` | [M] | Dark-Finder-Empty-Trash @ 560,302 |
| button.shadow.row-1 | `#d0d0d0` | - | [M] | Light-Finder-Empty-Trash @ 560,341 |
| button.shadow.row-2 | `#e3e3e3` | - | [M] | Light-Finder-Empty-Trash @ 560,342 |
| button.disabled.fill (default button with nothing chosen) | `#f3f3f3` -> `#ececec` | `#494949` | [M] | Light-Finder-Open-iCloud @ 1560,912; Dark-Finder-Open-iCloud @ 1800,1264 |
| button.disabled.title | `#b4b4b4` | `#777777` | [M] | Light-Finder-Open-iCloud @ 1581,930; Dark-Finder-Open-iCloud @ 1811,1264 |

### Default button (blue accent) and focus ring
The default button uses the pop-up cap gradient of the same accent; for the other seven accents take the `accent.<name>.cap.*` rows below.

| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| default-button.edge.top | `#5b93f3 (sRGB #4c92fa)` | `#29292a` (neutral outer edge) | [M] | Light-Finder-Empty-Trash @ 800,301; Dark-Finder-Empty-Trash @ 800,301 |
| default-button.top-highlight.dark | - | `#6998e8 (sRGB #5d97ef)` | [M] | Dark-Finder-Empty-Trash @ 800,302 |
| default-button.gradient.0 | `#77a6f4 (sRGB #6ca6fb)` | `#3874df (sRGB #2472e7)` | [M] | Light-Finder-Empty-Trash @ 800,302; Dark-Finder-Empty-Trash @ 800,303 |
| default-button.gradient.50 | `#4e8af5 (sRGB #3d88fd)` | `#2c66d3 (sRGB #1764db)` | [M] | Light-Finder-Empty-Trash @ 800,320; Dark-Finder-Empty-Trash @ 800,320 |
| default-button.gradient.100 | `#286ef6 (sRGB #076bff)` | `#2960c6 (sRGB #155ecd)` | [M] | Light-Finder-Empty-Trash @ 800,339; Dark-Finder-Empty-Trash @ 800,339 |
| default-button.edge.bottom | `#2165f6 (sRGB #0361ff)` | `#232324` (neutral) | [M] | Light-Finder-Empty-Trash @ 800,340; Dark-Finder-Empty-Trash @ 800,340 |
| default-button.edge.side | `#3d7df5 (sRGB #297bfe)` | `#272728` (neutral) | [M] | Light-Finder-Empty-Trash @ 685,320; Dark-Finder-Empty-Trash @ 685,320 |
| default-button.title.color | `#ffffff` | `#e0e8f8 (sRGB #dee8fa)` | [M] | Light-Finder-Empty-Trash @ 725,320; Dark-Finder-Empty-Trash @ 725,320 |
| default-button.css.light | `linear-gradient(#77a6f4 (sRGB #6ca6fb) 0%, #669bf5 (sRGB #589afc) 25%, #4e8af5 (sRGB #3d88fd) 50%, #3579f6 (sRGB #1c77ff) 75%, #286ef6 (sRGB #076bff) 100%)` | - | [C] | stops from Theme-Light-Blue column x 1750 |
| default-button.css.dark | - | `linear-gradient(#2e6bde (sRGB #1869e6), #2960c6 (sRGB #155ecd))` + `inset 0 0.5px 0 rgba(255,255,255,0.3)` | [C] | Theme-Dark-Blue column x 1750, y 662..699 |
| focus-ring.color (2.5 pt flat band) | `#89abeb (sRGB #82abf1)` | `#3e6c94 (sRGB #2f6c98)` | [M] | Light-Finder-Go-To-Folder @ 149,227; Dark-Finder-Go-to-Folder @ 149,227 |
| focus-ring.outermost-px | `#8badec (sRGB #84adf2)` | `#3e6b92 (sRGB #2f6b96)` | [M] | Light-Finder-Go-To-Folder @ 148,227; Dark-Finder-Go-to-Folder @ 148,227 |
| focus-ring.field-border-under-ring | `#6b8dcd (sRGB #638cd2)` | `#47759e (sRGB #3975a2)` | [M] | Light-Finder-Go-To-Folder @ 153,227; Dark-Finder-Go-to-Folder @ 154,227 |
| focus-ring.width | 3 pt incl. the 0.5 pt border, 1 pt outer rounding | 3 pt | [M] | Light-Finder-Go-To-Folder @ 148,227,6,1 |
| focus-ring.recipe (over other backgrounds) | `rgba(47,124,247,0.5)` | same | [C] | from `#89abeb (sRGB #82abf1)` over `#ececec` |
| focus-ring.other-accents | swatch colour at 0.5 alpha | same | [I] | only blue is shown |

### Sheet
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| sheet.attachment | first sheet row directly follows the toolbar's two bottom lines; no gap, no top shadow | same | [M] | Light-Print @ 460,202,1,3 |
| sheet.corner-radius | 0 (all four corners) | 0 | [M] | Light-Print @ 141,1030,14,14 |
| sheet.width | independent of the parent, centred on it (756 pt on a 460 pt window) | same | [M] | Light-Print @ 141,600,1512,1 |
| sheet.margin (content to edge, right and bottom) | 20.5 pt | same | [M] | Light-Print @ 1611,980,42,1 |
| sheet.edge.bottom | 0.5 pt `#afafae` | - | [M] | Light-Print @ 700,1042 |
| sheet.edge.dark (new) | - | 1 pt rim `#56585b` then a 0.5 pt near-black line `#040505` | [M] | Dark-Print @ 1300,1010; Dark-Print @ 1300,1012 |
| sheet.material.over-white | `#edeeee` | - | [M] | Light-Print @ 1100,220 |
| sheet.material.over-blue-sky | `#c4d5e6 (sRGB #c0d5e8)` | - | [M] | Light-Print @ 300,220 |
| sheet.material.over-tan-rock | `#dfd5c0 (sRGB #e1d5be)`..`#e4dac6 (sRGB #e6dac4)` | - | [M] | Light-Print @ 1560,204,1,102 |
| sheet.material.over-dark-document | - | `#2d2d30` +/-3 (dithered) | [M] | Dark-Print @ 1090,600,475,1 |
| sheet.material.fallback | `#ececec` | `#323232` | [I] | window background of the appearance |
| sheet.material.recipe | `blur(30px) saturate(1.2)` + `rgba(236,236,236,0.72)` | `blur(30px)` + `rgba(40,40,40,0.75)` | [C]/[I] | fitted to the three light composites |
| sheet.shadow.sample.0.5pt | `#cfcfcf` over white = black 0.19 | - | [M] | Light-Print @ 700,1043 |
| sheet.shadow.sample.4pt | `#dfdfdf` = black 0.125 | - | [M] | Light-Print @ 700,1050 |
| sheet.shadow.sample.9pt | `#efeeee` = black 0.065 | - | [M] | Light-Print @ 700,1060 |
| sheet.shadow.sample.14pt | `#f7f7f7` = black 0.03; 0 from 18 pt | - | [M] | Light-Print @ 700,1070 |
| sheet.shadow.css | `0 5px 18px rgba(0,0,0,0.3)`, clipped above the attachment line | same | [C] | fit to the four samples |
| sheet.parent-dimming | none; parent close button disabled, minimize and zoom stay coloured | same | [M] | Light-Print @ 452,116,110,30 |
| sheet.animation | slides down from the toolbar edge, 0.2-0.25 s ease-out | same | [D/I] | not captured |

### Preferences toolbar and preferences window
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| prefs-toolbar.height (title bar 22 + toolbar 56, incl. 1 pt bottom lines) | 78 pt | same | [M] | Light-Mail-Preferences @ 400,76,1,156 |
| prefs-toolbar.selection.top | 22 pt below the window top | same | [M] | Light-Mail-Preferences @ 130,120,1,110 |
| prefs-toolbar.selection.height | 55 pt (ends on the first bottom line) | same | [M] | Light-Mail-Preferences @ 130,120,1,110 |
| prefs-toolbar.selection.padding-x | 4.75 pt each side of the label | same | [M] | Light-Mail-Preferences @ 120,160,98,1 |
| prefs-toolbar.selection.radius | 4 pt top corners (fit; 3.5 as a grid reading), 0 bottom | same | [C] top radius; [M] square bottom corners | Light-Mail-Preferences @ 119,119,9,8 |
| prefs-toolbar.first-item.inset | 4 pt | same | [M] | Light-Mail-Preferences @ 112,160,9,1 |
| prefs-toolbar.item.gap (label to label) | 9.5 pt | same | [M] | Light-Mail-Preferences @ 207,208,20,1 |
| prefs-toolbar.icon.size / top | 32 pt / 25 pt below the window top | same | [C] | Light-Safari-v13-Preferences @ 1079,127,62,62 |
| prefs-toolbar.label.font | 11 pt Regular, centred, one line | same | [C] | Light-Mail-Preferences @ 129,200,79,17 |
| prefs-toolbar.label.cap-top / baseline | 62 / 69.5 pt below the window top | same | [M] | Light-Mail-Preferences @ 129,200,14,16 |
| prefs-toolbar.label.baseline-to-bottom-line | 7 pt | same | [M] | Light-Mail-Preferences @ 129,215,1,15 |
| prefs-toolbar.selection.fill.top | `#c8c8c7` | `#525355` | [M] | Light-Mail-Preferences @ 130,125; Dark-Mail-Preferences @ 130,125 |
| prefs-toolbar.selection.fill.bottom | `#bababa` | `#4a4b4c` | [M] | Light-Mail-Preferences @ 130,225; Dark-Mail-Preferences @ 130,225 |
| prefs-toolbar.selection.overlay | `rgba(0,0,0,0.10)` | `rgba(255,255,255,0.10)` | [C] | ratio of the two fills to the toolbar background |
| prefs-toolbar.background.top | `#dedede` | `#3f4042` | [M] | Light-Mail-Preferences @ 250,125; Dark-Mail-Preferences @ 250,125 |
| prefs-toolbar.background.bottom | `#cdcdcd` | `#373738` | [M] | Light-Mail-Preferences @ 250,225; Dark-Mail-Preferences @ 250,225 |
| prefs-toolbar.label.color.selected | `#2b2c2c` | `#cacacb` | [M] | Light-Mail-Preferences @ 124,196,91,27; Dark-Mail-Preferences @ 124,196,91,27 |
| prefs-toolbar.label.color.unselected | `#414141` | `#b6b6b7` | [M] | Light-Mail-Preferences @ 226,196,97,27; Dark-Mail-Preferences @ 232,196,89,27 |
| prefs-toolbar.line.1 | `#bdbdbd` | `#2b2b2d` | [M] | Light-Mail-Preferences @ 400,230; Dark-Mail-Preferences @ 400,230 |
| prefs-toolbar.line.2 | `#a7a7a7` | `#000000` | [M] | Light-Mail-Preferences @ 400,231; Dark-Mail-Preferences @ 400,231 |
| prefs.content.top-margin | 20.5 pt (Safari 18.5, Podcasts 25.5) | same | [M] | Light-Calendar-Preferences @ 800,232,1,42 |
| prefs.form.row-pitch | 30 pt (Mail 31) | same | [M] | Light-Calendar-Preferences @ 800,273,1,61 |
| prefs.label-to-control | 9.5 pt | same | [M] | Light-Calendar-Preferences @ 594,293,21,1 |
| prefs.separator | 1 pt `#d5d5d5` | 1 pt `#444446` | [M] | Light-Calendar-Preferences @ 600,534; Dark-Calendar-Preferences @ 600,534 |
| prefs.separator.space | 20.5 pt above, 21 pt below | same | [M] | Light-Calendar-Preferences @ 184,534,930,2 |
| prefs.checkbox.row-pitch | 20 pt | same | [M] | Light-Calendar-Preferences @ 184,936,336,29 |
| prefs.help-button | 20 pt circle, 20.5 pt from the right, 19.5-20 pt from the bottom | same | [M] | Light-Calendar-Preferences @ 1105,1079,40,41 |
| prefs.small-text | 11 pt Regular `#242424`, 14 pt line pitch | - | [M] | Light-Safari-v13-Preferences @ 813,981,396,74 |
| popup.height | 20 pt + 1 pt shadow | 20 pt | [M] | Light-Calendar-Preferences @ 800,273,1,41 |

### Notification (alert style)
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| notification.size (two body lines) | 344 x 63 pt | same | [M] | Light-Finder-Eject-Warning @ 38,36,688,126 |
| notification.radius | 6 pt | 6 pt | [M] | Light-Finder-Eject-Warning @ 36,34,14,14 |
| notification.button-column.width | 70 pt | same | [M] | Light-Finder-Eject-Warning @ 586,100,140,1 |
| notification.divider | 1 pt `#d6d6d6` | 1 pt `#5b5b5b` | [M] | Light-Finder-Eject-Warning @ 584,100; Dark-Finder-Eject-Warning @ 584,100 |
| notification.background (captured opaque) | `#ededed` | `#383838` | [M] | Light-Finder-Eject-Warning @ 300,50; Dark-Finder-Eject-Warning @ 300,50 |
| notification.rim.dark | - | 1 pt `#575757` inside a 0.5 pt black line at alpha 0.78 | [M] | Dark-Finder-Eject-Warning @ 38,100 |
| notification.icon | 32 pt canvas, 10 pt from the left, vertically centred | same | [M], [C] | Light-Finder-Eject-Warning @ 63,73,54,51 |
| notification.text.left | 52 pt | same | [M] | Light-Finder-Eject-Warning @ 142,57,15,17 |
| notification.title.font | 13 pt Bold `#3a3a3a`, baseline 18.5 pt below the top | `#ffffff` | [M], [C] | Light-Finder-Eject-Warning @ 142,57,15,17; Dark-Finder-Eject-Warning @ 142,56,15,18 |
| notification.body.font | 12 pt Regular `#3a3a3a`, baselines 35.5 and 49.5 pt (14 pt pitch) | `#ffffff` | [M], [C] | Light-Finder-Eject-Warning @ 142,91,15,17 |
| notification.padding.bottom (under the last baseline) | 13 pt | same | [M] | Light-Finder-Eject-Warning @ 142,135,1,27 |
| notification.button.font | 13 pt Regular `#6e6e6e`, centred in the column | `#b4b4b4` | [M], [C] | Light-Finder-Eject-Warning @ 624,90,15,18; Dark-Finder-Eject-Warning @ 624,90,15,18 |
| notification.shadow.alpha (below the edge) | 0.255 at 0.5 pt, 0.169 at 1 pt, 0.129 at 1.5 pt, 0.106 at 2.5 pt, 0.075 at 4.5 pt, 0.043 at 7 pt, 0.02 at 10 pt, 0 at 16.5 pt | - | [M] | Light-Finder-Eject-Warning @ 300,162,1,34 (alpha channel) |
| notification.shadow.alpha.sides / top (first px) | 0.243 / 0.224 | - | [M] | Light-Finder-Eject-Warning @ 37,100,1,1 and @ 300,35,1,1 (alpha channel) |
| notification.shadow.css | `0 0 0 0.5px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.14)` | same | [C] | fit to the falloff |
| notification.material.recipe | `blur(30px) saturate(1.8)` + `rgba(246,246,246,0.72)` | `blur(30px)` + `rgba(40,40,40,0.72)` | [I] | isolated capture has no backdrop |
| notification.screen-inset | 8 pt below the menu bar, 8 pt from the right edge, 8 pt between stacked notifications | same | [D/I] | not visible in the capture |

### Inspector (Info window)
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| inspector.width | 265 pt | same | [M] | Light-Finder-Get-Info @ 112,76,530,1688 |
| inspector.header.icon | 32 pt canvas, 15.5 pt from the left, 11 pt below the title bar | same | [M] | Light-Finder-Get-Info @ 143,142,46,62 |
| inspector.header.name.font | 13 pt Bold `#000000`, baseline 43.5 pt below the title bar | `#ffffff` | [M], [C] | Light-Finder-Get-Info @ 211,145,17,19; Dark-Finder-Get-Info @ 211,145,17,19 |
| inspector.secondary.font | 11 pt Regular `#767676` | `#a3a3a5` | [M], [C] | Light-Finder-Get-Info @ 213,182,16,16; Dark-Finder-Get-Info @ 213,182,16,16 |
| inspector.section.title.font | 11 pt Bold `#000000`, ends with a colon | `#ffffff` | [M], [C] | Light-Finder-Get-Info @ 157,310,14,16; Dark-Finder-Get-Info @ 157,310,14,16 |
| inspector.row.font | 11 pt Regular `#000000` | `#ffffff` | [M], [C] | Light-Finder-Get-Info @ 258,352,11,16; Dark-Finder-Get-Info @ 258,352,11,16 |
| inspector.separator | 1 pt `#d5d5d5`, full width | 1 pt `#46484b` | [M] | Light-Finder-Get-Info @ 300,296; Dark-Finder-Get-Info @ 300,296 |
| inspector.section.header-height (separator to first row cap top) | 27 pt | same | [M] | Light-Finder-Get-Info @ 157,298,1,55 |
| inspector.section.collapsed-height | 19 pt | same | [M] | Light-Finder-Get-Info @ 130,1088,1,38 |
| inspector.section.title.x | 22.5 pt | same | [M] | Light-Finder-Get-Info @ 157,310,84,16 |
| disclosure-triangle.size | 9 x 7 pt expanded, 7 x 9 pt collapsed, 9 pt from the window edge | same | [M] | Light-Finder-Get-Info @ 130,310,18,14 |
| disclosure-triangle.color | `#8c8c8c` | `#7c7c7c` | [M] | Light-Finder-Get-Info @ 138,315; Dark-Finder-Get-Info @ 138,315 |
| inspector.row.pitch | 14 pt | same | [M] | Light-Finder-Get-Info @ 258,352,1,169 |
| inspector.label-gutter (label end to value start) | 6 pt | same | [M] | Light-Finder-Get-Info @ 245,351,13,18 |
| inspector.checkbox.small | 12 pt box, 18 pt row pitch | same | [M] | Light-Finder-Get-Info @ 222,570,24,24 |
| inspector.tags-field.height | 33 pt, 4 pt side insets | same | [M] | Light-Finder-Get-Info @ 120,222,514,66 |
| inspector.tags-field.fill | `#ffffff` | `#202225` | [M] | Light-Finder-Get-Info @ 300,250; Dark-Finder-Get-Info @ 300,250 |
| inspector.tags-field.border | 1 pt `#c5c5c5` | 1 pt `#565656` | [M] | Light-Finder-Get-Info @ 300,222; Dark-Finder-Get-Info @ 300,222 |
| text-field.border (name field) | `#b1b1b1` | - | [M] | Light-Finder-Get-Info @ 300,987 |
| popup.small.height | 17.5 pt | same | [M] | Light-Finder-Get-Info @ 143,1177,468,35 |
| text.disabled | `#b8b8b8` | - | [M] | Light-Finder-Get-Info @ 143,1299,162,28 |

### Open panel
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| open-panel.toolbar.height | 42 pt + 1 pt line | same | [M] | Light-Finder-Open @ 600,76,1,86 |
| open-panel.toolbar.fill.mid | `#dfdfdf` | `#3b3c3e` | [M] | Light-Finder-Open @ 600,100; Dark-Finder-Open @ 600,100 |
| open-panel.toolbar.line | `#d8d8d8` | `#404143` | [M] | Light-Finder-Open @ 600,160; Dark-Finder-Open @ 600,160 |
| open-panel.toolbar.control-height / margin | 23 pt / 11 pt | same | [M] | Light-Finder-Open @ 134,95,102,46 |
| open-panel.sidebar.width | 155 pt + 1 pt divider | same | [M] | Light-Finder-Open @ 112,500,312,1 |
| open-panel.sidebar.fill (vibrant composite) | `#e8e8e7` | `#2c2d2e` | [M] | Light-Finder-Open @ 200,300; Dark-Finder-Open @ 200,300 |
| open-panel.sidebar.divider | `#d0d0cf` | `#000000` | [M] | Light-Finder-Open @ 422,500; Dark-Finder-Open @ 422,500 |
| open-panel.sidebar.row (pitch / selection height) | 26 pt / 24 pt | same | [M] | Light-Finder-Open @ 200,366,1,48 |
| open-panel.sidebar.header.font | 11 pt Semibold `#696968` | - | [M], [C] | Light-Finder-Open @ 132,182,120,16 |
| open-panel.sidebar.item.font | 13 pt Regular `#353534` | `#ffffff` | [M], [C] | Light-Finder-Open @ 194,225,90,19 |
| open-panel.header-band.height | 23 pt + 1 pt line | same | [M] | Light-Finder-Open @ 600,162,1,48 |
| open-panel.header-band.fill | `#f0f0f0` | `#2b2c2f` | [M] | Light-Finder-Open @ 600,180; Dark-Finder-Open @ 600,180 |
| open-panel.header-band.line.1 | `#e1e1e1` | `#3a3b3e` | [M] | Light-Finder-Open @ 600,208; Dark-Finder-Open @ 600,208 |
| open-panel.header-band.line.2 | `#cecece` | `#4d4e51` | [M] | Light-Finder-Open @ 600,209; Dark-Finder-Open @ 600,209 |
| open-panel.browser.fill | `#ffffff` | `#1e1f21` | [M] | Light-Finder-Open @ 600,500; Dark-Finder-Open @ 600,500 |
| open-panel.column.width | 204 pt + 1 pt divider | same | [M] | Light-Finder-Open @ 424,500,410,1 |
| open-panel.column.divider | `#e6e6e6` | `#000000` | [M] | Light-Finder-Open @ 832,500; Dark-Finder-Open @ 832,500 |
| open-panel.column.row (pitch / selection height) | 18 pt / 17 pt | same | [M] | Light-Finder-Open @ 600,212,1,34 |
| open-panel.file-name.font | 12 pt Regular `#272727`, selected `#ffffff` | selected `#ffffff` | [M], [C] | Light-Finder-Open @ 478,254,60,18 |
| open-panel.bottom-bar.height | 41 pt under a 1 pt line | same | [M] | Light-Finder-Open @ 600,1222,1,84 |
| open-panel.bottom-bar.line | `#bfbfbf` | `#3f3f3f` | [M] | Light-Finder-Open @ 600,1222; Dark-Finder-Open @ 600,1222 |
| open-panel.bottom-bar.fill.mid | `#e2e2e2` | `#2f2f2f` | [M] | Light-Finder-Open @ 600,1260; Dark-Finder-Open @ 600,1260 |
| open-panel.bottom-bar.margin / button gap | 10.5 pt / 9 pt | same | [M] | Light-Finder-Open @ 1593,1245,326,40 |
| open-panel.toolbar.glyph.color | `#555555`, disabled `#ababab` | - | [M] | Light-Finder-Open @ 152,106,14,24 and @ 204,106,14,24 |
| open-panel.preview.name.font | 17 pt Bold `#262626` | - | [M], [C] | Light-Finder-Open @ 876,826,160,21 |
| open-panel.preview.secondary.color | `#808080` | - | [M] | Light-Finder-Open @ 876,869,370,18 |
| link.color | `#276ad3 (sRGB #0168da)` | - | [M] | Light-Finder-Open @ 1770,930,125,18 |
| placeholder.color | `#c0c0c0` | - | [M] | Light-Finder-Open @ 880,1188,125,18 |

### Print panel, progress window, About window, assistant
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| print.sheet.size (detailed form) | 756 x 419 pt | same | [M] | Light-Print @ 141,204,1512,838 |
| print.preview.page | 233 x 301 pt, `#ffffff` in both appearances | `#ffffff` | [M] | Light-Print @ 500,600; Dark-Print @ 400,600 |
| print.form.row-pitch | 30 pt | same | [M] | Light-Print @ 896,255,84,79 |
| print.label-to-control | 10 pt (label end x 980, control column x 1000) | same | [M] | Light-Print @ 980,264,21,1 |
| print.popup.width (Printer, Presets / Paper Size / pane) | 238.5 / 177 / 174 pt | same | [M] | Light-Print @ 1001,264,477,1 |
| print.orientation-button | 38 x 38 pt, 12 pt apart | same | [M] | Light-Print @ 1000,582,176,76 |
| print.separator | 1 pt `#d5d5d4`..`#d8d8d8` over the sheet material | - | [M] | Light-Print @ 801,694,229,2 |
| menu.selection.blue.over-sheet (open pop-up menu item) | `#518cef (sRGB #408bf7)`..`#548ef0 (sRGB #448df8)`, 18 pt tall | - | [M] | Light-Print @ 1460,402,1,36 |
| progress-window.size | 399 x 69 pt, transparent title bar | same | [M] | Light-Finder-Copy @ 112,76,798,138 |
| progress.bar.size | 307 x 6 pt | same | [M] | Light-Finder-Copy @ 226,157,614,12 |
| progress.bar.track | `#dbdbdb` | `#4c4f52 (sRGB #4b4f52)` | [M] | Light-Finder-Copy @ 300,163; Dark-Finder-Copy @ 300,163 |
| progress.bar.track.line (top and bottom, 0.5 pt) | `#bfbfbf` | none | [M] | Light-Finder-Copy @ 300,157 |
| progress.bar.fill (blue accent) | `#4d8af5 (sRGB #3b89fd)` | `#2e6bde (sRGB #1869e6)` | [M] | Light-Finder-Copy @ 235,164; Dark-Finder-Copy @ 235,164 |
| progress.stop-button | 13 pt disc `#757575` | `#a1a2a4` | [M] | Light-Finder-Copy @ 874,155; Dark-Finder-Copy @ 874,155 |
| progress.title.font | 11 pt Regular `#242424`, middle-truncated | `#dfe0e0` | [M], [C] | Light-Finder-Copy @ 225,126,14,16; Dark-Finder-Copy @ 225,126,14,16 |
| progress.status.font | 9 pt Regular `#767676` | `#a1a3a4` | [M], [C] | Light-Finder-Copy @ 226,187,32,13; Dark-Finder-Copy @ 226,187,32,13 |
| about.window.size | 586 x 353 pt | same | [M] | Light-About-This-Mac @ 1094,386,1172,706 |
| about.tab.height | 19 pt | same | [M] | Light-About-This-Mac @ 1362,405,636,38 |
| about.tab.selected.fill.top | `#6e6e6e` | `#c9c9cb` | [M] | Light-About-This-Mac @ 1420,412; Dark-About-This-Mac @ 1420,412 |
| about.tab.selected.fill.bottom | `#686868` | `#c5c6c7` | [M] | Light-About-This-Mac @ 1420,436; Dark-About-This-Mac @ 1420,436 |
| about.tab.unselected.fill | `#f6f6f6` | `#696a6b` | [M] | Light-About-This-Mac @ 1501,424,21,1 |
| about.title.font | 26 pt SF Pro Display, "macOS" bold + "Catalina" light, `#242424` | white | [M], [C] | Light-About-This-Mac @ 1604,554,130,37 |
| about.row.font / pitch | 11 pt, bold key + regular value, 19 pt pitch | same | [M], [C] | Light-About-This-Mac @ 1603,708,422,18 |
| about.footer.font | 9 pt `#b1b1b1`, centred | grey | [M] | Light-About-This-Mac @ 1326,1061,687,19 |
| push-button.small.height | 17 pt | same | [M] | Light-About-This-Mac @ 1601,925,452,35 |
| assistant.window.size | 783 x 548 pt | same | [M] | Light-Boot-Camp-Assistant @ 112,76,1566,1096 |
| assistant.artwork-column.width | 174.5 pt | same | [M] | Light-Boot-Camp-Assistant @ 112,250,530,760 |
| assistant.text-box.fill | `#d5d5d5` | `#444546` | [M] | Light-Boot-Camp-Assistant @ 1000,600; Dark-Boot-Camp-Assistant @ 1000,600 |
| assistant.text-box.border | 1 pt `#999999` | 1 pt `#999999` | [M] | Light-Boot-Camp-Assistant @ 1000,206; Dark-Boot-Camp-Assistant @ 1000,206 |
| assistant.heading.font | 13 pt Bold `#242424` | `#dfdfe0` | [M], [C] | Light-Boot-Camp-Assistant @ 468,161,167,24; Dark-Boot-Camp-Assistant @ 468,161,167,24 |
| assistant.body.font | 13 pt Regular `#000000`, 16 pt line pitch, 7.5 pt inset | `#ffffff` | [M], [C] | Light-Boot-Camp-Assistant @ 476,228,1115,90 |
| assistant.button-row.margins | 21 pt below the box, 19.5 pt above the window bottom | same | [M] | Light-Boot-Camp-Assistant @ 1500,1051,1,121 |

### Selection (not accent-dependent, or blue accent only)
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| selection.text.blue (selected text background on real text) | `#bad7fb (sRGB #b4d7ff)` | - | [M] | Light-Safari-v13-Preferences @ 900,453 |
| selection.text.color | unchanged (`#000000`) | unchanged | [M] light, [I] dark | Light-Safari-v13-Preferences @ 787,468 |
| selection.text.height | 16 pt in a 22 pt field, 2 pt inside the field's inner edge | same | [M] | Light-Safari-v13-Preferences @ 900,452,1,32 |
| selection.row.emphasized.blue | `#2365d9 (sRGB #0062e1)` | `#1e5ac8 (sRGB #0057cf)` | [M] | Light-Force-Quit @ 400,262; Dark-Force-Quit @ 400,262 |
| selection.row.emphasized.text | `#ffffff` | `#ffffff` | [M] | Light-Force-Quit @ 212,260,40,12 |
| selection.row.unemphasized (source list) | `#c8c8c7` on `#e8e8e7` | `#505152` on `#2c2d2e` | [M] | Light-Finder-Open @ 200,389; Dark-Finder-Open @ 200,389 |
| selection.row.unemphasized.overlay | black at 0.14 | white at 0.17 | [C] | from the two fills above |
| selection.sidebar.accent.blue (Storage Management) | `#2f70dd (sRGB #146ee5)` | `#2d73e2 (sRGB #0971ea)` | [M] | Light-Storage-Management @ 300,130; Dark-Stroage-Management @ 300,130 |
| selection.row.height.table (16 pt icons) | 21 pt | same | [M] | Light-Force-Quit @ 400,242,1,42 |
| selection.row.height.column-view | 17 pt | same | [M] | Light-Finder-Open @ 600,212,1,34 |
| selection.row.height.sidebar | 24 pt (Storage Management 28 pt) | same | [M] | Light-Finder-Open @ 200,366,1,48 |
| selection.row.emphasized.other-accents | the accent swatch moved by the offset measured between the blue swatch and the blue row | same | [I] | only blue is shown; the earlier cap-75%-darkened recipe is withdrawn (lead correction) |

### Accent picker and tinted-control geometry
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| accent-swatch.diameter / pitch | 16 pt / 24 pt | same | [M] | Theme-Light-Blue @ 1480,602,32,32 |
| accent-swatch.ring.width | 1 pt | same | [M] | Theme-Light-Blue @ 1480,617,2,1 |
| accent-swatch.selected-dot | 5 pt, white, centred | same | [M] | Theme-Light-Blue @ 1491,617,10,1 |
| accent-swatch.ring.recipe | fill x 0.80 | fill + 20% white | [C] | picker-swatch table in `accent-colors` |
| appearance-thumbnail.size / radius | 67 x 44 pt / grid reading 4.5 to 5 pt, not fitted; 4.5 pt to build with (6 minus the 1.5 pt ring only if the ring's inner edge is concentric, which is assumed, not shown; 4 pt before the ring was fitted) | same | [M] size and grid reading; [I] 4.5 to build with | Theme-Light-Blue @ 1481,436,134,88 |
| appearance-thumbnail.pitch | 86 pt | same | [M] | Theme-Light-Blue @ 1481,480,345,1 |
| appearance-thumbnail.selection-ring | 1.5 pt wide, outside the image, outer radius 6 pt (fit; 5.5 as a grid reading) | same | [M]; [C] radius | Theme-Light-Blue @ 1478,433,140,94 |
| appearance-thumbnail.border.unselected | 0.5 pt `#d9d9d9` | - | [M] | Theme-Light-Blue @ 1652,480 |
| highlight-swatch.size | 24 x 12 pt incl. 0.5 pt border, 8.5 pt from the pop-up's left edge | same | [M] | Theme-Light-Blue @ 1496,670,48,24 |
| popup.cap.width | 16 pt + 0.5 pt right edge | 16 pt | [M] | Theme-Light-Blue @ 1744,680,33,1 |
| radio.diameter / dot | 16 pt / 5 pt | same | [M] | Theme-Light-Blue @ 1480,878,32,32 |
| checkbox.size | 14 pt | same | [M] | Theme-Light-Blue @ 1478,1312,28,28 |
| menu-item.highlight.height | 19 pt, full menu width, square corners | same | [M] | Theme-Light-Blue @ 95,52,1,38 |
| menubar.title-highlight | full 22 pt bar height, 4 pt (8 px) beyond the title on each side | same | [M] | Theme-Light-Blue @ 90,4,314,1 |
| control.glyph.alpha.dark | - | white at about 0.85 over the fill (graphite: near-black glyphs) | [C] | Theme-Dark-Blue @ 1759,670,1,1 |
| control.pressed | fill x black 0.12 | same | [I] | never captured |
| control.inactive-window | no accent: unselected bezel + dark glyph | same | [I] | General window is key in all 32 captures |
| menu.selection.recipe | swatch colour at about 0.85 alpha over the menu material | same | [C] | Morning/Day/Evening rows differ by a constant |
| menu.selection.graphite.dark.recipe | - | `rgba(255,255,255,0.25)` over the menu material | [I] | four samples differ: `#68748b (sRGB #66748d)`, `#65748a (sRGB #62748c)`, `#697488 (sRGB #67748a)`, `#66748a (sRGB #63748c)` |

### Per-accent values (all eight accents, light and dark)
Evidence shorthand for this table only: a bare `x,y` is that pixel in `10-15-Catalina-Theme-Light-<Accent>.png` (light column) and `10-15-Catalina-Theme-Dark-<Accent>.png` (dark column); `L x,y` / `D x,y` give different pixels for the two files; `Mo` and `Ev` are `10-15-Catalina-Theme-Morning-<Accent>.png` and `10-15-Catalina-Theme-Evening-<Accent>.png` (the Evening purple file is spelled `Purpe`). `<Accent>` is the accent named in the token. All rows were re-sampled by script when this table was generated.

Token meanings: `swatch` = the pure accent (picker dot, selected); `swatch.ring` = the dot's 1 pt border; `selection-ring` = Appearance thumbnail ring; `control.fill` = checkbox/radio "on" fill (flat in light; the 50% row of a gradient in dark); `control.top-line` = light 0.5 pt edge / dark top highlight row; `control.gradient.start/end` = dark gradient first and last fill rows; `cap.top-line` = light top edge row / dark top highlight row; `cap.0`..`cap.100` = pop-up cap and default-button gradient stops; `cap.edge-bottom`, `cap.edge-right` = light edge rows (dark edges are neutral: `#29292a` above, `#232325` below, `#272729` right; graphite `#2d2d2d`, `#282828`, `#2c2c2c`); `glyph.*` = arrows, radio dot, checkmark; `glyph.shadow` = second px under the light radio dot; `menu.selection` = highlighted menu item on the Day wallpaper (light) or the dark desktop; `menubar.selection` = open menu-bar title; `highlight` = selected-text background preset and `highlight.border` its swatch border.

| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| accent.blue.swatch | `#2f7cf7 (sRGB #027aff)` | `#2f7cf7 (sRGB #027aff)` | [M] | 1484,617 |
| accent.blue.swatch.ring | `#2664c5 (sRGB #0662cc)` | `#5997f8 (sRGB #4796ff)` | [M] | 1481,617 |
| accent.blue.selection-ring | `#2f7cf7 (sRGB #027aff)` | `#2f7cf7 (sRGB #027aff)` | [M] | L 1479,480; D 1651,480 |
| accent.blue.control.fill | `#4d89f5 (sRGB #3c87fd)` | `#2c66d3 (sRGB #1764db)` | [M] | 1480,1326 |
| accent.blue.control.top-line | `#4181f4 (sRGB #2d7ffc)` | `#6998e8 (sRGB #5d97ef)` | [M] | 1492,1312 |
| accent.blue.control.gradient.start | - | `#3874df (sRGB #2472e7)` | [M] | D 1492,1313 |
| accent.blue.control.gradient.end | - | `#2960c6 (sRGB #155ecd)` | [M] | D 1492,1339 |
| accent.blue.cap.top-line | `#5b93f3 (sRGB #4c92fa)` | `#6998e8 (sRGB #5d97ef)` | [M] | L 1750,661; D 1750,662 |
| accent.blue.cap.0 | `#77a6f4 (sRGB #6ca6fb)` | `#3874df (sRGB #2472e7)` | [M] | L 1750,662; D 1750,663 |
| accent.blue.cap.25 | `#669bf5 (sRGB #589afc)` | `#2d69da (sRGB #1767e2)` | [M] | 1750,671 |
| accent.blue.cap.50 | `#4e8af5 (sRGB #3d88fd)` | `#2c66d3 (sRGB #1764db)` | [M] | 1750,680 |
| accent.blue.cap.75 | `#3579f6 (sRGB #1c77ff)` | `#2a63cc (sRGB #1561d3)` | [M] | 1750,690 |
| accent.blue.cap.100 | `#286ef6 (sRGB #076bff)` | `#2960c6 (sRGB #155ecd)` | [M] | 1750,699 |
| accent.blue.cap.edge-bottom | `#2165f6 (sRGB #0361ff)` | - | [M] | L 1750,700 |
| accent.blue.cap.edge-right | `#3d7df5 (sRGB #297bfe)` | - | [M] | L 1776,680 |
| accent.blue.glyph.arrow | `#ffffff` | `#dee8f9 (sRGB #dce8fb)` | [M] | 1759,670 |
| accent.blue.glyph.radio-dot | `#fffffe` | `#dee7f7 (sRGB #dce7f9)` | [M] | 1496,894 |
| accent.blue.glyph.checkmark | - | `#d2dff5 (sRGB #cfdff7)` | [M] | D 1494,1328 |
| accent.blue.glyph.shadow | `#3570dc (sRGB #216ee4)` | - | [M] | L 1496,900 |
| accent.blue.menu.selection | `#3f7ee7 (sRGB #2a7cef)` | `#2c6dd5 (sRGB #0e6bdc)` | [M] | 95,70 |
| accent.blue.menubar.selection | `#407ee8 (sRGB #2c7cf0)` | `#2c6ed6 (sRGB #0c6cdd)` | [M] | 95,10 |
| accent.blue.menu.selection.morning | `#4a87ed (sRGB #3886f5)` | - | [M] | Mo 95,70 |
| accent.blue.menu.selection.evening | `#2f6ed8 (sRGB #166ce0)` | - | [M] | Ev 95,70 |
| accent.blue.highlight | `#bad7fb (sRGB #b4d7ff)` | `#476388 (sRGB #40638b)` | [M] | 1510,680 |
| accent.blue.highlight.border | `#8ba2bd (sRGB #86a2c0)` | `#738aa5 (sRGB #6e8aa8)` | [M] | 1496,680 |
| accent.purple.swatch | `#8b4592 (sRGB #963d96)` | `#9b57a3 (sRGB #a650a7)` | [M] | 1532,617 |
| accent.purple.swatch.ring | `#6f3775 (sRGB #783179)` | `#ae79b5 (sRGB #b874b9)` | [M] | 1529,617 |
| accent.purple.selection-ring | `#8b4592 (sRGB #963d96)` | `#9a56a3 (sRGB #a54fa8)` | [M] | L 1479,480; D 1651,480 |
| accent.purple.control.fill | `#b26aaf (sRGB #be63b3)` | `#904696 (sRGB #9b3d9a)` | [M] | 1480,1326 |
| accent.purple.control.top-line | `#ac5fa8 (sRGB #b858ac)` | `#b77fbb (sRGB #c17abf)` | [M] | 1492,1312 |
| accent.purple.control.gradient.start | - | `#9e53a2 (sRGB #aa4ba6)` | [M] | D 1492,1313 |
| accent.purple.control.gradient.end | - | `#89418c (sRGB #943990)` | [M] | D 1492,1339 |
| accent.purple.cap.top-line | `#b676b4 (sRGB #c171b8)` | `#b77fbb (sRGB #c17abf)` | [M] | L 1750,661; D 1750,662 |
| accent.purple.cap.0 | `#c28dc1 (sRGB #cc89c4)` | `#9d53a2 (sRGB #a94ba6)` | [M] | L 1750,662; D 1750,663 |
| accent.purple.cap.25 | `#bc7fba (sRGB #c77abe)` | `#96489b (sRGB #a23fa0)` | [M] | 1750,671 |
| accent.purple.cap.50 | `#b26aaf (sRGB #be63b3)` | `#924797 (sRGB #9d3e9b)` | [M] | 1750,680 |
| accent.purple.cap.75 | `#a854a4 (sRGB #b54ba8)` | `#8c4391 (sRGB #973b95)` | [M] | 1750,690 |
| accent.purple.cap.100 | `#a2469d (sRGB #af3ba1)` | `#88418d (sRGB #933991)` | [M] | 1750,699 |
| accent.purple.cap.edge-bottom | `#9f4198 (sRGB #ac359c)` | - | [M] | L 1750,700 |
| accent.purple.cap.edge-right | `#ab5ca6 (sRGB #b754aa)` | - | [M] | L 1776,680 |
| accent.purple.glyph.arrow | `#ffffff` | `#eee3f0 (sRGB #f0e2f1)` | [M] | 1759,670 |
| accent.purple.glyph.radio-dot | `#ffffff` | `#ede4ef (sRGB #efe3f0)` | [M] | 1496,894 |
| accent.purple.glyph.checkmark | - | `#e8d9e8 (sRGB #ebd8e9)` | [M] | D 1494,1328 |
| accent.purple.glyph.shadow | `#985095 (sRGB #a34999)` | - | [M] | L 1496,900 |
| accent.purple.menu.selection | `#935799 (sRGB #9d519d)` | `#793f80 (sRGB #823984)` | [M] | 95,70 |
| accent.purple.menubar.selection | `#935799 (sRGB #9d519d)` | `#7a3f80 (sRGB #833984)` | [M] | 95,10 |
| accent.purple.menu.selection.morning | `#9b61a1 (sRGB #a55ca5)` | - | [M] | Mo 95,70 |
| accent.purple.menu.selection.evening | `#834689 (sRGB #8d408d)` | - | [M] | Ev 95,70 |
| accent.purple.highlight | `#dbc7dd (sRGB #dfc6df)` | `#6c586e (sRGB #705770)` | [M] | 1510,680 |
| accent.purple.highlight.border | `#a596a6 (sRGB #a895a7)` | `#908292 (sRGB #938193)` | [M] | 1496,680 |
| accent.pink.swatch | `#e55e9c (sRGB #f7509e)` | `#e55e9c (sRGB #f7509e)` | [M] | 1580,617 |
| accent.pink.swatch.ring | `#b64c7c (sRGB #c4417d)` | `#ea7faf (sRGB #fa76b1)` | [M] | 1577,617 |
| accent.pink.selection-ring | `#e55d9c (sRGB #f74f9e)` | `#e55d9d (sRGB #f74e9f)` | [M] | L 1479,480; D 1651,480 |
| accent.pink.control.fill | `#db5fab (sRGB #ec52ae)` | `#c24777 (sRGB #d23978)` | [M] | 1480,1326 |
| accent.pink.control.top-line | `#d955a4 (sRGB #eb45a7)` | `#d97fa4 (sRGB #e778a5)` | [M] | 1492,1312 |
| accent.pink.control.gradient.start | - | `#cf5384 (sRGB #e04685)` | [M] | D 1492,1313 |
| accent.pink.control.gradient.end | - | `#b7426f (sRGB #c63570)` | [M] | D 1492,1339 |
| accent.pink.cap.top-line | `#db6bb1 (sRGB #eb60b4)` | `#da7ea5 (sRGB #e877a6)` | [M] | L 1750,661; D 1750,662 |
| accent.pink.cap.0 | `#df84be (sRGB #ee7dc1)` | `#cf5384 (sRGB #e04685)` | [M] | L 1750,662; D 1750,663 |
| accent.pink.cap.25 | `#de75b7 (sRGB #ee6cba)` | `#c9497b (sRGB #da3a7c)` | [M] | 1750,671 |
| accent.pink.cap.50 | `#db60ac (sRGB #ec53af)` | `#c24777 (sRGB #d23978)` | [M] | 1750,680 |
| accent.pink.cap.75 | `#d94aa0 (sRGB #eb36a3)` | `#bc4473 (sRGB #cb3674)` | [M] | 1750,690 |
| accent.pink.cap.100 | `#d83f98 (sRGB #eb259b)` | `#b6426f (sRGB #c53570)` | [M] | 1750,699 |
| accent.pink.cap.edge-bottom | `#d73b91 (sRGB #ea1e94)` | - | [M] | L 1750,700 |
| accent.pink.cap.edge-right | `#d852a2 (sRGB #ea42a5)` | - | [M] | L 1776,680 |
| accent.pink.glyph.arrow | `#ffffff` | `#f6e2ec (sRGB #fae1ed)` | [M] | 1759,670 |
| accent.pink.glyph.radio-dot | `#ffffff` | `#f4e3eb (sRGB #f8e2eb)` | [M] | 1496,894 |
| accent.pink.glyph.checkmark | - | `#f2d9e3 (sRGB #f7d8e3)` | [M] | D 1494,1328 |
| accent.pink.glyph.shadow | `#c14791 (sRGB #d13894)` | - | [M] | L 1496,900 |
| accent.pink.menu.selection | `#e16ca2 (sRGB #f262a4)` | `#c65388 (sRGB #d6478a)` | [M] | 95,70 |
| accent.pink.menubar.selection | `#e16ca2 (sRGB #f262a4)` | `#c75489 (sRGB #d7488b)` | [M] | 95,10 |
| accent.pink.menu.selection.morning | `#e676aa (sRGB #f76dac)` | - | [M] | Mo 95,70 |
| accent.pink.menu.selection.evening | `#d25c92 (sRGB #e25094)` | - | [M] | Ev 95,70 |
| accent.pink.highlight | `#f5cde1 (sRGB #fdcbe2)` | `#81596d (sRGB #88566e)` | [M] | 1510,680 |
| accent.pink.highlight.border | `#b89ba9 (sRGB #be99aa)` | `#a08391 (sRGB #a68192)` | [M] | 1496,680 |
| accent.red.swatch | `#d04746 (sRGB #e1383f)` | `#ed5f5e (sRGB #ff5258)` | [M] | 1628,617 |
| accent.red.swatch.ring | `#a63937 (sRGB #b42e32)` | `#f07f7e (sRGB #ff777a)` | [M] | 1625,617 |
| accent.red.selection-ring | `#cf4745 (sRGB #e0383e)` | `#ec5e5e (sRGB #ff5158)` | [M] | L 1479,480; D 1651,480 |
| accent.red.control.fill | `#c15649 (sRGB #d04e43)` | `#d84b3d (sRGB #ea3c32)` | [M] | 1480,1326 |
| accent.red.control.top-line | `#be4c3c (sRGB #cd4234)` | `#eb8176 (sRGB #fb7a71)` | [M] | 1492,1312 |
| accent.red.control.gradient.start | - | `#e55849 (sRGB #f74b3f)` | [M] | D 1492,1313 |
| accent.red.control.gradient.end | - | `#cc4638 (sRGB #dd382e)` | [M] | D 1492,1339 |
| accent.red.cap.top-line | `#c46457 (sRGB #d25d52)` | `#eb8077 (sRGB #fb7972)` | [M] | L 1750,661; D 1750,662 |
| accent.red.cap.0 | `#ce7f74 (sRGB #da7a70)` | `#e5574a (sRGB #f74941)` | [M] | L 1750,662; D 1750,663 |
| accent.red.cap.25 | `#c96f63 (sRGB #d6695e)` | `#e14e3f (sRGB #f33e34)` | [M] | 1750,671 |
| accent.red.cap.50 | `#c2574a (sRGB #d14f44)` | `#d94b3e (sRGB #eb3c34)` | [M] | 1750,680 |
| accent.red.cap.75 | `#bc402f (sRGB #cb3324)` | `#d1483b (sRGB #e23a31)` | [M] | 1750,690 |
| accent.red.cap.100 | `#b73322 (sRGB #c72111)` | `#cb4639 (sRGB #dc382f)` | [M] | 1750,699 |
| accent.red.cap.edge-bottom | `#b6321f (sRGB #c6200b)` | - | [M] | L 1750,700 |
| accent.red.cap.edge-right | `#bd4939 (sRGB #cc3f30)` | - | [M] | L 1776,680 |
| accent.red.glyph.arrow | `#ffffff` | `#fae3e2 (sRGB #ffe2e1)` | [M] | 1759,670 |
| accent.red.glyph.radio-dot | `#ffffff` | `#f8e4e1 (sRGB #fce3e0)` | [M] | 1496,894 |
| accent.red.glyph.checkmark | - | `#f5d9d6 (sRGB #fad8d5)` | [M] | D 1494,1328 |
| accent.red.glyph.shadow | `#a83e30 (sRGB #b63428)` | - | [M] | L 1496,900 |
| accent.red.menu.selection | `#ce5857 (sRGB #de4e52)` | `#b4403f (sRGB #c3343a)` | [M] | 95,70 |
| accent.red.menubar.selection | `#ce5957 (sRGB #de4f52)` | `#b5413f (sRGB #c43539)` | [M] | 95,10 |
| accent.red.menu.selection.morning | `#d46361 (sRGB #e45a5d)` | - | [M] | Mo 95,70 |
| accent.red.menu.selection.evening | `#bf4846 (sRGB #ce3d40)` | - | [M] | Ev 95,70 |
| accent.red.highlight | `#eec5c6 (sRGB #f6c3c5)` | `#845a59 (sRGB #8b5858)` | [M] | 1510,680 |
| accent.red.highlight.border | `#b39594 (sRGB #b99493)` | `#a28382 (sRGB #a88281)` | [M] | 1496,680 |
| accent.orange.swatch | `#e8873a (sRGB #f7821c)` | `#e8873a (sRGB #f7821c)` | [M] | 1676,617 |
| accent.orange.swatch.ring | `#b96d2e (sRGB #c56917)` | `#eca061 (sRGB #f89d53)` | [M] | 1673,617 |
| accent.orange.selection-ring | `#e9873a (sRGB #f8821b)` | `#e8863b (sRGB #f7811e)` | [M] | L 1479,480; D 1651,480 |
| accent.orange.control.fill | `#e09338 (sRGB #ec9011)` | `#f08d35 (sRGB #ff8802)` | [M] | 1480,1326 |
| accent.orange.control.top-line | `#df8c32 (sRGB #ec8800)` | `#f4b55a (sRGB #feb344)` | [M] | 1492,1312 |
| accent.orange.control.gradient.start | - | `#f29938 (sRGB #ff9502)` | [M] | D 1492,1313 |
| accent.orange.control.gradient.end | - | `#ed8531 (sRGB #fc7f00)` | [M] | D 1492,1339 |
| accent.orange.cap.top-line | `#e19b42 (sRGB #ec9826)` | `#f4b45b (sRGB #ffb246)` | [M] | L 1750,661; D 1750,662 |
| accent.orange.cap.0 | `#e5ac5d (sRGB #efaa4c)` | `#f19938 (sRGB #ff9503)` | [M] | L 1750,662; D 1750,663 |
| accent.orange.cap.25 | `#e3a24c (sRGB #eea035)` | `#f09135 (sRGB #fe8c00)` | [M] | 1750,671 |
| accent.orange.cap.50 | `#e19338 (sRGB #ed9010)` | `#f08d34 (sRGB #ff8800)` | [M] | 1750,680 |
| accent.orange.cap.75 | `#de8430 (sRGB #ec8000)` | `#f08933 (sRGB #ff8400)` | [M] | 1750,690 |
| accent.orange.cap.100 | `#de7a2e (sRGB #ed7401)` | `#ed8532 (sRGB #fc7f00)` | [M] | 1750,699 |
| accent.orange.cap.edge-bottom | `#dc7b2e (sRGB #ea7601)` | - | [M] | L 1750,700 |
| accent.orange.cap.edge-right | `#de8c32 (sRGB #eb8800)` | - | [M] | L 1776,680 |
| accent.orange.glyph.arrow | `#ffffff` | `#fceeda (sRGB #ffeed8)` | [M] | 1759,670 |
| accent.orange.glyph.radio-dot | `#ffffff` | `#fceed9 (sRGB #ffeed6)` | [M] | 1496,894 |
| accent.orange.glyph.checkmark | - | `#fce8cc (sRGB #ffe8c8)` | [M] | D 1494,1328 |
| accent.orange.glyph.shadow | `#c7792b (sRGB #d37500)` | - | [M] | L 1496,900 |
| accent.orange.menu.selection | `#e4904d (sRGB #f18c3b)` | `#c97735 (sRGB #d5731e)` | [M] | 95,70 |
| accent.orange.menubar.selection | `#e4904e (sRGB #f18c3d)` | `#ca7736 (sRGB #d77320)` | [M] | 95,10 |
| accent.orange.menu.selection.morning | `#e99858 (sRGB #f69449)` | - | [M] | Mo 95,70 |
| accent.orange.menu.selection.evening | `#d5803d (sRGB #e27c28)` | - | [M] | Ev 95,70 |
| accent.orange.highlight | `#f7dabf (sRGB #fcd9bb)` | `#83664b (sRGB #886547)` | [M] | 1510,680 |
| accent.orange.highlight.border | `#baa58f (sRGB #bea48c)` | `#a28d77 (sRGB #a68c74)` | [M] | 1496,680 |
| accent.yellow.swatch | `#f3ba4b (sRGB #fdb927)` | `#f3b94b (sRGB #fdb828)` | [M] | 1724,617 |
| accent.yellow.swatch.ring | `#c2953c (sRGB #ca9421)` | `#f5c76f (sRGB #fdc65e)` | [M] | 1721,617 |
| accent.yellow.selection-ring | `#f3b94b (sRGB #fdb828)` | `#f2b94b (sRGB #fcb828)` | [M] | L 1479,480; D 1651,480 |
| accent.yellow.control.fill | `#e6ad4c (sRGB #f0ab31)` | `#e6b53e (sRGB #eeb401)` | [M] | 1480,1326 |
| accent.yellow.control.top-line | `#e5a742 (sRGB #efa51f)` | `#f7d362 (sRGB #fdd348)` | [M] | 1492,1312 |
| accent.yellow.control.gradient.start | - | `#f3c243 (sRGB #fbc103)` | [M] | D 1492,1313 |
| accent.yellow.control.gradient.end | - | `#d9aa39 (sRGB #e1a900)` | [M] | D 1492,1339 |
| accent.yellow.cap.top-line | `#e5b158 (sRGB #eeb043)` | `#f8d262 (sRGB #fed248)` | [M] | L 1750,661; D 1750,662 |
| accent.yellow.cap.0 | `#eabf73 (sRGB #f1be65)` | `#f3c244 (sRGB #fbc109)` | [M] | L 1750,662; D 1750,663 |
| accent.yellow.cap.25 | `#e9b863 (sRGB #f1b751)` | `#eebb40 (sRGB #f7ba00)` | [M] | 1750,671 |
| accent.yellow.cap.50 | `#e6ae4d (sRGB #efac32)` | `#e7b53e (sRGB #efb401)` | [M] | 1750,680 |
| accent.yellow.cap.75 | `#e5a23c (sRGB #f0a010)` | `#deaf3b (sRGB #e6ae00)` | [M] | 1750,690 |
| accent.yellow.cap.100 | `#e39b37 (sRGB #ef9802)` | `#d8aa39 (sRGB #e0a900)` | [M] | 1750,699 |
| accent.yellow.cap.edge-bottom | `#e49d37 (sRGB #ef9a00)` | - | [M] | L 1750,700 |
| accent.yellow.cap.edge-right | `#e5a841 (sRGB #efa61c)` | - | [M] | L 1776,680 |
| accent.yellow.glyph.arrow | `#ffffff` | `#fdf5da (sRGB #fef5d7)` | [M] | 1759,670 |
| accent.yellow.glyph.radio-dot | `#fffffe` | `#faf4db (sRGB #fbf4d8)` | [M] | 1496,894 |
| accent.yellow.glyph.checkmark | - | `#faefcd (sRGB #fcefc9)` | [M] | D 1494,1328 |
| accent.yellow.glyph.shadow | `#cc9339 (sRGB #d59119)` | - | [M] | L 1496,900 |
| accent.yellow.menu.selection | `#ecbb5c (sRGB #f4ba46)` | `#d2a144 (sRGB #daa029)` | [M] | 95,70 |
| accent.yellow.menubar.selection | `#edbc5c (sRGB #f5bb46)` | `#d3a244 (sRGB #dba129)` | [M] | 95,10 |
| accent.yellow.menu.selection.morning | `#f2c266 (sRGB #fac153)` | - | [M] | Mo 95,70 |
| accent.yellow.menu.selection.evening | `#ddac4b (sRGB #e5ab31)` | - | [M] | Ev 95,70 |
| accent.yellow.highlight | `#fbe9c3 (sRGB #fee9be)` | `#877550 (sRGB #8a754a)` | [M] | 1510,680 |
| accent.yellow.highlight.border | `#bcb092 (sRGB #beb08e)` | `#a5987b (sRGB #a79877)` | [M] | 1496,680 |
| accent.green.swatch | `#78b657 (sRGB #62b947)` | `#78b756 (sRGB #62ba46)` | [M] | 1772,617 |
| accent.green.swatch.ring | `#609245 (sRGB #4e9538)` | `#93c677 (sRGB #83c96d)` | [M] | 1769,617 |
| accent.green.selection-ring | `#79b756 (sRGB #63ba46)` | `#78b657 (sRGB #62b947)` | [M] | L 1479,480; D 1651,480 |
| accent.green.control.fill | `#7fac56 (sRGB #71af48)` | `#60b340 (sRGB #38b724)` | [M] | 1480,1326 |
| accent.green.control.top-line | `#75a64a (sRGB #65a939)` | `#8ed274 (sRGB #77d667)` | [M] | 1492,1312 |
| accent.green.control.gradient.start | - | `#6dc04b (sRGB #49c432)` | [M] | D 1492,1313 |
| accent.green.control.gradient.end | - | `#5ba83b (sRGB #37ac20)` | [M] | D 1492,1339 |
| accent.green.cap.top-line | `#88b163 (sRGB #7cb458)` | `#8ed174 (sRGB #77d567)` | [M] | L 1750,661; D 1750,662 |
| accent.green.cap.0 | `#9dc07e (sRGB #93c276)` | `#6cc04b (sRGB #47c432)` | [M] | L 1750,662; D 1750,663 |
| accent.green.cap.25 | `#91b86e (sRGB #86ba64)` | `#63b942 (sRGB #39bd25)` | [M] | 1750,671 |
| accent.green.cap.50 | `#7fad57 (sRGB #70b049)` | `#61b440 (sRGB #39b824)` | [M] | 1750,680 |
| accent.green.cap.75 | `#6ca140 (sRGB #5aa42c)` | `#5dad3e (sRGB #37b124)` | [M] | 1750,690 |
| accent.green.cap.100 | `#619a34 (sRGB #4c9d19)` | `#5aa83b (sRGB #35ac20)` | [M] | 1750,699 |
| accent.green.cap.edge-bottom | `#5b9730 (sRGB #439a11)` | - | [M] | L 1750,700 |
| accent.green.cap.edge-right | `#72a548 (sRGB #61a837)` | - | [M] | L 1776,680 |
| accent.green.glyph.arrow | `#ffffff` | `#e6f5e0 (sRGB #e2f6de)` | [M] | 1759,670 |
| accent.green.glyph.radio-dot | `#fffffe` | `#e4f4e0 (sRGB #e0f5de)` | [M] | 1496,894 |
| accent.green.glyph.checkmark | - | `#dcefd5 (sRGB #d7f0d3)` | [M] | D 1494,1328 |
| accent.green.glyph.shadow | `#65923f (sRGB #569530)` | - | [M] | L 1496,900 |
| accent.green.menu.selection | `#83b966 (sRGB #71bc5a)` | `#6a9f4d (sRGB #58a240)` | [M] | 95,70 |
| accent.green.menubar.selection | `#83b966 (sRGB #71bc5a)` | `#6ba04e (sRGB #59a341)` | [M] | 95,10 |
| accent.green.menu.selection.morning | `#8cc070 (sRGB #7cc365)` | - | [M] | Mo 95,70 |
| accent.green.menu.selection.evening | `#73a955 (sRGB #61ac48)` | - | [M] | Ev 95,70 |
| accent.green.highlight | `#d5e9ca (sRGB #d0eac7)` | `#627556 (sRGB #5d7653)` | [M] | 1510,680 |
| accent.green.highlight.border | `#a0af98 (sRGB #9cb096)` | `#889880 (sRGB #84997e)` | [M] | 1496,680 |
| accent.graphite.swatch | `#999899` | `#8c8c8c` | [M] | 1820,617 |
| accent.graphite.swatch.ring | `#7a7a7a` | `#a3a3a4` | [M] | 1817,617 |
| accent.graphite.selection-ring | `#989898` | `#8c8c8c` | [M] | L 1479,480; D 1651,480 |
| accent.graphite.control.fill | `#99999e` | `#989898` | [M] | 1480,1326 |
| accent.graphite.control.top-line | `#919296` | `#b2b2b2` | [M] | 1492,1312 |
| accent.graphite.control.gradient.start | - | `#9d9d9d` | [M] | D 1492,1313 |
| accent.graphite.control.gradient.end | - | `#999999` | [M] | D 1492,1339 |
| accent.graphite.cap.top-line | `#a6a6ab` | `#b3b3b3` | [M] | L 1750,661; D 1750,662 |
| accent.graphite.cap.0 | `#b2b2b7` | `#9e9e9e` | [M] | L 1750,662; D 1750,663 |
| accent.graphite.cap.25 | `#acacb1` | `#999999` | [M] | 1750,671 |
| accent.graphite.cap.50 | `#a2a2a7` | `#999999` | [M] | 1750,680 |
| accent.graphite.cap.75 | `#98989d` | `#999999` | [M] | 1750,690 |
| accent.graphite.cap.100 | `#919196` | `#999999` | [M] | 1750,699 |
| accent.graphite.cap.edge-bottom | `#7b7b80` | - | [M] | L 1750,700 |
| accent.graphite.cap.edge-right | `#929297` | - | [M] | L 1776,680 |
| accent.graphite.glyph.arrow | `#ffffff` | `#252525` | [M] | 1759,670 |
| accent.graphite.glyph.radio-dot | `#ffffff` | `#262525` | [M] | 1496,894 |
| accent.graphite.glyph.checkmark | - | `#2e2d2e` | [M] | D 1494,1328 |
| accent.graphite.glyph.shadow | `#7e7f84 (sRGB #7e7f85)` | - | [M] | L 1496,900 |
| accent.graphite.menu.selection | `#949494` | `#697488 (sRGB #67748a)` | [M] | 95,70 |
| accent.graphite.menubar.selection | `#949494` | `#68748b (sRGB #66748d)` | [M] | 95,10 |
| accent.graphite.menu.selection.morning | `#9c9c9c` | - | [M] | Mo 95,70 |
| accent.graphite.menu.selection.evening | `#848484` | - | [M] | Ev 95,70 |
| accent.graphite.highlight | `#e0e0e0` | `#686868` | [M] | 1510,680 |
| accent.graphite.highlight.border | `#a9aaa8` | `#8c8e8d` | [M] | 1496,680 |

## Inferred values
Every value tagged [I], [D] or a mix in the 15 component files (line numbers are the component file's).

- `alert`: button order and placement, default rightmost, third button at the left of the row [D: HIG Alerts, lines 16 and 120]; keyboard (Return, Escape, Command-period, Command-D for "Don't Save") [D]; inactive rendering (default button loses the accent) [I]; sheet presentation (same layout, no title bar) [I]; suppression checkbox (small checkbox, left-aligned with the text column, 8 pt below the informative text) [D/I]; critical style badge (32 pt caution triangle over the icon's lower-right quadrant) [I]; informative-text line pitch 14 pt [I] (one line shown).
- `dialog`: purpose and button placement rules [D: HIG Dialogs]; Return/Escape/Tab keys [D]; inactive state [I].
- `sheet`: purpose, no stacking, tabbed-window rule, parent can move but not close [D: HIG Sheets]; open/close animation 0.2-0.25 s ease-out [D/I]; parent-inactive rendering [I]; opaque fallback `#ececec` / `#323232` [I]; material recipe blur 30 px, saturate 1.2, tint `rgba(236,236,236,0.72)` / `rgba(40,40,40,0.75)` [C]/[I].
- `open-panel`: purpose and HIG rules [D]; keyboard shortcuts [D]; options expanded, search active and sheet presentation [I]; dark sidebar-header text `#9a9a9b`-class [I].
- `save-panel`: **the whole component** (not in any screenshot). Behaviour, default button "Save", name field focused with the base name selected, shortcuts [D: HIG Dialogs, NSSavePanel]; collapsed layout and width about 450 pt [I]; label column 8.5 pt before the control [I]; text field 22 pt, pop-up 20 pt, row pitch 30 pt [I]; buttons 20 pt tall, 69..83 pt wide, 13 pt apart, 20.5 pt margins [I]; expanded browser identical to `open-panel` [I]; sheet attachment, material, shadow as `sheet` [I]; disclosure button 8 pt right of the name field, animated expansion [D/I].
- `print-panel`: purpose and pane guidance [D: HIG Printing]; keys [D]; simple form (about 150 pt shorter) [D/I]; content of the Copies and Pages rows hidden behind the open menu [D].
- `preferences-window`: modeless, non-resizable, minimize and zoom disabled, apply immediately, restore last pane, window resizes when the pane changes [D: HIG Preferences]; inactive state [I].
- `preferences-toolbar`: non-customisable, always icon and text, selection stays highlighted [D]; no hover state [D]; full-keyboard-access keys [D]; pressed item (black 0.25 over the icon) [I]; selected item in an inactive window (50% opacity) [I]; disabled item (35% opacity) [I].
- `inspector-panel`: panel rules, inspector vs Info window [D: HIG Panels]; disclosure keys (Space, Right expands, Left collapses) [D: HIG Disclosure Controls]; inactive window [I].
- `progress-window`: determinate bar, description, estimate, cancel [D: HIG Progress Indicators]; Command-period cancels [D]; indeterminate, paused, finishing states [I]; additional operations add rows of about 46 pt separated by a 1 pt line [I].
- `notification-alert`: banner vs alert behaviour, content guidance [D: HIG Notifications]; VoiceOver exposure [D]; pressed button darkens its half by black 0.1 [I]; hover "Options" pull-down [I]; two-button column split with a 1 pt line [D/I]; on-screen material recipe blur 30 px, saturate 1.8, tint `rgba(246,246,246,0.72)` / `rgba(40,40,40,0.72)` [I]; position 8 pt below the menu bar and from the right edge, 8 pt stacking gap [D/I]; slide-in about 0.3 s [I].
- `about-window`: app About panel rules (modeless, close button only) [D]; standard app About panel layout, about 284 pt wide [D/I, not shown]; Control-Tab cycles tabs [D]; other tabs and inactive window [I].
- `assistant-window`: onboarding guidance [D]; keys [D]; later steps: "Go Back" 13 pt to the left of "Continue", progress bar [I].
- `accent-colors`: `AppleAccentColor` values (-1 graphite, 0 red, 1 orange, 2 yellow, 3 green, 5 purple, 6 pink, unset blue) and `currentControlTint` mapping [D]; use `controlAccentColor` [D: HIG Color]; graphite disables desktop tinting in dark mode [D: HIG Dark Mode] (also measured); inactive-window controls lose the accent [I]; pressed = fill x black 0.12 [I]; disabled = 50% opacity, no accent [I]; graphite zoom button in its active state is the same grey as close/minimize [I] (the thumbnail shows three grey dots [M]); dark graphite menu selection `rgba(255,255,255,0.25)` over the menu material [I]; focus ring for non-blue accents = swatch at 0.5 alpha [I]; default button for non-blue accents = that accent's cap gradient [C]; accent picker is a radio group for accessibility [I]; do not rely on colour alone [D].
- `highlight-color`: token semantics (`selectedTextBackgroundColor`, `selectedContentBackgroundColor`, emphasised vs unemphasised) [D: AppKit, HIG Color]; inactive window = unemphasised [D]; selected-text colour unchanged in dark [I]; dark selected-text background on real text taken from the swatch [C]; emphasised row colour for the seven non-blue accents [I] (two recipes are given, see "Open issues" item 3).

## Not reproducible in a browser
- **Behind-window vibrancy** (sheet background, notification, sidebar of the Open panel, menus): `backdrop-filter` only blurs content of the same page, never the desktop or another window. Closest: inside a simulated desktop use the recipes in the token table (`sheet.material.recipe`, `notification.material.recipe`); otherwise the opaque fallbacks (`#ececec` / `#323232` for sheets, `#ededed` / `#383838` for notifications, `#e8e8e7` / `#2c2d2e` for the sidebar).
- **Accent seen through a menu** changes with the wallpaper (Morning, Day and Evening rows differ by a constant). Closest: the Day value as an opaque colour, or the swatch at 0.85 alpha over a simulated menu material.
- **Dark-mode desktop tinting** (`#303031`..`#323437` depending on what is behind the window; `#323232` with graphite): CSS cannot sample the wallpaper. Closest: two neutral ramps, tinted (`#303032` base) and untinted (`#323232` base), switched on the accent; a page that owns its wallpaper image could average it in a canvas and mix a little of it into the greys.
- **The user's real accent and highlight colour** cannot be read reliably (`AccentColor`/`Highlight` system colours are inconsistently supported and never give the derived gradients). Closest: a theme setting that selects one of the eight `accent.<name>.*` sets.
- **Key vs inactive window** (default button and controls lose the accent, emphasised selection turns grey): needs a window focus/blur flag set from script; CSS has no portable window-inactive selector.
- **Sheet presentation**: a sheet may be wider than its parent and must be clipped at the attachment line while it slides. Closest: a clip container positioned in the parent's stacking context with negative side insets, `translateY(-100%)` to `0`; `inert` on the parent's content only.
- **App-modal behaviour** (alert, Go to Folder, Open panel, Music and TV preferences): scripted focus trap and an invisible click blocker over the app's other windows; macOS does not dim them.
- **Window height animation** when a preferences pane changes or an inspector section expands: measure heights in script (FLIP); CSS cannot transition `height: auto`.
- **File system and printing**: the Open, Save and Print panels are replicas fed with mock data (or the File System Access API); the browser's own print UI cannot be themed, and the print preview must be rendered by the app.
- **Middle truncation** of the progress title ("Pippin - Apple's F...e Console.mov"): compute in script from measured text widths.
- **Half-point hairlines** (button edges, sheet edge, swatch borders): 0.5 CSS px renders only on 2x displays; round up to 1 px at 1x.
- **Stored colour values**: the PNGs hold Display P3 panel values. Use the sRGB conversions (to be added by `build.py annotate`) or `color(display-p3 r g b)` for exact matches on wide-gamut displays.
- **Window and notification shadows**: the measured alpha falloffs are fitted with two or three stacked `box-shadow` layers; the fits are approximations, not exact.
- **Artwork and fonts**: preference-pane icons, app and document icons, the Trash, the caution badge, the Boot Camp diamonds, the Catalina badge (day and night variants), Appearance thumbnails and orientation glyphs are image assets; SF Pro Text/Display resolve only on Apple systems (`-apple-system`), elsewhere glyph widths and the bold/light pair of "macOS Catalina" differ visibly.

## Open issues

### 1. Corrections made by the audit (14 edits, 6 files)
| File | Was | Now | Measured with |
|---|---|---|---|
| `alert.md` | dark rim "1 px", cited `@ 113,230,1,1` | 1 pt (2 px, x 112..113 and 950..951) `#59595a`, black line at alpha 0.965 outside it | `row` 320 and `at` 111..115,230 of Dark-Finder-Empty-Trash |
| `dialog.md` | `Light-Finder-Open-iCloud @ 1646,1245,152,42` (outside the 1822 x 1120 image) | `@ 1535,911,154,40` (fill `#f3f3f3` -> `#ececec`, title `#b4b4b4`) plus the dark instance `Dark-Finder-Open-iCloud @ 1765,1245,154,40` | `info`, `row` 930, `col` 1560 and 1600 |
| `dialog.md` | Music button row bottom margin 20 pt | 20.5 pt (buttons y 579..618, frame ends 659) | `col` 900 of Light-Music-Preferences |
| `dialog.md` | dark separator above a button row [I] `#464646`-class | [M] `#444445` | `at` 600,540 of Dark-Music-Preferences |
| `sheet.md` | right margin from button edge px 1610 | edge px 1611 (41 px = 20.5 pt, unchanged) | `row` 980 of Light-Print |
| `sheet.md` | bottom margin 20 pt | 20.5 pt (bottom edge row 1000 -> 1041), now equal to `print-panel.md` | `col` 1400 and 1500 |
| `print-panel.md` | controls "start at x 1000, pop-up edge 1000" | column at x 1000; pop-up edge px at 1001 (blend px at 1000); orientation-button border from 1000 | `row` 264 and 620 |
| `print-panel.md` | Printer/Presets pop-up x 1000..1476 | edge px x 1001..1477 (238.5 pt unchanged) | `row` 264 |
| `print-panel.md` | Paper Size pop-up x 1000..1353 | edge px x 1001..1354 (177 pt unchanged) | `row` 544 |
| `print-panel.md` | pane pop-up x 1034..1379, 173 pt | edge px x 1033..1380, 174 pt | `row` 694 |
| `print-panel.md` | "PDF" pull-down 56.5 pt (x 248..360) | 57 pt (edge px x 248..361) | `row` 980 |
| `print-panel.md` | button band y 960..999 | edge rows y 961..1000 | `col` 1400 and 1500 |
| `inspector-panel.md` | separator "inset 1 pt (x 114..639)" | full width in light (x 112..641); in dark it shows at x 114..639 between the window's 1 pt rim `#6b6d6f` | `row` 296, 646, 1086 light; `row` 296 dark |
| `accent-colors.md` | garbled sentence about the radio-dot shadow (words missing) | "the second is the fill darkened by about 10% (`#4d8af5 (sRGB #3b89fd)` -> `#3570dc (sRGB #216ee4)`)" | `at` 1496,899..902 of Theme-Light-Blue |

### 2. Contradictions between screenshots (all measured; none is a spec error)
- **Dark window background is not one colour**: `#303031` (Empty Trash, Go to Folder, Connect to Server, Music), `#303032` (General pane, About This Mac), `#303132` (Mail preferences, Boot Camp), `#2f3235 (sRGB #2e3235)` (Finder Copy), `#323437` (Get Info), `#323232` (graphite accent). It is desktop tinting; separators and rims shift with it (`#444445`, `#444446`, `#46484b`; rim `#59595a`, `#575757`, `#56585b`, `#6b6d6f`). The token sheet needs a tinted ramp and an untinted ramp, not one value.
- **Button spacing differs by dialog kind**: 13 pt gap and 20.5 pt margins in dialogs, sheets and preferences; 15 pt gap and 18.5 pt bottom margin in the NSAlert; 9 pt gap and 10.5 pt margins in the Open panel's bottom bar; 11 pt between the small buttons of About This Mac.
- **Three different blues mean "selected"**: emphasised table/column row `#2365d9 (sRGB #0062e1)` / `#1e5ac8 (sRGB #0057cf)`, Storage Management sidebar row `#2f70dd (sRGB #146ee5)` / `#2d73e2 (sRGB #0971ea)`, menu item `#3f7ee7 (sRGB #2a7cef)` / `#2c6dd5 (sRGB #0e6bdc)`; the swatch is `#2f7cf7 (sRGB #027aff)` and the control fill `#4d89f5 (sRGB #3c87fd)` / `#2c66d3 (sRGB #1764db)`.
- **Purple, red and graphite swatches differ between light and dark** (`#8b4592 (sRGB #963d96)` / `#9b57a3 (sRGB #a650a7)`, `#d04746 (sRGB #e1383f)` / `#ed5f5e (sRGB #ff5258)`, `#999899` / `#8c8c8c`); the other five are equal within 1 level.
- **Window-control states vary between similar windows**: Calendar, Mail and Safari preferences disable minimize and zoom, Podcasts shows zoom enabled, Music and TV have no controls; About This Mac and Boot Camp disable only zoom; Finder Copy disables close and zoom; Get Info enables all three.
- **Preferences layout is per app**: content top margin 20.5 pt (Calendar, Mail), 18.5 pt (Safari), 25.5 pt (Podcasts); row pitch 30 pt, Mail 31 pt.
- **Light and dark captures are not always the same scene**: Open-iCloud is 799 x 448 pt with an empty folder in light and 914 x 615 pt with one folder in dark; Safari preferences has all text selected in light and only an insertion point in dark (so dark selected text is never shown on real text); Finder Copy is at about 3% in light and 8% in dark; Morning and Evening Theme files have the window shifted by (-8, -6) px, "Auto" selected and pop-ups 8 pt wider than the Day and Dark files.
- **File-name irregularities to keep when citing**: `Light-Finder-Go-To-Folder` vs `Dark-Finder-Go-to-Folder`, `Dark-Finder-Conect-to-Server`, `Dark-Stroage-Management`, `Theme-Evening-Purpe`, and `Theme-Light-*` is the "Day" wallpaper.

### 3. Left unmeasured or unresolved in the component files
- `accent-colors.md`: the two big matrices carry their [M] tag once above the table, not per row, so `build.py check` reports 74 "untagged measurement rows" for this file. Not changed here (it is a mass edit of a file I was told not to rewrite, and `build.py annotate` would then expand every matrix cell); the lead should either add `[M]` to the last cell of each row or teach the check about table-level tags.
- None of the 15 files, and nothing in this handoff, has `(sRGB #...)` annotations yet; `build.py annotate` has to be run over them.
- `highlight-color.md` gives two different [I] recipes for the emphasised row of non-blue accents (line 43: menu-selection Day value darkened; line 101: cap 75% stop darkened 10%). Only blue is measurable; one recipe should be chosen centrally, preferably AppKit's documented `selectedContentBackgroundColor` values.
- Blue only: focus ring, default button, progress fill, emphasised selection, selected text on real text. The other seven accents exist only in the General pane (controls, menu, swatches).
- Never captured anywhere in this group: any inactive-window rendering, pressed and disabled accent controls, alert with suppression checkbox / Help / three buttons / critical badge, an alert or save panel as a sheet, the save panel in any form, the simple print form, the Copies and Pages rows of the print panel (hidden behind the open menu), banner-style notification and two-button alert notification, the standard app About panel, later assistant steps, the open "Highlight color" pop-up list.
- Dark values still given only as a class or "-": `open-panel` (header-band text, unselected file name, location pop-up text, preview texts, link, placeholder), `print-panel` (separators, menu highlight, text colours), `about-window` (text colours are "white"/"grey"), `assistant-window` (title and button text), `inspector-panel` (name-field border, disabled text), `preferences-window` (small text).
- `sheet.md` has no dark edge or dark shadow: the dark edge is measured in the token table above (`sheet.edge.dark`); the dark shadow cannot be measured over the dark document. The sheet's side shadow is not measured in either appearance (only below the bottom edge).
- `print-panel.md`: the Paper Size row lies in the open menu's shadow, so its cap reads `#4275d0 (sRGB #3474d7)` instead of `#4e8af5 (sRGB #3d88fd)`; its geometry is valid, its colours are not usable.
- `apps/print-dialog.md` line 22 still says the bottom row is at y 960..999; the component now says 961..1000. Blueprints were outside what I was allowed to edit.
- Pixel-edge convention: widths in this group are counted between edge pixels (the `#c1c1c1`-class side px of a button), not including the faint outer blend px (`#e6e6e6`). A group that included the blend px would report controls 1 pt wider.

### 4. Best examples of other families' components in the dialogs screenshots
Crops are image px from `coverage/dialogs.json` (`clean: true`).
- **chrome**: 22 pt title bar without controls `Light-Finder-Go-To-Folder @ 112,76,858,44`; 38 pt title bar with tab control `Light-About-This-Mac @ 1094,386,1172,76`; graphite window controls `Theme-Morning-Graphite @ 990,338,116,36`; all three controls enabled `Light-Finder-Get-Info @ 124,82,112,32`; toolbar labelled item, selected and unselected `Light-Calendar-Preferences @ 120,120,98,110` and `@ 218,120,110,110`; toolbar pop-ups `Light-Finder-Open @ 250,93,92,50` and `@ 817,93,418,50`; back/forward both disabled `Dark-Finder-Open @ 132,93,106,50`; window shadow in alpha `Light-Finder-Go-To-Folder @ 0,0,1082,516`.
- **sysA**: pop-up button in all eight accents, light and dark `Theme-*-<Accent> @ 1471,655,314,40` (Morning/Evening coordinates); default button `Light-Finder-Go-To-Folder @ 761,285,170,46`; push button normal `@ 569,285,170,46`; disabled push button `Light-Finder-Open-iCloud @ 1535,911,154,40` (audit measurement, not a coverage crop); small push buttons `Light-About-This-Mac @ 1599,923,456,40`; combo box, focused `Light-Finder-Go-To-Folder @ 153,207,776,40`; help button `Light-Calendar-Preferences @ 1103,1077,44,44`; gradient buttons and action pull-down `Light-Finder-Connect-to-Server @ 153,455,113,44` and `@ 264,455,86,44`; pull-down with accent cap `Light-Print @ 246,958,117,44`; disclosure triangle expanded and collapsed `Light-Finder-Get-Info @ 126,304,120,28` and `@ 126,1093,150,28`; image buttons `Light-Print @ 998,580,180,80`; lock button `Light-Finder-Get-Info @ 577,1708,34,40`; accent and appearance pickers `Theme-Morning-Blue @ 1468,592,376,40` and `@ 1466,422,500,142`.
- **sysB**: checkbox and radio button on/off in all eight accents `Theme-Morning-<Accent> @ 1468,1304,32,32` and `@ 1470,870,36,36`; focus ring `Light-Finder-Go-To-Folder @ 146,200,790,54` and `Light-Safari-v13-Preferences @ 770,442,592,54`; text field with selected text `Light-Safari-v13-Preferences @ 777,449,578,40`; small determinate progress bar `Light-Finder-Copy @ 224,153,618,20`; token field `Light-Finder-Get-Info @ 120,222,514,66`; separators `Light-Finder-Get-Info @ 114,292,526,10`; bordered list with [+][-] bar `Light-Finder-Connect-to-Server @ 152,266,892,232`; colour wells `Light-Print @ 968,164,104,38`.
- **system**: menu-bar title and menu item highlight in all eight accents on three wallpapers plus dark `Theme-*-<Accent> @ 0,0,3360,46` and `@ 90,44,472,316`; open pop-up menu over a sheet `Light-Print @ 966,290,506,262`; Dock `Light-About-This-Mac @ 260,1920,2840,180`; unobstructed Morning, Day and Evening desktops `Theme-Morning-Blue`, `Theme-Light-Blue`, `Theme-Evening-Blue @ 2340,480,780,1400`; notification material captured opaque `Light-Finder-Eject-Warning @ 38,36,688,126`.
- **views**: column view with preview column `Light-Finder-Open @ 424,210,1516,1012`; vibrant source-list sidebar with tag dots `Light-Finder-Open @ 112,162,310,1060`; accent-selected sidebar `Light-Storage-Management @ 112,120,400,1020`; single-column table with icons `Light-Force-Quit @ 152,240,596,336`; permissions table with header `Light-Finder-Get-Info @ 142,1478,470,226`; read-only bordered text view `Light-Boot-Camp-Assistant @ 461,206,1185,846`; TextEdit format bar (ruler) `Light-Print @ 437,162,920,42`.

## Deviations from the assignment
- The handoff was written in 9 tool calls, not 3, of roughly 6,000 to 14,000 characters each; about half of them were over the 10,000-character guideline. One row per value for eight accents in two appearances, plus the other sections, comes to about 73,000 characters and does not fit in three calls of 10,000.
- Evidence in the token tables drops the `10-15-Catalina-` prefix and `.png` (as `handoff/views.md` does), and the per-accent table uses a declared shorthand; CONVENTIONS asks for full names. The component files keep full names.
- Three token rows marked (new) were measured for this handoff and are not in a component file (active zoom button, dark sheet edge).
- I replaced one [I] value with a measurement in `dialog.md` (dark button-row separator); the assignment asked only for corrections of values that do not reproduce.

## Concerns
- The automated colour audit covers every citation of the form `file @ x,y` + hex and every matrix cell. Colours cited only by a rectangle or a row/column run (most text colours) were checked by hand for the eight files the assignment names, not exhaustively for `progress-window`, `about-window`, `assistant-window`.
- `save-panel.md` is inference from start to finish; a builder should treat it as a proposal.

## Discoveries that affect other work
- Desktop tinting shifts every dark grey by several levels between screenshots (window background blue channel `0x31`..`0x37`, `0x32` untinted); any group that measured "the" dark window background, separator or rim from one file has a value that will disagree with other groups'.
- Dark windows, sheets and notifications all have a 1 pt (2 px) light inner rim inside a 1 px near-black line (measured on the alert, Get Info, the Open panel, the Print sheet and the notification); light ones have only a single slightly lighter edge pixel.
- In dark mode the pop-up cap, checkbox, radio and default button share one recipe (1 px highlight row + two-stop gradient + neutral outer edge); in light mode they do not (flat checkbox/radio, five-stop cap).

## Assumptions made in place of questions
- "Reproduces" was applied as +/-2 per channel for colours; geometry was treated as wrong only when the edge pixel, counted the way the rest of the file counts it, differed by a pixel or more.
- The out-of-bounds citation in `dialog.md` was meant to show a disabled default button, so I re-cited the disabled Open button in the same light file and added its dark counterpart.
- Coverage and blueprints were treated as read-only, including where a blueprint repeats a number corrected in a component file.

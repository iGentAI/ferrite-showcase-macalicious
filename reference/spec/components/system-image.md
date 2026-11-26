# System images (`system-image`)

- **Status:** present (added by the inventory gap closure, 6 October 2026: the standard template images appear in every toolbar and under every list, and no row covered them)
- **AppKit:** `NSImage.Name` system images: `NSAddTemplate`, `NSRemoveTemplate`, `NSActionTemplate`, `NSShareTemplate`, `NSGoBackTemplate`, `NSGoForwardTemplate`, `NSIconViewTemplate`, `NSListViewTemplate`, `NSColumnViewTemplate`, `NSFlowViewTemplate`, `NSRefreshTemplate`, `NSStopProgressFreestandingTemplate`, `NSInfo`, `NSUser`, `NSUserGroup`, `NSEveryone`
- **HIG:** https://web.archive.org/web/20200503144242/https://developer.apple.com/design/human-interface-guidelines/macos/icons-and-images/system-icons/
- **Appearances shown:** light, dark

## Purpose and behaviour
Named images that AppKit provides so that every app uses the same glyph for the same meaning: a plus adds, a minus removes, the gear opens an action menu, the boxed arrow shares. Most are template images: only their alpha is used, and the control draws them in its text colour, dimmed when it is disabled. They are not interactive. [D]

## Anatomy
One glyph per image, in a fixed box. `NSUser`, `NSUserGroup` and `NSEveryone` are not templates in AppKit; the Sharing pane shows them black in light and light grey in dark, with the figures at the back at about half strength.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| name | the images listed under AppKit, plus the pull-down chevron and the sidebar glyph | none | `NSImage(named:)` | all listed below |
| size | the image's own | own | `NSImage.size` | own size only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes, light + dark | `10-15-Catalina-Light-Console.png @ 861,128,36,36`; Dark same |
| in a disabled control | yes, light + dark | Finder's Forward button, `10-15-Catalina-Light-Finder-Network.png @ 124,122,110,52` |
| inactive window | yes | Safari's toolbar in the Picture in Picture captures (see `toolbar-button`) |

## Measurements
### Geometry (pt)
| Image | Box | Tag | Evidence |
|---|---|---|---|
| add, remove | 11 x 11, 1 pt bars | [M] | Language & Region list buttons (see `gradient-button`) |
| action (gear) | 13 x 13 | [M] | Network pane action button (see `gradient-button`) |
| share | 11 x 15: box 11 x 9.5 with a 3 pt gap in its top edge, 1 pt lines, arrow 9.5 high with a 6 pt wide head | [M] | `10-15-Catalina-Light-Console.png` x 867..888, y 132..161 |
| go back, go forward | 7 x 12, 1.5 pt line | [M] | Finder Back and Forward (see `toolbar-button`) |
| pull-down chevron | 7 x 4.5, 1.5 pt line | [M] | Finder Group and Action buttons (see `toolbar-pop-up`) |
| icon, list and gallery view | 14 x 10 | [M] | Finder view switcher (see `toolbar-segmented-control`) |
| column view | 16 x 10 | [M] | Finder view switcher |
| sidebar | 15 x 11 | [M] | Safari sidebar button in the Picture in Picture captures (see `toolbar-button`) |
| refresh | 11 x 13: an 11 x 10.5 arc of 1 pt, open from 12 to 3 o'clock, with a 4.5 x 5.5 arrowhead at 12 o'clock | [M] | `10-15-Catalina-Light-Console.png` x 561..582, y 133..158 |
| stop progress | 14 x 14 disc, cross cut out | [M] | clear button of Preview's toolbar search field, `10-15-Catalina-Light-Preview-Search.png` solid ink x 2357..2382, y 135..160, with a blended pixel on each side; the dark capture's disc spans x 2814..2841, y 134..161 (see `search-field`) |
| add circle | 16 x 16 disc; the plus cut out of it: two bars 8 long and about 1.4 thick, crossing at the centre | [M] | Reminders' Add List button, `10-15-Catalina-Light-Reminders.png` disc x 144..175, y 1266..1297; horizontal bar x 152..167, fully clear on rows y 1281..1282 and about 40% clear on y 1280 and y 1283; vertical bar y 1274..1289, clear on columns x 159..160. The dark capture has the same pixels |
| info | 15 x 15 disc; the letter cut out of it: a dot 2 across, 3 under the top; a stem 2 wide from 6 to 12 under the top, with a flag 1 x 1 at its top left and a foot 4 x 1 | [M] | Console Info button, `10-15-Catalina-Light-Console.png` x 741..770, y 133..162 (letter: dot x 754..757, y 139..142; stem x 754..757, y 145..156; foot x 752..759, y 155..156); shown there in the accent colour, not as a template |
| user | 13 x 13: head 6 x 7, shoulders 13 x 5 | [M] | `10-15-Catalina-Light-System-Preferences-Sharing.png` x 936..961, y 626..651 |
| user group | 15 x 10.5 | [M] | same file, x 934..963, y 670..690 |
| everyone | 15 x 10.5 | [M] | same file, x 934..963, y 707..727 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Template image in a toolbar button | `#575757` | `#ffffff` | [M] | `10-15-Catalina-Light-Console.png @ 878,142`; `10-15-Catalina-Dark-Console.png @ 878,142` |
| Info image in Console's toolbar | accent: `#417eee` (sRGB `#2e7cf6`) | `#5190f0` (sRGB `#3e8ff7`) | [M] | `10-15-Catalina-Light-Console.png @ 748,140`; `10-15-Catalina-Dark-Console.png @ 748,140` |
| Clear button disc in a search field | `#7c7c7c` | `#d0d0d0` | [M] | `10-15-Catalina-Light-Preview-Search.png @ 2362,140`; `10-15-Catalina-Dark-Preview-Search.png @ 2820,140` |
| Add List disc on Reminders' sidebar | `#686867` on `#e7e7e6` | `#a8a9aa` on `#2c2d2e` | [M] | `10-15-Catalina-Light-Reminders.png @ 150,1272`; `10-15-Catalina-Dark-Reminders.png @ 150,1272` |
| User image in a table | `#000000` | `#deddde` | [M] | `10-15-Catalina-Light-System-Preferences-Sharing.png @ 949,634`; `10-15-Catalina-Dark-System-Preferences-Sharing.png @ 949,634` |
| Group image, front and back figure | `#363636`, `#7c7c7c` | `#cecfce`, `#919292` | [M] | `10-15-Catalina-Light-System-Preferences-Sharing.png @ 952,680` and `@ 940,676`; Dark same coordinates |
| Everyone image, middle and side figures | `#252525`, `#7f7f7f` | `#c2c2c2`, `#7d7e7f` | [M] | `10-15-Catalina-Light-System-Preferences-Sharing.png @ 949,716` and `@ 937,714`; Dark same coordinates |

### Text and icons
The images are the artwork. Apple's own drawings are not reproduced: the library draws stand-ins on the measured boxes.

### Shadows and effects
None.

## Layout and spacing
An image is centred in its button. In Console's 22 pt high toolbar buttons the share glyph starts 3 pt and the reload glyph 3.5 pt under the top of the fill. [M] (`10-15-Catalina-Light-Console.png`, column 895: fill y 126..169)

## Keyboard and accessibility
Not focusable. Decorative inside a named control; an image that stands alone carries an accessibility description. ARIA: `aria-hidden` in a named control, otherwise `role="img"` with a name. [D]

## Browser notes
Inline SVG drawn in `currentColor` reproduces template behaviour: the image takes the colour of the control's text in every state without a rule of its own.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Console.png | 861,128,36,36 | share glyph on its toolbar button |
| light | 10-15-Catalina-Light-Console.png | 557,127,36,36 | reload glyph on its toolbar button |
| light | 10-15-Catalina-Light-System-Preferences-Sharing.png | 932,622,36,114 | user, group and everyone images in the Users table |
| dark | 10-15-Catalina-Dark-Console.png | 861,128,36,36 | share glyph |
| dark | 10-15-Catalina-Dark-System-Preferences-Sharing.png | 932,622,36,114 | user, group and everyone images |
| light | 10-15-Catalina-Light-Reminders.png | 142,1264,36,36 | add circle, the disc of the Add List button |
| dark | 10-15-Catalina-Dark-Reminders.png | 142,1264,36,36 | add circle |

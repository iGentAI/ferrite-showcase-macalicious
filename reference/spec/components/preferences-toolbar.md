# Preferences toolbar (`preferences-toolbar`)

- **Status:** present (6 apps, light and dark)
- **AppKit:** `NSToolbar` with `displayMode = .iconAndLabel`, `allowsUserCustomization = false`, selectable items (`toolbarSelectableItemIdentifiers(_:)`, `selectedItemIdentifier`); in 10.15 there is no `NSWindow.toolbarStyle` (that is 11.0), so this is the only preferences look
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/app-architecture/preferences/ and https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/toolbars/
- **Appearances shown:** light, dark

## Purpose and behaviour

The toolbar of a preferences window is a pane switcher: each item is an icon with a label, exactly one
is selected, clicking another swaps the pane, retitles the window to the pane's name and resizes the
window to fit. The HIG asks that the toolbar in a preferences window is not customisable, always shows
icon and text, and that the selected item stays highlighted (HIG Preferences) [D].

## Anatomy

```
 y=0   +---------------------------------------------------------------+
       | (o)(o)(o)              General                                |  title bar 22 pt, title = selected pane
 y=22  |+-------+                                                      |
       ||  [#]  |   (@)      [x]      (A)   ...                        |  icons 32 pt, canvas top at y=25
       ||General| Accounts Junk Mail Fonts & Colors                    |  labels 11 pt, baseline y=69.5
 y=77  |+-------+------------------------------------------------------|  selection bg runs to the bottom line
 y=78  +===============================================================+  2 px bottom lines
```

Drawing order: unified title-bar/toolbar gradient, selection background, icon, label.

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| alignment | leading (items start at the left edge), centred | leading | centred needs `NSToolbarItem.Identifier.flexibleSpace` at both ends | leading: Calendar, Mail, Podcasts, Safari; centred: Music, TV |
| item count | 3 to 10 shown | - | - | Podcasts 3, Calendar 4, Music/TV 5, Mail 8, Safari 10 |
| window controls | present; absent (modal Music/TV preferences) | present | `styleMask` | both |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| Unselected item | yes | every toolbar |
| Selected item, key window | yes | "General" in all 12 captures |
| Pressed item | no | [I] icon and label darkened as for a pressed toolbar item (black at 0.25 over the icon) until mouse-up, then becomes selected |
| Selected item, inactive window | no | [I] same background, label and icon at 50% opacity like the rest of an inactive toolbar |
| Disabled item | no | [I] icon and label at 35% opacity |
| Hover | none | macOS toolbars have no hover state [D] |

## Measurements

Primary instance: Mail Preferences (frame x 112..1211, y 76..1157). Second: Calendar, Safari, Music.

### Geometry (pt)

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Title bar + toolbar total height | 78 pt (y 76..231 incl. two bottom line rows) | [M] | 10-15-Catalina-Light-Mail-Preferences.png col 400: content starts at y 232 |
| Title baseline | 15.5 pt below the window top (px 107) | [M] | title "General" cap y 89..107 |
| Selection background: top | 22 pt below the window top (y 120) | [M] | 10-15-Catalina-Light-Mail-Preferences.png col 130 |
| Selection background: bottom | flush with the first bottom line (last row y 229) -> height 55 pt (110 px) | [M] | same |
| Selection background: width | label width + 2 x 4.75 pt: "General" label x 129..207, background x 120..217 = 49 pt | [M] | 10-15-Catalina-Light-Mail-Preferences.png row 160 |
| Selection background: corners | top corners radius 4 pt. Least-squares fit with `tools/corner_fit.py` to the top-left corner: best 4 (rms 1.0 levels; 1.6 at 3.75, 1.3 at 4.25, 2.3 at 3.5); the same corner in dark fits 4 as well (rms 0.7; 1.1 at 3.75, 1.0 at 4.25). The earlier value of 3.5 was a grid reading (on row 120 the straight edge starts at x 127; on column 120 at row 127). Bottom corners square | [C] fit from [M] pixels; [M] square corners | grid @ 119,119,9,8 and @ 211,119,9,8; @ 214,226,7,7; fit corner 10-15-Catalina-Light-Mail-Preferences.png @ 120,120,10,10; dark fit corner 10-15-Catalina-Dark-Mail-Preferences.png @ 120,120,10,10 |
| First item inset | background starts 4 pt from the window's left edge (x 120; frame from 112); label starts 8.5 pt in | [M] | row 160 |
| Icon canvas | 32 x 32 pt, top 25 pt below the window top (y 126..189), centred on the label | [C] | largest artwork: Advanced gear 31 x 31 pt at y 127..188 (10-15-Catalina-Light-Safari-v13-Preferences.png @ 1079,127,62,62); General switch art 28 x 27.5 pt (@ 141,131,56,55) |
| Label cap top / baseline | 62 / 69.5 pt below the window top (y 200 / 215) | [M] | 10-15-Catalina-Light-Mail-Preferences.png "G" @ 129,200,14,16 |
| Icon bottom -> label cap top | 5 pt (189 -> 200) | [C] | from the two rows above |
| Label baseline -> toolbar bottom line | 7 pt (215 -> 229) | [M] | same |
| Item pitch | not fixed: gap between adjacent labels is 9.5 pt (19 px), each item is as wide as its label (or 32 pt icon if wider) plus 4.75 pt each side | [M] | Mail: labels end/start 207/226, 322/341; Calendar: 401/420 (10-15-Catalina-Light-Calendar-Preferences.png row 208) |
| Centred variant | the item group is centred in the window: Music labels span x 375..905 in a frame x 112..1177 (centre 640 vs 644.5) | [M] | 10-15-Catalina-Light-Music-Preferences.png @ 375,127,531,92 |

### Colours and fills

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Toolbar background at the selection's top row height | `#dedede` | `#3f4042` | [M] | 10-15-Catalina-Light-Mail-Preferences.png @ 250,125 `#dedede`; 10-15-Catalina-Dark-Mail-Preferences.png @ 250,125 `#3f4042` |
| Toolbar background near the bottom | `#cdcdcd` | `#373738` | [M] | 10-15-Catalina-Light-Mail-Preferences.png @ 250,225 `#cdcdcd`; 10-15-Catalina-Dark-Mail-Preferences.png @ 250,225 `#373738` |
| Selection background, top | `#c8c8c7` | `#525355` | [M] | 10-15-Catalina-Light-Mail-Preferences.png @ 130,125 `#c8c8c7`; 10-15-Catalina-Dark-Mail-Preferences.png @ 130,125 `#525355` |
| Selection background, bottom | `#bababa` | `#4a4b4c` | [M] | 10-15-Catalina-Light-Mail-Preferences.png @ 130,225 `#bababa`; 10-15-Catalina-Dark-Mail-Preferences.png @ 130,225 `#4a4b4c` |
| Selection background, as an overlay | `rgba(0,0,0,0.10)` | `rgba(255,255,255,0.10)` | [C] | light: `#c8c8c7`/`#dedede` = 0.90 and `#bababa`/`#cdcdcd` = 0.91; dark: (0x52 - 0x3f)/(0xff - 0x3f) = 0.099 |
| Selection edge (no border; hard edge) | `#c2c2c2` next to `#d8d8d8` | `#505151` next to `#3c3d3e` | [M] | 10-15-Catalina-Light-Mail-Preferences.png @ 120,160 `#c2c2c2`, @ 119,160 `#d8d8d8`; 10-15-Catalina-Dark-Mail-Preferences.png @ 120,160 `#505151`, @ 119,160 `#3c3d3e` |
| Toolbar bottom lines | `#bdbdbd` then `#a7a7a7` | `#2b2b2d` then `#000000` | [M] | 10-15-Catalina-Light-Mail-Preferences.png @ 400,230 `#bdbdbd`, @ 400,231 `#a7a7a7`; 10-15-Catalina-Dark-Mail-Preferences.png @ 400,230 `#2b2b2d`, @ 400,231 `#000000` |
| Title bar at title height | `#e4e4e4` | `#424345` | [M] | 10-15-Catalina-Light-Mail-Preferences.png @ 400,90 `#e4e4e4`; 10-15-Catalina-Dark-Mail-Preferences.png @ 400,90 `#424345` |

### Text and icons

| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Label font | SF Pro Text Regular 11 pt (cap 16 px, x-height 12 px), centred under the icon, single line | same | [C] | 10-15-Catalina-Light-Mail-Preferences.png @ 129,200,79,17 |
| Label colour, selected item | darkest stem `#2b2c2c` (on `#b9b9b9`) | lightest stem `#cacacb` | [M] | glyph scan of "General" in 10-15-Catalina-Light-Mail-Preferences.png / 10-15-Catalina-Dark-Mail-Preferences.png @ 124,196,91,27 |
| Label colour, unselected item | `#414141`..`#424242` | `#b6b6b7` | [M] | "Accounts" @ 226,196,97,27 (light: 10-15-Catalina-Light-Mail-Preferences.png; dark: 10-15-Catalina-Dark-Mail-Preferences.png @ 232,196,89,27) |
| Title | SF Pro Text Regular 13 pt, centred in the window | same | [C] | cap 19 px @ 615,89 |
| Icons | full-colour 32 pt artwork per pane (not template images); identical in light and dark except monochrome ones (Advanced gear, Signatures) | - | [M] | compare 10-15-Catalina-Light-Mail-Preferences.png and 10-15-Catalina-Dark-Mail-Preferences.png @ 122,122,1090,107 |

### Shadows and effects

None on the items. The toolbar shares the title bar's gradient (see `toolbar`, `title-bar`).

## Layout and spacing

Items are packed from the left with no flexible space (or centred as a group); the window never shows
an overflow chevron because preference windows are sized to fit their toolbar: the minimum window width
is the toolbar's natural width plus 4 pt at each end (Podcasts: three items in a 383 pt window; Safari:
ten items in 774 pt) [M: frames].

## Keyboard and accessibility

Items are reachable with full keyboard access (Control-F5 focuses the toolbar, arrows move, Space
selects) [D]. AX: AXToolbar containing AXButton (subrole AXTabButton-like) with AXValue 1 on the
selected item. ARIA: `role="tablist"` with `role="tab"`/`aria-selected`, the pane is the `tabpanel`;
the window title mirrors the selected tab.

## Browser notes

The selection background is a plain translucent overlay with rounded top corners
(`border-radius: 4px 4px 0 0`, the fitted top radius; 3.5px here until 3 October 2026, from the earlier grid reading), so it can sit on the shared toolbar gradient without its own
gradient. Icons must be supplied as image assets.

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Mail-Preferences.png | 112,76,1100,156 | 8 items, General selected |
| dark | 10-15-Catalina-Dark-Mail-Preferences.png | 112,76,1100,156 | same, dark |
| light | 10-15-Catalina-Light-Safari-v13-Preferences.png | 112,76,1548,156 | 10 items |
| dark | 10-15-Catalina-Dark-Safari-v13-Preferences.png | 112,76,1548,156 | 10 items, dark |
| light | 10-15-Catalina-Light-Music-Preferences.png | 112,76,1066,156 | centred items, no window controls |
| dark | 10-15-Catalina-Dark-Music-Preferences.png | 112,76,1066,156 | same, dark |
| light | 10-15-Catalina-Light-Calendar-Preferences.png | 112,76,1074,156 | 4 items |
| light | 10-15-Catalina-Light-Podcasts-Preferences.png | 112,76,766,156 | 3 items, narrowest window |

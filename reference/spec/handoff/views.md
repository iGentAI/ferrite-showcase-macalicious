# Handoff: group "views"

## Counts
- Screenshots viewed: **40 of 40** assigned (every preview opened with `view_files`; crops/rows sampled for all). Also opened for owned components: Finder Home, Gallery View, Applications, Applications Utilities, Finder Open, Finder Open iCloud, Finder Network, Finder Search, Finder Quick Look, Finder Get Info, Storage Management, TextEdit (light and dark), Stickies (light); pixel-sampled without viewing: Dark Applications, Dark Finder Home, Dark Safari Picture-in-Picture.
- Component files written: **17** (15 owned in seed.json + 2 new): `sidebar`, `sidebar-badge`, `table-view`, `table-header`, `outline-view`, `list-view`, `column-view`, `icon-view`, `gallery-view`, `split-view`, `scroll-view`, `text-view`, `ruler`, `tag-dot`, `empty-state`, `message-bubble`, `map-controls`.
- App blueprints written: **20** (`mail`, `notes`, `reminders`, `calendar`, `contacts`, `messages`, `activity-monitor`, `console`, `disk-utility`, `font-book`, `keychain-access`, `system-information`, `automator`, `script-editor`, `dictionary`, `network-utility`, `airport-utility`, `photos`, `maps`, `find-my`).
- Coverage: `coverage/views.json`, 40 entries, valid JSON, every `clean` entry has an in-bounds crop (checked with a script: 0 errors).

## New components
| id | Apple name | Family | File |
|---|---|---|---|
| `message-bubble` | Messages transcript bubble (sent/received) | views | components/message-bubble.md |
| `map-controls` | MapKit floating controls (zoom pair, compass/3D, locate, map-type switch, "Show" pop-up) | views | components/map-controls.md |
| `calendar-week-grid` | Calendar week view time grid (day columns, hour lines, events, now line) | views (app-only) | no component file; fully specified in apps/calendar.md; used as an id in coverage |

## Token candidates
Stored pixel values (not sRGB). Flat fills in these PNGs dither by +-1 per channel; the value given is the modal one.

| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| sidebar.material.active (neutral backdrop / opaque fallback) | #e7e8e8 | #2c2d2f | [M] | Light-Finder-Home @ 130,600; Dark-Finder-Home @ 130,600 |
| sidebar.material.inactive-window | #f6f6f6 | #2c2d2f | [M] | Light-Mail @ 250,600; Dark-Mail @ 240,600 |
| sidebar.material.over-wallpaper (range) | #d0cdc8 (sRGB #d1cdc7) .. #bfc8d2 (sRGB #bdc8d3) | #2b303b (sRGB #2a303c) .. #2c3238 (sRGB #2b3239) | [M] | Light-Contacts @ 300,60..900; Dark-Contacts @ 300,60..900 |
| sidebar.selection.unfocused | #c7c8c8 (black @ 0.14) | #505153 (white @ 0.17) | [M]/[C] | Light-Applications @ 430,350; Dark-Applications @ 430,350 |
| sidebar.selection.focused (accent blue) | #2f71de (sRGB #136fe6) | #2d74e3 (sRGB #0772eb) | [M] | Light-Disk-Utility @ 600,650; Dark-Disk-Utility @ 600,650 |
| sidebar.selection.inactive-window | #d2d2d2 | #505153 | [M] | Light-Mail @ 250,260; Dark-Mail @ 240,260 |
| sidebar.header.text | #68696a | #a8a9ab | [M] | Light-Applications @ 133,212; Dark-Applications @ 133,212 |
| sidebar.row.text | #343536 | #ffffff | [M] | Light-Applications @ 195,412; Dark-Applications @ 196,412 |
| sidebar.row.text.selected | #141515 | #ffffff | [M] | Light-Applications @ 300,365 |
| sidebar.row.text.inactive-window | #777777 | #a8a9ab | [M] | Light-Mail @ 134,310,71,20; Dark-Mail @ 122,308,71,20 |
| sidebar.icon.tint | #68696a | #a8a9ab | [M] | Light-Applications @ 146,243,40,34 |
| sidebar.row.height / pitch | 24 pt / 26 pt | same | [M] | Light-Applications @ 430,340,1,48 |
| sidebar.header.font | 11 pt Semibold | same | [C] | Light-Applications @ 133,208,1,16 |
| sidebar.row.font | 13 pt Regular | same | [C] | Light-Applications @ 195,408,1,18 |
| sidebar.indent.per-level | 16 pt | same | [M] | Light-Disk-Utility @ 113,394,190,1 |
| sidebar.badge.fill (inactive window) / size | #777777, 24 x 16 pt, r 8 | #a8a9ab | [M] | Light-Mail @ 380,320,48,1; Dark-Mail @ 368,318,48,1 |
| disclosure-triangle.size (outline/sidebar) | 9 x 7.5 pt, #686867 (source list), #7e7e7e (content) | #a8a9ab [C] | [M] | Light-Disk-Utility @ 123,283,18,15 |
| table.row.background | #ffffff | #1e1f21 | [M] | Light-Activity-Monitor @ 540,320; Dark @ 540,250 |
| table.row.background.alternate | #f4f5f5 | #292a2b | [M] | Light-Activity-Monitor @ 540,290; Dark @ 540,290 |
| selection.emphasized (selectedContentBackground, blue accent) | #2466d9 (sRGB #0164e1) | #1f5bc9 (sRGB #0158d0) | [M] | Light-Activity-Monitor @ 540,250; Dark @ 540,470 |
| selection.unemphasized | #dcdcdc | #464646 | [M] | Light-Keychain-Access @ 900,430; Dark @ 900,430 |
| table.row.pitch (standard) / selection height | 18 pt / 17 pt | same | [M] | Light-Activity-Monitor @ 540,236,1,36 |
| table.text | #252525..#272727 | #dddddd | [M] | Light-Activity-Monitor @ 205,281,189,22 |
| table.header.fill | #efefef | #2d2f31 | [M] | Light-Activity-Monitor @ 540,200; Dark @ 540,200 |
| table.header.border | #c6c7c7 | #47494c | [M] | Light-Activity-Monitor @ 540,234; Dark @ 540,234 |
| table.header.separator | #d5d5d5 (1 x 17 pt, 3 pt inset) | #46494b (sRGB #45494b) | [M] | Light-Activity-Monitor @ 594,210; Dark @ 594,210 |
| table.header.height | 23 pt fill + 1 pt border | same | [M] | Light-Activity-Monitor @ 540,188,1,48 |
| table.header.text | 11 pt Regular #161616 | #ffffff | [M]/[C] | Light-Activity-Monitor @ 281,210 |
| table.header.sort-indicator | #909090, 7 x 4 pt chevron, 1.5 pt stroke | #8b8c8e | [M] | Light-Activity-Monitor @ 733,212 |
| separator.split.opaque-panes | #d5d5d5 | #000000 | [M] | Light-Console @ 900,530; Dark-Console @ 900,530 |
| separator.split.beside-sidebar | #cfd0d0 | #000000 | [M] | Light-Finder-Home @ 441,600; Dark-Finder-Home @ 440,600 |
| separator.list-row | #e6e6e6 | #343537 | [M] | Light-Reminders @ 1500,330; Dark-Reminders @ 1500,330 |
| column-view.divider | #e6e6e6 | #000000 | [M] | Light-Finder-Network @ 851,600; Dark @ 786,600 |
| column-view.preview.fill | #f5f5f5 | #252628 | [M] | Light-Finder-Network @ 1100,300; Dark @ 990,300 |
| column-view.arrow | #7f7f7f, 4.5 x 7 pt | #9a9a9b | [M] | Light-Finder-Network @ 836,275 |
| content.background (text/table/icon view) | #ffffff | #1e1f21 (Finder #1e2022, TextEdit #1e1e1e) | [M] | Light-Text-Edit @ 600,600; Dark-TextEdit @ 600,600 |
| content.background.grey-pane | #ececec | #303132 | [M] | Light-Disk-Utility @ 1000,1000; Dark-Disk-Utility @ 1700,400 |
| gallery.selected-thumb.backdrop | #c0c0c0, 54 x 52 pt, r 3 | #565759 | [M] | Light-Finder-Gallery-View @ 1452,1560; Dark @ 1452,1540 |
| gallery.preview-pane.width | 250 pt | same | [M] | Light-Finder-Gallery-View @ 2078,300,2,1 |
| icon-view.label | 12 pt #272627 | #dddddd [C] | [M]/[C] | Light-Applications @ 509,350,111,22 |
| icon-view.pitch (64 pt icons) | 113 x 116 pt | same | [M] | Light-Applications @ 444,190,1820,140 |
| scroller.overlay.knob | black @ 0.50 (#7c7c7c on #fafafa), 7 pt wide, 2 pt inset, round ends | white @ 0.50 [I] | [M]/[C] | Dark-Safari-v13-Picture-in-Picture @ 2834,740,14,1 |
| scroller.track.thickness | 15 pt regular, 11 pt small | same | [D] | HIG scroll-views |
| text.selection.background (blue accent) | #b9d7fb (sRGB #b2d7ff) | #3f638b (sRGB #35638f) [I] | [M] | Light-Contacts @ 1126,344 |
| text.insertion-point | #000000, 1 pt wide | #ffffff | [M] | Light-Stickies @ 160,990,2,1; Dark-Mail @ 998,556,2,1 |
| ruler.fill / rule / border | #f0f0f0 / #b5b5b5 / #d9d9d9 | #2c2e31 / #606164 / #404245 | [M] | Light-Text-Edit @ 400,180 / 400,202 / 400,234; Dark-TextEdit same |
| ruler.height / tick pitch | 32 pt / 9 pt | same | [M] | Light-Text-Edit @ 400,172,1,64 and 112,204,310,1 |
| tag.blue ring / fill | #2973ec (sRGB #0071f4) / #548ff0 (sRGB #438ef8) | #3e8ff7 (sRGB #168eff) / #62a5f8 (sRGB #4da5ff) | [M] | Light-Applications @ 150,953,34,1; Dark-Applications @ 150,1005,34,1 |
| tag.orange ring / fill | #e88f34 (sRGB #f68b00) / #eba55b (sRGB #f6a24a) | #f3ab40 (sRGB #ffa912) / #f6bc65 (sRGB #ffba52) | [M] | y=1057 light, y=1109 dark |
| tag.gray ring / fill | #848488 / #9b9ba0 | #a3a2a7 / #b4b3b7 | [M] | y=1109 light, y=1161 dark |
| tag.green ring / fill | #5dbf4e (sRGB #21c338) / #7bcb6f (sRGB #5ccf62) | #80fa6e (sRGB #3cff55) / #99fb8a (sRGB #72ff7a) | [M] | y=1161 light, y=1213 dark |
| tag.red ring / fill | #e34535 (sRGB #f63126) / #e8685b (sRGB #f95e54) | #ec5d4e (sRGB #ff5044) / #f07b6f (sRGB #ff7369) | [M] | y=1265 light, y=1317 dark |
| tag.none ring / fill | #a2a3a3 / #dbdcdc | #707173 / #3b3c3e | [M] | y=1005 light, y=1057 dark |
| tag.dot.diameter | 12 pt (sidebar), 10 pt (in label) | same | [M] | Light-Applications @ 154,953,24,1; Light-Finder-Home @ 929,652,20,20 |
| empty-state.capsule fill / text | #b3b3b3 / #ffffff, 26 pt high | #515151 / #7c7c7c | [M] | Light-Automator @ 1190,822; Dark-Automator @ 1190,822 |
| bubble.sent (iMessage) | #67b6f4 (sRGB #4bb7fa) -> #62b2f3 (sRGB #44b3f9) | #327fee (sRGB #057df6) -> #317ceb (sRGB #077af3) | [M] | Light-Messages @ 1900,298; Dark-Messages @ 1900,290 |
| bubble.received | #e5e5ea | #555555 | [M] | Light-Messages @ 1332,440; Dark-Messages @ 1344,436 |
| calendar.today / now line | #ec4d3d (sRGB #ff3b30) | #ec4d3d (sRGB #ff3b30)-like (not sampled) | [M] | Light-Calendar @ 1000,1008 |
| calendar.grid.hour-line / day-separator | #e0e0e0 / #e6e5e6 | #404040 / #404040 | [M] | Light-Calendar @ 700,407 and 836,700; Dark same |
| calendar.weekend.fill | #f5f5f5 | #272828 | [M] | Light-Calendar @ 700,700; Dark-Calendar @ 700,700 |
| link.text | #276ad3 (sRGB #0168da) | not sampled | [M] | Light-Finder-Gallery-View @ 2410,448,125,19 |
| scope-bar.selected-pill | #878787 (Dictionary), 16 pt high | #c4c5c7 | [M] | Light-Dictionary @ 300,200; Dark-Dictionary @ 300,200 |
| toolbar.height | 38 pt (title hidden), 55 pt (title + icons), 68-70 pt (icon + label), title bar alone 22 pt | same | [M] | Light-Notes @ 250,76,1,76; Light-Font-Book @ 250,76,1,110; Light-Disk-Utility @ 250,76,1,140; Light-System-Information @ 250,76,1,44 |

## Inferred values
- `sidebar`: small/large row heights (20/32 pt) [I]; hover "Hide/Show" [D behaviour]; disabled and drag-target rendering [I]; material tint recipe [I]; dark triangle colour [C]; footer button offsets [I].
- `sidebar-badge`: key-window, selected and accent-selected pill colours [I] (only an inactive-window pill is captured).
- `table-view`: disabled, editing and drop-target states [I]; default rowHeight/intercellSpacing [D].
- `table-header`: pressed, dragging, inactive states [I].
- `outline-view`: dark triangle colours [C]; dimmed-row text colours [I]; triangle animation [I]; Automator row pitch [C].
- `list-view`: swipe actions [I].
- `column-view`: unemphasized parent-column selection [I]; dragging state [I].
- `icon-view`: every selected-state value (icon backdrop, label pill) [I] because no Finder window shows a selected icon; dark label colour [C]; View Options ranges [D].
- `gallery-view`: accent-focused strip state [I]; dark row separator [I].
- `split-view`: thick (9 pt) and pane-splitter (10 pt) dividers [D] (not shown); pane-splitter appearance [I].
- `scroll-view`: knob over dark content [I]; expanded overlay scroller [I]; the whole legacy always-visible scroll bar [I] with [D] track sizes; timings [I].
- `text-view`: dark and inactive selection colours [I]; blink timing [I].
- `ruler`: dark marker colours [I]; marker-drag behaviour [I].
- `tag-dot`: yellow and purple colours [I]; selected-row and multi-tag rendering [I].
- `empty-state`: plain "No Selection" label style [I].
- `message-bubble`: sending/other states [I]; max width [I].
- `map-controls`: pressed/disabled [I]; label sizes [C]; compass size approximate.
- Blueprints: positions explicitly marked "visual" / "[I]-grade" (Network Utility inner text layout, AirPort Utility artwork positions, Maps place-card layout, Contacts card typography, Reminders "+" button position) were read from the half-scale previews, not sampled.

## Not reproducible in a browser
- Behind-window vibrancy of sidebars (Finder, Mail, Contacts, Messages, Find My): a page cannot blur the desktop. Use the opaque fallbacks above; `backdrop-filter: blur(30px) saturate(180%)` only for in-page content.
- Key vs inactive window recolouring (sidebar material, selections, toolbar faces): needs a window focus/blur class.
- Overlay scroller auto-hide/expand timing and rubber-banding: needs a custom scrollbar component; CSS pseudo-elements only approximate it.
- Notes paper texture, map tiles, wallpapers, app/folder/disk/globe artwork, process icons, photo thumbnails: image assets.
- Messages transcript-wide bubble gradient and bubble tail: `background-attachment: fixed` plus an SVG tail.
- Vibrant text/icon blending on sidebars: use the measured solid colours.

## Open issues
- **AirPort Utility "Light" file is not light**: `10-15-Catalina-Light-Airport-Utility.png` has a dark title bar (#4d4f4f at 1300,78) and looks the same as the Dark file (files differ in bytes). No light rendering exists.
- **Script Editor dark** keeps a white editor (#ffffff at 1480,700) in dark chrome; treat as app behaviour in that capture, not a general dark text-view colour.
- **Scrollers**: only two overlay-knob sightings in the 294 screenshots (found with an automated scan for uniform 5-16 pt vertical bands plus manual checks); no legacy scroll bar and no knob over dark content anywhere. The scan cannot see knobs over busy content, so a missed overlay knob over a photo/map is possible.
- **No selected Finder icon** in any Finder window capture I opened; `icon-view` selection is entirely [I]. If group "system" measured a selected desktop icon (`desktop-icon`), reuse its backdrop and label-pill values.
- **No Finder list view** in the library (the "Applications" screenshots are icon view); multi-column file lists are covered only by Activity Monitor / Keychain tables. Column view IS shown (Finder Network, Open dialogs).
- **Sidebar sizes**: only the medium sidebar icon size appears; all source lists measure 24 pt rows.
- **Window-only captures show a flat sidebar** (#e7e8e8 / #2c2d2f) rather than a wallpaper composite, while full-desktop crops (Contacts, Messages, Mail) show real vibrancy; the tint recipe is therefore a low-confidence fit.
- **Row pitch disagreement**: "18 pt" tables draw a 17 pt selection and leave 1 pt of the stripe at the bottom; Keychain's left lists are 20 pt, Console 21 pt, Automator 19 pt, System Information 16 pt. Documented per app rather than as one token.
- Components of other families whose best examples are in my screenshots: `toolbar-labelled-item` (Console, Disk Utility, Automator), `scope-bar` (Console, Dictionary, Mail Favorites bar), `toolbar` inactive rendering (Mail viewer), `tab-view` (Network Utility: tabs straddling a darker pane #e3e3e3 / #363638), `popover` (Reminders, Calendar, Maps), `focus-ring` (Dictionary and Automator search fields, Keychain dark), `token-field` (Mail To: token #c0d7fc (sRGB #bbd7ff)), `date-picker` graphical (Calendar mini month), `window-tab-bar` (Maps), `combo-box` and vertical `slider` (Font Book), `path-bar` (System Information), `progress-spinner` small (Notes sidebar), `status-bar` (Automator, Script Editor bottom bars), `box` (Network Utility, Activity Monitor footer, Disk Utility table), `contextual-menu` and `menu` (Contacts).
- A monogram **avatar** disc (Mail viewer 34.5 pt, Contacts 60 pt, Messages 45 pt, Find My 30 pt) recurs across apps and has no seed id; I described it in the blueprints only. Suggest an `avatar` component (family apps or views).

## Deviations from the assignment
- `calendar-week-grid` is specified in the Calendar blueprint, not as a separate component file (app-only element).
- Toolbar item positions are given as measured x-extents on one pixel row per app; the controls themselves are left to group chrome as instructed.
- Mail (dark) toolbar positions and several dark-only secondary colours were not re-sampled; they are marked "not sampled" in place.
- Helper scripts (segment/bbox/scan helpers) were written to the scratch directory `<scratch>/views/`, outside the workspace; nothing outside `reference/spec/` was changed in the workspace.

## Concerns
- Cited single pixels can differ by +-1 per channel from the stated modal colour because the captures are dithered (for example Dark-Activity-Monitor @ 540,470 reads #1f5ac9 (sRGB #0357d0) against the stated #1f5bc9 (sRGB #0158d0)). A re-sampling check should allow +-2.
- Font sizes are [C] from cap heights and line boxes; weights are judged from stem widths and are the least certain part (sidebar header Semibold, Notes/Calendar/Photos/Reminders large titles).
- Geometry in blueprints flagged "visual" was not pixel-sampled.

## Discoveries that affect other work
- Emphasized selection is #2466d9 (sRGB #0164e1) light / #1f5bc9 (sRGB #0158d0) dark (stored) in tables, outlines and column view, but accent-selected source-list rows are a different blue (#2f71de (sRGB #136fe6) / #2d74e3 (sRGB #0772eb)) because they blend with the sidebar material.
- In inactive windows the light sidebar becomes opaque #f6f6f6 and all sidebar text dims to #777777; the dark sidebar does not change colour.
- Dark-mode pane dividers are pure black #000000 (Photos is the exception, #404143); the dark window has a 1 pt lighter inner edge (#565759) on its leading side.
- The HIG pages for my components were read from the shared scratch cache (`.../hig/*.txt`, snapshots of 3-4 May 2020, URLs cited in each file).

## Assumptions made in place of questions
- "Viewed" for the 40 assigned files means the half-scale preview was opened; extra Finder/TextEdit/Stickies files used as component evidence were also opened, three were only pixel-sampled (listed under Counts).
- Where two captures disagreed by one stored level, the more frequent value was reported and the variants listed.
- App-specific artwork and typography were described rather than measured when they are assets (globe, map, photos).

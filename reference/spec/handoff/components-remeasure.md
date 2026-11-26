# Component remeasurement handoff

Outcome: 72 existing lines in 51 component specifications changed. Original PNG pixels were sampled with measure.py and Pillow, with stored-to-sRGB conversion through each screenshot's embedded ICC profile. No screenshots, app blueprints, tokens, inventory, README, tools or library code were edited. Drawer is unchanged. No mocks, stubs or synthetic screenshots were used.

## Changed-line table

Paths below are relative to reference/spec/components/. Line numbers are final specification line numbers. Old wording quotes the measurement gap or estimate, not the entire unchanged row. The table records the replacement; full measurement method and all input citations remain on each specification line.

| File:line | Element | Old wording | New value / wording | Citation |
|---|---|---|---|---|
| account-header.md:27 | Inactive account header | "no; inactive image/title tint not measured" | [M] visible in Mission Control, full-colour avatar; name #242424 on #ececec | 10-15-Catalina-Light-Mission-Control.png @ 2210,950,305,42; 10-15-Catalina-Light-Mission-Control.png @ 2064,930,130,132 |
| bevel-button.md:41 | Print orientation artwork | "about 18 x 25; not measured as a box" | [M] 27.5 x 25 pt, ink/soft-edge box x=1011..1065,y=596..645; >10-level difference from row fill | 10-15-Catalina-Light-Print.png @ 1005,585,67,70 |
| box.md:48 | Dark titled box | "not measured" | [M] fill #3c3c3e, top/sides #545456 then #474748 | 10-15-Catalina-Dark-Network-Utility.png @ 172,500,6,1; 10-15-Catalina-Dark-Network-Utility.png @ 400,370,1,3 |
| box.md:54 | Dark box title | "white @ 0.85; dark title not measured" | [M] #e0e0e1 on #363638; [C] white @ 0.846 | 10-15-Catalina-Dark-Network-Utility.png @ 180,340,300,32 |
| card-grid.md:139 | Dark Books cover shadow | "not measured" | [M] bottom #18191b to page #1e2022 by 4 pt; right #191b1d to page by 3 pt | 10-15-Catalina-Dark-Books.png @ 800,624,1,8; 10-15-Catalina-Dark-Books.png @ 947,500,6,1 |
| catalyst-chrome.md:140 | UIKit control completeness values | "not measured" | [I] retained; not shown: Home, News, Stocks and Podcasts contain no UIKit switch/slider/stepper/iOS segmented controls | No visible instance; explicit absence reason |
| color-swatch-picker.md:30 | Inactive swatches | "inactive tint not measured" | [I] retained; not shown: General and Theme captures show active preferences windows | No inactive group; explicit absence reason |
| color-well.md:65 | Format-bar well gaps | "10 pt gaps; not measured" | [C] 7 pt blank gaps, x=637..650 and 745..758; form-layout 8 pt remains [I], not shown | 10-15-Catalina-Light-Text-Edit.png @ 628,146,36,1; 10-15-Catalina-Light-Text-Edit.png @ 732,146,36,1 |
| dictation.md:62 | Done weight | "[I] weight judged from the preview" | [C] 12 pt Bold from 17 px cap and 3-4 px stems | 10-15-Catalina-Light-Dictation.png @ 107,274,60,17; 10-15-Catalina-Light-Dictation.png @ 130,282,18,1 |
| dock-stack.md:49 | Fan rotation | "about 1 to about 15 degrees; upper items not measured" | [C] bottom 1.6 degrees (5/180 px slope); upper photo 12.9 degrees (16/70 px slope) | 10-15-Catalina-Dark-Stacks.png @ 2600,1817,1,4; 10-15-Catalina-Dark-Stacks.png @ 2780,1822,1,4; 10-15-Catalina-Dark-Stacks.png @ 2980,630,1,50; 10-15-Catalina-Dark-Stacks.png @ 3050,630,1,50 |
| gallery-view.md:61 | Dark row separator | "not sampled; [I] #343638" | [M] #343638 | 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2400,528 |
| gallery-view.md:62 | Dark info label/value/link | "not sampled" | [M] #9a9a9b / #dddddd / #589cf8 (sRGB #429bff) | 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2196,500,90,19; 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2300,500,320,23; 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2486,448,130,22 |
| gallery-view.md:63 | Dark Add Tags placeholder | "not sampled" | [M] #565759 | 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2196,784,130,23 |
| gallery-view.md:64 | Dark Quick Action glyph/label | "not sampled" | [M] #9a9b9c / #98989d | 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2238,1510,32,32; 10-15-Catalina-Dark-Finder-Gallery-View.png @ 2196,1560,132,20 |
| gallery-view.md:79 | Preview margins | "at least about 27 pt margin" | [C] captured left/right margins 32 pt; no unsupported minimum-margin rule | 10-15-Catalina-Light-Finder-Gallery-View.png @ 442,455,1636,1 |
| gradient-button.md:28 | Network action glyph | "not measured here" | [M] gear 13 x 13 pt; chevron 7 x 4.5 pt | 10-15-Catalina-Light-System-Preferences-Network.png @ 256,1040,29,30; 10-15-Catalina-Light-System-Preferences-Network.png @ 286,1047,18,17 |
| hud-window.md:115 | Titled HUD completeness values | "not measured here" | [I] retained; not shown: captured QuickTime HUD is borderless, not a titled NSPanel HUD | No titled panel; explicit absence reason |
| icon-view.md:52 | Dark green label dot | "not sampled" | [M] #80db7c (sRGB #5adf70), flat/no ring | 10-15-Catalina-Dark-Finder-Home.png @ 1063,662 |
| image-well.md:57 | Picture name and pop-up placement | "top-aligned; not measured here" | [M] name starts 521,288, 12 pt below well top; pop-up 169 x 20 pt at 521,331; [C] 17 pt blank horizontal gap | 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 500,270,180,52; 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 510,350,361,1; 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver.png @ 700,325,1,54 |
| launchpad-folder.md:38 | Closed folder tile | "about 100 x 100; radius about 18; 22 pt icons/27 pt pitch from preview" | [M] 108 x 108 pt, radius 18; ColorSync 23.5 x 24.5 and Terminal 23 x 20 pt artwork; [C] 30 pt slot pitch | 10-15-Catalina-Light-Launchpad.png @ 2735,1200,226,1; 10-15-Catalina-Light-Launchpad.png @ 2740,1148,37,37; 10-15-Catalina-Light-Launchpad.png @ 2850,1170,1,111; 10-15-Catalina-Light-Launchpad.png @ 2764,1170,55,57; 10-15-Catalina-Light-Launchpad.png @ 2824,1233,54,48 |
| launchpad.md:66 | Label shadow | "about 0 1px 3px black @ 0.5; not measured" | [C] local composite fit: light 0 1px 2.5px black @ 0.20, dark 0 1px 2px black @ 0.20; [M] halo composites; fit RMS 0.335/0.326 stored levels | 10-15-Catalina-Light-Launchpad.png @ 1256,1044,70,40; 10-15-Catalina-Dark-Launchpad.png @ 1256,1044,70,40 |
| list-view.md:81 | Dark Mail snippet | "not sampled" | [M] #a6a7a7, only top of inactive list glyphs visible above compose window | 10-15-Catalina-Dark-Mail.png @ 490,313,420,8 |
| login-window.md:44 | Password-field radius | "about 4 from preview" | [M] 6.5 pt (13 px to full left edge) | 10-15-Catalina-Light-Fast-User-Switching.png @ 1520,1022,16,16 |
| map-controls.md:50 | Dark map-button edge | "not sampled" | [M] top #858687, bottom #242628 | 10-15-Catalina-Dark-Maps.png @ 2000,1388; 10-15-Catalina-Dark-Maps.png @ 2000,1426 |
| map-controls.md:51 | Dark zoom divider | "not sampled" | [M] #292a2c | 10-15-Catalina-Dark-Maps.png @ 2028,1406 |
| map-controls.md:59 | Map labels and compass 3D | "11 pt Medium black/white; 13 pt grey; not measured to the pixel" | [C] Map 11 pt (15 px cap), 3D 14 pt (20 px full cap/22 px AA box); [M] Map black light/#f2f2f3 dark, 3D #262626 light | 10-15-Catalina-Light-Find-My.png @ 723,1463,40,20; 10-15-Catalina-Dark-Find-My.png @ 679,1439,40,20; 10-15-Catalina-Light-Maps.png @ 2010,1328,46,27; 10-15-Catalina-Light-Maps.png @ 2030,1327,15,27 |
| message-bubble.md:49 | Dark status/header colour | "not sampled" | [M] #8f8f93 | 10-15-Catalina-Dark-Messages.png @ 1570,232,160,20; 10-15-Catalina-Dark-Messages.png @ 1650,258,212,20; 10-15-Catalina-Dark-Messages.png @ 2090,380,106,20 |
| message-bubble.md:55 | Header/status type evidence | "visual; rows at 244..284 and y~392" | [C] 11 pt from 16 px cap; first-line Semibold from 3 px stem; Delivered ink rows 389..405 | 10-15-Catalina-Light-Messages.png @ 1560,238,320,54; 10-15-Catalina-Light-Messages.png @ 1663,266,12,24; 10-15-Catalina-Light-Messages.png @ 2080,384,120,33 |
| mission-control.md:49 | Window thumbnails | "about Maps 36..1991 x 372..1720; Preferences 2016..3322 x 818..1900, half-scale preview" | [M] Maps x36..1991/y372..1721 = 978 x 675 pt; Preferences x2016..3323/y816..1899 = 654 x 542 pt; [D] scaling rule retained | 10-15-Catalina-Light-Mission-Control.png @ 30,1000,3300,1; 10-15-Catalina-Light-Mission-Control.png @ 1300,365,1,15; 10-15-Catalina-Light-Mission-Control.png @ 1300,1714,1,15; 10-15-Catalina-Light-Mission-Control.png @ 2200,810,1,18; 10-15-Catalina-Light-Mission-Control.png @ 2200,1894,1,15 |
| new-item-dot.md:40 | Dark new-item dot | "not captured; same blue suggested, not measured" | [I] retained; not shown: dark Extensions has a different list and no indicator | 10-15-Catalina-Dark-System-Preferences-Extensions.png @ 670,892 (background, not a dot; reason on spec line) |
| notification-center.md:52 | Footer gear | "about 14 pt; centre 11 pt from right; preview" | [M] 18 x 18 pt ink; [C] centre 22.25 pt from screen right and bottom | 10-15-Catalina-Light-Notification-Center-Today.png @ 3290,2030,50,50 |
| outline-view.md:57 | Dimmed Font Book labels | "not sampled separately; inferred #b0b0b0/#5f5f60" | [M] light #c0c0c0 / dark #565658 | 10-15-Catalina-Light-Font-Book.png @ 556,210,310,23; 10-15-Catalina-Dark-Font-Book.png @ 556,210,310,23 |
| path-bar.md:50 | Populated path-bar metrics | "[I], not measured" | [I] retained; not shown: captured path bars are empty, so no text/icons/chevrons can be measured | No populated bar; explicit absence reason |
| picture-in-picture.md:37 | Source-player glyph/gap | "about 108 x 84, caption 13 below; preview scale" | [M] 115 x 90 pt (x1029..1258,y713..892); [C] 13 pt gap to caption y919 | 10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 1000,700,320,210; 10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 670,912,950,40 |
| picture-in-picture.md:43 | Source glyph/caption colour | "about #8c8c8c; not sampled" | [M] #a4a4a4 | 10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 1020,710,270,190; 10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 898,919,491,26 |
| picture-in-picture.md:47 | Caption size | "not measured here [I]" | [C] 15 pt from 21 px capital height (919..939); hover glyph sizes remain [I], not seen | 10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 898,912,50,35 |
| progress-spinner.md:65 | Notes spinner placement | "position not measured here" | [M] ink x215..246,y166..197; centre 230.5,181.5; [C] 9 pt gap after iCloud, aligned to heading ink centre | 10-15-Catalina-Light-Notes.png @ 196,182,53,1; 10-15-Catalina-Light-Notes.png @ 210,164,39,36 |
| pull-down-button.md:31 | Action segment normal state | "yes light; Network/Get Info not measured" | [M] light and dark Connect to Server examples with measured glyphs below | 10-15-Catalina-Light-Finder-Connect-to-Server.png @ 266,456,84,43; 10-15-Catalina-Dark-Finder-Conect-to-Server.png @ 266,456,84,43 |
| pull-down-button.md:88 | Dark action gear/chevron | "not measured in dark" | [M] #e8e8e8 | 10-15-Catalina-Dark-Finder-Conect-to-Server.png @ 282,462,28,28; 10-15-Catalina-Dark-Finder-Conect-to-Server.png @ 318,473,14,9 |
| pull-down-button.md:89 | Dark disabled borderless title/chevron | "not measured" | [M] #696969 on #353637 | 10-15-Catalina-Dark-System-Preferences-Mouse.png @ 243,406,213,22 |
| round-button.md:11 | Stop Progress reference | "viewed but owned by sysB and not measured" | [M] 14 pt disc x1345..1372,y346..373; still classified as progress-bar family, not Round Button | 10-15-Catalina-Light-System-Preferences-Time-Machine.png @ 1340,360,39,1; 10-15-Catalina-Light-System-Preferences-Time-Machine.png @ 1358,340,1,41 |
| ruler.md:61 | Dark tab/tail marker colours | "lighter grey, not sampled; [I] #a0a0a0" | [M] tab body #a0a1a2, tail body #a0a0a2, tail highlight/ink maximum #b3b4b5 | 10-15-Catalina-Dark-TextEdit.png @ 268,190; 10-15-Catalina-Dark-TextEdit.png @ 1295,195; 10-15-Catalina-Dark-TextEdit.png @ 1288,190,17,12 |
| ruler.md:62 | Dark first-line/head indent | "not sampled" | [M] bar #a0a0a2, triangle #d4d5d5 | 10-15-Catalina-Dark-TextEdit.png @ 122,184; 10-15-Catalina-Dark-TextEdit.png @ 122,195 |
| scope-bar.md:57 | Dark Preview selected pill/text | "on pill not sampled; use Finder #b6b7ba" | [M] pill composite #c6c7c8, selected text #404244; existing off text retained | 10-15-Catalina-Dark-Preview-Search.png @ 445,216; 10-15-Catalina-Dark-Preview-Search.png @ 464,207,140,25 |
| segmented-control.md:63 | Dark mini Print segments | "not measured" | [M] fill #667184 (sRGB #647186); top #2b3e53 (sRGB #263e55), highlight #858c9c (sRGB #848c9e); bottom #2a3347 (sRGB #283349); divider #545e6b (sRGB #525e6c) | 10-15-Catalina-Dark-Print.png @ 202,845; 10-15-Catalina-Dark-Print.png @ 202,839; 10-15-Catalina-Dark-Print.png @ 202,840; 10-15-Catalina-Dark-Print.png @ 202,866; 10-15-Catalina-Dark-Print.png @ 259,842 |
| share-menu.md:31 | Share/menu leading alignment | "within 1 pt from preview" | [M] bezel leading edge 2284/menu edge 2285; [C] 0.5 pt inset | 10-15-Catalina-Light-Safari-v13-Sharing.png @ 2500,96,1,17; 10-15-Catalina-Light-Safari-v13-Sharing.png @ 2278,300,17,1; 10-15-Catalina-Light-Safari-v13-Sharing.png @ 2278,64,18,1 |
| siri.md:46 | Card corner radius | "about 6 from preview" | [M] 6.5 pt, top y94 to full straight edge y107 | 10-15-Catalina-Light-Siri.png @ 62,94,16,16 |
| smart-search-field.md:42 | Reader on width | "28 pt width from preview, exact px [I]" | [M] 28 pt fill width, x901..956 | 10-15-Catalina-Light-Safari-v13-Reader-Mode.png @ 895,114,73,1 |
| smart-search-field.md:50 | Dark Reader/Reload glyphs | "lighter grey, not sampled; inferred #b0b0b0" | [M] Reader #e9eaea / Reload #e9e9ea | 10-15-Catalina-Dark-Safari-v13.png @ 873,102,30,24; 10-15-Catalina-Dark-Safari-v13.png @ 1834,98,26,30 |
| smart-search-field.md:61 | Split Screen field width | "348 pt, x1920..2617 from preview [I]" | [M] 373 pt fill, x2059..2804, in 928 pt tile | 10-15-Catalina-Light-Split-Screen-Apps.png @ 2054,36,757,1 |
| spotlight.md:85 | Preview body pitch | "16 pt pitch read from half-scale preview" | [C] 17 pt from 34 px pitch, rows682..706/716..740/750..774; existing 12 pt size retained | 10-15-Catalina-Light-Spotlight.png @ 1668,640,512,162 |
| sticky-note.md:76 | Uncaptured body palette | "remembered; not measured" | [I] retained; not shown: captured bodies are yellow or blue, not Green/Pink/Purple/Gray | No matching body colours; explicit absence reason |
| switch.md:56 | Card right inset | "about 10 pt; edge not sampled" | [C] 10 pt from track last pixel3317 to card edge3337 | 10-15-Catalina-Light-Notification-Center-Today.png @ 3230,207,112,1 |
| table-header.md:65 | Dark Console separator | "not sampled" | [M] #494949 | 10-15-Catalina-Dark-Console.png @ 578,268 |
| table-view.md:77 | Activity Monitor footer values | "red/blue; [M] not sampled" | [M] System #ec4d3d (sRGB #ff3b30), User #4facf2 (sRGB #1dadf8), same in light/dark | 10-15-Catalina-Light-Activity-Monitor.png @ 676,1148,76,27; 10-15-Catalina-Light-Activity-Monitor.png @ 676,1190,76,27; 10-15-Catalina-Dark-Activity-Monitor.png @ 676,1148,76,27; 10-15-Catalina-Dark-Activity-Monitor.png @ 676,1190,76,27 |
| tag-dot.md:50 | Dark green label dot | "not sampled" | [M] #80db7c (sRGB #5adf70) | 10-15-Catalina-Dark-Finder-Home.png @ 1063,662 |
| text-field.md:57 | Insertion point | "visible at preview scale but not resolved in sampled pixels" | [M] 1 x 16 pt, x378..379/y162..193 light #000000, x372..373 dark #ffffff; blink timing remains [I], not shown in stills | 10-15-Catalina-Light-Finder-Connect-to-Server.png @ 378,162,2,32; 10-15-Catalina-Dark-Finder-Conect-to-Server.png @ 372,162,2,32 |
| text-view.md:59 | Dark Mail address token | "blue token, not sampled" | [M] fill #253d60 (sRGB #1e3d63), text #dee1e7 (sRGB #dde1e8) | 10-15-Catalina-Dark-Mail.png @ 614,428; 10-15-Catalina-Dark-Mail.png @ 614,410,215,34 |
| time-machine-browser.md:39 | Cancel/Restore edges and gap | "about 94 x 29; right edge/gap from preview [I]" | [M] 94 x 29 pt each, x1448..1635 and1712..1899; [C] 38 pt gap; already-measured top/bottom unchanged | 10-15-Catalina-Light-Time-Machine.png @ 1440,1842,476,1; 10-15-Catalina-Light-Time-Machine.png @ 1470,1802,1,80 |
| time-machine-browser.md:41 | Down-arrow offset | "67 pt lower from preview [I]" | [C] 72 pt lower, faces start y1060 and1204; prior measured up size/extents retained | 10-15-Catalina-Light-Time-Machine.png @ 2696,1050,1,251 |
| time-machine-browser.md:43 | Timeline tick lengths | "about 15/35 pt from preview [I]" | [M] short16 pt x3328..3359; labelled36 pt x3288..3359; measured thickness/pitch unchanged | 10-15-Catalina-Light-Time-Machine.png @ 3260,1799,100,1; 10-15-Catalina-Light-Time-Machine.png @ 3260,1767,100,1 |
| today-widget.md:48 | Stocks pitch | "35; pitch from preview; approximate centres" | [C] 35 pt from exact70 px pitch; dark stem rows1507..1523 then1577..1593 etc. | 10-15-Catalina-Light-Notification-Center-Today.png @ 2730,1490,74,330 |
| today-widget.md:54 | Summary pitch/weather artwork | "14 pt pitch; 16 pt glyph at x8 from preview [I]" | [C] 15 pt pitch; [M] weather23 x18 pt ink x2705..2750/y638..673; [C] left inset16.5 pt from panel | 10-15-Catalina-Light-Notification-Center-Today.png @ 2764,632,495,82; 10-15-Catalina-Light-Notification-Center-Today.png @ 2698,630,62,47 |
| today-widget.md:70 | Calendar event bar | "1 pt purple at x about2850, dark pink-purple; preview [I]" | [M] 2 pt x2850..2853; light #7d3ebf (sRGB #8832c6), dark #e4b0ff (sRGB #eeabff) | 10-15-Catalina-Light-Notification-Center-Today.png @ 2840,1056,20,1; 10-15-Catalina-Dark-Notification-Center-Today.png @ 2840,1056,20,1 |
| today-widget.md:81 | Switch size/inset | "38 x22 class, inset about9; not measured [I]" | [M] 38 x21 pt track, x3242..3317/y187..228; [C] right inset10 pt | 10-15-Catalina-Light-Notification-Center-Today.png @ 3230,206,112,1; 10-15-Catalina-Light-Notification-Center-Today.png @ 3300,180,1,60 |
| toolbar-search-field.md:61 | Criterion/value token type | "10 pt Semibold /12-13 pt; not measured [I]" | [C] criterion9 pt Semibold from13 px cap/3 px stems; value13 pt from19 px cap including AA | 10-15-Catalina-Dark-Finder-Search.png @ 1420,130,40,38; 10-15-Catalina-Dark-Finder-Search.png @ 1510,130,34,38 |
| toolbar-segmented-control.md:19 | Text content evidence | "Calendar/Maps not measured in this file" | [M] Calendar text now measured below; examples retained | 10-15-Catalina-Light-Calendar.png @ 1120,101,30,32 (measurements on line56) |
| toolbar-segmented-control.md:56 | Calendar text size/colours | "13 pt Regular, exact values [I]; not measured" | [C] 13 pt Regular,19 px W cap; [M] light normal#555555/selected#ffffff, dark normal#ffffff/selected#3a3b3d | 10-15-Catalina-Light-Calendar.png @ 1120,101,30,32; 10-15-Catalina-Light-Calendar.png @ 1000,101,80,30; 10-15-Catalina-Light-Calendar.png @ 1110,101,100,30; 10-15-Catalina-Dark-Calendar.png @ 1000,101,80,30; 10-15-Catalina-Dark-Calendar.png @ 1120,102,100,30 |
| waveform-view.md:105 | Keyboard seeking step | "implementation choice, not measured [I]" | [I] retained; not shown: static Voice Memos captures show no keyboard-seeking interaction or temporal step | No temporal sequence; explicit absence reason |
| web-view.md:41 | Reader canvas/sheet | "#e7e7e7-like light, #2f2f2f-like dark, sheet#4a4a4c; values not sampled [I]" | [M] light#e6e6e6/#ffffff, dark#323233/#4a4a4d | 10-15-Catalina-Light-Safari-v13-Reader-Mode.png @ 300,300; 10-15-Catalina-Light-Safari-v13-Reader-Mode.png @ 700,300; 10-15-Catalina-Dark-Safari-v13-Reader-Mode.png @ 300,300; 10-15-Catalina-Dark-Safari-v13-Reader-Mode.png @ 700,300 |
| window-banner.md:40 | Dark banner text | "#a7a8ab-like secondary; not sampled [I]" | [M] #a7aaac (sRGB #a6aaac) | 10-15-Catalina-Dark-Finder-Home.png @ 462,244,400,30 |
| window-shadow.md:27 | Sheet shadow state | "no (not measured here)" | [M] yes, Print; falloff #cfcfcf at first px, #dfdfdf at+8px, #efeeee at+18px, #f7f7f7 at+28px | 10-15-Catalina-Light-Print.png @ 700,1043; 10-15-Catalina-Light-Print.png @ 700,1050; 10-15-Catalina-Light-Print.png @ 700,1060; 10-15-Catalina-Light-Print.png @ 700,1070 |

## Items retained as inferred or documented

These are the remaining inferred portions of the corrected lines, not an inventory of every inference elsewhere in the specification. No targeted gap was left [D] solely because it was unsampled.

- catalyst-chrome.md:140: UIKit completeness controls remain [I]. Not shown: the Home, News, Stocks and Podcasts screenshots contain no UIKit switch, slider, stepper or iOS segmented control.
- color-swatch-picker.md:30: inactive tint remains [I]. Not shown: General and Theme captures show the active preferences window, not an inactive swatch group.
- color-well.md:65: the 8 pt form-label gap remains [I]. Not shown: no standard form-layout colour well is captured; only the TextEdit format-bar wells were measurable.
- hud-window.md:115: titled NSPanel HUD values remain [I]. Not shown: the QuickTime capture contains a borderless playback controller, not a titled HUD panel.
- new-item-dot.md:40: dark fill remains [I]. Not shown: the dark Extensions capture has a different extension list and no new-item indicator; its absence does not establish suppression in Dark Mode.
- path-bar.md:50: populated-bar text/icon/chevron metrics remain [I]. Not shown: captured Finder path bars are empty.
- picture-in-picture.md:47: native hover-overlay glyph/hit sizes remain [I]. Not shown: neither PiP screenshot shows the hover controls. The visible source-player caption is now measured/computed.
- sticky-note.md:76: Green/Pink/Purple/Gray body colours remain [I]. Not shown: the Stickies captures contain yellow and blue bodies only.
- text-field.md:57: blink timing remains [I]. Not shown: static PNGs contain no blinking time sequence. Caret position, size and colour are measured in both appearances.
- waveform-view.md:105: keyboard-seeking step remains [I]. Not shown: static Voice Memos captures contain no keyboard-seeking interaction or temporal increment measurement.

## Verification

Commands ran from the workspace root with the supplied Python environment. Both exited 0.

`python3 reference/spec/tools/build.py check`

    0 problem(s); 0 untagged measurement rows

`python3 reference/spec/tools/build.py audit -v`

    {"citations": 2638, "out_of_bounds": 0, "missing_file": 0, "pixel_checked": 643, "pixel_ok": 643, "rect_checked": 527, "rect_ok": 510}
     - components/material.md:39 10-15-Catalina-Dark-Contacts.png @ 1156,478,1,38: none of the line's colours occur
     - components/menu.md:72 10-15-Catalina-Dark-Contacts.png @ 1156,433,1,2: none of the line's colours occur
     - components/desktop-stack.md:43 10-15-Catalina-Dark-Desktop-Stacks.png @ 3170,755,114,92: none of the line's colours occur
     - components/menu-bar.md:44 10-15-Catalina-Dark-Desktop.png @ 600,0,1,46: none of the line's colours occur
     - components/sidebar.md:56 10-15-Catalina-Dark-Notes.png @ 480,202,1,48: none of the line's colours occur
     - apps/system-preferences-energy-saver.md:77 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 464,445,868,1: none of the line's colours occur
     - apps/activity-monitor.md:35 10-15-Catalina-Light-Activity-Monitor.png @ 1000,1182,1,2: none of the line's colours occur
     - components/desktop-stack.md:43 10-15-Catalina-Light-Desktop-Stacks.png @ 3170,755,114,92: none of the line's colours occur
     - components/menu-bar.md:100 10-15-Catalina-Light-Desktop.png @ 42,4,25,31: none of the line's colours occur
     - components/sidebar.md:56 10-15-Catalina-Light-Disk-Utility.png @ 600,636,1,48: none of the line's colours occur
     - apps/finder.md:132 10-15-Catalina-Light-Finder-Network.png @ 430,600,971,1: none of the line's colours occur
     - components/toolbar-segmented-control.md:49 10-15-Catalina-Light-Finder-Network.png @ 462,125,1,47: none of the line's colours occur
     - apps/font-book.md:36 10-15-Catalina-Light-Font-Book.png @ 1940,220,206,1: none of the line's colours occur
     - components/launchpad-folder.md:46 10-15-Catalina-Light-Launchpad-Folder.png @ 100,480,16,16: none of the line's colours occur
     - apps/spotlight.md:28 10-15-Catalina-Light-Spotlight.png @ 1634,602,142,34: none of the line's colours occur
     - apps/system-preferences-dock.md:75 10-15-Catalina-Light-System-Preferences-Dock.png @ 659,230,2,8: none of the line's colours occur
     - apps/system-preferences-energy-saver.md:77 10-15-Catalina-Light-System-Preferences-Energy-Saver.png @ 478,442,2,8: none of the line's colours occur

All 17 rectangle warnings are on unchanged lines; none is on one of the 72 edited lines. No out-of-bounds or missing-file citation remains. The audit uses its existing +/-3 stored-channel tolerance; it is not an exact-byte assertion.

The supplied case-insensitive grep over components/*.md leaves only drawer.md:37 (the explicit excluded file). Every non-excluded match was removed by adding a measurement or an explicit absence reason.

A comparison against the initial scratch snapshot also checked table completeness and Drawer preservation:

    Changed-line table: 72 rows; 72 changed lines; 51 files
    Missing: []
    Extra: []
    Drawer unchanged: True

## Acceptance criteria

- Completed: every originally listed target line measured/re-cited or given a precise absence reason; no targeted preview estimate or bare unsampled gap remains.
- Completed: structural check reports 0 problems and 0 untagged measurement rows.
- Completed: citation audit ran; edited lines have no colour mismatch or out-of-bounds citation.
- Completed: small existing-line edits only, all under components/; supplied measurement tools and original pixels used; no Drawer edits or library publication.
- Completed: this file contains a 72-row line-by-line table, all retained-inference reasons, and the command output.
- Remaining outside scope: the 17 unchanged global audit warnings and the excluded Drawer grep match.

## Deviations

The assignment's all-components grep exposed four additional defects beyond its explicit filename list: color-swatch-picker.md:30, gradient-button.md:28, table-view.md:77 and round-button.md:11. Only those matching lines were corrected, to satisfy the all-components grep requirement. This text handoff was added under components/ so that no new .md component or out-of-scope deliverable path was introduced. Measurement helper scripts and temporary output stayed in the supplied scratch directory; measure.py produced its normal .scratch orientation crops.

## Concerns

The global audit is not wholly clean: the 17 warnings above are unchanged and were not repaired because they are outside this remeasurement assignment. The excluded Drawer line still contains its original bare "not sampled" wording. No requested correction depends on a mocked service or replacement reference asset.

## Discoveries affecting other work

Several inferred numbers were materially different from the original pixels: closed Launchpad tile108 x108 rather than about100 x100 pt, PiP glyph115 x90 rather than108 x84 pt, login/Siri radius6.5 pt, Split Screen field373 rather than348 pt, Spotlight pitch17 rather than16 pt, Today summary pitch15 rather than14 pt, event bar2 rather than1 pt, and footer gear18 rather than14 pt. Dark ruler tail-indent geometry is at x1288..1304, not the light screenshot's x1342..1358. The manifest's dark Connect to Server filename deliberately contains "Conect" with one n; that exact filename is used in citations.

## Assumptions made instead of questions

Font sizes and weights are computed from measured cap/stem pixels, not identified from a font file or private AppKit API. Soft artwork bounds use a stated stored-channel contrast threshold against the row backdrop; the threshold is on the spec line. The Launchpad shadow is a local Gaussian composite fit against an interpolated backdrop, with a measured white-ink mask: it is not a unique recovery of Apple's native recipe. Mission Control is evidence of the inactive account-header snapshot, not an executed activation transition. Gallery's captured margins are documented without asserting a global minimum from a single image.

## Re-measured on 2 October 2026 after build feedback

These rows are separate from the 72 above. Build threads compared built components with the same screenshots and reported values that did not fit; each was re-measured here on the original pixels. Radii were fitted with `tools/corner_fit.py` (added the same day), which reproduces the earlier push-button fit: 3.75 pt on the border and 4.25 pt on the halo for `10-15-Catalina-Light-Finder-Go-To-Folder.png`. The builders' figures in the last column are theirs, from their own rendered comparisons, and were not re-run here.

| File | Element | Old value | New value | Why the old value was wrong | Builder's report |
|---|---|---|---|---|---|
| toolbar-segmented-control.md | Separated style (Preview zoom pair) | [M] 38 and 36 wide, 3 pt gap | [M] fills 39 and 37 wide, bezels touch: 1 pt between fills (light: two side borders, so the outer bezels are 40 and 38; dark: the bar, no side borders) | read on y=128, a corner row, where each bezel's rounded corners draw the fills back; mid-height is y=150 | window-chrome batch: fills end at 293 and start at 296; a 1px gap scores 0.22% / 0.33% masked mismatch against 5.07% / 3.84% with 3px |
| box.md | Corner radius | [M] 2.5 | [C] fits: light 3.875, dark 4, all four corners. 4 to build with is [C] in dark and [I] in light (rounded) since 3 October 2026; this row gave "[C] 4" | the last blended pixel of the arc was taken for the straight edge | indicators-and-containers batch: no differing pixel at 4px in four 2x corner comparisons, about 0.25% at the token's 2.5px |
| level-indicator.md | Disk Utility bar corner radius | [M] 3.5 | [C] fits: 4.75 to 5.125 over eight corners, by end and appearance. 5 to build with is [I] (rounded) since 3 October 2026; this row gave "[C] 5" | same misreading | indicators-and-containers batch: built 4.5px, the best of the radii it rendered at the used end; at the empty end its light comparison is lowest at 5px |
| tab-view.md | Tab strip corner radius | [M] 3 | [C] 3.5 (fit; 3.5 to 3.75 supported) | same misreading | none; found while re-fitting the box in the same capture |
| tokens-core.txt | `--mac-radius-group` | 2.5px [M] | 4px, [C] in dark and [I] in light since 3 October 2026 (the light fit is 3.875); this row gave "4px [C]" | follows box.md | the token layer held 2.5px, adopted from the old row, until pull request #12 set 4px (commit `1e61ce54`, merged as `f7bf6ac1`) |
| tokens-core.txt | `--mac-radius-control-mini` | 3px [I] | 2.5px [I], the token layer's provisional value | not a measurement error: no screenshot shows a mini bezel, both figures are inferred, and the sheet now follows the value that is built | buttons batch: its mini pixel checks read only fill and edge pixels and cannot tell 2.5px from 3.5px |

Not re-measured in this round: every other corner radius in the specs. A second round the same day fitted sixteen more (see "Second round of radius fits" below); those still tagged [M] without rms figures are grid readings of the kind that proved wrong above.

### Fitting inputs

The exact invocations behind the fitted radii above, run from the repository root with `F="python3 reference/spec/tools/corner_fit.py"`. The corner pixel, ring widths and colours were read from `measure.py grid`, `row` and `col` dumps of the same corners; the fit depends on them, so they are recorded here. What each colour is (a stored pixel, or a flat stand-in for a region that is not flat) is set out under "Provenance of the colours in the fitting commands" at the end of this file. After the `#` on each line come the recorded results, which are not part of the command: the tool's best radius, its rms in levels and, in brackets, a note.

```text
# check of the tool against the earlier push-button fit
$F 10-15-Catalina-Light-Finder-Go-To-Folder 571,287 tl --bg ececec --ring 1:c8c8c8:c1c1c1 --fill ffffff --size 12                      # 3.75 pt, 2.20
$F 10-15-Catalina-Light-Finder-Go-To-Folder 570,286 tl --bg ececec --ring 1:e6e6e6 --ring 1:c8c8c8:c1c1c1 --fill ffffff --size 12     # 4.25 pt, 1.47  (halo)

# box, System Preferences Sound
$F 10-15-Catalina-Light-System-Preferences-Sound 152,212  tl --bg ececec --ring 1:d4d4d4:dddddd --ring 1:e1e1e1 --fill e3e3e3 --size 12      # 3.875 pt, 0.86
$F 10-15-Catalina-Light-System-Preferences-Sound 1407,212 tr --bg ececec --ring 1:d4d4d4:dddddd --ring 1:e1e1e1 --fill e3e3e3 --size 12      # 3.875 pt, 0.88
$F 10-15-Catalina-Light-System-Preferences-Sound 152,899  bl --bg ececec --ring 1:dedede --ring 1:e1e1e1 --fill e3e3e3 --size 12             # 3.875 pt, 0.48
$F 10-15-Catalina-Light-System-Preferences-Sound 1407,899 br --bg ececec --ring 1:dedede --ring 1:e1e1e1 --fill e3e3e3 --size 12             # 3.875 pt, 0.49
$F 10-15-Catalina-Dark-System-Preferences-Sound 152,212  tl --bg 2f3031 --ring 1:4d4e4f --ring 1:404142 --fill 363637 --size 12             # 4 pt, 0.46
$F 10-15-Catalina-Dark-System-Preferences-Sound 1407,212 tr --bg 2f3031 --ring 1:4d4e4f --ring 1:404142 --fill 363637 --size 12             # 4 pt, 0.48
$F 10-15-Catalina-Dark-System-Preferences-Sound 152,899  bl --bg 2f3031 --ring 1:4e4f50 --ring 1:404142 --fill 363637 --size 12             # 4 pt, 0.48
$F 10-15-Catalina-Dark-System-Preferences-Sound 1407,899 br --bg 2f3031 --ring 1:4e4f50 --ring 1:404142 --fill 363637 --size 12             # 4 pt, 0.52

# Disk Utility capacity bar, default --size 14
$F 10-15-Catalina-Light-Disk-Utility 688,494  tl --bg ececec --ring 2:48a0e3 --fill 4facf2      # 4.75 pt, 1.68   (used end)
$F 10-15-Catalina-Light-Disk-Utility 688,541  bl --bg ececec --ring 2:48a0e3 --fill 4facf2      # 4.75 pt, 1.68
$F 10-15-Catalina-Light-Disk-Utility 1887,494 tr --bg ececec --ring 2:d1d1d1 --fill ffffff      # 5.125 pt, 0.86  (empty end)
$F 10-15-Catalina-Light-Disk-Utility 1887,541 br --bg ececec --ring 2:d1d1d1 --fill ffffff      # 5.125 pt, 0.84
$F 10-15-Catalina-Dark-Disk-Utility 688,494  tl --bg 303132 --ring 2:4facf2 --fill 3f6e92      # 4.875 pt, 1.83  (used end)
$F 10-15-Catalina-Dark-Disk-Utility 688,541  bl --bg 303132 --ring 2:4facf2 --fill 3f6e92      # 4.875 pt, 1.84
$F 10-15-Catalina-Dark-Disk-Utility 1887,494 tr --bg 303132 --ring 2:808080 --fill 38393a      # 5 pt, 0.74      (empty end)
$F 10-15-Catalina-Dark-Disk-Utility 1887,541 br --bg 303132 --ring 2:808080 --fill 38393a      # 5 pt, 0.75

# tab strip, selected first tab, Light Sound; the gradient fill is taken as flat
$F 10-15-Catalina-Light-System-Preferences-Sound 553,193 tl --bg ececec --ring 1:5b93f3:538df2 --fill 75a4f4 --size 10                       # 3.5 pt, 4.21
$F 10-15-Catalina-Light-System-Preferences-Sound 552,192 tl --bg ececec --ring 1:e6e6e6 --ring 1:5b93f3:538df2 --fill 75a4f4 --size 10       # 4 pt, 3.10  (halo)
```

The commands give every screenshot name in full, as the tool takes it (it adds `.png` and nothing else). Until 3 October 2026 this block wrote `Light-S`, `Dark-S`, `Light-D` and `Dark-D` for the Sound and Disk Utility captures.

## Second round of radius fits, 2 October 2026

Not prompted by a build report: this works down the radii that the first round left as grid readings. Sixteen values on thirteen controls and one app blueprint (23 fits, halo fits included), all on flat backgrounds or, for the window, on the alpha channel (`--alpha 1`, added to `tools/corner_fit.py` for this). Each row keeps the old value in its text.

| File | Element | Old value | Fitted value | Result |
|---|---|---|---|---|
| checkbox.md | Corner radius | [M] 3 | [C] 3 | confirmed |
| token-field.md | Token corner radius | [M] 2 | [C] 2 | confirmed |
| window.md | Top and bottom corners | [M] 5 | [C] top 5 (rim 5.5 less the 0.5 pt rim), bottom 5.125 (rim 5.625 less the 0.5 pt rim); dark coarse. Corrected on 3 October 2026: this row gave "[C] 5" for both | top: the fit agrees with the grid reading, coarsely (the shadow outside the corner is not flat); bottom: 0.125 above the grid reading. 5 for all four corners is a separate [I] row in window.md |
| pop-up-button.md | Corner radius | [M] 4 | [C] 3.75 (cap 3.5, coarse) | moved; the push-button bezel |
| default-button.md | Corner radius | [M] 4 | [C] 3.5 to 3.75 | moved; fitted on the accent pop-up cap, as the row always was. Since 3 October 2026 the row rests on a fit of a default button itself (3.5, coarse), and the push button's 3.75 outline is an [I] assumption beside it |
| segmented-control.md | Corner radius, regular | [M] 4 | [C] 3.75 in light; dark not fitted, [I] 3.75 taken from the light fit | moved; the push-button bezel |
| toolbar-button.md | Corner radius | [M] 4 | [C] 4.25 | moved |
| toolbar-search-field.md | Corner radius | [M] 4 | [C] 4.25 | moved |
| toolbar-pop-up.md, smart-search-field.md, toolbar-segmented-control.md | Radius, by reference | [M] 4, by reference to the control named in the row rather than a direct measurement | [I] 4.25 | carried over from the two rows above on the assumption of a shared bezel; not fitted on those controls in this round, so tagged inferred. All three were fitted on their own corners on 3 October 2026 (see "Toolbar bezels fitted on their own corners" below); the fitted values are [C] since, and the toolbar segmented control's dark value to build with, 3.75, is [I] (its dark fit's optimum, 3.625, is the [C] figure) |
| search-field.md | Automator field / Music sidebar field | [M] 2.5 / 3.5 | [C] 4.25 / 3.75 | moved; the Automator value was the largest misreading found |
| stepper.md | Corner radius | [M] 5.5 | [C] 5.125 to 5.25 | moved |
| preferences-toolbar.md | Selection top corners | [M] 3.5 | [C] 4 | moved |
| image-well.md | Outer corner radius | [M] about 5.5 | [C] 6.5 | moved |
| now-playing-lcd.md | Music / Podcasts panel | [M] 2 / 2 | [C] fitted optima 2.625 / 1.875; the values to build with, 2.5 / 2 (rounded to the nearest half point), are a separate [I] row since 3 October 2026 | Music moved, Podcasts confirmed within the rounding |
| apps/airport-utility.md | Button corner radius | [C] about 2.5 | [C] 3.625 on the outline | moved |

Not fitted, and why: a surface that lies on the wallpaper or on a translucent material in a full-screen capture has no flat background, so the model does not apply (menu, contextual menu, popover, notification alert and banner, Spotlight, Dock, HUD window, app switcher, Launchpad folder, Siri, login window, Notification Center, Quick Look, picture in picture). Also not fitted in this round: switch, focus ring, colour-swatch ring, scope-bar pill and toolbar button in dark (all five tried in the third round below; four were fitted and the switch was not), small and mini sizes of controls other than the small push button (fitted in the first re-measurement, 3.75) and the small search field in Automator (fitted above, 4.25), and artwork radii in the app blueprints.

### Fitting inputs, second round

Same conventions as above; `F="python3 reference/spec/tools/corner_fit.py"` from the repository root, every screenshot name written in full (until 3 October 2026 the names in this and the later blocks were written without their `10-15-Catalina-` prefix, which the tool does not add). The provenance of the colours is set out at the end of this file.

```text
$F 10-15-Catalina-Light-System-Preferences-Network 830,548 tl --bg e3e3e3 --ring 1:4081f5 --fill 4d89f5 --size 12                 # 3 pt, 2.28      (checked checkbox)
$F 10-15-Catalina-Light-Mail 601,418 tl --bg ffffff --ring 1:c0d7fc --fill c0d7fc --size 8 --rmin 0                                 # 2 pt, 0.20      (token)
$F 10-15-Catalina-Light-System-Preferences-General 613,413 tl --bg ececec --ring 1:c8c8c8:c1c1c1 --fill ffffff --size 12            # 3.75 pt, 2.19   (pop-up, white corner)
$F 10-15-Catalina-Light-System-Preferences-General 612,412 tl --bg ececec --ring 1:e6e6e6 --ring 1:c8c8c8:c1c1c1 --fill ffffff --size 12   # 4.25 pt, 1.44  (halo)
$F 10-15-Catalina-Light-System-Preferences-General 910,413 tr --bg ececec --ring 1:5b93f3:518bf3 --fill 72a3f4 --size 10            # 3.5 pt, 3.47    (pop-up cap, gradient taken as flat)
$F 10-15-Catalina-Light-System-Preferences-General 911,412 tr --bg ececec --ring 1:e6e6e6 --ring 1:5b93f3:518bf3 --fill 72a3f4 --size 10   # 4 pt, 2.58     (halo)
$F 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver 177,1039 tl --bg e3e3e3 --ring 1:c0c0c0:bbbbbb --fill ffffff --size 10   # 3.75 pt, 2.42  (segmented control)
$F 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver 176,1038 tl --bg e3e3e3 --ring 1:dddddd --ring 1:c0c0c0:bbbbbb --fill ffffff --size 10   # 4.25 pt, 1.84  (halo)
$F 10-15-Catalina-Light-Finder-Network 127,125 tl --bg d9d9d9 --ring 1:c5c5c5:c3c3c3 --fill fafafa --size 12                        # 4.25 pt, 1.35   (toolbar button)
$F 10-15-Catalina-Light-Finder-Network 1301,125 tl --bg dadada --ring 1:c4c4c4:c3c3c3 --fill fafafa --size 12                       # 4.25 pt, 1.33   (toolbar search field)
$F 10-15-Catalina-Light-Automator 421,219 tl --bg 85a7e7 --ring 1:7294d4:7293d4 --fill cfcfcf --size 10                             # 4.25 pt, 1.99   (search field, focused: the background is the focus ring)
$F 10-15-Catalina-Light-Music 133,203 tl --bg e8e9e9 --ring 1:c2c2c2:c1c1c2 --fill d2d3d3 --size 10                                 # 3.75 pt, 0.82   (sidebar search field)
$F 10-15-Catalina-Light-System-Preferences-Notifications 957,547 tl --bg e3e3e3 --ring 1:c1c1c1:b9b9b9 --fill ffffff --size 9       # 5.125 pt, 2.79  (stepper)
$F 10-15-Catalina-Light-System-Preferences-Notifications 956,546 tl --bg e3e3e3 --ring 1:dddddd --ring 1:c1c1c1:b9b9b9 --fill ffffff --size 10   # 5.75 pt, 2.28  (halo)
$F 10-15-Catalina-Light-Finder-Network 111,75 tl --alpha 1 --bg 121212 --ring 1:3a3a3a --fill ffffff                                # 5.5 pt, 5.62    (window rim, alpha; frame = rim - 0.5)
$F 10-15-Catalina-Light-Finder-Network 111,1498 bl --alpha 1 --bg 2e2e2e --ring 1:555555 --fill ffffff                              # 5.625 pt, 4.57  (window rim, bottom)
$F 10-15-Catalina-Dark-Finder-Network 111,75 tl --alpha 1 --bg 111111 --ring 1:f4f4f4 --fill ffffff                                 # 5.625 pt, 13.23 (dark outline, coarse)
$F 10-15-Catalina-Dark-Finder-Network 2110,75 tr --alpha 1 --bg 111111 --ring 1:f4f4f4 --fill ffffff                                # 5.625 pt, 13.29
$F 10-15-Catalina-Light-Mail-Preferences 120,120 tl --bg dfdfdf --ring 1:c7c7c7 --fill c7c7c7 --size 10                             # 4 pt, 1.04      (preferences-toolbar selection)
$F 10-15-Catalina-Light-System-Preferences-Desktop-and-Screen-Saver 210,263 tl --bg e3e3e3 --ring 1:d5d5d5 --ring 4:ffffff --ring 1:bcbcbc:c4c4c4 --fill d6d6d6 --size 13 --rmax 16   # 6.5 pt, 2.34  (image well)
$F 10-15-Catalina-Light-Music 1108,85 tl --bg fefefe --ring 1:dfdfdf --fill e9e9e9 --size 8 --rmin 0                                # 2.625 pt, 0.63  (display panel)
$F 10-15-Catalina-Light-Podcasts 1117,85 tl --bg ffffff --ring 1:cfcfcf --fill e9e9e9 --size 8 --rmin 0                             # 1.875 pt, 1.21
$F 10-15-Catalina-Light-Airport-Utility 159,199 bl --bg 323840 --ring 1:282d33:2c3138 --fill 656a70 --size 10                       # 3.625 pt, 1.87  (the Dark file gives the same)
```

The alpha fits give `--bg`, `--ring` and `--fill` as greys of the alpha value. The window's shadow is not flat outside the corner (alpha 7 to 25 in the compared square at the top, entered as `12` = 18; 38 to 54 at the bottom, entered as `2e` = 46), which is what the rms of 5 levels reflects; the dark corner has two partly transparent lines and is the coarsest fit here. These fits are estimates that depend on the flat-background model, not confirmations.

## Third round of radius fits, 3 October 2026

The radii the second round left as grid readings on flat (or nearly flat) backgrounds. Each row keeps the old value in its text. Four of the five elements were fitted; the switch was tried and is not fitted.

| File | Element | Old value | Fitted value | Result |
|---|---|---|---|---|
| scope-bar.md | On-scope pill corner radius | [I] "fully rounded ends (radius about 4)" | [C] 3.75 in three captures (Finder light and dark, where bar and pill are flat; light Preview, on a bar within 4 levels taken as flat); [I] 3.75 in dark Preview, whose bar and pill are not flat | moved; a rounded rectangle, not a capsule (a 16 pt capsule would be 8) |
| toolbar-button.md | Corner radius, dark | none ("Dark not fitted") | [C] 3.75 on the edge of the border-less fill (3.625 to 3.75 over two corners) | new; the same shape as the light fill inside its 0.5 pt border (4.25 on the border) |
| color-swatch-picker.md | Selection ring outer radius | [M] 5.5 ±0.5 | [C] 6 on the outer edge, light and dark | moved |
| color-swatch-picker.md | Image corner radius | [C] 4 (5.5 − 1.5) | [M] grid reading 4.5 to 5; [I] 4.5 to build with (6 − 1.5 only if the ring's inner edge is concentric, which the whole-corner fit does not support) | not fitted; no longer a computed value |
| accent-colors.md | Thumbnail image corner radius | [C] 4 (5.5 − 1.5) | the same: [M] grid reading 4.5 to 5; [I] 4.5 | not fitted; the same element in another capture |
| accent-colors.md | Thumbnail selection ring outer radius | [M] 5.5 | [C] 6 | moved; the same element in another capture |
| focus-ring.md | Outer corner radius, square control | [M] 2.5..3 | [C] 3.25 | moved |
| focus-ring.md | Outer corner radius, rounded control | [M] control radius + 2.5 | [C] 6.75 around the 4.25 pt toolbar search field | the one fitted case agrees with the rule; the rule itself, for other rounded controls, is [I] (this row said "confirmed" until 3 October 2026) |
| switch.md | Track radius | [C] 10.5, half the height | none: not fitted. Trial fits returned 10.375 (right end) and 10.625 (left end) on a background that is not flat | unchanged, [C] 10.5 from the height; the trial fits are invalid and confirm nothing |

Not usable, and why. The Automator focus ring is cut by the bar above and below the field, so the two background pixels the tool keeps outside the corner are not background (rms 21); it is not quoted in the spec. The image corner inside the selection ring cannot be fitted because the ring's own outer corner lies inside the compared square (rms 49 to 51). A fit of the whole swatch corner with a concentric 3 px ring over the image gives 6.25 pt at rms 7.6 to 8.0 in both appearances, against 1.7 for the outer edge alone, so the outer-edge fit is the one recorded. The switch lies on the Notification Center material, which is not flat (the pane's blue channel rises by 10 levels along row 185 across the track's width); the tool's model does not apply, so the two trial fits listed below are invalid and the track radius stays unfitted in both appearances, like the other radii on a translucent material. The dark Preview scope bar is translucent over the sidebar: on rows 199 and 210 the bar varies by 6 levels and the pill by 9 across the compared square, so the trial fit listed below is invalid as well, and the dark Preview pill takes its radius by inference from the three valid captures. In light Preview the bar is a shallow gradient that stays within 4 levels over the compared square; it was taken as flat, as the gradient fills of the second round were.

### Fitting inputs, third round

Same conventions as above; `F="python3 reference/spec/tools/corner_fit.py"` from the repository root, every screenshot name written in full. After the `#` on each line come the recorded best radius and its rms.

```text
$F 10-15-Catalina-Light-Finder-Search 703,202 tl --bg f0f0f0 --ring 1:9a9a9a --fill 9a9a9a --size 14                               # 3.75 pt, 1.05   (scope pill)
$F 10-15-Catalina-Light-Preview-Search 438,201 tl --bg d2d2d2 --ring 1:878787 --fill 868686 --size 14                              # 3.75 pt, 1.34   (bar within 4 levels, taken as flat)
$F 10-15-Catalina-Dark-Finder-Search 703,202 tl --bg 2b2c2f --ring 1:b6b7ba --fill b6b7ba --size 14                                # 3.75 pt, 1.66
$F 10-15-Catalina-Dark-Preview-Search 438,201 tl --bg 3b3c3e --ring 1:c7c8ca --fill c7c8ca --size 12                               # 3.75 pt, 2.43   (invalid: bar and pill not flat; not evidence)
$F 10-15-Catalina-Dark-Finder-Network 128,126 tl --bg 343536 --ring 1:7a7b7c:606162 --ring 1:666767:606162 --fill 606162 --size 12   # 3.625 pt, 1.44 (toolbar button, dark; 1.45 at 3.75)
$F 10-15-Catalina-Dark-Finder-Network 128,126 tl --bg 343536 --ring 1:7a7b7c:606162 --fill 606162 --size 12                        # 3.75 pt, 1.78   (one top line only)
$F 10-15-Catalina-Dark-Finder-Network 229,126 tr --bg 343536 --ring 1:7a7b7c:606162 --ring 1:666767:606162 --fill 606162 --size 12   # 3.75 pt, 1.39  (Forward, top right)
$F 10-15-Catalina-Light-System-Preferences-General 612,185 tl --bg ececec --ring 1:2f7cf6 --fill 2f7cf6 --size 6 --rmax 16         # 6 pt, 1.66      (swatch ring, outer edge; --size 5 gives 6 pt, 1.79)
$F 10-15-Catalina-Dark-System-Preferences-General 784,185 tl --bg 2f3031 --ring 1:2f7cf6 --fill 2f7cf6 --size 6 --rmax 16          # 6 pt, 1.65      (--size 5 gives 6 pt, 1.76)
$F 10-15-Catalina-Theme-Light-Blue 1478,433 tl --bg ececec --ring 1:2f7cf6 --fill 2f7cf6 --size 6 --rmax 16                        # 6 pt, 1.67      (accent-colors thumbnail ring)
$F 10-15-Catalina-Light-System-Preferences-General 612,185 tl --bg ececec --ring 3:2f7cf6 --ring 1:d9dbe0:d5d7df --fill d1d3d8 --size 10 --rmax 16   # 6.25 pt, 7.99  (whole corner, concentric; not used)
$F 10-15-Catalina-Light-System-Preferences-General 612,185 tl --bg ececec --ring 3:2f7cf6 --fill d1d3d8 --size 10 --rmax 16        # 6.25 pt, 7.58   (not used)
$F 10-15-Catalina-Dark-System-Preferences-General 784,185 tl --bg 2f3031 --ring 3:2f7cf6 --ring 1:1e2833:1f2935 --fill 121d2a --size 10 --rmax 16    # 6.25 pt, 7.58  (not used)
$F 10-15-Catalina-Light-System-Preferences-General 615,188 tl --bg 2f7cf6 --ring 1:d9dbe0:d5d7df --fill d1d3d8 --size 7             # 5 pt, 51.28     (image corner; invalid, see above)
$F 10-15-Catalina-Dark-System-Preferences-General 787,188 tl --bg 2f7cf6 --ring 1:1e2833:1f2935 --fill 121d2a --size 7              # 5 pt, 49.26     (invalid)
$F 10-15-Catalina-Light-Finder-Go-To-Folder 148,202 tl --bg ececec --ring 1:8badec --fill 89abeb --size 5 --rmin 0                  # 3.25 pt, 0.52   (focus ring, square control, ring only)
$F 10-15-Catalina-Light-Finder-Go-To-Folder 148,202 tl --bg ececec --ring 1:8badec --ring 4:89abeb --ring 1:6b8dcd --ring 1:8baded --fill ffffff --size 10 --rmin 0   # 3.25 pt, 1.23  (with the border and inner edge)
$F 10-15-Catalina-Light-System-Preferences-Sharing 1106,86 tl --bg e2e2e2 --ring 1:87a9e8 --fill 84a6e6 --size 7 --rmax 20         # 6.75 pt, 1.50   (focus ring, toolbar search field)
$F 10-15-Catalina-Light-Automator 415,213 tl --bg e4e4e4 --ring 1:87a9e8 --fill 85a7e7 --size 7 --rmax 20                          # 6.75 pt, 21.65  (invalid: ring cut by the bar; --size 8 gives 6.75 pt, 20.51)
$F 10-15-Catalina-Light-Notification-Center-Today 3317,187 tr --bg e5f4fe --ring 1:c2cdd4:cddbe5 --ring 1:d2dde5:d3e1eb --fill d5e3ec --size 24 --rmin 14 --rmax 28   # 10.375 pt, 1.82  (invalid: switch track, right end, on a material that is not flat; 1.87 at 10.5)
$F 10-15-Catalina-Light-Notification-Center-Today 3242,187 tl --bg e9f2f6 --ring 1:bfc7cb:ccd5da --ring 1:b4bbbf:b2b9bd --fill ffffff --size 24 --rmin 14 --rmax 28   # 10.625 pt, 1.82  (invalid for the same reason: left end, under the knob; 2.06 at 10.5)
```

The scope pill and the dark toolbar button have no border line, so their first `--ring` is the fill colour (or the lighter top row of the dark button); the radius is that of the shape's outer edge.

### Corrections from the review of pull requests #4, #6 and #11, 3 October 2026

A review of those three merged changes as one diff found rows that the second round had left behind. Corrected in the same change as the third round:

- The family rows in `handoff/*.md` (and so in `tokens.json` and `tokens.md`) still gave grid readings tagged [M] for radii the second round fitted: toolbar button, toolbar segmented control, toolbar pop-up, toolbar search field, smart search field (`chrome.md`), preferences-toolbar selection (`dialogs.md`), pop-up button and segmented control (`sysA.md`), stepper, both search fields and image well (`sysB.md`), display panel (`apps.md`). Each now gives the fitted value tagged [C], or [I] where it is carried over from another control.
- `now-playing-lcd.md` led its [C] row with the rounded 2.5 / 2. The row now gives the fitted 2.625 / 1.875, and the values to build with are a separate [I] row.
- `tokens-intro.md` said the second round changed no token; it changed no numeric value, but it did change the tag, evidence and note of `--mac-radius-checkbox` and `--mac-radius-window`.
- `inferred-values.md` and the `sysA.md` summary omitted the adopted 3.5px regular and small push-button radius.
- `tools/build.py audit-shorthand --progress` reused a spec file's cached result without looking at the screenshots it had sampled. The cache key now includes the SHA-256 of every file in `reference/screenshots/`, read on each run.

### Corrections from the review of the third round, 3 October 2026

A review of the third round before publication found seven statements that claimed more than the pixels support. All are corrected in the same change:

- The appearance-thumbnail image radius still read 4 pt [C] in `accent-colors.md` and `handoff/dialogs.md` (5.5 minus 1.5) after the ring moved to 6 pt, against 4.5 in `color-swatch-picker.md` and `handoff/sysA.md`. All four rows now give the grid reading 4.5 to 5 and 4.5 to build with.
- That 4.5 was tagged [C] as 6 minus 1.5, although the concentric inner edge the subtraction needs is the assumption the whole-corner fit failed to support. It is now tagged [I], and the unfitted grid reading is stated separately in every row that repeats it.
- The switch track was described as confirmed by a fit made on the Notification Center material. The fit breaks the flat-background rule; it is now recorded as invalid and the radius as unfitted.
- The scope-bar pill was described as fitted in four captures. The dark Preview fit is invalid for the same reason; three captures are valid and dark Preview is inferred.
- The statement that the small and mini sizes of any control remain grid readings now excepts the small search field in Automator, fitted at 4.25 in the second round.
- `tokens.md` called the 939 family rows "measured values"; they include computed, inferred and adopted values (for example `lcd.radius.build`), so the generator now calls them token-candidate rows.
- `tokens-intro.md` said no numeric token value in the sheet changed while family rows took fitted values. Both claims are now scoped to the core CSS tokens, and the changed family candidates are acknowledged.

## Corrections from the re-review of pull requests #6, #11 and #19, 3 October 2026

A further independent review of the three merged changes found one row that claimed more than its fit says and eleven smaller points. The findings reached this file's author as summaries relayed by the project coordinator (file, line, summary and recommendation); the reviewer's verbatim text was not available. Each was checked against the files and the pixels before anything was changed.

### Window corner radius

`window.md` gave the bottom corners as "5, confirmed by the fit", while the fit it quoted says otherwise: the rim fits 5.625, and 5.625 less the 0.5 pt rim is 5.125. Re-run on 3 October 2026 with the same inputs: rim 5.625 at rms 4.57, 5.12 at 5.5, 6.00 at 5.75. The correction:

| File | Row | Before | After |
|---|---|---|---|
| window.md | Corner radius, bottom corners | [C] 5 "confirmed" | [C] 5.125 from the fit, coarse; [M] grid reading 5 |
| window.md | Corner radius, top corners | [C] 5 "confirmed" | [M] grid reading 5; [C] fit 5, described as a coarse, model-dependent estimate |
| window.md | Corner radius to build with, all four corners | (no row) | [I] 5 |
| tokens-core.txt | `--mac-radius-window` | 5px [C] | 5px [I], with both fits in the note |
| handoff/chrome.md | window.radius | "5 top/bottom" [M] | both grid readings, both fits and the [I] build value |

Why coarse: the alpha fit models the shadow outside the corner as one flat level. In the compared square it runs from 7 to 25 at the top and from 38 to 54 at the bottom. A fit with a shadow that varies in space was not attempted, so the two [C] figures stand as estimates and neither is called a confirmation any more.

### Toolbar bezels fitted on their own corners

The review pointed out that the toolbar segmented control and the toolbar pop-up gave "4.25, carried over from the toolbar button" with "same" for dark, while the toolbar button itself now gives 3.75 for its border-less dark fill. Instead of carrying two inferred values over, each control was fitted on a corner of its own in both appearances, and so were the smart search field (which had its 4.25 from the toolbar search field) and the two dark corners that had no fit:

| File | Element | Old value | Fitted value |
|---|---|---|---|
| toolbar-segmented-control.md | Corner radius (outer ends) | [I] 4.25, both appearances | [C] light 4.25 on the border; [C] dark 3.625 on the border-less fill, with 3.75 nearly as good (rms 1.46 against 1.53); [I] 3.75 to build with in dark, a separate row |
| toolbar-pop-up.md | Radius | [I] 4.25, both appearances | [C] light 4.25 on the border; dark 3.75 on the fill |
| smart-search-field.md | Corner radius | [I] 4.25, both appearances | [C] light 4.25 on the border; dark 3.75 on the fill |
| toolbar-search-field.md | Corner radius, dark | none (light fit only) | [C] 3.75 on the fill |
| preferences-toolbar.md | Selection top corners, dark | none (light fit only) | [C] 4, as in light |

The family rows in `handoff/chrome.md` and the [I] lists in `handoff/chrome.md` and `inferred-values.md` follow. One corner per control and appearance was fitted; the other corners and captures were not.

```text
$F 10-15-Catalina-Light-Finder-Network 451,125 tl --bg dadada --ring 1:c6c6c6:c5c5c5 --fill fafafa --size 12                        # 4.25 pt, 1.36   (toolbar segmented control, leading end; 2.49 at 4, 2.33 at 4.5)
$F 10-15-Catalina-Dark-Finder-Network 386,126 tl --bg 38393a --ring 1:7e7f81:656667 --ring 1:6a6c6d:656667 --fill 656667 --size 12   # 3.625 pt, 1.46 (the same, dark; 1.53 at 3.75, 2.01 at 3.5, 2.99 at 4)
$F 10-15-Catalina-Light-Finder-Network 687,125 tl --bg dadada --ring 1:c5c5c5 --fill fafafa --size 12                               # 4.25 pt, 1.32   (toolbar pop-up, Group; 2.49 at 4, 2.31 at 4.5)
$F 10-15-Catalina-Dark-Finder-Network 622,126 tl --bg 3a3b3c --ring 1:818283:676869 --ring 1:6c6d6e:676869 --fill 676869 --size 12   # 3.75 pt, 1.64  (the same, dark; 2.21 at 3.5, 2.99 at 4)
$F 10-15-Catalina-Light-Safari-v13 900,91 tl --bg e3e3e3 --ring 1:cbcaca:cccbcb --fill fcfcfc --size 12                             # 4.25 pt, 1.69   (smart search field; 2.55 at 4, 2.45 at 4.5)
$F 10-15-Catalina-Dark-Safari-v13 859,92 tl --bg 3e3f41 --ring 1:8a8b8c:6e6e70 --ring 1:737475:6e6e70 --fill 6e6e70 --size 12       # 3.75 pt, 1.61   (the same, dark; 2.29 at 3.5, 3.11 at 4)
$F 10-15-Catalina-Dark-Finder-Network 1448,126 tl --bg 3a3b3c --ring 1:818283:676869 --ring 1:6c6b6e:676869 --fill 676869 --size 12  # 3.75 pt, 1.72  (toolbar search field, dark; 2.29 at 3.5, 3.02 at 4)
$F 10-15-Catalina-Dark-Mail-Preferences 120,120 tl --bg 3f4041 --ring 1:525355 --fill 525355 --size 10                              # 4 pt, 0.68      (preferences-toolbar selection, dark; 1.13 at 3.75, 0.96 at 4.25)
$F 10-15-Catalina-Light-System-Preferences-Date-and-Time 943,895 tl --bg e3e3e3 --ring 1:c0c0c0:b9b9b9 --fill ffffff --size 12      # 3.75 pt, 2.35   (small push button, a check with this tool of the earlier fit; 3.13 at 3.5, 3.39 at 4)
```

The dark controls have no border line, so their two rings are the lighter first and second rows of the fill on the horizontal edge and the fill colour on the vertical edge, as for the dark toolbar button in the third round.

### Provenance of the colours in the fitting commands

The commands of all rounds give `--bg`, `--ring` and `--fill` without saying what each colour is. The rule, with its exceptions, and a check of it made on 3 October 2026 over the 64 commands of the first three rounds and the nine above:

- **Each colour is a stored pixel value [M], with two exceptions** that are tagged [I] below. The colours were read from the `measure.py` dumps of the fitted corner: `--bg` just outside the shape, a `--ring` colour on the straight part of the horizontal edge and (after the second colon) of the vertical edge, `--fill` inside the last ring. The check looked for every colour among the pixels of the named screenshot within the compared square plus 24 px, and found all of them exactly except two. For the alpha fits the values are alpha levels written as greys.
- **The two exceptions are not stored pixel values and are [I]**: the pop-up cap fill `72a3f4` (two commands) and the segmented control's side border `bbbbbb` (two commands). Neither value occurs anywhere in its control; each is one level in one channel from pixels that do (`73a3f4` at 905,417 and `72a3f5` at 905,418 on the cap's gradient; `bababa` at 177,1050 on the segmented control's side border, which runs `b8b8b8` to `bababa`). How they were entered is not recorded; they are most likely readings rounded by eye over a noisy run. Re-run on 3 October 2026 with the stored values `73a3f4` and `bababa` instead, the four fits return the same radii (cap 3.5 pt at rms 3.60 and 4 pt with the halo at 2.67, against 3.47 and 2.58; segmented control 3.75 pt at 2.46 and 4.25 pt with the halo at 1.92, against 2.42 and 1.84), so the radii in the specs do not depend on them.
- **A colour that stands for a region that is not uniform is a flat approximation [I] of that region**, although the value itself is a measured pixel. The check compared the two background pixels kept outside the shape with `--bg`, and the innermost 3 x 3 px of the compared square with `--fill`. The departures of more than 3 levels:
  - Gradient fills taken as flat: the selected tab (fill up to 13 levels from `75a4f4`) and the accent pop-up cap (up to 10 from `72a3f4`), both said so in their command comments; the image well's fill (4).
  - The window shadow in the four alpha fits (background up to 11 and 14 levels of alpha from the value entered in light, 7 and 9 in dark), described above.
  - Single-ring fits of a bezel that has a halo (the push button, pop-up button, pop-up cap, segmented control, tab strip and stepper lines without "halo", and the small push button check above): the halo row lies in the background margin, 6 to 7 levels from `--bg` (3 for the stepper). The paired halo fit on the next line models the halo as a ring of its own, an opaque stand-in for a translucent line, and its background is within 1 level.
  - The focused Automator field, whose `--bg` is the focus ring (6 levels), as its comment says, and the AirPort Utility button, where a 1 px shadow row under the outline lies in the margin (7 levels).
  - Toolbar backgrounds are gradients within 3 to 4 levels over the compared square (toolbar button, toolbar search field, and the toolbar controls fitted above), and the light Preview scope bar within 4; they were taken as flat.
  - A border whose colour changes along the edge (the bezels are darker towards the bottom) is given the colour it has beside the corner.
- The fits already marked invalid or not used in the third round (image corner, Automator focus ring, switch, dark Preview pill, whole swatch corner) are outside this rule: their backgrounds are up to 197 levels from `--bg`, which is why they are not evidence. For the three swatch-ring fits and the ring-only focus-ring fit the compared square is smaller than the corner, so the innermost pixels still lie on the arc and the fill comparison says nothing; their backgrounds are exact.

None of this changes a fitted radius. How far a gradient, a halo or a shadow moves a fitted radius was not quantified: no sensitivity test was run, so the accuracy of those fits is model-dependent and is not known beyond what the rms figures of the neighbouring candidates show; the window fits are the coarsest. (Until 3 October 2026 this paragraph said such a fit "is good to a quarter point at best", a bound it had no analysis for.)

### Other corrections

- `toolbar-button.md`, Browser notes: the recipe paired `border-radius: 4.25px` with a border drawn as a 0.5px outer spread shadow, which puts the outer corner at about 4.75px. It now gives 3.75px for the element when the border is a spread shadow and 4.25px when it is a real border.
- `preferences-toolbar.md`, Browser notes: still gave `border-radius: 3.5px 3.5px 0 0`, the grid reading from before the fit; now 4px.
- `handoff/sysA.md`, appearance.image.radius: the row had dropped its former value (4, computed as the 5.5 ring less its 1.5 width); restored in the row.
- `handoff/dialogs.md`, prefs-toolbar.selection.radius: one [C] tag covered the fitted top radius and the square bottom corners; now "[C] top radius; [M] square bottom corners", as in `preferences-toolbar.md`.
- `scope-bar.md`: the neighbouring rms figures were given for light Finder only. Added: dark Finder 4.88 / 1.66 / 3.89 and light Preview 2.75 / 1.34 / 2.39 at 3.5 / 3.75 / 4 pt (light Finder 2.99 / 1.05 / 2.46), re-run on 3 October 2026.
- `README.md`, `tokens-intro.md` and this file said one small control was fitted (the Automator search field); the small push button was fitted too (3.75, `push-button.md`), and was re-checked with the tool above.
- `tools/build.py audit-shorthand --progress` with no file name ended in an uncaught IndexError, and `--progress -v` took `-v` for the file name. Both now end with a usage error.
- `tools/corner_fit.py` answered malformed coordinates such as `x,20` with a traceback; it now reports them as an input error. The fitting loop moved into a function, `fit`, with unchanged arithmetic (the commands above return the figures recorded in earlier rounds).
- `tools/test_corner_fit.py` is new: tests on synthetic corners for recovery of a known radius, rings of unequal width, all four corners of a whole shape drawn by a separate renderer and read back from a PNG, and the input error. Each of five deliberate faults put into a copy of `corner_fit.py` (no horizontal flip for `tr`, no vertical flip for `br`, rings laid in the wrong order, a square corner, no coordinate check) fails the tests.

## Corrections from a further review of the same three pull requests, 3 October 2026

A second independent review of the merged changes, relayed in the same way (summaries, not the reviewer's text), raised eight points. Two were already corrected by the section above (the toolbar segmented control and pop-up radii; the coordinate parsing in `corner_fit.py`). The other six were checked against the files and the pixels and are real:

| File | Row | Before | After |
|---|---|---|---|
| default-button.md | Corner radius | [C] "3.5 to 3.75", from a fit of a pop-up button's accent cap | [C] 3.5 from a fit of a default button (coarse: gradient fill); [I] that its outline is the push button's 3.75 |
| now-playing-lcd.md, handoff/apps.md | Corner radius, dark | "same" as light, tagged [C], with no dark fit | [C] Music 2.5 to 2.625; Podcasts 2.75 at one corner, an open observation against the light 1.875; the build values for dark are [I], and the Podcasts one is provisional |
| box.md, handoff/sysB.md, tokens-core.txt | Corner radius / `--mac-radius-group` | led with "4" [C] | [C] fits 3.875 light, 4 dark; 4 to build with is [I] in light (rounded) |
| level-indicator.md, handoff/sysB.md | Disk Utility bar corner radius | led with "5" [C] | [C] fits by end and appearance (4.75 to 5.125); 5 to build with is [I] |
| toolbar-button.md | Browser notes, CSS recipe | colours without citations on the line | each colour cited to its pixel; black at 0.03 marked computed |
| tools/corner_fit.py | best radius at an end of `--rmin`..`--rmax` | printed as an ordinary best | followed by a warning that it is not established as an unconstrained optimum and that the range should be widened; either end is flagged, 0 included; four tests |

The dark Podcasts result is new information, not a tidying of tags: the dark capture's panel fits 2.75 where the light capture's fits 1.875 at three corners. Only one dark corner can be fitted (the top-left lies under the artwork, and at the bottom the body is not flat), so the figure rests on that corner, and why the two captures differ is not established. It is recorded as an open observation: the dark Podcasts radius is not a resolved value, and the 2.5 given to build with in dark is a provisional stand-in that matches the Music panel. `now-playing-lcd.md` also still wrote `border-radius:2px` and "radius 2" in two sentences, the grid reading from before the fits; both now point to the Geometry rows.

The rows added to `box.md` (after line 35) and `level-indicator.md` (after line 32) moved the lines below them down by one, so the line references to those two files in `handoff/sysB.md` and `inferred-values.md` were moved with them (for example `box:34–37` is now `box:34–38`, and `level-indicator:30–33,41–44` is now `30–34,42–45`).

No fit recorded in this file had its best radius at an end of its search range, so the new warning changes no recorded result. Three deliberate faults in a copy of the tool (no check of the upper end, no check of the lower end, the warning never printed) each fail the new tests.

```text
$F 10-15-Catalina-Light-Finder-Go-To-Folder 763,287 tl --bg ececec --ring 1:5b93f3:518bf3 --fill 74a4f4 --size 10                   # 3.5 pt, 3.91    (default button, Go; gradient taken as flat; 5.32 at 3.75, 5.76 at 3.25, 8.38 at 4)
$F 10-15-Catalina-Light-Finder-Go-To-Folder 762,286 tl --bg ececec --ring 1:e6e6e6 --ring 1:5b93f3:518bf3 --fill 74a4f4 --size 10    # 4 pt, 2.89      (halo; 3.97 at 4.25, 5.51 at 3.75)
$F 10-15-Catalina-Dark-Music 1108,85 tl --bg 2a2c2e --ring 1:222325:212224 --fill 6e6e6e --size 8 --rmin 0                          # 2.5 pt, 0.66    (display panel, dark; 3.09 at 2.25, 2.68 at 2.75)
$F 10-15-Catalina-Dark-Music 1907,85 tr --bg 2a2c2e --ring 1:222325 --fill 494b4c --size 8 --rmin 0                                 # 2.625 pt, 0.54  (1.02 at 2.5, 0.87 at 2.75)
$F 10-15-Catalina-Dark-Podcasts 1818,85 tr --bg 1e1e1e --ring 1:181818 --fill 404040 --size 8 --rmin 0                              # 2.75 pt, 1.05   (1.69 at 2.5, 1.92 at 3)
$F 10-15-Catalina-Light-Music 1907,85 tr --bg fefefe --ring 1:dfdfdf --fill ffffff --size 8 --rmin 0                                # 2.625 pt, 0.64  (light, top right: as the top left)
$F 10-15-Catalina-Light-Podcasts 1818,85 tr --bg ffffff --ring 1:cfcfcf --fill ffffff --size 8 --rmin 0                             # 1.875 pt, 1.26  (light, top right: as the top left)
$F 10-15-Catalina-Light-Podcasts 1818,174 br --bg ffffff --ring 1:cfcfcf --fill ffffff --size 8 --rmin 0                            # 1.875 pt, 1.26  (light, bottom right)
```

The colours of these eight commands follow the rule set out above and were put through the same check: each is a stored pixel of the named screenshot near the fitted corner [M]. The Go button's fill is a gradient taken as flat [I] (the innermost pixels of the compared square are up to 12 levels from `74a4f4`), and its single-ring fit has the halo row in the background margin, as the other bezels do. In the display panels the fill beside each fitted corner differs with what lies there (artwork well `6e6e6e`, body `494b4c` or `404040`), which is why each command names its own.

## Corrections from a third review of the same pull requests, 3 October 2026

A third independent review, relayed in the same way, raised three provenance points and one about the command blocks. Checked against `main` after pull request #22:

| File | Row | Before | After |
|---|---|---|---|
| focus-ring.md | Outer corner radius | the rule "control radius + 2.5 around a rounded control" stood under the [C] tag, though only one rounded control was fitted | [C] 6.75 (toolbar search field) and 3.25 (square control), the two fits; [I] the rule for other rounded controls. Repeated in `handoff/sysB.md`, `inferred-values.md`, `tokens-core.txt` (`--mac-focus-ring-offset` note), `tokens-intro.md` and the README |
| segmented-control.md | Corner radius, regular | one [C] tag for both appearances, while `handoff/sysA.md` and `inferred-values.md` already said dark was taken from the light fit | [C] light; [I] dark, taken from the light fit (dark not fitted) |
| this file | fitting commands of all rounds | 79 of the 81 commands named their screenshot without the `10-15-Catalina-` prefix, or by an alias (`Light-S`), which the tool does not expand | every command gives the full screenshot name |
| default-button.md | Corner radius | (the review read a snapshot from before pull request #22) | no change: since #22 the row rests on a fit of a default button itself, tagged [C], with the push-button outline as an [I] assumption |

After the names were written out, the command part of each of the 81 lines in this file (the text before the recorded results, taken out by a script) was run on 3 October 2026. Each returned the best radius recorded beside it and the recorded rms to the last digit, and none had its best radius at an end of its search range. The lines themselves were not runnable as written then, because the results followed the command without a comment sign; see the next section.

## Corrections from reviews of the merged pull requests #11, #21, #22 and #23, 3 October 2026

Further independent reviews of the merged changes, again relayed as summaries, left six points open. Each was checked against `main` (`1042fdda`) before anything was changed; all six were still there.

| File | Row or line | Before | After |
|---|---|---|---|
| toolbar-button.md, handoff/chrome.md | Shadow row under the border; Browser notes | "black @ 0.03" tagged [C], though the cited pixels give 1 − 199/206, about 0.034 | [C] 0.034, computed from the two cited pixels; [I] `rgba(0,0,0,0.03)` as the rounded value to build with |
| smart-search-field.md, toolbar-pop-up.md, toolbar-segmented-control.md, handoff/chrome.md | Corner radius, former value | "before the fits it gave 4, a grid reading" (in the family rows "4 as a grid reading"), which dropped the former tag | "formerly 4 [M], by reference to the control named rather than a direct measurement": the rows had read 4 under the [M] tag with the evidence "as `toolbar-button`" or "same bezel as `toolbar-search-field`" |
| this file | second-round table, the three radii by reference | old value an untagged 4; "are [C] since" for all three | old value [M] 4 by reference; the fitted values are [C], and the toolbar segmented control's dark value to build with, 3.75, is [I] |
| this file | "Provenance of the colours", last paragraph | "good to a quarter point at best" | the accuracy of fits on a gradient, halo or shadow is not quantified (no sensitivity test) |
| this file | all 81 fitting commands | results followed each command with no comment sign, so the lines were records and could not be run as written, although the text said they had been | the results follow a `#`, so each line is a shell command with a trailing comment |
| tools/corner_fit.py | `--alpha` | refused any image without an alpha band, including PNGs whose transparency is in a palette or a single transparent colour | converts to RGBA first, so an alpha band and PNG transparency metadata are both read; an image with neither is still refused. Five tests added |

How the 81 commands were checked after the change: every line of this file that begins `$F ` was passed whole, results and note included, to `bash` from the repository root with `F="python3 reference/spec/tools/corner_fit.py"` set, so that the shell itself drops the text from the `#` on; the best radius and rms on the tool's first output line were then compared with the two figures after the `#`. All 81 agree (the rms to the last digit), none prints the search-boundary warning, and the four `--alpha` fits return the same figures through the new conversion. This was done on the Linux build machine with the reference screenshots in `reference/screenshots/`, which are not in the repository.

The three `--alpha` tests that read a palette PNG or a single transparent colour fail against the tool as it was (it exits with "has no alpha channel"), so they show the change. The fourth, that an image without transparency is refused, fails against the old tool only because the message text changed; it guards the refusal and does not demonstrate the fix.

## Network pane gradient-button bar, measured 3 October 2026

The buttons batch reported that the dark gradient-button bar in the Network pane is lighter than in the other panes, and asked for a measurement. Recorded in `gradient-button.md` (Colours and fills, the five "Network pane bar" rows and the notes under the table) and as the family row `gradient.network-variant` in `handoff/sysA.md`:

| Part | Light | Dark | Tag |
|---|---|---|---|
| Fill, first row to last | `#fafafa` to `#f5f5f5` | `#4e4f50` to `#48494a` | [M] |
| Top line | `#b4b4b4` | `#808080` | [M] |
| Bottom and outer side borders | `#b4b4b4` | `#636465` | [M] |
| Borders between cells | `#b4b4b4` | `#8a8b8c` | [M] |
| Other panes, for comparison (four dark captures; Language & Region and Internet Accounts in light) | fill `#f9f9f9` to `#f3f3f3`, borders between cells `#b7b7b7` to `#b8b8b8` | fill `#3c3c3c` flat, every border `#7f7f7f` | [M] |

The buttons batch's reading of the dark bar is confirmed. One thing it did not have: the light bars are not identical either, though they differ little: by one or two levels in the fill and three or four in the borders between cells. The window behind the bar is `#2f3031` in both kinds of dark pane, so the bar itself differs. Why it does is not established and is recorded as open; the recipe of the four captures stays the default, and the Network values are a variant of that one pane.

## Pressed fill of the help, round and disclosure buttons, settled 3 October 2026

The buttons batch found the spec disagreeing with itself. The token sheet gave `--mac-bezel-fill-pressed` as `#f0f0f0` in light and white at 0.36 in dark, while `help-button.md` inferred about `#e5e5e5` and white at 0.35, and `disclosure-button.md` "darkens about 10%" (`round-button.md` refers to the help button for every state). No screenshot shows any of the three pressed, so both figures are inferences and neither has pixel evidence over the other.

| Value | Light | Dark | Tag | Status |
|---|---|---|---|---|
| Pressed fill to build with | `#f0f0f0` | `rgba(255,255,255,0.36)` | [I] | the shared `--mac-bezel-fill-pressed`; unchanged in the token sheet, and now what the three component pages give |
| Earlier component-page inferences | `help-button.md`: about `#e5e5e5`; `disclosure-button.md`: "fill darkens about 10%", no figure | `help-button.md`: `rgba(255,255,255,0.35)`; `disclosure-button.md`: the same "darkens about 10%", no figure | [I] | superseded; kept in the rows of `help-button.md` and `disclosure-button.md` and in the token row's note |

The choice follows the rule used for the mini control radius: where two inferred figures have no evidence between them, the spec gives the one the library builds. Nothing changes for the token layer or for the buttons batch.


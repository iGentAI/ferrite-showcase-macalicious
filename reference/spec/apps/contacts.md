# Contacts
- **Screenshots:** 10-15-Catalina-Light-Contacts.png (edit mode, a label pop-up menu is open), 10-15-Catalina-Dark-Contacts.png (view mode, an action menu opened from the "work" field label is open; it is a pop-up menu, not a Control-click contextual menu, and is the closest thing to one in the library). Cropped desktop captures: wallpaper shows through the vibrant sidebar.
- **Window:** 938 x 438 pt [M] (light: image x=34..1909, y=34..909; dark: x=60..1935, y=54..929). Full-size content view without a title bar strip; traffic lights float over the sidebar.

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Groups sidebar (`sidebar`, vibrant over wallpaper) | 222 wide (light x=36..479) | `#d0cdc8 (sRGB #d1cdc7)` .. `#bfc8d2 (sRGB #bdc8d3)` | `#2b303b (sRGB #2a303c)` .. `#2c3238 (sRGB #2b3239)` | [M] Light-Contacts @ 300,60,1,850 |
| Divider | 1 | `#b8b4a7 (sRGB #b9b4a6)` (blended) | `#000000` | [M] @ 480,214 / Dark @ 506,234 |
| Name list (`list-view`) | 188 wide (x=482..857); search field on top (y=83..124) | `#ffffff` | `#1e1f20` | [M] Light-Contacts @ 800,60,1,270 |
| Divider | 1 | `#d5d5d5` | `#000000` | [M] @ 858,214 / Dark @ 884,234 |
| Card | 525 wide (x=860..1909) | `#ffffff` | `#1e1f20` | [M] @ 1000,150 |

```
| o o o       | [ Search    ] |   (SH)  Stephen Hackett                   |
| All Contacts| Apple Inc.    |         Company   [ ] Company             |
| iCloud      | Stephen Hack. |          [  Info  |  Picture  ]            |
|  All iCloud | Stephen Hack. | (-) mobile ^v  Phone                       |
| On My Mac   |               | (-) work  ^v   ...@hackett.fm              |
|  All on My..|               |  ...                                       |
|             |               | [+]                          [Done] [share]|
```

## Components used
`window`, `window-controls`, `sidebar` (rows 24 pt, no icons; selected row vibrant grey), `split-view`, `search-field`, `list-view` (names 13 pt Bold, rows 24 pt, unemphasized selection), `segmented-control` (Info | Picture), `checkbox` ("Company"), `pop-up-button` (borderless label pop-ups with up/down chevrons), `menu` + `menu-item` (label menu with checkmark; dark: the field-label action menu, which uses the same `menu` container that `contextual-menu` describes), `text-field` (inline editable fields, selected text), `push-button` ("+", "Done", "Edit", share), `round-button` (red remove buttons; dark: action buttons message/call/video/mail), `separator`, `text-view` (selection colour evidence).

## App-specific elements
Measured on the original pixels [M] unless tagged. Light: frame x 34..1909, y 34..909, card x 860..1909. Dark: frame x 60..1935, y 54..929, card x 886..1935.

| Element | Light (image px) | Dark (image px) | Size and position (pt) | Colours | Evidence |
|---|---|---|---|---|---|
| Monogram avatar | x 1000..1109, y 82..191 | x 1026..1135, y 102..211 | 55 disc; 70 from the card's left edge, 24 below the window top | vertical gradient light `#a5aab6 (sRGB #a4aab7)` (top), `#959aa5 (sRGB #949aa6)` (middle), `#868a94 (sRGB #858a95)` (bottom); dark `#6d6c6d`, `#595a5a`, `#474748`; initials white | `10-15-Catalina-Light-Contacts.png @ 1055,60,1,155`; `10-15-Catalina-Dark-Contacts.png @ 1081,106` |
| Name "Stephen Hackett" | ink from x 1127, cap height y 82..107 | ink x 1153..1417, y 136..170 | starts 8.5 after the avatar; cap height 25.5 px, so 18 pt Regular [C]. In light (edit mode) the name sits at the avatar's top; in dark (view mode) it is vertically centred on the avatar | light `#272727`, dark `#dddddd` | `10-15-Catalina-Light-Contacts.png @ 1127,81,272,34`; `10-15-Catalina-Dark-Contacts.png @ 1153,136,265,35` |
| Placeholder "Company" (light, edit mode) | ink x 1127..1231, y 128..150 | not shown: the dark capture is in view mode | 13 pt Regular [C] | `#c0c0c0` | `10-15-Catalina-Light-Contacts.png @ 1127,128,105,23` |
| "Company" checkbox (light, edit mode) | box x 1126..1149, y 165..188; label ink from x 1161 | not shown: view mode | small `checkbox`, 12 box; label ink 22 px from cap top to descender, so 12 pt [C] (uncertainty 1 pt), 6 after the box | see `checkbox` | `10-15-Catalina-Light-Contacts.png @ 1126,165,133,25` |
| Segmented control "Info / Picture" (light) | x 1170..1599, y 246..285 | not shown: view mode | 215 x 20 | see `segmented-control` (Contacts custom variant) | `10-15-Catalina-Light-Contacts.png @ 1170,246,430,40` |
| Remove buttons (light, edit mode) | first at x 930..957, y 328..355 | not shown: view mode | 14 discs with a white minus; 35 from the card's left edge | red; see `round-button` | `10-15-Catalina-Light-Contacts.png @ 930,328,28,28` |
| Field label column (light) | label ink ends x 1074..1075; chevrons x 1091..1102; values from x 1128 | - | labels right-aligned 107.5 from the card's left edge; chevron glyph 6 x 10, 8 after the label; value 12.5 after the chevrons | label links blue, fixed labels grey | `10-15-Catalina-Light-Contacts.png @ 951,661,222,24` |
| Row separators | x 930..1839 at y 420, 526, 584, 642, 700, 758, 808 (those from y 420 to 584 are partly covered by the open menu at x below 1166) | x 956..1865 at y 420 and 478 | 455 wide, 1 thick; single-line rows are 29 apart, the two-line phone group (y 420 to 526) is 53; inset 35 from the card's left and right edges | light `#e6e6e6`, dark `#333435` | `10-15-Catalina-Light-Contacts.png @ 930,642,910,2`; `10-15-Catalina-Dark-Contacts.png @ 956,420,910,2` |
| Action buttons (dark, view mode) | not shown: the light capture is in edit mode | discs at x 1219, 1331, 1443, 1555 (each 48 px), y 260..307 | four 24 discs, pitch 56; top 103 below the window top | fill `#343536`, glyph `#676868` | `10-15-Catalina-Dark-Contacts.png @ 1243,250,1,95` |
| Action captions (dark) | not shown | ink tops y 320; "message" ink x 1201..1284 | 11 pt Regular [C] (ink height 16 px from x-height top to descender), centred under each disc, ink top 6 below the disc | `#ffffff` | `10-15-Catalina-Dark-Contacts.png @ 1201,320,400,20` |
| "FaceTime" row label (dark) | not shown | ink x 1153..1257, y 382..401 | 13 pt Regular [C]; aligned with the name's left edge | - | `10-15-Catalina-Dark-Contacts.png @ 1153,382,105,20` |
| Bottom "+" button | x 931..998, y 843..883 | x 958..1023, y 864..901 | light 34 x 20 plus shadow row; dark 33 x 19; 35.5 from the card's left edge; bottom 13 above the window bottom | see `push-button` | `10-15-Catalina-Light-Contacts.png @ 931,843,68,41`; `10-15-Catalina-Dark-Contacts.png @ 958,864,66,38` |
| "Done" (light) / "Edit" (dark) button | x 1619..1736, y 843..883 | x 1646..1761, y 864..901 | light 59 wide, dark 58 wide | "Done" title blue (accent text), "Edit" title standard | `10-15-Catalina-Light-Contacts.png @ 1619,843,118,41`; `10-15-Catalina-Dark-Contacts.png @ 1646,864,116,38` |
| Share button | x 1757..1838, y 843..883 | x 1784..1863, y 864..901 | light 41 wide, dark 40 wide; 10 (light) / 11 (dark) after the Done/Edit button; right edge 35.5 from the window's right edge | see `push-button` with image | `10-15-Catalina-Light-Contacts.png @ 1757,843,82,41`; `10-15-Catalina-Dark-Contacts.png @ 1784,864,80,38` |

- Field rows: right-aligned label column (blue `label` links such as "mobile", "home page"; grey for fixed labels "text tone", "birthday"), value column starting 12.5 pt after the chevrons (see the table) [M]; 1 pt separators `#e6e6e6` (dark `#333435`); the first one happens to be at image y=420 in both captures although the frames differ (light frame top y=34, dark y=54), and the full list is in the table [M] 10-15-Catalina-Light-Contacts.png @ 1500,420,1,2; 10-15-Catalina-Dark-Contacts.png @ 1500,420,1,2.
- Selected text in the phone field: `#b9d7fb (sRGB #b2d7ff)` [M] @ 1126,344.
- Dark view mode also shows the "work" label rendered as a grey capsule while its row is hovered and a small blue mail badge at the row's right end (see `token-field` and the coverage record for their crops).

## Content in the screenshot
Sidebar: "All Contacts" (selected); "iCloud" > "All iCloud"; "On My Mac" > "All on My Mac". List: "Apple Inc.", "Stephen Hackett" (selected), light only: second "Stephen Hackett" with a "me" silhouette. Card (light, editing): "Stephen Hackett", "Company", "[ ] Company", "Info | Picture", "mobile  Phone", "iPhone  Phone", "work  ...@hackett.fm", "text tone  Note", "home page  URL", "birthday  month/day/year", "home  User Name  Jabber"; menu: home, work (checked), other, Custom...; buttons "+", "Done". Card (dark): "Stephen Hackett"; message / call / video / mail; "FaceTime"; "work"; "note"; menu: Send Email, Send Message (highlighted), Search with Spotlight; buttons "+", "Edit".

## Not reproducible / assets needed
Wallpaper-dependent sidebar tint (use the opaque fallback); share and action glyphs.

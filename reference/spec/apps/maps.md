# Maps
- **Screenshots:** 10-15-Catalina-Light-Maps.png, 10-15-Catalina-Dark-Maps.png (a place-card popover for "Apple Park" is open and overlaps the toolbar; in light it extends above the window top)
- **Window:** 1000 x 690 pt [M] (light: image x=112..2111, y=94..1473; dark: x=112..2111, y=76..1455). Unified toolbar with hidden title (38 pt) plus a window tab bar with two tabs.

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Toolbar (`toolbar`, title hidden) | 38 (light y 94..169, dark y 76..151) | top lines `#f5f5f5`, `#ececeb`; fill `#e5e5e5` to `#d7d7d7`; bottom lines `#c7c7c7`, `#b1b1b1` | top lines `#7e8081`, `#737577`; fill `#424447` to `#3b3c3f`; bottom lines `#4a4b4d`, `#57585a` | [M] `10-15-Catalina-Light-Maps.png @ 1640,94,1,76`; `10-15-Catalina-Dark-Maps.png @ 1640,76,1,76` |
| Tab bar (`window-tab-bar`), two tabs and a "+" cell at the right | 25 = 24 fill + two 0.5 lines (light y 170..219, dark y 152..201) | fill `#c1c1c1` to `#b7b7b7`; bottom lines `#a8a8a8`, `#929292` | fill `#202123` to `#1e1f20`; bottom lines `#181819`, `#000000` | [M] `10-15-Catalina-Light-Maps.png @ 1640,170,1,50`; `10-15-Catalina-Dark-Maps.png @ 1640,152,1,50` |
| Map (MapKit view; see `web-view` and `map-controls`) | 1000 x 627 (light y 220..1473, dark y 202..1455) | land `#f8f5ee (sRGB #f9f5ed)` | land `#2b2d2f` | [M] `10-15-Catalina-Light-Maps.png @ 1960,1424`; `10-15-Catalina-Dark-Maps.png @ 1640,204` |
| Place card (`popover`), body | 320 x 600 (light x 426..1065, y 64..1263). It starts 15 above the window top and 157 from the window's left edge | fill `#f2f2f2`; outer edge pixel `#b1b1b1` at x=425 | fill `#282828` (x 428..1063, y 104..1299) inside a 1 pt rim `#535353` and a 0.5 pt outer line `#060606` | [M] `10-15-Catalina-Light-Maps.png @ 420,700,650,1`; `10-15-Catalina-Dark-Maps.png @ 420,700,650,1` |
| Place card header strip | 34 (light y 64..131) with a 1 pt separator below (y 132..133) | separator `#dbdbdb` | fill y 104..169 (33) with a 1 pt separator `#4b4b4b` at y 170..171 | [M] `10-15-Catalina-Light-Maps.png @ 700,64,1,72`; `10-15-Catalina-Dark-Maps.png @ 700,98,1,82` |
| Place card arrow, on the right edge pointing at the pin | base 22 (light y 642..685 at x=1067), 11 deep (tip at x=1088, y=662); the arrow is centred on the card's height (300 below its top) | fill `#f2f2f2` | tip at x=1086, y=701; fill `#282828` | [M] `10-15-Catalina-Light-Maps.png @ 1067,600,1,120`; `10-15-Catalina-Dark-Maps.png @ 1069,640,1,120` |

Toolbar (px, light row y=132): "Directions" button from x=267 (partly hidden by the popover); search field visible from about x=1066 to 1492 with a clear button; Share 1507..1588 (41 pt); map-type segmented control "Map | Transit | Satellite" 1621..2096 (238 pt, "Map" selected) [M].

```
[o o o] [Directions] [^] [ search field .............(x)] [share] [Map|Transit|Satellite]
[ tab 1                        |  Manhattan - Jersey City                           ][+]
|   +- place card -------+                                              72 deg  AQI 49
|   | Apple Park         |
|   | [Directions]       |              (map)                 (pin) APPLE PARK
|   | [photos]           |
|   | Address ...        |                                               (compass 3D)
| [Show v]               |                                                  [- | +]
```

## Components used
`window`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-search-field`, `toolbar-segmented-control`, `window-tab-bar`, `popover`, `push-button` ("Directions", "Call" disabled, full-width in the card), `image-view`, `label` (links), `separator`, `map-controls` (zoom pair, compass/3D, "Show" pop-up), `pop-up-button`.

## App-specific elements
- Map overlay, top-right: weather glyph + "72\u00b0" 17 pt, and a green "AQI 49" capsule (white 10 pt Bold text) below it.
- Map pin: red ball pin with a ground-shadow ring at Apple Park; POI labels in category colours (orange food, pink medical, green parks, brown/grey others); roads white on `#f8f5ee (sRGB #f9f5ed)`, highways yellow; dark map uses dark grey land with lighter roads and orange highways.
- Place card contents. Image px in the light capture (card body x 426..1065, y 64..1263). In the dark capture every element is at the same x and 38 px lower (38 or 39 for the two header buttons), which is the same position relative to the card's outer edge. Offsets in pt are from the card body's top-left corner.

| Element | Image px (light) | Size and position (pt) | Light | Dark | Tag | Evidence |
|---|---|---|---|---|---|---|
| Favourite (heart) button | x 888..962, y 79..118, shadow to y 120 | 37.5 x 20; top 7.5 below the card top | white bezel, glyph `#262626` | fill `#646464`, glyph `#f0f0f0` (y 118..155) | [M] | `10-15-Catalina-Light-Maps.png @ 925,74,1,52`; `10-15-Catalina-Dark-Maps.png @ 925,112,1,52` |
| Share button | x 981..1048, y 79..118 | 34 x 20; 9 after the heart button; right edge 8.5 from the card's right edge | same | same | [M] | `10-15-Catalina-Light-Maps.png @ 981,79,68,41` |
| Header separator | y 132..133, full card width | 1 thick, 34 below the card top | `#dbdbdb` | `#4b4b4b` | [M] | `10-15-Catalina-Light-Maps.png @ 700,64,1,72` |
| Title "Apple Park" | ink x 457..610, y 167..195 | ink starts 15.5 from the left edge; cap top 51.5 below the card top | `#3f3f3f` | `#ffffff` | [M] | `10-15-Catalina-Light-Maps.png @ 457,167,154,29` |
| Title font | ink height 29 px including descenders | 15 pt, Bold | - | - | [C] size (uncertainty 1 pt); [I] weight | same |
| Subtitle "Corporate Headquarters, 1,786 mi" | ink x 457..845, y 203..226 | 13 pt [C]; ink top 18 below the title's ink top | `#252525` | `#dedede` | [M] | `10-15-Catalina-Light-Maps.png @ 457,203,389,24` |
| "Directions" button (`push-button`, full width) | x 457..1034, y 296..335, shadow to y 337 | 289 x 20; 15.5 from each side; top 116 below the card top | fill `#ffffff`, title `#262626` | fill `#646464` (y 337..372), title `#f0f0f0` | [M] | `10-15-Catalina-Light-Maps.png @ 700,290,1,55`; `10-15-Catalina-Dark-Maps.png @ 700,328,1,52` |
| Photo mosaic | x 456..1035, y 370..623 | 290 x 127; top 153 below the card top | photographs | same photographs | [M] | `10-15-Catalina-Light-Maps.png @ 456,500,581,1` |
| Mosaic cells | large x 456..839; right column x 844..1035; right cells y 370..494 and 499..623 | large 192 x 127; two small 96 x 62.5; gaps 2 | gap shows the card fill | same | [M] | `10-15-Catalina-Light-Maps.png @ 456,500,581,1`; `10-15-Catalina-Light-Maps.png @ 950,366,1,262` |
| "More Photos on WIKIPEDIA" | ink x 567..925, y 652..678 | centred; ink top 14 below the mosaic | link `#2f7cf6 (sRGB #027aff)`; the wordmark is an image | link `#49a0d4 (sRGB #18a1d9)` | [M] | `10-15-Catalina-Light-Maps.png @ 567,652,359,27` |
| "Call" button (disabled) | x 457..1034, y 745..784 | 289 x 20; top 340.5 below the card top | fill `#f9f8f9`, title `#bababa` | fill `#4c4c4c`, title `#787878` | [M] | `10-15-Catalina-Light-Maps.png @ 700,740,1,50` |
| Section heading "Address" | ink x 456..554, y 837..856 | 13 pt Bold [C]/[I weight]; ink top 386.5 below the card top | `#3f3f3f` | `#ffffff` | [M] | `10-15-Catalina-Light-Maps.png @ 456,837,99,20` |
| Address lines | ink tops y 872, 902, 932, 961 | 13 pt [C]; line pitch 15; first line 17.5 below the heading's ink top | `#3f3f3f` | `#ffffff` | [M] | `10-15-Catalina-Light-Maps.png @ 456,872,236,109` |
| Section separators | x 456..1035 at y 1006 and 1108 | 290 wide, 1 thick, inset 15 from each side; 12.5 below the last line's ink bottom | `#dbdbdb` | `#4b4b4b` | [M] | `10-15-Catalina-Light-Maps.png @ 456,1006,580,2` |
| "Phone" heading and value | heading ink y 1029..1048; value y 1064..1085 | heading ink top 11.5 below the separator's top edge; value 17.5 below the heading's ink top | as Address | as Address | [M] | `10-15-Catalina-Light-Maps.png @ 457,1029,212,57` |
| "Website" heading and link | heading ink y 1131..1150; link "apple.com" y 1166..1188 | same rhythm as Phone | link `#2f7cf6 (sRGB #027aff)` | link `#49a0d4 (sRGB #18a1d9)` | [M] | `10-15-Catalina-Light-Maps.png @ 457,1131,115,58` |
| "Wikipedia" heading and "Open Wikipedia" link | ink y 1235..1258; heading x 457..573, link x 859..1034 | one row; the link is right-aligned 15.5 from the card's right edge; the card's visible area ends 2.5 below this row (the content scrolls) | heading as Address; link `#2f7cf6 (sRGB #027aff)` | link `#49a0d4 (sRGB #18a1d9)` | [M] | `10-15-Catalina-Light-Maps.png @ 457,1235,578,24` |
- Bottom-left "Show" pop-up and bottom-right zoom/compass: see `map-controls` (measured there).

## Content in the screenshot
Toolbar: "Directions"; segments "Map", "Transit", "Satellite". Tab title "Manhattan \u2014 Jersey City". Map labels include: E Homestead Rd, N Tantau Ave, Apple Park Visitor Center, Steve Jobs Theater, Caff\u00e8 Macs - Apple Park, Kaiser Permanente Santa Clara Medical Center and Medical Offices, Westwood Oaks Park, Hyatt House San Jose/Cupertino, Benihana, I-280 shield, "APPLE PARK". Weather "72\u00b0", "AQI 49". Card: "Apple Park"; "Corporate Headquarters \u00b7 1,786 mi"; "Directions"; "More Photos on Wikipedia"; "Call"; "Address": Apple Inc. / One Apple Park Way / Cupertino, CA 95014 / United States; "Phone": +1 (408) 996-1010; "Website": apple.com; "Wikipedia" / "Open Wikipedia". Pop-up "Show"; compass "3D".

## Not reproducible / assets needed
Map tiles (use a static map image per appearance), place photos, Wikipedia wordmark, pin, compass and weather artwork.

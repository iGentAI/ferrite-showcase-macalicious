# Font Book
- **Screenshots:** 10-15-Catalina-Light-Font-Book.png, 10-15-Catalina-Dark-Font-Book.png
- **Window:** 1017 x 603 pt [M] (image x=112..2145, y=76..1281). Title bar + toolbar, 55 pt (y=76..185). Title "All Fonts (281 Fonts)".

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Title + toolbar | 55 | gradient `#f6f6f6` -> `#c4c4c4`, line `#a7a7a7` | `#38393a`, line `#000000` | [M] Light-Font-Book @ 250,76,1,110; Dark @ 500,180,1,6 |
| Collections sidebar (`sidebar`) | 200 wide (x=112..511) | `#e6e7e7` | `#2c2d2f` | [M] @ 300,1180 |
| Divider | 1 | `#cecfcf` | `#000000` | [M] @ 512,1180 |
| Font list (`outline-view`) | 200 wide (x=514..913), rows 18 | `#ffffff` | `#1e1f21` | [M] @ 880,1160 / Dark @ 600,1180 |
| Divider | 1 | `#d5d5d5` | `#000000` [C] | [M] Light @ 914,700 |
| Preview pane | 615 wide (x=916..2145) | `#ffffff` | `#1e1f21` | [M] @ 1000,700 |

Toolbar (px, row y=148): view-mode segmented control (Sample | Repertoire | Custom | Info) 127..398 (136 pt, first segment selected); "+" 521..622 (51 pt); enable/disable checkbox button 637..738 (51 pt, dimmed); search field with a scope chevron 1287..2130 (422 pt) [M].

```
                        All Fonts (281 Fonts)
 [=|grid|AaI|i]      [ + ] [ v ]                     [Q- Search                     ]
+ [F] All Fonts ---+ > Toppan Bunkyu ...   +                         Size: [42 v]
| Smart Collection | > Trattatello         |          Zapf Dingbats Regular           |
|  [F] English     | > Trebuchet MS        |   (six rows of dingbat glyphs, 42 pt)    |slider
|  [*] Fixed Width | ...                   |                                           |
| Collection       | v Zapf Dingbats       |                                           |
|  [A] Fun ...     |     Regular  <- sel   |                                           |
| +                | > Zapfino             |                                           |
```

## Components used
`window`, `title-bar`, `window-controls`, `toolbar`, `toolbar-segmented-control`, `toolbar-button`, `toolbar-search-field`, `sidebar` (grey selection "All Fonts"; first row starts 5 pt under the toolbar), `split-view`, `outline-view` (collapsed families, emphasized selection on "Regular"), `combo-box` ("Size: 42"), `slider` (vertical, accent-filled, at the right edge), `text-view` (preview, read-only), `image-button` ("+" at the sidebar bottom).

## App-specific elements
- Sidebar icons: 16 pt outlined glyphs (boxed "F", gear, boxed "A"), template grey; headers "Smart Collection", "Collection".
- Font list: 13 pt names; families that are not active are grey; triangle 8.5 pt from the pane edge, label at 21.5 pt, child style label at 37 pt [M] see `outline-view`.
- Preview: font name title centred, about 18 pt grey ("Zapf Dingbats Regular"); sample glyph rows at the chosen size, centred, black (light) / light grey (dark).
- Size control, top-right of the preview pane (frame x 112..2145, y 76..1281 in both captures) [M]: label "Size:" 13 pt [C], ink x 1949..1996; `combo-box` x 2023..2124, y 215..254 (51 x 20 pt: field 33.5 pt, accent cap fill x 2091..2122 = 16 pt), 13 pt after the label, right edge 10.5 pt from the window edge, top 69.5 pt below the window top. Vertical `slider` below it: track x 2086..2091 (3 pt wide), y 272..1241 (485 pt long), unfilled `#c8c8c8` (dark `#3d3d3d`), filled from the bottom up to the knob with `#4d8af5 (sRGB #3b89fd)` (dark `#2e6cde (sRGB #176ae6)`); round knob 16 pt (light x 2073..2104, y 1099..1129, white with a `#d3d3d3` edge; dark fill `#c6c7c7`). Track centre is 28 pt from the window's right edge. `10-15-Catalina-Light-Font-Book.png @ 1940,220,206,1`; `10-15-Catalina-Light-Font-Book.png @ 2070,600,40,1`; `10-15-Catalina-Light-Font-Book.png @ 2070,1200,40,1`; `10-15-Catalina-Dark-Font-Book.png @ 2070,600,40,1`; `10-15-Catalina-Dark-Font-Book.png @ 2070,1200,40,1`.

## Content in the screenshot
Sidebar: "All Fonts" (selected); "Smart Collection": English, Fixed Width; "Collection": Fun, Modern, PDF, Traditional, Web; "+". Font list (visible part): Toppan Bunkyu Midashi G..., Toppan Bunkyu Midashi Mi..., Toppan Bunkyu Mincho, Trattatello, Trebuchet MS, Tsukushi A Round Gothic, Tsukushi B Round Gothic, Verdana, Waseem, Wawati SC, Wawati TC, Webdings, Weibei SC, Weibei TC, Wingdings, Wingdings 2, Wingdings 3, Xingkai SC, Xingkai TC, Yuanti SC, Yuanti TC, YuGothic, YuKyokasho, YuKyokasho Yoko, YuMincho, YuMincho +36p Kana, Yuppy SC, Yuppy TC, Zapf Dingbats > Regular (selected), Zapfino. Preview title "Zapf Dingbats Regular"; "Size:" 42. Search placeholder "Search".

## Not reproducible / assets needed
The Zapf Dingbats sample needs that font (or an image of the six glyph rows); toolbar glyphs.

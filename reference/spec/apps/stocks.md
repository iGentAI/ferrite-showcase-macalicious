# Stocks
- **Screenshots:** `10-15-Catalina-Light-Stocks.png`, `10-15-Catalina-Dark-Stocks.png` (window captures)
- **Window:** 1148 x 803 pt [M] (`@ 112,76,2296,1606` in both). Mac Catalyst app: unified 38 pt toolbar with centred title; watchlist sidebar; scrolling business-news pane.

## Layout
Evidence shorthand: `Light @` / `Dark @` are the two screenshots above; a bare `@ x,y[,w,h]`, `row y=` or `col x=` refers to the Light file and holds at the same coordinates in the Dark file for the toolbar and sidebar (the Dark news pane has different content).

Positions in pt from the window's top-left (image px = 2 x pt + (112, 76)).

| Region | x, y, w, h | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Toolbar | 0, 0, 1148, 37 | `#e4e4e4` -> `#cccbcc` | `#37393a` -> `#2d2f30` (top 2 px `#808181`, `#707273`) | [M] `@ 600,78`, `@ 600,149` |
| Toolbar lines | 0, 37, 1148, 1 | `#bdbdbd`, `#a6a6a6` | `#242626`, `#000000` | [M] col x=600 @ y=150, 151 |
| Sidebar | 0, 38, 329.5, 765 | `#e7e8e9` | `#2c2d2f` | [M] `@ 130,172`; Dark `@ 600,155` |
| Sidebar divider | 329.5, 38, 0.5, 765 | `#d9dada` | `#313334` then `#151515` | [M] `@ 771,1000`; Dark `@ 771,1000`, `@ 772,1000` |
| News pane | 330, 38, 818, 765 | `#ffffff` | `#1e1e1e` | [M] row y=250 from x=772 |
| News column | 493.5, -, 493, - (centred in the pane) | - | - | [M] images x=1099..2084 |

```
 +--------------------------------------------------------------------------+ 0
 |(o)(o)(o) [<]                     Stocks                           [share] | 38
 +----------------------+---------------------------------------------------+
 | [ Search           ] |          Top Stories            (36 pt Heavy)     |
 |----------------------|          +---------------------------+           |
 | Business News        |          |      image 493 x 277      |           |
 | From (apple)News     |          +---------------------------+           |
 |----------------------|          FOX BUSINESS                             |
 | Dow Jones   ~~ 26,201.04        MGM Resorts to pay up to ...             |
 | Dow Jones I..  [+122.42]        1h ago                                   |
 |----------------------|          +-----------+   +-----------+           |
 | S&P 500     ~~  2,910.63        | 234 x 175 |   | 234 x 175 |           |
 | ...  (10 rows)       |          +-----------+   +-----------+           |
 |----------------------|                                                   |
 | YAHOO!               |                                                   |
 +----------------------+---------------------------------------------------+ 803
```

### Toolbar items (pt)
| Item | x, y, w, h | Tag / evidence |
|---|---|---|
| Traffic lights | x 13, 33, 53; y 13 | [M] row y=114 |
| Back | 77.5, 7.5, 39, 23 (disabled, glyph `#acacac`) | [M] x=267..344 |
| Title `Stocks` | centred; 13 pt | [I] preview-only type estimate; same style as News |
| Share | 1101.5, 7.5, 39, 23 (disabled) | [M] x=2315..2392 |

### Sidebar (pt)
| Element | x, y, w, h | Style (Light / Dark) | Tag / evidence |
|---|---|---|---|
| Search field | 12.5, 43, 305, 28; radius about 5 | fill `#d1d1d4` / `#27292c`; placeholder `Search` 13 pt `#9d9d9f`; magnifier `#656666` at x 18.5 | [M] `@ 137,162,610,56`; `@ 600,190` |
| Separator | 0, 76, 330, 0.5 | `#aeaeae` | [M] col x=600 @ y=228 |
| `Business News` cell | 0, 77, 330, 48.5 | fill `#f2f2f3` / `#585959` | [M] `@ 600,280`; col x=600: 230..326 |
| Cell title | x 13.5; cap top y 87 | 14 pt Semibold, `#000000` / `#f0f0f0` | [M] `@ 139,250,193,20` |
| Cell subtitle `From  News` | x 13.5; cap top y 106 | 12 pt Semibold, `#818187 (sRGB #818188)` / `#ffffff`; includes the Apple logo glyph | [M] `@ 139,288,152,18` |
| Stock rows (10) | y 126 + 48.25 n; 330 x 48.25 | - | [M] separators at y=422, 518.5, 615 px |
| Row separator | x 12.5 to the sidebar edge, 0.5 pt (some separators straddle 2 fainter image rows) | `#dcdcdd` / `#333436` | [M] `@ 300,422`; row y=422 from x=137 |
| Symbol | x 13.5; cap top 10.5 below the row top | 14 pt Medium, `#000000` / `#e9e9ea` | [M] `@ 139,349,139,20` |
| Company name | x 13.5; top 28 below the row top | 12.5 pt Regular, `#808080` / `#9c9ca2 (sRGB #9c9ca3)`; truncated before the sparkline | [M] `@ 139,383,297,19` |
| Sparkline | x 194, 14 below the row top; 55 x 25 | 1.5 pt line with gradient fill and a dashed previous-close line (2.3 on, 1.5 off); gain line `#76d472 (sRGB #4cd864)` / dark `#76d371 (sRGB #4dd763)`, loss line `#ec4d3d (sRGB #ff3b30)` | [M] line extents x=500..609; Light col x=580 y=373..375; see `stock-row` |
| Price | right edge x 316.5; cap top 11 below the row top | 13 pt Regular, `#000000` / `#ededed`, right-aligned, tabular | [M] `@ 620,350,126,19` |
| Change badge | x 259.5, 26 below the row top; 58.5 x 17.5; radius 2.5 | fill `#65c366 (sRGB #35c759)` (gain) / `#ec4d3d (sRGB #ff3b30)` (loss), same in dark; text white 11.5 pt Semibold, right-aligned 4.5 pt inside | [M] core y=379..413; `@ 631,378,117,36`; `@ 745,395`, `@ 745,877` |
| Footer separator | 0, 764, 330, 0.5 | `#b9baba` / `#3c3d3e` | [M] col x=300 @ y=1604 |
| Footer logo `YAHOO!` | 12.5, 778.5, 42 x 10 | `#676768` | [M] `@ 137,1633,84,20` |

### News pane (pt, Light)
| Element | x, y, w, h | Style (Light / Dark) | Tag / evidence |
|---|---|---|---|
| `Top Stories` | x 494; cap top y 61.5 | 36 pt Heavy, `#000000` / `#eaeaea` | [M] `@ 1100,199,379,51` |
| Lead image | 493.5, 111, 493, 277; radius 3 | image | [M] `@ 1099,298,986,554` |
| Publisher logo | top y 397 | image, about 11 pt tall | [M] ink 870..891 px |
| Lead headline (2 lines) | cap top y 422; 24 pt pitch | 20.5 pt Bold, `#000000` / light | [M] `@ 1101,920,30,29` |
| Lead timestamp | top y 475.5 | 11 pt Bold, `#7e7e83` | [M] `@ 1100,1027,68,21` |
| 2-up images | 493.5 and 752, y 502; 234.5 x 175.5 (24 pt gap); radius 3 | image | [M] rows 1080..1430 px; row y=1250: images 1099..1567 and 1616..2084 |
| 2-up logo / headline / timestamp | logo top y 687; headline cap top y 709 (16.5 pt pitch, 2 lines); timestamp y 749.5 | 15.5 pt Bold; 11 pt Bold `#75757b (sRGB #75757c)` | [M] ink rows 1450, 1493, 1526, 1575 px |
| Next row | starts y 776 (cut off by the window) | - | [M] ink from 1628 px |

The Dark capture shows a different feed layout: the lead story is an image (298 x 224 pt) with the publisher logo, headline, summary and timestamp to its right, followed by two rows of 2-up cards. The lead-image size is a preview estimate [I], not a pixel measurement; dark feed typography and precise text placement remain unmeasured.

## Components used
- `catalyst-chrome`: toolbar, type scale, colours.
- `toolbar`, `toolbar-button`, `title-bar`, `window-controls`, `window`, `window-shadow`.
- `search-field` (iOS-style 28 pt filled field), `list-view` (watchlist), `separator`, `split-view`, `scroll-view`.
- `stock-row`: measured watchlist row, price/change badge and sparkline.
- `card-grid` (story cards).

## App-specific elements
- Watchlist row (48.25 pt): symbol + name on the left, sparkline, price over change badge on the right. All measurements in `components/stock-row.md` (the Sidebar table above is a summary).
- `Business News` cell: highlighted when the news pane shows business news (light: slightly lighter than the sidebar; dark: clearly lighter `#585959`).

## Content in the screenshot
| Symbol | Name | Light price | Light change | Dark price | Dark change |
|---|---|---|---|---|---|
| Dow Jones | Dow Jones Industrial Average | 26,201.04 | +122.42 | 26,428.87 | +227.83 |
| S&P 500 | S&P 500 | 2,910.63 | +23.02 | 2,936.49 | +25.86 |
| AAPL | Apple Inc. | 220.82 | +1.86 | 225.99 | +5.17 |
| BA | The Boeing Company | 372.07 | +4.71 | 374.76 | +2.69 |
| BRK-B | Berkshire Hathaway Inc. | 204.98 | +1.88 | 206.68 | +1.70 |
| DIS | The Walt Disney Company | 128.15 | -0.99 (red) | 129.62 | +1.47 |
| GE | General Electric Company | 8.71 | +0.20 | 8.63 | -0.08 (red) |
| HD | The Home Depot, Inc. | 226.81 | +1.26 | 229.06 | +2.25 |
| NKE | NIKE, Inc. | 92.22 | +0.73 | 92.49 | +0.27 |
| SBUX | Starbucks Corporation | 84.67 | +0.35 | 85.74 | +1.07 |

Other sidebar strings: `Search`, `Business News`, `From  News`, `YAHOO!`.

News pane, Light: `Top Stories`; FOX BUSINESS: `MGM Resorts to pay up to $800 million in Vegas` / `massacre settlement`, `1h ago`; CNBC: `Stocks rise on hopes the Fed will cut` / `rates again`, `56m ago`; POLITICO: `Trump expands private Medicare` / `coverage in new executive order`, `56m ago`; next row (cut off): ProPublica `IRS: Sorry, but it’s…`, MarketWatch `Delta’s stock…`.

News pane, Dark: `Top Stories`; MarketWatch: `Stock market jumps to` / `Friday peak after modest job` / `gains, unemployment falls to` / `50-year low`, summary `Stocks rise Friday after a September jobs report showed steady employment gains, but left open the door for further central-bank stimulus.`, `28m ago`; Bloomberg: `U.S. payrolls, wages miss estimates` / `in new sign of downshift`, `28m ago`; THE WALL STREET JOURNAL: `New York Fed adds about $38.55` / `billion to financial system`, `28m ago`.

Menu bar (not captured) [D]: Stocks, File, Edit, View, Window, Help.

## Not reproducible / assets needed
- News photographs and publisher logos (placeholders).
- Sparklines: draw as SVG polylines from sample data (shape is data-dependent).
- Apple logo glyph in `From  News` and the `YAHOO!` wordmark.

# Safari 13

## Screenshots and window frames

Sizes are opaque-frame sizes in pt [M], not shadow-inclusive image sizes. `$M info` supplies the alpha-capture frames. Sharing and PiP are opaque region/desktop captures: info supplies **capture size only**, so their frame edges were measured with row/column runs [M]. Rectangles elsewhere are frame-relative pt [C]; source evidence uses original image px.

| Screenshot | Frame size (pt) [M] | Frame evidence (px) | State [M] |
|---|---|---|---|
| `10-15-Catalina-Light-Safari-v13.png` | 1324 × 940 | `@ 112,76,2648,1880` | Three tabs, middle active, Reader available, third-party page |
| `10-15-Catalina-Dark-Safari-v13.png` | 1254 × 903 | `@ 112,76,2508,1806` | Same chrome state; dark page |
| `10-15-Catalina-Light-Safari-v13-Favorites.png` | 1324 × 940 | `@ 112,76,2648,1880` | Start page; Bookmarks sidebar open; address empty/unfocused |
| `10-15-Catalina-Dark-Safari-v13-Favorites.png` | 1254 × 903 | `@ 112,76,2508,1806` | Same, address empty/focused |
| `10-15-Catalina-Light-Safari-v13-Reader-Mode.png` | 1324 × 940 | `@ 112,76,2648,1880` | Third tab active, Reader on, light paper |
| `10-15-Catalina-Dark-Safari-v13-Reader-Mode.png` | 1254 × 903 | `@ 112,76,2508,1806` | Same, dark Reader paper |
| `10-15-Catalina-Light-Safari-v13-Tab-Overview.png` | 1324 × 940 | `@ 112,76,2648,1880` | Three thumbnails plus new-tab tile; no tab strip |
| `10-15-Catalina-Dark-Safari-v13-Tab-Overview.png` | 1254 × 903 | `@ 112,76,2508,1806` | Same, narrower thumbnails |
| `10-15-Catalina-Light-Safari-v13-Sharing.png` | 1254 × 864 | `@ 7,35,2508,1728` | Region capture: Share menu open, Messages highlighted; single page, no tab strip |
| `10-15-Catalina-Dark-Safari-v13-Sharing.png` | 1254 × 903 | `@ 25,19,2508,1806` | Same; menu extends over desktop |
| `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png` | 1254 × 864 | `@ 316,104,2508,1728` | Full desktop, inactive Safari, two tabs, video in floating PiP |
| `10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png` | 1254 × 903 | `@ 344,78,2508,1806` | Same; third-party source player controls visible |

Sharing frame evidence: `$M row … 70` light / `54` dark, x=0..380 and right edge; `$M col … 500 15 125` light / `5 110` dark and bottom at y=1750..1775 / 1814..1840. PiP frame evidence: rows y=1780 at both left/right edges; columns x=600 at y=96..110 / 70..84 and bottoms y=1825..1842 / 1875..1893 [M]. Capture sizes: Sharing **1331 × 902 pt light**, **1342 × 923.5 pt dark**; PiP **1680 × 1050 pt** both [M] (`$M info`).

## Layout

| Region | Geometry (pt) [C] | Light background [M] | Dark background [M] | Evidence / provenance |
|---|---|---|---|---|
| Unified toolbar, no separate title line | `(0,0,W,38)` | gradient samples `#e5e5e5` near top → `#d7d7d7`; separator `#c8c8c8` / `#b1b1b1` | `#3f4042` → `#39393b`; separator `#494949` / `#535557` | [M] `$M col` of both base Safari PNGs x=500 y=76..208; do not include tab text in the dark gradient sample |
| Tab strip, base / Reader / PiP only | `(0,38,W,25)` | inactive `#c0c0c0` → `#b8b8b8`; active `#d6d6d6` → `#cccccc` | inactive `#1f1f20` → `#1c1d1e`; active `#38393b` → `#343436` | [M] base PNGs `@ 300,152,1,48`, `@ 1400,152,1,48`; use `safari-tab-bar`; PiP uses its inactive-window variant |
| Third-party base page | `(0,63,W,H−63)` | `#ffffff` observed | `#202020` observed | [M] `10-15-Catalina-Light-Safari-v13.png @ 2300,300`; dark same. Content is a placeholder region, not a library page |
| Favorites/sidebar surfaces | under toolbar at y=38; sidebar **325 pt** plus **1 pt** divider, remaining start page | `#e7e9ea`; divider `#cfd1d2` | `#2c2d30`; dark divider uses component | [M] both Favorites PNGs `@ 500,300`, `@ 900,1000`; light row `@ 750,158,35,1` → sidebar x≤761, divider x=762..763, content x≥764 |
| Tab Overview canvas | `(0,38,W,H−38)` | `#e7e8e9` | `#2c2d30` | [M] both Tab-Overview PNGs `@ 1100,1200` |
| Reader canvas | `(0,63,W,H−63)` | `#e6e6e6` | `#323233` | [M] both Reader PNGs `@ 400,300` |
| Reader paper | light `(269,85,786,H−85)`; dark `(234,85,786,H−85)` | white | `#4a4a4d` | [C] paper edges light x=650..2221, dark x=580..2151, top y=246; [M] light `@ 670,300`, dark `@ 900,300`; `$M col` at paper's left edge y=235..270 |
| Share-menu composite | rect below | sampled `#bac4ce (sRGB #b8c4cf)` near top, `#b4cddd (sRGB #aecedf)` near bottom; highlight `#4180e9 (sRGB #2c7ff1)` | `#2b363f (sRGB #283640)` / `#2c4259 (sRGB #26425b)`; highlight `#2867cb (sRGB #0965d2)` | [M] Sharing light `@ 2500,110`, `@ 2500,450`, `@ 2600,250`; dark `@ 2520,90`, `@ 2520,445`, `@ 2620,230`; backdrop-dependent, use `share-menu` material |
| PiP | screen-relative rect below | video image, same appearance-independent region | video image | [M] both PiP PNGs `@ 2264,84,1056,594`; no solid app fill |

The Favorites **bar** is not shown in any of these captures [M]; `favorites-bar` is only a reference for a future uncaptured state, not another strip to add. “Frequently Visited” is also **not shown**, so no section coordinates, tiles or labels exist to measure [M].

```text
[lights] [back|forward] [sidebar]          [Smart Search]            [Share][Overview]
base/Reader/PiP: [tab 1][tab 2][tab 3 or +]                          [+]
Favorites:      [Bookmarks sidebar]       Favorites / icon grid     toolbar [+]
Overview:       [Google thumbnail][About thumbnail][Relay thumbnail][large +]
Reader:         grey canvas | centred paper / text + image placeholder | grey canvas
Sharing:        third-party page placeholder             [Share menu outside window]
PiP desktop:    inactive Safari + third-party placeholder  [floating video top-right]
```
Arrangement [M], the twelve source previews.

### Shared toolbar order and rectangles

Base and Reader, light outer bezels [C], measured at image y=100 in `10-15-Catalina-Light-Safari-v13.png` and Reader counterpart. Dark has borderless fills, **0.5 pt** horizontally inset from the corresponding light-like outer bezel [C], measured same row in Dark Safari. Glyph rendering comes from components.

| Order | Component / contents | Light rect (pt) [C] | Dark observed fill rect (pt) [C] | Image evidence [M] |
|---|---|---|---|---|
| Back | `toolbar-segmented-control`, left chevron, enabled | `(77.5,7.5,26,23)` | `(78,8,25,22)` | light x=267..318; dark x=268..317 |
| Forward | same, right chevron, disabled | `(103.5,7.5,26,23)` | `(104,8,25,22)` | light x=319..370; dark x=320..369 |
| Sidebar | `toolbar-button`, book-sidebar glyph | `(138.5,7.5,38,23)` | `(139,8,37,22)` | light x=389..464; dark x=390..463 |
| Smart Search | `smart-search-field` | `(394,7.5,536,23)`, inner fill **535 × 22** | `(373.5,8,507,22)` | light x=900..1971, fill 901..1970; dark x=859..1872; `$M row … 100` and component vertical bezel evidence |
| Share | `toolbar-button`, share arrow | `(W−90.5,7.5,38,23)` | `(W−90,8,37,22)` | light x=2579..2654; dark x=2440..2513 |
| Tab Overview | `toolbar-button`, overlapping squares | `(W−45.5,7.5,38,23)` | `(W−45,8,37,22)` | light x=2669..2744; dark x=2530..2603 |

Light search outer width includes borders; dark **507 pt**, not **535 pt**, is the measured field in the narrower window [M]. Do not apply the component's light-capture width globally.

**Favorites / Sharing toolbar:** add a new-tab cell at trailing edge [M]. Share shifts to light **`(W−115.5,7.5,38,23)`**, Overview to **`(W−70.5,7.5,38,23)`**; dark fills inset as above [C]. New-tab cell **`(W−25,12,25,26)`** [C], starts image x=2710 light Favorites / 2570 dark Favorites, and image y=100; it occupies the toolbar's lower trailing area, not a second tab row [M]. Evidence `$M row …Favorites.png 100` right edge. Sharing uses its measured smaller frame; Smart Search light outer **508 × 23 pt**, at frame **`(373,7.5)`**, image `(753,50,1016,46)`; dark fill **507 × 22 pt**, frame **`(373.5,8)`**, image `(772,35,1014,44)` [C]. Back/sidebar order and frame-relative x positions remain unchanged [M].

**Tab Overview toolbar:** same base positions, but sidebar dimmed in dark; no new-tab toolbar cell and no tab strip [M]. Empty unfocused Smart Search placeholder centred [M].

**PiP toolbar:** same base order in the inactive-window state; right-side items are occluded by floating video and must not be claimed as measured [M]. Light Smart Search outer **508 × 23 pt**, frame **`(373,7.5)`**, image `(1062,119,1016,46)`; dark fill **507 × 22 pt**, frame **`(373.5,8)`**, image `(1091,94,1014,44)` [C]. Search domain **“youtube.com”**, with lock, speaker/audio indicator before Reload [M].

### Smart Search inner content

Base domain **“512pixels.net”**; Reader / Sharing domain **“relay.fm”**; PiP **“youtube.com”**; Favorites / Overview **“Search or enter website name”** [M]. Native field text **13 pt Regular** [C] (cap-height module measured in `smart-search-field`).

| Base item | Light frame rect (pt) [C] | Dark frame rect (pt) [C] | Evidence [M] |
|---|---|---|---|
| Reader-available glyph | `(402,14,13.5,10)` | `(380.5,14,14,10)` | light `(916,104,27,20)`; dark row y=104 x=873..900 in base PNGs |
| Lock glyph envelope | `(618.5,14,8,10)` | `(583.5,14,8,10)` | base row y=114 lock x=1349..1364 / 1279..1294; vertical envelope y=104..123 |
| Domain text ink envelope | `(632,14,73.5,12.5)` | `(597,14,73.5,12.5)` | base light `@ 1376,104,147,25`; dark `@ 1306,104,147,25` |
| Reload envelope | `(912,12,11,13)` | `(862.5,12,11,13)` | light `@ 1936,100,22,26`; dark `@ 1837,100,22,26` |

Component `smart-search-field` owns glyph shapes. Empty light placeholder group image `(1257,102,370,25)` → frame **`(572.5,13,185,12.5)` pt** [C]; dark Overview centred in its narrower field [M]. Dark Favorites has a focus ring and left-aligned magnifier/text, image crop `(852,84,1030,60)` [M]; other empty captures are unfocused [M]. Reader active accessory fills leading **28 pt** of the field [C], measured run light x=901..956 and dark x=859..914 at y=100; trailing Reload is replaced by **“aA”** [M].

### Tab strip

Normal tab titles, in order: **“Google”**, **“About – 512 Pixels”**, **“Relay FM”** [M]. Middle tab active in the base captures. Reader changes the third title to **“About Relay FM - Relay FM”** and activates it [M]. No favicon or close glyph is visible [M]. Titles use `safari-tab-bar`, **11 pt Regular** [C] (cap-height module), centred in each cell.

| Cell | Light frame rect (pt) [C] | Dark frame rect (pt) [C] | Evidence [M] |
|---|---|---|---|
| Google | `(0.5,38,444.5,24)` | `(1,38,420,24)` | `$M row` base PNGs y=154: light x=113..1001; dark x=114..953 |
| About – 512 Pixels | `(446,38,432,24)` | `(422,38,409,24)` | light x=1004..1867; dark x=956..1773 |
| Relay tab | `(879,38,420,24)` | `(832,38,397,24)` | light x=1870..2709; dark x=1776..2569 |
| New-tab + | `(1300,38,23.5,24)` | `(1230,38,23,24)` | light x=2712..2758; dark x=2572..2617 |

**1 pt** dividers separate cells [C]; **1 pt** total lower separator accounts for strip height **25 pt** [C] (base image y=200..201). Widths are visibly unequal; do not evenly divide W by the tab count [M]. PiP shows two tabs: **“Relay FM for St. Jude - Events for St. Jude”** and active **“Live Unboxing of a Graphite iMac - YouTube”** [M] (PiP screenshots' tab regions light `@ 316,180,1948,50`, dark `@ 344,154,1920,50`). Their trailing title/cell boundary is covered by the PiP video [M]; visible divider at light x=1568 / dark x=1596 implies a first-cell extent **626 pt** [C]. Last-cell width and + cell are not recoverable behind the overlay [M].

## Components used

`window`, `window-controls`, `title-bar`, `toolbar`, `toolbar-button`, `toolbar-segmented-control`, `smart-search-field`, `safari-tab-bar`, `sidebar`, `segmented-control` (Bookmarks/Reading List sidebar switch), `disclosure-triangle`, `outline-view`, `label`, `image-view`, `scroll-view`, `share-menu`, `menu`, `menu-item`, `picture-in-picture`. Cite `favorites-bar` only for the absent bar. `popover` is not the Share picker [I] (classification). Component files own rendering; custom grid/document arrangement is below.

## App-specific elements

### Favorites start page

Evidence: `10-15-Catalina-Light-Safari-v13-Favorites.png @ 1104,220,1312,616`; dark `@ 1034,220,1312,616`, plus sidebar `(112,152,652,1730)` [M].

- Heading **“Favorites”**, light ink origin image `(1106,225)`, dark `(1036,225)` → frame **(497,74.5) / (462,74.5) pt** [C]. Font **20 pt Bold** [C] (cap-height module); stems **`#343637` / `#ffffff`** [M], palettes `(1100,220,180,40)` light and dark. **“Frequently Visited” is not visible** [M]; no font or location for that section can be measured.
- Six columns, two rows [M]. Icon tiles **80 × 80 pt**, **115 pt horizontal pitch** (occasional **0.5 pt** raster-position variation), **148 pt vertical pitch** [C]. Light image tile starts x=1106,1336,1565,1795,2024,2254, dark x=1036,1266,1495,1725,1954,2184; row tops y=302,598 [M]. Frame first-tile origins **(497,113) light / (462,113) dark** [C]. Tiles and their labels remain centred as a fixed-width grid within the area to the right of the sidebar [C] (centres computed from these bounds).
- Tile corner radius **8 pt** [C], measured dark left edge reaches full fill at y=318, **16 image px** below top y=302; `$M grid …Favorites.png 1034,300,16,12` and `$M col … 1036 300 324`; corresponding light grid `(1104,300,16,12)` [M]. Apple/.Mac neutral tile fill **`#f2f2f2`** both [M], row y=320. Other site artwork defines its tile's fill; dark folder/certain favicon tiles use observed **`#68696b`** [M], row y=320 at x=2184. Use image assets, not flat generic icons.
- Tile labels **12 pt Semibold** [C] (cap-height module), title ink begins y=484 first row / 780 second [M]. Labels **`#343637` light / `#ffffff` dark** [M], palettes light `(1150,478,74,34)`, dark `(1080,478,74,34)`. Folder counts beneath titles **11 pt Regular** [C], muted; exact count strings below [M].
- Sidebar selector whole-control rect is **`(4.5,14,306,20)`** from the sidebar top, equivalently **`(4.5,52,306,20)`** relative to window [C], image `(121,180,612,40)` [M]. Each segment is **153 pt** wide [C]. Bookmarks/book icon selected, Reading List/glasses unselected [M]. Selector bottom then divider at image y=246..247; first row starts y=248 [M]. Sidebar outline text is **13 pt Regular**, row pitch **26 pt** [C] (cap height and repeating row module), leading text x=194 for first-level folders and x=222 for News child links [M].

### Reader

- Paper is centred, square-cornered [M]; its first opaque edge occurs at image y=246 without rounded-corner inset (`$M col` at x=650 light / x=580 dark). Top **22 pt** below page region's start [C]. Third-party text/image content remains a placeholder; reproduce only Reader layout and typography, not the article copy [I] (assignment boundary).
- Text column leading x=790 light / 720 dark → frame **339 / 304 pt** [C]; paper inset **70 pt** [C]. Column width **646 pt** [I], inferred symmetric inset from the measured **786 pt** paper and measured **70 pt** leading inset; line breaks fit that column. Heading ink top y=370 → frame **147 pt**, cap height **50 image px** (`$M col …Reader-Mode.png 1250 366 432`) → **36 pt Bold** [C]. Body is **20 pt Regular** [C] (flat-cap module approximately 28 image px), line pitch **29 pt** [C] (text rows in `(780,356,520,285)` crop). Sans-serif system face is inferred from glyph forms [I], not licensed/bundled asset text.
- Light text stem **`#1b1b1b`** [M], title column x=1250; dark has light text over the measured grey paper [M]. A full-paper-width third-party image placeholder begins image y=1008 → frame **466 pt** [C]. Reader leading button is on, aA at trailing edge as described above [M].

### Tab Overview

Evidence: both Tab-Overview PNGs `$M row` y=282/290, `$M col` x=220 y=250..740, corner grids `(208,274,8,8)` [M].

| Property | Light | Dark | Tag / evidence |
|---|---|---|---|
| First thumbnail outer rect, frame pt | `(49,100,293,220)` | `(49,100,276,211)` | [C] image light `(210,276,586,440)`, dark `(210,276,552,422)` |
| Horizontal pitch | 311 pt | 293 pt | [C] light left x=210,832,1454,2076; dark x=210,796,1384,1972 |
| Title band | 26 pt including top border | same | [C] image y=276..327; page miniatures begin y=328 |
| Corner radius | 0 pt (square) | 0 pt | [M] grids show straight 2-px edges beginning together at x=210,y=276, no corner inset |
| Title-band fill | `#ececec` | `#303134` | [M] `@ 220,290` in both PNGs |
| New-tab tile fill | `#d0d1d2` | `#3f4143` | [M] `@ 2200,300` |
| Large + ink size | 49 × 49 pt | 47 × 47 pt | [C] light x=2320..2417, y=446..543; dark row y=485 x=2199..2292; glyph proportions confirmed in previews |
| + stem colour | `#68696a` | `#a8a9aa` | [M] light `@ 2368,494`; dark `@ 2240,485` |

Captions in order **“Google”**, **“About – 512 Pixels”**, **“Relay FM”** [M], centred in their top bands, **11 pt Regular** [C]. Fourth tile is a large +, no caption [M]. Close buttons are **not shown** in either capture; do not add permanently visible × controls [M]. Miniatures are third-party placeholder regions; do not transcribe their page content [I] (scope). Only one thumbnail row exists; vertical grid pitch is not shown [M].

### Share menu

Use `share-menu`, `menu` and `menu-item`; do not re-specify their drawing. Menu rect light image `(2285,101,364,372)` → frame **`(1139,33,182,186)` pt** [C]. Dark menu interior/border envelope image `(2303,85,364,372)` → frame **`(1139,33,182,186)` pt** [C]; outer shadow/hairline x=2302/y=84 is not another pt of layout. Light evidence `share-menu` row/column edge locations; dark `$M row …Sharing.png 300` at x=2295..2310 / 2658..2675 and `$M col … 2520 448 463` [M].

Items, in order [M] (both Sharing PNG menu crops):
1. **Add to Reading List** — glasses glyph.
2. **Add Bookmark** — open-book glyph.
3. **Email This Page** — Mail stamp icon.
4. **Messages** — Messages bubbles icon; selected.
5. **AirDrop** — concentric radio icon.
6. **Notes** — notepad icon.
7. **Reminders** — reminders-list icon.
8. Separator, then **More...** — circled ellipsis glyph.

Messages highlight is **21 pt** high in these captures [C], light image y=231..272 and dark y=215..256, measured `$M col …Sharing.png 2600 222 282` light / `2620 205 272` dark. This differs from the earlier `share-menu` file's provisional row-height value; the full contiguous highlight run is used here [M]. Menu extends **67 pt** past the window's right edge [C], frame right=1321 pt minus W=1254 pt. material samples are in Layout. No popover arrow [M].

### Picture in Picture

- Both full desktops have PiP video at screen image rect **`(2264,84,1056,594)`** → screen pt **`(1132,42,528,297)`** [C]. Evidence: `$M row` both PiP PNGs y=400 x=2258..2270, `$M col` dark x=3000 y=78..88 and 670..686; right edge x=3320 is source edge [M]. It is **20 pt** from screen right and **20 pt** beneath the menu bar's bottom y=44 px [C]. Use `picture-in-picture` for corners/shadow; video content is third-party artwork/placeholder [I] (scope).
- Native PiP controls are **hidden in both** [M]. No close, pause or return-to-window glyph can be located or measured. The component describes the uncaptured hover state; do not borrow the visible YouTube controls in the dark source page as PiP window controls [I] (classification). Source-page region beneath is a third-party placeholder, not Safari control chrome [I] (scope).

## Content in the screenshot

Visible Safari-owned strings are [M]: all domain/placeholder strings, tab captions and Share menu items listed above. Favorite tiles, row-major order: **Apple; .Mac; Amazon; eBay; Yahoo!; News** (subtitle **16 Websites**); second row **Apple** (subtitle **4 Websites**); **iCloud; Facebook; Twitter; Wikipedia; Popular** (subtitle **8 Websites**). Evidence both Favorites grid crops cited above [M].

Sidebar order [M] (`10-15-Catalina-Light-Safari-v13-Favorites.png @ 112,248,652,1460`, dark same): Favorites (collapsed); News (expanded); its links CNN.com, New York Times, Los Angeles Times, BBC NEWS, CBS MarketWatch, CNET News.com, Google News, The New York Times, CNN.com, Washington Post, Yahoo!, BBC News, Time; its collapsed subfolders US, Business, Technology; then collapsed root folders Mac, Kids, Sports, Entertainment, Shopping, Travel, Tools and Reference, Other..., Imported IE Favorites, Other.... Duplicate labels/capitalisation are intentional [M].

## Not reproducible / assets needed

Favorite site/folder tile artwork, sidebar globe/folder/book/glasses glyphs, native toolbar assets and share-service icons are needed [I]. Safari web pages, Reader article/image, Overview miniatures and PiP video are third-party **placeholder regions** [I] (assignment scope); their text is intentionally not specified. Floating native PiP cannot be recreated above other applications by a DOM window; see `picture-in-picture` [I] (implementation constraint). Favorites bar, Frequently Visited section, Overview hover close glyphs and native PiP hover controls are not shown [M].

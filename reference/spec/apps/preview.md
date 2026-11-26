# Preview

- **Screenshots / frames:** all sizes below [M] are opaque frame sizes from `$M info`, not shadow-inclusive image sizes.

| Screenshot | Frame size (pt) | Frame evidence (image px) | Captured state [M] |
|---|---|---|---|
| `10-15-Catalina-Light-Preview.png` | 899 × 675 | `@ 112,76,1798,1350` | “Desktop” image, sidebar hidden, empty unfocused Search |
| `10-15-Catalina-Dark-Preview.png` | 1272 × 828 | `@ 112,76,2544,1656` | dark “Desktop” image, sidebar hidden, empty unfocused Search |
| `10-15-Catalina-Light-Preview-Search.png` | 1147 × 793 | `@ 112,76,2294,1586` | PDF page 9, seven search-result pages, CEO filled and focused |
| `10-15-Catalina-Dark-Preview-Search.png` | 1376 × 822 | `@ 112,76,2752,1644` | same PDF search, scrolled to matching word and following page |

Rectangles below are pt relative to image frame origin `(112,76)` [C]; W/H denote the measured frame width/height above. Colours are stored PNG values [M]. The unified title/toolbar renders with the library components, not a custom reimplementation.

## Layout

| Region | Geometry (pt) [C] | Light colours [M] | Dark colours [M] | Evidence / tag |
|---|---|---|---|---|
| Title strip | `(0,0,W,22)` | unified gradient | unified gradient | [C] proxy-title crop `10-15-Catalina-Light-Preview.png @ 940,82,150,32`; controls begin at image y=126 |
| Whole title + toolbar | `(0,0,W,55)` | near top `#e6e6e6`, lower `#cccccc`; bottom `#bdbdbd` / `#a7a7a7` in Desktop | dark Desktop bottom `#2b2c2e` / black; PDF toolbar lighter due to backdrop | [M] `$M col 10-15-Catalina-Light-Preview.png 500 170 193`; dark same; `$M col …Preview-Search.png 1300 76 265` → dark upper `#707274`, lower `#646466`, highlight rows `#6f7072` / `#797a7c` |
| Desktop image view | `(0,55,W,H−55)` | image pixels, no solid canvas exposed | image pixels, no solid canvas exposed | [M] `10-15-Catalina-Light-Preview.png @ 112,186,1798,1240`; dark `@ 112,186,2544,1546` |
| PDF found-count / sort bar | `(0,55,W,31)` | `#d6d6d6` near top → `#cccccc`, bottom `#9e9d9d` / `#868686` | `#636466` near top → `#5c5c5e`, bottom `#3e3e3f` / black | [M] `10-15-Catalina-Light-Preview-Search.png @ 1300,186,1,62`; dark same |
| PDF results sidebar | `(0,86,205,H−86)` + **1 pt** divider | base `#e7e9ea`; file-group header `#d0d2d3`; selected result `#c7c9ca` | base `#2c2e30`; header `#4f5153`; selected `#505254` | [M] both Preview-Search PNGs `@ 150,260`, `@ 150,740`; `$M col … 515 248 650` |
| Sidebar divider | frame x=205, width **1 pt** | `#cfd1d2` on selected row | black | [M] `10-15-Catalina-Light-Preview-Search.png @ 523,300`; dark same |
| PDF canvas | `(206,86,W−206,H−86)` | `#ececec` | `#ececec` | [M] both Search PNGs `@ 525,300`, `@ 532,300`; pages white in both `@ 700,1200` |

```text
[traffic lights]            document proxy + title
[sidebar v][zoom−][zoom+][share]     [markup v][rotate][markup toolbar][Search]
PDF only: Sort by: Search Rank  [Page Order]     Found on 7 pages [<|>] [Done]
[file name / result cards] | PDF page / gap / next PDF page
Desktop:                  | image fills the viewport (no sidebar)
```
Arrangement and strings [M], the four source screenshots.

### Toolbar item order and rectangles

Light controls' outer bezels are **23 pt high**, at frame y=**24.5 pt** (image y=125..170); dark borderless fills are **22 pt high**, at frame y=**25 pt** (image y=126..169) [C]. Light outer bezel rectangles below were measured with `$M row` at image y=164 and y=130. Dark fills are **0.5 pt** inset on all sides, therefore **1 pt** smaller in each dimension [C]. Do not include the larger focus ring in the Search bezel.

| Order | Component / state | Rect (pt) [C] | Evidence [M] |
|---|---|---|---|
| View/sidebar menu | `toolbar-pop-up`, sidebar icon and down chevron | `(7.5,24.5,37,23)` | `10-15-Catalina-Light-Preview-Search.png @ 127,125,74,46`; same leading group in Desktop |
| Zoom out | `toolbar-button`, minus magnifier | `(51.5,24.5,40,23)` | `@ 215,125,80,46` |
| Zoom in | `toolbar-button`, plus magnifier | `(91.5,24.5,38,23)` | `@ 295,125,76,46`; joined to zoom-out |
| Share | `toolbar-button`, share icon | `(136.5,24.5,37,23)` | `@ 385,125,74,46` |
| Markup tool / menu | `toolbar-pop-up`, pencil then chevron | `(W−393.5,24.5,54,23)` | Desktop light `10-15-Catalina-Light-Preview.png @ 1123,125,108,46`; Search light `10-15-Catalina-Light-Preview-Search.png @ 1619,125,108,46` |
| Rotate left | `toolbar-button`, curved left arrow over page | `(W−332.5,24.5,33,23)` | Desktop light `@ 1245,125,66,46`; Search light `@ 1741,125,66,46` |
| Show Markup Toolbar | `toolbar-button`, circled pen nib | `(W−290.5,24.5,37,23)` | Desktop light `@ 1329,125,74,46`; Search light `@ 1825,125,74,46` |
| Search | `toolbar-search-field` | `(W−246.5,24.5,239,23)` | Desktop light `@ 1417,125,478,46`; focused PDF field underlying bezel x=1913..2390, ring x=1908..2395 [I] (underlying edge inferred because ring replaces border); dark shifts right by image 458 px in PDF |

`@` continues the filename most recently named within the same evidence cell. Left group is fixed; right group is anchored **7.5 pt** from the window right edge [C], confirmed by the different frame widths. Desktop markup pencil is disabled/pale; PDF pencil is enabled [M]. Search desktop placeholder is **“Search”**; PDF value is **“CEO”**, with leading magnifier and trailing clear circle [M]. PDF focused-ring evidence: `10-15-Catalina-Light-Preview-Search.png @ 1908,120,488,56`; dark `@ 2366,120,488,56`. Title is **“Desktop”** or **“Aqua and Bondi.pdf (page 9 of 81)”** [M], centred with document proxy icon (PDF light `@ 1027,82,460,32`; dark `@ 1256,82,460,32`). Title typography uses `title-bar`.

### PDF search bar and sidebar

- Sort bar labels **“Sort by:”**, **“Search Rank”**, selected pill **“Page Order”** [M], leading image x=130,260,438 respectively. Selected pill rect image `(438,201,188,32)` → frame **`(163,62.5,94,16)` pt** [C]. Use `scope-bar` rendering. Text **12 pt semibold** [C], measured cap module in `10-15-Catalina-Light-Preview-Search.png @ 130,200,500,34`.
- Right group says **“Found on 7 pages”**, then previous/next segmented arrows, then **“Done”** [M]. Light arrows image `(2207,200,80,36)` → **`(1047.5,62,40,18)` pt** [C]; Done `(2303,200,84,36)` → **`(1095.5,62,42,18)` pt** [C]. Dark arrows/Done shift image **458 px** right with frame width [C]. Light arrows are disabled [M]; dark are normal [M] (Search screenshots `@ 2190,184,210,60` light / `@ 2648,184,210,60` dark). Count font **11 pt Regular** [C].
- File-group header **“Aqua and Bondi.pdf”**, **20 pt high**, then **4 pt** separator gap [C]: image y=248..287 header, y=288..295 gap. Results start y=296 and repeat **82 pt pitch** [C] (selected first y=296..459; next y=460..623). Both use same row geometry; light shows no snippets/counts, dark shows them [M].
- Each result thumbnail image x=142..213, a **36 × 27 pt** box [C], with first light y=327..380, dark y=352..405. Result label leading x=236 → **62 pt** frame inset [C]; title y=319..336, next row y=483..500 → **82 pt pitch** [C]. Separators are indented image x=140..493 [M]. Seven rows fit; no TOC outline is shown [M].
- Sidebar label text **11 pt Bold** [C], stems **`#141617` light selected / `#ffffff` dark selected** [M], palettes of both PNGs `@ 235,317,80,26`. Dark snippet/count **11 pt Regular** [C]. Selected snippet is light grey, nonselected snippet white [M].
- Dark PDF match **“CEO”** has a green rectangle: stored fill **`#b9d553 (sRGB #b1d832)`**, text **`#191e0c (sRGB #181e09)`** [M], palette `10-15-Catalina-Dark-Preview-Search.png @ 2032,584,72,40`. Highlight envelope **36 × 20 pt**, frame rect **`(960,254,36,20)` pt** [C]; edge column has antialias fringe, interior y=584..622 (`$M col … 2032 576 636`). Light CEO is not visibly highlighted in its unscrolled page [M].
- Light page rect begins image `(538,256)`, width **927 pt**, ends at y=1609; next-page gap **8.5 pt** (y=1610..1626) [C]. Dark first visible page starts image `(542,248)`, width **1152 pt**, ends y=899; gap **11 pt** (900..921), next page starts y=922 [C]. Pages stay white; PDF colours are not appearance-adapted [M]. Evidence: Search PNG row at y=300 and `$M col … 600 1594 1637` light / `… 600 890 934` dark. Scroll position differs, not just zoom or theme [M].

## Components used

`window`, `title-bar`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-pop-up`, `toolbar-search-field`, `toolbar-segmented-control`, `scope-bar`, `push-button`, `sidebar`, `list-view`, `image-view`, `scroll-view`, `label`. These ids own control rendering. The sidebar here is PDF search thumbnails, not a generic file-browser outline [M].

## App-specific elements

The PDF thumbnail cards and found-on-pages bar above [C]. Desktop mode displays a screenshot as the **document**, including the screenshot's own Finder menu bar; it is not Preview's application menu bar [M]. A vertical overlay scroll thumb appears near the right image edge in both Desktop captures [M], use `scroll-view`'s scrollbar rather than rebuilding it as image chrome.

## Content in the screenshot

Titles, search labels and sidebar contents are [M], source regions cited above. Sidebar page order is **Page 9, Page 13, Page 14, Page 17, Page 18, Page 19, Page 21** in both. Dark counts: **1 match, 1 match, 1 match, 4 matches, 1 match, 1 match, 5 matches**. Dark snippets preserve visible truncation:

| Page | Snippet [M], `10-15-Catalina-Dark-Preview-Search.png @ 236,350,255,1060` |
|---|---|
| 9 | When CEO John Sculley / demanded more visibili... |
| 13 | At WWDC 1996, Apple's / new CEO, Gil Amelio, s... |
| 14 | The CEO Parade & / NeXT Purchase |
| 17 | Michael Spindler was / promoted to CEO after... |
| 18 | Amelio was the CEO of... |
| 19 | Amelio would be CEO / for only 500 days, but i... |
| 21 | His keynote was a mess / of ... he shared when / hired as CEO....He eve... |

Slashes denote visible wraps, not literal slash characters [M]. Light sidebar has only page titles and thumbnail assets, no snippets or count labels [M]. PDF page content and assets follow below.

### PDF document content

All following strings are [M] from `10-15-Catalina-Light-Preview-Search.png @ 538,256,1854,1354` and `10-15-Catalina-Dark-Preview-Search.png @ 542,248,2304,1472`. Preserve PDF typography through the document asset; these are not SF Pro interface labels [I] (classification). Dark page 9 shows only the end of the Pink column, and page 10 below it. Light shows page 9 from its header. Printed footer is **“8”** on page 9 [M].

Light page header: **“Section 2”**, **“Pink & Taligent”**. Left-column heading: **“ALTERNATIVE PATHS”**. Its text:

> While System 7 in particular worked to bring new features to the Mac’s operating system, Apple had not done enough work to keep its operating system modern.
>
> It wasn’t for lack of trying. While Pink and Taligent may not be the most well-known attempts by Apple, they were projects designed to replace the Mac’s System Software with a more modern, stable and forward-looking operating system.

Main heading **“Pink”**; body:

> In March 1988 — a month before shipping System 6 — Apple software managers held an offsite meeting to work on the roadmap of future Mac operating system releases. Ideas were written on two colors of index cards. Simple features that could be implemented in the short term were written on blue cards. Pink cards were used for longer-term projects like multitasking. Blue cards were too big to be put on a timeframe were put on red cards.
>
> While the Blue features were addressed in Systems 6 and 7, including cooperative multitasking and virtual memories, but the more ambitious (and resource-intensive) Pink cards were taken on as a special project.
>
> At the end of 1987, software engineer Erich Ringewald was given control of the Pink operating system and two years to implement the features in a future version of the Mac’s operating system.
>
> As the deadline approached, it was clear Pink was not ready. It was unstable and slow, and as a result, many of the original team had left. However, it was seen as an important project internally, and many new developers joined the team.
>
> The Pink team was secretive. When CEO John Sculley demanded more visibility into the project, reports were bleak. Pink was far from complete and in need of help.

The apparent “Blue cards were too big” wording is preserved as visible, not copy-edited [M]. Dark screenshot begins part-way through the third paragraph, at **“Pink operating system and two years to implement the features in a future version of the Mac’s operating system.”** [M].

Dark following-page heading **“Taligent”**; left column:

> In 1991, under Michael Spindler, Apple entered a partnership with IBM and Motorola to work on reference hardware based on the PowerPC architecture. Apple needed to move past the old 680x0 line of Motorola chips it had used in its machines since the early 80s, and would eventually move to the PowerPC platform for its Macs.
>
> A new company named Taligent was also born.
>
> The goal was to complete the shuttered Pink project and sell it as a cross-platform operating system.
>
> By 1992, IBM persuaded Taligent to replace the Apple-built microkernel at the heart of Pink with its own object-oriented

The last line is cut at the viewport bottom [M]. Right column:

> By 1994, few customers had signed up to adopt the new technology when Taligent shipped the first version of the environment, now called CommonPoint.
>
> By this time, it was clear Apple had lost interest, as it had little to gain from development tools that would put Mac OS on the same playing field as other operating systems. Pink was dead.
>
> A couple of years later, Taligent would be folded into IBM, and Apple would be left without a next-generation OS.
>
> Apple would try again, and this project would be far more public: Copland.

## Not reproducible / assets needed

The Desktop document is the Catalina desktop screenshot itself, including its embedded menu-bar pixels [M]; source it as an image. The PDF needs the original **Aqua and Bondi.pdf** or rendered page images and the seven thumbnail assets [I] (implementation requirement). A static HTML transcription without the original PDF font/image layout is not a pixel-exact substitute [I]. Search-bar string and result-card content are specified above; PDF header photograph, PDF fonts and thumbnail miniatures should remain document assets rather than library components [I]. There is no normal-state thumbnail sidebar or TOC screenshot in this assignment [M]; its uncaptured layout must not be claimed as measured.

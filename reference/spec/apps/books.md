# Books
- **Screenshots:** `10-15-Catalina-Light-Books.png`, `10-15-Catalina-Dark-Books.png` (full-screen 3360 x 2100 px captures: desktop, menu bar, Dock, two Books windows)
- **Windows:**
  - **Library window** (behind, inactive): 1184 x 784 pt at screen (65, 49) pt [M] (`@ 130,98,2368,1568`; right edge x=2497 measured in the Dark file, hidden in Light). Unified toolbar with centred segmented control, sidebar.
  - **Book window** (front, key): Light 786 x 785 pt at screen (790, 145) [M] (`Light @ 1580,290,1572,1570`); Dark 1024 x 785 pt at (528, 148) [M] (`Dark @ 1056,296,2048,1570`). Title bar with inline toolbar items and centred title.

## Layout: Library window
Evidence shorthand (whole file): `Light @` / `Dark @` are the two screenshots above; a bare `@ x,y[,w,h]`, `row y=` or `col x=` refers to the Light file and, for the library window, holds at the same coordinates in the Dark file (the window is at the same screen position in both).

Positions in pt from the library window's top-left (image px = 2 x pt + (130, 98)).

| Region | x, y, w, h | Light (inactive) | Dark (inactive) | Tag / evidence |
|---|---|---|---|---|
| Toolbar | 0, 0, 1184, 37 | flat `#f6f6f6` | flat `#2b2d2f` (top 2 px `#6b6c6e`, `#5e6060`) | [M] col x=700 @ y=98..171 |
| Toolbar lines | 0, 37, 1184, 1 | `#e7e7e7` then `#cecece` | `#222426` then `#000000` | [M] col x=700 @ y=172, 173 |
| Sidebar | 0, 38, 220, 746 | `#f6f6f6` | `#2c2e30` | [M] row y=300: x=130..569 |
| Sidebar divider | 220, 38, 1, 746 | `#d5d5d5` | `#444648` | [M] row y=300 @ x=570..571 |
| Content | 221, 38, 963, 746 | `#ffffff` | `#1e2022` | [M] row y=300 from x=572 |

```
 +--------------------------------------------------------------------------+ 0
 |(o)(o)(o) [=]        [ Library | Book Store | Audiobook Store ]   [Search] | 38
 +-----------+--------------------------------------------------------------+
 | Library   |                                                   Sort By v  |
 | [All Books]|   +------+                                                  |
 |  Books    |   | cover | 145.5 x 190                                      |
 |  Audiobooks|  +------+                                                   |
 |  PDFs     |                                                              |
 |  Authors  |                                                              |
 |  Categories|                                                             |
 | Collections|                                                             |
 |  [+]      |                                                              |
 +-----------+--------------------------------------------------------------+ 784
```

| Element | x, y, w, h (pt) | Style (Light / Dark, inactive window) | Tag / evidence |
|---|---|---|---|
| Traffic lights (inactive) | x 13, 33, 53; 12 pt circles | all three `#dfdfdf` with `#d0d1d0` rim | [M] row y=136: 156..179, 196..219, 236..259 |
| Sidebar toggle button | 77.5, 7.5, 39, 23 | border `#dbdbdb`, glyph `#b2b2b2` | [M] `@ 285,113,78,46` |
| Segmented control (3 x 127.5) | 400.5, 7.5, 383, 23 | selected `#e3e3e3` + text `#a4a4a4`; others `#f6f6f6` + `#b2b2b2` / Dark selected `#535557` + `#2b2d2f`; others `#3a3c3e` + `#7b7d7f` | [M] `@ 931,113,766,46` |
| Search field | 1018, 8, 158, 22 | border `#dbdbdb`, placeholder and glyph grey | [M] `@ 2166,114,316,44` |
| Header `Library` | x 11; cap top y 48 | 11 pt Semibold, `#777777` / `#a8aaac` | [M] `@ 151,193,76,21` |
| Selection (All Books) | 0, 60, 220, 24 | `#d2d2d2` / `#505254` | [M] col x=300: 218..265 |
| Row icons | x 18; tops y 63, 87, 111, 135, 159, 183 (24 pt pitch); 18 x 18 | orange rounded squares `#ec8131 (sRGB #fc7b00)` with white glyphs | [M] `@ 166,272,36,36`; rows at 224 (first), 272, 320, 368, 416, 464 px |
| Row text | x 46.5 | 13 pt, `#777777` (selected `#535353`) / `#a8aaac` (selected `#ccced0`) | [M] `@ 223,233,110,19`, `@ 224,281,71,19` |
| Header `Collections` | x 11; cap top y 221.5 | as `Library` | [M] ink 541..558 px |
| Add-collection button | 18, 237, 18 x 18 | 1 pt border `#dfdfdf`, plus glyph `#777777` | [M] `@ 166,572,36,36` |
| `Sort By` + chevron | text x 1107.5..1161; cap top y 50 | 13 pt, `#252525` / light | [M] `@ 2345,197,108,23` |
| Book cover | 263, 73, 145.5, 190 | image, square corners, soft shadow | [M] `@ 656,244,291,380` |

## Layout: Book window
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Title bar / toolbar | full width x 36 | gradient `#e5e5e5` -> `#cdcdcd` | `#38393a` -> `#2d2f2f` (top 2 px `#787878`, `#6c6d6e`) | [M] `Light` col x=2600 @ y=290..361; `Dark` col x=2600 @ y=296..367 |
| Separator | full width x 1 | `#bebebe` then `#a7a7a7` | `#242526` then `#000000` | [M] same columns @ y=362..363 / 368..369 |
| Page area | full width x 748 | book page (grey `#d7e2e7 (sRGB #d5e2e8)` band above a white page spread) | white page spread | [M] `Light @ 2600,364` |
| Page thumbnails (scrubber) | bottom-left, about 480 x 62 pt strip over the page | three page thumbnails with circular page-number badges 1, 2, 3 (1 is accent blue = current) | same | image asset |

Book window toolbar items (pt from the book window's left edge, Light `@ 1580,290`): traffic lights at x 13, 33, 53, y 13 [M] (close button box `Light @ 1606,316,24,24`, zoom ends x=1709; `Dark @ 1082,322,24,24`); Library button (closed-book glyph, `#6d6d6d`) x 78..92; Table of Contents (list glyph) x 102.5..121.5; Notes (page glyph, dimmed `#bababa`) x 132..148; centred title `Aqua and Bondi` (13 pt, `#212121` / `#e0e0e0`, `Light @ 2271,316,187,25`); Search glyph x 729..744; Bookmark glyph x 754..763.5 (`#a4a4a4`) followed by a small chevron x 770..777 [M] (row y=320 and crops `Light @ 1580,290,330,76`, `@ 3010,290,150,76`).

## Components used
- `media-app-chrome` (store layout: toolbar with segmented navigation; inactive rendering), `card-grid` (cover cell).
- `toolbar`, `toolbar-segmented-control`, `toolbar-button`, `toolbar-search-field`, `title-bar`, `window-controls` (inactive: all grey), `window`, `window-shadow` (key vs inactive both visible).
- `sidebar` (inactive, opaque), `split-view`, `icon-view`, `pull-down-button` (`Sort By`).
- `menu-bar`, `menu-bar-extra`, `dock`, `desktop`, `desktop-icon`.

## App-specific elements
- Page spread and thumbnail strip in the book window: rendered book content (image asset). The page shows `Section 1` (bold 17 pt white), a hairline, `Introduction` (bold, about 34 pt, white) over a dimmed photograph of an iMac G3.
- Page-number badge: 22 pt circle, white with grey rim and serif numeral; current page is filled accent blue with a white numeral [M] (visible at `Light @ 1580,1590,1030,270`).

## Content in the screenshot
- Menu bar: `Books`, `File`, `Edit`, `View`, `Controls`, `Store`, `Window`, `Help`; clock `Thu 3:58 PM` (Light), `Fri 11:11 AM` (Dark); user `Stephen`.
- Library toolbar: segments `Library` (selected), `Book Store`, `Audiobook Store`; search placeholder `Search`.
- Sidebar: `Library`: `All Books` (selected), `Books`, `Audiobooks`, `PDFs`, `Authors`, `Categories`; `Collections`: `+` button.
- Content: `Sort By`; one book, cover text `AQUA AND BONDI: The Road to OS X & The Computer That Saved Apple`, `by Stephen Hackett`.
- Book window title: `Aqua and Bondi`; page: `Section 1`, `Introduction`; thumbnails numbered 1, 2, 3.
- Desktop icons: `Macintosh SSD`, `Time Machine`. Dock: Books icon running.

## Not reproducible / assets needed
- Book cover image, page spread image and page thumbnails.
- Desktop pictures, Dock and volume icons.
- Six orange sidebar icons (SVG glyphs on rounded squares).

# News
- **Screenshots:** `10-15-Catalina-Light-News.png`, `10-15-Catalina-Dark-News.png` (window captures)
- **Window:** Light 1222 x 842 pt [M] (`@ 112,76,2444,1684`); Dark 1257 x 842 pt [M] (`@ 112,76,2514,1684`). Mac Catalyst app: unified 38 pt toolbar with centred title, sidebar, scrolling feed.

## Layout
Evidence shorthand: `Light @` / `Dark @` are the two screenshots above; a bare `@ x,y[,w,h]`, `row y=` or `col x=` refers to the Light file; sidebar and toolbar locations left of x=560 also hold in the Dark file, but feed locations do not (the Dark window is 35 pt wider, so its feed is shifted 42 px right).

Positions in pt from the window's top-left (image px = 2 x pt + (112, 76)); Light values, with Dark where the wider window changes them.

| Region | x, y, w, h | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Toolbar | 0, 0, W, 37 | `#e5e5e5` -> `#cdcdcd` | `#3f4041` -> `#333435` (top 2 px `#848486`, `#757578`) | [M] `@ 700,78`, `@ 700,149` |
| Toolbar lines | 0, 37, W, 1 | `#bebebe`, `#a6a6a6` | `#292a2a`, `#000000` | [M] `@ 700,150`, `@ 700,151` |
| Sidebar | 0, 38, 227 (Dark 234), 804 | `#e7e8e9` | `#2c2d30` | [M] `@ 300,700` |
| Sidebar divider | 227 (Dark 234), 38, 1, 804 | `#a9a9a9` | `#4e4f51` (+ black px) | [M] `@ 566,700`; Dark `@ 580,700` |
| Feed pane | 228.5 (Dark 236), 38, rest, 804 | `#ffffff` at the top, section gradient below | `#1e1e1e` | [M] `@ 700,153` |
| Feed column | Light x 316..1136 (820 wide, centred in the pane); Dark x 337..1157 | - | - | [M] images x=744..2383; Dark text from x=786 |

```
 +--------------------------------------------------------------------------+ 0
 |(o)(o)(o) [<] [sb]              News                     [share] [ Search ]| 38
 +--------------+-----------------------------------------------------------+
 | Apple News   |        (apple)News                                        |
 | [Today     ] |        October 3                                          |
 |  News+       |        ------------------------------------------------   |
 |  Saved Stories|       Top Stories                                        |
 |  History     |        +------------------+   +------------------+        |
 | Following    |        |   image 399x300  |   |   image 399x300  |        |
 |  News Top .. |        +------------------+   +------------------+        |
 |  Apple News..|        NBC NEWS                USA TODAY                  |
 | Suggested by |        Headline (22 pt)        Headline                   |
 |  Business .. |        1h ago                  1h ago                     |
 |  ...         |        [txt+thumb] [txt+thumb] [txt+thumb]                |
 |              |        ----------------------   MORE TOP STORIES >        |
 +--------------+-----------------------------------------------------------+ 842
```

### Toolbar items (pt, Light)
| Item | x, y, w, h | State | Tag / evidence |
|---|---|---|---|
| Traffic lights | x 13, 33, 53; y 13 | - | [M] row y=114 |
| Back (chevron) | 77.5, 7.5, 39, 23 | disabled (`#acacac`) | [M] `@ 267,91,78,46` |
| Sidebar toggle | 123.5, 7.5, 39, 23 | enabled (`#565656`) | [M] x=359..436 |
| Title `News` | centred (611); cap top y 14.5 | 13 pt, `#494949` / `#b6b7ba` | [M] `@ 1303,105,64,19` |
| Share | 1007.5, 7.5, 39, 23 | disabled | [M] x=2127..2204 |
| Search field | 1053.5, 7.5, 161, 22 | placeholder `Search` | [M] `@ 2219,91,322,46` |

### Sidebar (pt)
| Element | y | Tag / evidence |
|---|---|---|
| Header `Apple News` (x 8) | cap top 51.5 | [M] `@ 128,178,126,21` |
| Selection (Today) | 64..91 (27 tall, full width) | [M] col x=500: 204..257 |
| Rows Today, News+, Saved Stories, History | icon tops 68.5, 94.5, 120.5, 146.5 (26 pt pitch); icon x 18, 18.5 x 18.5; text x 43 | [M] icon rows 265, 317, 369 px |
| Header `Following` | cap top 183.5 | [M] ink 442..462 px |
| Rows News Top Stories, Apple News Spotlight | icon tops 200.5, 226.5 | [M] 477, 529 px |
| Header `Suggested by Siri` | cap top 263 | [M] ink 601..622 px |
| Rows Business .. Travel (10) | icon tops 280.5 + 26 n (n = 0..9); last 514.5 | [M] 637 .. 1105 px |

### Feed (pt, Light)
| Element | x, y, w, h | Style (Light / Dark) | Tag / evidence |
|---|---|---|---|
| Masthead ` News` (Apple logo + word) | x 317; cap top y 58 (logo top 51.5) | 33 pt Heavy, `#000000` / `#e5e5e5` | [M] `@ 746,179,235,60` |
| Masthead date | x 317; cap top y 86 | 33 pt Heavy, `#6e6e6e` / `#9f9f9f` | [M] `@ 746,248,314,48` |
| Hairline | 316, 127, 820, 0.5 | `#eaeaea` | [M] col x=2300 @ y=330 |
| `Top Stories` | x 316.5; cap top y 169 | 33 pt Heavy, `#cb3225 (sRGB #dc1812)` in both appearances | [M] `@ 745,414,361,47`; `@ 760,440` |
| Lead image 1 / 2 | 316, 213, 399, 300 / 737, 213, 399, 300 | square corners | [M] row y=800: 744..1541, 1586..2383; rows 502..1101 |
| Publisher logo | image top y 525, about 18 pt tall, left-aligned | image | [M] ink rows 1126..1161 px |
| Lead headline | cap top y 556; 24 pt line pitch; 2-3 lines | 22 pt Bold, `#000000` / `#e5e7e7` | [M] `@ 745,1188,36,31` |
| Lead timestamp | top y 637 | 9 pt Bold, `#747370` / `#999da3 (sRGB #989da4)` | [M] `@ 745,1350,53,13` |
| Secondary stories (3) | text x 316, 596.5, 877; thumbnails 88 x 88 at x 486.5, 766.5, 1047.5; y 670 | - | [M] thumb col x=1200: 1416..1591; row y=1500: 1085..1161 |
| Secondary logo / headline / timestamp | logo top y 670; headline line tops y 688, 704, 720 (16 pt pitch); timestamp top y 751 | headline 15.5 pt Bold; timestamp 9 pt Bold | [M] ink rows 1416, 1452, 1484, 1517, 1578 px |
| Hairline | 316, 783, 820, 0.5 | `#b6c1cf (sRGB #b4c1d1)` | [M] `@ 1560,1642` |
| `MORE TOP STORIES` + triangle | right-aligned to x 1136; cap top y 797 | 10 pt Bold caps; `MORE` grey, `TOP STORIES` red `#ca0700 (sRGB #dc0000)` | [M] `@ 2174,1670,209,15` |
| Section background | pane-wide, y 38..817 | vertical gradient `#ffffff` -> `#f6faff (sRGB #f5faff)` (y 312) -> `#eef5fd (sRGB #edf5fe)` (462) -> `#e7f1fe (sRGB #e5f1ff)` (612) -> `#dfedfe (sRGB #dcedff)` (762) -> `#ddecfd (sRGB #daecff)` (812); white again below | `#1e1e1e` -> `#161b20 (sRGB #151b21)` -> `#111921 (sRGB #0f1922)` -> `#0c1722 (sRGB #091723)` -> `#061424 (sRGB #031425)` -> `#031325 (sRGB #001326)`; `#1f1f1e` below | [M] `@ 600,200`, `@ 600,700`, `@ 600,1000`, `@ 600,1300`, `@ 600,1600`, `@ 600,1700`, `@ 600,1740`; Dark same y at x=620 |

## Components used
- `catalyst-chrome`: toolbar, sidebar metrics, type scale, scroll indicator.
- `toolbar`, `toolbar-button` (back, sidebar toggle, share), `toolbar-search-field`, `title-bar`, `window-controls`, `window`, `window-shadow`.
- `sidebar` (Catalyst variant: 26 pt rows, 27 pt grey selection, 18.5 pt full-colour channel icons), `split-view`.
- `card-grid` (story cards), `separator`, `scroll-view`.

## App-specific elements
- Story card, lead: image 399 x 300; 12 pt gap; publisher logo; 13 pt gap; headline (22 pt Bold, 24 pt leading); timestamp 9 pt Bold grey. A video story shows a 44 pt translucent dark circle with a white play triangle centred on the image (second lead image in Light) [M] (visible at `Light @ 1940,760,90,90`).
- Story card, secondary: 280.5 pt column pitch; text block 162 pt wide on the left, 88 pt square thumbnail on the right; logo, 3-line headline truncated with an ellipsis, timestamp.
- UIKit scroll indicator at the pane's right edge in Dark (`Dark @ 2608,231,18,242`).

## Content in the screenshot
Sidebar: `Apple News`: `Today` (selected), `News+`, `Saved Stories`, `History`; `Following`: `News Top Stories`, `Apple News Spotlight`; `Suggested by Siri`: `Business`, `Entertainment`, `Fashion`, `Food`, `Health`, `Politics`, `Science`, `Sports`, `Technology`, `Travel`.

| Slot | Light (`October 3`) | Dark (`October 4`) |
|---|---|---|
| Lead 1 | NBC NEWS: `Trump publicly urges China to investigate` / `Bidens amid impeachment inquiry`; `1h ago` | THE WALL STREET JOURNAL: `Trump administration used potential` / `meeting to pressure Ukraine on Biden,` / `texts indicate`; `5m ago` |
| Lead 2 | USA TODAY (video): `Victims of Las Vegas massacre — the` / `deadliest U.S. shooting — could get up to` / `$800M from MGM`; `1h ago` | The Washington Post: `Ukraine’s new chief prosecutor to “audit”` / `Biden case`; `5m ago` |
| Secondary 1 | POLITICO: `Trump expands private` / `Medicare coverage in` / `new executive order`; `1h ago` | FOX NEWS: `Supreme Court agrees` / `to review Louisiana` / `abortion case`; `5m ago` |
| Secondary 2 | CNN: `Four killed in knife` / `attack at Paris police` / `headquarters`; `1h ago` | The Hollywood Reporter: `Diahann Carroll,` / `pioneering actress on` / `‘Julia’ and ‘Dynasty,’ di...`; `5m ago` |
| Secondary 3 | QUARTZ: `Harvard won the` / `admissions trial but has` / `changed its process a...`; `1h ago` | Los Angeles Times: `One of the oldest known` / `human settlements is` / `about to be swallowed...`; `5m ago` |

Other strings: ` News`, `Top Stories`, `MORE TOP STORIES`, toolbar title `News`, search placeholder `Search`. Menu bar (not captured) [D]: News, File, Edit, View, Window, Help.

## Not reproducible / assets needed
- News photographs (2 lead, 3 thumbnails per appearance) and publisher logos: replace with placeholders.
- 16 sidebar channel icons (full-colour rounded squares).
- Apple News condensed headline face (use system bold).

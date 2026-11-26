# Music
- **Screenshots:** `10-15-Catalina-Light-Music.png`, `10-15-Catalina-Dark-Music.png` (window captures)
- **Window:** 1220 x 720 pt [M] (`@ 112,76,2440,1440` in both). Full-size content window with no title: full-height sidebar holding the traffic lights, and a 55 pt playback bar over the content pane (`media-app-chrome`, player layout).

## Layout
Evidence shorthand: `Light @` / `Dark @` are the two screenshots above; a bare `@ x,y[,w,h]`, `row y=` or `col x=` refers to the Light file and holds at the same coordinates in the Dark file unless a Dark location is given.

Positions in pt from the window's top-left (image px = 2 x pt + (112, 76)).

| Region | x, y, w, h | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Sidebar | 0, 0, 220, 720 | `#e8e9e9` | `#2c2d30` | [M] `@ 300,400` |
| Sidebar divider | 220, 0, 1, 720 | `#cccccc` | `#000000` | [M] `@ 552,400` |
| Playback bar | 221, 0, 999, 54.5 | gradient `#ffffff` -> `#f4f4f4` | `#2b2d2f` -> `#1e2022` (top 2 px `#787a7b`, `#676869`) | [M] `@ 900,76`, `@ 900,184`; Dark `@ 900,78`, `@ 900,184` |
| Bar separator | 221, 54.5, 999, 0.5 | `#cfcfcf` | `#000000` | [M] `@ 900,185` |
| Content pane | 221, 55, 999, 665 | `#ffffff` | `#1e2022` | [M] `@ 900,186` |

```
 0          220 221                                                        1220
 +-----------+----------------------------------------------------------------+ 0
 |(o)(o)(o)  |      <<  >  >>      [note|     (apple)      ]   <) ----O (a)  ["] [=]|
 | [ Search ]+----------------------------------------------------------------+ 55
 | Apple Music                                                                |
 |  For You  |   +--------+                                                   |
 |  Browse   |   | album  |  168 x 168 at (260, 95)                           |
 |  Radio    |   +--------+                                                   |
 | Library   |   Songs of Innocence                                           |
 |  Recently |   U2                                                           |
 |  Artists  |                                                                |
 | [Albums ] |                                                                |
 |  Songs    |                                                                |
 | Store     |                                                                |
 |  iTunes   |                                                                |
 +-----------+----------------------------------------------------------------+ 720
```

### Playback bar items, left to right (pt, all [M], see `media-app-chrome` for evidence)
| Item | x | y | w x h | State |
|---|---|---|---|---|
| Previous (double triangle) | 316 | 21.5 | 20 x 12 | disabled |
| Play (triangle) | 352 | 17.5 | 18 x 20 | enabled |
| Next (double triangle) | 382 | 21.5 | 20 x 12 | disabled |
| LCD (artwork well 44.5 wide + body) | 498 | 4.5 | 400 x 45 | idle: music-note glyph in the well, Apple logo centred |
| Speaker glyph | 972 | 21.5 | 13 x 12 | - |
| Volume slider (knob at maximum) | 991 | 22 | 66 x 11 (track 3 pt, knob 11 pt) | 100% |
| AirPlay | 1062 | 21 | 15 x 15 | - |
| Lyrics (speech bubble) | 1156 | 20.5 | 15 x 14 | - |
| Up Next (bullet list) | 1186 | 22.5 | 14 x 9.5 | - |

### Sidebar (pt)
| Element | Position | Tag / evidence |
|---|---|---|
| Traffic lights | x 10, 30, 50; y 21 | [M] row y=130 |
| Search field | 10.5, 63.5, 199 x 23 | [M] `@ 133,203,398,46` |
| Group header `Apple Music` | cap top y 103.5 (ink 283..303 px) | [M] |
| Rows For You / Browse / Radio | icon tops y 120, 144, 168 (24 pt pitch) | [M] icon rows 316, 364, 412 px |
| Group header `Library` | cap top y 205.5 | [M] ink 487..507 px |
| Rows Recently Added / Artists / Albums / Songs | icon tops y 222, 246, 270, 294 | [M] 520, 568, 616, 664 px |
| Selection (Albums) | 0, 267, 220, 24 | [M] col x=400: 610..657 |
| Group header `Store` | cap top y 332 | [M] ink 740..756 px |
| Row iTunes Store | icon top y 348 | [M] 772 px |

## Components used
- `media-app-chrome`: playback bar, LCD, sidebar metrics and colours.
- `window`, `window-shadow`, `window-controls`.
- `sidebar`: source list (deviations: 24 pt rows, 18 pt coloured rounded-square icons, grey selection `#c7c8c9` / `#505154` instead of accent, group headers `#747475` / `#9fa0a1`).
- `search-field`: sidebar search (rounded 23 pt field, translucent grey fill).
- `slider`: volume; `split-view`: sidebar divider.
- `card-grid`: album cell (168 pt artwork, radius 4, two 13 pt text lines).
- `icon-view`: the album grid as a collection view.

## App-specific elements
| Element | Measurement | Tag |
|---|---|---|
| Album artwork | 168 x 168 at (260, 95); radius 4; shadow `0 2px 5px rgba(0,0,0,.15)` | [M]/[C] `@ 632,266,336,336` |
| Album title | 13 pt Regular, `#000000` / `#dddddd`; ink top 7 pt below the artwork; left-aligned with the artwork | [M] `@ 633,616,222,23` |
| Artist | 13 pt Regular, `#808080` / `#9a9a9b`; baseline 16.5 pt below the title baseline | [M] `@ 634,648,29,19` |
| Sidebar icons | 18 pt rounded squares with white glyphs: For You (heart, red-pink `#fa6978 (sRGB #ff5c75)`), Browse (note, pink), Radio (broadcast, pink-magenta), Recently Added (clock, purple), Artists (microphone, purple), Albums (stack, violet `#7a70eb (sRGB #7f6bf3)`), Songs (note, blue-violet), iTunes Store (star, magenta) | [M] `@ 148,316,36,36`, `@ 150,334`, `@ 150,634` |

## Content in the screenshot
- Sidebar: search placeholder `Search`; `Apple Music`: `For You`, `Browse`, `Radio`; `Library`: `Recently Added`, `Artists`, `Albums` (selected), `Songs`; `Store`: `iTunes Store`.
- Content: one album, title `Songs of Innocence`, artist `U2`.
- LCD: idle (Apple logo). Volume 100%.
- Menu bar (not captured) [D]: Music, File, Edit, Song, View, Controls, Account, Window, Help.

## Light vs dark
Same geometry. Colours as in the Layout table and `media-app-chrome`. Icons, artwork and traffic lights do not change (dark traffic lights are the dark-window variants, see `window-controls`).

## Not reproducible / assets needed
- Album artwork (U2, Songs of Innocence): replace with a placeholder image.
- Eight sidebar icons (simple white glyph on gradient squares: can be SVG).
- Apple logo and music-note glyphs for the LCD (SVG).

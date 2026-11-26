# Book cover cell (`book-cover`)

- **Status:** present
- **AppKit:** custom `NSCollectionViewItem` in the Books library (`NSCollectionView`); no public class and no system-drawn style.
- **HIG:** none specific. Related: image views https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/image-views/
- **Appearances shown:** light, dark
- **Provenance:** split out of `card-grid` on 2026-10-07, when the cover was built as a component of its own (`src/components/book-cover/`). `card-grid.md` records the cover's size and the shadow's extent; the shadow's falloff on each side was re-measured for this file.

## Purpose and behaviour
A book in the library of Books: its cover picture and nothing else. Clicking a cover opens the book [I]. The capture shows a library of one book.

## Anatomy
```
+-----------+
|           |
|  picture  |  145.5 x 190 pt, square corners
|           |
+-----------+
  soft shadow, deepest under the cover
```

## Variants and parameters
| Parameter | Values | Default | Shown in screenshots |
|---|---|---|---|
| picture | any image | - | one book |
| width, proportions | 145.5 pt, 291 : 380 | - | this one size |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes | `10-15-Catalina-Light-Books.png @ 656,244,291,380`; `10-15-Catalina-Dark-Books.png @ 656,244,291,380` |
| hover | no | [I] no change |
| pressed | no | [I] dimmed by a tenth, as the store cards |
| focused (full keyboard access) | no | [I] standard focus ring around the cover, see `focus-ring` |
| disabled | no | [I] half opacity |
| inactive window | no | [I] unchanged |

## Measurements
Evidence shorthand: `Books` before `@`, `row y=` or `col x=` means `10-15-Catalina-Light-Books.png`, `Dark` the dark file. The capture is full screen, 3360 x 2100 px; the cover is at the same place in both files.

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Cover | 145.5 x 190, square corners, no border | [M] | Books `@ 656,244,291,380`: x=656..946, y=244..623 |
| Position in the window | 263 from the window's left edge, 73 below its top | [M] | `apps/books.md` |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Page behind the cover | `#ffffff` | `#1e2022` | [M] | Books `@ 957,633`; Dark `@ 957,633` |
| Shadow under the cover, from the edge outwards (px) | `#cacaca`, `#d4d4d4`, `#dedede`, `#e7e7e7`, `#f0f0f0`, `#f6f6f6`, `#fafafa`, `#fcfcfc`, `#fefefe` | `#18191b`, `#191b1c`, `#1a1c1e`, `#1b1d1f`, `#1c1e20`, `#1d1f21`, `#1d1f21`, then the page | [M] | Books col x=800: y=624..632; Dark col x=800: y=624..630 |
| Shadow beside the cover | `#d9d9d9`, `#e3e3e3`, `#ececec`, `#f3f3f3`, `#f8f8f8`, `#fbfbfb`, `#fdfdfd`, `#fefefe` | `#191b1d`, `#1b1c1e`, `#1c1e1f`, `#1d1e20`, `#1d1f21`, then the page | [M] | Books row y=500: x=947..954, mirrored at x=655..648; Dark row y=500: x=947..951 |
| Shadow above the cover, from the edge outwards | `#f0f0f0`, `#f6f6f6`, `#fafafa`, `#fcfcfc`, `#fefefe` | `#1c1e20`, `#1d1f21`, `#1d1f21`, then the page | [M] | Books col x=800: y=243..239; Dark col x=800: y=243..241 |
| Shadow, fitted CSS | `0 1px 3px rgba(0,0,0,.31)` | the same | [C] | the three falloffs are one profile moved by 2 px: a blur of 3 pt (sigma 3 px) offset down by 1 pt, black at 31% (`#18191b` over `#1e2022` is black at 20%, as `#cacaca` over white) |

## Layout and spacing
- The cover stands on the plain page; the shadow reaches 4.5 pt below it, 4 pt beside it and 2.5 pt above it.
- [I] The distance between covers is not shown: the library holds one book.

## Keyboard and accessibility
An `AXImage` or `AXButton` cell named by the book's title [I]. ARIA: a link or a `button` named by the picture's `alt` or an `aria-label`; one tab stop, activated with Return (and Space for a button).

## Browser notes
- One `box-shadow` reproduces the falloff on all four sides to within a level or two in 255.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Books.png` | 656,244,291,380 | the cover |
| dark | `10-15-Catalina-Dark-Books.png` | 656,244,291,380 | the cover, dark |
| light | `10-15-Catalina-Light-Books.png` | 927,604,40,40 | bottom-right corner and shadow |
| dark | `10-15-Catalina-Dark-Books.png` | 927,604,40,40 | bottom-right corner and shadow, dark |

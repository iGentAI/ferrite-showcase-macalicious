# Default Push Button (`default-button`)

- **Status:** present
- **AppKit:** `NSButton` with `bezelStyle = .rounded` and `keyEquivalent = "\r"` (the window's `defaultButtonCell`); tinted with `NSColor.controlAccentColor`
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/push-buttons/
- **Appearances shown:** light, dark (blue accent only; the other seven accents are in `accent-colors`)

Short file names: `L-SP-<Pane>` = `10-15-Catalina-Light-System-Preferences-<Pane>.png`, `D-SP-<Pane>` likewise for Dark, `L-<Name>` / `D-<Name>` = `10-15-Catalina-Light-<Name>.png` / `10-15-Catalina-Dark-<Name>.png`.

## Purpose and behaviour
The default button is the push button the user is most likely to choose. It is drawn prominently (filled with the accent colour) and is activated by Return. A view can have only one. Do not make a destructive button the default; when the likely choice is destructive, make Cancel the default instead. [D] (HIG, Push Buttons)

Geometry, title metrics and spacing are those of `push-button`; only the fill, edge and title colour differ.

## Anatomy
Same as `push-button`: halo and two shadow rows, 0.5 pt edge, vertical accent gradient fill, white title. In dark mode the edge is a dark outline outside the fill and the fill starts with a 0.5 pt bright highlight row.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| controlSize | regular, small, mini | regular | `controlSize` | regular only |
| accent | blue, purple, pink, red, orange, yellow, green, graphite | blue | `NSColor.controlAccentColor` | blue here; all eight in `accent-colors` |
| enabled | true, false | true | `isEnabled` | enabled only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, key window | yes, light + dark | `L-SP-Family-Sharing @ 1294,650,114,43`; `D-SP-Family-Sharing @ 1294,650,114,43`; `L-Finder-Empty-Trash @ 684,300,228,43`; `D-Finder-Empty-Trash @ 684,300,228,43`; `L-Force-Quit @ 564,608,184,43` |
| pressed | not shown | [I] same gradient with every stop darkened about 12% (AppKit darkens the accent bezel while the mouse is down) |
| disabled | not shown | [I] drawn exactly as a disabled `push-button` (no accent) |
| inactive window | not shown in any screenshot (every dialog was captured as the key window) | [I] the accent fill is removed and the button is drawn exactly as a normal `push-button` (white fill, `rgba(0,0,0,.85)` title in light; `rgba(255,255,255,.25)` fill in dark). This is long-standing AppKit behaviour for Aqua default buttons |
| focused | not shown | [I] `focus-ring` around the bezel |
| pulsing | does not exist in 10.15 (removed in 10.10) | [D] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Body height (edge to edge) | 20 | [M] | `L-Finder-Go-To-Folder` col x=776: top edge `#5b93f3 (sRGB #4c92fa)` y=287, gradient y 288..325 (38 px), bottom edge `#2165f6 (sRGB #0361ff)` y=326; `L-SP-Family-Sharing` col x=1306: y 651..690 |
| Total painted height | 21.5 (halo row, body, two shadow rows) | [M] | same columns: `#e6e6e6` y=286; `#d0d0d0` y=327, `#e3e3e3` y=328 |
| Edge width | 0.5 | [M] | `L-SP-Family-Sharing` row y=671: `#3b7bf4 (sRGB #2679fd)` x1 at x=1295 and x=1406 |
| Corner radius | 3.5 on the outer edge of the border, by a least-squares fit with `tools/corner_fit.py` to a default button (Go, in Go to Folder) with its gradient fill taken as flat: best 3.5 (rms 3.9 levels; 5.3 at 3.75, 5.8 at 3.25, 8.4 at 4); with the halo as the outer ring, best 4 (rms 2.9; 4.0 at 4.25, 5.5 at 3.75), which is 3.5 on the border again. The gradient makes the fit coarse (rms 3 to 4 levels, against 1.5 for the push button). The accent-coloured cap of a pop-up button, a different control with the same bezel corner, gives the same figures: best 3.5 (rms 3.5 levels; 5.1 at 3.75, 5.4 at 3.25, 8.3 at 4), halo 4 (rms 2.6). Until 3 October 2026 this row gave "3.5 to 3.75" tagged [C] from the cap fit alone, with no fit of a default button. That the default button has the same outline as `push-button`, which fits 3.75, is an assumption that this coarser fit neither confirms nor excludes. The earlier value of 4 was a grid reading | [C] 3.5, fit from [M] pixels, coarse; [I] that the outline is the push button's 3.75 | fit corner `10-15-Catalina-Light-Finder-Go-To-Folder.png @ 763,287,10,10`; `L-SP-General` grid `@ 899,411,14,12` (pop-up cap, identical bezel corner): top row straight at x<=903, right edge straight at y>=420; cap fit corner `10-15-Catalina-Light-System-Preferences-General.png @ 901,413,10,10` |
| Widths seen (edge to edge) | 56 (Next), 69 (OK), 77 (Open), 79 (Connect), 83 (Go), 91 (Force Quit), 113 (Empty Trash) | [M] | rows at the vertical centre of each: `L-SP-Family-Sharing` x 1295..1406; `L-Music-Preferences` 999..1136; `L-Finder-Open` 1765..1918; `L-Finder-Connect-to-Server` 885..1042; `L-Finder-Go-To-Folder` 763..928; `L-Force-Quit` 565..746; `L-Finder-Empty-Trash` 685..910 |
| Title metrics | 13 pt, baseline 14.5 below the top edge, 14.5 padding each side | [C] size, [M] baseline and padding | `L-SP-Family-Sharing`: top edge y=651, `N` y 661..679, ink x 1324..1376 between edges 1295 / 1406; `L-Finder-Empty-Trash`: top edge y=301, caps y 311..329 |

### Colours and fills (blue accent)
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill gradient (inside the edge, top to bottom) | `0% #77a6f4 (sRGB #6ca6fb)`, `27% #6499f5 (sRGB #5698fc)`, `51% #4b89f5 (sRGB #3987fd)`, `76% #3579f6 (sRGB #1c77ff)`, `100% #286ef6 (sRGB #076bff)` (38 measured rows, near-linear) | `0% #6998e8 (sRGB #5d97ef)` (0.5 pt highlight row), `3% #3874df (sRGB #2472e7)`, `5% #2e6bde (sRGB #1869e6)`, `22% #2d6ada (sRGB #1668e2)`, `51% #2c66d2 (sRGB #1764da)`, `81% #2a62ca (sRGB #1660d1)`, `100% #2960c6 (sRGB #155ecd)` | [M] | `L-Finder-Go-To-Folder` col x=776 y 288..325 (y=288 `#77a6f4 (sRGB #6ca6fb)`, 298 `#6499f5 (sRGB #5698fc)`, 307 `#4b89f5 (sRGB #3987fd)`, 316 `#3579f6 (sRGB #1c77ff)`, 325 `#286ef6 (sRGB #076bff)`); `D-Finder-Empty-Trash` col x=699 y 302..339 (302 `#6998e8 (sRGB #5d97ef)`, 303 `#3874df (sRGB #2472e7)`, 310 `#2d6ada (sRGB #1668e2)`, 321 `#2c66d2 (sRGB #1764da)`, 332 `#2a62ca (sRGB #1660d1)`, 339 `#2960c6 (sRGB #155ecd)`) |
| Top edge | `#5b93f3 (sRGB #4c92fa)` | outline `#29292a` on `#303031` (black 0.15) | [M] | `L-Finder-Go-To-Folder @ 776,287`; `D-Finder-Empty-Trash @ 699,301` |
| Side edge | about 16 levels darker than the fill beside it: `#3b7bf4 (sRGB #2679fd)` beside `#4b89f5 (sRGB #3987fd)` at mid height | outline `#272728` on `#303031` (black 0.19), outside the fill | [M] | `L-SP-Family-Sharing` row y=671 x=1295, 1296; `D-SP-Family-Sharing` row y=671: `#2c2c2d` at x=1295 (on box `#363637`) then `#2c66d2 (sRGB #1764da)` from x=1296; `D-Finder-Empty-Trash` row y=321: `#272728` at x=685 |
| Bottom edge | `#2165f6 (sRGB #0361ff)` | outline `#232324` on `#303031` (black 0.27) | [M] | `L-Finder-Go-To-Folder @ 776,326`; `D-Finder-Empty-Trash @ 699,340` |
| Halo and shadow rows | as `push-button`: `#e6e6e6`; `#d0d0d0`, `#e3e3e3` on `#ececec` | `#2f2f30`; `#2a2a2b`, `#2e2e2f` on `#303031` | [M] | `L-Finder-Go-To-Folder` col x=776 y=286, 327, 328; `D-Finder-Empty-Trash` col x=699 y=300, 341, 342 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title colour | `#ffffff` | `#e0e9f9 (sRGB #dee9fb)` at the stem centre over `#2c66d2 (sRGB #1764da)` = `rgba(255,255,255,0.85)` | [M], [C] | `L-SP-Family-Sharing @ 1324,661,53,19` (brightest stem pixel `#ffffff`); `D-SP-Family-Sharing @ 1324,661,53,19` (brightest `#e0e9f9 (sRGB #dee9fb)`) |
| Font | SF Pro Text Regular 13 pt (not bold; stems are the same width as on a normal push button) | same | [C] | cap height 19 px, x-height 14 px: `L-Finder-Empty-Trash @ 724,311,148,24`; `E` width 12 px vs `C` in Cancel 16 px at the same weight |

### Shadows and effects
No glow, no pulse. The only effects are the shared halo and shadow rows listed above. [M]

## Layout and spacing
- Placement: trailing (right) end of the button row in dialogs, alerts and sheets, with Cancel immediately to its left. [D] (HIG, Dialogs)
- Gap to the neighbouring button: 13 pt in dialogs, 15 pt in alerts, 9 pt in the Open panel bottom bar (edge to edge). [M] `L-Finder-Go-To-Folder` row y=308 (736 -> 763); `L-Finder-Empty-Trash` row y=321 (654 -> 685); `L-Finder-Open` row y=1264 (1746 -> 1765).
- Distance to the window's right and bottom edges: 20.5 pt in dialogs. [M] `L-Finder-Go-To-Folder`: right edge x=928 vs frame 969; bottom edge y=326 vs frame 367. In the Family Sharing pane: 20.5 pt right (1406 vs 1447) and 20.5 pt bottom (690 vs 731). [M]

## Keyboard and accessibility
Return (and Enter) activates the default button from anywhere in the window unless a text view consumes it. AppKit role `AXButton` with `AXDefault`-style behaviour through `AXDefaultButton` on the window. Web: `<button type="submit">` inside a `<form>` or a dialog-level `keydown` handler for Enter. [D]

## Browser notes
Use the measured five-stop gradient in light; a two-stop approximation differs by up to about 4 channel levels [C] (for example the linear red-channel interpolation at row 307 is about 78, versus measured 75), exceeding the ±2 audit tolerance. In dark, retain the measured top highlight and stops. The inactive-window rendering needs `:host-context([data-window-inactive])` or equivalent state from the window component, because CSS has no window-focus selector other than a JS-maintained attribute.

## Pixel audit
Stored colours [M], re-sampled with ±2-channel tolerance:
- Fill 0% `#77a6f4 (sRGB #6ca6fb)`: 10-15-Catalina-Light-Finder-Go-To-Folder.png @ 776,288.
- Fill 27% `#6499f5 (sRGB #5698fc)`: 10-15-Catalina-Light-Finder-Go-To-Folder.png @ 776,298.
- Fill 51% `#4b89f5 (sRGB #3987fd)`: 10-15-Catalina-Light-Finder-Go-To-Folder.png @ 776,307.
- Fill 76% `#3579f6 (sRGB #1c77ff)`: 10-15-Catalina-Light-Finder-Go-To-Folder.png @ 776,316.
- Fill 100% `#286ef6 (sRGB #076bff)`: 10-15-Catalina-Light-Finder-Go-To-Folder.png @ 776,325.
- Top edge `#5b93f3 (sRGB #4c92fa)`: 10-15-Catalina-Light-Finder-Go-To-Folder.png @ 776,287.
- Bottom edge `#2165f6 (sRGB #0361ff)`: 10-15-Catalina-Light-Finder-Go-To-Folder.png @ 776,326.
- Dark first fill row `#6998e8 (sRGB #5d97ef)`: 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 699,302.
- Dark second row `#3874df (sRGB #2472e7)`: 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 699,303.
- Dark fill 22% `#2d6ada (sRGB #1668e2)`: 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 699,310.
- Dark fill 51% `#2c66d2 (sRGB #1764da)`: 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 699,321.
- Dark fill 81% `#2a62ca (sRGB #1660d1)`: 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 699,332.
- Dark fill 100% `#2960c6 (sRGB #155ecd)`: 10-15-Catalina-Dark-Finder-Empty-Trash.png @ 699,339.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-System-Preferences-Family-Sharing.png` | 1294,650,114,43 | Next, in a pane (box background `#e3e3e3`) |
| light | `10-15-Catalina-Light-Finder-Go-To-Folder.png` | 762,286,168,43 | Go, with Cancel to its left |
| light | `10-15-Catalina-Light-Finder-Empty-Trash.png` | 684,300,228,43 | Empty Trash in an alert |
| light | `10-15-Catalina-Light-Force-Quit.png` | 564,608,184,43 | Force Quit |
| light | `10-15-Catalina-Light-Finder-Open.png` | 1764,1244,156,43 | Open, in the Open panel bottom bar |
| dark | `10-15-Catalina-Dark-System-Preferences-Family-Sharing.png` | 1294,650,114,43 | Next |
| dark | `10-15-Catalina-Dark-Finder-Empty-Trash.png` | 684,300,228,43 | Empty Trash |
| dark | `10-15-Catalina-Dark-Force-Quit.png` | 564,608,184,43 | Force Quit |
| dark | `10-15-Catalina-Dark-Finder-Open.png` | 1764,1244,156,43 | Open |

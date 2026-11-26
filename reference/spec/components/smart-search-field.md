# Safari Smart Search field (`smart-search-field`)

- **Status:** present
- **AppKit:** custom Safari `NSTextField` subclass in a toolbar item (unified address and search field)
- **HIG:** https://web.archive.org/web/20200503175723/https://developer.apple.com/design/human-interface-guidelines/macos/fields-and-labels/search-fields/
- **Appearances shown:** light, dark

## Purpose and behaviour
Safari's combined address and search field. Unfocused, it shows only the site's domain, centred, with a padlock for HTTPS; focused, it shows the full URL left aligned and selected [D] (Safari behaviour). Leading accessory: Reader button when a reader view is available. Trailing accessory: Reload (Stop while loading), replaced by the text-size "aA" button in Reader mode [M]; an audio indicator appears when a tab plays sound [M].

## Anatomy
A `toolbar-search-field`-style bezel, 535 pt wide, centred on the window; inside it, leading Reader button, centred lock + domain, trailing accessory glyphs.

## Variants and parameters
| Variant | Shown in screenshots |
|---|---|
| page loaded, unfocused (lock + domain centred) | `...Safari-v13.png`, `...Sharing.png`, `...Reader-Mode.png`, Split Screen |
| empty, unfocused (magnifier + placeholder centred) | `10-15-Catalina-Light-Safari-v13-Favorites.png`, `...Tab-Overview.png` |
| empty, focused (magnifier + placeholder left aligned, focus ring) | `10-15-Catalina-Dark-Safari-v13-Favorites.png` |
| Reader active (Reader button on, "aA") | `...Safari-v13-Reader-Mode.png` |
| audio playing (speaker glyph before Reload) | `...Safari-v13-Picture-in-Picture.png` |
| typing / completion list | not shown |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| unfocused | yes | `10-15-Catalina-Light-Safari-v13.png @ 900,91,1072,47` |
| focused | yes (dark, empty) | `10-15-Catalina-Dark-Safari-v13-Favorites.png @ 852,84,1030,60` |
| inactive window | yes | `10-15-Catalina-Light-Safari-v13-Picture-in-Picture.png @ 1060,119,1040,46` |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Width x height (fill) | 535 x 22 (x 901..1970, y 92..135) | [M] | `10-15-Catalina-Light-Safari-v13.png @ 900,100,1072,1`, `@ 1400,91,1,47` |
| Position | horizontally centred on the window (field centre 1435.5 = frame centre); top 8 below window top | [M] | frame x 112..2759 |
| Corner radius | Light 4.25, on the outer edge of the 0.5 pt border; dark 3.75, on the edge of the fill, which has no border in dark. Least-squares fits with `tools/corner_fit.py` to the leading top corner of the Safari field: light best 4.25 (rms 1.7 levels; 2.6 at 4, 2.5 at 4.5); dark best 3.75 (rms 1.6; 2.3 at 3.5, 3.1 at 4). The toolbar behind the field stays within 3 levels over the compared square and was taken as flat. The trailing corners are not fitted. Until 3 October 2026 this row gave 4.25 for both appearances, carried over from `toolbar-search-field` and tagged [I]; before the fits it gave 4 tagged [M], which was taken by reference to `toolbar-search-field` and was not a direct measurement of this field | [C] fit from [M] pixels | fit corners `10-15-Catalina-Light-Safari-v13.png @ 900,91,12,12` and `10-15-Catalina-Dark-Safari-v13.png @ 859,92,12,12` |
| Reader glyph (four text lines) | 13.5 x 10 (x 916..942, y 104..123); its box starts 7.5 from the fill's leading edge | [M] | `@ 916,104,27,20` |
| Reload glyph | 11 x 13 (x 1936..1957, y 100..125); 6.5 from the trailing edge | [M] | `@ 1936,100,22,26` |
| Lock + domain group | centred in the field; ink x 1349..1522 for "512pixels.net", lock 7 x 10 pt before the text with a 3 pt gap | [M] group, [C] lock | `@ 1349,104,174,25` |
| Placeholder group (magnifier + "Search or enter website name") | centred; ink x 1257..1626 | [M] | `10-15-Catalina-Light-Safari-v13-Favorites.png @ 1257,102,370,25` |
| Reader button when on | 28 pt fill width (x=901..956), full field height, rounded leading corners | [M] | 10-15-Catalina-Light-Safari-v13-Reader-Mode.png @ 895,114,73,1 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill gradient | `#fdfdfd` (first rows) -> `#faf9fa` -> `#f7f7f7` (50%) -> `#f4f3f4` | `#8a8b8c` (first row), `#737475`, then `#6e6e70` -> `#6b6c6d` | [M] | `10-15-Catalina-Light-Safari-v13.png @ 1400,92,1,44`; `10-15-Catalina-Dark-Safari-v13.png @ 1400,92,1,44` |
| Border top / sides / bottom, shadow row | `#cbcaca` / `#cccbcb` / `#a4a4a4`, `#cdcdcd` | none | [M] | `@ 1400,91`, `@ 900,100`, `@ 1400,136`, `@ 1400,137` |
| Domain text | `#4c4c4c` | `#ffffff` | [M] | darkest/lightest in `10-15-Catalina-Light-Safari-v13.png @ 1340,96,200,36`; `10-15-Catalina-Dark-Safari-v13.png @ 1270,96,200,36` |
| Accessory glyphs (Reader, Reload) | `#7a7a79` | Reader `#e9eaea`, Reload `#e9e9ea` | [M] | darkest/lightest ink in 10-15-Catalina-Light-Safari-v13.png @ 916,96,50,36; 10-15-Catalina-Light-Safari-v13.png @ 1920,96,44,36; 10-15-Catalina-Dark-Safari-v13.png @ 873,102,30,24; 10-15-Catalina-Dark-Safari-v13.png @ 1834,98,26,30 |
| Placeholder and magnifier | `#9f9ea0` | `#909192` | [M] | `10-15-Catalina-Light-Safari-v13-Favorites.png @ 1250,96,400,36`; `10-15-Catalina-Dark-Safari-v13-Tab-Overview.png @ 1220,100,360,30` |
| Focus ring | as `toolbar-search-field` | as `toolbar-search-field` | [M] there | `10-15-Catalina-Dark-Safari-v13-Favorites.png @ 852,84,1030,60` |

### Text and icons
SF Pro Text 13 pt Regular for the domain and the placeholder [C] (ink height 24-25 px with descenders, cap height 18 px).

### Shadows and effects
None besides the focus ring.

## Layout and spacing
The field keeps a fixed 535 pt width at these window sizes and is centred on the window, not on the free space between the neighbouring items. The field shrinks in Split Screen to 373 pt fill width (x=2059..2804; 746 px in a 928 pt Safari tile) [M], `10-15-Catalina-Light-Split-Screen-Apps.png @ 2054,36,757,1`.

## Keyboard and accessibility
Command-L focuses and selects the URL; Return loads; Escape restores the current URL; Down Arrow moves into suggestions [D]. `AXTextField` with accessory `AXButton`s. ARIA: `role="combobox"` with `aria-autocomplete="list"` when a suggestion list is implemented.

## Browser notes
Reproducible. Centre the unfocused content with a flex container and switch to `text-align: left` on focus.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Safari-v13.png` | 896,88,1080,52 | lock + domain, Reader and Reload glyphs |
| dark | `10-15-Catalina-Dark-Safari-v13.png` | 856,88,1020,52 | same |
| light | `10-15-Catalina-Light-Safari-v13-Favorites.png` | 896,88,1080,52 | empty, placeholder centred |
| dark | `10-15-Catalina-Dark-Safari-v13-Favorites.png` | 846,82,1040,64 | empty, focused, focus ring |
| light | `10-15-Catalina-Light-Safari-v13-Reader-Mode.png` | 896,88,1080,52 | Reader on, "aA" accessory |

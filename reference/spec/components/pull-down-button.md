# Pull-Down Button, including the Action button (`pull-down-button`)

- **Status:** present
- **AppKit:** `NSPopUpButton` with `pullsDown = true` (`arrowPosition = .arrowAtBottom` draws a single down chevron); Action (gear) button: a pull-down whose title is the template image `NSImage.actionTemplateName` (`NSActionTemplate`), usually as a segment or gradient button
- **HIG:** https://web.archive.org/web/20200503154252/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/pull-down-buttons/
- **Appearances shown:** light, dark

Short file names: `L-SP-<Pane>` / `D-SP-<Pane>` = `10-15-Catalina-Light-System-Preferences-<Pane>.png` / Dark; `L-<Name>` / `D-<Name>` = `10-15-Catalina-Light-<Name>.png` / `10-15-Catalina-Dark-<Name>.png`.

`L-SP-Sidecar` here means `10-15-Catalina-Light-System-Preferences-Sidecar.png`; `D-SP-Sidecar` the Dark file.

## Purpose and behaviour
A pull-down button opens a menu of commands (or of items that can be toggled independently) below the button. Its title is static: it names the menu and does not change when an item is chosen, so it needs no separate label. A single down-pointing chevron distinguishes it from a pop-up button's double arrow. Menu items use title case; an Action pull-down shows a gear icon instead of text and lists commands for the selected item. [D] (HIG, Pull-Down Buttons)

## Anatomy
Identical to `pop-up-button` (push-button bezel + 16 pt accent cap) except that the cap holds one down chevron, vertically centred. Three other forms appear in the screenshots: (b) disabled, where the cap is not tinted; (c) Action segment: a gear glyph followed by a small heavy chevron inside a segmented control segment; (d) borderless small text pull-down: 11 pt text followed by the small heavy chevron.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| style | bordered with accent cap; Action (gear) segment; borderless text | bordered | `bezelStyle`, `isBordered` | all three |
| controlSize | regular, small, mini | regular | `controlSize` | regular bordered; small borderless |
| title | text or template image | text | `title`, `image` | both |
| enabled | true, false | true | `isEnabled` | both |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, bordered | yes, light + dark | `L-Print @ 247,960,116,43` (PDF); `D-Print @ 159,930,118,43` |
| disabled, bordered | yes, light + dark | `10-15-Catalina-Light-System-Preferences-Sidecar.png @ 374,617,204,43`; `10-15-Catalina-Dark-System-Preferences-Sidecar.png @ 373,618,205,42` |
| Action segment, normal | yes, light + dark | [M] `10-15-Catalina-Light-Finder-Connect-to-Server.png @ 266,456,84,43`; `10-15-Catalina-Dark-Finder-Conect-to-Server.png @ 266,456,84,43`; gear and chevron measured below |
| borderless small, disabled | yes, light + dark | `L-SP-Mouse @ 243,404,216,26`; `D-SP-Mouse @ 243,404,216,26` |
| borderless small, enabled | yes, light + dark | [M] `L-SP-Trackpad @ 242,318,310,26` (Look up & data detectors) and `L-SP-Trackpad @ 242,418,254,26` (Secondary click); `D-SP-Trackpad` at the same places; text and chevron black 0.65 / white 0.85, measured below |
| borderless, tinted by its application | yes, light + dark | [M] Books' "Sort By": `10-15-Catalina-Light-Books.png @ 2338,192,120,30`; `10-15-Catalina-Dark-Books.png @ 2338,192,120,30`; the same geometry with a title in the label colour and a lighter chevron, measured below |
| pressed / open | not shown | [I] as `pop-up-button`: cap darkens about 12% while the menu is open |
| inactive window | not shown | [I] cap loses the accent exactly as in the disabled rendering, with title-colour chevron |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Body height, regular (edge to edge) | 20 | [M] | `L-Print` col x=345: cap edge `#5b93f3 (sRGB #4c92fa)` y=961, gradient y 962..999, edge `#2165f6 (sRGB #0361ff)` y=1000; `L-SP-Sidecar` col x=388: edge y=618, fill y 619..656, edge y=657 |
| Cap width | 16 + 0.5 edge (33 px) | [M] | `L-Print` row y=981: white ends x=328, cap x 329..360, edge `#3b7bf4 (sRGB #2679fd)` x=361 |
| Chevron bounds (relative to the cap's top-left edge corner) | x 4.5..12.0, y 8.0..12.5 (15 x 9 px) | [M] | `L-Print @ 338,977,15,9` (cap box starts x=329, y=961) |
| Chevron path (pt, cap box 16.5 x 20) | `M 5.25 8.55 L 8.25 11.55 L 11.25 8.55`, `stroke-width: 1.2`, butt caps, mitre join, no fill | [C] | fitted to the mask below; same stroke as the `pop-up-button` chevrons |
| Chevron in the disabled (un-tinted) form | same shape; its centre is 8.25 from the right edge | [M] | `L-SP-Sidecar @ 553,634,15,9`; right edge x=576 |
| Title inset | 9.5 from the edge to the first ink | [M] | `L-Print` row y=981: edge x=248, `P` ink x=267; `L-SP-Sidecar` row y=638: edge x=375, `N` ink x=394 |
| Widths seen (edge to edge) | 57 (PDF), 101 (No Devices) | [M] | `L-Print` row y=981 x 248..361; `L-SP-Sidecar` row y=638 x 375..576 |
| Action segment | 41 wide x 20 high; gear glyph 14 x 14 starting 8 from the segment's left edge; small chevron 4 after the gear | [M] | `L-Finder-Connect-to-Server` row y=477: segment x 266..347, gear ink x 282..309, y 462..489; chevron ink x 318..331, y 473..481 |
| Small heavy chevron (Action and borderless forms) | 7 x 4.5 (14 x 9 px), arms at 45 degrees. Fitted on Books' "Sort By", where it is dark on white: arms of 3, stroke 1.43, round ends and a round corner, 7.4 x 4.4 of ink (least squares over the 20 x 14 px around it; the residual is 0.02 of a pixel's coverage squared, against 0.44 for the best stroke with flat ends). The chevrons of the Trackpad and Mouse panes and of the Action segment have the same coverage row by row (3.9 to 4 px across an arm). Until 6 October 2026 this row gave a stroke of about 1.75 | [M] box; [C] fit from [M] pixels | `L-Finder-Connect-to-Server @ 318,473,14,9`; `L-SP-Mouse @ 442,412,14,9`; `10-15-Catalina-Light-Books.png @ 2434,200,20,14` |
| Borderless small: text | 11 pt regular; chevron starts 3 after the text and is centred on the x-height | [C] / [M] | `L-SP-Mouse @ 243,406,213,22`: text blob x 243..436, chevron x 442..455, y 412..420 |
| Borderless small, enabled: same geometry | text ink ends 6 before the chevron's ink (3 after the text's advance); chevron 7 x 4.5 | [M] | `L-SP-Trackpad @ 242,418,254,26`: text ink x 243..465, y 422..443; chevron ink x 478..491, y 428..436 |
| Borderless in Books ("Sort By"): same geometry | text ink ends 6.2 before the chevron's ink; chevron ink 7 wide x 4.5 high, arms about 1.4 thick, its middle 0.25 under the middle of the capitals; title 12 pt, capitals 8.5 high | [M] | `10-15-Catalina-Light-Books.png`: text ink x 2345..2425, capitals y 198..214; chevron ink x 2437..2451, y 202..211; the dark capture at the same places |

Single-chevron coverage mask (hex digit = coverage of white), origin `10-15-Catalina-Light-Print.png @ 338,977`, 15 x 9 [M]:
```
af60000000006fa
fff600000006fff
7fff6000006fff7
07fff50005fff80
008fff505fff800
0008fff9fff8000
00008fffff80000
000009fff900000
0000008f8000000
```
Small heavy chevron mask (coverage of the glyph colour), origin `10-15-Catalina-Light-Finder-Connect-to-Server.png @ 318,473`, 14 x 9 [M]:
```
16200000000261
cfe30000003efc
cffe300003effc
3effe3003effe3
03effe33effe30
003effeeffe300
0003effffe3000
00003effe30000
000003dd300000
```

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title area, edge, shadow | as `push-button`; on the Print sheet the edge composites over the sheet material: left edge `#8f9ead (sRGB #8c9eaf)`, top `#97a4b2 (sRGB #94a4b4)`, bottom `#838e9c (sRGB #818e9d)` | fill `#636f80 (sRGB #606f82)` over the dark sheet material (white 0.25 over about `#2e3e55 (sRGB #2a3e57)`), highlight row `#828c99 (sRGB #808c9a)`, outline `#2c3750 (sRGB #2a3752)` | [M] | `L-Print` row y=981 x=248, col x=270 y 961, 1000; `D-Print` row y=951 x 160..242, col x=180 y 931..970 |
| Cap gradient, edge | as `pop-up-button`: `#77a6f4 (sRGB #6ca6fb)` -> `#286ef6 (sRGB #076bff)`; edges `#5b93f3 (sRGB #4c92fa)` / `#3b7bf4 (sRGB #2679fd)` / `#2165f6 (sRGB #0361ff)` | `#6998e8 (sRGB #5d97ef)`, `#3874df (sRGB #2472e7)`, `#2e6bde (sRGB #1869e6)` -> `#2960c6 (sRGB #155ecd)` | [M] | `L-Print` col x=345 y 961..1000; `D-Print` col x=258 y 932..969 |
| Chevron | `#ffffff` | `#dee8f7 (sRGB #dce8f9)` = white 0.85 over the cap | [M] | `L-Print @ 345,983`; `D-Print @ 258,953` |
| Title | `#262626` | `#e8eaed` over `#636f80 (sRGB #606f82)` | [M] | `L-Print @ 268,981`; `D-Print @ 185,951` |
| Disabled: fill | `#f6f6f6` on `#ececec` (white 0.5) | `#4a4a4b` on `#303031` (white 0.125) | [M] | `L-SP-Sidecar @ 388,640`; `D-SP-Sidecar @ 387,640` |
| Disabled: edge top / side / bottom | `#d9d9d9` / `#d6d6d6` / `#cdcdcd` | outline `#2d2d2e`; top highlight rows `#59595a`, `#4d4d4e` | [M] | `L-SP-Sidecar` col x=388 y 618, 657; row y=638 x=375, 576; `D-SP-Sidecar` col x=387 y 618..620 |
| Disabled: title | `#b8b8b8` (black 0.25) | `#777778` (white 0.25) | [M] | `L-SP-Sidecar @ 395,640`; `D-SP-Sidecar @ 395,640` |
| Disabled: chevron | `#969696` (black 0.39) | `#777778` | [M] | `L-SP-Sidecar @ 557,638`; `D-SP-Sidecar @ 557,638` |
| Action gear and its chevron | `#262626` | `#e8e8e8` | [M] | darkest/lightest ink in 10-15-Catalina-Light-Finder-Connect-to-Server.png @ 282,462,28,28; 10-15-Catalina-Light-Finder-Connect-to-Server.png @ 318,473,14,9; 10-15-Catalina-Dark-Finder-Conect-to-Server.png @ 282,462,28,28; 10-15-Catalina-Dark-Finder-Conect-to-Server.png @ 318,473,14,9 |
| Borderless small, disabled: text and chevron | `#9d9d9d` to `#a3a3a3` on `#e3e3e3` | `#696969` on `#353637` | [M] | 10-15-Catalina-Light-System-Preferences-Mouse.png @ 445,417,8,1; lightest ink in 10-15-Catalina-Dark-System-Preferences-Mouse.png @ 243,406,213,22 |
| Borderless small, enabled: text and chevron | `#535353` on `#f0f0f0` (selected row), `#4f4f4f` on `#e3e3e3` = black 0.65 | `#e1e1e1` on `#363636`, `#e8e8e9` on `#676767` = white 0.85 | [M] | flat ink of the chevron in 10-15-Catalina-Light-System-Preferences-Trackpad.png @ 478,428,14,9 and @ 242,318,310,26; 10-15-Catalina-Dark-System-Preferences-Trackpad.png at the same places |
| Borderless in Books ("Sort By"): text / chevron | `#262626` / `#3b3b3b` on `#ffffff` = black 0.85 / black 0.77 | `#dddddd` / `#cacacb` on `#1e2022` = white 0.85 / white 0.765 | [M] alphas [C] | 10-15-Catalina-Light-Books.png @ 2351,206; 10-15-Catalina-Light-Books.png @ 2440,206; 10-15-Catalina-Dark-Books.png @ 2351,206; 10-15-Catalina-Dark-Books.png @ 2440,206 |

## Layout and spacing
- Bordered pull-downs follow the `push-button` rules (20 pt high, baseline 14.5 below the top edge, 13 pt from neighbouring buttons). In the Print dialog the PDF pull-down sits 13 pt to the right of the help button and 9 pt to the left of the Hide Details push button. [M] `L-Print` row y=981: help edges x=182 and x=221, PDF edge x=248; PDF edge x=361, Hide Details edge x=380.
- The menu opens below the button, left-aligned with it, the first item under the bottom edge. [D] (HIG)
- Action segment: last segment of an add / remove / action control under a list; see `segmented-control` and `gradient-button`.

## Keyboard and accessibility
Space or Down Arrow opens the menu when focused. AppKit role `AXMenuButton`. Web: `<button aria-haspopup="menu" aria-expanded>` with a `role="menu"` popup (ARIA menu button pattern). The Action button needs an accessible name such as "Action". [D]

## Browser notes
Same as `pop-up-button`. On vibrant sheets the translucent edge and dark fill pick up the blurred backdrop; reproduce with the alpha recipes rather than the opaque composites listed for the Print sheet.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Print.png` | 247,960,116,43 | PDF pull-down with accent cap |
| light | `10-15-Catalina-Light-System-Preferences-Sidecar.png` | 374,617,204,43 | disabled, un-tinted cap |
| light | `10-15-Catalina-Light-Finder-Connect-to-Server.png` | 266,456,84,43 | Action (gear) segment |
| light | `10-15-Catalina-Light-System-Preferences-Mouse.png` | 243,404,216,26 | borderless small text pull-down, disabled |
| light | `10-15-Catalina-Light-System-Preferences-Trackpad.png` | 242,418,254,26 | borderless small text pull-down, enabled |
| light | `10-15-Catalina-Light-Books.png` | 2338,192,120,30 | borderless "Sort By" in Books' library window, tinted by the application |
| dark | `10-15-Catalina-Dark-Print.png` | 159,930,118,43 | PDF pull-down on the dark sheet |
| dark | `10-15-Catalina-Dark-System-Preferences-Sidecar.png` | 373,618,205,42 | disabled |
| dark | `10-15-Catalina-Dark-System-Preferences-Mouse.png` | 243,404,216,26 | borderless small, disabled |
| dark | `10-15-Catalina-Dark-System-Preferences-Trackpad.png` | 242,418,254,26 | borderless small, enabled |
| dark | `10-15-Catalina-Dark-Books.png` | 2338,192,120,30 | borderless "Sort By" in Books, dark |

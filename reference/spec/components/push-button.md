# Push Button (`push-button`)

- **Status:** present
- **AppKit:** `NSButton`, `bezelStyle = .rounded` (`NSBezelStyle.rounded`, formerly `NSRoundedBezelStyle`), `setButtonType(.momentaryPushIn)`, `controlSize` = `.regular` / `.small` / `.mini`
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/push-buttons/
- **Appearances shown:** light, dark

Short file names below omit the prefix: `L-SP-<Pane>` = `10-15-Catalina-Light-System-Preferences-<Pane>.png`, `D-SP-<Pane>` = `10-15-Catalina-Dark-System-Preferences-<Pane>.png`, `L-<Name>` / `D-<Name>` = `10-15-Catalina-Light-<Name>.png` / `10-15-Catalina-Dark-<Name>.png`. Coordinates are image px.

## Purpose and behaviour
A push button sits inside a view and starts an immediate, app-specific action (print, delete, open a secondary window). It carries text, never an icon; the title uses title case, is a verb or verb phrase, and ends in an ellipsis when the button opens another window or dialog that needs more input. The width follows the title. Push buttons belong in the content area, not in toolbars or status bars. One button per view may be the default button (see `default-button`). [D] (HIG, Push Buttons)

macOS has no hover state for push buttons. Pressing shows the pressed bezel for as long as the pointer is down inside the button; the action fires on mouse-up inside. [D]

## Anatomy
```
   halo 0.5        top edge 0.5 (lighter)
  .------------------------------------.
  |  side edge 0.5     Title     0.5   |   body 20 pt high (edge to edge)
  '------------------------------------'   bottom edge 0.5 (darker)
     shadow row 1 (0.5) + row 2 (0.5)
```
Back to front: (1) 0.5 pt halo ring and two 0.5 pt shadow rows under the bezel; (2) 0.5 pt edge, drawn as translucent black so it darkens whatever is behind it, lightest on top and darkest at the bottom; (3) flat fill; (4) dark appearance only: a 0.5 pt bright highlight row plus a 0.5 pt half-bright row at the top of the fill; (5) centred title.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| controlSize | regular, small, mini | regular | `NSControl.ControlSize` | regular and small; mini not shown |
| enabled | true, false | true | `isEnabled` | both |
| title | text (title case; ellipsis when it opens a window) | - | `title` | yes |
| keyEquivalent | none, Return (default button), Escape (Cancel) | none | `keyEquivalent` | Return: see `default-button` |
| width | fits title, or fixed by layout | fits | intrinsic content size | both |
| compact (image only) | false, true | false | an image-only `NSButton` with `imagePosition = .imageOnly`, sized to its image | Messages' compose button, light + dark |
| emphasised title | false, true | false | an attributed title in the app's tint, semibold (Contacts draws it; AppKit has no property for it) | Contacts' Done, light only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, key window, regular | yes, light + dark | `L-SP-Bluetooth @ 1150,858,198,43`; `D-SP-Bluetooth @ 1150,858,198,43` |
| normal, small | yes, light + dark | `L-SP-Apple-ID @ 1210,270,170,37`; `D-SP-Apple-ID @ 1210,270,170,37`; `L-Finder-Copy-Replace @ 338,220,172,37` |
| normal, mini | not shown | [I] see Geometry |
| disabled | yes, light + dark | `L-SP-Energy-Saver @ 1118,906,264,43`; `D-SP-Energy-Saver @ 1118,906,264,43` |
| pressed | not shown | [I] light: fill becomes the default-button gradient of the current accent with white title (AppKit draws a pressed rounded button with the accent colour); dark: same with the dark default-button gradient darkened about 10% |
| hover | does not exist on macOS | [D] |
| focused (full keyboard access) | not shown | [I] standard `focus-ring` (3 pt, accent at about 50%) hugging the bezel with radius 3.75 + 2.5 pt |
| inactive window | not shown for this style | [I] identical to key window: a non-default push button does not change when its window is inactive |
| compact, normal | yes, light + dark | `L-Messages @ 1186,143,84,60`; `D-Messages @ 1198,135,84,60` (the window is not key in either capture) |
| emphasised title, normal | yes, light | `L-Contacts @ 1609,833,138,62`; no capture shows a card being edited in Dark Aqua |
| emphasised title, main or inactive window | not shown | [I] identical to key window: the title keeps its blue and semibold weight. The blue is a title colour the app sets (fixed, not the accent), and AppKit withdraws only the accent bezel and the focus ring from a window that is not key; the only capture (`L-Contacts`) is a key window |
| compact or emphasised, pressed / disabled | not shown | [I] as the standard button: the accent bezel with a white title while pressed, the dimmed title when disabled |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Body height, regular (top edge to bottom edge, edges included) | 20 | [M] | `L-SP-Bluetooth` col x=1162: `#c8c8c8` at y=859, fill y 860..897 (38 px), `#aeaeae` at y=898 |
| Total painted height, regular (halo row + body + 2 shadow rows) | 21.5 | [M] | same column: halo `#e6e6e6` y=858, shadow rows y=899, 900 |
| Body height, small | 17 | [M] | `L-SP-Apple-ID` col x=1222: edge `#d8d8d8` y=271, fill y 272..303 (32 px), edge `#bcbcbc` y=304; `L-Finder-Copy-Replace` col x=352: y 221..254; `L-SP-Date-and-Time` col x=954: y 895..928 |
| Body height, mini | 14 | [I] | AppKit mini metric (regular 20, small 17 measured; mini follows the 3 pt step); not shown |
| Edge width | 0.5 (1 px), inside the body size | [M] | `L-SP-Bluetooth` row y=880: `#c1c1c1` x1 at x=1151 and x=1346 |
| Corner radius, regular | 3.75, on the outer edge of the 0.5 pt border (so 3.25 on the fill and 4.25 on the halo). Least-squares fit of a rendered 1 px ring to the 14 x 14 px corner: rms error 1.5 levels at 3.75, 2.1 at 3.625, 2.3 at 4, 2.7 at 3.5. The Go to Folder and Bluetooth corners are pixel-identical. The earlier reading of 4 took the point where the edge reaches its straight colour (8 px from the corner), which overstates the radius by the anti-aliasing | [C] fit from [M] pixels | `10-15-Catalina-Light-Finder-Go-To-Folder.png @ 569,284,14,14`; `10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 1149,856,14,14` |
| Corner radius, small | 3.75, same definition and fit (rms 1.9 levels at 3.75, 2.8 at 4, 3.0 at 3.5) | [C] fit from [M] pixels | `10-15-Catalina-Light-System-Preferences-Date-and-Time.png @ 941,892,14,14` |
| Corner radius as built (CSS), regular and small | `3.5px` on the bezel's outer edge. This is the library's adopted value by product decision (2026-10-02), an implementation choice and not a measurement; the two measured rows above are unchanged. The token layer's owner reports that it gives the lowest summed mismatch against the eight bezel crops when rendered in Chromium (0.28 points at 3.5px, 0.39 at 3.625px, 0.98 at 3.75px, 1.61 at 4px; not re-run for this spec). The quarter point is half a device pixel at 2x, and is within the uncertainty of both figures | [I] | `src/styles/tokens/metrics.css`; `tokens.md`, "Control radius" |
| Corner radius, mini | not shown in any screenshot, so nothing is measured. `2.5px` as built (the token layer's provisional value); this spec's token sheet earlier proposed 3. Both are inferred and no pixel evidence favours either. The regular and small bezels share one measured radius, so a smaller mini radius is itself an assumption | [I] | `tokens.md`, `--mac-radius-control-mini` |
| Title font | 13 pt regular (regular size); 11 pt regular (small) | [C] | cap height 19 px (`A` y 869..887 in `L-SP-Bluetooth @ 1178,869,16,19`), x-height 14 px -> 13 pt; small: cap 16 px (`O` y 280..295 in `L-SP-Apple-ID @ 1245,280,15,16`), x-height 12 px -> 11 pt |
| Title baseline, regular | 14.5 below the top edge (5.5 above the bottom edge) | [M] | `L-SP-Bluetooth`: top edge y=859, cap top y=869, last ink row of caps y=887 |
| Title baseline, small | 12.5 below the top edge | [M] | `L-SP-Apple-ID`: top edge y=271, caps y 280..295 |
| Horizontal padding, edge to first / last ink | 13.5 to 14.5 leading, 14.5 to 15.5 trailing (AppKit: 14 pt each side of the title box) | [M] | `L-SP-Bluetooth` Advanced: edges x=1151 / 1346, ink x 1178..1315; Turn Bluetooth Off: edges 237 / 516, ink 265..486; `L-SP-Family-Sharing` Next: edges 1295 / 1406, ink 1324..1376 |
| Horizontal padding, small | 7.5 to 15 leading, 9 to 18.5 trailing (fixed-width layouts vary) | [M] | `L-Finder-Copy-Replace` Keep Both: edges 339 / 508, ink 371..475 (fixed-width group); `L-SP-Date-and-Time`: edges 943 / 1258, ink 958..1240 -> 7.5 / 9 (title fills the button) |
| Widths seen, regular (edge to edge) | 56 (Next), 69 (OK, Cancel in Music Preferences), 83 (Cancel, Go), 98 (Advanced…), 140 (Turn Bluetooth Off), 202 (Set Up Bluetooth Keyboard…) | [M] | `L-SP-Family-Sharing` row y=671 x 1295..1406; `L-Music-Preferences` row y=599 x 835..972; `L-Finder-Go-To-Folder` row y=308 x 571..736; `L-SP-Bluetooth` rows y=880, 575; `L-SP-Keyboard` row y=1180 x 931..1334 |
| Minimum width | not determinable from the screenshots; narrowest instance is 56 pt | [I] | use title width + 28 pt, with 56 pt as a floor |
| Compact button (one image, no title), regular | bezel 33 wide around an 18 pt image: 7.5 from each side edge to the image, so 8 from the alignment rectangle (34 wide) to the image. Messages makes this one 21 high, edge to edge, a point more than the regular bezel | [M] | `L-Messages` row y=173: edges x=1195 and 1260; col x=1206: halo y=152, edge y=153, fill y 154..193, edge y=194, shadow rows y=195, 196 (`@ 1186,143,84,60`). `D-Messages` row y=166: fill x 1208..1271; col x=1218: highlight row y=146, fill to y=185 (`@ 1198,135,84,60`) |
| Compact button, small and mini | 6 and 5 from the alignment rectangle to the image | [I] | not shown; scaled with the control size |
| Emphasised button (Contacts' Done) | the standard regular bezel, 59 wide and 20 high; the title's capitals are 9 pt high, as 13 pt text | [M] | `L-Contacts` row y=863: edges x=1619 and 1736; col x=1632: edge y=843, fill y 844..881, edge y=882, shadow rows y=883, 884; title ink x 1647..1708, capital rows y 854..871 (`@ 1609,833,138,62`) |

### Colours and fills
The edge and shadow are translucent black and the dark fill is translucent white, so they change with the background. The alpha values reproduce all measured composites to within 1 level.

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill, normal | `#ffffff` flat | `rgba(255,255,255,0.25)` -> `#646465` on window `#303031`, `#686869` in a box `#363637`, `#565657` on a list `#1d1e1f` | [M] composites, [C] alpha | `L-SP-Bluetooth @ 1200,880`; `D-SP-Bluetooth @ 1200,880`; `D-SP-Keyboard @ 760,1062`; `D-SP-Apple-ID @ 1223,283` |
| Top highlight inside the fill (dark only) | none | row 1 `#838383` (white 0.40), row 2 `#6a6a6a` (white 0.28), each 0.5 pt | [M] | `D-SP-Bluetooth` col x=1162: y=860 `#838383`, y=861 `#6a6a6a`, then `#646465` x36 |
| Top edge | `rgba(0,0,0,0.153)`: `#c8c8c8` on `#ececec`, `#c0c0c0` on `#e3e3e3`, `#d8d8d8` on `#ffffff` | `rgba(0,0,0,0.083)`: `#2c2c2d` on `#303031` | [M], [C] alpha | `L-SP-Bluetooth @ 1162,859`; `L-SP-Keyboard @ 748,1044`; `L-SP-Apple-ID @ 1222,271`; `D-SP-Bluetooth @ 1162,859` |
| Side edge | `rgba(0,0,0,0.184)`: `#c1c1c1` / `#b9b9b9` / `#d0d0d0` on the same three backgrounds; `#b7b7b7` on `#e0e0e0` | `rgba(0,0,0,0.125)`: `#2a2a2b` on `#303031`, `#2f2f30` on `#363637`, `#191a1b` on `#1d1e1f` | [M], [C] | `L-SP-Bluetooth @ 1151,880`; `L-SP-Keyboard @ 737,1062`; `L-SP-Apple-ID @ 1211,283`; `L-Finder-Open @ 133,1264`; `D-SP-Bluetooth @ 1151,880` |
| Bottom edge | `rgba(0,0,0,0.263)`: `#aeaeae` / `#a7a7a7` / `#bcbcbc` | `rgba(0,0,0,0.21)`: `#262627` on `#303031`, `#2b2b2c` on `#363637` | [M], [C] | `L-SP-Bluetooth @ 1162,898`; `L-SP-Keyboard @ 748,1083`; `L-SP-Apple-ID @ 1222,304`; `D-SP-Bluetooth @ 1162,898` |
| Fill, disabled | `rgba(255,255,255,0.5)`: `#f1f1f1` on `#e3e3e3`, `#f6f6f6` on `#ececec` | `rgba(255,255,255,0.125)`: `#4f4f50` on `#363637`, `#4a4a4b` on `#303031`; top rows `#5e5e5f`, `#525253` | [M], [C] | `L-SP-Energy-Saver @ 1200,926`; `L-SP-Sidecar @ 388,640` (pull-down, same bezel); `D-SP-Energy-Saver @ 1131,926` col y 908..946 |
| Edge, disabled | top `#d2d2d2`, side `#cdcdcd`, bottom `#c5c5c5` on `#e3e3e3` (black 0.075 / 0.097 / 0.132) | side `#323334`, bottom `#303031` on `#363637` | [M] | `L-SP-Energy-Saver` col x=1130 y 906..948, row y=926 x=1119; `D-SP-Energy-Saver` row y=926 x=1119 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title colour, normal | `#262626` on white = `rgba(0,0,0,0.85)` (`controlTextColor`) | `#e8e8e8` on `#646465` = `rgba(255,255,255,0.85)` | [M], [C] | `L-SP-Bluetooth @ 1315,886` (421 px of `#262626` in `@ 1153,861,192,36`); `D-SP-Bluetooth @ 1315,886` |
| Title colour, disabled | `#b5b5b5` on `#f1f1f1` = `rgba(0,0,0,0.25)` | `#7b7b7c` on `#4f4f50` = `rgba(255,255,255,0.25)` | [M], [C] | `L-SP-Energy-Saver @ 1347,933`; `D-SP-Energy-Saver @ 1347,933` |
| Title alignment | centred horizontally; single line; truncates with an ellipsis in the middle when too narrow | same | [D] | AppKit `NSButtonCell` default `lineBreakMode` |
| Font | SF Pro Text Regular 13 pt (regular), 11 pt (small), 9 pt (mini) | same | [C] 13 / 11, [D] 9 | cap heights above; `NSFont.systemFontSize(for:)` |
| Title, emphasised button | `#4188f2` as stored (Display P3), `#2687fa` in sRGB; semibold, 13 pt | not shown; `#429bff`, the dark link colour, as built | [M] light, [I] dark and the weight (read from the stroke width beside the regular titles of the same capture) | `L-Contacts @ 1660,862` |

### Shadows and effects
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Halo ring (0.5 pt outside the edge, all sides) | `rgba(0,0,0,0.027)`: `#e6e6e6` on `#ececec`, `#dddddd` on `#e3e3e3`, `#f8f8f8` on white | `rgba(0,0,0,0.02)`: `#2f2f30` on `#303031` | [M], [C] | `L-SP-Bluetooth @ 1150,880` and `@ 1162,858`; `D-SP-Bluetooth @ 1150,880` |
| Shadow row 1 (0.5 pt directly under the bottom edge) | `rgba(0,0,0,0.118)`: `#d0d0d0` on `#ececec`, `#c8c8c8` on `#e3e3e3`, `#e1e1e1` on white | `rgba(0,0,0,0.104)`: `#2b2b2c` on `#303031` | [M], [C] | `L-SP-Bluetooth @ 1162,899`; `D-SP-Bluetooth @ 1162,899` |
| Shadow row 2 | `rgba(0,0,0,0.039)`: `#e3e3e3` on `#ececec`, `#dadada` on `#e3e3e3`, `#f5f5f5` on white | `rgba(0,0,0,0.042)`: `#2e2e2f` | [M], [C] | `L-SP-Bluetooth @ 1162,900`; `D-SP-Bluetooth @ 1162,900` |
| Fitted CSS | `box-shadow: 0 0 0 0.5px rgba(0,0,0,.027), 0 0.5px 0 rgba(0,0,0,.118), 0 1px 0.5px rgba(0,0,0,.039)` outside a `0.5px` border whose colour runs `rgba(0,0,0,.153)` (top) -> `.184` (sides) -> `.263` (bottom) | `box-shadow: 0 0.5px 0 rgba(0,0,0,.10), 0 1px 0.5px rgba(0,0,0,.04), inset 0 0.5px 0 rgba(255,255,255,.20), inset 0 1px 0 rgba(255,255,255,.04)`; border `rgba(0,0,0,.083)` -> `.125` -> `.21` | [C] | derived from the rows above |

## Layout and spacing
| Rule | Value (pt) | Tag | Evidence |
|---|---|---|---|
| Gap between adjacent regular buttons in a dialog (edge to edge) | 13 (AppKit: 12 pt between alignment rects; the visible edge sits 0.5 pt inside each) | [M] | `L-Finder-Go-To-Folder` row y=308: Cancel right edge x=736, Go left edge x=763 (26 px); `L-Finder-Connect-to-Server` row y=477: 858 -> 885; `L-Music-Preferences` row y=599: 972 -> 999; `L-SP-Language-and-Region` row y=1048: 1118 -> 1145 |
| Gap between buttons in an alert | 15 | [M] | `L-Finder-Empty-Trash` row y=321: Cancel right edge x=654, Empty Trash left edge x=685 (30 px) |
| Gap between small buttons (Finder copy conflict alert) and in the Open panel bottom bar | 9 | [M] | `L-Finder-Copy-Replace` row y=238: 508 -> 527, 696 -> 715 (18 px); `L-Finder-Open` row y=1264: 1746 -> 1765 |
| Button to window right edge and bottom edge (dialog) | 20.5 each (20 pt margin + 0.5 pt edge inset) | [M] | `L-Finder-Go-To-Folder`: Go right edge x=928, frame right x=969; bottom edge y=326, frame bottom y=367. `L-Finder-Connect-to-Server`: 1042 -> 1083, 496 -> 537 |
| Button to window edge in a preference pane | 20.5 from the left edge and 20.5 from the bottom edge (Hot Corners) | [M] | `L-SP-Mission-Control`: left edge x=153, frame x=112; bottom edge y=994, frame bottom y=1035 |
| Button to help button on the same row | 13 between edges | [M] | `L-SP-Bluetooth` row y=880: Advanced right edge x=1346, help left edge x=1373 (26 px); `L-SP-Keyboard` row y=1180: 1334 -> 1361 |
| Vertical alignment with a label or checkbox on the same row | baselines align (button baseline is 14.5 pt below its top edge) | [M] | `L-SP-Bluetooth`: checkbox title cap bottom y=887 (`@ 630,864,376,28`), button cap bottom y=887 |
| Growth | width grows with the title; height is fixed per control size | [D] | HIG, Push Buttons |

## Keyboard and accessibility
- Space activates the focused button; Return activates the default button; Escape and Command-Period activate the Cancel button. Tab reaches push buttons only when Full Keyboard Access is on ("All controls"). [D] (HIG, Keyboard)
- AppKit role `AXButton` with the title as `AXTitle`. Web: a native `<button>`; `aria-disabled` or `disabled` for the disabled state. [D]

## Browser notes
- The edge is three different translucent blacks (top, sides, bottom). A single CSS `border-color` cannot do that with a radius; use `border: 0.5px solid` with `border-color: rgba(0,0,0,.153) rgba(0,0,0,.184) rgba(0,0,0,.263)` (the corner blends are close to AppKit's) or a 0.5 px gradient ring drawn with `background-clip`.
- On a 1x display the 0.5 pt edge, halo and shadow rows cannot be drawn; round the edge to 1 px and keep one 1 px shadow row at `rgba(0,0,0,.08)`.
- Text is greyscale anti-aliased in the screenshots: `-webkit-font-smoothing: antialiased`.

## Pixel audit
Each line below is an unambiguous stored-pixel citation, independently re-sampled in the sysA continuation audit (tolerance ±2 per channel).
- Normal fill [M] `#ffffff`: 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 1200,880.
- Normal dark fill [M] `#646465`: 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 1200,880.
- Top edge [M] `#c8c8c8`: 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 1162,859.
- Side edge [M] `#c1c1c1`: 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 1151,880.
- Bottom edge [M] `#aeaeae`: 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 1162,898.
- Title [M] `#262626`: 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 1315,886.
- Dark title [M] `#e8e8e8`: 10-15-Catalina-Dark-System-Preferences-Bluetooth.png @ 1315,886.
- Halo [M] `#e6e6e6`: 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 1162,858.
- Shadow first row [M] `#d0d0d0`: 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 1162,899.
- Shadow second row [M] `#e3e3e3`: 10-15-Catalina-Light-System-Preferences-Bluetooth.png @ 1162,900.
- Disabled fill [M] `#f1f1f1`: 10-15-Catalina-Light-System-Preferences-Energy-Saver.png @ 1200,926.
- Disabled dark fill [M] `#4f4f50`: 10-15-Catalina-Dark-System-Preferences-Energy-Saver.png @ 1131,926.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-System-Preferences-Bluetooth.png` | 1150,858,198,43 | regular, normal, on window background |
| light | `10-15-Catalina-Light-System-Preferences-Keyboard.png` | 736,1043,366,43 | regular, inside a box (`#e3e3e3`) |
| light | `10-15-Catalina-Light-System-Preferences-Apple-ID.png` | 1210,270,170,37 | small, on a white list row |
| light | `10-15-Catalina-Light-System-Preferences-Energy-Saver.png` | 1118,906,264,43 | regular, disabled |
| light | `10-15-Catalina-Light-Finder-Copy-Replace.png` | 338,220,548,37 | three small buttons, 9 pt apart |
| light | `10-15-Catalina-Light-Finder-Go-To-Folder.png` | 570,286,360,43 | Cancel next to the default button |
| dark | `10-15-Catalina-Dark-System-Preferences-Bluetooth.png` | 1150,858,198,43 | regular, normal |
| dark | `10-15-Catalina-Dark-System-Preferences-Keyboard.png` | 736,1043,366,43 | regular, inside a box (`#363637`) |
| dark | `10-15-Catalina-Dark-System-Preferences-Apple-ID.png` | 1210,270,170,37 | small, on a dark list row |
| dark | `10-15-Catalina-Dark-System-Preferences-Energy-Saver.png` | 1118,906,264,43 | regular, disabled |
| dark | `10-15-Catalina-Dark-Finder-Copy-Replace.png` | 338,220,548,37 | three small buttons |
| light | `10-15-Catalina-Light-Messages.png` | 1186,143,84,60 | compact button around one image (compose), on the conversation list's material |
| dark | `10-15-Catalina-Dark-Messages.png` | 1198,135,84,60 | compact button around one image (compose) |
| light | `10-15-Catalina-Light-Contacts.png` | 1609,833,138,62 | emphasised title (Done) on a card being edited |

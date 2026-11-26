# Today widget (`today-widget`)

- **Status:** present
- **AppKit:** `NCWidgetProviding` Today extension hosted in a Notification Center card (NotificationCenter framework; available macOS 10.10-10.15, deprecated in 11)
- **HIG:** https://web.archive.org/web/20200503144232/https://developer.apple.com/design/human-interface-guidelines/macos/extensions/notification-center-widgets/
- **Appearances shown:** light, dark

## Purpose and behaviour
A widget shows a small amount of timely information or one focused function in the Today view (for example Weather, Calendar, Stocks). Widgets are glanceable, update themselves, size to their content at the fixed card width, and keep interaction minimal; tapping opens the app (HIG, Notification Center Widgets) [D]. The Today view also has system cards that are not extensions: the Night Shift / Do Not Disturb switches and the date + summary block.

## Anatomy
```
+--------------------------------------- 322 pt ---+
| [icon] APP NAME                                  |  26 pt header band
+--------------------------------------------------+
|  content (app drawn)                             |
+--------------------------------------------------+   6 pt gap to the next card
```
Cards seen: switches card (two 42.5 pt rows), Calendar (timeline), Stocks (five 35 pt rows + "Show More..."), Weather (cut off at the bottom).

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| header | icon + upper-case app name; optional info (i) button on hover | shown | widget `CFBundleDisplayName` | CALENDAR, STOCKS, WEATHER |
| content height | free | - | `preferredContentSize` | 222 pt (Calendar), about 208 pt (Stocks) |
| system cards | switches, date block, summary | - | - | all |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes | Calendar: 10-15-Catalina-Light-Notification-Center-Today.png @ 2694,900,644,496; Stocks: @ 2694,1408,644,500 (dark: same in 10-15-Catalina-Dark-Notification-Center-Today.png) |
| switches card | yes | 10-15-Catalina-Light-Notification-Center-Today.png @ 2694,164,644,174 |
| header hovered (info button), edit mode (remove badge) | no | [I] (i) button at the header's right; red minus badge at the top-left in edit mode |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Card width | 322 (px 2694..3337), 11 pt panel margins | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2688,200,12,1; 3330,200,30,1 |
| Card corner radius | 4 | [M] | 10-15-Catalina-Dark-Notification-Center-Notifications.png @ 2692,228,12,10 (same card style) |
| Header band height | 26 (px y=900..951 in the Calendar card) | [M] | 10-15-Catalina-Dark-Notification-Center-Today.png @ 3000,900,1,52 |
| Header icon | about 14 pt box, left edge 9 pt from the card edge (px 2712..2739 in the same card style) | [M] | 10-15-Catalina-Dark-Notification-Center-Notifications.png @ 2700,254,52,1 |
| Header title inset | 31.5 from the card's left edge (px 2757) | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2757,917,127,18 |
| Header title baseline | 17.5 below the card top (rows 917..934 in a card starting at 900) | [M] | same |
| Calendar card height | 248 (px y=900..1395) | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 3000,900,1,496 |
| Calendar hour lines | 1 pt lines (2 px) at y=1042, 1130, 1218, 1306 px: 44 pt per hour; red "now" line 1 pt at y=1203 | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 3000,1042,1,270 |
| Calendar hour labels | right-aligned, ink ending px 2827 (66.5 pt from the card edge); event title from px 2868 | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2778,1034,50,16; 2868,1056,303,18 |
| Stocks row pitch | 35 (dark stem rows 1507..1523, 1577..1593, 1647..1663, 1717..1733, 1787..1803: 70 px pitch) | [C] from measured ink rows | 10-15-Catalina-Light-Notification-Center-Today.png @ 2730,1490,74,330 |
| Stocks symbol inset | 18 from the card edge (px 2730) | [M] | same |
| Stocks change pill | 61 x 22 (px 3182..3303 x 1494..1537), right inset 17 from the card edge, radius about 2 | [M] size; [I] radius | 10-15-Catalina-Light-Notification-Center-Today.png @ 3176,1516,136,1; 3186,1490,1,55 |
| Switches card | 87 high: two rows of 42.5 (px y=165..249, 252..336) with a 1 pt divider (250..251) | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 3000,150,1,200 |
| Switches card label inset | 31 from the card edge (px 2756); glyph (sun / moon) at 8 pt | [M] label; [I] glyph | 10-15-Catalina-Light-Notification-Center-Today.png @ 2756,196,150,18 |
| Date block | two lines, text from x=45 pt of the panel (px 2762); cap tops y=443 and 519 px: 38 pt line pitch; block starts 53 pt below the switches card | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2762,443,238,49; 2764,519,282,50 |
| Summary text | from x=46 pt (px 2764), 15 pt line pitch (ink rows 644..666, 674..696); weather artwork 23 x 18 (x=2705..2750, y=638..673), left inset 16.5 pt from panel x=2672 | [M] ink and glyph; [C] pitch and inset | 10-15-Catalina-Light-Notification-Center-Today.png @ 2764,632,495,82; 10-15-Catalina-Light-Notification-Center-Today.png @ 2698,630,62,47 |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Card fill, observed | `#dff4ff (sRGB #daf5ff)`..`#e3f5ff (sRGB #dff5ff)` over the sky-backed panel (`#bcdcf5 (sRGB #b5ddf8)`); `#baccde (sRGB #b6cce0)` lower (stocks) | `#162640 (sRGB #122642)` over panel `#1c3050 (sRGB #173053)`; `#1a2636 (sRGB #172637)` lower | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2695,200,5,1; 2840,1515; 10-15-Catalina-Dark-Notification-Center-Today.png @ 2695,200,5,1; 2840,1515 |
| Card recipe (over the panel material) | `rgba(255,255,255,0.55)` | `rgba(0,0,0,0.21)` | [C] | (0xdf-0xbc)/(255-0xbc) etc.; 0x16/0x1c |
| Card edge | 1 px `#c8dde8 (sRGB #c3dee9)` (slightly darker than the fill) | 1 px `#101b2e (sRGB #0d1b30)` | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2694,200; 10-15-Catalina-Dark-Notification-Center-Today.png @ 2694,200 |
| Header band | `#cdd3d8 (sRGB #ccd3d9)` against body `#d0dde9 (sRGB #cdddea)` (about `rgba(0,0,0,0.04)`) | `#1f2836 (sRGB #1d2837)` against body `#243246 (sRGB #213248)` (about `rgba(0,0,0,0.12)`) | [M] composite, [C] alpha | 10-15-Catalina-Light-Notification-Center-Today.png @ 3000,901,1,60; 10-15-Catalina-Dark-Notification-Center-Today.png @ 3000,901,1,60 |
| Header title | `#414a50 (sRGB #3f4a51)` | `#9ba6b5 (sRGB #99a6b7)` | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2757,917,127,18; dark same |
| Row divider (switches card, calendar hours) | `#c9dee8 (sRGB #c4dfe9)` on `#e0f5ff (sRGB #dbf6ff)`; `#b6c8d8 (sRGB #b2c8da)` on `#ccdeef (sRGB #c8def1)` (about `rgba(0,0,0,0.1)`) | `#394961 (sRGB #354963)` on `#15233a (sRGB #12233c)`; `#46576e (sRGB #425770)` (about `rgba(255,255,255,0.16)`) | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 3000,250,1,2; 3000,1042,1,2; dark same |
| Primary text (event title, stock symbol, switch labels) | `#122334 (sRGB #0d2336)`, `#07192a (sRGB #02192b)`, `#2c414c (sRGB #26414d)` | `#ffffff` | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2868,1056,303,18; 2730,1506,74,18; 2756,196,150,18; dark same |
| Secondary text (prices, hour labels) | `#3b4d60 (sRGB #374d62)`, `#4b5c6b (sRGB #475c6d)` | `#97a3b3 (sRGB #95a3b5)`, `#a1b2c9 (sRGB #9db2cb)` | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 3051,1506,110,22; 2778,1034,50,16; dark same |
| Date text | `#466376 (sRGB #3e6478)` / `#4e5c68 (sRGB #4b5c69)` (vibrant grey-blue) | `#a5b9dc (sRGB #a1b9df)` | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2762,443,238,49; 10-15-Catalina-Dark-Notification-Center-Today.png @ 2766,444,173,56 |
| Stocks change pill | `#76d572 (sRGB #4bd964)` with white text | `#76d572 (sRGB #4bd964)` | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 3186,1495,1,42; dark same |
| Calendar "now" line and label | `#a5191a (sRGB #b4000b)` line; red label | `#ff9ea4 (sRGB #ff98a2)` | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 3000,1203,1,2; 10-15-Catalina-Dark-Notification-Center-Today.png @ 3000,1142,1,2 |
| Calendar event bar | 2 pt vertical line (x=2850..2853), `#7d3ebf (sRGB #8832c6)` | 2 pt, `#e4b0ff (sRGB #eeabff)` | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2840,1056,20,1; 10-15-Catalina-Dark-Notification-Center-Today.png @ 2840,1056,20,1 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Header title | 13 pt Regular, upper case (cap height 18 px) | same | [C] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2757,917,127,18 |
| Switch labels ("NIGHT SHIFT") | 13 pt Semibold, upper case (18 px) | same | [C] size; [I] weight | 10-15-Catalina-Light-Notification-Center-Today.png @ 2756,196,150,18 |
| Date block | SF Pro Display Thin/Light about 34 pt ("October 3" 50 px) | same | [C] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2764,519,282,50 |
| Summary | 12 pt Regular (23 px ascender-to-descender) | same, white | [C] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2764,644,495,23 |
| Event title, stock symbol | 13 pt (18 px); symbols Semibold | same | [C] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2868,1056,303,18 |
| Hour labels | 11 pt Regular (16 px) | same | [C] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2778,1034,50,16 |
| Switch control | `switch` component, 38 x 21 track (x=3242..3317, y=187..228); right inset 10 pt to card outer edge x=3337 | same | [M] size; [C] inset | 10-15-Catalina-Light-Notification-Center-Today.png @ 3230,206,112,1; 10-15-Catalina-Light-Notification-Center-Today.png @ 3300,180,1,60 |

### Shadows and effects
None.

## Layout and spacing
Widgets stack vertically with 6 pt gaps; width is fixed; height follows the content. Content insets are the widget's own (Stocks 18 pt, Calendar hour gutter 66.5 pt).

## Keyboard and accessibility
Widgets expose their own controls; headers are `AXStaticText`. ARIA: each card a `region` labelled by its header.

## Browser notes
The card is a translucent overlay on the panel material (no separate blur needed). Widget contents (calendar timeline, stock list, weather) are app-specific layouts to rebuild from the measurements here.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Notification-Center-Today.png | 2694,900,644,496 | Calendar widget |
| light | 10-15-Catalina-Light-Notification-Center-Today.png | 2694,1408,644,500 | Stocks widget |
| light | 10-15-Catalina-Light-Notification-Center-Today.png | 2694,164,644,174 | Night Shift / Do Not Disturb card |
| dark | 10-15-Catalina-Dark-Notification-Center-Today.png | 2694,164,644,1750 | all cards, dark |

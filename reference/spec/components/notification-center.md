# Notification Center (`notification-center`)

- **Status:** present
- **AppKit:** NotificationCenter.app panel (full-height `NSVisualEffectView`), `NSSegmentedControl` header
- **HIG:** https://web.archive.org/web/20200503160812/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/notifications/
- **Appearances shown:** light, dark

## Purpose and behaviour
Notification Center slides in from the right edge when the user clicks its menu bar extra (or swipes from the trackpad's right edge). It has two views chosen with a segmented control: Today (date, summary and widgets) and Notifications (delivered notifications grouped by day). It covers the desktop and the Dock's right end but sits below the menu bar; clicking elsewhere dismisses it [D].

## Anatomy
```
| menu bar                                   |
+------------------------------- 344 pt -----+
|        [   Today   |Notifications]         |  49 pt header, 19.5 pt control
+--------------------------------------------+  1 pt divider
|  cards / date / widgets (scrolls)          |
|  ...                                       |
+--------------------------------------------+  1 pt divider
|               Edit / N New            (*)  |  44 pt footer
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| view | Today, Notifications | Today | segmented control | both |
| footer button | "Edit" (Today), "N New" (when new widgets are available), none (Notifications) | Edit | - | "2 New" (light), "Edit" (dark), none (Notifications) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Today view | yes | 10-15-Catalina-Light-Notification-Center-Today.png @ 2672,44,688,2056; 10-15-Catalina-Dark-Notification-Center-Today.png @ 2671,44,689,2056 |
| Notifications view | yes | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2672,44,688,2056; 10-15-Catalina-Dark-Notification-Center-Notifications.png @ 2671,44,689,2056 |
| empty Notifications ("No Notifications") | no | [I] centred secondary text |
| widget edit mode | no | [I] widgets gain remove buttons and a second column lists available widgets |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Panel width | 344 (px 2672..3359) | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2655,1500,60,1; 10-15-Catalina-Dark-Notification-Center-Today.png @ 2655,1500,60,1 |
| Panel vertical extent | from the menu bar's bottom (y=22 pt) to the screen bottom | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2690,44,1,2056 |
| Header height | 49 (px y=44..141) + 1 pt divider (142..143) | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2690,44,1,102 |
| Segmented control | 294 x 19.5 (px 2722..3309 x 73..112), each segment 147; 25 pt side insets; 15 pt above and below | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2670,92,690,1; 2860,40,1,100 |
| Segmented control corner radius | about 2.5 | [M] | 10-15-Catalina-Dark-Notification-Center-Notifications.png @ 2718,71,10,8 |
| Content side margins | 11 (cards px 2694..3337) | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2688,200,12,1; 3330,200,30,1 |
| First card top | 10 below the header divider (card edge y=164) | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 3000,150,1,20 |
| Gap between cards | 6 (calendar card ends y=1395, stocks card starts 1408) | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 3000,1390,1,22 |
| Footer | 44 (px y=2012..2099) under a 1 pt divider (2010..2011) | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2800,2006,1,94 |
| Day heading (Notifications view) | "Today" / "Yesterday": text from x=31.5 pt (px 2735), cap top 63 pt below the panel top (y=170) | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2735,170,112,40 |
| Clear button | 14 pt circle with an x (px 3294..3321 x 176..203), right inset 19 | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 3285,189,45,1; 3307,170,1,40 |
| Footer gear button | 18 x 18 pt ink (x=3298..3333, y=2038..2073); centre 22.25 pt from screen right edge x=3360 and 22.25 pt above bottom y=2100 | [M] ink; [C] position | 10-15-Catalina-Light-Notification-Center-Today.png @ 3290,2030,50,50 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Panel material, observed | `#778e98 (sRGB #718f99)`..`#cde3f6 (sRGB #c8e3f8)` over the Day picture (mean `#a1b3c3 (sRGB #9db3c5)`): `#afd1f3 (sRGB #a7d1f7)` at the top over sky, `#c8bba3 (sRGB #cabba0)` over rock, `#7993aa (sRGB #7393ac)` over sea | `#1b2831 (sRGB #182832)`..`#364361 (sRGB #334364)` (mean `#26344a (sRGB #23344c)`) | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2690,44,1,2056; 10-15-Catalina-Dark-Notification-Center-Today.png @ 2690,44,1,2056 |
| Panel recipe | `backdrop-filter: blur(25px) saturate(1.7)` + `rgba(238,244,246,0.47)` | `backdrop-filter: blur(30px) saturate(1.6)` + `rgba(58,58,56,0.42)` | [C] | least-squares fit of 614 panel pixels against the same pixels of the Desktop screenshots (same wallpaper): rms 3.6 / 1.7 levels |
| Opaque fallback | `#a1b3c3 (sRGB #9db3c5)` (mean over the default picture); `#f2f2f2` neutral [I] | `#26344a (sRGB #23344c)`; `#2a2a2a` neutral [I] | [M] first values | fit summary |
| Left edge | none visible (first pixel `#92a9c1 (sRGB #8da9c4)`, slightly lighter) | 1 pt lighter line `#4e5a6a (sRGB #4b5a6c)` + 0.5 pt dark line `#020407` outside | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2672,1500; 10-15-Catalina-Dark-Notification-Center-Today.png @ 2671,1500,3,1 |
| Header divider | `#a3c2de (sRGB #9cc3e1)` on `#b7d7f3 (sRGB #b0d8f6)` (about `rgba(0,0,0,0.09)`) | `#3e516f (sRGB #3a5172)` on `#192c49 (sRGB #142c4b)` (about `rgba(255,255,255,0.16)`) | [M] composite, [C] alpha | 10-15-Catalina-Light-Notification-Center-Today.png @ 2690,142,1,2; 10-15-Catalina-Dark-Notification-Center-Today.png @ 2690,142,1,2 |
| Footer divider | `#788aa0 (sRGB #748aa2)` on `#8fa1b7 (sRGB #8ba1b9)` | `#4d5968 (sRGB #4a596a)` on `#2a3645 (sRGB #273646)` | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2800,2010,1,2; 10-15-Catalina-Dark-Notification-Center-Today.png @ 2800,2010,1,2 |
| Segment, selected | `#eff6fc (sRGB #eef6fd)` (Today), `#f1f7fc (sRGB #f0f7fd)` (Notifications) | `#a6b8d6 (sRGB #a2b8d9)`, `#a5b5d2 (sRGB #a2b5d5)` | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2740,92; -Light-Notification-Center-Notifications.png @ 3030,92; dark files same points |
| Segment, unselected | `#a5bcd0 (sRGB #a0bcd2)`, `#9db8d1 (sRGB #97b8d4)` (translucent darkening of the panel) | `#51617e (sRGB #4e6181)`, `#526482 (sRGB #4e6485)` | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 3030,92; -Light-Notification-Center-Notifications.png @ 2740,92; dark files same points |
| Segment recipes | selected `rgba(255,255,255,0.80)`; unselected `rgba(0,0,0,0.12)` | selected `rgba(200,215,245,0.75)`; unselected `rgba(255,255,255,0.22)` | [C] | composites over the header fill `#b6d5f2 (sRGB #afd6f5)` / `#192b47 (sRGB #142b49)` |
| Segment text, selected | `#303132` | `#21252a (sRGB #20252b)` | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2837,92; 10-15-Catalina-Dark-Notification-Center-Today.png @ 2837,92 |
| Segment text, unselected | `#f5f7f9` | `#ebecef` | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 3101,92; 10-15-Catalina-Dark-Notification-Center-Today.png @ 3101,92 |
| Day heading text | `#3d5c76 (sRGB #345c79)` | `#99acca (sRGB #95accd)` | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2735,170,112,40; 10-15-Catalina-Dark-Notification-Center-Notifications.png @ 2735,170,165,32 |
| Clear button | `#475d6b (sRGB #415d6d)` disc (edge pixels `#4e6270 (sRGB #496272)`), x in the panel colour | `#b0b8c6 (sRGB #aeb8c7)` disc | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 3300,189; 10-15-Catalina-Dark-Notification-Center-Notifications.png @ 3300,189 |
| Footer text | `#f2f3f5` ("2 New") | `#e5e6e7` ("Edit") | [M] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2962,2046,105,19; 10-15-Catalina-Dark-Notification-Center-Today.png @ 2995,2045,43,20 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Segment label font | 13 pt Regular ("Notifications" cap+ascender 20 px, rows 82..101) | same | [C] | 10-15-Catalina-Light-Notification-Center-Today.png @ 3088,82,151,20 |
| Day heading font | SF Pro Display Light about 22 pt (cap + ascender 32 px: rows 170..201) | same | [C] | 10-15-Catalina-Dark-Notification-Center-Notifications.png @ 2735,170,165,32 |
| Footer button font | 13 pt Regular (19-20 px) | same | [C] | 10-15-Catalina-Dark-Notification-Center-Today.png @ 2995,2045,43,20 |

### Shadows and effects
No measurable shadow on the desktop to the left of the panel in light mode (pixels at x=2660..2671 match the wallpaper trend) [M] 10-15-Catalina-Light-Notification-Center-Today.png @ 2655,1500,17,1.

## Layout and spacing
The content area scrolls between the header and footer dividers. Cards (`today-widget`, `notification-banner`) are 322 pt wide with 11 pt margins and 6 pt gaps. In the Today view the first card is the Night Shift / Do Not Disturb switch card, then the date block, the Siri-style summary, then widgets.

## Keyboard and accessibility
No default shortcut (assignable in Keyboard preferences); VoiceOver: VO-O opens Notification Center [D]. ARIA: `complementary` region labelled "Notification Center" with a `tablist` (Today, Notifications) and `tabpanel`s.

## Browser notes
`backdrop-filter` works; slide-in is a `transform: translateX()` transition (about 0.25 s ease-out [I]).

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Notification-Center-Today.png | 2660,44,700,2056 | Today view |
| dark | 10-15-Catalina-Dark-Notification-Center-Today.png | 2660,44,700,2056 | Today view, dark |
| light | 10-15-Catalina-Light-Notification-Center-Notifications.png | 2660,44,700,400 | header, day heading, clear button, one notification |
| dark | 10-15-Catalina-Dark-Notification-Center-Notifications.png | 2660,44,700,400 | same, dark |

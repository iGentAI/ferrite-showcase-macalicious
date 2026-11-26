# Notification in the Notification Center list (`notification-banner`)

- **Status:** present (delivered notification card in the Notifications view; the on-screen banner/alert that slides in at the top right is the dialogs group's `notification-alert`)
- **AppKit:** `UNNotification` / `NSUserNotification` as listed by Notification Center
- **HIG:** https://web.archive.org/web/20200503160812/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/notifications/
- **Appearances shown:** light, dark

## Purpose and behaviour
Notifications that were delivered and not dismissed are kept in the Notifications view, grouped under day headings ("Today", "Yesterday", older dates), newest first. Each card shows the app, the delivery time, a title and body; clicking opens the item in its app; the heading's clear button removes the whole day group, and hovering a card shows its own clear button [D].

## Anatomy
```
 Today                                   (x)     day heading + clear button (panel level)
+------------------------------------ 322 pt --+
| [i] MUSIC                               now  |  26 pt header band
|   Every Breaking Wave                        |  title, bold
|   U2 - Songs of Innocence                    |  body, secondary
+----------------------------------------------+
```

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| time label | "now", "Nm ago", weekday/"Yesterday, 3:51 PM" | relative | delivery date | "now" (light), "Yesterday, 3:51 PM" (dark) |
| content | title, optional subtitle, body (up to about 4 lines), optional thumbnail at the right | title + body | `UNNotificationContent` | title + one-line body |
| grouping | several notifications of one app stack under one header | - | thread identifier | single |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2694,228,644,154; 10-15-Catalina-Dark-Notification-Center-Notifications.png @ 2694,228,644,154 |
| hovered (per-card clear x at the header's left, replacing the icon) | no | [I] 14 pt clear disc as the heading's |
| pressed | no | [I] card fill darkens by `rgba(0,0,0,0.1)` |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Card width | 322 (px 2694..3337) | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2688,300,12,1; 3330,300,14,1 |
| Card height (title + 1 body line) | 77 (px y=228..381) | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 3000,150,1,250 |
| Corner radius | 4 | [M] | 10-15-Catalina-Dark-Notification-Center-Notifications.png @ 2692,228,12,10 |
| Header band | 26 (px y=229..279 light; 229..287 where the dark fill shifts) | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 3000,229,1,60 |
| App icon | 14 pt (px 2712..2739), 9 pt from the card's left edge, centred in the header band (y about 254) | [M] | 10-15-Catalina-Dark-Notification-Center-Notifications.png @ 2700,254,52,1 |
| App name | from px 2758 (32 pt from the card edge); cap rows 245..262 | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2758,245,76,18 |
| Time label | right-aligned, ink ending px 3306 (15.5 pt from the card's right edge) | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 3267,252,40,12; 10-15-Catalina-Dark-Notification-Center-Notifications.png @ 3109,247,196,21 |
| Title | from px 2730 (18 pt from the card edge); cap top y=301 (36.5 pt below the card top) | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2730,301,243,24 |
| Body | same inset; first line top y=332: 15.5-16 pt line pitch | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2730,332,290,23 |
| Bottom padding | 13.5 (body ink ends y=354, card ends 381) | [M] | same |
| Day heading to card | heading cap top y=170, card top y=228 (29 pt) | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2735,170,112,40 |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Card body fill, observed | `#e1f6ff (sRGB #dcf7ff)` on panel `#beddf5 (sRGB #b7def8)` | `#162640 (sRGB #122642)` (dithered `#17263f (sRGB #132641)`..`#182842 (sRGB #142844)`) on panel `#1a2c48 (sRGB #152c4a)` | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 3000,290; 10-15-Catalina-Dark-Notification-Center-Notifications.png @ 3000,300 |
| Header band fill | `#d8edf7 (sRGB #d3eef8)` | `#142138 (sRGB #11213a)` | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 3000,240; 10-15-Catalina-Dark-Notification-Center-Notifications.png @ 3000,240 |
| Recipe | body `rgba(255,255,255,0.55)`, header band additionally `rgba(0,0,0,0.04)` | body `rgba(0,0,0,0.15)`, header band additionally `rgba(0,0,0,0.12)` | [C] | from the composites above |
| Card edge | 1 px `#c1d6e0 (sRGB #bcd7e1)` (top), `#cadfe8 (sRGB #c5e0e9)` (side) | `#0e1828 (sRGB #0c1829)`, `#131e31 (sRGB #101e33)` | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 3000,228; 2694,300; dark same |
| App name | `#596e78 (sRGB #546f79)` | `#92a0b7 (sRGB #8fa0b9)` | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2758,245,76,18; dark same |
| Time label | `#606d73 (sRGB #5d6d74)` | `#a9acaf (sRGB #a8acaf)` | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 3267,252,40,12; 10-15-Catalina-Dark-Notification-Center-Notifications.png @ 3109,247,196,21 |
| Title | `#2d434c (sRGB #27444d)` | `#ffffff` | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2730,301,243,24; dark same |
| Body | `#627780 (sRGB #5d7881)` | `#97a7c2 (sRGB #94a7c5)` | [M] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2730,332,290,23; dark same |
| Odd lines at y=337..338 and 348..349 (x=3000) | `#627780 (sRGB #5d7881)` | `#93a4be (sRGB #8fa4c1)` | [M] | these are strokes of the body text (which ends at px 3019) crossing x=3000, not separators: 10-15-Catalina-Light-Notification-Center-Notifications.png @ 3000,336,1,15 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| App name | 13 pt Regular, upper case (cap 18 px) | same | [C] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2758,245,76,18 |
| Time label | 11 pt Regular (x-height 12 px "now"; 21 px with descenders in dark) | same | [C] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 3267,252,40,12 |
| Title | 13 pt Bold (cap 18-19 px, 24 with descender) | same | [C] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2730,301,243,24 |
| Body | 13 pt Regular | same | [C] | 10-15-Catalina-Light-Notification-Center-Notifications.png @ 2730,332,290,23 |

### Shadows and effects
None.

## Layout and spacing
Cards stack with 6 pt gaps under their day heading (as widgets); the heading row is 29 pt above the first card. Strings: app name upper-cased by the system.

## Keyboard and accessibility
VoiceOver reads "app, title, body, time". ARIA: list of `article` or `listitem`s under a heading per day; clear buttons are `button`s labelled "Clear".

## Browser notes
As `today-widget`: a translucent overlay on the panel material.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Notification-Center-Notifications.png | 2694,228,644,154 | Music notification, "now" |
| dark | 10-15-Catalina-Dark-Notification-Center-Notifications.png | 2694,228,644,154 | same notification a day later |

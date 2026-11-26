# Notification, alert style (`notification-alert`)

- **Status:** present (alert style with one action button; banner style appears in Notification Center screenshots owned by group system as `notification-banner`)
- **AppKit:** `NSUserNotification` (deprecated in 10.14 but still used by system agents) / `UNUserNotificationCenter`, `UNNotificationRequest`; presentation style "Alerts" chosen per app in System Preferences > Notifications
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/notifications/
- **Appearances shown:** light, dark

## Purpose and behaviour

A notification appears at the top right of the screen, under the menu bar. *Banners* leave after a few
seconds; *alerts* stay until the user acts and show buttons in a column on the right (one or two: an
action and/or Close). Every notification carries the app's icon, a title, and a message; clicking the
body opens the app. The HIG asks for a short, title-style title, a complete-sentence message, and
action buttons only when they save real work (HIG Notifications) [D]. The captured one is Finder's
"Disk Not Ejected Properly" alert with a single "Close" button.

## Anatomy

```
+----------------------------------------------+-----------+
| [app   Disk Not Ejected Properly             |           |
|  icon] Eject "USB Key" before disconnecting  |   Close   |   one button = full height; two buttons split it
|        or turning it off.                    |           |
+----------------------------------------------+-----------+
   344 x 63 pt, corner radius 6 pt, vibrant material, soft shadow
```

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| style | banner (no button column, auto-dismiss), alert (button column, persistent) | banner | per-app user setting | alert |
| buttons | 0, 1, 2 (stacked, separated by a 1 pt line) | - | `hasActionButton`, `otherButtonTitle` / `UNNotificationAction` | 1 |
| subtitle, attachment thumbnail | optional | none | `subtitle`, `contentImage` | not shown |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| Resting | yes | 10-15-Catalina-Light-Finder-Eject-Warning.png, 10-15-Catalina-Dark-Finder-Eject-Warning.png |
| Hover (reveals "Options" pull-down on two-button alerts), button pressed | no | [I] pressed button darkens its half by black 0.1 |
| Two buttons | no | [D/I] the column splits into two equal rows with a 1 pt horizontal line |

## Measurements

Frame: x 38..725, y 36..161 px = **344 x 63 pt** in both appearances [M]. The capture is a window
capture, so the material is recorded opaque over nothing; on screen it is vibrant.

### Geometry (pt)

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Size | 344 x 63 pt (two lines of body text) | [M] | `info` |
| Corner radius | 6 pt (12 px: on row 36 the edge becomes straight at x 50; on column 38 at row 48) | [M] | grid 10-15-Catalina-Light-Finder-Eject-Warning.png @ 36,34,14,12 |
| Button column | 70 pt wide (x 586..725) | [M] | row 100 |
| Vertical divider | 1 pt (x 584..585), full height | [M] | 10-15-Catalina-Light-Finder-Eject-Warning.png @ 584,38,2,122 |
| Body area | 273 pt (x 38..583) | [M] | same |
| App icon | 32 pt canvas, 10 pt from the left edge, vertically centred (canvas x 58..121, y 67..130); artwork 27 x 25.5 pt at x 63..116, y 73..123 | [M] art, [C] canvas | @ 63,73,54,51 |
| Text left edge | 52 pt from the left (x 142): icon + 10 pt | [M] | title glyphs from x 142 |
| Title baseline | 18.5 pt below the top (y 73) | [M] | "D" y 57..73 |
| Body baselines | 35.5 and 49.5 pt below the top (y 107, 135): 17 pt after the title, 14 pt line pitch | [M] | "E" y 91..107; second line box y 119..140 |
| Bottom padding under the last baseline | 13 pt | [M] | 135 -> 161 |
| Button title | centred in the column, baseline 35.5 pt below the top (y 107) for a single button | [M] | "C" of "Close" y 90..107 |

### Colours and fills

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Background (as captured) | `#ededed` | `#383838` | [M] | 10-15-Catalina-Light-Finder-Eject-Warning.png @ 300,50 `#ededed`; 10-15-Catalina-Dark-Finder-Eject-Warning.png @ 300,50 `#383838` |
| Divider | `#d6d6d6` | `#5b5b5b` | [M] | 10-15-Catalina-Light-Finder-Eject-Warning.png @ 584,100 `#d6d6d6`; 10-15-Catalina-Dark-Finder-Eject-Warning.png @ 584,100 `#5b5b5b` |
| Inner rim | none | 1 pt (2 px) lighter rim `#575757`/`#565656` on all four sides | [M] | 10-15-Catalina-Dark-Finder-Eject-Warning.png @ 38,100 `#575757`, @ 300,36 `#565656` |
| Outer edge | shadow only | 1 px near-black line (alpha 0.78) outside the rim | [M] | 10-15-Catalina-Dark-Finder-Eject-Warning.png alpha at 37,100 = 0.784 |
| Material recipe on screen | `backdrop-filter: blur(30px) saturate(1.8)` + `rgba(246,246,246,0.72)` | `blur(30px)` + `rgba(40,40,40,0.72)` | [I] | not measurable from an isolated capture; same family as Notification Center (`material`) |

### Text and icons

| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Title | SF Pro Text Bold 13 pt (cap 17..18 px, stem 3 px), `#3a3a3a`, single line, truncates | `#ffffff` | [M], [C] | @ 142,57,15,17 (light), @ 142,56,15,18 (dark) |
| Body | SF Pro Text Regular 12 pt (cap 17 px, x-height 12 px), `#3a3a3a`, up to about 4 lines, 14 pt pitch | `#ffffff` | [M], [C] | @ 142,91,15,17 |
| Button title | SF Pro Text Regular 13 pt (cap 18 px), `#6e6e6e` | `#b4b4b4` | [M], [C] | @ 624,90,15,18 in both files |
| Icon | the posting app's icon (Finder), full colour | same | [M] | @ 63,73,54,51 |

### Shadows and effects

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Shadow alpha, light, below the bottom edge | 0.255 at 1 px, 0.169 at 2 px, 0.129 at 3 px, 0.106 at 5 px, 0.075 at 9 px, 0.043 at 14 px, 0.02 at 20 px, 0 at about 33 px | [M] | 10-15-Catalina-Light-Finder-Eject-Warning.png alpha column x 300, y 162..195 |
| Shadow alpha at the sides and top (1 px out) | 0.243 (sides), 0.224 (top) | [M] | row 100 x 37 and 726; col 300 y 35 |
| Capture shadow margins | 38 px left/right, 36 px top, 40 px bottom | [M] | `info` |
| Fitted CSS | `box-shadow: 0 0 0 0.5px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.14)` | [C] | fit to the falloff |

## Layout and spacing

On screen the notification sits 8 pt below the menu bar and 8 pt from the right screen edge [D/I: not
visible in the isolated capture]; further notifications stack below with 8 pt gaps. Height grows with
body lines (14 pt each).

## Keyboard and accessibility

No default keyboard focus; VoiceOver announces the title and body and exposes the buttons as actions
(AXNotificationCenterAlert) [D]. ARIA: `role="alert"` for the alert style (`role="status"` for
banners), buttons as real `button` elements.

## Browser notes

The vibrant material needs `backdrop-filter`; fallback to the measured opaque values. Slide-in from
the right edge (about 0.3 s) is [I].

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Finder-Eject-Warning.png | 38,36,688,126 | alert-style notification with Close |
| dark | 10-15-Catalina-Dark-Finder-Eject-Warning.png | 38,36,688,126 | same, dark, with light rim |

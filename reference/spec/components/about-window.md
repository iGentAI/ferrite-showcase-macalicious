# About window (`about-window`)

- **Status:** present (About This Mac, light and dark); the standard app About panel is not shown
- **AppKit:** About This Mac is System Information's window: `NSWindow` with a segmented control (`NSSegmentedControl`, `segmentStyle = .texturedRounded`, `trackingMode = .selectOne`) placed in the title bar; the per-app panel is `NSApplication.orderFrontStandardAboutPanel(options:)`
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/window-anatomy/ (About windows are described under the app menu: https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/menus/menu-bar-menus/)
- **Appearances shown:** light, dark

## Purpose and behaviour

"About This Mac" (Apple menu) summarises the computer: Overview, Displays, Storage, Support, Service
tabs. An app's own About window (App menu > About AppName) shows the icon, name, version and copyright;
the HIG says it is modeless, has no minimize/zoom, and needs only a close button [D].

## Anatomy

```
+ (o)(o)(o)     [Overview|Displays|Storage|Support|Service]            +  title bar 38 pt with centred tabs
+======================================================================+
|                         macOS Catalina                               |  26 pt display title (bold + light)
|      ( 153 pt  )        Version 10.15 Beta (19A582a)                 |
|      (  badge  )                                                     |
|      (  image  )        MacBook Pro (15-inch, 2019)                  |  11 pt rows, bold key + regular value
|                         Processor  2.3 GHz 8-Core Intel Core i9      |
|                         ...                                          |
|                         [System Report...] [Software Update...]      |  small push buttons
|          (TM) and (C) 1983-2019 Apple Inc. All Rights Reserved. ...   |  footer, 9 pt grey, centred
+----------------------------------------------------------------------+
```

## Variants and parameters

| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| tab | Overview, Displays, Storage, Support, Service | Overview | segmented control | Overview |
| kind | About This Mac; standard app About panel (icon above centred name, version, credits, copyright; about 284 pt wide) | - | `orderFrontStandardAboutPanel` | About This Mac only |

## States

| State | Shown? | Evidence or basis |
|---|---|---|
| Key window, Overview selected | yes | 10-15-Catalina-Light-About-This-Mac.png, 10-15-Catalina-Dark-About-This-Mac.png |
| Window controls | yes | close and minimize enabled, zoom disabled (grey): 10-15-Catalina-Light-About-This-Mac.png @ 1120,412,104,24 |
| Other tabs, inactive window | no | [I] |

## Measurements

Both captures are full-screen (3360 x 2100). Window frame, light: x 1094..2265, y 386..1091 px =
**586 x 353 pt**; dark: x 1096..2263 between its black edge lines [M].

### Geometry (pt)

| Property | Value | Tag | Evidence |
|---|---|---|---|
| Title bar | 38 pt (y 386..461 incl. two bottom line rows) | [M] | 10-15-Catalina-Light-About-This-Mac.png col 1300 |
| Window controls | 12 pt, centred vertically in the 38 pt bar (y 412..435), first at x 1120 (13 pt in), 20 pt pitch | [M] | row 424: 1121..1142, 1161..1182, 1201..1222 |
| Tab control | 19 pt tall (y 405..442), horizontally centred, x 1362..1997 (318 pt); segments about 69 / 62 / 62 / 62 / 60.5 pt (dividers at x 1500..1501, 1627, 1751..1752, 1877) | [M] | row 424, col 1420 |
| Badge image | 153 pt circle at x 1196..1501, y 604..909 (51 pt from the left edge, 71 pt below the title bar) | [M] | @ 1196,604,306,306 |
| Text column | starts x 1603 (254.5 pt from the left edge) | [M] | all text boxes start at 1601..1604 |
| "macOS Catalina" baseline | 51 pt below the title bar (y 589..590) | [M] | "O" y 554..590 |
| Version line baseline | 16 pt below the title baseline (y 621) | [M] | @ 1603,606,24,16 |
| Spec rows | first cap top y 670, pitch 19 pt (670, 708, 746, 784, 822, 860); value starts 9 pt after the key | [M] | lay boxes |
| Buttons | small push buttons 17 pt tall (y 925..959 incl. shadow), widths 102 and 113 pt (x 1601..1804, 1827..2052), 11 pt apart, 32 pt below the last row | [M] | @ 1601,925,452,35 |
| Footer | centred on the window, baseline 12 pt above the bottom edge (y ~1077) | [M] | @ 1326,1061,687,19 |

### Colours and fills

| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Content background | `#ececec` | `#303032` | [M] | 10-15-Catalina-Light-About-This-Mac.png @ 1300,470 `#ececec`; 10-15-Catalina-Dark-About-This-Mac.png @ 1300,470 `#303032` |
| Title bar gradient | `#e5e5e5` (y 388) -> `#cdcdcd` (y 459) | `#434445` -> `#363738` | [M] | col 1300 of each file |
| Title bar bottom lines | `#bebebe`, `#a7a7a7` | `#2b2c2c`, `#000000` | [M] | 10-15-Catalina-Light-About-This-Mac.png @ 1300,460 `#bebebe`, @ 1300,461 `#a7a7a7`; 10-15-Catalina-Dark-About-This-Mac.png @ 1300,460 `#2b2c2c`, @ 1300,461 `#000000` |
| Selected tab segment | dark grey `#6e6e6e` (top) -> `#686868`, white text | light grey `#c9c9cb` -> `#c5c6c7`, dark text | [M] | 10-15-Catalina-Light-About-This-Mac.png @ 1420,412 `#6e6e6e`, @ 1420,436 `#686868`; 10-15-Catalina-Dark-About-This-Mac.png @ 1420,412 `#c9c9cb`, @ 1420,436 `#c5c6c7` |
| Unselected tab segment | `#f6f6f6` | `#696a6b` | [M] | row 424 runs 1501..1521 of each file |

### Text and icons

| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| "macOS" | SF Pro Display 26 pt [C: cap 36 px, x-height 27 px], semibold/bold (stem 6 px), `#242424` | white class | [M], [C] | 10-15-Catalina-Light-About-This-Mac.png @ 1604,554,130,37 |
| "Catalina" | SF Pro Display 26 pt, light/regular weight, same colour | same | [M], [C] | @ 1746,553,200,38 |
| Version line | SF Pro Text 11 pt (cap 16 px): "Version" medium/bold, rest regular, `#000000` | white | [M], [C] | @ 1603,606,306,21 |
| Spec rows | 11 pt; key bold (stem 3 px), value regular, `#242424` | light text | [M], [C] | @ 1603,708,422,18 |
| Tab titles | 11 pt (cap 16 px), selected `#ffffff` (light) | selected dark text | [M], [C] | @ 1382,416,116,16 |
| Button titles | 11 pt, `#262626` | - | [M] | @ 1610,934,190,20 |
| Footer | 9 pt, `#b1b1b1`, centred, last two words a link in the same colour | grey | [M] | @ 1326,1061,687,19 |
| Badge | circular macOS Catalina artwork with a light rim; the image differs per appearance (day island / night island) | - | [M] | @ 1196,604,306,306 in both files |

### Shadows and effects

Standard key-window shadow over the desktop.

## Layout and spacing

Fixed-size window. Tabs are centred in the title bar; content is a two-column composition (image left,
text right) that does not reflow.

## Keyboard and accessibility

Command-W closes; Control-Tab cycles tabs when the control has focus [D]. AX: AXTabGroup with
AXRadioButtons. ARIA: `tablist` in the window header.

## Browser notes

The badge artwork and the product title weights need the real assets/fonts (SF Pro Display); with the
system-ui fallback the weights differ visibly at 26 pt.

## Evidence

| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-About-This-Mac.png | 1094,386,1172,706 | whole window over the desktop |
| dark | 10-15-Catalina-Dark-About-This-Mac.png | 1094,386,1172,706 | same, dark |

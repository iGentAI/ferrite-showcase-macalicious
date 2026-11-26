# Account header (`account-header`)

- **Status:** present
- **AppKit:** custom grouping view with an avatar image view, labels and borderless image buttons [I: public implementation equivalents; private classes unknown].
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/app-architecture/preferences/ ; https://web.archive.org/web/20200503180052/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/image-buttons/
- **Appearances shown:** light, dark [M].

## Purpose and behaviour
Identifies the signed-in account and provides Apple ID / Family Sharing navigation [M: visible labels and shell]. Those destinations are ordinary image-button actions [I]; changes within preferences apply immediately [D: HIG Preferences]. This is an app-specific header pattern, not a standalone AppKit control [I].

## Anatomy
Full-width band; avatar at leading edge; two stacked text labels; two image-above-label navigation buttons at trailing edge; bottom separator [M].

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| account | image, displayName, subtitle | supplied content [I] | image/stringValue [D] | Stephen Hackett; Apple ID, iCloud [M] |
| destinations | Apple ID, Family Sharing | both [M] | NSButton [I] | both [M] |
| sign-in state | signed-in, signed-out | unknown [I] | app data [I] | signed-in only [M] |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| signed-in, key window | both | main shell PNGs [M] |
| signed-out | no | alternate content/layout cannot be measured; do not reuse account name as a sign-in action [I] |
| destination pressed/focused/disabled | no | image-button state recipes apply [I] |
| inactive window | yes, in Mission Control | [M] full-colour avatar remains, title ink `#242424` on `#ececec`; darkest title ink in 10-15-Catalina-Light-Mission-Control.png @ 2210,950,305,42; avatar 10-15-Catalina-Light-Mission-Control.png @ 2064,930,130,132 |

## Measurements
Geometry is header-local pt: origin image(112,152), not frame(112,76) [C].

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Band size | 668 ×111 | [M] | both shell PNGs @112,152,1336,222 |
| Avatar | (25,23,64,64), circular | [M] | both @162,198,128,128; middle row/column128 px |
| Name ink origin | (99.5,32..32.5) | [M] | light @311,217,269,34; dark @311,216,269,35 |
| Subtitle ink origin | (99,54.5) | [M] | both @310,261,166,21 |
| Avatar-to-name horizontal gap | 10.5 | [C] | avatar ends289; name starts311; blank290..310 =21px |
| Name/subtitle cap baseline pitch | 17 | [M] | name flat caps end243, subtitle caps end277 in light; dark±0.5 |
| Apple ID image | (520,19.5,37,37) | [M] | both @1152,191,74,74 |
| Family Sharing image | (602,19.5,37,37) | [M] | both @1316,191,74,74 |
| Destination centre pitch | 82 | [C] | image starts1152,1316 |
| Destination first caption cap top | 66 in light,65.5 dark (Apple ID); Family65.5/65 | [M] | light Apple ID @1141,284,94,23; dark @1141,283,95,24; Family starts283/282 |
| Two-line caption pitch | 14 | [M] | Family y283/311 light;282/310 dark |
| Bottom separator | 1 pt | [M] | both @130,374,1,2 |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Band | #ececec | #2f3031 | [M] | 10-15-Catalina-Light-System-Preferences-0.png @ 130,152; 10-15-Catalina-Dark-System-Preferences-0.png @ 130,152 |
| Primary labels | #242424 | #dfdfdf | [M] | both shell stem palettes @311,216,280,40 and @310,261,166,21 |
| Destination captions | #767676 | #a1a2a2 | [M] | both @1141,282,100,35 stem palettes |
| Separator | #d5d5d5 | #434445 | [M] | 10-15-Catalina-Light-System-Preferences-0.png @ 130,374; 10-15-Catalina-Dark-System-Preferences-0.png @ 130,374 |

### Text and icons
Name SF Pro Text Regular19 pt [C: cap26..27 image px /1.41px per pt =18.4..19.1; nearest19, uncertainty±0.5]. Subtitle11 pt [C: capital16 px]. Button captions12 pt [C: capitals17..18 px]. Avatar is a tennis ball; Apple ID a grey rounded Apple logo tile, Family Sharing a family pictogram on a white tile [M]. Each destination is centred over its caption [M]. Exact content strings: “Stephen Hackett”, “Apple ID, iCloud”, “Apple ID”, “Family” / “Sharing” [M].

### Shadows and effects
No view shadow separate from the artwork [M]; separator is the only band edge.

## Layout and spacing
Keep avatar/name leading; keep destination centres aligned with shell grid's last two columns (frame x538.5 and620.5 pt for image midpoints) [C]. The name/subtitle pair is not vertically centred as one block on the avatar: measured baselines are about17 pt apart [M]. Allow content replacement without changing avatar diameter [I: demo data parameter]. Signed-out layout and long-name truncation are not captured [I].

## Keyboard and accessibility
Header grouping has no action of its own. Two separately named native buttons; Space activates a focused destination [D: HIG Keyboard]. Avatar is decorative when account text identifies it; group accessible name from displayName, subtitle remains readable text [I: web mapping].

## Browser notes
Needs avatar and destination artwork assets; it cannot connect a browser to system Apple ID or Family Sharing settings [I]. Closest approach: demo-local destination navigation.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-0.png | 112,152,1336,224 | entire header and separator |
| dark | 10-15-Catalina-Dark-System-Preferences-0.png | 112,152,1336,224 | same content, dark labels and band |

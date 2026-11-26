# News story card (`story-card`)

- **Status:** present
- **AppKit:** UIKit for Mac (Mac Catalyst): a custom `UICollectionViewCell` of News.app's Today feed; no public class and no system-drawn style.
- **HIG:** none specific. Related: Mac Catalyst scaling https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/ios/overview/mac-catalyst/ ; image views https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/image-views/
- **Appearances shown:** light, dark
- **Provenance:** split out of `card-grid` on 2026-10-07, when the story card was built as a component of its own (`src/components/story-card/`). `card-grid.md` and `apps/news.md` record the lead picture and the type sizes; the positions inside a card, the corners and the play badge were measured for this file.

## Purpose and behaviour
A story in the Today feed of News: a picture, the publisher's logo, the headline and the story's age. Clicking a card opens the story [I]. The Top Stories group shows two lead stories side by side and a row of three smaller stories under them; one lead story in the Aqua capture is a video and carries a play badge [M].

## Anatomy
```
lead                                   secondary
+----------------------------+         LOGO              +--------+
|                            |         Headline on up    |        |
|       picture 4 : 3    (>) |         to three lines... | 88 pt  |
|                            |                           |        |
+----------------------------+         1h ago            +--------+
LOGO
Headline on up to three lines

1h ago
```

## Variants and parameters
| Parameter | Values | Default | Shown in screenshots |
|---|---|---|---|
| layout | lead (picture above the text), secondary (thumbnail beside the text) | lead | both |
| video | play badge over the picture | off | lead only, Aqua capture |
| headline lines | 1 to 3; a longer headline ends in an ellipsis | - | 2 and 3 lines |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes | `10-15-Catalina-Light-News.png @ 744,502,798,880`; `10-15-Catalina-Dark-News.png @ 785,502,798,880` |
| hover | no | [I] no change |
| pressed | no | [I] dimmed by a tenth, as the store cards |
| focused (full keyboard access) | no | [I] standard focus ring around the card, see `focus-ring` |
| disabled | no | [I] half opacity |
| inactive window | no | [I] unchanged |

## Measurements
Evidence shorthand: `News` before `@`, `row y=` or `col x=` means `10-15-Catalina-Light-News.png`, `Dark` the dark file. The Dark Aqua window is 35 pt wider and its feed starts 20.5 pt further right: the first lead story starts at x=744 in the Aqua file and x=785 in the Dark Aqua one.

### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Lead picture | 399 x 300 (4 : 3) | [M] | News `@ 744,502,798,600`: x=744..1541, y=502..1101 |
| Picture corners | radius about 3 (an iOS 4 pt corner at 77%) | [C] | News thumbnail `@ 1084,1415,6,6`: the edge is 3.4, 1.8, 0.85 and 0.55 px in on the first four rows; lead picture rows y=503..507 the same within half a pixel |
| Lead column pitch | 421 (22 between cards) | [M] | News second lead story starts x=1586; Dark 785 and 1627 |
| Publisher logo, lead | starts 13 below the picture, 16 tall (Aqua, first story), 14.5 tall (Dark Aqua, first story) | [M] | News rows y=1128..1159; Dark rows y=1128..1157 |
| Headline, lead | 22 pt Bold on a 24 pt pitch; first cap top 43 below the picture in Aqua, 41 in Dark Aqua, where the logo is shorter | [M]/[C] | News line rows 1186..1226, 1234..1274, cap top y=1188; Dark 1182..1223, 1231..1272, 1278..1312, cap top y=1184 |
| Age, lead | 9 pt Bold; cap top 124 below the picture in Aqua (122 in Dark Aqua), the same for a headline of two lines and of three | [M]/[C] | News rows y=1349..1366 under both lead stories; Dark y=1345..1361 |
| Secondary card | 258 wide: text 162, gap 8, thumbnail 88 x 88; column pitch 280.5 | [M] | News thumbnail x=1084..1259, y=1415..1591; next card's logo from x=1304; Dark thumbnail x=1125..1301 |
| Publisher logo, secondary | level with the thumbnail's top, about 10 tall | [M] | News rows y=1415..1435; Dark y=1410..1431 |
| Headline, secondary | 15.5 pt Bold on a 16 pt pitch, three lines then an ellipsis; first cap top 19.5 below the card's top | [M]/[C] | News line rows 1452..1479, 1484..1512, 1516..1539; Dark 1447..1475, 1479..1503, 1511..1535 |
| Age, secondary | cap top 82.5 below the card's top; its baseline 1.5 below the thumbnail's foot | [M] | News rows y=1580..1594; Dark y=1573..1589 |
| Play badge | 44 disc at the picture's middle; triangle 19 wide and 22 tall, from 7.5 before the middle to 11.5 after it | [M]/[C] | News disc col x=1985: y=758..846; triangle row y=805: x=1970..2008, col x=1985: y=790..816 |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Headline | `#242527` | `#dadcdd` | [M] | News `@ 750,1200`; Dark `@ 795,1196` |
| Age | `#767472` (brightest stems) | `#92989f` | [M] | News row y=1356: x=745..760; Dark row y=1352: x=786..810 |
| Page behind the cards | gradient, `#e9f4ff` at the lead text's top to `#dcecff` under the secondary row | `#0e1823` to `#021426` | [M] | News col x=1560: y=1102, 1381; col x=1290: y=1415, 1638; Dark col x=1605 and x=1332 |
| Play badge disc | `#202427` over a dark part of the photograph: black at about 60% | not shown | [C] | News row y=805: x=1942..1966 against the photograph beside the disc |
| Play badge triangle | `#ffffff` | not shown | [M] | News `@ 1985,800` |

## Layout and spacing
- Lead stories stand two in a row, 22 pt apart; the secondary row holds three cards on a 280.5 pt pitch.
- The headline has room for three lines whatever its length, so the ages of a row share a line.
- The publisher's line is as tall as the logo, and the text under it moves with it [C]: the two captures differ by the 2 pt between their first logos.

## Keyboard and accessibility
Cells of a collection view: `AXButton`-like cells named by publisher and headline [I]. ARIA: a link or a `button` named by its text; the headline may be a heading; the play badge is decorative and the story's kind belongs in its name.

## Browser notes
- The cards' edges lie on fractions of a pixel in the captures (Catalyst's 77% scaling), so a comparison of an edge is good to half a pixel.
- The headline face is the system's bold; News uses its own condensed face for the page's titles, not for the cards.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-News.png` | 744,502,798,880 | first lead story: picture, logo, headline, age |
| dark | `10-15-Catalina-Dark-News.png` | 785,502,798,880 | first lead story, dark, headline of three lines |
| light | `10-15-Catalina-Light-News.png` | 744,1415,518,184 | first secondary story |
| dark | `10-15-Catalina-Dark-News.png` | 785,1410,518,184 | first secondary story, dark |
| light | `10-15-Catalina-Light-News.png` | 1940,758,90,90 | play badge on the second lead story |

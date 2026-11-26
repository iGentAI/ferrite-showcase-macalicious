# Capsule segmented control (`capsule-segmented-control`)

- **Status:** present (added by the inventory gap closure, 7 October 2026: the review had recorded it as an app-specific variant inside `segmented-control`, and the Contacts demo could not draw it with the library)
- **AppKit:** none of the `NSSegmentedControl` styles: drawn by Contacts itself
- **HIG:** https://web.archive.org/web/20200503185450/https://developer.apple.com/design/human-interface-guidelines/macos/selectors/segmented-controls/
- **Appearances shown:** light

## Purpose and behaviour
Switches the card being edited in Contacts between its information and its picture ("Info", "Picture"). One segment is always selected, like radio buttons. [I] (the behaviour of a select-one segmented control; no capture shows it being used)

## Anatomy
One hairline outline with capsule ends around two or more text segments of equal width. No bezel, no shadow, no dividers between segments. The selected segment is filled; the others show what is behind the control.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| selection | one segment | first | `trackingMode = .selectOne` | "Info" selected |
| size | one | 20 pt high | none | one size |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, one segment selected | yes, light | `10-15-Catalina-Light-Contacts.png @ 1160,236,450,60` |
| dark | not shown | [I] the dark Contacts capture shows a card that is not being edited; outline white at 15%, selected fill white at 8%, selected title white |
| pressed | not shown | [I] twice the selected tint |
| disabled | not shown | [I] titles in the disabled control text colour |
| window not key | not shown | [I] as in the key window: the control has no accent colour to lose |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Height | 20 | [M] | `10-15-Catalina-Light-Contacts.png`: outline rows y=246 and y=285 at x=1250 |
| Width in Contacts | 215 | [M] | outline columns x=1170 and x=1599 at y=265 |
| Outline width | 0.5 (one device pixel) | [M] | row y=246 is `#e5e5e5`, rows y=245 and y=247 are not |
| Ends | capsule: radius 10, half the height | [M] | the outline's first pixel is at x=1184 on row y=246, x=1177 on y=250, x=1172 on y=255 and x=1170 at mid-height |
| Selected segment | half the control: x 1171..1385 | [M] | row y=265: `#f5f5f5` up to x=1385, `#ffffff` from x=1386 |
| Divider between segments | none | [M] | row y=265: the fill meets white with no other colour between |
| Title baseline | 14 below the control's top | [M] | ink rows y 254..273 in both titles (neither has a descender) |
| Padding beside a title | 10 | [I] | the control has a fixed width; the value is the bezelled segmented control's |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Outline | `#e5e5e5` over `#ffffff`: black at 10.2% | white at 15% | [M] light, [C] alpha, [I] dark | `10-15-Catalina-Light-Contacts.png @ 1250,246` |
| Selected segment | `#f5f5f5` over `#ffffff`: black at 4% | white at 8% | [M] light, [C] alpha, [I] dark | `@ 1250,265` |
| Other segment | none (the card's `#ffffff`) | none | [M] light, [I] dark | `@ 1450,247` |
| Selected title | `#000000` | `#ffffff` | [M] light, [I] dark | most frequent ink colour of "Info", x 1258..1300 |
| Other title | `#262626` (control text colour: black at 85% over white) | control text colour | [M] light, [I] dark | most frequent ink colour of "Picture", x 1450..1532 |

### Text and icons
Titles: 13 pt system font, regular weight, centred in their segment: ascenders of "Info" are 10 pt high (y 254..273) and its stems 1.5 pt wide, as 13 pt regular text elsewhere. [C] Both titles have the same weight; only the colour differs. [M]

### Shadows and effects
None.

## Layout and spacing
In Contacts the control is centred over the card's fields, 215 pt wide. [M]

## Keyboard and accessibility
As a select-one segmented control: one stop in the key-view loop, Left / Right move between segments, Space selects. Web: a group of `aria-pressed` buttons. [D] (from `segmented-control`)

## Browser notes
The outline is a `0.5px` border, which a 1x display draws one device pixel wide. Translucent black for the outline and the fill reproduces both over white and keeps the control usable over other backgrounds.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Contacts.png | 1160,236,450,60 | "Info" selected, "Picture" not |

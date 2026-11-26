# Token Field (`token-field`)

- **Status:** present (Mail address field; no token field appears in the System Preferences panes reviewed)
- **AppKit:** `NSTokenField` (`tokenStyle`: `.default`, `.rounded`, `.squared`, `.plainSquared`, `.none`; `tokenizingCharacterSet`, `completionDelay`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/fields-and-labels/token-fields/
- **Appearances shown:** light, dark

## Purpose and behaviour
A text field whose entries become tokens: blocks of text that can be selected, dragged and manipulated as units. Mail's address fields tokenise recipients as they are entered and suggest completions while typing. A token can carry a contextual menu, marked by a downward chevron. Text is tokenised when the user types a comma by default; other characters such as Return can be added; the suggestion delay is adjustable. [D] (HIG, Token Fields)

## Anatomy
1. Field: a `text-field` bezel, or borderless inside a header form (Mail).
2. Token: a rounded rectangle with a tinted fill containing the text and, when it has a menu, a chevron at its trailing end.
3. Plain text being typed, after the last token.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| tokenStyle | rounded, squared, plain squared, none | rounded | `tokenStyle` | rounded |
| menu chevron | yes, no | no | `NSTokenFieldDelegate` `tokenField(_:hasMenuForRepresentedObject:)` | yes |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| token, normal (tinted) | yes, light + dark | `10-15-Catalina-Light-Mail.png @ 601,418,236,38`; `10-15-Catalina-Dark-Mail.png @ 605,410,236,38` |
| token, selected | not shown | [I] solid accent fill (`#3a80f6 (sRGB #207efe)`-class selected-content colour) with white text |
| token, hover | not shown | [I] fill darkens slightly and the chevron appears if hidden |
| field focused | not shown | `focus-ring` on the bezel |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Token height | 19 | [M] | Light Mail col 640: fill y 418..455. Dark Mail col 644: y 410..447 |
| Token corner radius | 2. Confirmed by a least-squares fit with `tools/corner_fit.py`: best 2 (rms 0.2 levels; 1.7 at 1.75, 1.5 at 2.25) | [C] fit from [M] pixels | Light Mail grid `@ 600,418,6,6`: top edge full colour at x=605, left edge at y=422 (origin 601,418); fit corner `10-15-Catalina-Light-Mail.png @ 601,418,8,8` |
| Token border | none | [M] | Light Mail col 640: white directly to `#c0d7fc (sRGB #bbd7ff)` |
| Token width | text width + 20.5 (118 for "Stephen Hackett" with chevron) | [M] | Light Mail row 437: token x 601..836; text ink x 610..805 |
| Text inset in token | 4.5 left | [M] | Light Mail: token starts x=601, first ink x=610 |
| Text baseline | 14 below the token top | [M] | Light Mail `@ 606,420,200,34`: ink rows y 426..450 (descender to 450, baseline 445) for token top 418 |
| Chevron | 6 wide x 3.5 high, stroke 1.5, mitred point, round ends; starts 5.5 pt after the text, ends 4 pt before the token's right edge; vertically 8 pt below the token top | [M] | Light Mail grid `@ 806,430,26,14`: chevron ink x 816..828, y 434..440; token right edge x=836 |
| Chevron path (chevron-local pt) | `M 0.75 0.75 L 3.1 2.9 L 5.5 0.75` | [C] | from the grid above |
| Gap between tokens | 2 [I] | [I] | only one token is shown |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Token fill | `#c0d7fc (sRGB #bbd7ff)` | `#253d60 (sRGB #1e3d63)` | [M] | Mail `@ 610,425` (light), `@ 610,417` (dark) |
| Token fill as a tint | accent `#3a80f6 (sRGB #207efe)`-class blue @ about 0.3 over white | accent @ about 0.35 over `#1e1e20` | [C] | approximate; exact accent in `accent-colors` |
| Token text | `#1d2026 (sRGB #1c2027)` | `#dee1e7 (sRGB #dde1e8)` | [M] | Mail col 640 (light), col 644 (dark) |
| Field background behind the token | `#ffffff` | `#1e1e20` | [M] | Mail col 640 y 408..417; Dark col 644 y 400..409 |

### Text and icons
| Property | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Font | SF Pro Text 13 pt regular | same | [C] | ink rows 25 px high including ascender and descender (`@ 606,420,200,34`), matching 13 pt text elsewhere |

### Shadows and effects
None.

## Layout and spacing
Tokens flow inline like words and wrap to further lines; the field grows vertically in Mail's header. Token left edge sits about 4 pt after the preceding label ("To:"). [I]

## Keyboard and accessibility
Left / Right arrows move between tokens and text; Backspace selects then deletes the previous token; Space or Down Arrow on a selected token opens its menu. Role `AXTextField` whose children are tokens exposed as `AXMenuButton` / static text. ARIA: a `role="listbox"` of `role="option"` chips beside an `<input>`, or `role="grid"`. [D]

## Browser notes
Build tokens as inline-flex spans inside a contenteditable-free wrapper with a real `<input>` after them; native inputs cannot contain elements.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Mail.png | 596,414,244,46 | recipient token with chevron |
| dark | 10-15-Catalina-Dark-Mail.png | 600,406,244,46 | recipient token with chevron |

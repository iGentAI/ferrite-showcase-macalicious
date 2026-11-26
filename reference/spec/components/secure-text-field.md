# Secure Text Field (`secure-text-field`)

- **Status:** not seen in the screenshots as a standard control. The only password fields in the library are the translucent login-window fields (`10-15-Catalina-Light-Fast-User-Switching.png @ 1520,1022,320,56`, Dark same), which are specified in `login-window` (owner: system). No pane or dialog in the 294 screenshots shows a standard `NSSecureTextField`; the Users & Groups pane is captured locked, without its password sheet.
- **AppKit:** `NSSecureTextField` (subclass of `NSTextField`; `NSSecureTextFieldCell.echosBullets`)
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/fields-and-labels/text-fields/
- **Appearances shown:** none (standard style)

## Purpose and behaviour
Use a secure text field when asking for sensitive data such as a password; it obscures the entered text by replacing each character with a bullet. [D] (HIG, Text Fields). The text cannot be copied or cut; the field never shows its content in an expansion tooltip. With Caps Lock on, AppKit draws a Caps Lock indicator at the trailing edge. [D] (AppKit)

## Anatomy
Identical to `text-field`; content is a row of bullets.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| controlSize | regular, small, mini | regular | `controlSize` | no |
| echo | bullets, nothing | bullets | `echosBullets` | no |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| all standard states | not shown | inherit from `text-field` |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Bezel, height, border, text inset | as `text-field`: 20 high, 0.5 border, 4 text inset | [I] | same class and cell drawing; measured values in `text-field.md` |
| Bullet glyph | U+2022 at the field font size (13 pt): about 4.5 pt diameter disc, advance about 7 pt, vertically centred on the x-height | [I] | AppKit substitutes the font's bullet; not shown |
| Caps Lock indicator | 13 x 13 glyph (outlined up arrow in a rounded square), 4 pt from the trailing edge | [I] | not shown |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Bezel and fill | as `text-field` | as `text-field` | [I] | - |
| Bullets | `rgba(0,0,0,0.85)` | `rgba(255,255,255,0.85)` | [I] | text colour of `text-field` |

### Text and icons
No visible text other than bullets and the placeholder (`rgba(0,0,0,0.25)` / `rgba(255,255,255,0.25)` [D], `placeholderTextColor`).

### Shadows and effects
As `text-field`; focus via `focus-ring`.

## Layout and spacing
As `text-field`. In authentication dialogs the Name and Password fields are stacked with an 8 pt gap and right-aligned labels. [I]

## Keyboard and accessibility
Same keys as a text field, without copy / cut. Role `AXTextField` with subrole `AXSecureTextField`; the value is not exposed. ARIA: `<input type="password">`. [D]

## Browser notes
`<input type="password">` draws engine-specific bullets; for exact size set `-webkit-text-security: disc` with `font-size: 13px; letter-spacing: 1px`, or render discs yourself.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Fast-User-Switching.png | 1520,1022,320,56 | login-window style password field (different component: `login-window`) |
| dark | 10-15-Catalina-Dark-Fast-User-Switching.png | 1520,1022,320,56 | same, dark |

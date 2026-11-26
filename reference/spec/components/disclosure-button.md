# Disclosure Button (`disclosure-button`)

- **Status:** not seen in the screenshots
- **AppKit:** `NSButton`, `bezelStyle = .roundedDisclosure` (`NSRoundedDisclosureBezelStyle`), `setButtonType(.pushOnPushOff)`, no title
- **HIG:** https://web.archive.org/web/20200503161554/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/disclosure-controls/
- **Appearances shown:** none

## Purpose and behaviour
A disclosure button reveals and hides functionality associated with a specific control. It is small and square with rounded corners and shows a chevron: pointing down when the extra functionality is hidden, up when it is visible. Clicking it toggles between the two and the parent view grows or shrinks. The standard example is the button next to the Save As field of a Save dialog, which expands the dialog to show the file browser. Place it close to its control and use at most one per view. [D] (HIG, Disclosure Controls)

No Save dialog was captured in the library (the file dialogs shown are Open panels, which have no disclosure button), and no other screenshot contains one. The Print dialog's "Hide Details" control is a push button, not a disclosure button (`10-15-Catalina-Light-Print.png`, left edge x=380 on row y=981).

## Anatomy
A square `push-button` bezel with a single centred chevron (the glyph of `pull-down-button`, flipped when expanded). [I]

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| state | collapsed (chevron down), expanded (chevron up) | collapsed | `state` off / on | no |
| controlSize | regular, small, mini | regular | `controlSize` | no |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| collapsed, expanded, pressed, disabled | not shown | [I] see Measurements |

## Measurements
| Property | Value | Tag | Basis |
|---|---|---|---|
| Size, regular | 20 x 20 (AppKit frame 21 x 21 including the shadow row) | [I] | bezel height equals the measured `push-button` body height; the control is square |
| Corner radius | 4 | [I] | `push-button` bezel |
| Edge, fill, halo, shadow rows | as `push-button` (white / `rgba(255,255,255,.25)`) | [I] | same bezel family; in 10.15 the disclosure button is not accent-coloured in either state |
| Chevron | 7.5 x 4.5 pt, stroke 1.2, `rgba(0,0,0,.85)` / `rgba(255,255,255,.85)`; path (button-local pt) collapsed `M 7 8.5 L 10 11.5 L 13 8.5`, expanded `M 7 11.5 L 10 8.5 L 13 11.5` | [I] | shape and stroke are the measured single chevron of `pull-down-button` (`10-15-Catalina-Light-Print.png @ 338,977,15,9`), recentred in a 20 pt square |
| Pressed | fill `#f0f0f0` in light, `rgba(255,255,255,0.36)` in dark: the shared `--mac-bezel-fill-pressed`, as for `help-button`. It supersedes this row's earlier "fill darkens about 10%" (about `#e5e5e5` over white) since 3 October 2026; both are inferences, since no screenshot shows the control | [I] | non-accent bezel behaviour; `tokens.md`, `--mac-bezel-fill-pressed` |

## Layout and spacing
8 pt to the right of the text field it belongs to, vertically centred on it. [I] standard Save panel arrangement (also stated in `save-panel`).

## Keyboard and accessibility
Space toggles it when focused. Role `AXDisclosureTriangle`-like toggle button with value 0 / 1; AppKit reports `AXButton` with `AXValue`. Web: `<button aria-expanded="true|false" aria-controls>`. [D]

## Browser notes
None.

## Evidence
No instance in the library.

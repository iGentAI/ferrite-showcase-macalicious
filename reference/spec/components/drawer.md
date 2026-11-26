# Drawer (`drawer`)

- **Status:** not seen in the screenshots
- **AppKit:** `NSDrawer` (deprecated in macOS 10.13)
- **HIG:** https://web.archive.org/web/20200503121040/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/drawers/
- **Appearances shown:** none (no app in the 294 screenshots uses a drawer)

## Purpose and behaviour
A drawer holds options or information related to one window. It is hidden by default and slides out from one side of its parent window in response to a button or menu command; it cannot be moved or detached. "Avoid using drawers. Drawers are seldom used in modern apps and their use is discouraged. Panels, popovers, sidebars, and split views are preferred" [D].

## Anatomy
A child surface the height of the parent's content area (inset at top and bottom), attached to the left, right or bottom edge, drawn behind the parent's edge with its own shadow.

## Variants and parameters
| Parameter | Values | AppKit equivalent | Shown |
|---|---|---|---|
| edge | left, right, bottom | `preferredEdge` | no |
| state | closed, opening, open, closing | `state` | no |

## States
None shown.

## Measurements (all [I]; there is no Catalina reference to measure)
| Property | Value | Basis |
|---|---|---|
| Inset from the parent's top and bottom | title bar height + 8 at the top, 8 at the bottom | `NSDrawer.leadingOffset`/`trailingOffset` defaults |
| Width | content-defined, typically 200-260 | |
| Corner radius (outer corners) | 5 | window radius measured in `window` |
| Fill | `#ececec` light, `#2f3031` dark | window background measured in `window` |
| Border and shadow | hairline as `window`; inactive-class shadow `0 8px 24px rgba(0,0,0,0.26)` | `window-shadow` |
| Animation | slides out from under the window edge in about 0.25 s | |

### Geometry (pt)
The inset, width and radius in the preceding table are all [I]. No drawer is seen in the screenshots; do not promote these values to measured Catalina defaults.

### Colours and fills
The light/dark fills in the preceding table are [I] reuse of `window` colours, not sampled drawer material.

### Text and icons
Content-defined [D] (drawer content view); no drawer-specific label or glyph is measured.

### Shadows and effects
The preceding border/shadow and slide duration are [I]. The proposed inactive-window shadow is an approximation for a legacy drawer, not an executed fit to drawer pixels.

## Layout and spacing
The drawer overlaps under the parent by a few points so the seam is hidden.

## Keyboard and accessibility
`AXDrawer`. ARIA: a `complementary` region toggled by a button with `aria-expanded`.

## Browser notes
Implement only if a legacy demo needs it; otherwise map to `sidebar` or `popover` as the HIG advises.

## Evidence
None available.

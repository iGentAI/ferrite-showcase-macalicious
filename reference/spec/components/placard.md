# Placard (`placard`)

- **Status:** not seen in the screenshots
- **AppKit:** no class; historically a small control placed in the scroller area with `NSScrollView` subclassing
- **HIG:** https://web.archive.org/web/20200503140902/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/placards/
- **Appearances shown:** none. The closest relatives in the library are the gradient-button bars under lists (`bordered-list`, sysB group) and the pop-up at the bottom-left of the Maps window ("Show"), neither of which is a placard.

## Purpose and behaviour
"A placard is a type of view that appears at the bottom edge of a window. Historically, placards were used to provide controls for making quick modifications to the view of content within a window, for example, buttons to switch pages or a pop-up button to adjust the magnification. Avoid using placards. Placards are seldom used in modern apps and their use is discouraged. Toolbars and menus are the preferred ways to let people manipulate the view of content" [D].

## Anatomy
A small borderless pop-up or button strip sharing the row of the horizontal scroller at the bottom-left of a scroll view.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| content | page buttons, magnification pop-up | app-defined [D] | custom scroll-view accessory | none; HIG historical examples only |

## Measurements (all [I])
| Property | Value | Basis |
|---|---|---|
| Height | 15 (legacy scroller height) | sits in the horizontal scroller track |
| Text | 10-11 pt Regular (mini/small system font) | |
| Fill | as the scroller track: `#fafafa` light, `#2b2b2b` dark, 0.5 pt separator on its trailing and top edges | |

### Geometry (pt)
The provisional height and separator width above are [I], tied to a legacy horizontal-scroller module, not a Catalina measurement.

### Colours and fills
The fill colours above are [I] approximations from a scroller track. No material or state-specific placard pixel is available.

### Text and icons
The provisional mini/small text range above is [I]. Any button glyph follows its contained control [I].

### Shadows and effects
No separate shadow is proposed [I]; use the provisional top/trailing separator only.

## Layout and spacing
Align with the horizontal scroller's bottom-left accessory area [D] (historical placard anatomy in the cited HIG); width follows the contained controls [I].

## States
None shown.

## Keyboard and accessibility
As the control it contains (`AXPopUpButton`).

## Browser notes
Not needed for a Catalina-era library; document only.

## Evidence
None available.

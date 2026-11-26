# Image View (`image-view`)

- **Status:** present
- **AppKit:** `NSImageView` (`image`, `imageScaling`, `imageAlignment`, `imageFrameStyle = .none`, `isEditable = false`); template images via `NSImage.isTemplate`
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/image-views/
- **Appearances shown:** light, dark

## Purpose and behaviour
Displays a single image or an animated sequence over a transparent or opaque background; images may be stretched, scaled, sized to fit or pinned. Image views are non-editable and non-interactive by default (the editable form is `image-well`; a clickable image is an image button). Template images take the tint of their surroundings. [D] (HIG, Image Views)

## Anatomy
The image only; no frame, background or shadow is added by the view. Circular avatars are produced by masking the image to a circle.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| scaling | proportionally down, axes independently, none, proportionally up or down | proportionally down | `imageScaling` | proportional |
| mask | none, circle | none | layer mask (custom) | both |
| template | false, true | false | `isTemplate` | both (status glyphs are templates) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal | yes, light + dark | see Evidence |
| dimmed in a disabled row | yes | Users & Groups "Guest User" avatar drawn grey (`10-15-Catalina-Light-System-Preferences-Users-and-Groups.png @ 174,376,48,48`) |

## Measurements
### Geometry (pt)
Sizes of the image views in the assigned panes (bounding box of the visible artwork):

| Use | Size | Tag | Evidence |
|---|---|---|---|
| Pane hero icon in a left column (Siri, Time Machine, Software Update, Touch ID) | 117 x 117, centred in the column, top 26..32 pt below the toolbar | [M] | `10-15-Catalina-Light-System-Preferences-Siri.png @ 225,215,234,235`; `...Time-Machine.png @ 225,216,234,234`; `...Software-Update.png @ 187,205,234,235`; `...Touch-ID.png @ 186,206,235,235` |
| User picture, detail area | 62 x 62 circle | [M] | `10-15-Catalina-Light-System-Preferences-Users-and-Groups.png @ 570,262,124,124` |
| User picture, list row | 24 x 24 circle | [M] | same file `@ 174,376,48,48` |
| Screen Time monogram avatar | 98 x 98 circle, fill `#b2b2b2` with white initials | [M] | `10-15-Catalina-Light-System-Preferences-Screen-Time.png @ 187,206,196,196` |
| Sidebar / list app icon (Notifications) | about 29 x 29 artwork in a 32 pt cell | [M] | `10-15-Catalina-Light-System-Preferences-Notifications.png @ 178,393,57,57` |
| Screen Time sidebar and table icons | 24 x 24 | [M] | Screen Time `@ 148,578,48,48`, `@ 540,989,48,49` |
| Printer image | 93 x 67.5 | [M] | `10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png @ 620,256,186,135` |
| Time Machine disk icon | 56 x 60 | [M] | Time Machine `@ 701,265,112,120` |
| Touch ID fingerprint tiles | 48 x 48 circles | [M] | Touch ID `@ 688,296,96,96`, `@ 946,296,96,96` |
| Spotlight pane icon | 53 x 53 | [M] | `10-15-Catalina-Light-System-Preferences-Spotlight.png @ 157,175,106,106` |
| Sidecar device illustration | 221 x 162 | [M] | `10-15-Catalina-Light-System-Preferences-Sidecar.png @ 255,204,442,324` |
| Wallet & Apple Pay hero photo | 334 x 260, flush with the window's left edge | [M] | `10-15-Catalina-Light-System-Preferences-Wallet-and-Apple-Pay.png @ 112,224,668,520` |
| Lock icon (authorization) | 22 x 27.5 (see `lock-button`, owner sysA) | [M] | Security & Privacy `@ 163,1125,44,55` |

### Colours and fills
| Part / state | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Background | transparent (parent shows through) | transparent | [M] | all samples |
| Monogram avatar | fill `#b2b2b2`, initials `#ffffff` | fill grey, no initials in the dark capture | [M] | Screen Time `@ 187,206,196,196` |
| Template glyph tint | follows the label colour of its context | same | [D] | HIG, Image Views |

### Text and icons
None of its own. Captions under hero icons use `label` style "emphasized" (13 pt bold), centred, cap top 10 pt below the icon. [M] Light Siri: icon bottom y=450, caption cap top y=470.

### Shadows and effects
None added by the view; shadows seen (hero icons, the Trackpad video frame) are part of the artwork.

## Layout and spacing
Hero icons are horizontally centred in their column (Siri: column x 112..566, icon x 225..458). List row images are vertically centred in the row. [M]

## Keyboard and accessibility
Not focusable. Role `AXImage` with a description; decorative images are hidden from accessibility. ARIA: `<img alt="...">`, or `alt=""` when decorative. [D]

## Browser notes
`<img>` with `object-fit: contain`; circular masks with `border-radius: 50%`. All artwork (app icons, device photos, the printer, hero icons) must be supplied as image assets; none can be drawn from this spec.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Siri.png | 225,215,234,235 | hero icon in a left column |
| light | 10-15-Catalina-Light-System-Preferences-Users-and-Groups.png | 570,262,124,124 | circular user picture |
| light | 10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png | 620,256,186,135 | product image |
| dark | 10-15-Catalina-Dark-System-Preferences-Siri.png | 225,215,234,235 | hero icon |
| dark | 10-15-Catalina-Dark-System-Preferences-Users-and-Groups.png | 570,262,124,124 | circular user picture |

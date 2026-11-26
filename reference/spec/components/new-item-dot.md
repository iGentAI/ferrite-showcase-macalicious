# New-item indicator (`new-item-dot`)

- **Status:** present (light only; absent in the corresponding dark capture)
- **AppKit:** custom noninteractive indicator in an extensions list [I: no public named bezel]; nearest generic status-dot pattern, not NSButton.
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/user-interaction/providing-user-feedback/
- **Appearances shown:** light [M]; dark absence measured [M].

## Purpose and behaviour
A small blue dot marks an item in Extensions [M]. “New item” is the inventory's descriptive interpretation, not proven tooltip text or an Apple API name [I]. Feedback should communicate status without looking like an action [D: HIG Providing User Feedback]. Exact clearing/read semantics are not visible [I].

## Anatomy
Solid circle with antialiased perimeter; no glyph, border, shadow or independent hit region [M].

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| visible | true,false | by item status [I] | hidden [D] | true in light, false in dark [M] |
| colour | observed blue; accent-following unknown | observed blue [M] | custom fill [I] | blue only [M] |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| visible | light | 10-15-Catalina-Light-System-Preferences-Extensions.png @664,886,12,12 [M] |
| absent | dark | same region is #1d1e1f throughout in 10-15-Catalina-Dark-System-Preferences-Extensions.png [M] |
| hover/pressed/focused/disabled | not applicable | noninteractive status adornment [I] |
| visible dark/inactive window | no | keep geometry6 pt and blue fill as light for closest fallback only [I]; not a measured dark rendering |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Diameter | 6 | [M] | light Extensions row892 x664..675, column670 y886..897; 12px each |
| Radius | 3 | [C] | diameter/2; corner grid @663,885,8,8 confirms circle AA |
| Centre in original image | (669.5,891.5) image px; frame-relative(278.75,407.75) pt | [C] | frame112,76; measured box midpoint |
| Border width | none | [M] | flat fill immediately inside AA perimeter; row892 @664,892,12,1 |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Fill | #3583f7 (sRGB #0c81ff) | not shown: the dark Extensions capture has a different extension list and no new-item indicator; same blue suggested [I] | [M] light / [I] dark | 10-15-Catalina-Light-System-Preferences-Extensions.png @ 670,892 |
| Background at indicator site | #ffffff | #1d1e1f, no indicator | [M] | 10-15-Catalina-Light-System-Preferences-Extensions.png @ 663,892; 10-15-Catalina-Dark-System-Preferences-Extensions.png @ 670,892 |
| AA edge composite | #3a86f7 (sRGB #1884ff) at left central edge | no observed edge | [M] light | 10-15-Catalina-Light-System-Preferences-Extensions.png @ 664,892 |

### Text and icons
No internal text [M]. Status meaning should be included in its list item's accessible description, not encoded solely in a hue [I].

### Shadows and effects
None [M: adjacent rows/columns return directly to list background].

## Layout and spacing
Absolute placement is list-specific; measured box is image664,886,12,12 [M]. Preserve centre on the associated item row rather than treating this dot as a clickable button [I]. The light and dark Extensions captures contain different lists/content, so absence in dark does **not** mean Catalina suppresses new-item indicators in Dark Mode [I: explicit uncertainty].

## Keyboard and accessibility
No Tab stop or click handler [I]. Decorative circle `aria-hidden=true` plus a textual status in the list item accessible description; use a live status announcement only if a runtime update needs one [I]. Actual AX role is not observable from PNGs [I].

## Browser notes
A CSS circle is sufficient; AA differences depend on pixel alignment. Do not claim a measured visible-dark colour or infer a focus/pressed state for a static adornment.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Extensions.png | 650,872,42,42 | blue dot on white list |
| dark | 10-15-Catalina-Dark-System-Preferences-Extensions.png | 650,872,42,42 | absence on dark list; different item content |

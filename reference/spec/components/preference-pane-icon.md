# Preference pane icon (`preference-pane-icon`)

- **Status:** present
- **AppKit:** borderless `NSButton`, image above title [I: public equivalent for the custom System Preferences grid]; see `image-button`.
- **HIG:** https://web.archive.org/web/20200503180052/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/image-buttons/
- **Appearances shown:** light, dark [M].

## Purpose and behaviour
Opens the named settings pane; title and window height change to match it [D: HIG Preferences]. It is an image button, not a persistent selected radio. HIG image buttons place an optional label below the image and need adequate clickable padding [D]. This identifier names the System Preferences grid's specialised layout, not a new AppKit bezel [I].

## Anatomy
Transparent hit rectangle, centred pane artwork, centred one- or two-line title [M]. Background belongs to its grid band, not to the button [M].

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| pane | named pane + image asset | caller supplies [I] | title/image [D] | 31 panes [M] |
| title lines | one, two | by pane [M] | imageAbove / custom label [I] | both [M] |
| enabled | true,false | true [M] | isEnabled [D] | true only [M] |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| normal, key | both | shell light/dark [M] |
| hover/pressed/focused | no | no hover bezel; image-button darkening and focus-ring [I] |
| disabled/inactive | no | image/title0.5 opacity, matching image-button [I] |
| selected | not applicable | pane navigation is momentary [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| General artwork visible bounds | 37 ×37 | [M] | 10-15-Catalina-Light-System-Preferences-0.png @ 168,415,74,74; dark same |
| Desktop & Screen Saver artwork | 37 ×37 | [M] | 10-15-Catalina-Light-System-Preferences-0.png @ 332,415,74,74; dark same |
| Maximum drawing allocation | 40 ×40 | [I] | derives from observed40 pt widths, e.g. Extensions @1149,599,80,70 and Displays @165,1012,80,62; no32 pt asset size can be proven |
| Column pitch | 82 | [M] | shell General/Desktop artwork left168/332; dark same |
| Column centres (frame relative) | 46,128,210,292,374,456,538,620 | [C] | frame starts112; grid nominal centres204+164k in image px |
| Caption pitch for two lines | 14 | [M] | shell Desktop & ink y507, Screen Saver535, both appearances |
| Artwork-to-caption gap, General | 9.5 | [M] | artwork last488, caption first508 (19 blank px); dark same within0.5 |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Upper row band background | #e5e5e5 | #353637 | [M] | 10-15-Catalina-Light-System-Preferences-0.png @ 130,559; 10-15-Catalina-Dark-System-Preferences-0.png @ 130,559 |
| Lower row band background | #ececec | #2f3031 | [M] | same full filenames @130,983 |
| Upper caption | #727272 | #a4a4a5 | [M] | 10-15-Catalina-Light-System-Preferences-0.png @ 245,525; 10-15-Catalina-Dark-System-Preferences-0.png @ 245,525 |
| Lower caption | #767676 | #a1a2a2 | [M] | same full filenames, label stem palettes @155,910,100,52 |

### Text and icons
SF Pro Text Regular12 pt [C: General capital18 px at @162,508,85,18; cap table±1px]. Lines are individually centred; fixed line breaks and exact ordered titles are in `apps/system-preferences.md` [M]. Artwork differs by pane and sometimes appearance [M].

### Shadows and effects
None added by the control [M: transparent surrounding pixels]; shadows are part of artwork.

## Layout and spacing
Grid has8 columns at82 pt pitch [M],7 icons in final row [M]. First-line baselines image526,708,930,1112 [M], so vertical pitch91 pt within each category,111 pt across category boundary [C]. Hit area must cover image and caption; its exact invisible bounds are not observable [I]. Use the full column slot with at least5 pt image padding, not a32 pt circle [I, based on HIG image-button guidance].

## Keyboard and accessibility
Native button with pane name as accessible name; Space opens it when Full Keyboard Access focuses it [D]. AXButton equivalent [D]. Use visible title and decorative image with empty alt; do not make the entire grid a radio group [I: momentary navigation].

## Browser notes
Pane artwork needs image assets; use the `image-button` interaction model. Font fallback and rasterisation differ off macOS [I].

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-0.png | 152,410,294,150 | General and Desktop & Screen Saver |
| dark | 10-15-Catalina-Dark-System-Preferences-0.png | 152,410,294,150 | same grid choices |

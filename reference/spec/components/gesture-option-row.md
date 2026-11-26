# Gesture option row (`gesture-option-row`)

- **Status:** present
- **AppKit:** custom Mouse preference composite of checkbox, labels, optional borderless pull-down and tutorial-selection callout [I: public equivalents, private view class unknown].
- **HIG:** https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/buttons/checkboxes/ ; https://web.archive.org/web/20200503145009/https://developer.apple.com/design/human-interface-guidelines/macos/app-architecture/preferences/
- **Appearances shown:** light, dark [M].

## Purpose and behaviour
Presents a mouse gesture preference with a short description and associates the highlighted option with a tutorial preview [M: Mouse screenshots]. Preference toggles are independent checkboxes, not a mutually exclusive group [D: HIG Checkboxes]. Highlighting the tutorial row is distinct from enabling its checkbox [I: inferred from the custom callout and explanatory video layout]. Preferences apply immediately [D: HIG Preferences].

## Anatomy
Back to front: parent box; optional rounded callout body with right-pointing tip; checkbox centred over the two-label block; primary title; secondary explanation or borderless choice; adjacent tutorial image outside this component [M].

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| checked | true,false | caller supplied [I] | NSButton state [D] | Natural on; Secondary click/Smart zoom off [M] |
| detail | description, pull-down | description [I] | label / NSPopUpButton [I] | both [M] |
| preview-highlighted | true,false | supplied state [I] | custom selection [I] | Natural highlighted, others not [M] |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| highlighted, checked | both | Natural-scroll callout below [M] |
| unhighlighted, unchecked | both | Secondary click and Smart zoom in Mouse pane [M] |
| checked but unhighlighted; highlighted but unchecked | no | these state combinations must stay independent [I] |
| secondary option disabled | both | Secondary click unchecked; its choice text is grey [M], disabling dependent control is inferred [I] |
| hover/pressed/focused/inactive | no | keep callout state separate; checkbox and pull-down use their own component state recipes [I] |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Highlighted callout bounding box | 311 ×53, frame-relative(30,87) | [M] | both Mouse PNGs @172,250,622,106; tip at793,302 |
| Left corner radius | 5, ±0.5 AA uncertainty | [M] | both @170,248,14,14: straight left edge byy260, top250 |
| Light perimeter | 0.5 | [M] | light column220 row250 edge; 251..252 highlight;253 fill. Side172 edge,173 fill |
| Dark perimeter | no distinct border; fill touches AA edge | [M] | dark row310 and corner grid: left172 already fill; no parallel dark line |
| Tip geometry | shoulder nearimage(744,250)/(744,355); tip(793,302); localpt approximately(286,0),(310.5,26),(286,52.5) | [C] | sampled top/bottom rows728..752 and middle row730..803; rounded joins are part of fitted outline |
| Checkbox | 14 ×14; image192,288,28,28 | [M] | checkbox left/right192..219 on middle row; column193 y288..315 |
| Checkbox-to-title gap | 11.5 visible edge-to-ink; title starts35.5 from callout left | [C] | title starts243; checkbox ends219; blank220..242; callout starts172 |
| Primary title ink / baseline | image243..524,y272..291; baseline292 | [M] | both @240,270,550,33; glyph measurement |
| Subtitle ink / baseline | image243..578,y308..327; baseline324 excluding descender | [M] | both @240,308,350,28; C capital308..323 |
| Primary/subtitle baseline pitch | 16 | [C] | 324−292 image px divided by2 |
| Option row pitch | 50 | [M] | checkboxes y288,388,488; Mouse pane control table independently records these |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Selected callout fill | #f0f0f0 (±1 dither) | #676768..#686868 | [M] | 10-15-Catalina-Light-System-Preferences-Mouse.png @ 180,260; 10-15-Catalina-Dark-System-Preferences-Mouse.png @ 180,260 |
| Parent box | #e3e3e3 | #363637 | [M] | both Mouse @168,310 (dark local pixel#353637 within1) |
| Light edge | #b9b9b8 (flat range#b8b8b8..#b9b9b9) | no flat border | [M] | 10-15-Catalina-Light-System-Preferences-Mouse.png @ 220,250 |
| Light inner top highlight | #feffff (±1 aroundwhite) | none | [M] | 10-15-Catalina-Light-System-Preferences-Mouse.png @ 220,251 |
| Primary label | #252525 | #e8e8e8 | [M] | 10-15-Catalina-Light-System-Preferences-Mouse.png @ 523,291; 10-15-Catalina-Dark-System-Preferences-Mouse.png @ 523,291 |
| Secondary label | #787878 | #bbbbbb (range#bababb..#bbbbbb) | [M] | light @577,323; dark stem palette @240,308,350,28, not that same AA coordinate |

### Text and icons
Primary SF Pro Text Regular13 pt [C: capitals19 px]; detail11 pt [C: C cap16 px]. Exact selected text: “Scroll direction: Natural”, “Content tracks finger movement” [M]. Other strings: “Secondary click” / “Click on right side”; “Smart zoom” / “Double-tap with one finger” [M]. Use `checkbox` for the checkmark and `pull-down-button` for the dependent choice/chevron; do not redraw them as part of callout artwork [I: composition recommendation].

### Shadows and effects
No additional callout shadow outside edge [M: adjacent columns return to parent fill]. Checkbox carries its own bezel/shadow [M].

## Layout and spacing
Checkbox is vertically centred in the two-line highlighted row, not aligned to primary text baseline [M: checkbox y288..315, text cap272..291 and308..323]. Tip points towards tutorial frame leftimage864, giving35 pt between tip794 boundary and preview864 [C]. Callout row body occupies left content area; no whole-window background overlay [M]. Selected/tutorial outline uses no accent ring [M]. Exact invisible hit rect and whether hover alone changes the tutorial are not captured [I].

## Keyboard and accessibility
Expose each option as a labelled native checkbox and each dependent choice as a separate select/menu button [I: web mapping of documented checkbox/pull-down semantics]. Space toggles focused checkbox [D]; preserve keyboard access to its enabled dependent choice. Tutorial highlight must not set `aria-checked` on the whole row, which would incorrectly conflate selection and enablement [I]. Use primary title as name, detail as description; keep tutorial still descriptive rather than a focusable fake video [I].

## Browser notes
Callout can be a single fitted SVG outline with5 pt left curves and pointed right tail [C: sampled bounds]; CSS border-radius alone cannot draw the tip. Tutorial content requires still-image assets; static captures provide no animation sequence [I]. Browser cannot configure host mouse settings [I].

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-System-Preferences-Mouse.png | 172,250,622,106 | selected Natural-scroll row |
| dark | 10-15-Catalina-Dark-System-Preferences-Mouse.png | 172,250,622,106 | same callout, no light outline |
| both | apps/system-preferences-mouse.md control table | image172,250,622,306 | row pitch and other option strings |

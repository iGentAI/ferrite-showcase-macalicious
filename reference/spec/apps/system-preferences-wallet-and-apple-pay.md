# System Preferences — Wallet & Apple Pay

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Wallet-and-Apple-Pay.png`; `10-15-Catalina-Dark-System-Preferences-Wallet-and-Apple-Pay.png` [M].
- **Window:** 668 × 334 pt both [M]; opaque frame `@ 112,76,1336,668`. Title “Wallet & Apple Pay”; unified navigation reuses `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` [I] (common System Preferences shell, not app-preferences icon toolbar).
- **State:** same no-cards introductory state in both [M]. Light uses black Apple Pay mark, dark uses a light-grey mark [M]. No tabs, list, lock or card-management controls [M].

## Layout

```text
+ navigation / Wallet & Apple Pay / Search --------------+
|                                      Apple Pay        |
| [MacBook illustration,         Add credit, debit ...   |
|  checkout on display,          three centred lines    |
|  keyboard and hand at                                 |
|  Touch ID; clipped at                 (privacy icon)  |
|  left and bottom edges]        four privacy text lines |
|                                See how your data ...  |
|                                       [Add Card...] (?)|
+-------------------------------------------------------+
```

Coordinates are frame-relative pt [C] (subtract image (112,76), divide by 2). Colours are stored screenshot channels [M].

| Region | Rect (x,y,w,h) pt [M] | Light / dark fill [M] | Evidence |
|---|---|---|---|
| Body/footer | (0,38,668,296) | #ececec / #303031 | both `@ 112,152,1336,592`; samples `10-15-Catalina-Light-System-Preferences-Wallet-and-Apple-Pay.png @ 120,180`, `10-15-Catalina-Dark-System-Preferences-Wallet-and-Apple-Pay.png @ 120,180` |
| Apple Pay mark ink | (425,65,88,36.5) light, dark height 36 | #000000 / #d8d8d8 at flat stems | light `@ 962,206,176,73`, dark `@ 962,206,176,72`; row y=240 around x=1025 |
| Main introduction ink union | (337,114,263.5,44.5) | inherited body | both `@ 786,304,527,89` |
| Privacy emblem | (456.5,174,25,20) | two grey human silhouettes, not solid fill | both `@ 1025,424,50,40` |
| Privacy paragraph ink union | (302,201.5,333.5,52.5) | inherited body | both `@ 716,479,667,105` |
| Privacy link ink | (385,257.5,167.5,11) | #276ad3 (sRGB #0168da) / #589cf8 (sRGB #429bff) on stems | both `@ 882,591,335,22`; modal saturated pixels in this region |
| Illustration placement | clipped to left/bottom body, top at y=74 pt; lower hand reaches about x=318 pt [I] (illustration silhouette, no rectangular background edge) | image asset on body fill | screenshot silhouette around `@ 112,224,660,520`; row y=226 shows display edge; this is an orientation region, not a ready-to-use unmasked crop [I] |

### Layout grid

Apple Pay mark, explanation, privacy emblem and paragraph share horizontal centre x=469 pt [C] (from image x=1050). Main introduction line pitch 16 pt [M]; privacy paragraph pitch 14 pt [M]. Introduction first-glyph x varies by centred line: 347.5,337,347 pt [M]. Privacy link baseline y=266 pt [C]. Add Card button left=520.5 pt, help left=627.5 pt; gap=12.5 pt [C]. Footer button top=293.5 pt, bottom=314 pt; bottom margin=20 pt [C]. Body artwork is intentionally flush/cropped at frame left and bottom, not inset as a card [M]. No right-aligned form columns [M].

## Components used

`image-view`, `label`, `push-button`, `help-button`, shared chrome [M]. The privacy hyperlink is a text-style `push-button` / borderless action [I] (visible blue actionable text with no bezel). Nested checkout controls inside the MacBook display are illustration pixels, not pane controls [I] (static artwork).

### Complete control and label table

Geometry [M], pt conversion [C]. R=13 pt regular; S=11 pt regular privacy text/link [C] (cap heights 18 px and 16 px). `b` is cap-derived baseline [C]; label x is first glyph [M]. Every rect maps to `10-15-Catalina-Light-System-Preferences-Wallet-and-Apple-Pay.png @ (112+2x),(76+2y),(2w),(2h)` and corresponding dark region [M]. Button/help row/column checks y=672, x=1310,1387 agree within a 0.5 pt dark bezel inset [M].

| Component / variant / state | Rect (x,y,w,h) pt; glyph x / b / class | Exact visible text |
|---|---|---|
| image-view / Apple Pay brand mark | (425,65,88,36.5) light; (425,65,88,36) dark | Apple symbol + Pay [M] (brand artwork, not a body-font label) |
| label / R centred | (347.5,114,243,12.5); b=123.5 | Add credit, debit, or store cards and use |
| label / R centred | (337,130,263.5,12.5); b=139.5 | Apple Pay with Touch ID to make purchases |
| label / R centred | (347,146,243.5,12.5); b=155.5 | easily and securely, right from your Mac. |
| image-view / privacy emblem | (456.5,174,25,20) | — |
| label / S centred | (306,201.5,326,10.5); b=209.5 | Card-related information, location, device settings, and device |
| label / S centred | (306.5,215.5,325,10.5); b=223.5 | use patterns will be sent to Apple and may be shared together |
| label / S centred | (302,229.5,333.5,10.5); b=237.5 | with account information with your card issuer or bank to set up |
| label / S centred | (442,244,53.5,10); b=251.5 | Apple Pay. |
| push-button / S borderless link normal | ink (385,257.5,167.5,11); b=265.5 | See how your data is managed... |
| push-button / regular normal | (520.5,293.5,95,20.5); x=534, b=308, R | Add Card... |
| help-button / normal | (627.5,293.5,20,20) | ? |

## App-specific elements

Large photo-composite depicts a MacBook checkout screen, keyboard and hand pressing Touch ID [M]. The left edge and lower keyboard/hand are cut by the window frame [M]. Preserve the illustration's asymmetric silhouette and its background-dependent shadow [I] (a rectangular crop would include neighbouring privacy text around image x=714..778). Display top-edge evidence `@ 112,224,560,8`; keyboard/hand evidence `@ 112,550,660,194` [M]. Nested screen content is too small to rebuild as pane controls; retain it in the artwork [I].

Apple Pay mark source areas and privacy emblem are listed in the region table [M]. The privacy emblem consists of two offset person silhouettes with different greys [M]; do not substitute a padlock [I] (icon content differs). No stored cards or card logos appear outside the illustration [M].

## Content in the screenshot

All pane strings and controls are above [M]. Both appearances have identical wording/line breaks [M]. Add Card flow, privacy details, payment cards, selected/focused/pressed states and authentication are not shown [M].

## Not reproducible / assets needed

Need separately masked MacBook/hand illustration with correct shadow, Apple Pay light/dark marks, privacy emblem and shared toolbar glyphs [I] (silhouettes are measured above; reconstruction requires source assets). Do not take the entire illustration bounding rectangle as an asset without masking, because it overlaps adjacent text [I]. Apple Pay provisioning/payment and Touch ID cannot be recovered from these stills or configured by a browser preference imitation [I] (hardware/OS/payment integration).

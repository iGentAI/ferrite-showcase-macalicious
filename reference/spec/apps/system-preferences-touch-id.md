# System Preferences — Touch ID

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Touch-ID.png`; `10-15-Catalina-Dark-System-Preferences-Touch-ID.png` [M].
- **Window:** 668 × 338 pt in both [M], opaque frame `@ 112,76,1336,676`. Title “Touch ID”; unified navigation reuses `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` [I] (common System Preferences shell, not app-preferences icon toolbar).
- **State:** same content and settings in both; one saved fingerprint “Finger 1”, Add a fingerprint tile, all four uses checked [M]. No lock [M].

## Layout

```text
+ navigation / Touch ID / Search ------------------------+
| (large pink    | Touch ID lets you ...                 |
|  fingerprint)  | purchases ...                         |
|                |    (fingerprint)     (+)              |
|                |      Finger 1    Add a fingerprint    |
|                |                                      |
|                | Use Touch ID for:                     |
|                | ☑ Unlocking your Mac                  |
|                | ☑ Apple Pay                           |
|                | ☑ iTunes Store, App Store & Apple Books|
|                | ☑ Password AutoFill               (?) |
+-------------------------------------------------------+
```

Coordinates are frame-relative pt [C] (subtract image (112,76), divide by 2). Colours are stored PNG values [M].

| Region | Rect (x,y,w,h) pt [M] | Light / dark background [M] | Evidence |
|---|---|---|---|
| Left identity region | (0,38,192,300) | #ececec / #303031 | both `@ 112,152,384,600`; samples `10-15-Catalina-Light-System-Preferences-Touch-ID.png @ 130,180`, `10-15-Catalina-Dark-System-Preferences-Touch-ID.png @ 130,180` |
| Vertical divider | (192,38,1,300) | #dedede, #e1e1e1 / #4f4f50, #414142 | both `@ 496,152,2,600`; row y=450 |
| Right settings region | (193,38,475,300) | #e3e3e3 / #363637 | both `@ 498,152,950,600`; samples `@ 530,250` |
| Explanation allocation | (216,53.5,414,31) | inherited right fill | both `@ 544,183,828,62` |
| Fingerprint tile row allocation | (284,110,215,71) | inherited right fill | both `@ 680,296,430,142` |
| Uses allocation | (216,202,265,105) | inherited right fill | both `@ 544,480,530,210` |

### Layout grid

Sidebar artwork centred at x=96 pt [C], right explanation first glyph x=216.5/217 pt [M]. Intro baseline pitch 16 pt [M]. Fingerprint/add artwork centres x=312 and x=441 pt [C] (from image x=736,994), 129 pt apart [C]. Their captions share baseline y=174.5 pt [C]. “Use Touch ID for:” baseline y=213 pt; checkbox left x=228 pt, label first glyph x=246.5..247 pt [M]. Checkbox pitch 22 pt [M]. Help lies at (627.5,299.5) pt [M], right margin 20.5 pt, bottom margin 18.5 pt [C]. No form label/control columns, tabs or footer lock [M].

## Components used

`split-view`, `separator`, `image-view`, `image-button` (saved fingerprint), `round-button` (add tile), `label`, `checkbox`, `help-button`, shared chrome [M].

### Complete control and label table

All geometry [M], pt conversion [C]. R=13 pt regular; S=12 pt regular captions [C] (from 18 px / 17 px capitals). `b` is cap-derived baseline [C]; first glyph x [M]. Each rect maps to `10-15-Catalina-Light-System-Preferences-Touch-ID.png @ (112+2x),(76+2y),(2w),(2h)` and equivalent dark region [M]. Confirming rows/columns: y=320,344,450,537,695; x=305,577,992,1387 [M]. The rect for a custom image button is its visible art, not an unseen hit-area estimate [M].

| Component / variant / state | Rect (x,y,w,h) pt; glyph x / b / class | Exact visible text |
|---|---|---|
| image-view / large Touch ID artwork | (39.5,66,113,113) | — |
| label / R introductory line | (216.5,55,406.5,12.5); b=64.5 | Touch ID lets you use your fingerprint to unlock your Mac and make |
| label / R introductory line | (217,71,412,12.5); b=80.5 | purchases with Apple Pay, iTunes Store, App Store and Apple Books. |
| image-button / saved fingerprint normal | art (288,110,48,48) | — |
| label / S tile caption | (290.5,167.5,42,11.5); b=175 | Finger 1 |
| round-button / black add disk | (417,110,48,48) | + |
| label / S secondary tile caption | (393.5,167.5,94.5,11.5); b=175 | Add a fingerprint |
| label / R section caption | (217,203,102.5,10.5); b=213 | Use Touch ID for: |
| checkbox / regular on | (228,224,14,14); x=247, b=235.5, R | Unlocking your Mac |
| checkbox / regular on | (228,246,14,14); x=246.5, b=257.5, R | Apple Pay |
| checkbox / regular on | (228,268,14,14); x=246.5, b=279.5, R | iTunes Store, App Store & Apple Books |
| checkbox / regular on | (228,290,14,14); x=247, b=301.5, R | Password AutoFill |
| help-button / normal | (627.5,299.5,20,20) | ? |

## App-specific elements

Large icon is a white/grey circular disc containing pink ridge artwork [M], source `@ 191,208,226,226`. Stored pink #eb4b69 (sRGB #ff3766) at ridge runs around image (302,322), measured row y=320/col x=305 [M]; the icon core is identical between appearances [M]. The disc's exterior shadow is much less visible on dark fill [M]. Saved fingerprint uses grey ridges with no enclosing disc [M], source `@ 688,296,96,96`; sampled ridge at (700,344) is #98989d light, #a2a3a7 dark [M].

Add tile source `@ 946,296,96,96` [M]. Circular black body has a grey plus spanning 26 × 26 pt [M] at `@ 968,318,52,52`; horizontal/vertical bars align at centre [M]. Plus sampled at (994,345) is #8e8d92 light / #98979c dark [M]. It is **not** the small list-management plus button [I] (artwork/size differ). Finger removal affordance is not shown [M]; do not invent a delete badge in this state [I].

## Content in the screenshot

All visible strings are transcribed in the table [M]. Enrollment flow, fingerprint renaming/removal, authentication prompts and unchecked/focused/pressed states are not shown [M]. Checked uses remain identically positioned in dark [M].

## Not reproducible / assets needed

Need large Touch ID artwork, saved-fingerprint ridge asset, add-disc artwork and shared shell glyphs [M]. Biometric enrollment and system authorization cannot be implemented by this preference imitation in a browser [I] (hardware/security operations require the OS). Web authentication APIs are not a pixel-equivalent reconstruction of this enrollment flow [I].

# System Preferences — Siri

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Siri.png`; `10-15-Catalina-Dark-System-Preferences-Siri.png` [M].
- **Window:** opaque `668 × 332 pt`, image origin `112,76`, both [M], each @ 112,76,1336,664 (`info`). Unified toolbar reuses `title-bar`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-segmented-control`, `toolbar-search-field`; title “Siri”, search “Search” [M]. Shared chrome is not remeasured.
- **Comparison:** identical enabled Ask Siri / Hey Siri / allow-when-locked / menu-bar settings, shortcuts, language, voice and feedback selection [M]. Illustration screen pixels match; light has a soft shadow while dark has a bright pale rim [M].

## Layout

```text
+-------------------- shared toolbar -------------------+
|                    | Siri explanation                |
|   Siri orb         |              ☑ Listen for…      |
|   Siri             |              ☑ Allow when locked|
|                    | Shortcut:    [Hold Command…]    |
|   ☑ Enable Ask Siri| Language:    [English…]          |
|                    | Siri Voice:  [American…]         |
|                    | Feedback:    ● On ○ Off          |
|                    | ☑ menu bar   Suggestions…     ? |
+-------------------------------------------------------+
```

E-L = `10-15-Catalina-Light-System-Preferences-Siri.png`; E-D = `10-15-Catalina-Dark-System-Preferences-Siri.png` [M]. Rects `(x,y,w,h)` are frame-relative pt [M]. Stored colour values [M].

| Region | Rect [M] | Light / dark fill [M] | Evidence E-L/E-D image px |
|---|---|---|---|
| Left artwork/enable column | (0,38,230,294) | `#ececec` / `#303031` | @ 130,600; @ 112,152,460,588 |
| Right settings region | (230,38,438,294) | `#e3e3e3` / `#363637` | @ 600,550 and @ 600,200; @ 572,152,876,588 |
| Column divider | (230,38,0.5,294) | `#dedede` / `#4f4f50` | row 400 x572; @ 572,152,1,588 |
| Siri icon rim | (59,71,112,112) [M], shadow outside | coloured artwork; `#090f5c (sRGB #0c0960)` both at sample [M] | row 330 x230..454; col 341 y218..442; @ 230,218,224,224; sample @ 240,330 |

## Components used

`image-view`, `label`, `checkbox`, `pop-up-button`, `radio-button`, `push-button`, `help-button`, `separator` [M]. There is no lock or tab strip [M].

## Content in the screenshot — complete control table

Rect and `x/B` (first glyph x / baseline y) are measured frame pt [M]. Label-only rects are ink extents [M]. R = `13 pt` regular, caption bold where indicated [C], cap-height mapping and `label.md`. Embedded popup/button title positions are completed in the embedded-label table below [M].

| Component | Variant / state / type | Rect [M] | Exact visible text [M]; x/B [M] | Evidence E-L/E-D image px |
|---|---|---|---|---|
| image-view | Siri illustration | (59,71,112,112) | no text | @ 230,218,224,224; row 330, col 341 |
| label | R bold centred | (105,197,19.5,10.5) | Siri; 105/207 | @ 322,470,39,21 |
| checkbox | regular on, R | (61,230,14,14) | Enable Ask Siri; 80/241.5 | @ 234,536,28,28; ink @ 272,540,175,21; col 242 |
| label | R wrapped | (262.5,58,380.5,28.5) | Siri helps you get things done, just by asking. Find files on your / Mac, dictate a note, check the weather, and more.; 262.5/67.5 | @ 637,192,761,57 |
| checkbox | regular on, R | (420.5,100,14,14) | Listen for “Hey Siri”; 439.5/111.5 | @ 953,276,28,28; ink @ 991,280,236,25; col 961 |
| checkbox | regular on, R | (420.5,120,14,14) | Allow Siri when locked; 439/131.5 | @ 953,316,28,28; ink @ 990,320,267,21 |
| label | R right aligned | (297.5,152,115.5,12.5) | Keyboard Shortcut:; 297.5/161.5 | @ 707,380,231,25 |
| pop-up-button | regular enabled | (421,147.5,191.5,20) | Hold Command Space | @ 953,370,385,42; row 377, col 964 |
| label | R right aligned | (351.5,183.5,61.5,12) | Language:; 351.5/192.5 | @ 815,443,123,24 |
| pop-up-button | regular enabled | (421,178.5,191.5,20) | English (United States) | @ 953,432,385,42; col 964 |
| label | R right aligned | (354.5,214,58.5,10.5) | Siri Voice:; 354.5/223.5 | @ 821,504,117,21 |
| pop-up-button | regular enabled | (421,209.5,191.5,20) | American (Female) | @ 953,494,385,42; col 964 |
| label | R right aligned | (314.5,245,98.5,10) | Voice Feedback:; 314.5/254.5 | @ 741,566,197,20 |
| radio-button | regular on, R | (420.5,242,16,16) | On; 440/255 | @ 953,560,32,32; ink @ 992,567,32,20; row 566, col 968 |
| radio-button | regular off, R | (465.5,242,16,16) | Off; 485/255 | @ 1043,560,32,32; ink @ 1082,566,37,21 |
| checkbox | regular on, R | (250,295,14,14) | Show Siri in menu bar; 268.5/306.5 | @ 612,666,28,28; ink @ 649,670,261,21; col 620 |
| push-button | regular enabled | (419.5,292.5,195,20) | Siri Suggestions & Privacy… | @ 950,660,392,42; row 669, col 965 |
| help-button | regular enabled | (627.5,292.5,20,20) | ? | @ 1367,661,40,40; row 681, col 1387 (halo excluded) |

### Layout grid

Column divider x`230 pt`; intro x`262.5 pt`; form label ink right edge `413 pt`; popup left `421 pt`; gap `8 pt` [C]. Popup top pitch `31 pt`, feedback row top `242 pt`; Hey Siri checkbox top pitch `20 pt` [M], E-L/E-D col 964 and col 961. Bottom checkbox inset `20 pt` into right region; footer button starts `1.5 pt` before the popup column, right edge `614.5 pt`; help right inset `20.5 pt`, button and help top `292.5 pt`, help bottom margin `19.5 pt` [C]. Intro line pitch `16 pt` [M], E-L/E-D @ 637,192,761,57.

## App-specific elements

Siri circular artwork uses multicoloured intersecting translucent waves inside a dark orb and a pale outer rim [M], E-L/E-D @ 226,218,228,228. The measured rim is `112 × 112 pt`; light shadow extends outside it, while dark rim is clearly isolated by row 330 and col 341 [M], E-L/E-D @ 230,218,224,224. Do not reuse the small menubar icon at this enlarged size [I].

### Embedded labels and explicit evidence

First glyph x / baseline B in frame pt [M]; regular `13 pt` [C]. Light/dark separately sampled; antialiased tops differ by up to `0.5 pt`, baselines and first glyph x agree [M]. Rounded bezels exclude their external halo/shadow [M].

| Label | x / B [M] | Full evidence citation |
|---|---|---|
| Hold Command Space | 430.5/161.5 | `10-15-Catalina-Light-System-Preferences-Siri.png @ 973,380,267,25`; dark same |
| English (United States) | 430.5/192.5 | `10-15-Catalina-Light-System-Preferences-Siri.png @ 973,442,274,25`; dark same |
| American (Female) | 430/223.5 | `10-15-Catalina-Light-System-Preferences-Siri.png @ 972,504,224,24`; dark same |
| Siri Suggestions & Privacy… | 433.5/306.5 | `10-15-Catalina-Light-System-Preferences-Siri.png @ 979,670,333,25`; dark same |

Grouped geometry/colour evidence [M]: `10-15-Catalina-Light-System-Preferences-Siri.png @ 112,152,1336,588`; `10-15-Catalina-Dark-System-Preferences-Siri.png @ 112,152,1336,588`. Artwork rim evidence [M]: `10-15-Catalina-Light-System-Preferences-Siri.png @ 230,218,224,224`; `10-15-Catalina-Dark-System-Preferences-Siri.png @ 230,218,224,224`.

## Not reproducible / assets needed

Supply matching Catalina Siri preference-pane artwork [I]. The icon rim is measured separately from its external shadow [M]. Open menus, voice samples, Suggestions & Privacy sheet, changed settings, off Ask Siri state, hover/pressed and inactive-window state are not shown [M]. SF system-font fallback may change wrap and label widths [I].

# System Preferences — Printers & Scanners

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png`; `10-15-Catalina-Dark-System-Preferences-Printers-and-Scanners.png` [M].
- **Window:** opaque `668 × 438 pt` in both, image origin `112,76` [M], each @ 112,76,1336,876 (`info`). Unified chrome uses `title-bar`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-segmented-control`, `toolbar-search-field`; title “Printers & Scanners”, search “Search” [M]. Do not remeasure shared chrome.
- **State:** same printer selected, idle and last used, same values, sharing unchecked in both [M]. Printer illustration is darker against the dark box; no content change [M].

## Layout

```text
+------------------- shared toolbar --------------------+
| + Printers list ----+ + selected printer -------------+|
| | printer / status  | | artwork  name / queue / setup ||
| |                   | | Location / Kind / Status     ||
| | + −               | | share checkbox / preferences ||
| +-------------------+ +------------------------------+|
|                     Default printer: [Last Printer…] |
|                  Default paper size: [US Letter]   ? |
+-------------------------------------------------------+
```

E-L = `10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png`; E-D = `10-15-Catalina-Dark-System-Preferences-Printers-and-Scanners.png` [M]. Rects `(x,y,w,h)` in frame pt; all placements [M]. Stored colour samples [M].

| Region | Rect [M] | Light / dark fill [M] | Evidence E-L/E-D (image px) |
|---|---|---|---|
| Content/footer | (0,38,668,400) | `#ececec` / `#303031` | @ 130,800; @ 112,152,1336,800 |
| Printer list | (19,58,198,296) | `#ffffff` / `#1e1e1f` | @ 160,600; row 500 x150..546; @ 150,192,396,592 |
| Group heading row | (20,59,196,24) | `#ffffff` / `#1e1e1f` | @ 160,210; col 160 y194..242 |
| Selected printer row | (20,83,196,33) | `#dcdcdc` / `#464646` | @ 160,260; col 160 y242..308 |
| Printer detail box | (229,58,420,296) | `#e3e3e3` / `#363637` | col 580 y192..784; row 500; dark @ 572,500; @ 570,192,840,592 |
| Action strip | (19,333,198,21) | standard gradient-button strip [I], reuse component | @ 150,742,396,42 |

Dark box is not perfectly constant: sample `580,500` is `#373737`, while `572,500` is `#363637` [M]; reproduce via the box component rather than recolouring artwork [I].

## Components used

`bordered-list`, `list-view`, `label`, `image-view`, `status-dot`, `gradient-button`, `box`, `push-button`, `checkbox`, `pop-up-button`, `help-button` [M].

## Content in the screenshot — complete control table

Rect and `x/B` (first glyph x / baseline y) are frame-relative pt [M]. Label-only rects are ink extents [M]. R = regular `13 pt`; S = small `11 pt` [C], cap-height mapping in CONVENTIONS and `label.md`. All content is identical across appearances [M]. Embedded push-button/pop-up text uses the component baseline [I].

| Component | Variant/state/type | Rect [M] | Exact visible text [M]; x/B [M] | Evidence E-L/E-D image px |
|---|---|---|---|---|
| label | S tertiary group header | (30,67,39,8) | Printers; 30/74.5 | @ 172,210,78,16 |
| list-view + image-view | selected; R | (20,83,196,33) | Brother HL-2270DW s…; 68/96 | @ 152,242,392,66; ink @ 248,248,283,21 |
| status-dot + label | green idle; S | (80,103.5,77,10.5) | Idle, Last Used; 81/112.5 | @ 244,280,182,24; ink @ 274,283,152,21 |
| image-view | printer artwork | (254,91,93,64) | no text | @ 620,258,186,128 |
| label | R bold | (372,75.5,172,11) | Brother HL-2270DW series; 372/86 | @ 856,227,344,22 |
| push-button | regular enabled | (371.5,101.5,159,20) | Open Print Queue… | @ 854,278,320,42; row 288, col 865 |
| push-button | regular enabled | (371.5,134.5,159,20) | Options & Supplies… | @ 854,344,320,42; col 865 |
| label | S bold tertiary, right aligned | (312,193.5,50,8.5) | Location:; 312/201.5 | @ 736,463,100,17 |
| label | S regular | (371.5,193.5,32,8.5) | Castle; 371.5/201.5 | @ 855,463,64,17 |
| label | S bold tertiary, right aligned | (334.5,215.5,27.5,8.5) | Kind:; 334.5/223.5 | @ 781,507,55,17 |
| label | S regular | (372,215.5,150,10.5) | Printopia-D1FBAAFB-AirPrint; 372/223.5 | @ 856,507,300,21 |
| label | S bold tertiary, right aligned | (323,238,39,8.5) | Status:; 323/246 | @ 758,552,78,17 |
| label | S regular | (372,237.5,17.5,8.5) | Idle; 372/245.5 | @ 856,551,35,17 |
| checkbox | regular off, R | (253,299,14,14) | Share this printer on the network; 271.5/310.5 | @ 618,674,28,28; ink @ 655,678,396,25; row 688, col 622 |
| push-button | small enabled, S | (495.5,297.5,131,17) | Sharing Preferences… | @ 1102,672,264,36; row 688 |
| gradient-button | add enabled | (19,334,22,20) | + | @ 150,744,44,40 |
| gradient-button | remove enabled | (41,334,22,20) | − | @ 194,744,44,40 |
| label | R right aligned | (271,375,89,12) | Default printer:; 271/384.5 | @ 654,826,178,24 |
| pop-up-button | regular enabled | (369.5,370.5,229,20) | Last Printer Used | @ 850,816,460,42; row 830, col 859 |
| label | R right aligned | (248.5,406,111.5,12) | Default paper size:; 248.5/415.5 | @ 609,888,223,24 |
| pop-up-button | regular enabled | (369.5,401.5,229,20) | US Letter | @ 850,878,460,42; col 859 |
| help-button | regular enabled | (627.5,401.5,20,20) | ? | @ 1367,879,40,40; row 898, col 1387 (halo excluded) |

### Layout grid

Main panels top `58 pt`, bottom `354 pt`; left margin `19 pt`, right margin `19 pt`, inter-panel gap `12 pt` [C]. Printer name/control column ink x `372 pt`; detail-label right ink edge `362 pt`; gap to values `9.5–10 pt` [C]. Detail baseline pitch `22 pt` [M], E-L/E-D @ 736,463,420,106. Queue/setup button top pitch `33 pt` [M], col 865. Footer popup left `369.5 pt`, label right ink edge `360 pt`, `9.5 pt` gap; popups top pitch `31 pt`, lower popup bottom margin `16.5 pt` [C]. Sharing checkbox begins `24 pt` inside the box; sharing button is right aligned with `22 pt` inset [C]. No lock footer appears [M].

## App-specific elements

Printer portrait is a Brother-style black laser printer; list has its smaller thumbnail [M], E-L/E-D @ 166,252,66,50, and main artwork @ 620,258,186,128. Main asset crop is an image extent, not a replacement button [M]. Printer name in list is end-truncated, while full name appears in the detail heading [M]. Selected cell includes a green status dot and smaller status line [M].

### Embedded labels and explicit evidence

First ink x / baseline B in frame pt [M]; R `13 pt`, S `11 pt` [C]. Both appearances were sampled; dark glyph antialiasing can start one image row earlier [M]. Controls exclude external halo/shadow [M].

| Label | x / B [M] | Size [C] | Full evidence citation |
|---|---|---|---|
| Open Print Queue… | 392.5 / 115.5 | R | `10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png @ 897,288,233,25` |
| Options & Supplies… | 388.5 / 148.5 | R | `10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png @ 889,354,249,25` |
| Sharing Preferences… | 504 / 309.5 | S | `10-15-Catalina-Dark-System-Preferences-Printers-and-Scanners.png @ 1120,679,216,20` |
| Last Printer Used | 379 / 384.5 | R | `10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png @ 870,826,205,20` |
| US Letter | 379 / 415.5 | R | `10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png @ 870,889,111,19` |

Grouped evidence for every preceding placement and colour [M]: `10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png @ 112,152,1336,800`; `10-15-Catalina-Dark-System-Preferences-Printers-and-Scanners.png @ 112,152,1336,800`. Exact Kind transcription checked in enlarged crop `10-15-Catalina-Light-System-Preferences-Printers-and-Scanners.png @ 852,500,310,38` [M].

## Not reproducible / assets needed

Supply matching printer portrait and thumbnail in both appearances plus standard Catalina symbols [I]. Do not substitute a generic print icon for the printer photograph [I]. Add/remove dialogs, print queue, options, sharing preferences, opened popups, alternate printer rows, hover/pressed and inactive states are not shown [M]. Font fallback may change truncation [I].

# Help Viewer

- **Screenshots:** `10-15-Catalina-Light-Help.png`, `10-15-Catalina-Dark-Help.png`, `10-15-Catalina-Light-Help-Search.png`, `10-15-Catalina-Dark-Help-Search.png` [M].
- **Window:** all four opaque frames **877 × 722 pt** [M], `$M info`: image rect `(46,38,1754,1444)` on each PNG. Floating standard title/toolbar window, title **“macOS User Guide”** [M], not a menu screenshot.
- **States:** light welcome has the table-of-contents sidebar open; dark welcome hides it; both search screenshots hide it and show full-width results for **“File”** [M]. Neither Help menu nor floating menu-item arrow is visible [M]; these cannot be measured from this evidence. Do not synthesize them as a captured state.
- Rects below use pt relative to frame origin `(46,38)` [C]; source coordinates always use original image px. Colours are stored PNG values [M].

## Layout

| Region | Geometry (pt) [C] | Light colours [M] | Dark colours [M] | Evidence / tag |
|---|---|---|---|---|
| Title strip | `(0,0,877,19)` above toolbar controls | unified gradient | unified gradient | [C] title at image y=44..65, toolbar controls y=76..119; `10-15-Catalina-Light-Help.png @ 46,38,1754,98` |
| Whole title/toolbar | `(0,0,877,49)` | near top `#e5e5e5`, lower `#cdcdcd`; bottom `#bdbdbd` / `#a7a7a7` | near top `#424446`, lower `#353738`; bottom `#2a2c2d` / black | [M] `$M col` at x=1780 y=38..160 in `10-15-Catalina-Light-Help.png` and `10-15-Catalina-Dark-Help.png`; field interrupts that column y=76..119 |
| TOC sidebar, light welcome only | `(0,49,203,673)` + **1 pt** divider | white; selected Welcome `#2365da (sRGB #0062e2)` near row top | not shown | [C] `10-15-Catalina-Light-Help.png @ 46,136,408,1346`; divider x=452..453, sampled `@ 452,300` → `#e6e6e6` |
| Welcome hero | light `(204,49,673,286)`; dark `(0,49,877,286)` | vertical near-white gradient: top `#ffffff`, middle `#f7f7f6`, bottom `#f2f2f2` | identical white welcome page, **not dark** | [C] both Help PNGs `@ 1000,136`, `@ 1000,500`, `@ 1000,704`; next region starts image y=708 |
| Welcome body | light `(204,335,673,387)`; dark `(0,335,877,387)` | `#ffffff` | `#ffffff` | [C] both Help PNGs `@ 1000,708`, `@ 1600,900`; rule at image y=792 → `#cccccc` |
| Search results body | `(0,49,877,673)` | `#ffffff`; selected first row locally `#dddddc` | `#1d1e20`; no highlighted result row | [C] `10-15-Catalina-Light-Help-Search.png @ 1600,200`, `@ 1600,280`; dark `10-15-Catalina-Dark-Help-Search.png @ 1600,200`, `@ 1600,280` |

```text
[traffic lights]                 macOS User Guide
[back|forward] [sidebar] [share]                     [Search / File (x)]
welcome: [TOC in light] [round landscape icon / macOS User Guide / for macOS 10.15]
                        Table of Contents
                        laptop artwork / Do more on the desktop / description
search:  All Help (558 results)
         Finder icon  result title
                      description
         ...
         Show all v
         rule / See more results on the web ↗
```
Arrangement [M], four source previews and crops referenced below.

### Toolbar item order

Light toolbar outer bezels occupy image y=75..120 → **y=18.5, h=23 pt** [C]; dark borderless fill occupies y=76..119 → **y=19, h=22 pt** [C]. The following are light bezel outer rects. Dark has no contrasting light border: its fills are inset **0.5 pt** on all sides, hence **1 pt** smaller in each dimension [C]. Evidence: `$M row … 84 46 1800 --tol 5` on both Help PNGs; `$M col` through the search field.

| Order | Component / contents | Rect (pt) [C] | Evidence [M] |
|---|---|---|---|
| Back, Forward | `toolbar-segmented-control`, two chevrons | back `(7.5,18.5,26,23)`, forward `(33.5,18.5,26,23)` | `10-15-Catalina-Light-Help.png @ 61,75,104,46`; dark fills x=62..111 and 114..163 |
| Show/Hide TOC | `toolbar-button`, sidebar glyph | `(66.5,18.5,38,23)` | light `@ 179,75,76,46`; dark fill x=180..253 |
| Share | `toolbar-button`, share glyph | `(111.5,18.5,38,23)` | light `@ 269,75,76,46`; dark fill x=270..343 |
| Search, trailing anchored | `toolbar-search-field` | `(545.5,18.5,324,23)` | light `@ 1137,75,648,46`; dark fill x=1138..1783 |

All screenshots use the same positions [M]. Search placeholder **“Search”** in welcome; entered value **“File”**, focused ring, magnifier and clear-circle in search [M] (`10-15-Catalina-Light-Help-Search.png @ 1130,70,662,56`; dark same crop). Back is enabled in Light Help-Search and Dark Help-Search; forward is disabled [M]. Dark welcome shows both navigation chevrons disabled; light welcome both are pale [M]. Sidebar and Share are dimmed in search [M]. Reuse the component states rather than inventing app-specific button drawings.

## Components used

`window`, `title-bar`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-segmented-control`, `toolbar-search-field`, `sidebar`, `disclosure-triangle`, `list-view`, `image-view`, `label`, `text-view`. `menu`, `menu-item` and help-location arrow are **not shown** [M]. `popover` is not a substitute for this window [I] (classification). Component specs supply chrome and focus-ring rendering.

## App-specific elements

### Welcome sidebar and page

- TOC row text starts image x=86 → **20 pt** inset [C]; disclosure triangles at x=62..77 → **8 pt** inset [C]. Welcome selected row y=136..185 → **25 pt high** [C], `$M col 10-15-Catalina-Light-Help.png 50 136 856`; ordinary title baselines repeat **26 pt** [C] (Basics, Apps, Customize, Files, Apple ID rows, crop `@ 46,136,410,720`). Wrapped “Use Apple…” and “Music…” rows use **42 pt** [C], observed two-line modules in the same crop. Text **13 pt Regular** [C], **`#272727`** [M] (`$M palette … 85,202,150,26`); selected Welcome white [M] (`@ 100,160`).
- Hero icon is a circular landscape asset centred over the title. Its horizontal diameter at centre image y=330 is **109 pt** [C]: visible ring x=1018..1235 in light (`$M row … 330 990 1260`); dark shifts the entire hero group left by **102 pt** [C], the half-width of the missing sidebar. Circle centre **(540.5,148) pt light**, **(438.5,148) pt dark** [C] from those bounds and the y=228..439 visible extent (`$M col … 1126 220 447`).
- Main heading **“macOS User Guide”**, centred, **32 pt** [C] (cap-height about 45 px in `10-15-Catalina-Light-Help.png @ 975,512,165,50`), **semibold system face** [I] (identity/weight inferred from the system-looking glyphs). Heading ink starts at image `(850,514)` light and `(646,514)` dark → frame **(402,238)** / **(300,238) pt** [C]. Text black in both [M], palette `@ 850,510,150,54`. Subtitle **“for macOS 10.15”**, **18 pt Regular** [C] (cap-height module) below, image y=604..632 [M].
- Centred **“Table of Contents”** link with outline-view icon, above rule at image y=792 [M]. Link is **15 pt Regular** [C], image crop light `@ 980,734,295,35`, dark `@ 776,734,295,35` [M]. The rule runs light x=494..1759 and dark x=116..1733 [M], measured in those body regions; body text aligns to those leading edges → **224 pt light / 35 pt dark** frame x [C].
- Laptop artwork lies beneath the rule; use the source asset rather than reconstructing its embedded desktop [I]. Visible top at image y=866 [M] (`$M row … 866 485 1280`); the title **“Do more on the desktop”** begins image y=1382 [M], **18 pt Medium** [C] (cap-height module). Body is **13 pt Regular** [C]. Bottom crop hides further content [M].

### Search results

- Heading **“All Help”**, count **“(558 results)”** [M], at image x=88 and x=260, y=180 and y=190 respectively. Heading **22 pt bold**, count **11 pt Regular** [C], cap-height modules in `10-15-Catalina-Light-Help-Search.png @ 86,168,350,54`; corresponding dark region. Results icon left x=88, text x=138 → frame **21 pt / 46 pt** [C]. Finder icons occupy **18 × 18 pt** [C], image `(88,260,36,36)` and next rows.
- Dark rows have title tops image y=268,388,508,628,748,868 → **60 pt pitch** [C]. Description tops y=312,432,552,672,792,912 → **22 pt below title** [C]. Light title tops y=268,388,540,660,780,900: the wrapped second description increases the following row's pitch by **16 pt** [C]. The first highlighted light row's background is image y=246..357 → **56 pt high**, inset **2 pt** from frame left [C] (`$M col … 50 136 370`).
- Titles **13 pt Bold**, descriptions **13 pt Regular** [C] (cap-height modules in result crops). Light selected-title stem `#222222`; dark stem `#dcdddd` [M], `$M palette … 90,266,600,26` light and `… 138,266,600,26` dark. Dark body remains dark, unlike welcome [M].
- Footer **“Show all”** with downward chevron; separator then **“See more results on the web”** with northeast arrow [M]. Link stem colours **`#276ad3 (sRGB #0168da)` light / `#589cf8 (sRGB #429bff)` dark** [M] (palettes `10-15-Catalina-Light-Help-Search.png @ 88,1128,385,30`; dark `@ 88,1100,385,30`). Light rule y=1100, **`#e6e6e6`**; dark y=1068..1069, **`#333436`** [M] (`@ 1000,1100` light, `@ 1600,1068` dark). Search results do not open a menu [M].

## Content in the screenshot

All strings below are [M], evidence `10-15-Catalina-Light-Help.png @ 46,136,410,720`, both Help-Search PNGs `@ 86,168,1674,1000`, and both welcome page regions.

**TOC order (light only):** Welcome; Basics; Apps; Customize your Mac; Files and folders; Apple ID and iCloud; Use Apple / devices together; Music, books, news, / and more; Privacy and security; Mac hardware; Resources for your Mac; Resources for your / Apple devices. Slashes mark visible wraps, not literal text. Disclosure arrows precede Basics through Mac hardware; the last two entries have no arrow.

**Welcome body:** “macOS User Guide”; “for macOS 10.15”; “Table of Contents”; “Do more on the desktop”; “With macOS, you can easily organize and customize your desktop—and get work done without ever opening an app.” Light capture cuts this final sentence after “ever”; dark shows it whole [M].

**Light search order / descriptions:**
1. “Change FileVault preferences on Mac” / “Use FileVault to protect the information on your Mac by encrypting it.”
2. “How does FileVault encryption work on a Mac?” / “When you encrypt your information using FileVault, your data remains secure if your Mac is stolen, lost, or accessed without your permission.”
3. “If you don’t have permission to open a file or folder on Mac” / “In the Finder on your Mac, you may be able to change the permissions setting to open the file or folder.”
4. “Turn off FileVault encryption on Mac” / “When you turn off FileVault on your Mac, your data is decrypted. Depending on how much data you have, decryption may take” (visible text ends here).
5. “Share a document as a PDF file on Mac” / “On your Mac, share a document as a PDF file using Mail, Messages, iCloud Drive, and more.”
6. “If you can’t move or copy a file or folder on Mac” / “In the Finder on your Mac, check the permissions setting for the file or folder you can’t move or copy.”

**Dark search order:** If you can’t move or copy a file or folder on Mac; Encrypt Mac data with FileVault; Choose an app to open a file on Mac; Share a document as a PDF file on Mac; If you don’t have permission to open a file or folder on Mac; Turn off FileVault encryption on Mac. Shared descriptions are identical to light. Additional descriptions: “Use FileVault to encrypt the data on your Mac to keep it secure.” and “In the Finder on your Mac, select a specific app to open a file.” The final decryption description is likewise cut after “take” [M].

## Not reproducible / assets needed

Round desert landscape, laptop welcome illustration and Finder result icons are assets [I] (asset requirement); embedded artwork cannot be recovered as editable page content. Exact system-face metrics depend on the host font [I]. Help menu search, menu-item results and floating arrow are **not shown in any assigned screenshot** [M]; consult `menu` and `menu-item` for rendering, but do not claim a position or captured string for an absent menu.

# System Preferences

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-0.png`; `10-15-Catalina-Dark-System-Preferences-0.png` [M].
- **Window:** opaque frame 668 × 554 pt, image bbox x112..1447, y76..1183 (1336 × 1108 image px), both appearances [M]. Unified title bar / navigation toolbar, fixed-width pane navigation [M]. Shadow is outside this frame; reuse `window-shadow` and `window` rather than the PNG canvas dimensions [I: composition rule].

## Layout
All rects below are frame-relative pt, computed by subtracting (112,76) from image coordinates and halving [C]. Evidence refers to the full original PNGs, not the half-scale previews. L0 and D0 in the prose mean the two full filenames above; table citation coordinates apply to both unless an override is stated.

```text
+ traffic lights | < > | Show All | System Preferences | Search +
| avatar  Stephen Hackett                         Apple ID Family |
|         Apple ID, iCloud                                        |
+----------------------------------------------------------------+
| General ... Notifications          first grid row               |
| Internet Accounts ... Security & Privacy   second grid row      |
+----------------------------------------------------------------+
| Software Update ... Mouse          third grid row               |
| Displays ... Startup Disk          fourth grid row              |
+----------------------------------------------------------------+
```

### Painted region bands
| Region / rows | Rect (x,y,w,h) pt | Light | Dark | Tag | Evidence |
|---|---|---|---|---|---|
| Unified chrome incl. bottom two hairlines | (0,0,668,38) | gradient #e5e5e5 → #cdcdcd after top highlights | #424344 → #353637 | [M] colours / [C] rect | L0/D0 column130 rows76..151; top rows76/77 light #f4f4f4/#ebebeb, dark #868787/#767778 |
| Apple ID header | (0,38,668,111) | #ececec | #2f3031 | [M] | L0/D0 @ 130,152 and column130 through373 |
| Header separator | (0,149,668,1) | #d5d5d5 | #434445 | [M] | L0/D0 @ 130,374,1,2 |
| Upper grid band, rows 1 + 2 | (0,150,668,192) | #e5e5e5 (±1 dither) | #353637 | [M] | L0/D0 column130 rows376..759; samples y376,559,759 |
| Grid band separator | (0,342,668,1) | #d5d5d5 | #434445 | [M] | L0/D0 @ 130,760,1,2 |
| Lower grid band, rows 3 + 4 | (0,343,668,211) | #ececec | #2f3031 | [M] | L0/D0 column130 rows762..1183; sample @130,983; dark bottom frame outline occupies final 1 pt |

There are **two grid background bands**, not four alternating colours. Rows 1 and 2 share the entire upper band; rows 3 and 4 share the lower band. No separator, fill change or observable exact boundary exists between rows 1/2 or 3/4 [M: uninterrupted column130]. Do not invent a measured per-row background boundary. For layout only, assign row slots by the measured icon/caption anchors below; an internal midpoint division is an implementation choice [I].

### Unified title / toolbar controls
The light bezel rectangles include painted edges, not the halo/shadow. Dark artwork is inset 0.5 pt in these same allocations [M].

| Item | Rect (x,y,w,h) pt | Tag | Evidence / rendering source |
|---|---|---|---|
| Traffic-light group | (13,12.5,52,12) | [M] | L0/D0 centres image(150,114),(190,114),(230,114), 20 pt pitch; `components/window-controls.md` (disabled zoom, close/minimize enabled) |
| Back / Forward pair allocation | (77.5,7.5,56,23); each half28 wide | [M] | L0 @267,91,112,46; row112 edges267/322,323/378; dark fills268..321,324..377, rows92..135. Both arrows disabled in shell [M]; `components/toolbar-segmented-control.md` |
| Show All grid button | (140.5,7.5,39,23) | [M] | L0 @393,91,78,46; dark fill394..469,92..135; 7 pt clear gap from navigation pair [C]. `components/toolbar-button.md` |
| Title ink bounds | (274,14,120,12.5), centred at334 pt | [M] | L0 @660,104,240,25; title “System Preferences”, 19 px capital height →13 pt regular [C]. `components/title-bar.md`; centre of frame is334 [C] |
| Search field nominal light bezel | (499.5,7.5,161,23); fill160 ×22 | [M] | L0 x1111..1432,y91..136; fill x1112..1431. `components/toolbar-search-field.md` |
| Search focus paint | (497,5,166,28), light; dark visible paint same outer envelope | [M] | L0/D0 x1106..1437,y86..141. Light outer straight ring is 2.5 pt outside nominal edge, plus tinted inner border; dark edge-free base + ring gives slightly different inner allocation [M] |

Title is SF Pro Text Regular 13 pt [C: capitals19 px], with controlTextColor composited through chrome (light glyph samples #484848..#4e4e4e; dark title is a light-grey composite) [M: L0/D0 @650,98,285,37]. Reuse title-bar's alpha recipe, not one glyph-pixel constant [I]. Search is empty and focused in **both** main-window captures; placeholder is “Search” [M]. General and other panes show the same field unfocused [M: General @1106,86,332,56]. Never assign the focused shell ring to every pane. Window title remains centred over the whole 668 pt frame, not the gap between toolbar controls [M: title centre image780 versus frame779.5].

## Components used
`window`, `window-shadow`, `title-bar`, `window-controls`, `toolbar-button` (Show All), `toolbar-segmented-control` (history arrows), `toolbar-search-field`, `account-header`, `preference-pane-icon`, `image-button`, `label`, `separator` [M: shell sightings]. Panes add their own components; common footer uses `help-button` and, only for protected settings, `lock-button` [M: pane examples below].

## App-specific elements
### Apple ID account header
Reuse [account-header](../components/account-header.md) for complete geometry and typography.
- Avatar: image(162,198,128,128), frame-relative(25,61,64,64), circular tennis-ball photograph [M].
- Name ink: image(311,216..217) through(579,250), starts frame x99.5,y70..70.5 pt [M]; computed 19 pt regular from 26..27 px capitals [C, ±0.5 pt font-size inference uncertainty].
- Subtitle: “Apple ID, iCloud”, image(310,261,166,21), starts frame x99,y92.5 [M], 11 pt regular [C: capitals16 px]. Primary text #242424 light / #dfdfdf dark [M: name/subtitle stem palettes].
- Right buttons: Apple ID art image(1152,191,74,74) and Family Sharing(1316,191,74,74), frame(520,57.5,37,37)/(602,57.5,37,37) [M]. They are borderless labelled image buttons, not rounded push-button bezels [M]. Their horizontal centre pitch82 pt matches the grid [C].
- Labels: Apple ID on one line; Family then Sharing on two lines, 14 pt line pitch [M: first ink y283/284, next311]. Secondary colours #767676 / #a1a2a2 [M: label palettes].

### Grid geometry, icon size and captions
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Column centre x, relative to frame | 46,128,210,292,374,456,538,620 | [C] | measured repeated artwork/caption positions in L0/D0: nominal image centres204,368,532,696,860,1024,1188,1352 |
| Column pitch | 82 | [M] | L0 General/Desktop artwork left168/332, Siri art824; header Apple ID/Family art1152/1316 |
| Icon drawing allocation | 40 ×40, **not a measured 32 pt icon** | [I] allocation; [M] artwork bounds | maximum icon width80 image px (Displays @165,1012,80,62; Extensions @1149,599,80,70); General @168,415,74,74 =37 ×37. Shape-dependent extents differ |
| Row icon allocation top y | 167,258,369,460 (40 pt high) | [I] allocation reconstructed from [M] extents | image top candidates410,592,814,996 with artwork inset according to shape; General starts415, Internet Accounts598, Software Update819, Energy Saver999 |
| Caption first cap baselines, rows1..4 | 225,316,427,518 pt (ink-bottom convention) | [M] | L0 General capital ends525, Internet Accounts707, Software Update929, Displays1111; dark within0.5 pt |
| Row pitch | 91, then111 across category separator, then91 | [C] | corresponding first-caption baselines from image526,708,930,1112 |
| Label type | SF Pro Text Regular 12 pt | [C] | General G/l cap18 px; baseline pitch28 px for multiline titles; 12 pt cap table tolerance±1 px |
| Upper captions | #727272 light / #a4a4a5 dark | [M] | 10-15-Catalina-Light-System-Preferences-0.png @ 245,525; 10-15-Catalina-Dark-System-Preferences-0.png @ 245,525 |
| Lower captions / header icon labels | #767676 light / #a1a2a2 dark | [M] | L0/D0 stem palettes @155,911,100,52 and @1141,282,100,35 |
| Two-line line pitch | 14 | [M] | Desktop & / Screen Saver ink y507 and535; Software / Update y911 and939; same dark within0.5 pt |
| Art-to-first-caption gap | shape dependent: General9.5 pt; standard 40 pt canvas-to-cap top9 pt | [M] General / [C] canvas | General artwork last488, first label508 (blank489..507); inferred canvas ends489, caption cap508 |

Centre every line independently; do not left-align the second line. Preserve the explicit line breaks below rather than applying arbitrary wrapping [M]. Labels occupy up to about76 pt of an82 pt column (Screen Saver74 pt); single-line labels remain on the first caption baseline, not vertically centred in a two-line block [M]. Empty eighth cell in the final row remains empty [M]. Icon identities and internal shapes require image assets; their nominal AppKit source resolution cannot be proven from screenshots [I].

## Content in the screenshot
Full ordered pane list, leading to trailing; `/` denotes an actual caption line break [M: L0/D0, upper crop152,410,1260,334; lower152,814,1260,330].

| Row | Ordered captions | Tag |
|---|---|---|
| 1 | General; Desktop & / Screen Saver; Dock; Mission / Control; Siri; Spotlight; Language / & Region; Notifications | [M] |
| 2 | Internet / Accounts; Wallet & / Apple Pay; Touch ID; Users & / Groups; Accessibility; Screen Time; Extensions; Security / & Privacy | [M] |
| 3 | Software / Update; Network; Bluetooth; Sound; Printers & / Scanners; Keyboard; Trackpad; Mouse | [M] |
| 4 | Displays; Sidecar; Energy / Saver; Date & Time; Sharing; Time / Machine; Startup / Disk; empty | [M] |

Header strings: Stephen Hackett; Apple ID, iCloud; Apple ID; Family / Sharing. Toolbar: System Preferences; Search [M]. There is no lock, help button, account-add button or selection outline around a grid pane icon in this main-window capture [M].

### Layout rules shared by panes (measured samples)
Window width remains668 pt, chrome38 pt high [M: `measure.py info` and columns130/900 in General, Bluetooth, Date-and-Time; opaque x112..1447]. Height changes with the selected pane, not a fixed554 pt shell height [M].

| Pane | Frame w ×h pt | Standard content edges | Footer measured placement | Tag / evidence |
|---|---|---|---|---|
| General | 668 ×678 | separators image x152..1407 →20 pt side margins | help image x1367..1406,y1359..1398 →20 diameter, right20.5,bottom16.5 pt; no lock | [M] L/D General frame112,76,1336,1356; help evidence from help-button plus bottom measurement |
| Bluetooth | 668 ×432 | sidebar starts image152; content20 pt left inset | help x1373..1412,y859..898 →right17.5,bottom20.5; Advanced gap13 pt; no lock | [M] L/D Bluetooth frame112,76,1336,864; controls crop1150,858,264,43 |
| Date & Time | 668 ×528 | tab content/group starts image152 →20 pt inset | lock art x163..206,y1041..1095 →left25.5,bottom18; text starts235; help x1367..1406,y1059..1098 →right20.5,bottom16.5 | [M] L/D Date-and-Time frame112,76,1336,1056; footer163,1041,1245,60 |

Thus “standard margins” means the20 pt content inset, **not** a universal20 pt help/footer margin. Footer controls align optically, with pane-specific bottom/right insets [C: examples above]. Lock appears only where settings require authorization; other panes can omit it. Reuse [lock-button](../components/lock-button.md) / [help-button](../components/help-button.md) rather than shifting bitmap artwork to the nominal content edge. Pane titles replace System Preferences, back becomes enabled when there is history, and the Show All button returns to this shell [D: preferences navigation; I: demo history model]. The16 pane blueprints of group sysA are separate files, not repeated here.

## Not reproducible / assets needed
Tennis-ball avatar, every pane icon, Apple ID and Family Sharing artwork need assets (including dark-specific icon images). Their illustration/shadows cannot be recovered faithfully from CSS alone [I]. macOS system settings, Apple ID sign-in, Family Sharing and protected authorization are not available to ordinary browser code [I]. Rebuild navigation and search as demo-owned state; do not imply that clicks configure the host OS. SF fonts use the project system stack; non-Apple platforms will have different text rasterisation [I].

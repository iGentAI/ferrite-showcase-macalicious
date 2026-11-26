# Time Machine browser (`time-machine-browser`)

- **Status:** present
- **AppKit:** Time Machine.app full-screen restore interface hosting a Finder (or app) window
- **HIG:** https://web.archive.org/web/20200503170015/https://developer.apple.com/design/human-interface-guidelines/macos/system-capabilities/finder/
- **Appearances shown:** light, dark

## Purpose and behaviour
"Enter Time Machine" takes over the screen: the current Finder window moves to the centre in front of a receding stack of the same window at earlier backups, over a blurred desktop. The arrows (or the timeline on the right edge) move through backups; the date of the front window is shown between the arrows; Restore copies the selected items back; Cancel leaves. Items that do not exist in the shown backup are dimmed [D] (Apple Support: "Restore items backed up with Time Machine").

## Anatomy
1. Blurred desktop picture (no menu bar, no Dock).
2. Stack of window title bars receding upward behind the front window.
3. Front window: a normal Finder window (inactive-looking traffic lights except close).
4. Up / down arrow buttons and the snapshot date, to the right of the window.
5. Cancel and Restore buttons under the window.
6. Timeline ticks on the right screen edge with date labels.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| front window size | whatever the Finder window was | - | - | 958 x 603 (light), 770 x 436 (dark) |
| Restore | disabled until an item is selected that can be restored | disabled | - | disabled in both |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| browsing, latest backup | yes | 10-15-Catalina-Light-Time-Machine.png; 10-15-Catalina-Dark-Time-Machine.png |
| Restore enabled | no | [I] same fill as Cancel with white text |
| timeline hover (tick magnifies, date label) | no | [D] |
| up arrow disabled (already at the newest backup) | yes (dark: dimmer up button) | 10-15-Catalina-Dark-Time-Machine.png @ 2492,1059,68,68 |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Front window | centred horizontally; light px 722..2637 x 562..1767 (958 x 603 pt); dark px 910..2449 x 728..1599 (770 x 436 pt) | [M] | 10-15-Catalina-Light-Time-Machine.png @ 714,862,14,1; 2631,862,16,1; 1300,1761,1,18; 10-15-Catalina-Dark-Time-Machine.png @ 902,1028,14,1; 2443,1028,16,1; 1300,1592,1,18 |
| Stack of earlier windows | title-bar strips above the front window, each narrower and dimmer; strip tops (light, x=1000) at y=419, 448, 456, 474, 481, 519 px before the front window at 562: steps of roughly 22, 19, 17, 14 pt shrinking by about 0.87 each | [M] strip rows; [C] ratio | 10-15-Catalina-Light-Time-Machine.png @ 1000,362,1,206 |
| Cancel / Restore buttons | each 94 x 29 (Cancel x=1448..1635, Restore x=1712..1899, y=1814..1871), 38 pt gap (76 px), pair centred; top 23.5 pt below window bottom | [M] edges; [C] gap | 10-15-Catalina-Light-Time-Machine.png @ 1440,1842,476,1; 10-15-Catalina-Light-Time-Machine.png @ 1470,1802,1,80; 10-15-Catalina-Dark-Time-Machine.png @ 1470,1634,1,80 |
| Button corner radius | about 4 | [I] | 10-15-Catalina-Light-Time-Machine.png @ 1444,1810,20,20 |
| Arrow buttons | 34 x 34 (up: px 2680..2747 x 1060..1126), left edge 21.5 pt right of the window; down face begins y=1204, 72 pt below up face | [M] up button and down top; [C] offset | 10-15-Catalina-Light-Time-Machine.png @ 2672,1092,90,1; 10-15-Catalina-Light-Time-Machine.png @ 2696,1050,1,251 |
| Snapshot date label | between the arrows, left-aligned with them (ink from px 2681), rows y=1153..1177 | [M] | 10-15-Catalina-Light-Time-Machine.png @ 2681,1153,210,25 |
| Timeline ticks | 2 pt tall (4 px) lines every 16 pt on right edge (y=1766,1798,1830); short ticks 16 pt (x=3328..3359), labelled ticks 36 pt (x=3288..3359) | [M] | 10-15-Catalina-Light-Time-Machine.png @ 3350,1740,1,320; 10-15-Catalina-Light-Time-Machine.png @ 3260,1767,100,1; 10-15-Catalina-Light-Time-Machine.png @ 3260,1799,100,1 |
| Timeline labels | right-aligned ending px 3289 ("Today", "Now", "Yesterday"), rows about 21 px tall | [M] | 10-15-Catalina-Light-Time-Machine.png @ 3210,1758,80,21 |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Background | Day picture heavily blurred and slightly dimmed: `#5e8cb1 (sRGB #518db5)` top-left, `#263d59 (sRGB #203d5b)` bottom-left, `#597289 (sRGB #53728b)` right | Night picture blurred: `#354d73 (sRGB #2f4d76)`, `#27303e (sRGB #25303f)`, `#364d6d (sRGB #304d70)` | [M] | 10-15-Catalina-Light-Time-Machine.png @ 100,100,20,20; 200,1900,20,20; 3000,1000,20,20; dark same |
| Background recipe | `filter: blur(60px)` on the picture + `rgba(0,0,0,0.2)` | same | [I] | by analogy with the Launchpad fit; not fitted |
| Cancel button fill | `#62758c (sRGB #5e758e)`..`#697d93 (sRGB #647d95)` (about `rgba(255,255,255,0.3)` on `#263a50 (sRGB #213a52)`) | `#667184 (sRGB #647186)`..`#6d7888 (sRGB #6b788a)` | [M] composite, [C] alpha | 10-15-Catalina-Light-Time-Machine.png @ 1448,1842,53,1; 1470,1815,1,57; 10-15-Catalina-Dark-Time-Machine.png @ 1448,1674,53,1 |
| Cancel button top edge | 1 px lighter `#899db3 (sRGB #859db5)` | `#8d98a8 (sRGB #8b98aa)` | [M] | 10-15-Catalina-Light-Time-Machine.png @ 1470,1814; 10-15-Catalina-Dark-Time-Machine.png @ 1470,1646 |
| Cancel text | `#f7ffff (sRGB #f5ffff)` | `#f4fdff (sRGB #f2fdff)` | [M] | 10-15-Catalina-Light-Time-Machine.png @ 1501,1832,81,20; 10-15-Catalina-Dark-Time-Machine.png @ 1501,1664,81,20 |
| Restore (disabled) fill / text | `#526171 (sRGB #4f6173)` / `#7b8b9b (sRGB #778b9d)` | `#535d6c (sRGB #515d6e)` / `#828d9e (sRGB #808da0)` | [M] | 10-15-Catalina-Light-Time-Machine.png @ 1730,1842; 1762,1833,89,19; 10-15-Catalina-Dark-Time-Machine.png @ 1730,1674; 1762,1665,89,19 |
| Arrow button fill | `#90a5b9 (sRGB #8ba5bb)`..`#95acc2 (sRGB #90acc4)` | `#5e718b (sRGB #5a718e)`..`#627691 (sRGB #5e7694)` | [M] | 10-15-Catalina-Light-Time-Machine.png @ 2680,1092,27,1; 10-15-Catalina-Dark-Time-Machine.png @ 2492,1092,26,1 |
| Arrow chevron | `#ffffff` | `#899db6 (sRGB #859db9)` (dimmed up arrow) | [M] | 10-15-Catalina-Light-Time-Machine.png @ 2708,1092,5,1; 10-15-Catalina-Dark-Time-Machine.png @ 2519,1092,5,1 |
| Date label | `#e5e8ea (sRGB #e4e8ea)` | `#e1e3e7` | [M] | 10-15-Catalina-Light-Time-Machine.png @ 2681,1153,210,25; 10-15-Catalina-Dark-Time-Machine.png @ 2493,1152,251,25 |
| Timeline tick | `#7b93ad (sRGB #7593b0)` on `#2f4862 (sRGB #284864)` (about `rgba(255,255,255,0.37)`) | `#758194 (sRGB #738196)` on `#293549 (sRGB #26354b)` | [M] composite, [C] alpha | 10-15-Catalina-Light-Time-Machine.png @ 3350,1766,1,6; 10-15-Catalina-Dark-Time-Machine.png @ 3350,1766,1,4 |
| Timeline current-backup tick | `#ec4d3d (sRGB #ff3b30)` (red) | (red tick near y=1637 in the preview) | [M] light; [I] dark position | 10-15-Catalina-Light-Time-Machine.png @ 3350,1990,1,4 |
| Timeline label | `#7c95ad (sRGB #7695b0)` | `#75808f (sRGB #738091)` | [M] | 10-15-Catalina-Light-Time-Machine.png @ 3210,1758,80,21; 10-15-Catalina-Dark-Time-Machine.png @ 3210,1918,80,21 |

### Text and icons
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Button font | 14 pt Regular (cap + ascender 20 px), centred | [C] | 10-15-Catalina-Light-Time-Machine.png @ 1501,1832,81,20 |
| Date label font | 14 pt Regular (25 px with descender) | [C] | 10-15-Catalina-Light-Time-Machine.png @ 2681,1153,210,25 |
| Timeline label font | 12 pt Regular (21 px with descender) | [C] | 10-15-Catalina-Light-Time-Machine.png @ 3210,1758,80,21 |

### Shadows and effects
The front window keeps a window shadow; earlier windows are progressively dimmed toward the background colour.

## Layout and spacing
The front window keeps its size and is centred horizontally; arrows sit at its right, buttons below; the timeline occupies the right 80 pt of the screen from top to bottom, with "Now" at the bottom.

## Keyboard and accessibility
Up/Down arrows move between backups, Command-Shift-click on the timeline jumps, Esc cancels, Return restores when enabled [D]. ARIA: modal `dialog`; timeline as a vertical `slider` with `aria-valuetext` = backup date.

## Browser notes
The receding stack is a set of scaled, translated copies of the window's title bar (or a `perspective` transform); the star-field animation of earlier macOS versions is not used in Catalina (blurred picture only) [M].

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Time-Machine.png | 0,0,3360,2100 | whole browser, "Today at 3:34 PM" |
| dark | 10-15-Catalina-Dark-Time-Machine.png | 0,0,3360,2100 | whole browser, "Yesterday at 10:17 AM" |

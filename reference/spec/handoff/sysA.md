# sysA handoff — buttons, choosers and System Preferences shell

## Counts
- Screenshots: **34 of 34** entries in `coverage/sysA.json`, all `viewed: true`; file was inherited and not rewritten. This continuation also opened all 34 assigned previews, with crops for General, Mouse and Extensions. Counts checked by JSON script [M].
- Component specs: **15 seeded sysA files** (14 inherited + `color-swatch-picker.md`) plus **4 non-seed files** (`account-header`, `preference-pane-icon`, `new-item-dot`, `gesture-option-row`), total **19**. Newly written here: **5**; inherited files changed only in `push-button`, `default-button`, `pop-up-button`, `bevel-button`. The other10 inherited files were read, not rewritten [M].
- Blueprints: **1 written here**, `apps/system-preferences.md` (main shell). The **16 pane blueprints** of this group are separately assigned/written; not duplicated or edited here. Coverage's34 screenshots =2 shell captures +16 pairs [C].
- Handoff: this file, written in the requested create + two append calls.

### Audit and acceptance evidence
Command: `python3 reference/spec/.scratch/sysAfin/audit.py`.

| Existing component | Samples | Final ±2-channel result |
|---|---:|---|
| push-button | 19 | 19 pass |
| default-button | 15 | 15 pass |
| pop-up-button | 17 | 17 pass |
| help-button | 7 | 7 pass |
| gradient-button | 7 | 7 pass |
| bevel-button | 5 | 5 pass |
| image-button | 2 | 2 pass |
| disclosure-triangle | 2 | 2 pass |
| lock-button | 2 | 2 pass |
| pull-down-button | 6 | 6 pass |
| combo-box | 6 | 6 pass |
| segmented-control | 3 | 3 pass |
| round-button / disclosure-button | 0 /0 | not seen; no [M] samples exist |
| **Total** | **91** | **91 pass,0 fail** |

Initial pass had87 passing samples and4 mismatches. Targeted fixes:
1. Pop-up light cap's `#4b89f5 (sRGB #3987fd)` is row433, not434 (`#4887f6 (sRGB #3585fe)`); corrected cap-width/separator/edge citations in `components/pop-up-button.md`, Geometry and Colours.
2. Dark pop-up gradient endpoints at column923 intersect the rounded right corner: row414 was`#30363f (sRGB #2f3640)`, row451`#242b38 (sRGB #232b39)`. Correct straight-column evidence is x899, giving`#6998e8 (sRGB #5d97ef)`/`#2960c6 (sRGB #155ecd)`. Corrected the citation, not the valid gradient colours.
3. Dark Print bevel off-edge at1014,572 is`#5e635f (sRGB #5d635f)`, not`#606061`. Updated the cited value and called out backdrop dependence in `bevel-button.md`.
4. Additional source corrections: push-button small padding now states the actually cited7.5..15 /9..18.5 pt range; default-button font-size provenance changed to[C]; its claimed two-stop gradient equivalence removed (about4 levels of error, exceeding±2).

Required command executed verbatim:
`python3 reference/spec/tools/build.py verify push-button default-button help-button gradient-button bevel-button round-button image-button disclosure lock-button pop-up-button pull-down-button combo-box segmented-control color-swatch`

Final: **46 single-pixel citations checked,46 reproduce within±3,0 mismatches,0 missing files**. It initially checked0 because abbreviated names and multi-citation lines are skipped; added unambiguous Pixel audit citations to the four corrected inherited files. This checker uses±3 internally; the91-sample independent audit uses the stricter requested±2. Neither is an exhaustive geometry/state validator. Additional check of shell/new-id files:4 single-pixel citations,4 pass,0 mismatch,0 missing. Five new component files passed required-section checks. No mocks, fake captures or substitute dependencies used: pixels came from original PNG bytes through Pillow; no colour-space conversion.

Acceptance: requested chooser measurements, shell blueprint, missing-new-id files, token/inference handoff and≥30-sample audit delivered. Visible-dark new-item-dot state cannot be measured because that state is absent; explicitly marked[I], not fabricated.

## New components
Script compared coverage IDs and component references with `.scratch/brief/seed.json`. Only the four coverage IDs below are new UI components. Additional regex hits `aria-checked`, `aria-disabled`, `aria-expanded`, `aria-pressed`, `background-clip`, `border-color`, `box-shadow` are web attributes/properties, not inventory additions.

| id | Apple/descriptive name | Owner family | Spec exists? |
|---|---|---|---|
| preference-pane-icon | Preference pane icon / image button | sysA, specialised image-button | yes, `components/preference-pane-icon.md` |
| account-header | Account header (app-specific; no claimed Apple public control name) | sysA / System Preferences composition | yes, `components/account-header.md` |
| new-item-dot | New-item indicator (meaning inferred, no proven Apple API name) | indicator family; sysA supplies discovered instance | yes, `components/new-item-dot.md` |
| gesture-option-row | Gesture option row / tutorial callout (app-specific) | sysA / System Preferences composition | yes, `components/gesture-option-row.md` |

`color-swatch-picker` is already seeded; not a new ID. None of these four existed when continuation began. Dark Extensions was sampled and viewed: its corresponding dot location is uniform`#1d1e1f`; it has different item content. Do not interpret absence as a Dark Mode suppression rule.

## Token candidates
All dimensions pt. All hex colours are **stored** PNG values; lead's mechanical sRGB annotation remains necessary for chromatic values. Evidence below names the component's measured table and, where useful, the full source/crop. Inherited short filename aliases are defined at the tops of those specs. Alpha recipes are[C] derived from[M] composites, not independent raw-pixel measurements. States not captured remain[I] even when they borrow a measured recipe.

### Rounded buttons and default/accent controls
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| control.bezel.height.regular | 20 | 20 | [M] | push-button Geometry; Bluetooth x1162,y859..898 |
| control.bezel.height.small | 17 | 17 | [M] | push-button Geometry; Apple-ID x1222,y271..304; Date-and-Time small button |
| control.bezel.height.mini | 14 proposed | 14 proposed | [I] | push-button mini not captured; segmented mini measured separately |
| control.bezel.paint.height.regular | 21.5 | 21.5 | [M] | halo859−1, bottom898+2 in Bluetooth |
| control.bezel.edge.width | 0.5 | 0.5 | [M] | push-button row880,x1151 |
| control.bezel.radius.regular-small | 3.75 (outer edge of the border; lead re-fit, was 4) | 3.75 | [C] | push-button corner grids; Bluetooth1149,857,12,12; Date-and-Time941,893,12,12. The library token adopts 3.5px as an implementation choice, not a measurement (tokens.md, "Control radius") |
| control.bezel.fill | #ffffff | #646465 window /#686869 box /#565657 list | [M] | push-button Colours; Bluetooth1200,880; Keyboard760,1062; Apple-ID1223,283 |
| control.bezel.fill.alpha | opaque white | white0.25 | [C] | push-button composites above |
| control.bezel.highlight.rows | none | #838383,#6a6a6a, each0.5 | [M] | Dark Bluetooth1162,860/861 |
| control.bezel.edge.top | #c8c8c8 window /#c0c0c0 box /#d8d8d8 white | #2c2c2d window | [M] | push-button Colours top-edge samples |
| control.bezel.edge.side | #c1c1c1 /#b9b9b9 /#d0d0d0; #b7b7b7 on#e0e0e0 | #2a2a2b /#2f2f30 /#191a1b | [M] | push-button side-edge table |
| control.bezel.edge.bottom | #aeaeae /#a7a7a7 /#bcbcbc | #262627 /#2b2b2c | [M] | push-button bottom-edge table |
| control.bezel.edge.alpha.top-side-bottom | black0.153/0.184/0.263 | black0.083/0.125/0.21 | [C] | recovered from push-button backgrounds/composites |
| control.bezel.disabled.fill | #f1f1f1 box /#f6f6f6 window | #4f4f50 box /#4a4a4b window; top#5e5e5f,#525253 | [M] | Energy-Saver1200,926/1131,926; push-button table |
| control.bezel.disabled.fill.alpha | white0.5 | white0.125 | [C] | push-button disabled composites |
| control.bezel.disabled.edges | #d2d2d2/#cdcdcd/#c5c5c5 on box | side#323334,bottom#303031 | [M] | Energy-Saver1130,906..948;1119,926 |
| control.bezel.disabled.edge.alpha | black0.075/0.097/0.132 | source composites above | [C] | push-button disabled-edge derivation |
| control.title.regular/small | SF Pro Text Regular13/11 | same | [C] | Bluetooth19px caps; Apple-ID16px caps |
| control.title.mini | SF Pro Text Regular9 | same | [D] | push-button NSFont size API |
| control.title.baseline.regular/small | 14.5 /12.5 below top edge | same | [M] | Bluetooth y869..887; Apple-ID280..295 |
| control.title.normal | #262626 on white | #e8e8e8 on normal fill | [M] | Bluetooth1315,886 |
| control.title.normal.alpha | black0.85 | white0.85 | [C] | push-button fill and stem colours |
| control.title.disabled | #b5b5b5 box /#b8b8b8 window | #7b7b7c box /#777778 window | [M] | Energy-Saver1347,933; Sidecar395,640 |
| control.title.disabled.alpha | black0.25 | white0.25 | [C] | source composites above |
| control.padding.regular.visible | leading13.5..14.5; trailing14.5..15.5 | same | [M] | push-button Advanced, Turn Bluetooth Off, Next glyph bounds |
| control.padding.small.visible | leading7.5..15; trailing9..18.5 | same layout | [M] | Keep Both /Date-and-Time title-to-edge runs |
| control.padding.titlebox/min-width | 14 each /56 floor | same | [I] | push-button intrinsic sizing inference, title width+28 |
| control.widths.regular.seen | 56,69,83,98,140,202 | geometry follows title/layout | [M] | push-button widths table (Next,OK,Cancel,Advanced,Turn Bluetooth Off,Set Up Bluetooth Keyboard) |
| control.halo.width | 0.5 | 0.5 | [M] | Bluetooth1150,880;1162,858 |
| control.halo.composite | #e6e6e6 window /#dddddd box /#f8f8f8 white | #2f2f30 | [M] | push-button Shadows |
| control.halo.alpha | black0.027 | black0.02 | [C] | above composites |
| control.shadow.rows | #d0d0d0/#e3e3e3 window;#c8c8c8/#dadada box;#e1e1e1/#f5f5f5 white | #2b2b2c/#2e2e2f | [M] | Bluetooth1162,899/900; push-button Shadows |
| control.shadow.alpha.rows | black0.118/0.039 | black0.104/0.042 | [C] | push-button recovered shadow rows |
| control.shadow.recipe | halo0.5; y0.5 alpha.118; y1 blur.5 alpha.039 | y0.5 alpha.10;y1 blur.5 alpha.04; inset white.20/.04 | [C] | push-button fitted CSS table; keep asymmetric border recipe |
| button.gap.dialog/alert/small | 13 /15 /9 | same | [M] | Go-To-Folder736→763;Empty-Trash654→685;Copy-Replace508→527 |
| button.margin.dialog/pane | 20.5 side/bottom; Hot Corners20.5 | same | [M] | Go-To-Folder928→969,326→367; Mission-Control153→112,994→1035 |
| button.gap.help | 13 | 13 | [M] | Bluetooth1346→1373; Keyboard1334→1361 |
| button.pressed.recipe | default/accent gradient,white title | dark accent gradient−10% | [I] | push-button States; not captured |
| default.gradient.blue.stops | 0%#77a6f4 (sRGB #6ca6fb);27%#6499f5 (sRGB #5698fc);51%#4b89f5 (sRGB #3987fd);76%#3579f6 (sRGB #1c77ff);100%#286ef6 (sRGB #076bff) | 0%#6998e8 (sRGB #5d97ef);3%#3874df (sRGB #2472e7);5%#2e6bde (sRGB #1869e6);22%#2d6ada (sRGB #1668e2);51%#2c66d2 (sRGB #1764da);81%#2a62ca (sRGB #1660d1);100%#2960c6 (sRGB #155ecd) | [M] | default-button Colours/Pixel audit; Light Go-To-Folder776,288..325; Dark Empty-Trash699,302..339 |
| default.edge.top/side/bottom | #5b93f3 (sRGB #4c92fa)/#3b7bf4 (sRGB #2679fd)/#2165f6 (sRGB #0361ff) | #29292a/#272728/#232324 on window; side#2c2c2d on box | [M] | default-button Colours |
| default.title | #ffffff | #e0e9f9 (sRGB #dee9fb) over#2c66d2 (sRGB #1764da) | [M] | Family-Sharing1324,661,53,19 |
| default.title.alpha | white1 | white0.85 | [C] | same fill/stem samples |
| default.widths.seen | 56,69,77,79,83,91,113 | same layouts | [M] | default-button Widths table |
| default.pressed | accent stops−12% | accent stops−12% | [I] | default-button States |
| default.disabled/inactive | disabled/normal non-accent rounded recipe respectively | same distinction | [I] | default-button States |
| help.diameter/paint | 20 /21 ×21.5 | same | [M] | Bluetooth1373..1412,859..898;halo+shadow |
| help.radius | 10 | 10 | [C] | measured20 diameter/2 |
| help.glyph.bounds | 6.5 ×11; inset7,4.5 | same | [M] | Bluetooth1387,868,13,22; dot886..889 |
| help.glyph.type/stroke | SF Pro Text Medium13;1.5 stem | same | [C] | help-button coverage mask row880 |
| help.edge.top/side/bottom | #cacaca/#c3c3c3/#b0b0b0 | #2c2c2d/#2b2b2b/#262627 | [M] | help-button Colours |
| help.fill/highlight/glyph | #ffffff /none /#262626 | #646465 /#818182,#6a6a6b /#e7e7e7 | [M] | help-button Colours |
| help.shadow.rows | #d2d2d2,#e4e4e4 | #2b2b2c,#2e2e2f | [M] | Bluetooth1393,899/900 |
| help.margins.seen | right15.5..23.5,bottom20.5 typical; General/Date bottom16.5 | same | [M] | help-button Layout plus shell footer probes |
| help.pressed/disabled/focus | fill#f0f0f0 (the shared --mac-bezel-fill-pressed; #e5e5e5 until 3 October 2026, a superseded inference) /rounded disabled /3pt circular ring | fillwhite.36 (white.35 until 3 October 2026) /rounded disabled /3pt ring | [I] | help-button States |

### Other buttons, disclosure and lock
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| gradient.cell.fill-width/height/border/radius | 23..24 /19 /1 /0 | same | [M] | gradient-button Geometry; Language-and-Region192..241,892..933 |
| gradient.fill.stops | #f9f9f9→#f7f7f7→#f3f3f3 | #3c3c3c flat | [M] | gradient-button x210,y894..931 |
| gradient.border.outer/divider | #b4b4b4/#b7b7b7 | #7f7f7f both | [M] | gradient-button Colours |
| gradient.glyph.size/stroke | plus11×11,minus11×1;1pt square ends | same | [M] | Desktop-and-Screen-Saver190,1048,22,22;242,1058,22,2 |
| gradient.glyph.enabled/disabled | #262626/#b9b9b9 | #e1e1e1/#6d6d6d | [M] | Language-and-Region215/260,913 (dither±1) |
| gradient.pressed/toggle | #d9d9d9 | #5a5a5a | [I] | gradient-button States; hold for toggle |
| gradient.attachment.gap | 0 (shared list border) | 0 | [M] | Internet-Accounts x170,y965..967 |
| gradient.network-variant.fill / top / bottom-sides / dividers / glyph | #fafafa→#f7f7f7→#f5f5f5 / #b4b4b4 / #b4b4b4 / #b4b4b4 / #252525 | #4e4f50→#4b4c4c→#48494a / #808080 / #636465 / #8a8b8c / #e4e4e4 | [M] | gradient-button Colours, Network pane rows; one pane only, cause of the difference not established; the four-capture recipe above stays the default |
| bevel.size/border/radius/gap | 38×38 /1 /0 /12 |38×38,offborder1/onno distinct border /0 /12 | [M] | bevel-button Geometry/Colours; Print1000,582,76,76; dark914,552,76,76 |
| bevel.border | #afafaf, citedpixel#afafb0 | off#5e635f (sRGB #5d635f) material sample | [M] | bevel-button Pixel audit; Print1000,600;Dark1014,572 |
| bevel.fill.off | #e2e2e2→#ededed30%→#f2f2f260%→#f7f7f6 | #414042→#46464750%→#494a4b | [M] | bevel-button x1104/1020 fill columns |
| bevel.fill.on | #c4c4c4→#cbcbcb30%→#d2d2d260%→#dbdbdb | #8a8b8b flat (sample#8a8c8b) | [M] | bevel-button x1004/920 fill columns |
| bevel.image/disabled | centred18×25 approx /imagealpha.25 | same | [I] | bevel-button unmeasured image bounds and disabled state |
| round.diameters | 20/17/14 | same | [I] | round-button not seen; help/rounded analogy |
| round.glyph/layout | ≤11×11,primary.85;13pt neighbour gap | same | [I] | round-button inferred Measurements/Layout |
| image.pane.art/pitch | General37×37;nominal40 allocation /82 | same | [M] art/pitch | image-button Geometry; shell168/332,415 |
| image.pane.nominal-size | 32×32 asset presumed;40cell | same | [I] | image-button original nominal inference; do not promote32 to measured geometry |
| image.caption.type/line-pitch | Regular12 /14 | same | [C] type | image-button Geometry; measured18px caps/28px line pitch |
| image.caption.colours | #727272 upper,#767676 lower | #a4a4a5 upper,#a1a2a2 lower | [M] | image-button plus shell label palettes |
| image.header.art/caption-gap | 37×37 /9.5 | same | [M] | shell1152,191,74,74;Apple ID caption284 |
| image.provider.row/width/pitch | 54 /410 /56 incl2pt divider | same | [M] | image-button Internet-Accounts row dividers384..387,496..499... |
| image.provider.logo-height | 24..37 | 24..37 | [M] | image-button iCloud879,302,246,50;Exchange848,410,301,66;Google889,522,233,74 |
| image.provider.divider/title | #cdcdcd /#232323 Regular13 | #4a4a4b /primary text | [M] light title | image-button provider row table |
| image.hit-padding | at least5pt at2x (HIG10px) | same | [D] | archived HIG Image Buttons; exact hit bounds invisible |
| image.pressed/disabled | black.3 overlay /opacity.5 | same | [I] | image-button States |
| disclosure.button.size/radius/gap | 20×20 body,21×21frame /4 /8tofield | same | [I] | disclosure-button not seen; inferred Save layout |
| disclosure.button.chevron | 7.5×4.5,stroke1.2;M7,8.5 L10,11.5 L13,8.5 (reverse expanded) | same,lightprimary/darkprimary | [I] | disclosure-button fitted single-chevron reuse |
| disclosure.button.pressed | fill#f0f0f0 (the shared --mac-bezel-fill-pressed; "fill−10%" until 3 October 2026, a superseded inference) | fillwhite.36 | [I] | disclosure-button States |
| disclosure.triangle.expanded/collapsed | 9×7.5 /7.5×9 | same | [M] | Desktop-and-Screen-Saver193,501,18,15;195,619,15,18 |
| disclosure.triangle.paths | down M0,0 H9 L4.5,7.5 Z;right M0,0 L7.5,4.5 L0,9 Z | same | [C] | disclosure-triangle masks |
| disclosure.triangle.normal | #808080 list;#8c8c8c header | #99999a list;#7c7c7c header | [M] | disclosure-triangle Colours; header delegated inspector-panel |
| disclosure.triangle.alpha | black.50 | white.55 | [C] | measured list background/stems |
| disclosure.triangle.indent/text-offset/row-pitch | 8.5 /13 /20 | same | [M] | disclosure-triangle positions table |
| disclosure.triangle.hit/animation | 13×13 /about.1s | same | [D] | disclosure-triangle AppKit assertions; not pixels |
| disclosure.triangle.selected/disabled/pressed | white /.5alpha /label colour | same | [I] | disclosure-triangle States |
| lock.art.size/left/bottom | 22×27.5 /25.5 /18 | same | [M] | Date-and-Time163,1041,44,55,frame112,76..1131 |
| lock.text.gap/baseline-position | 14 after art;descender3pt aboveartbottom | same | [M] | Date-and-Time235,1066,381,24 |
| lock.text.type | Regular13 | same | [C] | lock-button cap/descender bounds |
| lock.text.colour | #767676 | #a1a2a2 | [M] | Date-and-Time614,1084 |
| lock.face/edges | #f4ca7f (sRGB #fbc972);#ecb866 (sRGB #f5b755),#cb8f46 (sRGB #d58d33),#ac6c2d (sRGB #b66917);outline#723411 (sRGB #7b3000) | same bitmap | [M] | lock-button row1075,x163..206 |
| lock.shackle | grey,white highlight#ffffff | same bitmap | [M] | lock-button palette163,1041,44,55 |

### Pop-up, pull-down and combo-box metrics
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| popup.body.regular/small/mini | 20 /17 /14inferred | same | [M] regular/small | pop-up-button Geometry; mini is[I], not a measured third size |
| popup.radius/title-inset | 3.75 (fit; 4 as a grid reading) /9.5visible (9titlebox) | same | [C] radius; [M] inset | General corner grids611,411,12,12; title632vsedge613 |
| popup.cap.regular/small | 16fill+.5edge /14fill+.5edge | same fill widths,outlineoutside | [M] | General878..910;Get-Info582..610;dark894..926 |
| popup.cap.gradient | default.blue stops,0/27/51/76/100% | #6998e8 (sRGB #5d97ef),#3874df (sRGB #2472e7),#2e6bde (sRGB #1869e6),#2c66d2 (sRGB #1764da),#2960c6 (sRGB #155ecd) | [M] | pop-up-button Colours; dark straightcol899 corrected |
| popup.cap.edges | #5b93f3 (sRGB #4c92fa)/#3b7bf4 (sRGB #2679fd)/#2165f6 (sRGB #0361ff) | #28292a/#262728/#232324 | [M] | General895,413;910,433;899,452;dark910/926 |
| popup.title-area/highlight | rounded white/edge/halo/shadows | #636465,#828383,#696a6a on#2f3031 | [M] | pop-up-button Colours;x626/627,y412..454 |
| popup.chevron.regular/small | bounds7.5×12 /6.5×10;each7.5×4.5 /6.5×4;gap3 /2 | same | [M] | General887,421,15,24;Get-Info590,1184,13,20 |
| popup.chevron.stroke/paths | 1.2regular,1.1small;regular apex8.25,4.95 and8.25,15.05;arms±3 | same | [C] | pop-up-button path/mask tables; boundsx4.5..12,y4..16 |
| popup.chevron.colour | #ffffff | #dee8f9 (sRGB #dce8fb) over#2d6adb (sRGB #1668e3) | [M] | General895,423;dark910,422 |
| popup.disabled.fill/edge/chevron | #f1f1f1box,#f6f6f6window;side#cfcfcf/#d6d6d6;glyph#919191 | #4f4f50box,#4a4a4cwindow;side#323334;glyph#7b7b7c | [M] | pop-up-button disabled Colours;Desktop-and-Screen-Saver/Calendar Preferences |
| popup.disabled.chevron.alpha | black.40 | white.25 | [C] | disabled mask/fill composites |
| popup.chip.size/offset/gap | 24×12,.5edge;8.5fromedge;text5after | same | [M] | General630..677 title chip;accent-colors24×12 measurement |
| popup.chip.fill/edge | #b9d6fc (sRGB #b3d6ff)/#8ca2bd (sRGB #87a2c0) | #466388 (sRGB #3f638b)/#7489a6 (sRGB #6f89a9) | [M] | pop-up-button General row434,630..677 |
| popup.title.icon-height | 16 | 16 | [M] | Safari image General630,922,108,32 |
| popup.title.font/baseline | Regular13/14.5;small11/12.5 | same | [C] font | popup text glyphs,baseline[M] in source |
| popup.widths.seen | 64.5,80,85.5,106.5,149,161,204,234 | General157 (fill156);otherslayout-dependent | [M] | pop-up-button Widths table |
| popup.label-gap/pitch | 9.5;stack32 General,31 Language & Region,28 Mission Control | same | [M] | pop-up-button Layout |
| popup.inline.gaps | 7 before/after | same | [M] | Keyboard720→735,894→909 |
| popup.pressed/inactive | cap−12% /untinted normalcap | same,white.25 inactive | [I] | pop-up-button States |
| pulldown.cap/body/title-inset | 16+.5 /20 /9.5 | same | [M] | pull-down-button Print Geometry |
| pulldown.chevron.bounds/path | 7.5×4.5;originx4.5,y8;M5.25,8.55 L8.25,11.55 L11.25,8.55;stroke1.2 | same | [C] path | pull-down-button mask;bounds[M] Print338,977,15,9 |
| pulldown.widths.seen | PDF57;NoDevices101 | same layouts | [M] | pull-down-button Geometry |
| pulldown.print.fill/edges | white;#97a4b2 (sRGB #94a4b4),#8f9ead (sRGB #8c9eaf),#838e9c (sRGB #818e9d) material edges | #636f80 (sRGB #606f82) fill,#828c99 (sRGB #808c9a) highlight,#2c3750outline | [M] | pull-down-button Print sheet samples |
| pulldown.print.glyph/title | #ffffff/#262626 | #dee8f7 (sRGB #dce8f9)/#e8eaed | [M] | pull-down-button Print glyph/title citations |
| pulldown.disabled.fill/edges | #f6f6f6;#d9d9d9/#d6d6d6/#cdcdcd | #4a4a4b;#2d2d2e,#59595a/#4d4d4e highlight | [M] | Sidecar col388/387,y618..657 |
| pulldown.disabled.title/chevron | #b8b8b8/#969696 | #777778 both | [M] | Sidecar395,640;557,638 |
| pulldown.action.segment/gear/gap | 41×20 /14×14,8inset /4tochevron | dark not measured | [M] | Connect-to-Server266..347;gear282..309,462..489 |
| pulldown.heavy.chevron | 7×4.5,strokeabout1.75 | same geometry | [M] | Action318,473,14,9;Mouse442,412,14,9 |
| pulldown.borderless.font/gap | Regular11 /3aftertext | same geometry | [C] font | Mouse243,406,213,22;gap[M] |
| pulldown.borderless.disabled | #9d9d9d..#a3a3a3 | not measured | [M] light | pull-down-button Mouse row417 |
| pulldown.print.gaps | help13left;HideDetails9right | same | [M] | Print221→248,361→380 |
| combo.height/cap/divider | 20 /16+.5 /.5 | same | [M] | combo-box Go-To-Folder and Date-and-Time Geometry |
| combo.chevron.bounds | 7.5×4.5,insetx5,y8 | same | [M] | Go-To-Folder904,223,15,9;Date-and-Time1234,311,15,9 |
| combo.radius.field/button | about1 /3.5..4 | same | [I] | corners under focus ring,unresolved |
| combo.focus-width/text-inset | 2.5outsideedge /4.5firstink | same | [M] | Go-To-Folder148..153 ring;162text |
| combo.widths.seen | 388/445/275 | same | [M] | Go-To-Folder/Connect-to-Server/Date-and-Time |
| combo.fill.enabled | #ffffff | #3a3a3b;top#363637/#373737 | [M] | combo-box Colours |
| combo.cap.enabled | #75a4f4 (sRGB #6aa3fb)→#4d8af5 (sRGB #3b89fd)→#296ef6 (sRGB #0b6bff);edges#407eee (sRGB #2d7cf6)/#2368f0 (sRGB #0164f9) | #3773df (sRGB #2371e7),#2f6cde (sRGB #196ae6)→#2b66d3 (sRGB #1564db)→#2960c7 (sRGB #155ece);highlight#5a9ff0 (sRGB #439ff7) | [M] | focused combo colours (focus alters edges) |
| combo.divider/chevron | #467fe3 (sRGB #357eea)/#ffffff | #2f2f30/#dee8f7 (sRGB #dce8f9) | [M] | Go-To-Folder894,227;911,229;dark893,227;908,227 |
| combo.focus.colours | #89abeb (sRGB #82abf1),edge#6b8dcd (sRGB #638cd2) | #3e6c94 (sRGB #2f6c98),edge#47759e (sRGB #3975a2) | [M] | combo-box focus row227 |
| combo.disabled.fill | #f1f1f1 | #3a3b3c | [M] | Date-and-Time1100,300/304 |
| combo.disabled.edges/topshade | top#c7c7c7,left#c8c8c8,right#cbcbcb,bottom#c6c6c6;shade#e9e9e9 | top#3f4040,left#3f3f40,bottom#4d4d4e | [M] | combo-box disabled-edge table |
| combo.disabled.divider/button/glyph/text | #e1e1e1/#f1f1f1/#919191/#b4b4b4 | divider/buttonnotresolved;text#6b6b6c | [M] | combo-box Date-and-Time measurements |
| combo.normal.text/type | #262626 measured /Regular13 inferred | white.85 inferred | [I] type/dark | combo-box Text table;lightcolour[M] |
| combo.margins/label-gap |20.5side;labelabove10.5baseline;checkboxlabelgap9.5 | same | [M] | combo-box Layout |

### Segmented controls
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| segment.height.regular/mini/radius | 20/14/3.75 (radius fitted in light; 4 as a grid reading) | regular20/radius not fitted in dark, taken as light;minidarknotmeasured | [M]; [C] radius in light; [I] radius in dark | segmented-control Geometry |
| segment.divider.width/colours | 1 /#e5e5e5 | 1 /#585859;top#717172/#5d5d5d | [M] | Desktop-and-Screen-Saver226,1040..1077 |
| segment.icon.widths/wholepair |24,27,41 /50pair | same layouts | [M] | segmented-control Geometry |
| segment.separated.widths/gap |23,67,23 /1 | not captured | [M] light | Screen-Time1155..1200,1203..1336,1339..1384 |
| segment.mini.widths/control |32each,1divider /66 | not measured | [M] light | Print280..411,y872 |
| segment.fill/highlights |#ffffff | #686869 onbox;#868687/#6e6e6f top | [M] | segmented-control Colours |
| segment.edge/shadow |#c0c0c0/#b9b9b9/#a7a7a7;#c9c9c9/#d9d9d9 shadows |#313132/#2f2f30/#2b2b2c | [M] | Desktop-and-Screen-Saver190,1038..1080 |
| segment.glyph.enabled/disabled |#262626/#bfbfbf |#e8e8e9/#8e8e8e | [M] | Desktop-and-Screen-Saver200/250,1059 |
| segment.separated.edge/shadow/disabled |#d8d8d8/#d4d4d4/#bcbcbc;#e1e1e1shadow;#e9e9e9disabledside |not shown | [M] light | segmented-control Screen-Time samples |
| segment.mini.sheet.edge |#97a6b6top,#858f9ebottom |not measured | [M] light | Print290,869/896 |
| segment.list-gap/left-inset |7.5belowlist /20.5windowleft | same | [M] | segmented-control Layout |
| segment.text.padding |10eachside,fitwidesttitle |same | [D] | segmented-control AppKit distribution assertion |
| segment.text.font/baseline |Regular13 /14.5 |same | [I] | outside tab-view not measured |
| segment.selected/pressed/inactive | tab-view accent /default accent /greys when inactive |same | [I] | segmented-control States |
| segment.contacts.custom |212×20,.5edge#e5e5e5;selected#f5f5f5,offwhite;selectedtextblack,off#262626 |not measured | [M] light | Contacts1173,246,424,40;not system style |

### Choosers, shell and newly discovered patterns
| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| swatch.diameter/pitch/ring/dot |16 /24 /1effective /5 |same | [M] | color-swatch-picker Geometry;General614,354,32,32;row369 |
| swatch.fills.Blue..Graphite |#2f7cf7 (sRGB #027aff),#8a4592 (sRGB #953d96),#e55d9d (sRGB #f74e9f),#ce4645 (sRGB #df373e),#e8873a (sRGB #f7821c),#f2b94b (sRGB #fcb828),#78b757 (sRGB #62ba47),#979898 |#2f7cf7 (sRGB #027aff),#9b57a3 (sRGB #a650a7),#e55e9c (sRGB #f7509e),#ed5f5e (sRGB #ff5258),#e8873a (sRGB #f7821c),#f3b94b (sRGB #fdb828),#78b756 (sRGB #62ba46),#8d8c8d | [M] | General x618+48k,y369;all agree±2 with accent-colors selected matrix |
| swatch.rings.Blue..Graphite |#2564c5 (sRGB #0262cc),#6f3775 (sRGB #783179),#b64b7d (sRGB #c5407f),#a63838 (sRGB #b42c33),#b96d2e (sRGB #c56917),#c2943c (sRGB #ca9321),#5f9345 (sRGB #4c9638),#7a797a |#5897f8 (sRGB #4596ff),#ae79b5 (sRGB #b874b9),#ea7faf (sRGB #fa76b1),#f07f7e (sRGB #ff777a),#eca061 (sRGB #f89d53),#f5c76f (sRGB #fdc65e),#93c677 (sRGB #83c96d),#a3a3a3 | [M] | General x615+48k,y369 |
| swatch.dot |#ffffff |#ffffff±1 | [M] | General630,369 |
| appearance.image/pitch/ring-size/width |67×44 /86 /70×47 /1.5 |same | [M] | General615,188,134,88;612,185,140,94;darkring784,185 |
| appearance.ring.radius |6 (fit on the outer edge; grid reading was5.5±.5) |same | [C] | General corner grids612/784,184,14,14; corner_fit rms1.7 |
| appearance.image.radius |grid reading4.5..5, not fitted; 4.5 to build with (4 before 3 October 2026, tagged [C] as ring5.5−ring width1.5, when the ring was a5.5 grid reading) |same | [M] grid reading; [I] 4.5 to build with | inner arc x615→624..625 on General corner grids; 6−ring1.5 only if the inner edge is concentric, which the whole-corner fit does not support |
| appearance.ring.colour/unselected-border |#2f7cf7 (sRGB #027aff) /#dadada.5pt |#2f7cf7 (sRGB #027aff) /#2b2c2d.5pt | [M] | General613/786,232;dark785/614,232 |
| chooser.label.caption |Regular13;#242424 |Regular13;#dfdfdf | [C] type | color-swatch-picker text;19px caps;colours[M] |
| chooser.caption.offset/label-gap |cap8.5ptbelowimage;ring9.5,label-to-swatch10.5 |same | [C] | image275→cap293;label592→ring612/swatch614 |
| chooser.label.align |rightedge240.5frame;Appearancebaseline97,Accent151 |same | [C] | General imagecolon592;baselines270/378;frame112,76 |
| shell.width/height/chrome |668 /554 /38 |same | [M] | System-Preferences-0 opaque112,76,1336,1108;content152 |
| shell.band.header/upper/lower |111 /192 /211;#ececec/#e5e5e5/#ececec |sameheight;#2f3031/#353637/#2f3031 | [M] | shell column130;bands152..373,376..759,762..1183 |
| shell.separator.height/colours |1 /#d5d5d5 |1 /#434445 | [M] | shell130,374 and760,2pxruns |
| shell.grid.pitch/label-type/line-pitch |82 /Regular12 /14 |same | [C] type | shell art168/332;cap18px;two-line28pxpitch |
| shell.grid.row-pitches |91 /111 /91 |same | [C] | first caption baselines526,708,930,1112imagepx |
| shell.content.margin/footer-gap |20 content;help right15.5..23.5,bottom16.5..20.5 |same | [M] | shell three-pane footer table;not a universal20ptfooter |
| account.avatar/header/buttons |64circle /668×111 /37×37 |same | [M] | account-header162,198,128,128;band112,152,1336,222;buttons1152/1316,191 |
| account.name/subtitle/caption |Regular19±.5 /11 /12 |same | [C] | account-header cap26..27/16/17..18px |
| account.text.primary/secondary |#242424/#767676 |#dfdfdf/#a1a2a2 | [M] | account-header name/destinationstem palettes |
| account.gaps/pitches |avatar-to-name10.5;name/subtitle17;destination82;caption14 |same | [C] | account-header coordinate differences |
| new-item.dot.diameter/fill |6 /#3583f7 (sRGB #0c81ff) |visible-darknotcaptured | [M] light | Extensions664,886,12,12;670,892 |
| new-item.dot.radius/dark-fallback |3 /n/a |3 /sameblue proposed | [I] dark | new-item-dot;light radius[C],dark absence[M] |
| gesture.callout.bounds/radius/border |311×53 /5±.5 /.5 |samebounds/radius;nodistinctborder | [M] | Mouse172,250,622,106;corner170,248,14,14 |
| gesture.callout.fill/edge/highlight |#f0f0f0 /#b8b8b8..#b9b9b9 /#feffff |#676768..#686868 /none /none | [M] | Mouse180,260;220,250/251 |
| gesture.type.primary/detail |Regular13 /11 |same | [C] | Mouse19/16pxcaps |
| gesture.text.primary/detail |#252525/#787878 |#e8e8e8/#bababb..#bbbbbb | [M] | Mouse523,291;detailstem palettes240,308,350,28 |
| gesture.pitch/baseline-gap/checkbox-label-gap |50 /16 /11.5visible |same | [C] | checkboxy288/388/488;labelbaseline292/324;219→243 |
| gesture.tip/preview-gap |localtip310.5,26;shoulder286,0/52.5 /35pt |same | [C] | Mouse tip793,302;previewleft864 |

## Inferred values
Every[I] and[D] assertion in the15 seeded specs is grouped below; repeated API/behaviour claims are not extra measured tokens. References are the named file's Purpose, States, Measurements, Layout and Keyboard sections. New component assumptions follow afterwards. No inferred pressed/inactive/disabled recipe was validated by this pixel audit.

| Component | [I] values / assumptions | [D] values / behaviours carried from documentation |
|---|---|---|
| push-button | regular/small radius3.5px adopted in CSS (measured3.75, kept in push-button.md);mini14pt;pressedaccentfill/whitetitle,dark−10%;3pt50%-accentfocus with7ptradius;inactiveunchanged;minimumtitle+28pt/floor56 | text-only action,titlecase/verb/ellipsis;content-not-toolbar;one default;nohover;mouse-upinside;centredsingle-line/middleellipsis;mini9ptfont;fixedheight/intrinsicwidth;Space,Return,Escape,Cmd-Period,FullKeyboardAccess;AXButton/title/disabled webmapping |
| default-button | outline assumed to be the push button's3.75 (its own fit is3.5, coarse);pressed−12%;disableduntintedrounded;inactiveaccentremoved/normalrounded;focus-ring | mostlikely/non-destructivedefault,oneperview;Return/Enter;noCatalinapulse (file assertsremoved10.10);trailingplacementwithCancel;AXButton/windowdefault/submitmapping |
| help-button | pressedlight#f0f0f0/darkwhite.36 (shared pressed bezel fill; earlier inference#e5e5e5/white.35 superseded);disabledroundedwhite.5/.125,glyph.25;3ptcircularfocus;inactiveunchanged | onesizehelpbezel;contexthelp,oneperwindow,contentplacement;SpacewithFullKeyboardAccess;Helpkey/Cmd-?insteadopenHelp menu;AXButton/Helpname |
| gradient-button | pressed/toggle#d9d9d9/#5a5a5a;inactiveunchanged | immediateview-relatediconaction,momentary/toggle/menu;nointroducinglabel/not-toolbar;Space,Deleteasremove,AXButton/add-remove names |
| bevel-button | pressed=on;disabledimage.25;artabout18×25notmeasured | legacyimage/textbevel discouraged;radio-pairarrows/Space,AXRadioGroup/AXRadioButton |
| round-button | entirelyunseen:helpbezel,20/17/14diameters,.5edge,helprecipes,stateequivalence;≤11×11glyphprimary.85;13ptneighbourgap;baseline20ptcontrolgrid | deprecatedHIGstyle;Space,AXButton,requiredimageaccessible name |
| image-button | pressedblack.3overlay,labelunchanged;disabled.5;focusaroundimage;32nominalasset/40cell (onlyartboundariesmeasured) | immediateimageaction,toggle/menuvariants;labelbelow;10px(5ptat2x)paddingguidance;Space,AXButton/accessiblepane name |
| disclosure-button | entirelyunseen:20×20body/21frame,4radius,roundedbezel/noaccent;7.5×4.5chevron1.2stroke,localpathsM7,8.5 L10,11.5 L13,8.5/reverse;pressed#f0f0f0/white.36 (shared pressed bezel fill; earlier −10% superseded);8pttext-fieldgap | up/downexpansionnearassociatedcontrol,atmostoneperview;Space,AXButton/value/aria-expandedmapping |
| disclosure-triangle | pressedlabelcolour;selectedwhite;disabled.5 | right/downexpansion;Option-clickrecursive;about.1srotation;13×13hitrect;Right/Left/Optionrecursive,Space;AXDisclosureTriangle/value/tree mapping |
| lock-button | raisedopenshackle/unlockedartandstatus;authenticatingshackleanimation | systemauthorizationgatesprotectedsettings,successenables/changesstatus,openlockrelocks;SFAuthorizationViewAPI/states;SpacewithFullKeyboardAccess,AXButton/title/unlockedpressedmapping |
| pop-up-button | pressedcap−12%,titleunchanged;inactiveuntintedcap/normalcontrastglyph;focus-ring;mini14 | mutuallyexclusiveitems,currenttitle,overlaymenu/currentitemaligned/checkmark;labelsentencecasecolon,items titlecase;tailellipsis;Space/arrows/typing/Return/Escape;AXPopUpButton/select-onlycombobox |
| pull-down-button | enabledborderlessprimary.85;pressed/open−12%cap;inactiveuntintedcap/fullcontrastglyph | staticmenutitle,commands/menuitems,gearAction;menubelow/leftaligned;Space/Down;AXMenuButton/ARIA menubutton |
| combo-box | unfocusededgeabout#b5b5b5top/#c8c8c8side,no2.5ring;openlistmenu-like13ptnocheckmark;inactiveuntintedcap;radius1field/3.5..4button;Regular13anddarkwhite.85text | editablevalue+list,typedvaluenotadded;meaningfuldefault/relevantchoices/titlecasecolon;below-fieldlistfieldwidth,Downopens/completesautocomplete;labelbaselinealignment;typing/arrows/Return/Escape;AXComboBox/ARIAeditablecombobox |
| segmented-control | radius3.75 in dark taken from the light fit (dark not fitted);selectedas-tab-view;presseddefaultaccent/whiteglyph;inactivemomentaryunchanged/selectedgrey;Regular13/baseline14.5unmeasuredoutside tabs | selectOne/selectAny/momentary;equal-widthrelatedchoices,notmixedtitle/icons;10pttitlepadding/.fillEqually10.13+assertion;arrows/Space;AXRadioGroup/RadioButton,CheckBoxgroup,Buttonbymode |
| color-swatch-picker | thumbnail image radius4.5 to build with (grid reading4.5..5, not fitted; 6−1.5 only if the ring's inner edge is concentric);privateclassesunknown;initialappearanceLightnotobservable;Auto schedule;nohoverdecoration;pressedimage-darkening;disabled.5;focusinadditionselection;inactivetintunknown;demo-ownedAuto,rovingradio mapping | controlAccentColor,NSAppearance/isEnabledAPI;immediatepreferences;mutuallyexclusivechoices;AXRadioGroup/RadioButtonandarrow/Spacepattern |

Additional files: `preference-pane-icon` [I] custom/private classes,40×40allocation,invisiblehitbounds/5ptpadding,inactive/disabled.5,pressed/focusinherited; [D] image-button/Space/AXButton and pane-title behaviour. `account-header` [I] custom grouping,unknownsigned-outdefault/layout,long-namehandling,inactivetint,asset/demo navigation,AX/web grouping; [D] image/string/hidden APIs and documented preferences/image-button behaviour. `new-item-dot` [I] “new” interpretation/read-clearingmeaning,customview,accent-followingunknown,same-blue darkfallback,nohitrole/AXroleunknown,accessible-status mapping; [D] non-action feedback guidance/hiddenAPI. `gesture-option-row` [I] custom view/checkbox/select mapping,independenttutorialhighlight,dependentchoicedisabling,invisiblehitrect/hovermeaning,statesusechildrecipes; [D] independentcheckboxsemantics,Space,immediatepreferences. All font guesses from cap heights are[C], not[D]; sizes19±.5 and radius5/5.5±.5 explicitly retain uncertainty.

## Not reproducible in a browser
- **Native pixel rasterisation:** SF Pro/greyscale AA and0.5pt borders differ across fonts,device ratios,browsers. Closest:systemfontstack,2xalignedSVG/CSS,fractionalborders;at1xroundhairlines to1px. Help/chevron/triangle masks in inherited specs document exact2xcoverage,not a promise of identicalbrowserAA.
- **Native menus and window activation:** stylednative select/datalist cannot position AppKit's checked current item directly over the closed button or reproduce combo lists. Closest:customaccessiblelistbox/menu and demo-ownedwindow-active state. CSS has no host-AppKitfocusselector.
- **Vibrant Print sheet composites:** bezeledge samples vary withbackdrop;use measuredalpha recipes over matchingblur/material rather than neutralflat Printedgecolours.
- **Artwork:**paneicons,tennisavatar,appearance thumbnails,Printorientationpictograms,authorizationlock,providerlogos andMouse tutorialrequireimageassets. CSS can approximate silhouettes,notillustrationdetails. Tutorialanimation/open-lock/authenticatingshackleframes cannotbe recoveredfromstills.
- **System side effects:**Apple ID,FamilySharing,authorization,globalaccent/appearance andmouse configuration are unavailable toordinarywebpages. Closest:demo-ownedstateandnavigation;system-theme mediaquery is notCatalinaAuto scheduling.

## Open issues
1. No required deliverable file remains unwritten. No observedaudit mismatchremains. All other pressed/focused/inactive andunseen-sizevaluesretain[I]/[D]; screenshot auditdoesnotvalidate nativeinteraction semantics.
2. Main shell has **two** gridfillbands,notfour observable per-rowbands. Exact row1/2 androw3/4 backgroundboundaries do notexist;reportedexact extentsare376..759 and762..1183px. Internalrow slotboundariescanonlybeinferred.
3. General chooser versus separatelywritten`apps/system-preferences-general.md`: thatfile sayslabelinkright587 andthumbnailimage68pt. Actualcolonstemends592 (bothappearances) andimagewithoutborder/ringis67pt. It also givesinitialimageorigin614;newchoosercontentorigin615 excludesexternalring/border. Lead should reconcile those definitions/numbers;thiscontinuation didnoteditthatotherworkerfile. Darkpopup156ptthere is **fill**,versus157ptedge-to-edge inpopup spec;keepboth definitions explicit.
4. The inherited`image-button`32ptnominaliconclaimis[I],notmeasured. Actualshellart37..40pt;newblueprintlabels40ptdrawingallocation[I] andmeasuredbounds[M]. Do notscale37ptartdown to32pt.
5. Light-onlynew-item-dot: darkExtensionshasdifferentcontentandno dot. Darkvisiblecolourremainsunmeasured;nofalseappearance-wideabsence claim.
6. Cached HIG index hasnullarchive timestamps for Preferences,RadioButtons,Checkboxes andProvidingUserFeedback. Readcachedtextandusedthebrief'sMay2020 citationURLs;didnot independentlyfetch/confirmthoseexactarchiveURLs. Earlierfiles'AppKit/AX/time assertionswerereported[D],notrevalidatedbyPNG sampling.
7. Best other-family examples in sysA includeDate-and-Timecalendar/clock/date-picker,Mouse/Docktickedsliders,Apple-IDprogressstoragebar,Accessibilityoutline/sidebar,Extensionscheckboxstates andDesktop&ScreenSaverthumbnailgrid. Coverage already records them;theircomponentownershipisunchanged.

## Deviations from the assignment
No coverage rewrite or pane-blueprint edits. Addedfourcomponentfiles exactlyasrequestedfornon-seedcoverageIDs;addedonly targetedcorrectionsandpixel-citationappendices tofourinheritedfiles. Extra scratch audit script isnotadeliverable. Verifier's built-in±3 thresholdwasnotchanged;separate91-sampleaudit enforced±2.

## Concerns and discoveries affecting other work
Use five-stoplightaccentgradient,notclaimedtwo-stop equivalence. Keepstoredcolourvalues distinctfromCSSsRGB;lead'sannotationstepremains. Respectshape-dependenticonartbounds,conditionalfooterlock andpane-specifichelp insets. SeeOpenissues3/4forreconciliationwithotherblueprints/specs.

## Assumptions made in place of questions
PrivateAppKitclassnameswerenotinvented;publicequivalentsare[I]. Custompatternnamesaredescriptiveinventorynames. Appearance/Accentchoicesaremappedtoradiogroups,notcolourwells. Logicalrowallocations and40pticoncanvasareinferredbecauseinvisibleboundsarenotmeasurable. Darkvisible-new-itemfallbackis[I],notateststand-in. No decisions or owner input are needed to use these specs.

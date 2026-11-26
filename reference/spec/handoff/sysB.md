# sysB — inputs, indicators and containers completion

## Counts

- **34 / 34 assigned screenshots viewed** [M]: every light/dark preview in `reference/spec/.scratch/brief/group-sysB.txt` was opened with `view_files`, never more than four images per call. Coverage preserves the assignment's exact order.
- **25 inherited component files audited** [M], not rewritten: the seed assigns 24 to sysB; `status-dot` is the earlier agent's additional indicator. Two measurement rows in `checkbox.md` were corrected. No component file was missing.
- **0 new component files; 0 app blueprints written** [M]. App blueprints are outside this continuation's authorized outputs.
- Deliverables: `reference/spec/coverage/sysB.json` and this handoff. The generator and measurement log are in `<scratch>/sysBfin/`.
- Structural audit: **25 / 25 files contain all nine template sections; 225 / 225 required sections present, 0 additions needed** [M]. Pixel audit details and final coverage counts are under Open issues / verification below.

## New components

| id | Apple name | Owner family | Disposition |
|---|---|---|---|
| `status-dot` | Status image / status indicator (`NSStatusAvailable`, `NSStatusUnavailable`) | sysB indicators | Not in seed; complete inherited `components/status-dot.md`, light/dark measurements at lines 27–43. Used for Network, Sharing and Printers & Scanners. |

No other non-seed id is introduced in coverage. Compound patterns (`preferences-window`, `preferences-toolbar`) and primitives are both retained. Text-field and stepper constituents of textual date pickers are listed separately. A switch pictured inside Notifications artwork is **not** counted as a live `switch`. Screen Time charts and Trackpad movie stills are application-specific graphics recorded under `image-view`, not claims about their underlying AppKit class.

## Token candidates

All lengths below are **pt**; crops/citation coordinates remain original image px. Colours are stored PNG values, not converted sRGB. The lead must mechanically add chromatic sRGB equivalents before CSS use. `same` means the same geometry, not the same composited colour. Evidence references are to `reference/spec/components/<id>.md` line ranges; those rows contain the source screenshot and pixel location. This is a harvest of the inherited specification, not a claim that every harvested value was independently remeasured in this continuation. [I] candidates must not be promoted to measured tokens.

### Inputs and glyphs

| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| checkbox.regular-size / radius / border | 14×14 / 3 / 0.5 | same size/radius; no separate off side border | [M] | checkbox:49–52 |
| checkbox.check.bounds / stroke | x2.5–11.5, y3–11 / 1.75 | same bounds; stroke fitted | [M] bounds; [C] stroke | checkbox:53–55 |
| checkbox.check.path | `M3.4 7 L6.7 9.55 L10.75 3.85`, round caps, miter join | same | [C] | checkbox:54–55; exact coverage matrix:63–80 |
| checkbox.mixed-glyph | 8×2 at x3–11,y6–8; square ends, 0.5 AA | same | [M] | checkbox:56 |
| checkbox.title-gap / baseline / stack-pitch | 4.5–4.75 ink gap / 2 above box bottom / 22 | same | [M] | checkbox:57–59 |
| checkbox.off.border-top / sides / bottom | #a6a5a5 / #b6b7b7 / #b8b8b8 | top highlight #767677; no separate sides/bottom | [M] | checkbox:86–88 |
| checkbox.off.fill | #ffffff | #545556→#6e6f70; second row #5a5b5b | [M] | checkbox:89 |
| checkbox.off.inner-edge | top #e2e1e1,#ededec,#f8f8fa; sides #f7f7f7,#fcfcfc; bottom #fcfcfc,#f7f7f7 | none separate | [M] | checkbox:90 |
| checkbox.off.inner-shadow | inset 0 0.5 1 black@.12 + inset 0 0 0 0.5 black@.03 | none | [C] | checkbox:91 |
| checkbox.off.outer-edge | none | side #2e2f30; top #313232; bottom #2a2b2c,#2f3031,#333435 on #353637 | [M] | checkbox:92 |
| checkbox.on.border / fill | #4181f5 (sRGB #2d7ffd) / #4d89f5 (sRGB #3c87fd)-class (#4d8af5 (sRGB #3b89fd) unobstructed sample) | #2e6bdd (sRGB #1869e5)→#285fc6 (sRGB #145dcd); top #6898e9 (sRGB #5c97f0),#3774df (sRGB #2272e7) | [M] | checkbox:93–94; Network @852,572 light |
| checkbox.on.outer-edge | none | side #2b2c2d; top #2d2e2f; bottom #272828,#303131,#343535 | [M] | checkbox:95 |
| checkbox.dark-shadow | none | 0 0 0 0.5 black@.18 + 0 0.5 1 black@.12 | [C] | checkbox:96 |
| checkbox.glyph / glyph-opacity | #ffffff | #dee7f8 (sRGB #dce7fa) / white@.85 | [M] colour; [C] alpha | checkbox:97; Network @850,556 both |
| checkbox.glyph-shadow | #336cd9 (sRGB #216ae1)–#2f69d5 (sRGB #1b67dd); 0.5 down, ≈0.5 blur | none | [M] geometry/colour | checkbox:98 |
| checkbox.glyph-shadow.recipe | drop-shadow 0 0.5 0.5 rgba(3,54,165,.35) | none | [C] | checkbox:98 |
| checkbox.disabled.border / fill | side #c3c3c3, top #bbbbbb; #f1f1f1 with #e3e3e3,#e7e7e7,#eeeeee top | #565657 highlight,#323334 ring; #474849→#535354 (on #464646→#525252) | [M] | checkbox:99–101 |
| checkbox.disabled.glyph | #919191 | #767676–#7b7b7b | [M] | checkbox:102 |
| checkbox.disabled.glyph-alpha | black@.40 on #f1f1f1 | white@.25 | [C] | checkbox:102 |
| radio.regular / dot / off-border | 16 diameter / 5.25 dot / 0.5 | same geometry; no separate off border | [M] | radio-button:42–45 |
| radio.title-gap / baseline / group-gaps | 3.5 ink gap / 2.5 above bottom / 10 horizontal,22 vertical | same | [M] | radio-button:46–49,76–77 |
| radio.off.border / fill | top #a2a1a1,side #b2b2b2,bottom #b8b8b9 / #ffffff | top #6d6d6e,#5c5d5d / #555555→#6d6d6d | [M] | radio-button:55–56 |
| radio.off.inner-edge | top #cccdcd,#e3e3e3,#f4f3f4,#fdfdfd; side #f2f2f2,#fbfafb; bottom #fafbfa,#ebeaeb | none separate | [M] | radio-button:56 |
| radio.off.inner-shadow | inset 0 0.5 1.5 black@.20 + inset 0 0 0 0.5 black@.05 | none | [C] | radio-button:57 |
| radio.off.outer-edge | none | side #303031; bottom #2b2b2c,#313132 | [M] | radio-button:58 |
| radio.on.fill / rim | #4c89f5 (sRGB #3a87fd) / #4383f4 (sRGB #2f81fc) | #2e6cdd (sRGB #176ae5)→#2961c9 (sRGB #155fd0); top #6795e2 (sRGB #5c94e8),#3975e0 (sRGB #2573e8); last #285ec2 (sRGB #155cc9) | [M] | radio-button:59 |
| radio.on.outer-edge / dot | none / #ffffff with #3570db (sRGB #216ee3) shadow 0.5 down | side #2d2d2d,bottom #292829,#303031 / #dee8f9 (sRGB #dce8fb) | [M] | radio-button:60–61 |
| radio.dot-alpha / dark-shadow | opaque / none | white@.85 / 0 0 0 0.5 black@.17 + 0 0.5 1 black@.15 | [C] | radio-button:61,74 |
| radio.disabled.border / fill / dot | #c1c1c1 sides,#bbbbbb top,#c5c5c5 bottom / #f0f0f0–#f1f1f1 / #919191 | top #525253,ring #333334 / #464647→#505051 / #777777–#79797a | [M] | radio-button:62–64 |
| switch.track / knob / travel | 38×21 / 20 diameter / 18 travel | same | [M] dimensions; [C] travel | switch:34–37 |
| switch.track-radius | 10.5 (half the height; not fitted, the track lies on a translucent material) | same | [C] | switch:35 |
| switch.off.composite | #d7e5ec (sRGB #d4e5ed)–#d7e5ef (sRGB #d4e5f0) on #e4f4ff (sRGB #e1f4ff)–#e7f2f8 (sRGB #e5f2f9) | #393f49 (sRGB #383f4a)–#363d49 (sRGB #353d4a) on #232c3c (sRGB #212c3d)–#31363c (sRGB #30363d) | [M] | switch:42 |
| switch.off.alpha | black@≈.06 | white@≈.09 | [C] | switch:42 |
| switch.off.edge / knob-fill / outline | top #cad8df (sRGB #c7d8e0) (1),end #cddbe5 (sRGB #cadbe6) / #ffffff / #b4bbbf (sRGB #b3bbc0),bottom #a2aab0 (sRGB #a0aab1) (0.5) | #4a5059 (sRGB #49505a),#515864 (sRGB #505865) / #cfd0d2 / #44484d (sRGB #43484e),inner top #d4d5d6 | [M] | switch:43–45 |
| switch.knob-shadow | #bec8ce (sRGB #bcc8cf) / 0 0.5 1 black@.15 | #50545b (sRGB #4f545c) / same recipe | [M] colour; [C] recipe | switch:53 |
| slider.track-height / radius | 3 / 1.5 | same | [M] | slider:50–51 |
| slider.round-knob / outline | 15 fill diameter / 0.5 outside,16 total | same geometry | [M] | slider:52–54 |
| slider.directional.regular / small | 15×16.25 / 11×11.5 | same | [M] | slider:55 |
| slider.directional.paths | regular `M2 0 H13 A2 2 0 0 1 15 2 V8.75 L7.5 16.25 L0 8.75 V2 A2 2 0 0 1 2 0 Z`; small `M1.5 0 H9.5 A1.5 1.5 0 0 1 11 1.5 V6 L5.5 11.5 L0 6 V1.5 A1.5 1.5 0 0 1 1.5 0 Z` | same | [C] | slider:56 |
| slider.directional-outline / top-offset / apex | 0.5 outside; body top 4 regular/3 small above track; apex 9.25/5.5 below track | same | [M] | slider:57–59 |
| slider.tick-size / gap / end-inset | regular 1×4 / 8.5 below track / 7.5 inset; small 1×3 / 4.5 / 5.5 | same | [M] | slider:60–62 |
| slider.tick-pitch / reserved-height | (length−thumb width)/(count−1); reserve15 round,24 regular ticks,18 small ticks | same | [C] | slider:63–65 |
| slider.unfilled-track | #b1b1b1 box,#b9b9b9 window | #515152 box,#4c4c4d window | [M] | slider:71; dark Displays sample #525253 within tolerance |
| slider.unfilled-track-alpha / filled | black@.22 / #4d8af5 (sRGB #3b89fd) | white@.14 / #2e6bde (sRGB #1869e6) | [C] alpha; [M] fill | slider:71–72 |
| slider.thumb | #ffffff; directional top #c8c8c8,sides #c0c0c0,crossing #969696,taper #b4b4b4–#bcbcbc | #cccccc; top #d2d2d2–#d6d6d6 | [M] | slider:73–74 |
| slider.round-outline / dark-ring | top #c3c3c3,bottom #a9a9a9 | #2a2b2c–#28292a window,#313132–#2e2e2f box | [M] | slider:75–76 |
| slider.outline-alpha | top black@.14,directional side@.19,bottom@.23; round bottom@.26 | black@.15 | [C] | slider:74–76 |
| slider.thumb-shadow | #cbcbcb,#dbdbdb; 0 0.5 1 black@.11 | #2b,#30,#34 on #36; 0 0.5 1 black@.20 | [M] composite; [C] recipe | slider:77 |
| slider.ticks / tick-alpha | #979797 window,#909090 box / black@.36 | #636464 window,#686869 box / white@.25 | [M] colour; [C] alpha | slider:78 |
| slider.label-gap / icon-gaps | cap top6 below tick bottom; speaker gap13 left,9 right | same | [M] | slider:81,88 |

### Fields, typography and focus

| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| stepper.size / radius / outline / field-gap | 12×21 / 5.125 to 5.25 (fit; 5.5 as a grid reading) / 0.5 / 4; field centering inset1 top/bottom | same | [M]; [C] radius | stepper:39–47 |
| stepper.chevron / paths | 6×3.5,stroke1.4; up `M3.25 7.25 L6 4.75 L8.75 7.25`, down `M3.25 13.75 L6 16.25 L8.75 13.75`; apex4.5 from ends | same | [M] geometry; [C] paths | stepper:42–44 |
| stepper.fill / outline | #ffffff / top#c1c1c1,side#b9b9b9,bottom#a8a8a7 | #686869,top#868787,#6e6e6f / side#2f2f30,top#313132,bottom#2b2b2c | [M] | stepper:53–54 |
| stepper.shadow / glyph | #c8c8c8,#dadada / #404040 | #303031,#343435 / #e8e8e8 | [M] | stepper:55–56 |
| stepper.shadow-recipe / glyph-alpha | 0 0.5 1 black@.13 / black@.75 | 0 0.5 1 black@.12 / white@.85 | [C] | stepper:55–56 |
| stepper.disabled | fill#f1f1f1; top#d0d0d0,side#cdcdcd; glyph#909191 | fill#4f4f50,top#5e5e5f,ring#333333; glyph#7b7b7c | [M] | stepper:57–58 |
| field.height / radius / border / inner-line | 20 / 0 / 0.5 / 0.5 | same | [M] | text-field:38–41 |
| field.text-inset / baseline / form-gap / helper-gap | 4 / 14.5 below top (cap top5) / label gap8.5 / helper cap9 below bottom | same | [M] | text-field:42–43,68–69 |
| field.border / inner / fill / text | #b1b1b1 / #f0f0f0 / #ffffff / #262626 | top#474849,side#424344,bottom#636465 / top#363737,#373738,#39393a,bottom#494a4b / #393a3b–#3a3b3b / #e2e2e2 | [M] | text-field:50–53 |
| field.border-alpha / fill-alpha / text-alpha | black@.25 / opaque / black@.85 | top white@.12,bottom@.25 / white@.05 / white@.85 | [C] | text-field:50–53 |
| field.placeholder | black@.25 | white@.25 | [D] | text-field:54, NSColor.placeholderTextColor |
| field.disabled | border#c8c8c8,inner#f2f2f2,fill#ffffff,text#c0c0c0 | border top#3e3e3f,bottom#4d4d4d,fill#232323,text#595a59 | [M] | text-field:55, disabled Date & Time constituent |
| search.small / custom.size-radius-border | height18,radius4.25 (fit; 2.5 misread the grid),border0.5 / height23,radius3.75 (fit; 3.5 as a grid reading),border0.5 | same | [M]; [C] radius | search-field:40–42 |
| search.small / custom.glyph-inset-text | glyph10.5²,inset6.5,text23 / glyph12.5²,inset6,text24.5 | same | [M] | search-field:43–44 |
| search.magnifier-path | centre(5,5),diameter10,stroke1; handle(8.4,8.4)→(12,12),45°,stroke1.4,round end | same | [M] geometry; [C] fit | search-field:66 |
| search.automator.fill-border-glyph-placeholder | #cfcfcf / focused#7294d4 (sRGB #6a94d9) / #484848 / #9c9c9c | #3e3f41 / focused#4978a1 (sRGB #3a78a5) / #e2e2e2 / #6e6e6f | [M] | search-field:51–54 |
| search.music.fill-border-glyph-placeholder | #d2d3d3 / #c1c2c2 / #3a3b3b / #989999 | #3b3c3f / top#4a4b4d,bottom#68696c,side#434548 / #ffffff / #77787c | [M] | search-field:55–58 |
| search.custom-fill / placeholder-alpha | black@.09 / black@.27 | white@.07 / white@.31 | [C] | search-field:55,58; Automator placeholder .25 both |
| search.font-small / custom / sidebar-inset | 11 regular / 13 regular / 10.5 | same | [C] font; [M] inset | search-field:64–65,72 |
| token.height-radius-border / inset-baseline | 19,2,none / text4.5,baseline14 | same | [M] | token-field:34–39 |
| token.width-padding / chevron | text+20.5; chevron6×3.5,stroke1.5,round ends; gap5.5 after text,4 before edge,top8 | same | [M] | token-field:37,40 |
| token.chevron-path | `M0.75 0.75 L3.1 2.9 L5.5 0.75` | same | [C] | token-field:41 |
| token.fill / text / parent | #c0d7fc (sRGB #bbd7ff) / #1d2026 (sRGB #1c2027) / #ffffff | #253d60 (sRGB #1e3d63) / #dee1e7 (sRGB #dde1e8) / #1e1e20 | [M] | token-field:47,49–50 |
| token.fill-alpha / font | accent@≈.30 / 13 regular | accent@≈.35 / same font | [C] | token-field:48,55 |
| type.control / emphasized / body | 13 regular / 13 bold / 13 regular opaque; line16 | same | [C] | label:19–22,46–47,53–54 |
| type.small / small-secondary / small-form | 11 regular,line14 / same / 11 bold,pitch22 | same | [C] fonts; [M] pitch | label:23–25,48–49,55 |
| type.mini / secondary / disabled / group / link | 10 regular,line13 / 13 regular,line16 / same / 11 regular / 11 regular,line14 | same | [C] fonts; [M] pitches | label:26–30,50–51 |
| type.large-value / regular-stem / bold-stem | ≈27 regular Display; digit38px / 13pt stem2px / bold3–4px (11pt bold3px) | same | [C] font; [M] ink | label:52–55 |
| label.primary-composites | #232323 on#e3e3e3,#242424 on#ececec,#262626 on#ffffff | #e0e0e0 on#363637,#dfdfdf on#2f3031,#dddddd on#1d1e1f | [M] | label:60 |
| label.primary-alpha / secondary-alpha | black@.85 / black@.50 | white@.85 / white@.55 | [C] | label:60–61 |
| label.secondary-composites | #727272 box,#767676 window,#7f7f7f–#808080 white list | #a4a4a5 box,#a1a2a2 window,#999a9a list | [M] | label:61 |
| label.tertiary-composites / alpha | #a9a9a9–#aaaaaa box,#bfbfbf–#c0c0c0 list / black@.25 | #686868 box,#565656 list / white@.25 | [M] composites; [C] alpha | label:62 |
| label.opaque / link / header | #000000 / #266ad2 (sRGB #0068d9)–#276ad3 (sRGB #0168da) / #171717 on#f0f0f0 | #ffffff / #579cf9 (sRGB #419bff)–#589cf8 (sRGB #429bff) / #ffffff on#2a2b2c | [M] | label:64–66 |
| label.control-specific / large-value | #222222 on#e3e3e3 / #272727 on white | #e1e1e1 on#353637 / #dcdddd on#1d1e1f | [M] | label:71,79 |
| type.tracking.13 / 11 / 10 | −0.08 / +0.06 / +0.12 | same | [D] | label:81, Apple SF tracking table (source not archived locally in this file) |
| label.form-gap / helper-inset / paragraph-inset | 7.5 form gap; helper cap11 below box bottom,aligned with title; paragraph20.5 from frame,23 below toolbar | same | [M] | label:87–89 |
| focus.outer-width / overlap / band / radius | 2.5 (one instance3) / 1 overlap / 3.5 band / control radius+2.5 as an inferred rule for rounded controls (fitted: 6.75 on the 4.25 toolbar search field; 3.25 on a square control) | same geometry | [M] dimensions; [C] sum and the two fitted radii; [I] the radius+2.5 rule | focus-ring:31–36 |
| focus.edge / falloff | crisp constant-alpha band,1 AA pixel; no blur | same | [M] | focus-ring:34,49–50 |
| focus.window / toolbar / border-composites | #89abeb (sRGB #82abf1) on#ececec / #83a5e5 (sRGB #7ca5eb) on#e3e3e3,#7b9ddd (sRGB #749de3) on#cfd0cf / #6b8dcd (sRGB #638cd2) on#b1b1b1 | #3d6c95 (sRGB #2d6c99) on#2f3032 / #45749d (sRGB #3674a1) on#3f4042 / #4c7aa3 (sRGB #3e7aa7) | [M] | focus-ring:41–43 |
| focus.recovered / clear-space | rgba(38,106,234,.5) / at least3 clear | rgba(75,168,248,.5) / same | [C] colour; [D] spacing | focus-ring:44,53 |

### Containers and date selection

| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| tab.height-radius / overlap / segment-padding | 20 (+1 shadow),radius3.5 (fit; 3.5 to 3.75); 9.5 above box border,10.5 below; label width+23.5±0.5,ends≈1 wider | same | [M]; [C] radius | tab-view:46–50 |
| tab.divider / label-baseline / outer-inset | divider1; baseline13.75,cap top5; outer20,strip20.5 below toolbar,box30 | same | [M] | tab-view:51–54 |
| tab.selected.edges / gradient | top#5b93f2 (sRGB #4c92f9),bottom#2066f6 (sRGB #0062ff) (0.5); 0/25/50/75/100% #77a5f5 (sRGB #6ca4fc),#699cf5 (sRGB #5c9bfc),#4e8af5 (sRGB #3d88fd),#367af6 (sRGB #1d78ff),#286ef6 (sRGB #076bff) | top#6897e9 (sRGB #5c96f0),#3773df (sRGB #2371e7); 0/50/100% #2e6cde (sRGB #176ae6),#2c66d4 (sRGB #1864dc),#2961c7 (sRGB #145fce) | [M] | tab-view:59–61 |
| tab.selected-text / unselected-text | #ffffff / #262626 | #e0e8fa (sRGB #dee8fc) / #e8e8e8 | [M] | tab-view:62,65; dark text white@.85 [C] |
| tab.unselected-edge-fill / divider / ring | top#c7c7c7,bottom#a7a7a7,right#d1d1d1 / #ffffff / #e5e5e5 / none | top#828283,#68696a / #636465 / #535455 / #2b2c2d,top#28292a | [M] | tab-view:63–67 |
| tab.shadow-composite / recipe | #c8c8c8,#dadada / 0 0.5 1 black@.14 | #282829,#303030,#343435 / 0 0.5 1 black@.25 | [M] composite; [C] recipe | tab-view:68 |
| tab.font / first-row / inner-pad / following-gap | 13 regular / ≈29 below box top / ≈20 / 15 below box bottom | same | [C] font; [M] spacing | tab-view:74,80–82 |
| box.border-radius / inset-title | 0.5 outer+0.5 inner,radius fit3.875,4 to build with (rounded; the row gave "radius4 (fit)" tagged [C] until 3 October 2026); outer inset20; title13,ink inset12,baseline3 above top | same geometry; radius fit4 | [M]; [C] radius fits; [I] 4 to build with in light | box:34–38 |
| box.window / fill | #ececec / #e3e3e3 | #2f3031–#303031 / #363637 | [M] | box:43–44 |
| box.fill-alpha / border-alpha | black@.04 / top@.10,sides-bottom@.06 | white@.035 / white@.15 | [C] | box:44–46 |
| box.top / sides-bottom / inner | #d3d3d3–#d4d4d4 / #dedede / #e0e0e0–#e1e1e1 | #4e4f50 / same / #404142 | [M] | box:45–46 |
| box.band / leading-region | band top#d3d3d3,#e0e0e0,bottom#dedede,fill#e3e3e3; leading#dedede,#e1e1e1 | top#4e4f50,#404142,bottom#4e4f50,fill#353637–#363637; leading#4f4f50,#414142 | [M] | box:47–48 |
| box.nested-titled / square-content | #dadada,top#cbcbcb,#d8d8d8,sides#d6d6d6,#d8d8d8 / #ffffff,border#c0c0c0,1,square | titled not measured / #1d1e1f,border#555656,1,square | [M] | box:49–50; nested is a recorded exception, not nesting guidance |
| box.inner-spacing / following-gap | left20,top≈19–30 / 13–20 | same | [M] | box:61 |
| separator.thickness / ends / composites | 1,square / #cdcdcd box,#d5d5d5 window | same geometry / #4a4a4b box,#434445 window | [M] | separator:29–37 |
| separator.alpha / insets | black@.10 / 23 security,19 trackpad,14 Time Machine | white@.10 / same | [C] alpha; [M] inset | separator:38,53 |
| separator.vertical-spacing | Trackpad31.5 above,13 below; Security19 below; Time Machine27 below toolbar,21 above next text | same | [M] | separator:50–52 |
| date.field-height / border / inset-baseline / stepper | 23 / 0.5+0.5 inner / text3.5,cap top7,baseline17 / 12×21,gap4 | same | [M] | date-picker:45–49 |
| date.field.border-fill-text | #aaaaaa,inner#f0f0f0 / #ffffff / #272727 | side#49494a,top#4d4c4d,bottom#686869 / #292929–#2a2a2a / #dedfde | [M] | date-picker:67–69 |
| date.disabled-field / calendar-border-fill | border#c8c8c8,inner#f2f2f2,fill#ffffff,text#c0c0c0 / same border+fill | field#3f4041,bottom#4d4d4d,fill#232323,text#595b5a / top#3f4041,side#3c3c3d,bottom#4d4d4e,fill#232323 | [M] | date-picker:70–72 |
| date.calendar-size / border / title / navigation | 137.5×147,square,0.5+0.5; title inset3.5,cap top5; triangles5.5×6,disc7,centres14.25 apart,trailing inset6 | same | [M] | date-picker:50–53 |
| date.calendar.header / grid / selection | header cap top25,divider1 at36.5,inset2.5; 7cols pitch18.5,6rows pitch18; selected19×16,square | same | [M] | date-picker:54–58 |
| date.calendar.text / divider / selected | disabled#c0c0c0; weekday#808080; day#272727; other-month#c0c0c0 / #e6e6e6 / fill#2465d9 (sRGB #0362e1),text#ffffff | disabled#595b5a; weekday#9c9c9c; day#dedede; other-month white@.25 / #393939 / fill#1e5ac8 (sRGB #0057cf),text#ffffff | [M] colours; [C] dark other-month alpha | date-picker:73–79 |
| date.clock-size / rim / numeral / AM-label | diameter120; rim8.5 sides,15 top; numeral≈13 bold on radius≈45; AM label13,cap13 below centre | same | [M] geometry; [C] font | date-picker:59–62 |
| date.clock.rim-face-hands | rim#d6e7ed (sRGB #d2e8ee),#929394→#f2f3f4,side#a5adae (sRGB #a3adae),bottom#777777; face#fcfdfe; hands#000000,second#ec4d3e (sRGB #ff3b31),AM#aaaaaa | same artwork,white face retained | [M] | date-picker:80–82 |
| date.fonts / layout-gaps | field13 regular tabular,title13 bold,weekday11 bold,day11 regular; field-calendar10,field-clock26.5,calendar-clock93 | same | [C] fonts; [M] gaps | date-picker:87–90,96 |

### Images, indicators and lists

| suggested token | light | dark | tag | evidence |
|---|---|---|---|---|
| color-well.size / border-bezel-inner / swatch | 22×16,square / 0.5 border,bezel1.5 sides+0.5 ends,inner1 / 16×12; adjacent gap3 | same geometry | [M] | color-well:40–47 |
| color-well.border / bezel / inner / swatch | side#bdbdbd,top#c1c1c1,bottom#9d9d9d / #f6f6f6,top#fcfcfc,bottom#f3f3f3 / #e8e8e8 / #000000 | side none,top#838688 (sRGB #828688) / #676a6c (sRGB #666a6c),bottom#65686a (sRGB #64686a) / #232323 / #ffffff | [M] | color-well:52–55 |
| color-well.parent | #d3d3d3 | #3a3d3f (sRGB #393d3f) | [M] | color-well:56 |
| image-well.size / ring-radius / inset / image | 138×88 / ring2,radius6.5 (fit; ≈5.5 as a grid reading) / inset7.5 sides,5 ends / 119×74 | same | [M]; [C] radius | image-well:35–39 |
| image-well.ring / edge / recess | #ffffff,outerAA#d6d6d6 / top#bdbdbd,left#c6c5c6,right#c5c5c5,bottom#cacaca / #dadada,top#cdcdcd,#d2d2d2,#d4d4d4,#d6d6d6,#d8d8d8 | #767677 / top#2e2f30,side#323233,bottom#333334 / #3e3e3f,top#3a3a3b,#3c3c3d | [M] | image-well:44–47 |
| image-well.inner-shadow | inset 0 0.5 0 black@.13 + inset 0 1 3 black@.08 | inset 0 0.5 0 black@.25 | [C] | image-well:48 |
| image.hero / avatar / sidebar | hero117²,top26–32 below toolbar; detail62²,list24²,monogram98²; app artwork≈29² in32 cell | same sizes | [M] | image-view:33–38 |
| image.printer / disk / fingerprint / Spotlight / Sidecar / Wallet | 93×67.5 / 56×60 / 48² / 53² / 221×162 / 334×260 | same artwork-size family,not universal intrinsic sizes | [M] | image-view:39–45 |
| image.monogram / caption-gap | fill#b2b2b2,initials#ffffff / cap10 below hero bottom | grey fill,no initials / same caption geometry | [M] | image-view:51,55; transparent parent:50 |
| progress.height-radius / borders / edge | 6,radius3; track0.5,fill0.5; vertical trailing edge with1 blended pixel | 6,radius3; no separate borders | [M] | progress-bar:34–38 |
| progress.track-fill-border / fill-border | #d3d3d3 box,#dbdbdb window / #b7b7b7 box,#bfbfbf window,end#b9b9b9 / #4d8af5 (sRGB #3b89fd),border#4378d5 (sRGB #3477dc),leading#477bd5 (sRGB #387adc) | #4c4f52 (sRGB #4b4f52) / none / #2e6bde (sRGB #1869e6),leading#2e6ada (sRGB #1968e2) | [M] | progress-bar:45–48 |
| progress.track-alpha | fill black@.07,border black@.19 | fill white@.14 | [C] | progress-bar:45–46 |
| progress.status / stop / layout | status11 regular secondary (#717171); stop14 disc#ababab,white X,gap16.5; title cap43 above bar,preceding text14 above,status cap11.5 below | status white@.55; stop not shown | [M] geometry/colour; [C] dark alpha | progress-bar:53–54,60 |
| spinner.small / spoke / angle | diameter16,12 spokes,30° apart; length4.5,width1.5,round; inner radius3.5,outer8 | same | [M] | progress-spinner:31–34 |
| spinner.frame-composites | #494949,#515151,#5d5d5d,#696969,#777777,#858585,#949494,#a2a2a2,#b0b0b0,#bdbdbd,#c8c8c8,#d0d0d0 on#e7e7e7 | #a2a2a2,#939393,#858585,#787878,#6c6c6c,#636363,#5a5a5a,#535353,#4c4c4c,#494949,#454545,#434343 on#303030-class | [M] | progress-spinner:43–54, luminance grid, not chromatic RGB claims |
| spinner.spoke-alphas | black .68,.65,.60,.55,.48,.42,.36,.30,.24,.18,.13,.10 | white .55,.48,.41,.35,.29,.25,.20,.17,.14,.12,.10,.09 | [C] | progress-spinner:43–54 |
| capacity.custom-size-border-radius / empty-border / used-outline | 600×24,border1,radius fits used end4.75 / empty end5.125,5 to build with (rounded; the row gave "radius5 (fit)" tagged [C] until 3 October 2026) / #ffffff,#d1d1d1 / #4eacf2 (sRGB #19adf8),#47a0e3 (sRGB #12a1e9) | same geometry; radius fits used end4.875 / empty end5,5 to build with / #38393a,#808080 / #3f6f92 (sRGB #2f7095),#4eacf2 (sRGB #19adf8) | [M]; [C] radius fits; [I] 5 to build with | level-indicator:30–34,42–45; Disk Utility custom bar,not standard NSLevelIndicator |
| list.border / footer / button-cells | border1,square; footer21=1+19+1; cells24 Network,23 Users,Action28,divider1 | same | [M] | bordered-list:46–48 |
| list.plus-minus / detached-control | plus11²,stroke1; minus11×1 / 45×21,two21 cells,border-divider1,gap8 below list | same | [M] | bordered-list:49–51 |
| list.row-pitches / cell-insets | Network42,Users34,Notifications41,Spotlight22,Sharing20 service+18 permission; Network dot10,inset7,title23.5,cap9,subtitle25,trailing icon11 | same | [M] | bordered-list:52–57; variants include18,20,22,34,41,42 |
| list.group-row / layout | group23,text11,inset10; outer inset20,detail gap8 | same | [M] | bordered-list:58,91 |
| list.bg-alternate-border-selected | #ffffff / #f4f5f5 / #c5c5c5 (Users#aaaaaa) / #dcdcdc | #1d1e1f–#1e1e1f / #282929 / #565656 (Users#808080) / #464646 | [M] | bordered-list:64–68 |
| list.footer-lines-fill-divider-glyph | #b4b4b4 / #fafafa→#f5f5f5 / #b4b4b4 / #252525 | top#808080,side-bottom#636465 / #4e4f50→#48494a / #8a8b8c / #e4e4e4 | [M] | bordered-list:70–73 |
| list.disabled-footer / printer-footer | fill#f9f9f9→#f3f3f3,line#b4b4b4,divider#b7b7b7,glyph#b9b9b9 / top#c5c5c5,fill#f3f3f3→#f1f1f1,bottom#d0d0d0 | fill#3c3c3c,line-divider#7f7f7f,glyph#6d6c6c / top#565656,fill#3f3f40→#3d3d3e,bottom#4a4a4b | [M] | bordered-list:74–77 |
| list.row-text / subtitle / group-alpha | title13 regular,white-list#262626,selected#212121 / 11 regular,#7f7f7f,selected#6f6e6e / black@.25 | title#dddddc,selected#e3e4e3 / #999a9a,selected#abacac / white@.25 | [M] composites; [C] font/alpha | bordered-list:82–84; title alpha.85,subtitle black.5/white.55 |
| status.diameter-rim / text-gap | 10,rim0.5; compact6 / gap6.5 regular,7 compact | same | [M] | status-dot:31–34 |
| status.green / red / compact | green#61c554 (sRGB #25c93f),rim#57ad48 (sRGB #28b135); red#ea564b (sRGB #fd4742),rim#d24c42 (sRGB #e33f39); compact#63c756 (sRGB #29cb42),rim#5eba51 (sRGB #2cbe3e) | green#61c454 (sRGB #27c840),rim#51a642 (sRGB #1faa2e); red#e9564c (sRGB #fc4743),rim#c74237 (sRGB #d7332d); compact#63c756 (sRGB #29cb42),rim#5ab64c (sRGB #25ba38) | [M] | status-dot:39–43 |
| date.day-alignment / selected-offset | column n digit-right=19.5+18.5n from border; selected extends15.5 before+3 after digit-right,4.5 above digit-top | same | [M] | date-picker:56,58 |
| slider.travel / form-gap | centre start+half-thumb through end−half-thumb; form gap8 (source's Displays coordinates give12pt,see Open issues) | same | [M] | slider:64,87 |
| checkbox.stack-variants / dependent-indent | Notifications24,Network30 pitch; child indent26 | same | [M] | checkbox:119–121 |

## Inferred values

The following inventory covers the [I]/[D] statements in all 25 files, including documented interactions. References identify the full statements and cited HIG/AppKit sources rather than silently upgrading them to measurements. **Not seen in the screenshots:** `circular-slider`, standard `secure-text-field`, standard `level-indicator`, and `tooltip`. Login password and Disk Utility capacity artwork are related examples, not measured standard controls. `switch` is seen only outside this group; in-content `search-field`, `token-field`, `color-well`, and the measured `image-well` example are likewise outside these 34 panes.

| Component | [I] values / unseen states | [D] behaviour / parameters / accessibility |
|---|---|---|
| checkbox | small12²,mini10²; pressed on#3f7ae0 (sRGB #2d78e8) light/#2459b8 (sRGB #0f57bf)→#2050a6 (sRGB #0e4eac) dark; off#f0f0f0/lighten8%; focus ring; inactive off-well with glyph black/white@.85 (41–43,60–61,103–105) | toggle anywhere,no hover,mixed/dependencies; hit area; Space,Full Keyboard Access,AXCheckBox/ARIA (8–11,122–125) |
| radio-button | small14,mini12; mixed8×2; pressed on#3f7ae0 (sRGB #2d78e8)/off#f0f0f0,dark on−12%/off+8%; focus/inactive (33–36,50,65) | mutually exclusive groups,non-action,no hover; arrows/Space,AXRadioGroup (8–11,79–80) |
| switch | slide≈.2s; on#4d8af5 (sRGB #3b89fd)-class/#2e6bde (sRGB #1869e6)→#285fc6 (sRGB #145dcd); window off black@.09/white@.10; pressed/disabled/focus not specified; row trailing inset≈10 (11,27–28,46–47,56) | toggle/drag,colour indicates on; Space,AXSwitch/ARIA (8–11,58–59) |
| slider | pressed#f0f0f0/#e0e0e0; disabled50%+unfilled track; focus ring; inactive loses accent; min length thumb+2radius (41–44,89) | ranges,ticks,direction,track click/snap; keys/AXSlider (8–11,91–92) |
| circular-slider | **not seen**: regular diameter24 in28×30 frame,small18,dot4,centre radius−4.5,ticks2 at3 outside; white/gray slider bezel/shadow; dot black@.5/.6,ticks black@.36/white@.25 (31–48) | cyclic range/tick dots; field+stepper pairing,arrow keys/wrap,AXSlider (8–9,51–54) |
| stepper | small10×18,mini9×15; pressed half accent/white chevron; focus (32–33,48) | step/autorepeat/wrap; field pairing,keys/AXIncrementor (8–9,66–70) |
| text-field | small17,mini14 visible heights (IB19/16); inactive unchanged minus ring/tint; caret1,line-height,blink.5s on/off (32,45,57) | placeholder black/white@.25; validation,formatting,clipping,editing keys,AXTextField (8–9,31,54,72–73) |
| secure-text-field | **not seen standard**: inherit20 height,.5 border,4 inset; bullet≈4.5 diameter,≈7 advance; Caps Lock13² at4 trailing; auth-stack gap8 (29–46) | bullets,no copy/cut/tooltip,Caps Lock; placeholder alpha.25; secure AXTextField/password input (8–9,40,48–49) |
| search-field | disabled50%; regular22 high,13 font,glyph11,text start26; cancel14 circle at4 trailing; unfocused radius4,white/black@.25 border,dark white@.05 fill (34,45–46,59) | search semantics,cancel/recents; Command-F,Escape,Return,AXSearchField (8–11,74–75) |
| token-field | selected accent#3a80f6 (sRGB #207efe)-class/white; hover slightly darker; gap2; preceding-label gap≈4,inline wrap/grow (26–28,42,61) | tokenization/menu/completion; arrows/Backspace/menu keys,AXTextField token children (8–9,63–64) |
| label | inactive unchanged; link pressed−15%/hand cursor; quaternary black/white@.10 not seen (38–39,63) | system roles,colons,selectability; SF Text<20/Display≥20,tracking−.08/+.06/+.12; AXStaticText/label linking (8–9,63,81,92–93) |
| date-picker | selected textual element accent+white; enabled calendar month primary/navigation secondary black@.85/.5,white@.85/.55 (36–38,75) | styles,locale,elements/ranges,type/step/click/drag; keyboard/AXDateField/grid (8–9,98–99) |
| color-well | active bezel#c9c9c9/#8a8d8f (sRGB #898d8f); disabled swatch50%; form44×23,bezel3; label gap8,toolbar gaps10 (32–33,46,65) | opens native colour panel,darkens,drag/drop; Space,AXColorWell (8–9,32,67–68) |
| image-well | drag ring2 accent; empty recess; selected ring radius8 (27–29) | selection before copy/paste/Delete; editing/drop/default; AXImage,file-input alternative (8–9,27,59–60) |
| image-view | no [I] numeric recipe | scaling/animation/noneditable/template tint; AXImage/descriptions (8–9,52,63–64) |
| progress-bar | small height4; indeterminate lighter30%-width band/1.5s sweep; inactive#9b9b9b/#6a6a6a (27–28,40); Browser notes' .25s width animation is unmeasured, treat [I] | determinate/indeterminate/cancel semantics; nonfocusable AXProgressIndicator (8–9,62–63) |
| progress-spinner | regular32,length9,width3; mini10; determinate circle16,outline1,secondary sector;≈1rev/s,12 steps (25,35–36,62) | hide when stopped,unknown-work semantics,AXProgressIndicator/AXBusyIndicator (8–9,24,67–68) |
| level-indicator | Disk Utility bar radius5 to build with (fits4.75..5.125 by end and appearance, rounded); **not seen standard**: continuous12 high,radius2,ticks1×4,reserve18; discrete12,gap2,radius2; rating stars13,pitch16; progress-track recipe (35–47) | capacity/rating/relevance,green/yellow/red tiers; label alignment,editable arrows/clicks,AXLevelIndicator (8–9,47,55–59) |
| tab-view | pressed#e6e6e6/#7b7c7d; disabled tertiary text/no accent; inactive#d5d5d5/#6a6a6a; focus ring (37–40) | pane switching,sizes/recommended2–6; Control-Tab/arrows,AXTabGroup (8–9,84–85) |
| box | radius4 to build with in light (fit3.875, rounded; dark fits4); inactive unchanged; unmeasured dark title white@.85 (28,55) | grouping/title/no nesting; AXGroup/fieldset (8–9,63–64) |
| separator | inactive unchanged (23) | padding-based grouping; nonfocusable/hidden or semantic separator (8–9,55–56) |
| focus-ring | outer radius = control radius+2.5 for rounded controls other than the fitted toolbar search field; entry≈3×thickness at zero alpha to final in≈.25s (25) | focus-mask/key-window removal; clear space≥3; Control-F7,3:1 contrast/Increase Contrast opaque,focus-visible (8–9,24,53–56) |
| bordered-list | pressed footer#d9d9d9/#6a6b6c (39) | list-footer selection/action semantics; keys/type-select/Delete,AXScrollArea/Table/rows (8–9,93–94) |
| tooltip | **not seen**: padding4×2,radius0,maxwidth≈300,pointer offset+8,+16; delay≈1.5s; fill#f2f2f2/#2a2a2a,border.5 black/white@.2,text@.85,shadow0 2 6 black@.25; fade in.1/out.5s (29–47) | help-tag purpose,hide10s,font11,wording/avoid obscuring target,AXHelp/ARIA (8–9,28,33,44,50–53) |
| status-dot | unseen yellow#f5bf4f (sRGB #febe2d)-class,rim−12%; gray#b0b0b0 (25) | system status image names,colour+text,nonfocusable AXImage (8–9,54–55) |

## Not reproducible in a browser

- Catalina text rasterization and SF metrics are platform-dependent. Use the system font stack and grayscale antialiasing where supported; do not promise identical glyph pixels on non-Apple systems (`label.md:95–98`).
- Native date/calendar/number/color/password widgets cannot be restyled consistently across engines. Closest approach: accessible segmented fields, custom steppers/calendar grid and nested color-well button; retain a real password input rather than exposing its value in decorative DOM (`date-picker:101–104`, `stepper:72–73`, `color-well:70–71`, `secure-text-field:51–52`).
- Device photos, app icons, clock metallic rim and gesture-video stills require image/SVG assets. Nested boxes do not recover the artwork (`image-view:66–67`, `date-picker:103`). A static preview does not verify animation cadence.
- Native tooltip timing/appearance is not controllable through `title`; a custom accessible tooltip is only an inferred approximation (`tooltip:55–56`). Vibrant switch composites depend on backdrop; use the specified material recipe/opaque fallback, not a fixed sampled composite (`switch:42,61–62`). Half-point borders require 2x-aware rendering with a 1x fallback.

## Open issues

### Verification evidence

- Final generator: `python3 <scratch>/sysBfin/generate.py --probe` exited 0: **34 exact ordered filenames, all viewed, all IDs known, every clean entry has an in-bounds crop; 702 sightings / 39 IDs**. Image sizes were read via `$M info` for every screenshot. `measurements.log` records `$M row` and `$M col` crop probes and `$M at` shared-toolbar landmarks in both appearances. Crops include clear AA/shadow margins. Frame origins were independently confirmed as x112,y76.
- Required verifier command: `python3 reference/spec/tools/build.py verify checkbox radio-button switch slider stepper text-field search-field token-field label date-picker color-well image-well image-view progress level-indicator tab-view box separator focus-ring bordered-list tooltip status-dot`. Before correction: 2 citations checked,0 mismatches. After correction: **3 checked,3 within its ±3 tolerance,0 mismatches,0 missing files**, exit0. The parser skips multi-colour/multi-citation rows, so this is not a 25-file pixel proof.
- Manual `$M at` audit: **59 pixel readings across checkbox, radio-button, slider, text-field, focus-ring, tab-view and label**. Three locations failed the ±2 criterion (two off-glyph coordinates and one glyph-shadow-contaminated fill location); corrected in **two checkbox rows**, then resampled. No other sampled comparison exceeded ±2. No mocks, substitute images or colour conversions were used.

| File and source screenshot | Explicit sampled positions (image px) | Result |
|---|---|---|
| checkbox; 10-15-Catalina-Light-System-Preferences-Network.png | 844,668;830,682;844,695;852,555;846,556; then852,572;850,556 | First3 pass;852,555 is shadow,846,556 is fill not glyph. Correct unobstructed fill#4d8af5 (sRGB #3b89fd) and glyph#ffffff now cited at94,97. |
| checkbox; 10-15-Catalina-Dark-System-Preferences-Network.png | 844,668;829,682;850,548;850,550;850,575;846,556; then850,556 | Original846,556 was blue fill#2d68d9 (sRGB #1866e1); corrected glyph#dee7f8 (sRGB #dce7fa). Other5 pass. |
| radio; 10-15-Catalina-Light-System-Preferences-Siri.png / 10-15-Catalina-Dark-System-Preferences-Siri.png | light1060,560;1043,576;1060,591;968,576;968,561 / dark1060,560;1060,562;968,562;968,591 | 9 pass. |
| slider; 10-15-Catalina-Light-System-Preferences-Displays.png / 10-15-Catalina-Dark-System-Preferences-Displays.png | light1300,404;900,404;1232,389;1232,420 / dark1300,404;900,404 | 6 pass; dark track#525253 differs by1 from#515152. |
| text-field; 10-15-Catalina-Light-System-Preferences-Sharing.png / 10-15-Catalina-Dark-System-Preferences-Sharing.png | both800,203;800,204;800,222;800,241;800,242 | 10 pass; source differences at most1. |
| focus; 10-15-Catalina-Light-Finder-Go-To-Folder.png / 10-15-Catalina-Dark-Automator.png | light500,204;500,207;500,208 / dark640,216;640,219 | 5 pass. |
| tabs; 10-15-Catalina-Light-System-Preferences-Sound.png / 10-15-Catalina-Dark-System-Preferences-Sound.png | light660,193;660,194;660,232;771,200;900,196 / dark660,194;660,196;771,200;900,196 | 9 pass; divider/unselected differences at most1. |
| label; light/dark Network, Notifications, Software Update (full filenames above or in coverage) | both Network738,322; Notifications674,428; Software Update262,591 | 6 pass: primary#232323/#e0e0e0;secondary#727272/#a4a4a5;link#276ad3 (sRGB #0168da)/#589df8 (sRGB #429dff),within2. |

### Remaining confidence limits and other-family findings

- All continuation outputs and requested audits are complete. Not independently verified: every inherited [M] row, unpublished pressed/hover/inactive variants, animation rates and documentation assertions. The full token harvest preserves their original confidence rather than claiming new evidence.
- `slider.md:87` has an inherited internal contradiction: x856−x832 is24 image px =12pt, while its prose says8pt and then12px. This layout value is not settled by the sampled colour audit; prefer the measured12pt Displays instance rather than consolidating8pt as universal spacing. `tab-view.md:81` likewise gives nominal20pt inner padding while its Sound coordinates yield23.5pt. Keep instance-specific exceptions.
- Boxes/list borders vary by pane, especially Users & Groups (`bordered-list:66–69`); do not flatten them into one border token. Dark Date Picker fill is not dark Text Field fill. Time Machine has a bar only in light; Startup Disk has a spinner only in dark; Trackpad selected gesture differs; Screen Time data, Notifications apps and Users & Groups rows differ between appearances.
- Other-family strong examples: toolbar focus in light Sharing/Sidecar/Time Machine; locked/disabled controls in Security & Privacy and Users & Groups; permission pop-ups in Sharing; Add a fingerprint image button; app-specific usage graph and gesture callout/movie. These are recorded, not rewritten as other agents' components.

## Deviations, concerns and assumptions

- The prior `sysB/cov.py` is an alpha-map helper, not a started coverage generator; a new generator was necessary. File tools refuse writes to absolute native scratch paths, so the script was authored in `reference/spec/.scratch/sysBfin/` with file tools and copied to native scratch for execution. No shell rewrites of component specifications were used.
- Crops represent visible instances, including constituents/compound patterns; screenshot pixels cannot establish every AppKit class or interaction. Application-specific charts are graphic evidence, not an invented generic chart API. There were no unanswered build decisions and no unresolved environment/dependency blockers.

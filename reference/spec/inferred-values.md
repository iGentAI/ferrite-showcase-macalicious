# Values that are inferred or documented rather than measured

Collected from the seven family reports in `handoff/` (section "Inferred values" of each). Every value
listed here is tagged [I] (inferred) or [D] (documentation) in its component spec, with the reasoning
next to it. Nothing here was sampled from pixels, either because no screenshot shows the state or
variant, or because the pixels cannot isolate the value (for example the tint of a vibrant material
when no clean backdrop exists).

## The gaps that matter most

| Gap | Why it could not be measured | What the spec gives instead |
|---|---|---|
| Pressed state of every control | a still screenshot never catches a mouse-down (the only exceptions are toolbar buttons and segments captured in their "on" state) | [I] rules per component: push buttons take the accent bezel with a white title; accent fills darken by about 12%; toolbar buttons darken by about 12% |
| Controls in an inactive window | only a few background windows are visible (Mail viewer, Safari behind Picture in Picture, Finder behind Quick Look, the Command-Tab captures) | measured: title bar, toolbar buttons, window controls, sidebar and its selection, tab bar. [I]: default button, pop-up cap, checkbox and radio lose the accent and draw as the unselected bezel with a dark glyph |
| Hover states | macOS has almost none; the window-control glyphs are captured (close and zoom), the minimize glyph is not | [I] minimize glyph from the same darkening ratio |
| Mini control size | no mini push button, pop-up or checkbox with a clean edge | [I]/[D] 14 to 15 pt heights and 9 pt text from AppKit's size ramp; one mini segmented control is measured |
| Emphasized selection for the seven non-blue accents | tables and lists are only captured with the blue accent | [I] an offset from the accent fitted to the measured blue pair (the library uses an oklch offset). An earlier recipe (pop-up cap 75% stop darkened 10%) is withdrawn: for blue it misses the measured value by 24 levels of red. Text-selection highlight presets ARE measured for all 8 |
| Focus ring for non-blue accents | captured only in blue | [I] swatch colour at 0.5 alpha, the measured blue recipe |
| Legacy (always visible) scroll bars; overlay scroller over dark content | none shown; only two overlay knobs appear in 294 screenshots | [D] track sizes from the HIG, [I] colours |
| Open submenu, contextual menu, Dock menu | none is open in any screenshot | container, rows and separators are measured on other menus; offsets and overlap are [I] |
| Tooltip, Save panel, drawer, placard, circular slider, disclosure button, Safari favorites bar, standard secure text field, AppKit round button | not seen | short [D]/[I] specs so the inventory is complete |
| Sidebar icon sizes small and large; selected icon in icon view; Dock magnification, hover labels, grid and list stacks | only the default states are captured | [I] with reasoning in each spec |
| Blur radius and saturation of materials | a screenshot shows the composite, not the recipe | fitted where the uncovered wallpaper is available (menus, Notification Center, Spotlight light, Launchpad, sheets); otherwise [I]. See `components/material.md` |
| Font weights and sizes of large display text | sizes are computed from cap heights (about 1 pt uncertainty above 20 pt); weights are judged from stem widths | tagged [C]; listed per component |
| Timing of every animation | stills | [I]/[D] durations only where a spec needs one |

## Buttons and choosers (System Preferences A to M)

Source: `handoff/sysA.md`.

Every[I] and[D] assertion in the15 seeded specs is grouped below; repeated API/behaviour claims are not extra measured tokens. References are the named file's Purpose, States, Measurements, Layout and Keyboard sections. New component assumptions follow afterwards. No inferred pressed/inactive/disabled recipe was validated by this pixel audit.

| Component | [I] values / assumptions | [D] values / behaviours carried from documentation |
|---|---|---|
| push-button | regular/small radius3.5px adopted in CSS (measured3.75, kept in push-button.md);mini14pt,mini radius2.5 as built (the sheet earlier proposed3; neither is measured);pressedaccentfill/whitetitle,dark−10%;3pt50%-accentfocus with7ptradius;inactiveunchanged;minimumtitle+28pt/floor56 | text-only action,titlecase/verb/ellipsis;content-not-toolbar;one default;nohover;mouse-upinside;centredsingle-line/middleellipsis;mini9ptfont;fixedheight/intrinsicwidth;Space,Return,Escape,Cmd-Period,FullKeyboardAccess;AXButton/title/disabled webmapping |
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
| pull-down-button | pressed/open−12%cap;inactiveuntintedcap/fullcontrastglyph | staticmenutitle,commands/menuitems,gearAction;menubelow/leftaligned;Space/Down;AXMenuButton/ARIA menubutton |
| combo-box | unfocusededgeabout#b5b5b5top/#c8c8c8side,no2.5ring;openlistmenu-like13ptnocheckmark;inactiveuntintedcap;radius1field/3.5..4button;Regular13anddarkwhite.85text | editablevalue+list,typedvaluenotadded;meaningfuldefault/relevantchoices/titlecasecolon;below-fieldlistfieldwidth,Downopens/completesautocomplete;labelbaselinealignment;typing/arrows/Return/Escape;AXComboBox/ARIAeditablecombobox |
| segmented-control | radius3.75 in dark taken from the light fit (dark not fitted);selectedas-tab-view;presseddefaultaccent/whiteglyph;inactivemomentaryunchanged/selectedgrey;Regular13/baseline14.5unmeasuredoutside tabs | selectOne/selectAny/momentary;equal-widthrelatedchoices,notmixedtitle/icons;10pttitlepadding/.fillEqually10.13+assertion;arrows/Space;AXRadioGroup/RadioButton,CheckBoxgroup,Buttonbymode |
| color-swatch-picker | thumbnail image radius4.5 to build with (grid reading4.5..5, not fitted; 6−1.5 only if the ring's inner edge is concentric);privateclassesunknown;initialappearanceLightnotobservable;Auto schedule;nohoverdecoration;pressedimage-darkening;disabled.5;focusinadditionselection;inactivetintunknown;demo-ownedAuto,rovingradio mapping | controlAccentColor,NSAppearance/isEnabledAPI;immediatepreferences;mutuallyexclusivechoices;AXRadioGroup/RadioButtonandarrow/Spacepattern |

Additional files: `preference-pane-icon` [I] custom/private classes,40×40allocation,invisiblehitbounds/5ptpadding,inactive/disabled.5,pressed/focusinherited; [D] image-button/Space/AXButton and pane-title behaviour. `account-header` [I] custom grouping,unknownsigned-outdefault/layout,long-namehandling,inactivetint,asset/demo navigation,AX/web grouping; [D] image/string/hidden APIs and documented preferences/image-button behaviour. `new-item-dot` [I] “new” interpretation/read-clearingmeaning,customview,accent-followingunknown,same-blue darkfallback,nohitrole/AXroleunknown,accessible-status mapping; [D] non-action feedback guidance/hiddenAPI. `gesture-option-row` [I] custom view/checkbox/select mapping,independenttutorialhighlight,dependentchoicedisabling,invisiblehitrect/hovermeaning,statesusechildrecipes; [D] independentcheckboxsemantics,Space,immediatepreferences. All font guesses from cap heights are[C], not[D]; sizes19±.5 and radius5/5.5±.5 explicitly retain uncertainty.

## Inputs, indicators and containers (System Preferences N to W)

Source: `handoff/sysB.md`.

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

## Window chrome

Source: `handoff/chrome.md`.

Every inferred or documented constraint is grouped by component here. Numeric [I] candidates are also retained in the token table; documentation establishes behaviour, not raster dimensions. The archived HIG/AppKit references are in each component's header. New template additions restate existing constraints rather than pretending unseen variants were measured.

- **window:** [D] main/key/inactive distinctions, dragging/resizing, vibrancy policy, app-defined minimum size, close/minimise/full-screen/cycle shortcuts and AX window roles. [I] wallpaper tinting as the cause of observed dark RGB differences; one corner radius of 5 for all four corners (the bottom corners fit 5.125, coarsely). No whole-component absence.
- **window-shadow:** [D] inactive windows fall backward; class signals stacking. [C] recovered in-situ inactive/menu alpha, fitted Gaussian CSS and edge separation. Sheet class not measured here; owned by sheet spec. Single-pixel alpha is dithered and must not replace nine-line means.
- **title-bar:** [D] title/proxy behaviour, rename/tag/move, edited suffix/dot, middle truncation, double-click policy and Command-click path menu. [I] inactive title #b9b9b9/#606163, default SF tracking. Rename/edited states not captured. Utility font/standard font are computed from cap height, not documented exact sizes.
- **window-controls:** [I] pressed20% black; minimise glyph8×1.5; enter-full-screen triangles/gap1; Option zoom+8×8/stroke1.5; Graphite enabled zoom same grey; minimise hover #90591d/#91591d. [D] edited close-dot, hover-group/key-loop policy, disabled/full-screen action semantics, Option zoom and shortcuts/AX roles. Pressed, edited and Option glyphs not shown.
- **toolbar:** [D] toolbar-only textured styles, customisation modes/sheet, hiding, overflow/flexible space, translucent scrolled state, menus for commands, drag area and Full Keyboard Access Control-F5. Text-only/small/customisation/hidden modes not captured. No own fill; inherits title-bar.
- **toolbar-button:** [I] radius 4px as built by the window-chrome batch, an adopted engineering value and not a measurement (fitted: 4.25 on the light border, 3.75 on the border-less dark fill); shadow rgba(0,0,0,.03) to build with (computed .034); pressed gradient ×.88 in light/+10% white in dark; focus3 as search field; padding8 computed estimate. [D] immediate action/toggle semantics and accessible naming. Pressed/FKA focus not captured; disabled, inactive and selected examples are captured.
- **toolbar-segmented-control:** [I] dark ends radius3.75 to build with (the dark fit's optimum is3.625, with3.75 nearly as good); pressed inherits toolbar-button; text13 Regular and exact selected text colours unmeasured in Calendar/Maps examples. [D] tracking modes/equal widths/icon-or-text and keyboard/AX selection semantics. Text-based toolbar variants not measured here.
- **toolbar-pop-up:** [I] open bezel=on, inactive=button inactive, title13 Regular; title pop-up not shown in toolbar. [D] pop-up vs command pull-down, leading-edge menu alignment and keyboard/AX menu pattern. Open menu not captured; split Preview highlight is captured disabled.
- **toolbar-search-field:** [I] disabled glyph/text #aaaaaa/#8e9090; inactive bezel/unchanged placeholder; token criterion10 Semibold/value12–13. [C] ring-alpha recipe from observed composites. [D] recent-search menu, search timing/scopes, Command-F/Escape/Return/Down navigation. Disabled/inactive/recent menu not shown; only blue focus accent captured.
- **toolbar-labelled-item:** [I] inactive label uses disabled colour, visible union is not a measured hit box. [C] baseline proxy is the clear row after ink; 11 pt font from cap height. [D] label wording and preference selector/command distinction. Text-only mode not seen. Console and Disk Utility label colours differ spatially; not a universal exact RGB.
- **window-tab-bar:** [I] hover fill halfway between active/inactive, close hit14/cross8/stroke1/inset6; equal-flex layout recommended despite captured stepped widths. [D] tear-off/close/new-tab/cycle shortcuts and AX tab pattern. Hover close not seen; captured widths are not fixed layout tokens.
- **safari-tab-bar:** [I] hover inherits window-tab-bar and inactive-window active light cell #f6f6f6-like. [D] favicons preference, reorder/tear-off and tab shortcuts. Pinned/favicons/audio tab indicators not captured; Smart Search audio indicator is a separate sighting.
- **smart-search-field:** [I] exact Reader-on28 px-derived width, dark accessory #b0b0b0 and split tile field348 wide. [D] unfocused domain/lock vs focused URL selection, completion and keyboard navigation. Typing/completion list not shown. Do not call inferred split width measured from original pixels.
- **favorites-bar:** **not seen in the screenshots**. All visual values [I]: height25, text12, padding8/gap4, pill19/radius4, fills/separators/text/pressed alpha in table; no independent shadow, provisional folder chevron reuse. [D] bookmark/folder/overflow/reorder and Command-Option-1..9 behaviour. The Favorites page is not this bar.
- **scope-bar:** [I] hover outline1, inactive pill #c8c8c8/#505050, dark Preview pill #b6b7ba and its radius3.75 (not fitted: bar and pill are not flat), and extra criteria rows32. [D] recessed scope toggles versus action buttons and predicate-editor behaviour. Font/Save height are computed. Hover/pressed/inactive not captured.
- **path-bar:** populated path components **not shown**. [I] icon16, text11/gap4, chevron5×8/gap6, leading8, text/chevron colours in table. [D] path styles, drag destinations, expand/truncate/double-click, layout above status strip. Empty bar is measured; no independent shadow.
- **status-bar:** Finder count/free-space variant **not seen**. [I] height23/text11/slider64/trailing8/fills/lines/text in table; app bottom-control behaviour and System Information breadcrumb font size not derived. [D] rare window bottom bar, app-defined role/default and Finder behaviour. Automator/Script Editor/System Information heights/colours are measured, not guessed Finder geometry.
- **popover:** [I] blur30/saturation1.5/tint .94 recipe; blur kernel is not recoverable. [D] anchoring/behaviour/detachment/Escape/focus/accessibility and source-listed scale-fade~.2s. Detached/animated states not captured; exact animation duration not pixel-verified. [C] arrow path/tip radius/content padding.
- **quick-look-panel:** [I] inactive buttons fade as inactive toolbar, neutral fallbacks #e6e6e6/#2d2d2d, blur40/saturation1.8, key-panel shadow. [C] tint .60 white/.42 rgb70 and titlebar/radius/font estimates. [D] Space/Escape/arrows/open-app/full-screen semantics. Multiple files/index/full-screen/other file types/inactive panel not shown.
- **markup-toolbar:** [I] disabled .35 opacity, pressed20% darker, exact chevron metrics and dark glyph/fallback values. [C] swatch15/frame1 from scaled crop. Preview host not seen (closed); only Quick Look host measured. Complex vector glyphs need assets/redrawing; dark button colour was not fully sampled.
- **share-menu:** [D] service handoff/edit views/More Extensions and keyboard menu pattern. Finder/Preview file-share variant not shown; Safari page share is shown. Font14/inset37.5 computed. Native sharing services cannot be inferred from pixels alone.
- **picture-in-picture:** [I] scrim .5, play44/close-return28/inset10, placeholder #8c8c8c, white overlay and inactive shadow; overlay/caption exact font unmeasured. [D] corners/free Command-drag/resizing/source-ratio and default width about quarter-screen. Hover controls not seen.
- **full-screen-window:** [D] hide/reveal policy, auxiliary role, Space/Mission Control behaviour, extra-space layout, shortcuts and source-listed transition~.5s (not pixel-verified). Transition/auxiliary variants not shown. Title13 computed; no outer shadow is measured absence.
- **split-view-full-screen:** [D] focus changes, draggable divider/reset/app minimum widths and Mission Control; divider dragging dim/blur state not captured. [C] handle radius2. Body typography belongs to each app; no independent split glyph or shadow.
- **web-view:** [I] Reader canvas/sheet colours, subtle unfitted article shadow; [D] loaded embedded content, thin loading accent line and no independent frame. Loading not shown. Reader font and scroller size are computed estimates, not exact engine metrics. Dark pages are site-defined.
- **drawer:** **not seen in the screenshots**. [I] all geometry/fill/border/inactive-shadow and slide~.25s values in table; overlap under parent unspecified. [D] anchored non-detachable drawer, edge/state choices, app-defined content and HIG discouragement. No drawer-specific typography/material measured.
- **placard:** **not seen in the screenshots**. [I] height15/text10–11/fill/separator .5, no independent shadow, content-defined width/glyph. [D] historical scroller accessory placement/content and HIG discouragement. Do not treat bordered-list footers or Maps Show as placards.
- **window-banner:** [I] trailing action uses scope round-rect, content app-defined, dark text #a7a8ab-like not sampled. [D] Finder accessory/banner use. Only Shared Folder text-only variant captured. Label11 Bold/baseline17 computed; no independent shadow.

## Data views

Source: `handoff/views.md`.

- `sidebar`: small/large row heights (20/32 pt) [I]; hover "Hide/Show" [D behaviour]; disabled and drag-target rendering [I]; material tint recipe [I]; dark triangle colour [C]; footer button offsets [I].
- `sidebar-badge`: key-window, selected and accent-selected pill colours [I] (only an inactive-window pill is captured).
- `table-view`: disabled, editing and drop-target states [I]; default rowHeight/intercellSpacing [D].
- `table-header`: pressed, dragging, inactive states [I].
- `outline-view`: dark triangle colours [C]; dimmed-row text colours [I]; triangle animation [I]; Automator row pitch [C].
- `list-view`: swipe actions [I].
- `column-view`: unemphasized parent-column selection [I]; dragging state [I].
- `icon-view`: every selected-state value (icon backdrop, label pill) [I] because no Finder window shows a selected icon; dark label colour [C]; View Options ranges [D].
- `gallery-view`: accent-focused strip state [I]; dark row separator [I].
- `split-view`: pane-splitter (10 pt) divider [D] (not shown); pane-splitter appearance [I]. The thick (9 pt) divider is measured ([M]) in the Sharing pane (band x 904..921, dimple y 757..768), so it is no longer inferred.
- `scroll-view`: knob over dark content [I]; expanded overlay scroller [I]; the whole legacy always-visible scroll bar [I] with [D] track sizes; timings [I].
- `text-view`: dark and inactive selection colours [I]; blink timing [I].
- `ruler`: dark marker colours [I]; marker-drag behaviour [I].
- `tag-dot`: yellow and purple colours [I]; selected-row and multi-tag rendering [I].
- `empty-state`: plain "No Selection" label style [I].
- `message-bubble`: sending/other states [I]; max width [I].
- `map-controls`: pressed/disabled [I]; label sizes [C]; compass size approximate.
- Blueprints: positions explicitly marked "visual" / "[I]-grade" (Network Utility inner text layout, AirPort Utility artwork positions, Maps place-card layout, Contacts card typography, Reminders "+" button position) were read from the half-scale previews, not sampled.

## System surfaces and menus

Source: `handoff/system.md`.

By component (everything tagged [I] or [D] in the files; [C] values are listed in the token table):
- **menu-bar:** blur radius of the bar material (backdrop under the bar is never visible); neutral-page opaque fallbacks; disabled-title and inactive states; CSS approximation of vibrant title colour.
- **menu-bar-extra:** disabled glyph state; cell boundaries for Wi-Fi, AirPlay, clock, Spotlight, Siri and Notification Center are [C] from neighbouring measured highlights.
- **menu:** scroll-arrow row, open/close animation.
- **menu-item:** mixed-state dash, alternate items, chosen-item blink, 14 pt checkmark scale, `rgba(0,0,0,0.85)` text recipe, indentation step [D].
- **submenu:** everything about an *open* submenu (offsets, overlap, highlight of the parent, hover delay). No open submenu exists in the library.
- **contextual-menu:** not seen. All light values and the pointer-relative origin are [D]/[I]; dark geometry is measured on the closest analogue (a detached Contacts action menu).
- **dock-menu:** not seen. Entirely [D]/[I], including the claim that Catalina's Dock menus always use the dark material (from memory; flagged in the file).
- **dock:** dark material tint/alpha (dark backdrops too uniform to solve), neutral fallbacks, hover label, magnification, bounce.
- **dock-stack:** grid and list views, hover state, rotation of the upper fan items, thumbnail shadow.
- **desktop:** horizontal grid pitch (only one icon column exists), selection rectangle.
- **desktop-icon:** selected, renaming and dimmed states.
- **desktop-stack:** fan angles, sub-dimensions of the placeholder, light placeholder colours, scrub/selected states.
- **spotlight:** collapsed state, dark material alpha (window capture has no backdrop), preview body line pitch.
- **notification-center:** empty and edit states, footer gear geometry, neutral fallbacks.
- **today-widget:** stocks pill radius, summary line pitch and glyph, event bar, switch size (deferred to sysB `switch`), hover/edit states.
- **notification-banner:** hover and pressed states.
- **launchpad / launchpad-folder:** searching, pressed and jiggle states; label shadow; closed-tile geometry; rename state; the folder-open background recipe is a poor fit and marked approximate.
- **mission-control:** bar material recipe (no clean backdrop of that wallpaper), ring radius, hover states, collapsed bar, window extents.
- **app-switcher:** panel recipe alpha/blur (windows behind are not available un-covered).
- **siri:** chrome alpha, card corner radius, orb size, listening state. No HIG page was fetched (Siri is not under the macOS HIG section).
- **dictation:** corner radius, dark alpha, Done weight, pressed state, shadow.
- **login-window:** field radius, typing/error states, text shadow, name weight.
- **time-machine-browser:** background recipe, Restore-enabled state, button right edge/gap/radius, down-arrow offset, tick lengths.

## Dialogs, panels and accents

Source: `handoff/dialogs.md`.

Every value tagged [I], [D] or a mix in the 15 component files (line numbers are the component file's).

- `alert`: button order and placement, default rightmost, third button at the left of the row [D: HIG Alerts, lines 16 and 120]; keyboard (Return, Escape, Command-period, Command-D for "Don't Save") [D]; inactive rendering (default button loses the accent) [I]; sheet presentation (same layout, no title bar) [I]; suppression checkbox (small checkbox, left-aligned with the text column, 8 pt below the informative text) [D/I]; critical style badge (32 pt caution triangle over the icon's lower-right quadrant) [I]; informative-text line pitch 14 pt [I] (one line shown).
- `dialog`: purpose and button placement rules [D: HIG Dialogs]; Return/Escape/Tab keys [D]; inactive state [I].
- `sheet`: purpose, no stacking, tabbed-window rule, parent can move but not close [D: HIG Sheets]; open/close animation 0.2-0.25 s ease-out [D/I]; parent-inactive rendering [I]; opaque fallback `#ececec` / `#323232` [I]; material recipe blur 30 px, saturate 1.2, tint `rgba(236,236,236,0.72)` / `rgba(40,40,40,0.75)` [C]/[I].
- `open-panel`: purpose and HIG rules [D]; keyboard shortcuts [D]; options expanded, search active and sheet presentation [I]; dark sidebar-header text `#9a9a9b`-class [I].
- `save-panel`: **the whole component** (not in any screenshot). Behaviour, default button "Save", name field focused with the base name selected, shortcuts [D: HIG Dialogs, NSSavePanel]; collapsed layout and width about 450 pt [I]; label column 8.5 pt before the control [I]; text field 22 pt, pop-up 20 pt, row pitch 30 pt [I]; buttons 20 pt tall, 69..83 pt wide, 13 pt apart, 20.5 pt margins [I]; expanded browser identical to `open-panel` [I]; sheet attachment, material, shadow as `sheet` [I]; disclosure button 8 pt right of the name field, animated expansion [D/I].
- `print-panel`: purpose and pane guidance [D: HIG Printing]; keys [D]; simple form (about 150 pt shorter) [D/I]; content of the Copies and Pages rows hidden behind the open menu [D].
- `preferences-window`: modeless, non-resizable, minimize and zoom disabled, apply immediately, restore last pane, window resizes when the pane changes [D: HIG Preferences]; inactive state [I].
- `preferences-toolbar`: non-customisable, always icon and text, selection stays highlighted [D]; no hover state [D]; full-keyboard-access keys [D]; pressed item (black 0.25 over the icon) [I]; selected item in an inactive window (50% opacity) [I]; disabled item (35% opacity) [I].
- `inspector-panel`: panel rules, inspector vs Info window [D: HIG Panels]; disclosure keys (Space, Right expands, Left collapses) [D: HIG Disclosure Controls]; inactive window [I].
- `progress-window`: determinate bar, description, estimate, cancel [D: HIG Progress Indicators]; Command-period cancels [D]; indeterminate, paused, finishing states [I]; additional operations add rows of about 46 pt separated by a 1 pt line [I].
- `notification-alert`: banner vs alert behaviour, content guidance [D: HIG Notifications]; VoiceOver exposure [D]; pressed button darkens its half by black 0.1 [I]; hover "Options" pull-down [I]; two-button column split with a 1 pt line [D/I]; on-screen material recipe blur 30 px, saturate 1.8, tint `rgba(246,246,246,0.72)` / `rgba(40,40,40,0.72)` [I]; position 8 pt below the menu bar and from the right edge, 8 pt stacking gap [D/I]; slide-in about 0.3 s [I].
- `about-window`: app About panel rules (modeless, close button only) [D]; standard app About panel layout, about 284 pt wide [D/I, not shown]; Control-Tab cycles tabs [D]; other tabs and inactive window [I].
- `assistant-window`: onboarding guidance [D]; keys [D]; later steps: "Go Back" 13 pt to the left of "Continue", progress bar [I].
- `accent-colors`: `AppleAccentColor` values (-1 graphite, 0 red, 1 orange, 2 yellow, 3 green, 5 purple, 6 pink, unset blue) and `currentControlTint` mapping [D]; use `controlAccentColor` [D: HIG Color]; graphite disables desktop tinting in dark mode [D: HIG Dark Mode] (also measured); inactive-window controls lose the accent [I]; pressed = fill x black 0.12 [I]; disabled = 50% opacity, no accent [I]; graphite zoom button in its active state is the same grey as close/minimize [I] (the thumbnail shows three grey dots [M]); dark graphite menu selection `rgba(255,255,255,0.25)` over the menu material [I]; focus ring for non-blue accents = swatch at 0.5 alpha [I]; default button for non-blue accents = that accent's cap gradient [C]; accent picker is a radio group for accessibility [I]; do not rely on colour alone [D].
- `highlight-color`: token semantics (`selectedTextBackgroundColor`, `selectedContentBackgroundColor`, emphasised vs unemphasised) [D: AppKit, HIG Color]; inactive window = unemphasised [D]; selected-text colour unchanged in dark [I]; dark selected-text background on real text taken from the swatch [C]; emphasised row colour for the seven non-blue accents [I] (two recipes are given, see "Open issues" item 3).

## App-specific patterns

Source: `handoff/apps.md`.

This register covers every [I]/[D] claim in the scoped component files, including inherited behaviour claims rather than promoting them to measurements. Source sections contain the exact reasoning/document citations. [C] material fits remain approximate even though they are not [I].

| Component | [I] values / behaviour not shown | [D] basis |
|---|---|---|
| hud-window | idle fade/drag; pause bars 5 wide, gap 6, height 25; pressed .5, disabled .3; scrubbing thumb unchanged; blur30/saturate1.8/tint(30,.35)/fallback `#3d3d3d`; white .9 plus-lighter/fallback `#f2f2f2`; unfilled volume=unplayed scrubber. Unseen titled HUD: radius6, titlebar19, title11 white .85, close10, labels white/secondary .55, tracks/buttons white .25; standard shadow. AX/ARIA grouping. | HIG Panels purpose/simple controls; QuickTime shortcuts Space, arrows, J/K/L, volume arrows (Help assertion, not executed). |
| media-app-chrome | Podcasts' Catalyst classification from scale; pressed change20%; pause glyph18×20; LCD hover track3 and time10. | HIG sidebar navigation/toolbar segments; app-menu shortcuts Space, Cmd-arrows volume/track, Cmd-F, Cmd-number segments. |
| catalyst-chrome | inactive toolbar `#f6f6f6` / `#2b2d2f`; unseen switch39×24, knob21, on `#34c759 (sRGB #00cc47)`, off rgba(120,120,128,.16/.32), shadow0 2 6 black .15; unseen segment height25 radius7, track rgba(118,118,128,.12/.24), selected white/`#636366`, label10 Medium. | HIG .77 content scale, sidebar/menu/keyboard adaptation, Cmd-W/Tab and supported focus navigation. No switch/slider/stepper/iOS segment is shown. |
| calculator-keypad | display drags window; pressed function `#6f7173` (white .2), digit `#a5a6a7` (.4), operator `#c2812f (sRGB #cc7e0a)` (black .2); armed operator inset1; inactive unchanged except traffic; fixed basic size/zoom; interpreting neutral palettes as appearance variants; spoken key/output semantics. | Calculator Help digits/operators, Return, Escape/C, %, Option-minus, Delete (not executed). |
| sticky-note | widget hover/press darkens; collapsed height12/text9; blue strip `#8eeafc (sRGB #6decff)`, border `#5fc3d8 (sRGB #2ac5db)`; unshown sRGB green/pink/purple/gray `#b2ffa1 (sRGB #99ff96)` / `#ffc7c7 (sRGB #ffc4c6)` / `#b6caff (sRGB #b2caff)` / `#eeeeee`, derive strips by yellow ratios; right text inset11.5; cascade10/10. | Color-menu choices; default Helvetica12; Cmd-N/W/M, Cmd-Option-F/T, Cmd-1..6 from menus. |
| card-grid | hover play/more overlays; pressed dims10%; OPEN/cloud/progress unshown (progress21); fixed gaps/margins during resize; arrow/Return/Space collection navigation and AX semantics. | No additional [D] value claims. |
| store-pill-button | purchase/confirm/download/OPEN sequence; no hover; pressed .5; confirmation blue/white, width grows; progress21/stroke2/stop6; disabled .35; capsule focus ring; OPEN/UPDATE reuse style; long-label minimum padding12; capsule-only hit area; Full Keyboard Access Tab/Space; AX label includes offer/app and caption help. | HIG push-button title/verb/fitting rules. |
| now-playing-lcd | radius to build with2.5 Music/2 Podcasts in light,2.5 Music in dark (fitted optima rounded); dark Podcasts radius not settled (fit2.75 at one corner against1.875 in light, open observation;2.5 provisional);hover scrubber/MiniPlayer; light-loaded title black .85/subtitle .5, progress `#7f7f7f` / `#d9d9d9`; inactive .5; Music artist—album format; hover times10 Regular/6 inset, negative remaining; scrubber3×9; text side inset≥6; AX group/slider. | HIG progress/sliders analogy; Music Space/Cmd-L menu shortcuts. |
| page-control | dot clicks; arrow steps/nonwrap; disabled .3; pressed black/white .2; no hover; inactive current becomes grey; app-specific fixed accent; hit targets36×20 pager/20×20 overlay; AX page labels. | Photo Booth/Launchpad Cmd-arrows; Launchpad swipe/click Help. |
| homekit-tile | click toggle/run, double/right click controls; pressed scale .95/spring; Updating/No Response off text; no hover/focus, inactive unchanged; blur20 (tint is [C]); no native keyboard focus/AX joined-label semantics. | HIG translucency foreground/background blend. |
| stock-row | selected fill `#f2f2f3` / `#575858`, pressed same; badge pressed .7; missing quote `--`/grey; inactive unchanged; sparkline price-range scaling incl. previous close; right-pinned layout81; arrow/Return/AX joined row. | Stocks guide badge cycles change/%/capitalisation, edit reorder/remove; HIG table analogy. |
| waveform-view | audio-envelope data/seeking seconds; unplayed recorded bars unknown, provisional same red; retained handle on hover/press/drag; trim/selection unknown; no measured disabled opacity; accessible focus outside plot; inactive palette/fixed app-red accent; fixed-centre scrolling, overview marker motion; unknown minimum/zoom; ARIA time slider/keys/step; browser rasterisation and native downsampling not established. | Cached HIG sliders current-value/live-feedback and keyboard-access guidance, not app-specific gesture evidence. |

Blueprint [I]/[D] additions, by app: **Books** none explicitly tagged; **Calculator** neutral cause unproven [I]; **Chess** preview board corners (~148,669 / 828,669 / 782,110 / 194,110 pt) [I]; **FaceTime** backdrop cause [I]; **Home** blur20 [I]; **App Store** obscured hero body13 [I]; **QuickTime** titlebar/controller visibility and backdrop cause [I]; **Stocks** title13 and dark lead298×224 preview estimate [I]; other apps have no extra [I]. Uncaptured menu bars [D] are transcribed in Calculator, Chess, FaceTime, Home, App Store, Music, News, Photo Booth, Podcasts, QuickTime, Stocks, TV and Voice Memos (each blueprint's Content section). Stickies' obscured blue-note full default text [D] is supplied in `apps/stickies.md`; only exposed fragments are measured. These menus/default text and inherited Help assertions were not checked in a running Catalina installation.

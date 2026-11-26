# macOS 10.15 Catalina: component inventory and measured design specification

This folder is the brief every component and demo thread builds from. It says which Catalina UI
components exist in the 294 reference screenshots, what each is called in AppKit and the Human
Interface Guidelines, how it behaves, and what it measures, in light and dark, with every number
traceable to the pixels it came from.

## Start here

| You want to | Read |
|---|---|
| Build a component | `components/<id>.md` (its spec), then `tokens.md` for shared values |
| Know what exists and where it is shown | `inventory.md` (table) or `inventory.json` (every sighting with crop rectangle) |
| Set up or correct the token layer | `tokens.md`, `tokens.json` |
| Rebuild an app as a demo | `apps/<app>.md` (blueprint) and `build-plan.md` (which apps, which screenshots) |
| Plan the work | `build-plan.md` (batches, waves, dependencies, demo ranking) |
| Know how far to trust a number | `CONVENTIONS.md` (tags), `inferred-values.md` |
| Know what a browser cannot match | `browser-limits.md` |
| Check a citation or measure something new | `tools/measure.py`, `tools/corner_fit.py`, `tools/build.py` |
| See the Apple sources | `sources.md` |

## What is here

| Path | Contents |
|---|---|
| `CONVENTIONS.md` | Units, coordinates, colour space rule, provenance tags, measuring rules, spec and blueprint templates |
| `inventory.md`, `inventory.json` | 162 components and patterns in 13 categories: 146 present, 16 not seen. For each: AppKit name, status, number of screenshots showing it per appearance, one clean example per appearance (file and crop rectangle), build batch, and what implements it in this repository (the component folder, or the token files for a row that specifies token behaviour). The JSON also lists every recorded sighting (5,430 from the review, and those added since through `inventory-meta.json`) and, per screenshot, the components seen in it |
| `components/` | 152 component specs. Ten rows have no file here: `calendar-week-grid` and `calendar-mini-month` are specified inside `apps/calendar.md`, `smart-list-tile` inside `apps/reminders.md`, `color-wheel`, `color-sliders` and `color-palette` (the pickers of the Colors panel) inside `components/color-panel.md`, and `window-manager`, `managed-window` and `token-field-completions`, which no screenshot can show, and `borderless-button`, which is a title alone, on their components' docs pages |
| `apps/` | 102 blueprints covering all 61 apps and system surfaces in the manifest. System Preferences has a shell file plus one file for each of its 33 panes; Finder, Safari and the system surfaces are split over several files |
| `tokens.md`, `tokens.json` | Token sheet mapped onto `src/styles/tokens/*.css`: 183 core tokens (all 183 present in the token layer, none proposed), the accent matrix (25 values for each of 8 accents, light and dark), and 938 component-level values from the family reports |
| `build-plan.md` | 15 build batches in waves 0 to 4 (tokens and label first), a sixth wave for the demos, and the ranked demo apps (12 recommended, 8 reserves) with the screenshots each must match |
| `browser-limits.md` | What cannot be reproduced in HTML, CSS and JavaScript, with the closest approach |
| `inferred-values.md` | Everything that is inferred or documented rather than measured, by family |
| `sources.md` | The 88 archived Catalina-era HIG pages and 102 AppKit reference pages used |
| `coverage/` | Review record: one JSON per review group listing, for each of the 294 screenshots, a summary and every component seen with crop rectangles |
| `handoff/` | `components-remeasure.md` (the 72 lines re-measured after review, with old and new values, and the six values re-measured on 2 October 2026 after build feedback) and seven family reports from the measurement passes: token candidate tables with pixel evidence, audit results, contradictions between screenshots, open issues. Working documents; the files above are the consolidated result |
| `tools/` | `measure.py` (pixel sampling), `corner_fit.py` (fits a corner radius to the pixels), `test_corner_fit.py` (tests of the fit on synthetic corners of known radius), `test_build.py` (tests of which side of a token row `build.py` converts to sRGB) and `build.py` (generates inventory, tokens and sources; checks and audits the specs) |
| `inventory-meta.json`, `tokens-core.txt`, `tokens-intro.md`, `sources-data.json` | Hand-maintained inputs of the generated files |

## The numbers

- **Screenshots reviewed: 294 of 294** (155 light, 139 dark), each opened and looked at, then
  catalogued in `coverage/`.
- **Components inventoried: 162.** The review of the screenshots inventoried 142: present in the
  screenshots 133, not seen 9 (drawer, placard,
  Safari favorites bar, disclosure button, circular slider, tooltip, contextual menu, Dock menu,
  save panel). The contextual menu is counted as not seen because no Control-click menu is open; the
  closest thing is the field-label action menu in the dark Contacts capture, which uses the same menu
  container and is what `components/contextual-menu.md` measures its geometry on; these have short specs built from documentation and inference so that the inventory
  is complete. Two more are present only in a non-standard form and say so: the round button (only
  app-drawn circular buttons in Contacts) and the secure text field (only the login-window style).
- **Added on 6 October 2026 by the inventory gap closure: 6 rows.** Two were visible in the
  screenshots and had no row: `form` (the label and control columns of every preferences pane) and
  `system-image` (the standard template images of toolbars, list buttons and tables); both have
  specs measured that day. Four were component folders that had been built without a row:
  `calendar-mini-month` (present, in the Calendar captures) and `window-manager`, `managed-window`
  and `token-field-completions` (not seen: behaviour, or a state no capture shows). Since then every
  row also says what implements it, and `build.py check` fails on a row that nothing implements and
  on a component folder without a row.
- **Added on 6 October 2026 by batch B10a: 2 rows.** `editorial-card` (the App Store's editorial
  panel and the hero banners of the App Store and TV) and `shelf-pager` (the paging chevrons of a
  shelf) are members of the `card-grid` pattern that were built as components of their own; both
  are present in the screenshots and have specs measured that day.
- **Added on 7 October 2026 by batch B10a: 2 rows.** `book-cover` (the cover cell of the Books
  library) and `story-card` (the lead and secondary stories of News) are the last two members of
  the `card-grid` pattern, built as components of their own; both are present in the screenshots
  and have specs measured that day.
- **Added on 6 October 2026 with the Colors panel: 4 rows, all not seen.** No screenshot has the
  Colors panel open, but the colour well, which is shown, opens it: `color-panel` has a spec built
  from Apple's documentation of `NSColorPanel` and the Human Interface Guidelines, with every
  measurement of its own inferred, and its pickers are components of their own with rows that share
  that spec (`color-wheel`, `color-sliders`, `color-palette`).
- **Added on 6 October 2026 by the audit of the demos: 2 rows**, for two controls that demos had
  drawn themselves and that became components: `smart-list-tile` (the four tiles over the lists of
  Reminders' sidebar, measured in `apps/reminders.md`) and `borderless-button` (a button that is
  its title alone: "Details" in Mail's message header, "and 1 More" in Home). Both are present
  in the screenshots.
- **Added on 6 October 2026 by the second pass of the inventory gap closure: 2 rows.** Every
  screenshot of both appearances was viewed again for things without a row. Two were found and
  built, both present: `section-header` (the group headers of Finder's grouped search results,
  plain and pinned) and `round-rect-button` (the outlined button of Finder's preview column, which
  until then existed only inside the scope bar). The per-screenshot record of that pass is in the
  project library, with the things seen once in one app that were left to that app's demo.
- **Added on 6 October 2026 by the audit of the demos, for TextEdit: 1 row.** `toolbar-combo-box`
  (the font size control of TextEdit's format bar: a combo box in the toolbar bezel, without the
  accent-coloured button of `combo-box`, which the review had counted under that row). It is
  present in both TextEdit captures and has a spec measured that day.
- **Added on 7 October 2026 by the inventory gap closure, for Contacts: 1 row.**
  `capsule-segmented-control` (the flat Info / Picture switch of a card being edited, which the
  review had recorded as an app-specific variant inside `segmented-control`). It is present in the
  Aqua Contacts capture only; its Dark Aqua values are inferred.
- **Values:** the component specs carry about 2,700 measured [M] tags, 610 computed [C], 440
  documented [D] and 660 inferred [I]; the blueprints about 2,290 [M], 440 [C], 15 [D] and 280 [I].
  A tag often covers a row with several numbers.

## How the measurements were made

1. Every screenshot was viewed at 1x and catalogued; components were zoomed and sampled at 2x.
2. Numbers come from `tools/measure.py`, which prints exact pixels: run-length encoded rows and
   columns for sizes and gradients, hex grids for corner radii and glyphs, the alpha channel for
   shadows. All screenshots are 2x, so image pixels are halved to points.
3. Each value carries a provenance tag and, when measured, the screenshot and coordinates that
   reproduce it (`CONVENTIONS.md`).
4. Translucent values (label colours, borders, materials) were recovered from composites over two
   or more known backgrounds; font sizes from cap heights; shadows by fitting CSS shadows to the
   measured alpha falloff. These are tagged [C] with their inputs.
5. Apple's names, purposes, behaviour and usage rules come from the HIG as archived in May 2020,
   before the macOS 11 redesign replaced it (`sources.md`). Where today's documentation describes a
   later design, the screenshots decide.

## Colour management: read this before using any colour

Every screenshot embeds the capturing MacBook Pro's "Display" ICC profile, which has Display P3
primaries and an sRGB-like tone curve. The numbers stored in the PNG are therefore panel values, not
sRGB. Greys are identical in both spaces, saturated colours are not: the stored accent blue
`#2f7cf7` is sRGB `#027aff`, the stored close button `#ed6a5e` is sRGB `#ff6057`.

- Specs cite the **stored** value as evidence (so `measure.py at` reproduces it) and give the
  **sRGB** value beside every chromatic colour as `#2f7cf7 (sRGB #027aff)`. Put the sRGB value in
  CSS. `tokens.md` shows sRGB first.
- The conversion uses the embedded profile, relative colorimetric, through LittleCMS
  (`measure.py --srgb`, `build.py annotate`). The three profile variants found in the set convert
  identically. The scaffold's visual harness decodes references the same way, so a component built
  with the sRGB values compares equal.
- Check: the eight accent swatches convert to within one or two levels of Apple's published
  accent colours, which shows the conversion recovers the values AppKit was drawing with.

## Verification that was run

All figures below are from the final state of the files (`tools/build.py`, 3 October 2026).

- **Structure** (`check`): every manifest screenshot is covered and marked viewed, every crop rectangle
  lies inside its image, every inventoried component has a spec, every spec has the required sections,
  every measurement row is tagged. Result: 0 problems.
- **Citations written in full** (`audit`), 2,755 of the 5,512 citations in the specs and blueprints:
  none points outside its image. On lines that state colours, 667 of 667 single-pixel citations
  reproduce within 3 levels per channel, and 543 of 559 rectangle citations contain a colour stated on
  the line. The other 16 were read one by one: each is a geometry citation (a height, a width, a glyph
  box) on a line whose colours belong to a different citation; none is a wrong value.
- **Citations written in shorthand** (`audit-shorthand`), the other 2,757:
  - 506 name their file earlier on the same line. All are inside their image; 222 of 226 pixel
    citations and 79 of 88 rectangle citations reproduce. The 13 exceptions were read one by one: two
    are pixels over a transparent background (the line gives the alpha, not a colour), the rest are
    cases where the checker picked the wrong file of a light and dark pair or the line's colours belong
    to another citation.
  - 2,251 name their file elsewhere in the same spec (a table caption or section header). For these the
    checker tries every screenshot named in that spec. 2,249 fit inside at least one of them (the two
    that do not are lists of x positions on one row, misread as x,y). Of the 1,215 that sit on a line
    with colours, 1,194 are confirmed: the stated colour is at that pixel or inside that rectangle in a
    screenshot the spec names. The 21 not confirmed were read one by one and are again lines whose
    colours belong to another citation, or row and column lists misread as coordinates.
  - **Limit:** 1,034 shorthand citations sit on lines without colours (pure geometry). They are checked
    for bounds only. Geometry citations in general (in both forms) are confirmed to lie inside the
    right image, not re-measured automatically: a width or offset can only be re-checked by measuring it
    again. Each measurement pass re-measured a sample of its own (between 48 and 872 values per family),
    and the lead re-measured every value two passes disagreed on.
- **Re-measurement after review.** A review found geometry that had been read from half-scale previews
  rather than measured. Every such value was located by search and re-measured from the original
  pixels: seven app blueprints (AirPort Utility, Network Utility, Contacts, Maps, Reminders, Messages,
  Font Book) and 72 lines in 51 component specs (list in `handoff/components-remeasure.md`), plus
  four further items the lead found afterwards (Desktop Stacks placeholder and fan, Dictation corner
  radius, Mission Control ring radius, sidebar footer button). A second, scoped review then asked for
  the interior layout of the Reminders tiles and info popover and of the Maps place card; both are now
  measured element by element in their blueprints. One earlier value was wrong and is
  corrected: the Contacts avatar is 55 pt, not 60. Lines that still carry [I] for something not in
  the screenshots now say what is not shown.
- **Contradictions between passes**, re-measured and corrected by the lead: markup toolbar separator
  height, Share menu row height, Print dialog button row, appearance thumbnail width, slider label gap.
- **Token sheet in use.** The token-layer thread adopted `tokens.md` and compared the push button against
  the Go to Folder dialog in its visual harness; the points where a value needed a different CSS form
  are now in the sheet (`tokens.md`, "Notes from adopting the sheet"). That comparison was run by that
  thread, not here.
- **Corrected after build feedback (2 October 2026).** Build threads reported four values that did not
  fit their built components; all were re-measured and three were wrong. The separated toolbar
  segmented control in Preview had been read on a corner row (its bezels touch; there is no 3 pt gap),
  and the box and Disk Utility bar radii had been misread from corner grids (box 2.5 to 4 pt, bar 3.5
  to 5 pt; 4 and 5 are the rounded values to build with, the fits being 3.875 light and 4 dark for
  the box and 4.75 to 5.125 for the bar). The tab strip radius, re-fitted in passing, moved from 3 to 3.5 pt. The mini control
  radius was reconciled, not measured: no screenshot shows one. Old and new values are in
  `handoff/components-remeasure.md`.
- **Corner radii are the weakest measurements here.** Radii fitted with `tools/corner_fit.py` carry
  rms figures in their rows: push button, box, Disk Utility bar and tab strip in the first round, and
  in a second round on 2 October 2026 the checkbox, token, window, pop-up button, segmented control,
  toolbar button, toolbar search field, both search fields, stepper, preferences-toolbar selection,
  image well, the Music and Podcasts display panels and the AirPort Utility button. Of those twenty
  fitted values, sixteen differed from the earlier grid reading by 0.25 to 1.75 pt; three were confirmed
  (checkbox, token, Podcasts display panel). The twentieth, the window, is not a confirmation: its
  fit is coarse, because the shadow outside the corner is not flat; the top corners fit 5, in
  coarse agreement with the grid reading, the bottom corners fit 5.125 against a grid reading of 5,
  and 5 for all four corners is tagged inferred. A third round on 3 October 2026 fitted the
  scope-bar pill (3.75, not a capsule; fitted in three captures, inferred for dark Preview, whose bar
  is not flat), the selection ring of the colour-swatch and appearance
  thumbnails (6, revised from the 5.5 grid reading), the focus ring (3.25 around a square control; 6.75 around the 4.25 pt toolbar search field, from
  which "control radius + 2.5" is inferred for other
  rounded controls) and the toolbar button in dark (3.75 on its border-less fill). The switch track was
  tried and is not fitted: it lies on the Notification Center material, so its 10.5 pt stays the
  value computed from the height and the trial fits are not evidence. The same day the three
  toolbar controls whose radius had been carried over from a neighbour were fitted on their own
  corners in both appearances (toolbar segmented control, toolbar pop-up, smart search field: 4.25
  on the light border, 3.75 on the border-less dark fill, as the toolbar button; the segmented
  control's dark fit has its optimum at 3.625 with 3.75 nearly as good, so its 3.75 is tagged
  inferred), and so were the
  toolbar search field and the preferences-toolbar selection in dark (3.75 and 4). A default button
  was fitted for the first time (3.5, coarse, on its gradient fill; the row had rested on a pop-up
  button's accent cap), and so were the dark display panels (Music 2.5 to 2.625; Podcasts 2.75 at
  its one fittable corner, against 1.875 in the light capture: an open observation, not a resolved
  value). Still
  grid readings: the image corner inside the thumbnail selection ring (4.5 to 5), the small and mini
  sizes of controls, with two exceptions (the small push button is fitted, 3.75, and so is the
  small search field in Automator, 4.25), and
  the artwork radii in the app blueprints.
  Radii of surfaces that sit on the wallpaper or
  on a translucent material (menu, popover, notification, Spotlight, Dock, HUD and similar) cannot be
  fitted with a flat-background model and remain grid readings, good to about 1 pt.
- **Not verified:** nothing in this folder has been checked by building every component and comparing
  it with the reference; that is the job of each component's visual test. Font sizes are computed from
  cap heights and weights judged from stem widths. Material recipes are fits. Values tagged [I] and [D]
  are listed in `inferred-values.md`.

## Things about the screenshot set that affect the spec

- Light and dark captures of the same surface are separate shots: window sizes, content and state
  often differ. Blueprints record both rather than forcing one layout.
- Dark greys differ by a few levels between screenshots because of desktop tinting (see
  `browser-limits.md`); the graphite-accent screenshots show the untinted values.
- Controls are almost always shown in a key window, at regular size, at rest. Pressed, hover,
  inactive-window and mini-size renderings are mostly inferred (`inferred-values.md`).
- Only the blue accent appears outside the 32 accent screenshots, so per-accent values exist for
  what the General pane and its open menu show (checkbox, radio, pop-up cap, selection ring, menu
  selection, highlight chip, window controls) and are derived for everything else.
- Not shown anywhere: Finder list view and Finder status bar, an open submenu, a Control-click contextual menu (only the Contacts field-label action menu), a
  Dock menu, a tooltip, a Save panel, legacy scroll bars, a selected Finder icon.
- `10-15-Catalina-Light-Airport-Utility.png` is a dark-styled window, so AirPort Utility has no
  light reference. Calculator, QuickTime Player and FaceTime are dark-styled in both appearances but
  their two captures are not identical; their blueprints give both.
- In the Evening accent screenshots the menu is drawn light with the dark-appearance selection
  colour (an appearance transition caught mid-way); Light and Dark are treated as canonical.

## Regenerating

```bash
python3 -m venv .venv && .venv/bin/pip install pillow numpy          # once; any location outside the repo
.venv/bin/python reference/spec/tools/build.py inventory       # inventory.json, inventory.md
.venv/bin/python reference/spec/tools/build.py tokens          # tokens.json, tokens.md
.venv/bin/python reference/spec/tools/build.py sources         # sources.md
.venv/bin/python reference/spec/tools/build.py annotate        # add sRGB values to new colours in specs
.venv/bin/python reference/spec/tools/build.py check           # structure
.venv/bin/python reference/spec/tools/build.py audit -v        # re-sample citations written in full
.venv/bin/python reference/spec/tools/build.py audit-shorthand -v   # the same for shorthand citations (about five minutes;
                                                               # add --progress <file in the workspace> to make it resumable)
.venv/bin/python reference/spec/tools/measure.py --help        # pixel tools (previews and crops go to .scratch/, git-ignored)
.venv/bin/python reference/spec/tools/corner_fit.py            # prints its usage: fit a corner radius to the pixels (needs numpy)
.venv/bin/python -m unittest discover -s reference/spec/tools -p "test_*.py"   # tests of corner_fit.py on synthetic corners and of build.py's token conversion; reads no screenshot
```

When a spec changes, edit the component file (and `tokens-core.txt` if a shared value changes), then
run `annotate`, `inventory`, `tokens` and `check`.

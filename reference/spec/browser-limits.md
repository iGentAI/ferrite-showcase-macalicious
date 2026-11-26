# What cannot be reproduced faithfully in a browser, and the closest approach

Consolidated from the seven family reports (`handoff/*.md`, section "Not reproducible in a browser")
and from the lead's own findings. Each item says why HTML, CSS and JavaScript cannot match the
screenshots exactly and what the library should do instead. Items are ordered by how much of the
screen they affect.

## 1. Colour space of the reference itself

The screenshots store Display P3 panel values. A browser paints CSS colours in sRGB (unless told
otherwise) and the visual harness compares in sRGB after converting the reference through its
embedded profile.

- **Approach:** use the sRGB values (`tokens.md`, and the `(sRGB #...)` value next to every
  chromatic colour in the specs). They reproduce the reference exactly wherever the colour lies
  inside the sRGB gamut, which is the case for every UI colour measured except some photographic
  artwork and wallpaper areas.
- **Limit:** conversion and 8-bit rounding move a value by up to one level per channel; treat a
  difference of 2 levels as a match. The captures also carry about 1 level of dither noise on flat
  fills and materials.

## 2. Text rendering and the system font

Catalina sets all UI text in San Francisco (SF Pro Text below 20 pt, SF Pro Display from 20 pt) with
Core Text's greyscale anti-aliasing, its own optical sizes and per-size tracking. The font cannot be
bundled.

- **Approach:** the system font stack (`-apple-system`, `BlinkMacSystemFont`), which resolves to the
  real font on Apple devices, with the metric-adjusted fallback elsewhere; sizes, weights, colours
  and baselines from the specs. Key-equivalent glyphs (Command, Option, Control, Shift) need a symbol
  fallback off Apple platforms.
- **Limit:** glyph pixels are identical to the screenshots on no platform. Even on a current Mac,
  today's San Francisco differs slightly from the 2019 cut, and browsers rasterise text differently
  from Core Text. On Windows and Linux text widths differ, so anything sized to its text (button
  widths, menu widths, tab widths) will be a few pixels off. Visual tests must mask or tolerate text.
- Sub-10 px text (the 7 pt App Store captions) hits browser minimum font sizes: render larger and
  scale down with a transform.

## 3. Vibrancy: materials that show what is behind the window

Sidebars, menus, the menu bar, the Dock, Notification Center, Spotlight, sheets, popovers and HUD
panels blur and saturate whatever is behind them, including the desktop picture and other apps'
windows, and then blend text and selection with special compositing ("vibrant" foregrounds that
lighten or darken the backdrop rather than paint a fixed colour).

- **Approach:** `backdrop-filter: blur() saturate()` plus a tint (`--mac-material-*`), which works
  for content inside the same page. When the demo desktop (wallpaper, windows, Dock, menu bar) is all
  one page, behind-window blending works, and the fitted recipes in `components/material.md`
  reproduce the measured composites to within a few levels. Outside a simulated desktop use the
  opaque fallbacks, which are the values the window-only captures show.
- **Limits:** a page can never see the user's real desktop or other applications. The recipes are
  least-squares fits with one blur, one saturation and one tint; AppKit's materials are several
  layers, so residuals of 1 to 4 levels remain, and recipes tagged [I] (dark Dock, app switcher,
  Mission Control bar, Siri, dark Spotlight) are estimates. Vibrant text (for example menu bar titles
  turning navy over a blue sky) has no CSS equivalent: use the measured solid colours, or
  `rgba(0,0,0,0.85)` text and the accent at about 0.85 alpha for menu selection.
  `backdrop-filter` is also expensive; the Dock, menu bar and one open menu are fine, dozens of
  vibrant sidebars are not.

## 4. Desktop tinting of dark windows

In dark mode Catalina mixes a little of the desktop picture's average colour into window
backgrounds, so the same grey measures `#303031` to `#323437` in different screenshots and exactly
`#323232` with the graphite accent, which turns tinting off.

- **Approach:** ship the untinted ramp as the default and a slightly blue tinted ramp matched to the
  default Catalina wallpaper as an option; a page that owns its wallpaper can average the image in a
  canvas and mix it in.
- **Limit:** exact agreement with every dark screenshot is impossible with one set of greys; visual
  tests against dark references need a tolerance of about 4 levels on greys, or the tinted ramp.

## 5. Key, main and inactive windows; the user's accent and appearance

AppKit redraws controls when their window stops being key (accent fills turn grey, selections turn
grey, title bars flatten) and follows the system accent, highlight colour and appearance.

- **Approach:** the window component sets a state attribute on itself that descendants style
  against; the simulated window manager decides which window is key. Accent and highlight are theme
  attributes (`data-accent`, `data-highlight`) with the eight measured sets; appearance follows
  `prefers-color-scheme` or an explicit attribute.
- **Limits:** CSS has no selector for "this browser window is inactive" that works across engines
  (script `focus`/`blur` on `window` is the closest). The user's real macOS accent cannot be read
  reliably. "Auto" appearance (time of day) and the dynamic desktop are not the same as the media
  query.

## 6. Hairlines, half points and shadows

- Most Catalina borders are 0.5 pt (one device pixel at 2x). **Approach:** `0.5px` borders or
  `box-shadow: 0 0 0 0.5px`, which render one device pixel at 2x and round to 1 px at 1x (as AppKit
  does). At 1x, and at fractional zoom levels, edges land on different pixels and gradients band
  differently; pixel comparison is only meaningful at device pixel ratio 2 and 100% zoom.
- Window, menu and notification shadows are rasterised by the window server. **Approach:** two or
  three stacked `box-shadow` layers fitted to the measured alpha falloff
  (`components/window-shadow.md`). The fit is within a few percent of alpha but not exact, and a
  shadow cannot extend outside the browser viewport or over other applications.
- Some App Store, TV and Home corners use continuous-curvature ("squircle") shapes: plain
  `border-radius` is a close approximation; an SVG clip path is exact.

## 7. Native controls and system behaviour that the browser owns

| Native feature | Why not | Closest approach |
|---|---|---|
| Pop-up menus positioned over the button with the current item under the pointer; combo-box lists; date, colour and number inputs | native form controls cannot be styled or positioned this way | custom components on Base UI primitives following the ARIA patterns; keep a real `<input type="password">` for secure fields |
| Tooltips (help tags) | `title` timing and look are fixed by the browser | a custom tooltip; its look is [I] because no tooltip appears in the screenshots |
| Overlay scrollers that fade, expand on hover and rubber-band | scroll bar pseudo-elements are limited and differ per engine | a custom scroll view with its own knob; `scrollbar-width`/`::-webkit-scrollbar` as a cheaper approximation |
| Menu bar at the top of the screen, Dock, Mission Control, Spaces, real full screen, Split View tiling | the page cannot draw outside its viewport or control the window server | simulate inside the page; the Fullscreen API hides browser chrome only |
| Global shortcuts: Command-Tab, Command-Space, Command-Q, Command-W, Command-M, Control-Up, Fn Fn | reserved by the operating system or browser | alternative shortcuts or on-screen triggers; document the difference |
| Sheets wider than their parent, sliding from under the title bar; window height animation between preference panes | needs clipping at the attachment line and animating to an unknown height | a clip container plus transform; measure heights in script |
| App-modal dialogs that block other windows without dimming them | no native equivalent | focus trap plus an invisible blocker over the app's other windows, `inert` on their content |
| Open, Save and Print panels | the browser's own file and print dialogs cannot be themed | replicas over mock data (or the File System Access API); the print preview is rendered by the app |
| Share menu, Quick Look, Markup, Services | system extensions | static replicas; Web Share opens the platform's own sheet instead |
| Picture in Picture floating over other apps | page content cannot leave the tab | the browser's PiP API for real video, a fixed element inside the page otherwise |
| Siri, Dictation, FaceTime, Photo Booth effects, QuickTime playback | speech, camera and Core Image services | static or media-API mock-ups |
| Live window thumbnails in Mission Control and the Dock | no DOM snapshot API | clone the window elements and scale them with a transform |
| Accessibility roles specific to AppKit (window buttons, sheets, source lists) | ARIA has no exact equivalents | nearest ARIA patterns, named in each spec's "Keyboard and accessibility" section |

## 8. Artwork that is not UI

The Catalina desktop pictures, every app, document, folder and volume icon, preference pane icons,
menu bar extra glyphs, sidebar glyphs, the padlock, alert badges, avatars, album and book covers,
photos, maps, the 3D chess board, web page content and video frames are images, most of them
Apple's or third parties' copyrighted artwork.

- **Approach:** simple monochrome glyphs (chevrons, checkmarks, plus and minus, magnifier, window
  control glyphs, disclosure triangles, toolbar arrows) are specified as geometry in the component
  specs and should be drawn as inline SVG. Everything else is listed per app under "Not reproducible
  / assets needed" in each blueprint and needs a substitute or a sourcing decision.
- **Limit:** with substitute icons and wallpaper a demo can match layout, chrome and controls to the
  pixel but not the artwork. Material colours in the specs were measured over Apple's desktop
  pictures, so a different wallpaper changes every vibrant surface.

## 9. Things the screenshots cannot tell us

Animation timing and curves, pressed and hover states, sounds and haptics are not in a still image.
The specs give [I] or [D] values where a component needs one; see `inferred-values.md`.

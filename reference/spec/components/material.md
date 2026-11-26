# Materials and vibrancy (`material`)

- **Status:** present
- **AppKit:** `NSVisualEffectView` (`material`: `.menu`, `.popover`, `.sidebar`, `.titlebar`, `.hudWindow`, `.sheet`, `.underWindowBackground`, `.fullScreenUI`, `.toolTip`, `.selection`; `blendingMode`: `.behindWindow` / `.withinWindow`; `state`)
- **HIG:** https://web.archive.org/web/20200504055746/https://developer.apple.com/design/human-interface-guidelines/macos/visual-design/translucency/
- **Appearances shown:** light, dark

## Purpose and behaviour
macOS uses translucency and blurring so that views hint at the content behind them, and vibrancy, which blends foreground and background colours with lightening and darkening so foreground content stays legible on any backdrop. Menus are vibrant by default; vibrancy is removed when a window is inactive or when the user enables Reduce Transparency (HIG, Translucency and Vibrancy) [D].

A material is the composite of (1) the backdrop, blurred and with boosted saturation, and (2) a tint colour at some opacity. Because the result depends on the backdrop, each system surface was measured over as many backdrops as the library offers and, where a screenshot of the identical un-covered backdrop exists (the Desktop captures), the tint, opacity, blur and saturation were recovered by least squares.

## Anatomy
`backdrop -> Gaussian blur -> saturation boost -> tint overlay (alpha) -> [vibrant content blended on top]`

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| material | see table | - | `NSVisualEffectView.Material` | menu bar, menu, Dock, Notification Center, Spotlight, app switcher HUD, Launchpad, Launchpad folder, Mission Control bar, Siri HUD, Dictation HUD, fan-stack pills; sidebar (owned by the views group) |
| state | active, inactive (opaque window-background colour), Reduce Transparency (opaque) | active | `state` | active only |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| active (translucent) | yes | every row below |
| inactive / Reduce Transparency | no | [D] HIG: falls back to an opaque colour; use the "opaque fallback" column |

## Measurements
### Consolidated material table
Composite = stored pixel colour of the surface. "Fit" rows give the recipe recovered from the pixels; alpha is the tint opacity, blur is the CSS `blur()` radius (= Gaussian sigma in pt), saturation is the CSS `saturate()` factor.

| Surface | Appearance | Observed composite range (backdrop) | Tint and alpha | Blur / saturation | Opaque fallback | Tag | Evidence |
|---|---|---|---|---|---|---|---|
| Menu bar | light | `#c3e0f1 (sRGB #bce1f3)`..`#c8e2f2 (sRGB #c2e3f4)` (Day sky), `#e4eaf0 (sRGB #e3eaf1)` (cloud), `#d7d9e6 (sRGB #d7d9e7)`..`#e2e3e9 (sRGB #e2e3ea)` (Morning), `#cfd4e9 (sRGB #ced4eb)`..`#dbe1ee (sRGB #dae1ef)` (Evening) | `rgba(255,255,255,0.67)` | 20 [I] / 1.7 [C] | `#c5e0f1 (sRGB #bfe1f3)` (Day), `#ececec` neutral [I] | [M] range, [C] tint | 10-15-Catalina-Light-Desktop.png @ 1200,4,40,36; 10-15-Catalina-Theme-Morning-Blue.png @ 1200,4,40,36; 10-15-Catalina-Theme-Evening-Blue.png @ 1200,4,40,36 |
| Menu bar | dark | `#181c29 (sRGB #171c2a)`..`#1d273c (sRGB #1b273e)` (Night) | `rgba(30,28,34,0.78)` | 20 [I] / 1.8 [C] | `#1b2237 (sRGB #1a2239)`, `#1e1e1e` neutral [I] | [M] range, [C] tint | 10-15-Catalina-Dark-Desktop.png @ 4,2,16,40; 3340,2,16,40; 10-15-Catalina-Theme-Dark-Blue.png @ 1200,4,40,36 |
| Menu | light | `#b2c6d7 (sRGB #aec6d9)`..`#d0e5f5 (sRGB #cbe5f7)` (sky/rock), `#eceae6` (Morning), `#b6bad9 (sRGB #b6b9dc)` (Evening), `#ebecef` (sheet), `#eff0f0` (white window) | `rgba(234,234,234,0.70)` | 22 / 1.8 | `#f0f0f0` | [M] range, [C] fit (rms 2.3) | 10-15-Catalina-Light-Finder-Go-Menu.png @ 488,48,13,764 against 10-15-Catalina-Light-Desktop.png; 10-15-Catalina-Light-Contacts.png @ 1106,390,1,42 |
| Menu | dark | `#293c58 (sRGB #243c5a)`..`#3c4d6a (sRGB #384d6d)` (Night sky/rock), `#333536` (dark window), `#3b3e41 (sRGB #3a3e41)` (dark sheet) | `rgba(62,63,64,0.70)` | 22 / 2.2 | `#343536` | [M] range, [C] fit (rms 1.6) | 10-15-Catalina-Dark-Finder-Go-Menu.png @ 488,48,13,764 against 10-15-Catalina-Dark-Desktop.png; 10-15-Catalina-Dark-Contacts.png @ 1156,435,1,42 |
| Menu selection (accent) | light | `#3e7de7 (sRGB #297bef)` (sky) .. `#5a92f1 (sRGB #4b91f8)` (white window) | accent `#377bee (sRGB #1d79f6)` at 0.82 | as menu | `#3f7ee7 (sRGB #2a7cef)` | [M] range, [C] solve | 10-15-Catalina-Light-Apple-Menu.png @ 400,52,1,38; 10-15-Catalina-Light-Contacts.png @ 1108,432,1,34 |
| Menu selection (accent) | dark | `#2664c6 (sRGB #0662cd)`..`#2d6fd7 (sRGB #0e6dde)` | accent `#2a73e6 (sRGB #0071ee)` at 0.88 | as menu | `#2c6dd5 (sRGB #0e6bdc)` | [M] range, [C] solve | 10-15-Catalina-Dark-Apple-Menu.png @ 400,52,1,38; 10-15-Catalina-Dark-Contacts.png @ 1156,478,1,38 |
| Dock shelf | light | `#436384 (sRGB #3a6387)`..`#4f6984 (sRGB #496987)` (Day sea), `#525f6b (sRGB #4f5f6c)`..`#65656f (sRGB #656570)` (Morning), `#515567 (sRGB #505569)`..`#6e6264 (sRGB #706164)` (Evening) | `rgba(255,255,255,0.27)` | 20 [I] / 1.7 [C] | `#456689 (sRGB #3c668c)` | [M] range, [C] tint | 10-15-Catalina-Light-Desktop.png @ 300,1945,8,6; 10-15-Catalina-Theme-Morning-Blue.png @ 300,1945,8,6; 10-15-Catalina-Theme-Evening-Blue.png @ 3040,1945,8,6 |
| Dock shelf | dark | `#132030 (sRGB #102031)`..`#182538 (sRGB #15253a)` (Night sea) | `rgba(60,60,60,0.25)` [I] | 20 [I] / 1.7 [I] | `#152137 (sRGB #122139)` | [M] range, [I] tint | 10-15-Catalina-Dark-Desktop.png @ 300,1945,8,6; 10-15-Catalina-Dark-Launchpad.png @ 700,1945,8,6 |
| Notification Center panel | light | `#778e98 (sRGB #718f99)`..`#cde3f6 (sRGB #c8e3f8)` (mean `#a1b3c3 (sRGB #9db3c5)`) | `rgba(238,244,246,0.47)` | 25 / 1.7 | `#a1b3c3 (sRGB #9db3c5)`, `#f2f2f2` neutral [I] | [M] range, [C] fit (rms 3.6) | 10-15-Catalina-Light-Notification-Center-Today.png @ 2678,160,9,1840 against 10-15-Catalina-Light-Desktop.png |
| Notification Center panel | dark | `#1b2831 (sRGB #182832)`..`#364361 (sRGB #334364)` (mean `#26344a (sRGB #23344c)`) | `rgba(58,58,56,0.42)` | 30 / 1.6 | `#26344a (sRGB #23344c)`, `#2a2a2a` neutral [I] | [M] range, [C] fit (rms 1.7) | 10-15-Catalina-Dark-Notification-Center-Today.png @ 2678,160,9,1840 against 10-15-Catalina-Dark-Desktop.png |
| Notification Center card (on the panel) | light | `#dff4ff (sRGB #daf5ff)` on `#bcdcf5 (sRGB #b5ddf8)` | `rgba(255,255,255,0.55)`, no extra blur | - | - | [M], [C] | 10-15-Catalina-Light-Notification-Center-Today.png @ 2688,200,12,1 |
| Notification Center card (on the panel) | dark | `#162640 (sRGB #122642)` on `#1c3050 (sRGB #173053)` | `rgba(0,0,0,0.21)` | - | - | [M], [C] | 10-15-Catalina-Dark-Notification-Center-Today.png @ 2688,200,12,1 |
| Spotlight panel | light | `#a8a692 (sRGB #a8a690)`..`#d7c8b2 (sRGB #dac8af)` (mean `#c3b9a5 (sRGB #c5b9a3)`) | `rgba(224,222,218,0.65)` | 30 / 1.8 | `#e9e7e3` [C] | [M] range, [C] fit (rms 1.9) | 10-15-Catalina-Light-Spotlight.png @ 1640,820,680,440 against 10-15-Catalina-Light-Desktop.png |
| Spotlight panel | dark | `#2b2c2d` (window capture, no backdrop) | `rgba(43,44,45,0.80)` [I alpha] | 30 [I] / 1.8 [I] | `#2b2c2d` | [M] base | 10-15-Catalina-Dark-Spotlight.png @ 140,78,1,110 |
| App switcher HUD | light | `#d4d4d4`..`#e7e6f0 (sRGB #e7e6f1)` | `rgba(236,236,236,0.80)` [I] | 30 [I] / 1.8 [I] | `#e5e5e3` | [M] range, [I] recipe | 10-15-Catalina-Light-Command-Tab.png @ 1244,870,30,360 |
| App switcher HUD | dark | `#2f3031`..`#4f5c73 (sRGB #4c5c75)` | `rgba(50,50,50,0.75)` [I] | 30 [I] / 1.8 [I] | `#45484b (sRGB #44484b)` | [M] range, [I] recipe | 10-15-Catalina-Dark-Command-Tab.png @ 1244,870,30,360 |
| Launchpad background | light and dark | light `#0c1e18 (sRGB #051f18)`..`#7587a6 (sRGB #7187a9)`; dark `#0a1921 (sRGB #061922)`..`#3a5375 (sRGB #345378)` | `rgba(28,28,28,0.44)` | 30-45 / 1.8 | - (needs the picture) | [M] range, [C] fit (rms 3.2 / 3.4) | 10-15-Catalina-Light-Launchpad.png and 10-15-Catalina-Dark-Launchpad.png, 560 points in the gaps between columns, against the Desktop captures |
| Launchpad folder panel | light and dark | light `#858b88 (sRGB #848b88)`..`#b6bcc9 (sRGB #b5bcca)`; dark `#85898c (sRGB #84898c)`..`#93a0b0 (sRGB #90a0b2)` | `rgba(180,180,180,0.72)` | 30 / 1.8 | `#9d9e9d` | [M] range, [C] fit (rms 0.4) | 10-15-Catalina-Light-Launchpad-Folder.png and -Dark-, 270 points at x=703..2653, y=500..1580 |
| Mission Control Spaces bar | light | `#8ac9f8 (sRGB #78cafd)`..`#b1d8f8 (sRGB #a8d9fb)` | `rgba(255,255,255,0.25)` [I] | 60 [I] / 1.8 [I] | `#93cff8 (sRGB #82d0fc)` | [M] range, [I] recipe | 10-15-Catalina-Light-Mission-Control.png @ 300,0,1,292 |
| Mission Control Spaces bar | dark | `#132648 (sRGB #0e264b)`..`#2a4269 (sRGB #24426c)` | `rgba(0,0,0,0.15)` [I] | 60 [I] / 1.8 [I] | `#2a4269 (sRGB #24426c)` | [M] range, [I] recipe | 10-15-Catalina-Dark-Mission-Control.png @ 300,0,1,292 |
| Fan-stack label pill | light | `#98a9b9 (sRGB #94a9bb)` (sea) .. `#d8e9f1 (sRGB #d4e9f2)` (sky) | `rgba(255,255,255,0.58)` | small or none [I] | `#d8e9f1 (sRGB #d4e9f2)` | [M], [C] two-backdrop solve | 10-15-Catalina-Light-Stacks.png @ 2510,1846; 2800,485,1,24 |
| Fan-stack label pill | dark | `#282e36 (sRGB #272e37)` (sea) .. `#2e3a4f (sRGB #2b3a51)` (sky) | `rgba(51,55,59,0.70)` | small or none [I] | `#282e36 (sRGB #272e37)` | [M], [C] | 10-15-Catalina-Dark-Stacks.png @ 2510,1846; 2800,487,1,22 |
| Siri HUD chrome | both | `#353c3a (sRGB #333c3a)`..`#383838` (window capture) | `rgba(40,40,40,0.85)` [I] | 30 [I] | `#383838` | [M] base | 10-15-Catalina-Light-Siri.png @ 46,600,8,8 |
| Dictation HUD | light / dark | `#c1e7f5 (sRGB #b8e8f7)`..`#c5e2f6 (sRGB #bee3f8)` / `#29292b` | menu material / `rgba(40,40,42,0.92)` [I] | as menu | `#f0f0f0` / `#29292b` | [M] range | 10-15-Catalina-Light-Dictation.png @ 60,180,50,1; 10-15-Catalina-Dark-Dictation.png @ 31,180,57,1 |
| Sidebar (behind-window) | light / dark | visible in the Command-Tab and Time Machine captures; measured by the views group (`sidebar`) | - | - | - | [M] presence only | 10-15-Catalina-Light-Command-Tab.png @ 52,200,330,1350 |

### Borders used with materials
| Surface | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Menu, Dock, HUDs: inner edge | 0.5 pt `rgba(255,255,255,0.17)` (menu); none visible (Dock) | 1 pt `rgba(255,255,255,0.15)` (menu `#505c73 (sRGB #4e5c75)` on `#30405e (sRGB #2c4061)`; Dock `#36414f (sRGB #344150)` on `#132030 (sRGB #102031)`; Spotlight `#555657` on `#2b2c2d`; Siri `#535252` on `#373635`) | [M] composites, [C] alpha | 10-15-Catalina-Dark-Apple-Menu.png @ 20,150,2,1; 10-15-Catalina-Dark-Desktop.png @ 300,1940,1,2; 10-15-Catalina-Dark-Spotlight.png @ 112,600,2,1; 10-15-Catalina-Light-Siri.png @ 38,600,2,1 |
| Outer hairline | 0.5 pt `rgba(0,0,0,0.15)` (menu) | 0.5 pt `rgba(0,0,0,0.8)` (menu), black at 0.96 (Spotlight), 0.78 (Siri) | [M]/[C] | 10-15-Catalina-Dark-Apple-Menu.png @ 436,300; 10-15-Catalina-Dark-Spotlight.png @ 111,600; 10-15-Catalina-Light-Siri.png @ 37,600 |

### Vibrant foreground colours
Text and glyphs on vibrant surfaces are blended with the backdrop, so they are not fixed colours. Measured examples [M]: menu bar text `#122d40 (sRGB #072d42)` over the Day sky but `#343237 (sRGB #353237)` over the Morning picture; menu item text `#042340 (sRGB #002342)`..`#1b3441 (sRGB #123542)` over the sky but `#34383b (sRGB #33383b)` over a grey sheet; Mission Control labels `#001b45 (sRGB #001a48)`; Notification Center date `#466376 (sRGB #3e6478)`. Recommended CSS: primary `rgba(0,0,0,0.85)` (light) / `#ffffff` (dark); secondary `rgba(0,0,0,0.5)` / `rgba(255,255,255,0.55)`; disabled `rgba(0,0,0,0.26)` / `rgba(255,255,255,0.33)` [C]/[I].

### Dither
All material fills carry a fine +-2 level noise/dither [M] 10-15-Catalina-Light-Desktop.png @ 600,0,1,44; 10-15-Catalina-Dark-Contacts.png @ 1156,435,1,42.

## Layout and spacing
Not applicable.

## Keyboard and accessibility
Honour `prefers-reduced-transparency` (and offer a setting): swap each material for its opaque fallback. Honour `prefers-contrast: more` by adding the 1 px borders at full opacity [D] (macOS Increase Contrast).

## Browser notes
- `backdrop-filter: blur() saturate()` reproduces behind-window materials only for content inside the page; it cannot see other OS windows, which is fine for a self-contained demo desktop.
- Chrome applies `backdrop-filter` before the element's own background, which matches the model above (tint over blurred backdrop).
- Blending modes used by vibrancy (plus-lighter, plus-darker, colour-dodge on text) are not available per-element in CSS without `mix-blend-mode` side effects; fixed colours measured over the bundled wallpaper are the practical approach.
- Firefox supports `backdrop-filter` from version 103; provide the opaque fallbacks with `@supports not (backdrop-filter: blur(1px))`.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | 10-15-Catalina-Light-Finder-Go-Menu.png | 470,30,440,810 | menu material over sky and rock |
| dark | 10-15-Catalina-Dark-Finder-Go-Menu.png | 470,30,440,810 | same, dark |
| light | 10-15-Catalina-Light-Notification-Center-Today.png | 2660,44,700,2056 | panel material over sky, rock and sea |
| light | 10-15-Catalina-Light-Launchpad-Folder.png | 0,300,3360,1400 | folder panel and blurred background |
| light | 10-15-Catalina-Light-Spotlight.png | 1000,420,1360,860 | Spotlight material |
| light / dark | 10-15-Catalina-Light-Desktop.png, 10-15-Catalina-Dark-Desktop.png | 0,0,3360,2100 | the un-covered backdrops used for the fits |

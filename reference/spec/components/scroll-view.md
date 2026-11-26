# Scroll View and scrollers (`scroll-view`)

- **Status:** present (overlay scrollers only, two sightings in 294 screenshots; no legacy always-visible scroll bar is visible anywhere)
- **AppKit:** `NSScrollView` (`scrollerStyle = .overlay | .legacy`, `scrollerKnobStyle = .default | .dark | .light`, `hasVerticalScroller`, `autohidesScrollers`), `NSScroller` (`controlSize`)
- **HIG:** https://web.archive.org/web/20200504054757/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/scroll-views/
- **Appearances shown:** overlay knob over light content (in a dark-mode Safari window and in Script Editor's white editor); nothing over dark content

## Purpose and behaviour
Lets people browse content larger than the visible area. The view has no appearance of its own but can show a vertical and a horizontal scroll bar, each a track with a draggable knob whose length reflects how much content is visible. By default scroll bars are transient (overlay) and appear only while scrolling; the user can make them always visible in General preferences, and some input devices force that. The track is 15 pt thick at regular size and 11 pt at small/mini. Transient scroll bars are translucent and must not move content. Knob style can be dark (default, for light backgrounds) or light (all [D], HIG scroll-views page).

## Anatomy
Overlay style: a rounded knob floating over the content edge; on hover or drag it widens and a translucent track appears beneath it. Legacy style: an opaque track strip with a 1 pt inner border beside the content, containing a rounded knob.

## Variants and parameters
| Parameter | Values | Default | AppKit equivalent | Shown in screenshots |
|---|---|---|---|---|
| Scroller style | overlay / legacy | overlay with a trackpad | `NSScroller.preferredScrollerStyle`, General > "Show scroll bars" | overlay |
| Knob style | default (dark) / light / dark | default | `scrollerKnobStyle` | default dark knob |
| Control size | regular (15 pt track) / small (11 pt) | regular | `NSScroller.controlSize` | regular |
| Axis | vertical / horizontal | - | - | vertical |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| Overlay knob, visible (just scrolled) | yes | Safari page in 10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png |
| Overlay knob, fading out | yes | 10-15-Catalina-Dark-Script-Editor.png (knob at about 6 % black) |
| Overlay knob, expanded with track (pointer over it) | no | knob 11 pt wide inside a 15 pt track [D track size] filled with white @ 0.9 / black @ 0.1 and a 1 pt leading border [I] |
| Legacy always-visible | no | 15 pt track [D]; fill `#fafafa`, leading border `#e8e8e8`, knob `#c1c1c1` 7 pt wide with 4 pt side insets, hover `#7d7d7d` (light); track `#2b2b2b`, border `#3b3b3b`, knob `#6b6b6b`, hover `#959595` (dark) [I] (Catalina values from memory, not measurable here) |
| Hidden | yes | every other scroll view in the library |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Overlay knob width | 7 | [M] | 10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png @ 2834,740,14,1; 10-15-Catalina-Dark-Script-Editor.png @ 1494,700,14,1 |
| Knob end radius | 3.5 (fully rounded ends) | [M] | 10-15-Catalina-Dark-Script-Editor.png grid @ 1492,590,16,8 (first full-width row is 5 px below the tip; 7 px radius within anti-aliasing) |
| Inset from the scroll view's trailing edge | 2 | [M] | Safari: knob right edge x=2847, page ends x=2851; Script Editor: knob right edge x=1507, window ends x=1511 |
| Knob length | proportional to visible/total; seen 75 pt (Safari, y=678..827) and 132 pt (Script Editor, y=592..855); minimum about 18 [I] | [M] | 10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png @ 2840,678,1,150; 10-15-Catalina-Dark-Script-Editor.png @ 1500,592,1,264 |
| Track thickness (expanded overlay or legacy), regular | 15 | [D] | HIG scroll-views |
| Track thickness, small/mini | 11 | [D] | HIG scroll-views |
| Inset from the top/bottom of the track | 2-3 [I] | [I] | not resolvable (knobs mid-track) |

### Colours and fills
| Part / state | Light content | Dark content | Tag | Evidence |
|---|---|---|---|---|
| Overlay knob, fully visible | `#7c7c7c` over `#fafafa` = black @ 0.50 | white @ 0.50 [I] | [M] colour, [C] alpha | 10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png @ 2840,760 (knob) and 2820,760 (page) |
| Overlay knob, fading | `#efefef` .. `#f0f0f0` over `#ffffff` = black @ 0.06 | - | [M] colour, [C] alpha | 10-15-Catalina-Dark-Script-Editor.png @ 1500,700 |
| Knob border | none | 1 px black @ 0.3 outline around the light knob [I] | [M] light (no border run on the row), [I] dark | 10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png @ 2830,740,22,1 |

### Text and icons
None.

### Shadows and effects
Overlay scrollers fade in over about 0.1 s and out about 0.25 s after scrolling stops, with a delay of roughly 0.5-1 s [I]; rubber-band (elastic) overscroll at the ends [D] (AppKit `verticalScrollElasticity`).

## Layout and spacing
Overlay scrollers take no layout space; legacy scrollers reduce the content width/height by 15 pt (or 11). When both axes scroll with legacy bars a 15 x 15 corner square in the track colour fills the junction [I]. Sidebars and tables in the library all use overlay scrollers and show nothing at rest.

## Keyboard and accessibility
Arrow keys scroll by line, Option-arrows / Page Up / Page Down / Space by page, Home/End to the ends [D] (HIG). AX roles `AXScrollArea` and `AXScrollBar` with an `AXValueIndicator`. ARIA: native scrolling needs no roles; a custom scrollbar is `role="scrollbar"` with `aria-controls`, `aria-valuenow`.

## Browser notes
- Native overlay scrollbars on macOS browsers already look like this; to force the look elsewhere use `::-webkit-scrollbar` (width 11 px with a 2 px transparent border around a 7 px thumb, `border-radius: 5.5px`, `background-clip: padding-box`) or `scrollbar-width: thin` plus `scrollbar-color` in Firefox.
- Auto-hide timing and hover expansion cannot be matched exactly with CSS scrollbar pseudo-elements; a custom overlay scrollbar component is needed for fidelity.
- Rubber-banding is platform behaviour.

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| dark window, light page | 10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png | 2800,660,60,190 | overlay knob at full strength |
| dark window, white editor | 10-15-Catalina-Dark-Script-Editor.png | 1470,580,42,290 | overlay knob while fading out |

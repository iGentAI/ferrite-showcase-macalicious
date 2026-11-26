# Web view (`web-view`)

- **Status:** present
- **AppKit:** `WKWebView` (WebKit)
- **HIG:** https://web.archive.org/web/20200503225736/https://developer.apple.com/design/human-interface-guidelines/macos/windows-and-views/web-views/
- **Appearances shown:** light, dark

## Purpose and behaviour
A web view "loads and displays rich web content, such as embedded HTML and websites, directly within your app" [D]. Enable back/forward navigation and provide controls when people will visit several pages; do not use a web view to build a browser [D]. Safari's page area, Help Viewer's article pane and the Safari Reader page are web views.

## Anatomy
A rectangular region with no frame of its own; it starts immediately under the chrome's separator and is clipped by the window's bottom corners. Scrolling uses overlay scrollers (see `scroll-view`).

## Variants and parameters
| Variant | Shown in screenshots |
|---|---|
| full page (Safari) | `...Safari-v13.png`, `...Sharing.png`, Split Screen |
| Reader | `...Safari-v13-Reader-Mode.png` |
| app content (Help Viewer) | `...Help.png`, `...Help-Search.png` |
| start page (Favorites) | `...Safari-v13-Favorites.png` (native view, same region) |

## States
| State | Shown? | Evidence or basis |
|---|---|---|
| loaded | yes | `10-15-Catalina-Light-Safari-v13.png @ 112,202,2648,1754` |
| loading (progress bar under the address field) | no | [D] thin accent-blue bar along the toolbar's bottom edge |
| dark-mode page (`prefers-color-scheme: dark`) | yes | `10-15-Catalina-Dark-Safari-v13.png` (512pixels.net switches to a dark theme); Help Viewer content stays light in `10-15-Catalina-Dark-Help.png` but its search results are dark in `10-15-Catalina-Dark-Help-Search.png` |

## Measurements
### Geometry (pt)
| Property | Value | Tag | Evidence |
|---|---|---|---|
| Safari page area, 3 tabs | starts 63 below the window top (38 toolbar + 25 tab bar), full width | [M] | `10-15-Catalina-Light-Safari-v13.png @ 1400,200,1,6` |
| Help Viewer content | starts 49 below the window top | [M] | `10-15-Catalina-Light-Help.png @ 90,134,1,4` |
| Overlay scroller (shown while scrolling) | about 7 wide thumb with rounded ends, 2-3 from the right edge | [M] presence, [C] size | `10-15-Catalina-Dark-Preview-Search.png` right edge (PDF view); `10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png @ 2826,640,24,200` |

### Colours and fills
| Part | Light | Dark | Tag | Evidence |
|---|---|---|---|---|
| Default page background | `#ffffff` | page-defined; Safari's empty/start page `#2c2d30` | [M] | `10-15-Catalina-Light-Safari-v13.png @ 1400,204`; `10-15-Catalina-Dark-Safari-v13-Tab-Overview.png` |
| Reader page: canvas / article sheet | canvas `#e6e6e6`, sheet `#ffffff`, with a soft shadow | canvas `#323233`, sheet `#4a4a4d` | [M] | 10-15-Catalina-Light-Safari-v13-Reader-Mode.png @ 300,300; 10-15-Catalina-Light-Safari-v13-Reader-Mode.png @ 700,300; 10-15-Catalina-Dark-Safari-v13-Reader-Mode.png @ 300,300; 10-15-Catalina-Dark-Safari-v13-Reader-Mode.png @ 700,300 |
| Start page / Tab Overview background | `#e7e8e9` | `#2c2d30` | [M] | `10-15-Catalina-Light-Safari-v13-Tab-Overview.png` (first content row after the toolbar separator); dark same |

### Text and icons
Page-defined. Reader uses the system font (San Francisco) at about 17 pt body, 30 pt bold title in the capture [C].

### Shadows and effects
The web-view container has no independent frame or shadow [D] (plain embedded content surface). Reader's article-sheet shadow is present [M] but not fitted here; use a subtle page-defined shadow provisionally [I], not a window-class shadow.

## Layout and spacing
The view fills the body; rubber-band scrolling reveals the page background beyond the content.

## Keyboard and accessibility
Standard web content navigation; `AXWebArea`. In the component library the region is simply a scroll container (or an `<iframe>` with a `title`).

## Browser notes
A web view inside a web page is an `<iframe>`; sites that forbid framing cannot be shown, so the demo needs static captures of the pages (512pixels.net, relay.fm, YouTube, Google).

## Evidence
| Appearance | Screenshot | Crop (px) | What it shows |
|---|---|---|---|
| light | `10-15-Catalina-Light-Safari-v13.png` | 112,202,2648,1754 | page area |
| dark | `10-15-Catalina-Dark-Safari-v13.png` | 112,202,2508,1680 | page area with a dark-themed site |
| light | `10-15-Catalina-Light-Help.png` | 498,136,1302,1346 | Help article web view |

# Full-screen app and Split View

- **Screenshots:** `10-15-Catalina-Light-Full-Screen-App.png`, `10-15-Catalina-Dark-Full-Screen-App.png`, `10-15-Catalina-Light-Split-Screen-Apps.png`, `10-15-Catalina-Dark-Split-Screen-Apps.png` [M].
- **Window:** full-display captures, each 1680 × 1050 pt [M], from `$M info` on each file (3360 × 2100 image px). No shadow margins or free-standing window frame [M]. Coordinates below are display-relative, in pt; evidence is original image px. Rectangles are `(x,y,w,h)`, with exclusive trailing edges [C].

## Layout

### Photos, full screen

Photos shows the Wallpapers album [M]. **The menu bar is present in both captures; the Dock is not present** [M] (`10-15-Catalina-Light-Full-Screen-App.png @ 0,0,3360,44` and `@ 0,2000,3360,100`; same dark rectangles). This is the captured revealed-menu-bar state, not evidence that full-screen mode permanently reserves a menu bar [I].

| Region | Rect (pt) | Light / dark background, stored values | Evidence / tag |
|---|---|---|---|
| Menu bar | (0,0,1680,22) | vibrant sky composite `#c3dff1 (sRGB #bde0f3)` / `#181f33 (sRGB #171f35)` | [M] `10-15-Catalina-Light-Full-Screen-App.png @ 1800,0,1,44`; `10-15-Catalina-Dark-Full-Screen-App.png @ 1800,0,1,44` |
| Unified toolbar/title area | (0,22,1680,38) | light gradient `#e5e5e5` → `#cdcdcd`; dark composite top `#414247`, bottom `#353638`; bottom line `#a7a7a7` / `#000000` | [M] same files @ 1800,44,1,76 |
| Photos sidebar | (0,60,179,990) | backdrop-dependent: light `#d9e6ee (sRGB #d6e6ef)` near top, `#c4ccd8 (sRGB #c2ccd9)` near bottom; dark `#2d3745 (sRGB #2b3746)`, `#292b31 (sRGB #292b32)` | [M] same files @ 120,150 and @ 120,2000; width: row @ 340,1500,31,1 |
| Sidebar divider | (179,60,1,990) | observed `#b3bec9 (sRGB #b1beca)` / `#3c444d (sRGB #3a444e)` at lower sample | [M] same files @ 358,1500,2,1 |
| Album heading and metadata | (180,60,1500,53) | `#ffffff` / `#1e1f22`, toolbar shadow at top; bottom 0.5 pt rule `#e5e5e5` / `#343538` | [M] same files @ 1800,120,1,107; flat sample @ 1000,223 |
| Photo grid / remaining canvas | (180,113,1500,937) | `#ffffff` / `#1e1f22` | [M] same files @ 600,1800 |

```
menu bar (Photos)
controls / back / zoom        My Albums        info / share / favorite / rotate / Search
+ sidebar --+ Wallpapers / dates / count / links / Showing: All Items
|           | wallpaper thumbnails (seven, seven, three)
|           | blank canvas below
```

The toolbar title is `My Albums`; the revealed traffic lights are on the leading side, followed by Back and the thumbnail-size slider; trailing items are Info, Share, Favorite, Rotate and `Search` [M] (`10-15-Catalina-Light-Full-Screen-App.png @ 0,44,3360,76`, dark same). Rendering is delegated to the component ids below, not restated here.

## App-specific elements

Photos thumbnails use seven columns, then seven, then three [M]. The first thumbnail is `(193,121,197,148)` pt [M] (light file @ 386,242,394,296); subsequent first-row images start at image x=812,1237,1663,2089,2515,2940 [M] (row @ 350,400,3010,1). Thus the pitch alternates 212.5/213 pt [C]. The first and second rows share a 16 pt vertical inter-row gap [C]: first image ends at image y=538; next row's tallest image starts y=570 [M] (image bounds, not fixed square crops). The third row includes two square Catalina images; preserve aspect-fit rather than stretching all assets to one ratio [M] (whole preview and light file @ 812,848,820,396). This is the full-screen grid, not the smaller-window grid in `apps/photos.md`.

### Split View: Notes left, Safari right

Safari is the active tile; Notes has inactive controls [M] (light and dark files @ 0,0,3360,76). **Neither menu bar nor Dock is visible** [M] (both entire captures). Both toolbar rows start at the top of the display; neither tile has a separate title-only strip [M].

| Region | Rect (pt) | Light / dark background | Evidence / tag |
|---|---|---|---|
| Notes tile | (0,0,740,1050) | region fills below | [M] `10-15-Catalina-Light-Split-Screen-Apps.png @ 1470,1050,41,1`; dark same |
| Divider | (740,0,12,1050) | `#000000` / `#000000` | [M] both files @ 1480,300 |
| Safari tile | (752,0,928,1050) | region fills below | [C] display width minus Notes and divider |
| Divider handle | (744,493,4,64) | `#8c8c8c` / same; antialiased end pixel `#878787` | [M] both files @ 1470,1050,41,1 and @ 1491,980,1,141 |
| Notes toolbar | (0,0,740,38) | inactive `#f6f6f6` / `#2d2d2d`; bottom line `#cecece` / `#000000` | [M] both files @ 1200,0,1,76 |
| Notes folder sidebar | (0,38,190,1012) | `#f6f6f6` / `#2d2d2d` | [M] both files @ 100,400 and row @ 370,1500,521,1 |
| Notes first divider | (190,38,1,1012) | `#dedede` / `#000000` | [M] both files @ 380,1500,2,1 |
| Notes note list | (191,38,248,1012) | textured light (sample `#f8f8f7`); dark `#212121` | [M] both files @ 600,900; bounds row @ 370,1500,521,1 |
| Notes second divider | (439,38,1,1012) | `#e6e6e6` / `#000000` | [M] both files @ 878,1500,2,1 |
| Notes editor | (440,38,300,1012) | paper texture (sample `#fdfcf9`) / dark texture (sample `#2b2a2a`) | [M] both files @ 1000,1500 |
| Safari toolbar | (752,0,928,38) | `#e5e5e5` → `#cdcdcd` / tinted `#4a4345 (sRGB #4b4345)` → `#3d373a (sRGB #3e373a)`; bottom line `#a7a7a7` / `#000000` | [M] both files @ 1800,0,1,76 |
| Relay FM website header | (752,38,928,140) | `#353f47 (sRGB #333f48)` in both appearances | [M] both files @ 1900,200; light column @ 1600,74,1,667 |
| Website Shows banner | (752,178,928,163) | `#3f647c (sRGB #34657f)` in both | [M] both files @ 1600,400; same light column |
| Website main body | (752,341,928,709) | white; left card column `#f3f3f3` in both | [M] light column @ 1600,682,1,59; both @ 1700,800 |

The divider handle is centred on the full display height, not the content height [C] (top 493 + half 64 = 525 pt). Rounded ends are supplied by `split-view-full-screen`. Notes collapses trailing toolbar items into `»`; Safari shows Back, Forward, sidebar, locked address `relay.fm`, reload, Share, tab overview and `+` [M] (both files @ 0,0,3360,76).

## Components used

`full-screen-window` (Photos full-display window), `split-view-full-screen` (system tile widths/divider/handle); `web-view` (Safari page); `window`, `title-bar`, `window-controls`, `toolbar`, `toolbar-button`, `toolbar-segmented-control`, `toolbar-pop-up`, `toolbar-search-field`, `slider`, `menu-bar`, `sidebar`, `sidebar-badge`, `outline-view`, `disclosure-triangle`, `split-view`, `list-view`, `text-view`, `icon-view`, `image-view`, `label` [M] (assigned previews). Use their component renderings unchanged; these tables specify app placement. `apps/photos.md` and `apps/notes.md` provide related windowed layouts, but their dimensions and current note text do not override these captures [M].

## Content in the screenshot

All strings and ordering in this section are transcribed [M] from the four assigned previews and the corresponding regions above.

- Photos menu bar: Apple glyph; `Photos`, `File`, `Edit`, `Image`, `View`, `Window`, `Help`; light clock `Thu 3:50 PM`, dark `Fri 11:07 AM`; `Stephen`.
- Photos sidebar: `Photos`, `Memories`, `People`, `Places`, `Recents`, `Imports`; `Shared` → `Activity`; `Albums` → expanded `My Albums` → selected `Wallpapers`; `Projects` → collapsed `My Projects`. There is no visible `Library` section title in these full-screen captures.
- Photos heading: `Wallpapers`; `May 2013–September 2019`; `17 Photos`; `Show as Memory`; `Slideshow`; `Showing: All Items`.
- Notes sidebar: `iCloud`, selected `Notes`, count `5`; footer `New Folder`. List in order: `Mojave Notes is just about th...` / `9/20/18  No additional text`; `All computers should be orange` / `9/20/18  It’s true.`; selected `Are these what the kid...` / `7/15/18  1 photo`; `This is a note in Yosemite` / `7/14/18  It’s kinda nice in here.`; `This is a note in Mavericks.` / `6/13/18  Here is an image:`. Editor date `July 15, 2018 at 4:03 PM`; title `Are these what the kids call selfies?`; embedded Photo Booth capture.
- Safari: `relay.fm`; Relay FM logo; navigation `About`, `Shows`, `People`, `Store`, `Blog`, `Membership`, `Live`, `Sponsor`, search glyph. Banner `Shows`: `Relay FM is an independent podcast network for people who are creative, curious, and maybe even a little obsessive - just like its hosts.` Card column: `Relay FM Master Feed`, `HOSTED BY RELAY FM HOSTS.`, `Get all the active Relay FM shows in one amazing master feed.`, `SUBSCRIBE`, `Become a Member`, `Support your favorite podcasts directly. Join today to get access to this extra content and a lot of other goodies.`, `Grab Some Merch`.
- Website show list: `Adapt`, `HOSTED BY FEDERICO VITICCI AND RYAN CHRISTOFFEL.`, `Adapt is a show all about the iPad, where two iPad-first users challenge each other to explore new ways of doing things with their favorite device.`; `Analog(ue)`, `HOSTED BY CASEY LISS AND MYKE HURLEY.`, `So many podcasts are about our digital devices. Analog(ue) is a show about how these devices make us feel and how they change our lives for the better, but also for the worse.`; partial bottom entry `Automators` (remaining copy clipped, not invented).

## Not reproducible / assets needed

Photos needs the seventeen historical macOS wallpaper images (ordered as shown), not substitute gradients. Notes needs its paper texture and embedded Photo Booth screenshot. Safari needs the captured Relay FM site, logos, podcast artwork and merchandise image; this is website content, not native Catalina chrome [M]. Sidebar and toolbar glyph assets come from the cited components. Vibrant Photos sidebar samples vary down the display; use the `sidebar` material recipe rather than a single flat colour if matching this backdrop [I].

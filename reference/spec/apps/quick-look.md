# Quick Look

- **Screenshots:** `10-15-Catalina-Light-Finder-Quick-Look.png`, `10-15-Catalina-Dark-Finder-Quick-Look.png`, `10-15-Catalina-Light-Finder-Quick-Look-Markup.png`, `10-15-Catalina-Dark-Finder-Quick-Look-Markup.png` [M]. These are full-display captures, not full-screen Quick Look mode [M].
- **Display:** 1680 × 1050 pt [M] (`$M info` on all four: 3360 × 2100 px, opaque image with no alpha).
- **Panel:** floating key panel; Finder remains behind with grey traffic lights [M]. Use `quick-look-panel` for rendering, not `window` with a Finder toolbar.

## Layout

Rectangles are `(x,y,w,h)` pt with exclusive right/bottom edges [C]. The first table is display-relative. The remaining toolbar tables are **relative to the panel material frame**, whose origin is light `(740,45)` and dark `(482,59)` pt [M]. Values apply to both normal and Markup captures unless specified. The outside hairline is not included in this material-frame rect [M].

| Region | Light rect (pt) | Dark rect (pt) | Evidence (px) / tag |
|---|---|---|---|
| Panel material frame | (740,45,892,547) | (482,59,1103,603) | [M] `10-15-Catalina-Light-Finder-Quick-Look.png @ 1470,600,36,1`, @ 3250,900,19,1 and @ 2000,1164,1,26; `10-15-Catalina-Dark-Finder-Quick-Look.png @ 955,600,118,1`, @ 3158,900,17,1 and @ 2000,1310,1,24 |
| Outside hairline bbox | (739.5,44.5,893,548) | (481.5,58.5,1104,604) | [M] outer line immediately outside material: light x1479/3264, y89/1184; dark x963/3170, y117/1324, same scans plus title-column scan below |
| Title/toolbar row to image top | (740,45,892,41.5) | (482,59,1103,37) | [M] light image begins y173; dark y192: light @ 1800,84,1,101; dark @ 1800,110,1,93 |
| Image artwork | (743,86.5,886,498) | (533,96,1001,562) | [M] light image x1486..3257, y173..1168; dark x1066..3067, y192..1315, same row and column scans |
| Side material / letterbox | left and right 3 pt | left and right 51 pt, including 1 pt inner frame | [M] rows @ 1470,600,36,1 and @ 955,600,118,1 respectively |
| Bottom material | (740,584.5,892,7.5) | (482,658,1103,4) | [M] light y1169..1183; dark y1316..1323, bottom-column scans above |

The component's nominal title bar is 38 pt [C, component `quick-look-panel`]; the table gives the measured image-top boundary. The material does not create a hard boundary at the nominal bar bottom: light has extra top letterboxing, dark image starts 1 pt before that nominal boundary [M]. Do not force the two image rectangles to have the same size or side margin.

| Region / surface | Light stored background | Dark stored background | Evidence / tag |
|---|---|---|---|
| Panel title material | sample `#bad2ef (sRGB #b5d2f2)`; spatially variable sky-blue material | sample `#283549 (sRGB #25354b)`; variable slate-blue material | [M] `10-15-Catalina-Light-Finder-Quick-Look.png @ 1800,100`; `10-15-Catalina-Dark-Finder-Quick-Look.png @ 1800,125` |
| Side material over green / blue | `#d6e8e0 (sRGB #d2e9e0)` at left frame | `#2a5247 (sRGB #195346)` left, `#293a54 (sRGB #253a56)` right | [M] light @ 1485,600; dark @ 970,600 and @ 3100,600 |
| Bottom material | `#b2c1d5 (sRGB #afc1d7)` sample | `#344762 (sRGB #304764)` sample | [M] light @ 2000,1175; dark @ 2000,1320 |
| Normal toolbar button faces, Done and Share | `#ffffff` | backdrop-dependent translucent slate, sample `#637081 (sRGB #607083)` | [M] light @ 2700,108; dark @ 2600,138 |
| Preview | image asset, no independent flat fill | image asset | [M] image rectangles above |
| Markup toolbar | same material as the normal title row (not an extra row) | same | [M] Markup files @ 1800,100 / @ 1800,125 |

Use the vibrant-material implementation and fallback in `quick-look-panel`; the values above are captured composites, not universal opaque chrome colours [I].

```
menu bar: Finder                                  desktop disks
        inactive Finder Downloads window
                  + Quick Look ----------------------------------+
                  | close / full screen   10-9.jpg   rotate / markup / Open with Preview / share
                  |                         wave image           |
                  +----------------------------------------------+
Dock below the Finder window
```

## Components used

`quick-look-panel` (floating frame, material, shadow, disc controls, preview); `markup-toolbar` (replacement title-row tools); `toolbar-button`, `toolbar-pop-up`, `image-button`, `label`, `image-view`; behind it `window`, `title-bar`, `window-controls`, `toolbar`, `toolbar-segmented-control`, `toolbar-search-field`, `sidebar`, `gallery-view`, `desktop`, `desktop-icon`, `menu-bar`, `dock` [M] (four assigned previews). Use component files for glyph drawing, border/radius/state styling; this blueprint supplies app-level placement and content.

## App-specific elements

### Normal title row

All rects below are measured visible disc or **button fill** rectangles (hairlines/shadow are handled by the component) [M]. Borderless label rects describe ink, not invisible click targets [M]. Evidence: `10-15-Catalina-Light-Finder-Quick-Look.png @ 1496,108,1760,38`; `10-15-Catalina-Dark-Finder-Quick-Look.png @ 980,136,2180,38`. Row scans at image y110/138 and columns x2700/2600 locate the fill edges.

| Item in leading-to-trailing order | Light rect (pt) | Dark rect (pt) | Tag |
|---|---|---|---|
| Close disc | (12,12.5,12,12) | (12,12.5,12,12) | [M] |
| Full-screen disc | (32,12.5,12,12) | (32,12.5,12,12) | [M] |
| Centred title `10-9.jpg` | ink (421.5,13.5,49,12.5) | ink (527,13.5,49,12.5) | [M] |
| Rotate Left | (600,9,37,19) | (811,9,37,19) | [M] |
| Markup | (649,9,37,19) | (860,9,37,19) | [M] |
| `Open with Preview` | (698,9,135,19) | (909,9,135,19) | [M] |
| Share | (845,9,37,19) | (1056,9,37,19) | [M] |

Button fill gaps are 12 pt; right margin is 10 pt [C] from the measured rectangles. Disc pitch is 20 pt [C]. No previous/next or index-sheet controls are shown [M]. Title ink evidence: `10-15-Catalina-Light-Finder-Quick-Look.png @ 2323,117,98,25`; dark title ink is `10-15-Catalina-Dark-Finder-Quick-Look.png @ 2018,145,98,25` [M] (solid ink, channels >120 within crop @ 1980,133,160,50).

### Markup title-row replacement

Markup removes the filename title, full-screen disc and normal Open/Markup controls; Close and Share remain, Done is added [M]. Tools in order are below. Borderless tool rects are **solid-ink bounds including the menu chevron**, not guessed hit areas [M]. Pixel bboxes were isolated within each evidence crop: light pixels with r<140 and g<170; dark glyph pixels with r>120,g>130 or selected blue b>180,b-r>60 [M]. Antialiasing outside these bounds belongs to the component. All tool glyphs are vertically aligned to the same bar; some dark glyphs have different artwork extents [M].

Evidence for every leading tool: `10-15-Catalina-Light-Finder-Quick-Look-Markup.png @ 1496,100,1080,55` and `10-15-Catalina-Dark-Finder-Quick-Look-Markup.png @ 980,130,1080,55` [M].

| Order / tool | Light rect (pt) | Dark rect (pt) | Original light bbox (px: x,y,w,h) / tag |
|---|---|---|---|
| Close | (12,12.5,12,12) | same | 1504,115,24,24 [M] |
| Sketch, selected | (36.5,10.5,19,15.5) | same | 1553,111,38,31 [M] |
| Draw | (72,10.5,21.5,15.5) | (72.5,10.5,21,15.5) | 1624,111,43,31 [M] |
| Shapes + menu | (118.5,10.5,30.5,16) | (118.5,11,30.5,15.5) | 1717,111,61,32 [M] |
| Text | (163.5,10.5,17,16) | (163.5,11,17,15.5) | 1807,111,34,32 [M] |
| Highlight | (207.5,10.5,15,15) | (209,10.5,13.5,13) | 1895,111,30,30 [M] |
| Sign + menu | (243,10,33,17) | (247,10,29,17) | 1966,110,66,34 [M] |
| Separator | (286,8.5,1,20) | same position | 2052,107,2,40 [M] |
| Shape Style + menu | (303,12.5,29,12) | same | 2086,115,58,24 [M] |
| Border Colour + menu | (347,11.5,29,14) | same | 2174,113,58,28 [M] |
| Fill Colour + menu, none | (391,11.5,29,14) | same | 2262,113,58,28 [M] |
| Text Style + menu | (436,12,29,13.5) | same | 2352,114,58,27 [M] |
| Separator | (474,8.5,1,20) | same position | 2428,107,2,40 [M] |
| Rotate Left | (491,10.5,14,15) | same | 2462,111,28,30 [M] |
| Crop | (527,10.5,16,16) | same | 2534,111,32,32 [M] |
| `Done` button fill | (779,9,54,19) | (990,9,54,19) | light 3038,108,108,38; dark 2944,136,108,38 [M] |
| Share button fill | (845,9,37,19) | (1056,9,37,19) | light 3170,108,74,38; dark 3076,136,74,38 [M] |

The two separator rects are independently re-measured here: light separator columns x2052/2428 differ from the adjacent material over image y107..146; dark columns x1536/1912 over y135..174. Straight-row samples confirm both are 2 image px wide [M] (`10-15-Catalina-Light-Finder-Quick-Look-Markup.png @ 2048,120,10,1`, @ 2424,120,10,1; `10-15-Catalina-Dark-Finder-Quick-Look-Markup.png @ 1532,148,10,1`, @ 1908,148,10,1). This corrects the existing component spec's 13 pt separator height for these captured instances, without changing its rendering definition [M]. The large gap after Crop is flexible and Done/Share remain trailing-aligned [M]. Done/Share evidence: `10-15-Catalina-Light-Finder-Quick-Look-Markup.png @ 3010,110,256,1`; `10-15-Catalina-Dark-Finder-Quick-Look-Markup.png @ 2920,138,253,1`. Sketch is selected in both, Border Colour is black, Fill Colour is none (slash swatch); there are no drawn annotations on the image [M].

## Content in the screenshot

Both panels show `10-9.jpg`, the green-and-blue breaking-wave wallpaper image. Normal buttons read `Open with Preview`; Markup reads `Done` [M].

### What is behind the panel

The Finder window is Downloads in Gallery view, with Shared Folder banner, large wave preview, thumbnail strip (selected wave), right metadata pane and bottom actions `Rotate Left`, `Markup`, `More...` [M]. The panel occludes part of its toolbar and preview pane; do not invent obscured labels [I]. See `apps/finder.md` for Gallery content and the standalone sidebar variants.

| Behind region | Light display rect (pt) | Dark display rect (pt) | Evidence / tag |
|---|---|---|---|
| Finder material frame | (71,129,1234,785) | (93,100,1272,773) | [M] light file @ 400,250,1,21 and @ 132,1800,19,1 / @ 2600,1800,21,1 / @ 400,1820,1,17; dark @ 400,192,1,19 / @ 178,1700,21,1 / @ 2720,1700,21,1 / @ 400,1736,1,19 |
| Finder sidebar | 164 pt plus divider | 164 pt plus divider | [M] visible sidebar in previews, light x142..469 and dark x186..513; same `sidebar` placement as Gallery |
| Finder sidebar material | `#c9d4de (sRGB #c7d4df)` upper to `#bcc6d0 (sRGB #bac6d1)` lower | `#323c4b (sRGB #303c4c)` to `#282e3a (sRGB #272e3b)` | [M] light @ 180,800 / @ 180,1600; dark @ 200,800 / @ 200,1600 |
| Finder canvas below the panel | `#ffffff` | `#1e2022` | [M] light/dark normal files @ 1500,1500 |

Desktop uses Catalina day wallpaper in light, night in dark [M]. Menu bar and Dock are visible in all four captures [M]. Desktop disks on the upper right are `Macintosh SSD` and `Time Machine`, partly occluded by the panel in light [M]. Finder menu titles are `Finder`, `File`, `Edit`, `View`, `Go`, `Window`, `Help`; user `Stephen`; light normal clock `Thu 10:10 AM`, light Markup `Thu 10:11 AM`, dark both `Thu 4:13 PM` [M] (four files @ 0,0,3360,44). Dock order: Finder, Launchpad, Safari, Mail, FaceTime, Messages, Maps, Photos, Contacts, Calendar (`OCT 3`), Reminders, Notes, Music, Podcasts, TV, News, App Store, System Preferences, divider, stack thumbnail, Trash [M] (four previews / @ 280,1940,2800,160). Trash is empty in light, full in dark [M].

## Not reproducible / assets needed

The original wave image, its thumbnail and Finder's wallpaper thumbnails are needed. The Catalina day/night desktop wallpapers, Dock icons, disk icons and template toolbar glyphs must be assets rather than approximated CSS artwork [M]. Material colours depend on the desktop and the image behind the panel; the cited component provides the material recipe [I]. Unknown invisible hit-target extents are intentionally not claimed as pixel measurements; the tables give visible bounds [M].

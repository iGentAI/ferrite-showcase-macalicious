# System Preferences — Family Sharing

- **Screenshots:** `10-15-Catalina-Light-System-Preferences-Family-Sharing.png`; `10-15-Catalina-Dark-System-Preferences-Family-Sharing.png` [M].
- **Window:** 668 × 328 pt, both appearances [M], opaque frame `@ 112,76,1336,656`. Unified navigation toolbar: reuse `toolbar`, `title-bar`, `window-controls`, `toolbar-segmented-control`, `toolbar-search-field` [I: shared System Preferences shell]. Title “Family Sharing” [M].
- **Captured state:** setup introduction in both appearances; same content [M]. Search has the blue focus ring in light only [M]; this is not a pane content difference.

## Layout

```text
+ navigation / Family Sharing / Search -----------+
| artwork column | Set up Family Sharing          |
| [family icon]  | introduction                   |
| Family Sharing| • benefits × six               |
|               |                                |
| (?)           |                         [Next] |
+------------------------------------------------+
```

Window-relative geometry is computed from the image frame origin (112,76), dividing by 2 [C]. Colours are stored values [M]. Evidence rectangles below apply to both screenshots named above [M].

| Region | Rect (x,y,w,h) pt [M] | Light / dark fill [M] | Evidence |
|---|---|---|---|
| Artwork column | (0,38,194,290) | #ececec / #303031 | both `@ 112,152,388,580`; samples `10-15-Catalina-Light-System-Preferences-Family-Sharing.png @ 120,180`, `10-15-Catalina-Dark-System-Preferences-Family-Sharing.png @ 120,180` |
| Divider | (194,38,1,290) | #d7d7d7 / #454546 then #4f4f50 | both `@ 500,152,2,580`; row at image y=620 |
| Setup content and footer | (195,38,473,290) | #e3e3e3 / #363637 | both `@ 502,152,946,580`; samples `10-15-Catalina-Light-System-Preferences-Family-Sharing.png @ 520,180`, `10-15-Catalina-Dark-System-Preferences-Family-Sharing.png @ 520,180` |

### Layout grid

Content glyph left edge 217.5–218 pt; bullet glyph x=218.5 pt; bullet text x=233.5 pt [M]. Intro line pitch 16 pt, bullet pitch 19 pt [C from image y=250,282 and 325,363,401,439,477,515]. Sidebar art is centered at x=97 pt [C from its rect]. Content left inset from divider 22.5 pt; Next right margin 20 pt; help left margin 20 pt; both footer controls bottom margin 20.5 pt [C]. There is no right-aligned settings label column, tab strip, lock or list [M].

## Components used

`label`, `image-view`, `separator`, `default-button` (Next), `help-button`, `focus-ring` (Search, light only) and the shared chrome components [M].

### Complete control and label table

Rectangles are visible ink for labels, bezel edges for controls, in window-relative pt [M]. `b` is the raster baseline (last non-descender glyph row) [M]. R=13 pt regular, B=13 pt bold, S=11 pt regular [C: measured capital heights of approximately 18,18,16 image px respectively and CONVENTIONS table]. All rows cite the light screenshot at `@ (112+2x),(76+2y),(2w),(2h)`; dark has matching layout [M]. The artwork cell is separately described below. Shared toolbar controls are delegated to the shell, with the captured focus difference noted above.

| Component / variant / state | Rect (x,y,w,h); b | Exact visible text |
|---|---|---|
| image-view / family artwork | (41,66,112,112) | — |
| label / B centered | (51.5,193,91,12.5); b=202 | Family Sharing |
| label / B | (217.5,63,135.5,12.5); b=72 | Set up Family Sharing |
| label / R, line one | (218,87,384.5,12.5); b=96 | Family Sharing is the easy way to share your family’s purchases, |
| label / R, line two | (217.5,103,201.5,12.5); b=112 | subscriptions, storage, and more. |
| label / S bullet + text | bullet (218.5,127.5,5,5); ink (233.5,124.5,318,10.5); b=132 | Share purchased apps, music, movies, books, and TV shows. |
| label / S bullet + text | bullet (218.5,146.5,5,5); ink (233.5,143.5,218,10.5); b=151 | Share an Apple Music family subscription. |
| label / S bullet + text | bullet (218.5,165.5,5,5); ink (233.5,162.5,368.5,10.5); b=170 | Share an iCloud storage plan for everyone’s photos, files, and backups. |
| label / S bullet + text | bullet (218.5,184.5,5,5); ink (233.5,181.5,370,10.5); b=189 | Share your location with family members and help find missing devices. |
| label / S bullet + text | bullet (218.5,203.5,5,5); ink (233.5,200.5,283.5,10.5); b=208 | Share a photo album, family calendars, and reminders. |
| label / S bullet + text | bullet (218.5,222.5,5,5); ink (233.5,219.5,223,10.5); b=227 | Create accounts for children in your family. |
| help-button / normal | (20,287,20,20) | ? |
| default-button / regular enabled | light (591.5,287.5,56,20), dark (592,288,55,19) | Next |
| label / R in Next | first glyph x=606, b=301.5; centered within bezel | Next |

Next evidence: `10-15-Catalina-Light-System-Preferences-Family-Sharing.png @ 1295,651,112,40`; `10-15-Catalina-Dark-System-Preferences-Family-Sharing.png @ 1296,652,110,38` [M]. The dark button has a slightly inset painted bezel; do not change the common logical button alignment [I: shadows/borders differ]. Help evidence: `10-15-Catalina-Light-System-Preferences-Family-Sharing.png @ 152,650,42,42`, same dark region [M].

## App-specific elements

White rounded artwork tile occupies `@ 194,208,224,224`, or (41,66,112,112) pt [M], both appearances. Its shadow differs with appearance [M]; reuse `image-view` with captured art/shadow rather than a system control bezel [I]. Cloud/family illustration is identical between appearances [M], including white background sampled at `@ 200,300` = #ffffff in both. Label below artwork is bold [C from glyph stem width].

## Content in the screenshot

The introduction and all six benefits are transcribed in reading order above [M]. Bullet glyph is “•” [M]; it is decorative, not an actionable control [I: accompanying static setup copy]. Only Next and help are pane controls [M]. Pressed, inactive, disabled, next-stage and completed-family states are not shown [M].

## Not reproducible / assets needed

Requires Family Sharing cloud/person artwork as an image asset [I: custom illustration]. The native system font and its rasterization determine precise line wraps and glyph bounds [I]. No family records or account photos are present [M]; do not add fictitious members.

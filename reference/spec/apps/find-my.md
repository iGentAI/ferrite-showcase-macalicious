# Find My
- **Screenshots:** 10-15-Catalina-Light-Find-My.png, 10-15-Catalina-Dark-Find-My.png (dark is captured with a smaller shadow margin and grey, inactive traffic lights)
- **Window:** 1135.5 x 723 pt [M] (light: image x=112..2382, y=76..1521; dark: x=68..2338, y=52..1497). Mac Catalyst app with a full-height sidebar and no toolbar; traffic lights float over the sidebar.

## Layout
| Region | Size (pt) | Light | Dark | Tag / evidence |
|---|---|---|---|---|
| Sidebar | 261 wide (light x=112..633) | `#f8f7f5` (very light translucent material; faint map colours show through) | `#1e1f20` | [M] Light-Find-My @ 620,800; Dark-Find-My @ 576,776 |
| Divider | 1 | `#e0dfdc` / `#e9e7e2 (sRGB #e9e7e1)` (soft) | `#353637` | [M] Light @ 634,800,2,1; Dark @ 590,776,2,1 |
| Map | 873.5 wide (x=636..2382) | land `#f8f5ee (sRGB #f9f5ed)` | land `#2b2d2f` | [M] Light @ 660,1470; Dark @ 616,1446 |

```
| o o o                    |                                             |
| [ People | Devices ]     |                 (map of Memphis)            |
| ------------------------ |                                             |
| (me)  Me                 |                      (o) current location   |
|       Memphis, TN        |                                             |
| ------------------------ |                                             |
|                          |                                  (compass)  |
| (+) Share My Location    | [Map|Hybrid|Satellite]        [loc] [- | +] |
```

## Components used
`window`, `window-controls`, `catalyst-chrome` (owned by apps), `sidebar`-like material, `segmented-control` (People | Devices, iOS-style with a white selected segment), `list-view` (person row), `separator`, `image-button` ("Share My Location"), `map-controls` (map-type switch, locate, zoom pair, compass), map view.

## App-specific elements
- People/Devices control: track from x=127 (7.5 pt inset), y=150..198 (24 pt high); selected segment white with a soft shadow, 2 pt inside the track; labels 11 pt Medium centred. [M] 10-15-Catalina-Light-Find-My.png @ 112,174,120,1 and 300,150,1,49.
- 0.5-1 pt rules above and below the person row (below at y=324); row: 30 pt avatar disc at about 12 pt inset, name "Me" 13 pt Bold black (cap top y=251), subtitle "Memphis, TN" 12 pt `#656564` (y=285..306), text x=212 (50 pt inset). [M] @ 212,251,145,56 and 500,324,1,2.
- Footer: plus-circle + "Share My Location" 13 pt grey, about 20 pt above the window bottom, 17 pt inset.
- Map: current-location dot (blue disc with white ring, about 16 pt) near Memphis; highway shields; "Legal" link bottom-left of the map.
- Map controls: measured in `map-controls`.

## Content in the screenshot
Segments "People" (selected), "Devices". Row: "Me" / "Memphis, TN". "Share My Location". Map switch: "Map" (selected), "Hybrid", "Satellite". Map labels: Memphis, West Memphis, Bartlett, Germantown, Collierville, Olive Branch, Millington, Marion, Southaven-area towns (Hernando, Senatobia), Forrest City, Wynne, Marianna, Osceola, Covington, Brownsville, Somerville, Oakland, Holly Springs, Mississippi River, Meeman-Shelby Forest State Park, Memphis International Airport (MEM), interstate shields 40/55/69/240/269/555, state route 304. Compass "3D".

## Not reproducible / assets needed
Map tiles (static image per appearance), avatar silhouette, compass artwork.

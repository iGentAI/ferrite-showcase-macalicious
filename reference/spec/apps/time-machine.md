# Time Machine
- **Screenshots:** 10-15-Catalina-Light-Time-Machine.png, 10-15-Catalina-Dark-Time-Machine.png (browser); 10-15-Catalina-Light-Time-Machine-Menu.png, 10-15-Catalina-Dark-Time-Machine-Menu.png (status menu, see the menu-bar-menus blueprint)
- **Window:** full-screen takeover 1680 x 1050 pt with one Finder window in front (958 x 603 pt light; 770 x 436 pt dark)

## Layout
| Region | Position / size (pt), light | Light | Dark | Tag | Evidence |
|---|---|---|---|---|---|
| Background | full screen | blurred Day picture (`#5e8cb1 (sRGB #518db5)` top, `#263d59 (sRGB #203d5b)` bottom) | blurred Night picture (`#354d73 (sRGB #2f4d76)`, `#27303e (sRGB #25303f)`) | [M] | 10-15-Catalina-Light-Time-Machine.png @ 100,100,20,20; 200,1900,20,20 |
| Receding window stack | title-bar strips from y=209 to 281 above the front window | dimmed window copies | dimmed | [M] | @ 1000,362,1,206 |
| Front Finder window | 361, 281, 958 x 603 (dark: 455, 364, 770 x 436) | Finder column view | same | [M] | @ 722,562,1916,1206 |
| Up / down buttons | 34 x 34 at x=1340, y=530 and y=597 (dark x=1246) | `#90a5b9 (sRGB #8ba5bb)` | `#5e718b (sRGB #5a718e)` | [M] up; [I] down | @ 2680,1060,68,68 |
| Date label | x=1340.5, between the buttons (ink y=576.5..588.5) | `#e5e8ea (sRGB #e4e8ea)` | `#e1e3e7` | [M] | @ 2681,1153,210,25 |
| Cancel / Restore | y=907, each about 94 x 29, Cancel at x=724, Restore at x=856 (dark y=823) | `#62758c (sRGB #5e758e)` / `#526171 (sRGB #4f6173)` (disabled) | `#667184 (sRGB #647186)` / `#535d6c (sRGB #515d6e)` | [M]/[I] | @ 1448,1814,188,58 |
| Timeline | right edge, ticks every 16 pt; labels right-aligned at x=1644.5 | `#7b93ad (sRGB #7593b0)` ticks | `#758194 (sRGB #738196)` | [M] | @ 3150,0,210,2100 |

## Components used
`time-machine-browser`; the front window uses `window`, `toolbar`, `toolbar-segmented-control` (view switcher, column view selected), `toolbar-search-field`, `sidebar` (some rows dimmed: AirDrop, Time Machine, ismhpro, Network), `column-view` with preview column, `tag-dot`.

## App-specific elements
None beyond the component.

## Content in the screenshot
Window title "Downloads"; sidebar Favorites: AirDrop (dimmed), Recents, Applications, Desktop, Documents, Downloads (selected); iCloud: iCloud Drive; Locations: Time Machine, ismhpro, Network (dimmed); Tags: Blue, Work, Orange, Gray, Green, Home, Red. Column: 10-1.png ... 10-7.png, 10-8.jpg, 10-9.jpg (selected), 10-10.jpg, 10-11.jpg, 10-12.jpg, 10-13.jpg, 10-14-Day.jpg, 10-14-Night.jpg, 10-15-beta-dark.jpg, 10-15-beta-light.jpg. Preview: image, "10-9.jpg", "JPEG image - 9.4 MB", "Information", Created / Modified "Tuesday, April 17, 2018 at 10:11 PM", "Tags", "More...". Date label "Today at 3:34 PM" (light), "Yesterday at 10:17 AM" (dark). Buttons "Cancel", "Restore" (disabled). Timeline labels "Today", "Now" (light); "Yesterday", "Today", "Now" (dark).

## Not reproducible / assets needed
Desktop picture, file thumbnails, the preview image (10.9 Mavericks wave).

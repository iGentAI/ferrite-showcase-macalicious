# Feature inventory: Launchpad

Main commit read: `e62c2ac9` (29 October 2026), from GitHub only. Nothing was run. Open ledger items are carried in the rows marked "Ledger".

Sources read: `demos/desktop/desktop-overlays.tsx`, `desktop.tsx`; `src/components/launchpad/launchpad.tsx`; `demos/launchpad/launchpad.mdx`; the desktop README's Launchpad section; `launchpad-journey.mjs`; the open work ledger, version 3. Not read: `app-store-launchpad.tsx`; rows about it come from the README and ledger. The real app's list comes from knowledge of macOS 10.15.

Status key: **missing**, **partial** (the note says what is absent), **built-unchecked** (in main's code, not seen running for this inventory), **done**, **not on a Mac** (the real app has no such control). Nothing is done until it is checked in a browser with a screenshot.

**Counts: 34 rows: 14 done, 19 built-unchecked, 1 not on a Mac.**

The Launchpad demo page has folders and turns pages with the arrow keys; so does the desktop's Launchpad, the one people use.

## Opening and closing (5: 1 done, 4 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Dock tile shows and hides | built-unchecked | `toggleLaunchpad` |
| F4 or a stand-in key; hot corner | done | F4 toggles it where a page gets the key; a Hot Corner set to Launchpad opens it, read from the setting. `e2e/launchpad-reach-journey.mjs` |
| Escape and a click on the background close | built-unchecked | `desktop.launchpad.close` |
| Choosing an app closes it and opens the app | built-unchecked | |
| Dock stays in front and works | built-unchecked | `dockStyle` |

## Grid, pages and search (11: 5 done, 6 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| 7 by 5 grid | built-unchecked | |
| Grid follows the screen size | done | [Six columns by three rows in a small window](#project-artifact/art_a7e016210b9b9bc1/333): 7 by 5 down to where a cell would no longer hold an application, then fewer, and the pages follow. Same journey. The cell sizes below which it gives way are this app's call |
| Page dots | built-unchecked | `launchpad-journey.mjs` |
| The page is kept across a reload | built-unchecked | `/api/launchpad/layout` |
| Arrow keys turn the page at its edge | done | [The second page](#project-artifact/art_819e645e9197a100/48): on the overlay, and at a page's last application. `e2e/launchpad-pages-journey.mjs` |
| Swipe and scroll wheel turn the page | done | A wheel, one page a swipe, same journey. A trackpad's swipe sends the same events, not driven |
| Drag an app past a page's edge | done | Held half a second at the screen's edge, the page turns, same journey. Dropping it on the new page shares the drop already there, not driven |
| Arrow keys between icons | built-unchecked | Library |
| Search narrows the list | built-unchecked | `desktop.launchpad.search` |
| Return opens the first match | built-unchecked | Library |
| Search empties on the next opening | done | Same journey |

## Arranging (11: 5 done, 5 built-unchecked, 1 not on a Mac)

| Item | Status | Main |
| --- | --- | --- |
| Drag onto another takes its place, saved | built-unchecked | |
| Option and Left or Right moves an app | built-unchecked | |
| Make a folder by dropping one app on another | done | [Let go on the middle of a tile it makes a folder, named by what the two share or Untitled](#project-artifact/art_a7e016210b9b9bc1/298), kept per account across a reload and read back from the server; on a tile's side it moves, as before. Dropped on a folder, an application goes in. A folder stands where its first application does. `e2e/launchpad-folders-journey.mjs` |
| Open and rename a folder | done | [A click opens it; its name is a field](#project-artifact/art_a7e016210b9b9bc1/298): `e2e/launchpad-folders-journey.mjs` |
| Drag out of a folder; a folder of one dissolves | done | Let go outside the panel it leaves the folder and stands by itself, and a folder left with one goes: `e2e/launchpad-folders-journey.mjs`, read back from the server. A search looks through folders |
| Reset the layout to the default | not on a Mac | A Mac has no control for it, only a Terminal command, so none is added. `DELETE` on the route stays |
| Hold Option or long-press to edit | done | [Every application jiggles](#project-artifact/art_a7e016210b9b9bc1/334), those got from the store with their delete badge. A press of a second stays until Escape or a click, either of which leaves Launchpad open and opens nothing. `e2e/launchpad-reach-journey.mjs` |
| Delete an App Store app, with its question | built-unchecked | |
| Preinstalled apps cannot be deleted | built-unchecked | |
| Drag an app to the Dock | done | [Let go on the Dock it has a tile](#project-artifact/art_a7e016210b9b9bc1/335), read back from the server and after a reload, same journey |
| Order saved per account | built-unchecked | |

## App Store link and ledger (7: 3 done, 4 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| A new app shows at once | built-unchecked | One channel for the library |
| A removal shows in every browser | built-unchecked | `removeFromLibrary` |
| Option held before Launchpad opens | built-unchecked | Ledger: done, `339d41d3` |
| Journey checks Launchpad | built-unchecked | Ledger: done, `339d41d3` |
| Install state follows the library | done | Row 40 of the App Store inventory |
| App Store journey's library read | done | Row 61 of the App Store inventory |
| App Store journey's screenshots | done | Row 62 of the App Store inventory |

## Build items, most used first

1. **L1 Paging.** Arrow keys turn the page at its edge (the demo's `turnPage` moves to the shared overlay), scroll wheel turns pages, the search field empties on reopening, dragging past an edge moves between pages.
2. **L2 Folders.** Extend `/api/launchpad/layout` with folders, keeping old documents valid. Drop to create, open, rename, drag out, dissolve. Use the library's `LaunchpadFolder`.
3. **L3 Edit and reach.** Long-press edit mode, Reset, drag to the Dock (with D6), stand-in key, grid sized to the screen.
4. **L4 App Store ledger items.** The three open rows above. These live in App Store files, so they belong with the App Store work.

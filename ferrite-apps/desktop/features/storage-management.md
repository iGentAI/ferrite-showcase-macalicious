# Feature inventory: Storage Management

Read from GitHub at main `e62c2ac9` (29 October 2026) and the open work ledger, version 3. Nothing was run, so no row says done. Status describes the desktop served by Ferrite, where the window reports the person's Ferrite drive and what the apps keep. The real app has no drag and drop, so that section has no rows.

**Status:** missing (not in code), partial (note says what is absent), built-unchecked (in code, not seen running). **Browser limit** marks what a page cannot do: the app must say so. Real-app rows are from knowledge of macOS 10.15, not checked on a Mac. Row counts are by hand.

**Counts:** 50 done, 3 built-unchecked, 1 partial, 54 rows.

## Storage Management menu

| Item | Status | Note |
| --- | --- | --- |
| About Storage Management | done | Shows the whole name; `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/61) |
| Preferences… | done | Dimmed with a reason row, as this application has no preferences; the desktop's shared menu, `desktop-menu-reasons.test.tsx`, not driven for this application |
| Services | done | Not on this desktop: "No Services Apply", dimmed; the same test |
| Hide Storage Management ⌘H | done | Goes at once, with no tile of its own; its tile brings it back; `desktop-hide-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/467) |
| Hide Others ⌥⌘H | done | `desktop-hide-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/467) |
| Show All | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/195) |
| Quit ⌘Q | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/195) |

## File menu

| Item | Status | Note |
| --- | --- | --- |
| Close Window ⌘W | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/193) |

## Edit menu

| Item | Status | Note |
| --- | --- | --- |
| Undo, Redo | done | Dimmed: this window has no text to edit, and its deletions ask first and go to the Trash; not driven in a journey |
| Cut, Copy, Paste | done | Dimmed: the same; not driven in a journey |
| Select All | done | ⌘A selects the shown category's files; `storage-rows-journey.mjs`, [every file chosen](#project-artifact/art_a7e016210b9b9bc1/39) |
| Delete | done | Asks first; `storage-rows-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/10) |

## Window menu

| Item | Status | Note |
| --- | --- | --- |
| Minimize ⌘M | done | Goes to the Dock, and comes back; `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/60) |
| Zoom | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/63) |
| Bring All to Front | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/58) |
| Window list | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/58) |

## Help menu

| Item | Status | Note |
| --- | --- | --- |
| Storage Management Help | done | Opens Help Viewer; `storage-rows-journey.mjs` |
| Search field | done | The shared Help menu's; Return opens Help Viewer on the words; `system-apps-help-journey.mjs`, [shot of the same menu](#project-artifact/art_7026fbcdd84f1550/23) |

## Title

| Item | Status | Note |
| --- | --- | --- |
| "Ferrite Drive - … available of …" | done | `storage-rows-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/9) |

## Sidebar

| Item | Status | Note |
| --- | --- | --- |
| Recommendations | done | `storage-rows-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/8) |
| Documents, Photos, Music, Movies, Other Files | done | Only those holding something; `storage-rows-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/8) |
| Trash | done | `storage-rows-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/8) |
| Large Files | done | 5 MB or more, largest first; `storage-rows-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/9) |
| App Data | done | Documents an app can forget; `storage-rows-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/8) |
| Per-app rows (Mail, Books, Photos…) | built-unchecked | A "Kept by" row for each app the server counts, read against `/api/storage-management/usage`. One with documents it can forget offers them; one with none (Files, Calculator, Notes) reports what it keeps and has no Delete, as those are changed in the app, which is still showing them. `small-rows-batch9-journey.mjs`, `storage-management-desktop.test.tsx` |
| Applications | done | Each app and what it keeps on the server; nothing to delete, because the apps come with the site. `storage-depth-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/6) |
| Documents views: Large Files, Downloads, File Browser | built-unchecked | File Browser lists every file of the drive with its folder, in rows, not a tree, and Show in Finder goes to it; it comes back after a reload. `small-rows-batch9-journey.mjs` |
| Documents view: Unsupported Apps | partial | A browser runs no Mac applications, so none can be unsupported: the row is dimmed and says so. `small-rows-batch9-journey.mjs` |

## Recommendations

| Item | Status | Note |
| --- | --- | --- |
| Review Large Files | done | Opens Large Files; `storage-rows-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/9) |
| Reduce Clutter | done | Opens a kind holding files; `storage-rows-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/8) |
| Empty Trash | done | Offered again when the Trash fills again; `storage-management-journey.mjs` |
| Store in iCloud | done | A plain statement that this desktop has no iCloud, with no button; `storage-depth-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/5) |
| Optimize Storage | done | A plain statement that nothing is downloaded to remove; `storage-depth-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/5) |
| Empty Trash Automatically | done | Turns Finder's own 30-day rule on, after asking, and off; saved for the account. Finder erases when it reads the drive, not on a timer; `storage-depth-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/5) |

## File table

| Item | Status | Note |
| --- | --- | --- |
| Sortable columns | done | `storage-rows-journey.mjs`, [sorted by Name](#project-artifact/art_a7e016210b9b9bc1/32) |
| Delete… with an alert first | done | Lasts past a reload; `storage-rows-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/10) |
| Show in Finder | done | Drive files only; `storage-rows-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/7) |
| The list stops at 500 files | done | 501 copies of one file on the drive: the report lists 500 and says so, and a kind says only the largest are listed. Its footer sums the listed sizes where the sidebar counts one content once, so copies read differently there; `storage-more-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/285) |
| Quick Look with Space | done | Finder comes forward and shows the file in Quick Look; `storage-depth-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/3) |

## Context menu

| Item | Status | Note |
| --- | --- | --- |
| File row (Delete, Show in Finder, Quick Look) | done | Delete and Show in Finder, `storage-more-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/289); Quick Look on a drive file, dimmed on an app's document, `storage-depth-journey.mjs` |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| Arrow keys in the table | done | `storage-rows-journey.mjs`, [selection moved down](#project-artifact/art_a7e016210b9b9bc1/33) |
| ⌘W ⌘M ⌘H ⌥⌘H ⌘Q | done | From the desktop; ⌥⌘H only through its row; `system-apps-shell-journey.mjs`, [after ⌘Q](#project-artifact/art_a7e016210b9b9bc1/196) |
| Delete key | done | `storage-management-journey.mjs` |
| Space | done | `storage-depth-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/3) |

## Multi-selection

| Item | Status | Note |
| --- | --- | --- |
| Select several and delete | done | [Screenshot](#project-artifact/art_8f948bf924b65740/1), `storage-management-journey.mjs` |

## Saved state

| Item | Status | Note |
| --- | --- | --- |
| Deletions persist on the server | done | Gone after a reload; `storage-rows-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/10) |
| Row shown and sort across a reload | done | `storage-depth-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/4) |

## Cross-app

| Item | Status | Note |
| --- | --- | --- |
| About This Mac's Manage… opens it | done | `about-this-mac-rows-journey.mjs`, [it opened over About This Mac](#project-artifact/art_a7e016210b9b9bc1/41) |
| Trash matches Finder's | done | A file in the Trash is in both lists, and Empty Trash here empties Finder's and takes it off the drive; `storage-more-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/286) |
| Forgetting an app's document | done | Sends `DELETE` to that module and the row goes; `storage-rows-journey.mjs`, [shot](#project-artifact/art_b4b82f88bc5333dc/8) |
| Reread after a change in Finder or another app | done | When the window comes forward; `storage-management-journey.mjs` |

## Ledger items

| Item | Status | Note |
| --- | --- | --- |
| An unreadable stored drive is reported as empty | built-unchecked | Answers 503; unit tests of the reading, not run through the route |
| README names a Notification Center document that `DOCUMENTS` lacks | done | README corrected: its inbox is counted, not offered |
| Journey checks the figures the window shows | done | Compares free space and sizes with the seeded drive |

## Build items, most-used first

1. **Ledger fixes.** Offer Empty Trash again when the Trash refills; say when the list stops at 500; answer 503 for an unreadable drive; correct the README; make the journey compare shown figures with the seeded drive.
2. **Selection and keys.** Multi-select delete, Delete key, row menu, Edit items, Help to Help Viewer.
3. **Live figures.** Reread after drive changes elsewhere; saved row and sort.
4. **Applications and per-app rows.** Sizes, removal through the App Store library, every app's data named.
5. **Documents views and Quick Look,** with Finder's preview route.
6. **Recommendations.** Empty Trash Automatically with the Finder worker; statements for iCloud and Optimize.

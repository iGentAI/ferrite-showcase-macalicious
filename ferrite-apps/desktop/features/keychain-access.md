# Feature inventory: Keychain Access

Read from GitHub at main `e62c2ac9` (29 October 2026). Nothing was run, so no row says done. Status describes the desktop served by Ferrite, where the "login" keychain is encrypted in the browser and the server holds only the sealed envelope.

**Status:** done (seen working in the running app, with a screenshot), missing (not in code), partial (note says what is absent), built-unchecked (in code, not seen running). **Browser limit** marks what a page cannot do: the app must say so. Real-app rows are from knowledge of macOS 10.15, not checked on a Mac. Row counts are by hand.

**Security constraint for every build item:** nothing may send a password, item name or the keychain password to the server unencrypted. A keychain's own name goes to the server as written, so that a locked one can be listed, and the sheet that asks for it says so.

**Counts:** 71 done, 3 built-unchecked, 0 partial, 1 missing, 1 not-applicable, 76 rows.

## Keychain Access menu

| Item | Status | Note |
| --- | --- | --- |
| About Keychain Access | done | Shows the whole name; `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/57) |
| Preferences… | done | Show keychain status in menu bar, kept for the account; Reset My Default Keychains dimmed and certificate settings not offered, each saying why; `keychain-access-status-journey.mjs` |
| Certificate Assistant | done | Browser limit: a dimmed row saying why, under File because the first menu is the desktop's; `keychain-access-files-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/133) |
| Ticket Viewer | done | Browser limit: the same; `keychain-access-files-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/133) |
| Services | done | Not on this desktop: "No Services Apply", dimmed, as no application offers one |
| Hide Keychain Access ⌘H | done | Goes at once, with no tile of its own; its tile brings it back; `desktop-hide-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/467) |
| Hide Others ⌥⌘H | done | `desktop-hide-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/467) |
| Show All | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/187) |
| Quit ⌘Q | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/187) |

## File menu

| Item | Status | Note |
| --- | --- | --- |
| Close Window ⌘W | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/190) |
| New Password Item ⌘N | done | `keychain-access-depth-journey.mjs`, [shot](#project-artifact/art_755b3537fab11503/1) |
| New Secure Note Item ⇧⌘N | done | [shot](#project-artifact/art_755b3537fab11503/2) |
| New Keychain ⌥⌘N | built-unchecked | A name, and a password of its own whose key is derived in the page: at most 8 beside “login”, whose sealed items together take at most 200,000 characters. `rows-batch17-journey.mjs`: every write read back, with no item's name, secret or password in it. The Mac's own keychain files stay out of reach, as Add Keychain says |
| New Certificate Preference | done | Dimmed, saying why; [shot](#project-artifact/art_a7e016210b9b9bc1/133) |
| New Identity Preference | done | Dimmed, saying why; [shot](#project-artifact/art_a7e016210b9b9bc1/133) |
| Import Items ⇧⌘I | done | Opens the encrypted file Export Items writes, under its own password, in the browser; an item already held is not added twice; a wrong password or another file is refused and says so; Apple's format cannot be read and the refusal says that; `keychain-access-files-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/134) |
| Export Items ⇧⌘E | done | The selected items, sealed under a file password of their own and downloaded by the browser; the file holds no name or password in the clear and opens with its password; `keychain-access-export-journey.mjs`, [shot](#project-artifact/art_755b3537fab11503/4) |
| Add Keychain ⇧⌘A | done | Dimmed, saying why; [shot](#project-artifact/art_a7e016210b9b9bc1/133) |
| Delete Keychain | done | Asks first; forgets the sealed keychain on the server, and the window then has none; works while locked; `keychain-access-files-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/132). A keychain beside “login” goes alone, and the others stay: `rows-batch17-journey.mjs` |
| Get Info ⌘I | done | `keychain-access-depth-journey.mjs`, [shot](#project-artifact/art_755b3537fab11503/1) |
| Lock Keychain "login" ⌘L | done | Forgets the key; [shot](#project-artifact/art_755b3537fab11503/3) |
| Unlock Keychain | done | The same row while locked; `keychain-access-depth-journey.mjs` |
| Lock All Keychains ⌃⌘L | done | Locks the one keychain there is; `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/152) |
| Make Keychain Default | done | Dimmed, saying why; [shot](#project-artifact/art_a7e016210b9b9bc1/133) |

## Edit menu

| Item | Status | Note |
| --- | --- | --- |
| Undo, Redo | done | Dimmed with the reason: a change is saved at once and Delete asks first; `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/142) |
| Cut, Copy, Paste | done | Act on what had the keyboard last: the search field's words, or for Copy the selected items' names, never a secret; `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/142) |
| Select All | done | The Edit row and Command-A select every listed item, or the search field's words when it had the keyboard; `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/146) |
| Delete | done | Asks first; `keychain-access-depth-journey.mjs`, [shot](#project-artifact/art_755b3537fab11503/1) |
| Copy Password to Clipboard ⇧⌘C | done | `keychain-access-depth-journey.mjs`, [shot](#project-artifact/art_755b3537fab11503/1) |
| Find ⌥⌘F | done | Menu row seen; the key is not reachable off Apple platforms, where Control-Alt-F is the desktop's Enter Full Screen; `keychain-access-depth-journey.mjs`, [shot](#project-artifact/art_755b3537fab11503/1) |
| Change Password for Keychain "login"… | done | Re-sealed under a new key; `keychain-access-depth-journey.mjs` |
| Change Settings for Keychain "login"… | done | Lock after a number of minutes, and lock when the tab is hidden, kept for the account; `keychain-access-files-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/129) |

## View menu

| Item | Status | Note |
| --- | --- | --- |
| Enter Full Screen | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/55) |
| Show or Hide Keychains | done | Kept for the account; `keychain-access-layout-journey.mjs`, [shot](#project-artifact/art_755b3537fab11503/7) |
| Show or Hide Status Bar | done | Kept for the account; `keychain-access-layout-journey.mjs`, [shot](#project-artifact/art_755b3537fab11503/7) |

## Window menu

| Item | Status | Note |
| --- | --- | --- |
| Minimize ⌘M | done | Goes to the Dock, and comes back; `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/59) |
| Zoom | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/56) |
| Bring All to Front | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/62) |
| Window list | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/62) |

## Help menu

| Item | Status | Note |
| --- | --- | --- |
| Keychain Access Help | done | Opens Help Viewer; `keychain-access-depth-journey.mjs`, [shot](#project-artifact/art_755b3537fab11503/1) |
| Search field | done | The shared Help menu's; Return opens Help Viewer on the words; `system-apps-help-journey.mjs`, [shot of the same menu](#project-artifact/art_7026fbcdd84f1550/23) |

## Toolbar

| Item | Status | Note |
| --- | --- | --- |
| + New Keychain Item | done | `keychain-access-rows-journey.mjs`, [shot of what it added](#project-artifact/art_a7e016210b9b9bc1/147) |
| Info | done | `keychain-access-rows-journey.mjs`, [shot of the same dialog](#project-artifact/art_a7e016210b9b9bc1/151) |
| Search field | done | `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/145) |
| Lock button | done | [shot](#project-artifact/art_755b3537fab11503/3) |

## Sidebar

| Item | Status | Note |
| --- | --- | --- |
| Category list | done | `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/143) |
| Resizable lists | done | `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/148) |
| Keychains list | built-unchecked | “login”, those the person made, each with its own lock, then the Mac's, which say why they are empty; `keychain-access-layout-journey.mjs`, `rows-batch17-journey.mjs`. New items go to the one selected, not to a default; Import Items goes to “login”, and the lock settings are one for all |

## Item table

| Item | Status | Note |
| --- | --- | --- |
| Sortable columns | done | `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/144) |
| Column resize | done | `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/148) |
| Summary of the selected item | done | `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/147) |
| Status bar item count | done | `keychain-access-layout-journey.mjs`, [shot](#project-artifact/art_755b3537fab11503/5) |

## Windows and dialogs

| Item | Status | Note |
| --- | --- | --- |
| New Keychain Password | done | PBKDF2, AES-GCM; `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/149) |
| Unlock | done | `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/150) |
| Conflict dialog | done | A second browser of the account saves first; Use Saved Version driven, Keep My Version unit-tested; `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/155) |
| New Password Item | done | Quality meter and Password Assistant; `keychain-access-export-journey.mjs`, [shot](#project-artifact/art_755b3537fab11503/4) |
| Item info | done | Edits Name, Account, Where, Comments and the password or note, Save Changes ([shot](#project-artifact/art_755b3537fab11503/2)); Access Control says no app here can read the item, so there is no list to change; `keychain-access-export-journey.mjs` |
| Password Assistant | done | Letters & Numbers, Numbers Only and Random, from the browser's cryptographic random numbers, with length and quality; no Memorable, which needs a word list; `keychain-access-export-journey.mjs`, [shot](#project-artifact/art_755b3537fab11503/4) |
| Change keychain password | done | A second window holding the old key locks on the new salt (not run); `keychain-access-depth-journey.mjs` |
| Keychain settings (lock after, lock on sleep) | done | Browser limit: a page cannot see the Mac sleep, so a hidden tab stands in, and the dialog says so. The hidden-tab step overrides `document.hidden` in a headless browser, so it proves the window's answer and not the browser's event; `keychain-access-files-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/129) |

## Context menus

| Item | Status | Note |
| --- | --- | --- |
| Item row (Copy Password, Copy, Delete, Get Info, Export) | done | Copy gives the selected items' names; `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/141) |
| Keychain row (Lock, Unlock, Change Password, Delete) | done | With Change Settings too; a right click selects the row, and another keychain's row has every command dimmed; `keychain-access-files-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/131) |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| Arrow keys; Return or double-click opens info | done | `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/151) |
| ⌘W ⌘M ⌘H ⌥⌘H ⌘Q | done | From the desktop; ⌥⌘H only through its row; `system-apps-shell-journey.mjs`, [after ⌘Q](#project-artifact/art_a7e016210b9b9bc1/194) |
| ⌘N ⇧⌘N ⌘I ⌘L ⇧⌘C ⌥⌘F Delete | done | All but ⌥⌘F seen working; that key is the desktop's Enter Full Screen off Apple platforms, where the Edit row is the way; `keychain-access-rows-journey.mjs`, `keychain-access-depth-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/152) |

## Drag and drop

| Item | Status | Note |
| --- | --- | --- |
| Drag an item to another keychain | built-unchecked | Between “login” and those made here, both unlocked, or a row's Move to Keychain; into a locked one it is refused with the reason. Stored in the new keychain first and then taken from the old, so a failure or crash between leaves it in both and never in neither, which the person then deletes by hand: the crash itself was not provoked. `rows-batch17-journey.mjs`: moved, read after a reload with its secret, and back |
| Drop a keychain or certificate file to import | done | A `.json` export dragged from Finder onto the window asks for its password, one file at a time; any other file is refused with the reason, as Apple's `.keychain-db` format and certificates cannot be opened here; `keychain-access-files-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/128) |

## Multi-selection

| Item | Status | Note |
| --- | --- | --- |
| Select several to delete or export | done | `keychain-access-depth-journey.mjs` (delete), `keychain-access-export-journey.mjs` (export), [shot](#project-artifact/art_755b3537fab11503/1) |

## Saved state

| Item | Status | Note |
| --- | --- | --- |
| Encrypted keychain across reloads | done | Comes back with the password, with no name or secret in the clear on the server; `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/153) |
| Closing the window locks | done | `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/154) |
| Selected keychain, category, sort and widths | done | Names and sizes only, read back through a list of what is known; the journey checks no item's name or secret is kept. The category, order and hidden lists are seen after a reload; the keychain and widths are unit-tested only; `keychain-access-layout-journey.mjs`, [shot](#project-artifact/art_755b3537fab11503/6) |
| Lock after a set time | done | A click or key restarts the wait, and one after the wait has passed locks instead; run on Playwright's clock; `keychain-access-files-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/130) |

## Cross-app

| Item | Status | Note |
| --- | --- | --- |
| Forget the keychain from Storage Management | done | An open window then has no keychain; `keychain-access-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/156) |
| Safari AutoFill from the keychain | missing | Waits on an owner decision. Pages reach Safari through the server, so a password filled into one would pass through the server, and the keychain is built so that the server never sees one. The frame also runs none of the page's scripts, so a filled form would not behave as it does on its site |
| Mail or Internet Accounts passwords | not-applicable | Nothing reads them: Mail here delivers between this desktop's accounts on its own session and has no outside mail, so no account password exists to keep or to ask for |
| Keychain status in the menu bar | done | A padlock that follows the window holding the key: Lock Screen, Lock Keychain “login”, Open Keychain Access; kept across a reload, where the keychain is locked again; `keychain-access-status-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/299) |

## Build items, most-used first

1. **Item editing.** Edit attributes with Save Changes, Comments, Delete from the row, Copy Password with an automatic clipboard note.
2. **Menus and keys.** File, Edit and View items, the key equivalents, Help to Help Viewer, status bar.
3. **Locking.** Lock button, ⌘L, Lock All, lock after a set time, Change Password (re-seal).
4. **Secure Notes.** A second kind of item, with the category filter.
5. **Row menu and multi-selection.** Contextual menus, multi-delete.
6. **Password Assistant.** Generator and strength in New Item and Change Password.
7. **Saved layout.** Non-secret choices only.
8. **Import and export.** A documented encrypted file, with drop; Apple's format stated as out of reach.
9. **Several keychains.** Make Default: new items go to the one selected, so it stays dimmed; empty system keychains say why.
10. **Certificates and keys.** WebCrypto keys or a plain statement; Certificate Assistant and Ticket Viewer.
11. **Cross-app.** Safari AutoFill, with its worker.

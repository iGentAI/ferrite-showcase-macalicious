# Feature inventory: Dictionary

Main commit read: `e62c2ac9`, from GitHub only. Nothing was built or run.

Status: **missing**; **partial** (the note says what is absent); **built-unchecked** (in main's code, not yet seen running). No row is done: done needs a screenshot in a browser. Every status rests on main's source; a menu row's status includes its key equivalent. Scope is the hosted Ferrite desktop (`DesktopDictionary`). Real-app wording and keys come from knowledge of macOS 10.15 (no Mac, no capture of these menus) and are provisional. Services and the window list are generated lists, so each is one row.

Read: `demos/dictionary/` (`app.ts`, `dictionary.mdx`, `dictionary.tsx`, `dictionary-desktop.tsx`), `demos/desktop/desktop-menus.tsx`, `demos/spotlight/spotlight-desktop.tsx`, the open work ledger. The desktop registers **Go** with Back and Forward; "Shell" means the desktop's own row.

## Menus

| Menu | Item | Key | Status | Notes |
| --- | --- | --- | --- | --- |
| Dictionary | About Dictionary | | built-unchecked | Shell |
| Dictionary | Preferences… | ⌘, | done: [dictionary-preferences.png](#project-artifact/art_a7e016210b9b9bc1/352) | |
| Dictionary | Services | | built-unchecked | The desktop's rows, on the selection, Look Up in Dictionary among them (`desktop-services.tsx`); not run here |
| Dictionary | Hide Dictionary | ⌘H | built-unchecked | Shell |
| Dictionary | Hide Others | ⌥⌘H | built-unchecked | Shell |
| Dictionary | Show All | | built-unchecked | Shell |
| Dictionary | Quit Dictionary | ⌘Q | built-unchecked | Shell |
| File | New Window | ⌘N | done: [dictionary-two-windows.png](#project-artifact/art_a7e016210b9b9bc1/353) | Each window has its own search and history; the latest used is what comes back after a reload. A Look Up goes to the window opened first |
| File | New Tab | ⌘T | built-unchecked | Dimmed with its reason, the Call kept: windows only. Unit test. Above New Window, since the desktop adds its rows after the app's |
| File | Open Dictionaries Folder | | built-unchecked | Dimmed with its reason: unit test |
| File | Close | ⌘W | built-unchecked | Shell |
| File | Page Setup… | ⇧⌘P | built-unchecked | Dimmed with its reason: unit test |
| File | Print… | ⌘P | built-unchecked: [dictionary-file-print.png](#project-artifact/art_6a3da0a5b88d531a/44) | Prints a copy of the entry from its own frame. A spy on the frame's `print` stood for the browser's dialog, which a headless browser never shows |
| Edit | Undo | ⌘Z | done: [dictionary-edit-field.png](#project-artifact/art_6a3da0a5b88d531a/43) | On the search field; dimmed for the entry |
| Edit | Redo | ⇧⌘Z | done: [dictionary-edit-field.png](#project-artifact/art_6a3da0a5b88d531a/43) | Same |
| Edit | Cut | ⌘X | done: [dictionary-edit-field.png](#project-artifact/art_6a3da0a5b88d531a/43) | Same |
| Edit | Copy | ⌘C | done: [dictionary-edit-field.png](#project-artifact/art_6a3da0a5b88d531a/43) | Field and entry |
| Edit | Paste | ⌘V | built-unchecked: [dictionary-edit-field.png](#project-artifact/art_6a3da0a5b88d531a/43) | On the field, in the journey. Dimmed with the reason after a refusal: a unit test only, since the journey's browser grants the clipboard |
| Edit | Delete | | done: [dictionary-edit-field.png](#project-artifact/art_6a3da0a5b88d531a/43) | On the field |
| Edit | Select All | ⌘A | done: [dictionary-edit-field.png](#project-artifact/art_6a3da0a5b88d531a/43) | Field and entry; ⌘A in the entry selects the entry alone |
| Edit | Find ▸ Find… | ⌘F | done: [dictionary-find.png](#project-artifact/art_a7e016210b9b9bc1/348) | A bar over the entry; every match tinted, the count, Previous, Next, Done |
| Edit | Find ▸ Find Next | ⌘G | done: [dictionary-find.png](#project-artifact/art_a7e016210b9b9bc1/348) | Return in the bar, journey; the row and key by the shared hook |
| Edit | Find ▸ Find Previous | ⇧⌘G | done: [dictionary-find.png](#project-artifact/art_a7e016210b9b9bc1/348) | Same |
| Edit | Find ▸ Use Selection for Find | ⌘E | built-unchecked | The shared hook; not driven here |
| Edit | Find ▸ Jump to Selection | ⌘J | built-unchecked | Same |
| Edit | Look Up | | done: [dictionary-edit-look-up.png](#project-artifact/art_6a3da0a5b88d531a/48) | Names the word; dimmed without a selection or with text that cannot be looked up. In Notes the row works and does not yet name the word |
| Edit | Spelling ▸ Show Spelling and Grammar | ⌘: | built-unchecked | Dimmed with its reason: the field takes a word to look up, and an entry cannot be changed. Unit test |
| Edit | Spelling ▸ Check Document Now | ⌘; | built-unchecked | The same: unit test |
| Edit | Substitutions ▸ Show Substitutions | | built-unchecked | The same reason; no test of its own |
| Edit | Substitutions ▸ Smart Quotes | | built-unchecked | The same reason; no test of its own |
| Edit | Speech ▸ Start Speaking | | built-unchecked | The selection, or the whole entry, through the browser's voice. Seen with a spy for the voice, which the journey's headless browser lacks; not heard. The selection is the one the menu found, since a menu's focus can take the page's away in WebKit: `dictionary-entry-journey` passes in Chromium, Firefox 157 and Playwright's WebKit 27.2 on Linux |
| Edit | Speech ▸ Stop Speaking | | built-unchecked | Cancels the browser's voice |
| Edit | Start Dictation | | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer |
| Edit | Emoji & Symbols | ⌃⌘Space | built-unchecked | The desktop's Edit footer (`desktop-menus.tsx`) |
| View | Show Tab Bar | | built-unchecked | Dimmed with its reason: unit test |
| View | Show All Tabs | | built-unchecked | Same |
| View | Enter Full Screen | ⌃⌘F | done: [dictionary-full-screen.png](#project-artifact/art_6a3da0a5b88d531a/47) | Shell's row, under this View menu now. The key only on a Mac, not exercised |
| View | Make Text Bigger | ⌘+ | done: [dictionary-view-menu.png](#project-artifact/art_6a3da0a5b88d531a/49) | |
| View | Make Text Smaller | ⌘- | done: [dictionary-view-menu.png](#project-artifact/art_6a3da0a5b88d531a/49) | |
| Go | Back | ⌘[ | done: [dictionary-go-menu.png](#project-artifact/art_6a3da0a5b88d531a/45) | |
| Go | Forward | ⌘] | done: [dictionary-go-menu.png](#project-artifact/art_6a3da0a5b88d531a/45) | |
| Window | Minimize | ⌘M | built-unchecked | Shell |
| Window | Zoom | | built-unchecked | Shell |
| Window | Bring All to Front | | built-unchecked | Shell |
| Window | Window list | | built-unchecked | Shell; one window |
| Help | Dictionary Help | | built-unchecked | Shell: opens Help Viewer on a search for the app; a step of `dictionary-entry-journey` |

The shell also adds Go > Applications, which the real app does not have.

## Toolbar and scope bar

| Item | Status | Notes |
| --- | --- | --- |
| Back | built-unchecked | |
| Forward | built-unchecked | |
| Decrease text size | built-unchecked | |
| Increase text size | built-unchecked | |
| Search field | built-unchecked | |
| Escape empties the field | built-unchecked | |
| Clear button empties the field | built-unchecked | |
| Scope All | built-unchecked | |
| Scope Dictionary | built-unchecked | |
| Scope Thesaurus | built-unchecked | |
| Scope Apple | built-unchecked | Forty short entries written for this desktop (`dictionary-apple.ts`), for words people look up about a Mac, since Apple's own has no public source and cannot ship. `dictionary-apple.test.tsx`, `dictionary-apple-journey` in Chromium |
| Scope Wikipedia | built-unchecked | |

## Word list

| Item | Status | Notes |
| --- | --- | --- |
| Suggestions | built-unchecked | Datamuse |
| Typed word first | built-unchecked | |
| Recent look-ups while the field is empty | built-unchecked | |
| Title counts what was found | built-unchecked | |

## Entry

| Item | Status | Notes |
| --- | --- | --- |
| Headword | built-unchecked | |
| Pronunciation | built-unchecked | |
| Parts of speech | built-unchecked | |
| Senses | built-unchecked | |
| Examples | built-unchecked | |
| Listen button | built-unchecked | |
| Synonyms | built-unchecked | Plain text |
| Antonyms | built-unchecked | Plain text |
| Wikipedia extract | built-unchecked | |
| Read More on Wikipedia | built-unchecked | Opens in Safari on the served desktop, as a credit does in the journey |
| Credits | done: [dictionary-entry-menu.png](#project-artifact/art_a7e016210b9b9bc1/345) | Open in Safari, journey |
| Click a word in an entry to look it up | built-unchecked | A click on a word of the entry looks it up, as a new step of the history, a quarter second later so that a double click still selects it; a drag over text does nothing: unit test, and a click, a double click and Back in Chromium on a live entry, by a scratch browser check. Absent: the underline as the pointer passes over a word |
| Click a synonym to look it up | done: [dictionary-thesaurus.png](#project-artifact/art_a7e016210b9b9bc1/346) | Synonyms and antonyms; a new step of the history |
| "Looking up…" | built-unchecked | |
| "No entries found" | built-unchecked | |
| Sources could not be reached | built-unchecked | |
| Look-up not kept notice | built-unchecked | |

## Windows and preferences

| Item | Status | Notes |
| --- | --- | --- |
| Several windows | done: [dictionary-two-windows.png](#project-artifact/art_a7e016210b9b9bc1/353) | |
| Tabs | built-unchecked | The Call kept: windows only, and the rows that would make one are dimmed with the reason |
| Preferences: enable a source | done: [dictionary-preferences.png](#project-artifact/art_a7e016210b9b9bc1/352) | The scope bar and entries follow; a scope turned off gives way to All |
| Preferences: reorder sources | done: [dictionary-preferences.png](#project-artifact/art_a7e016210b9b9bc1/352) | Drag, or the Up and Down buttons |
| Preferences: pronunciation | partial | US English or British English, kept among the desktop's values. The server reads each accent from the Free Dictionary API's recordings (`tomato-uk.mp3`), and the word's pronunciation and Listen follow the setting, in the window and the Look Up popover. Proven in `dictionary-settings.test.ts`, the Rust test on the API's shape, and `rows-batch25-journey` in Chromium against the real API: tomato shows [tʰə̥ˈmeɪɾoʊ], British English changes it to [tʰə̥ˈmɑːtʰəʊ], and that stays after a reload and a new look-up. Kept entries moved to a new cache key, as those kept before accents have none. Limits: Listen in the chosen accent was not played in the journey; a word whose source has no such accent stays as the source gives it; diacritical against IPA, as on a Mac, is not offered, as the source gives one notation |
| Preferences: font size | done: [dictionary-preferences.png](#project-artifact/art_a7e016210b9b9bc1/352) | One setting with the "A" buttons |
| Look Up popover over the selection | built-unchecked | ⌃⌘D over text selected in any window: the word, its pronunciation, part and first three senses, Open in Dictionary, Escape closes; the look-up goes into Recents. `dictionary-look-up.tsx`, `small-apps-batch3-journey` from Notes. The menus' Look Up rows and Services still open the window |

## Context menus

| Where | Item | Status |
| --- | --- | --- |
| Entry | Look Up | done: [dictionary-entry-menu.png](#project-artifact/art_a7e016210b9b9bc1/345) |
| Entry | Search with Google | done: [dictionary-entry-menu.png](#project-artifact/art_a7e016210b9b9bc1/345) |
| Entry | Copy | done: [dictionary-entry-menu.png](#project-artifact/art_a7e016210b9b9bc1/345) |
| Entry | Speech ▸ Start Speaking | built-unchecked |
| Entry | Speech ▸ Stop Speaking | built-unchecked |
| Entry | Services | built-unchecked | The desktop's services for what the entry has selected, or No Services Apply with none. `ServicesItems`: `desktop-services.test.tsx` |
| Word list | Open in New Tab | built-unchecked: dimmed with its reason, no test |
| Word list | Remove from Recents | built-unchecked: `DELETE /api/dictionary/history?word=`; that word goes from the server's history and every window's list and the others stay, `small-apps-batch3-journey`; dimmed unless the row under the pointer is a recent word with the field empty |
| Any app's text | Look Up "word" | built-unchecked: Terminal's and Stickies' menus have it, and ⌃⌘D works with text selected in any window. Not every application's menu has the row |

## Keys outside the menus

| Key | Status | Notes |
| --- | --- | --- |
| ⌃⌘D Look Up from any window | built-unchecked | `startLookUp`; password fields refused |
| ⌃⌥D Look Up from any window | built-unchecked | Same |
| Arrows in the word list | built-unchecked | |
| Page Up in the word list | built-unchecked | |
| Page Down in the word list | built-unchecked | |
| Home in the word list | built-unchecked | |
| End in the word list | built-unchecked | |
| Type-select in the word list | built-unchecked | |
| Arrows on the divider | built-unchecked | |
| Arrows scroll the entry | built-unchecked | |

## Drag and drop, multi-selection

| Item | Status | Notes |
| --- | --- | --- |
| Drop a word into the search field | built-unchecked | Browser's own, no app code |
| Drag text out of an entry | built-unchecked | Browser's own |

The real app's word list selects one word, so no multi-selection is listed (from knowledge of macOS 10.15, no Mac).

## Saved state

| Item | Status | Notes |
| --- | --- | --- |
| Recent look-ups per person | built-unchecked | `/api/dictionary/history` |
| Cached entries for a week | built-unchecked | Shared |
| Text size | done: [dictionary-after-reload.png](#project-artifact/art_a7e016210b9b9bc1/347) | |
| Scope | done: [dictionary-after-reload.png](#project-artifact/art_a7e016210b9b9bc1/347) | |
| Last word | done: [dictionary-after-reload.png](#project-artifact/art_a7e016210b9b9bc1/347) | |
| List width | done: [dictionary-after-reload.png](#project-artifact/art_a7e016210b9b9bc1/347) | |
| History across a reload | done: [dictionary-after-reload.png](#project-artifact/art_a7e016210b9b9bc1/347) | Fifteen steps around the one shown. A search over 200 characters, which no entry can match, comes back cut to 200 |
| Forget recents | built-unchecked | Clear Recents in the word list's menu, driven in `dictionary-preferences-journey`; the history reads empty on the server afterwards |
| Preferences | done: [dictionary-preferences.png](#project-artifact/art_a7e016210b9b9bc1/352) | After a reload, journey |

## Cross-app

| Item | Status | Notes |
| --- | --- | --- |
| Look Up by key from another app | built-unchecked | Journey step "Look Up in TextEdit…" |
| Look Up from a menu | done: [dictionary-look-up-from-notes.png](#project-artifact/art_6a3da0a5b88d531a/46) | Edit > Look Up in Notes opens Dictionary on the word. The desktop's dimmed Edit menu for apps with no Edit commands has no row |
| Service: Look Up in Dictionary | built-unchecked | The desktop's Services row (`desktop-services.tsx`) calls `lookUp`; not run here |
| Spotlight shows a definition | built-unchecked | `useDefinition` |
| Spotlight opens the word here | done: [spotlight-open-dictionary.png](#project-artifact/art_6a3da0a5b88d531a/74) | Return on Spotlight's definition looks the word up |
| `dict://word` links | built-unchecked | A click on such a link in any window of the desktop, and `open dict://word` in Terminal, looks the word up: unit test of the click, and a click in Chromium by a scratch browser check; `open` no test |

## Open work ledger

**Dictionary: Look Up from other apps.** Edit > Look Up works in Dictionary, naming the word, and in Notes, TextEdit and Stickies through their shared Edit menu, which does not name the word yet (`demos/notes/notes-edit-menu.tsx`). The desktop's own dimmed Edit menu for other apps has no Look Up row. Control-Command-D works from any app (`317a2f61`, `e1e1b244`).

## Calls made

- Apple source: no public counterpart; its scope stays and says so.
- Look Up shows the window, not an inline bubble, until build item 8.
- Go > Front/Back Matter is left out: the sources have none.

## Build items, most used first

1. **Look Up in menus.** Built here; left: the word in the shared editors' label and a row in the shell's Edit menu, both outside this app's files.
2. **Registered menus and keys.** Built: ⌘[ and ⌘]; File Print; a View menu in `app.ts`; Edit commands on the field and entry.
3. **Find in an entry.** ⌘F bar.
4. **Links in entries.** Words and synonyms look up; Wikipedia and credits through Safari's queue; `dict://`; Spotlight passes its word.
5. **Windows and tabs.** With the shell's help.
6. **Preferences.** Sources, pronunciation, size; saved; scope bar follows.
7. **Saved state.** Scope, size, last word, width; forget recents; context menu on recents.
8. **Look Up popover** over the selection, "Open in Dictionary". Shared with the shell.
9. **Context menu and Services.**
10. **Help and print.** Help opens Help Viewer; Print the entry.

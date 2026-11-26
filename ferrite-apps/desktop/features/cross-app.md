# Feature inventory: Cross-app pieces

Main commit read: `e62c2ac9` (29 October 2026), from GitHub only. Nothing was run.

Hosted check on the live site, built from main `849cf255`: `e2e/cross-app-text-journey.mjs` 13 of 13.

This eighth document was not named in the brief as an app. The brief says these pieces are built first and other app workers depend on them, so they get their own inventory and build items.

Sources read: `demos/finder/finder-drag.ts`, `finder-open.ts`, `finder.tsx`; `demos/desktop/desktop-open-url.ts`, `desktop-share-link.tsx`, `desktop.tsx`; `demos/spotlight/spotlight-desktop.tsx`; `demos/photos/photos-drive.ts`. The receiving apps' own code (Photos, Mail, Notes, and how TextEdit and Preview take a file) was not read in full. The open work ledger records that Mail and Messages attachments were cut from main and survive in an earlier version.

Status key: **missing**, **partial** (the note says what is absent), **built-unchecked** (in main's code, not seen running for this inventory). Nothing is done until it is checked in a browser with a screenshot.

**Counts: 51 rows: 40 done, 6 built-unchecked, 5 partial.**

## How to use the shared pieces

For the app threads. All of these act on drive items, `{ id, name, kind, type?, size? }` (`DesktopDragItem`).

- **Take a drop from Finder or the desktop:** `const dropRef = useDesktopDrop({ accepts: (item) => isPicture(item), onDrop: async (items) => importFiles(await filesOfDrag(items)) })`, then `ref={dropRef}` on the window or pane (`demos/desktop/desktop-drag.ts`). `filesOfDrag` reads the bytes as `File`s and expands folders; `fileItemsOfDrag` expands folders without reading. For rows of their own, such as an album in a sidebar, use `registerDropTarget({ element, landing(hit, drag) { ... } })`: the innermost target that answers takes the drop.
- **Start a drag of drive files from your app:** on `pointerdown`, `beginDesktopDrag(event, { from: "photos", items: () => [...], icon })`. A press that does not move stays a click. Finder copies what comes from another app.
- **Open files from Finder:** take them with `takeOpenFileRequests(app)` when the window opens and `onOpenFileRequest(app, listener)` while it is open (`demos/finder/finder-open.ts`), then say what you open in `app.ts`: `opens: (file) => /\.mp3$/i.test(file.name)`. Double-click, Open With and your Dock tile then work. Open a file yourself with `openFile(entry)`.
- **Take files from the Share menu:** `takeSharedFiles(app)` and `onSharedFiles(app, listener)` (`demos/desktop/desktop-share-link.tsx`), and `takesSharedFiles: true` in `app.ts`. Mail, Messages, Notes and Photos are the rows; the row stays dimmed until the descriptor says so.
- **Paste files:** in `onPaste`, `const items = copiedDriveItems()` (`demos/desktop/desktop-clipboard.ts`). Empty means an ordinary paste of text. Copy through `copyText`, not `navigator.clipboard.writeText`, so that it replaces the files.

Proof: `ferrite-apps/desktop/e2e/cross-app-journey.mjs`.

## Drag between apps (17: 13 done, 2 built-unchecked, 2 partial)

| Item | Status | Main |
| --- | --- | --- |
| A shared drag payload and drop-target API for drive items | done | [Drag of two files](#project-artifact/art_feed73a04b7ab5a0/1), `e2e/cross-app-journey.mjs` |
| Finder or desktop into Photos: import | done | From Finder [four files at once](#project-artifact/art_3e7ee16bed9df50f/1), Photos' row. From the desktop [a dragged picture and a pasted one](#project-artifact/art_819e645e9197a100/62), read back from the library: `e2e/desktop-into-apps-journey.mjs` |
| Finder or desktop into Mail: attachment | done | From Finder into a New Message, a real mouse drag: [the attached file](#project-artifact/art_193e88d1bee786c4/23), `e2e/mail-attachments-journey.mjs`, which also reads the bytes back at the recipient. From the desktop [dragged and pasted](#project-artifact/art_819e645e9197a100/63), both received by the other person: `e2e/desktop-into-apps-journey.mjs` |
| Finder or desktop into Notes | built-unchecked | From Finder, [a text file's lines and a picture](#project-artifact/art_778ce73f9cddf4bd/9), `e2e/notes-drop-journey.mjs`, which passed 6 of 6 on the hosted site (build of main 849cf255). From the desktop, a text file's lines: `e2e/desktop-into-apps-journey.mjs`. The note was stale: `takesFile` already took any file to 10 MB. A PDF dropped from Finder stands in the note as an attachment, read from the server and across a reload: `e2e/mail-notes-batch7-journey.mjs` |
| Finder or desktop into Messages | done | From Finder into a conversation, a mouse drag: [the file and picture in it](#project-artifact/art_193e88d1bee786c4/28), `e2e/messages-attachments-journey.mjs`. From the desktop, a drag, read from the other person's conversation: `e2e/desktop-into-apps-journey.mjs`. A dropped file is sent at once, without waiting for Return |
| Finder into TextEdit | done | [A text file opens by a drop](#project-artifact/art_6a3da0a5b88d531a/4) and a picture is refused: `e2e/textedit-files-journey.mjs` and `e2e/notes-drop-journey.mjs` |
| Finder into Preview | done | [A picture dragged from Finder opens in the window it lands on](#project-artifact/art_3e7ee16bed9df50f/35), `e2e/preview-journey.mjs`. A file from the computer is not taken: Preview opens what is on the drive |
| Finder into QuickTime Player | done | [A movie dropped from Finder opens](#project-artifact/art_3e7ee16bed9df50f/36), `e2e/quicktime-finder-journey.mjs`. Dropping sound was not run |
| Finder into Calendar, Contacts, Music | built-unchecked | Calendar: an `.ics` onto the window asks where it goes, `e2e/calendar-open-journey.mjs`. Music: a sound file dragged from a Finder window into Music's window joins the library on the server and stays after a reload, `e2e/dictation-batch5-journey.mjs`. Contacts: a `.vcf` dragged from a Finder window onto the window is imported, read from the server and after a reload; another file is refused with its reason, `e2e/open-items-batch6-journey.mjs` |
| Onto a Dock tile opens in that app | done | [Dropped on TextEdit's tile](#project-artifact/art_feed73a04b7ab5a0/3); a tile that cannot open the file refuses it |
| Desktop icons into apps | done | Into Mail, Notes, Messages and Photos: `e2e/desktop-into-apps-journey.mjs`. Onto Finder and back: `e2e/desktop-items-journey.mjs` |
| Photos out to Finder | built-unchecked | Photos' row: exports a copy, not walked |
| Mail attachment out to Finder | done | [Dragged into a Finder folder](#project-artifact/art_a7e016210b9b9bc1/319) and onto the desktop, each read back with the attachment's bytes: `e2e/mail-attachment-out-journey.mjs`. A Dock tile refuses it and says it isn't on the drive yet. Into Mail's New Message and Messages' conversations it takes the same bytes, not driven |
| Text and link drag between apps | done | [Selected text dragged from TextEdit into a note, read back from the server, and words and a link dropped on the desktop leaving a file where they were let go](#project-artifact/art_a7e016210b9b9bc1/91): `e2e/cross-app-text-journey.mjs`. The link drop is a synthetic browser drop, not a mouse drag. A Finder folder takes them through the same code, not driven. A Mac leaves a text clipping; here it is a text file named by its first words, and a link is a `.webloc` that opens in Safari. Dropping either on a Dock tile is absent |
| Computer's files into a Finder window | done | [Lands in the folder shown, on the server](#project-artifact/art_a7e016210b9b9bc1/624): `e2e/cross-app-rows-journey.mjs`. The drop is a synthetic browser drop carrying a real `File`, not a mouse drag from another program |
| A save running when another tab signs someone else in | built-unchecked | A stale page names its own session on every app request and the server refuses it with 409 (`src/lib.rs`); a page showing a desktop reloads on a change of person rather than renaming its session, so document saves are safe as a class. `runOps` and `uploadFile` hold one session across their sends, and Finder, QuickTime Player, Script Editor, Automator, Safari, Dictionary and the Save dialog pass the one their window or save began with. Upload, New Folder and a document save across a sign-in: `e2e/upload-two-accounts-journey.mjs`; retries: `demos/desktop/desktop-files.test.ts`. Multi-step saves in Music, Books, Font Book, Photo Booth, Voice Memos and Photos, Export's folder and files among them, hold one session too: `photos-drive.test.ts`, and Export's changes each name one person in `e2e/preview-photos-batch9-journey.mjs`. |
| One look for drop highlight and refusal | done | [Outlined target and count](#project-artifact/art_feed73a04b7ab5a0/1) |

## Opening a file in the right app (11: 10 done, 1 partial)

| Item | Status | Main |
| --- | --- | --- |
| Request queue: `requestOpenFile`, `takeOpenFileRequests`, `onOpenFileRequest` | done | Reaches a window opening now and one already open: `e2e/open-in-apps-journey.mjs` |
| Text documents to TextEdit | done | [A Mail attachment's words in TextEdit](#project-artifact/art_819e645e9197a100/64), `e2e/open-in-apps-journey.mjs` |
| Pictures and PDFs to Preview | done | [A PDF, its name in the title](#project-artifact/art_a7e016210b9b9bc1/626): `e2e/cross-app-rows-journey.mjs`. A picture through the same queue: `e2e/preview-journey.mjs` |
| Spotlight uses the same queue | done | [A text file found by name opens in TextEdit with its words](#project-artifact/art_a7e016210b9b9bc1/625), same journey |
| Files no app takes fall back to Quick Look | done | From a Mail attachment: `e2e/open-in-apps-journey.mjs` |
| Sound to Music | done | [Double-click and the Dock tile: added once, and played](#project-artifact/art_c9443d16a033da1b/8) |
| Movie to QuickTime Player | done | [A double-click in Finder](#project-artifact/art_3e7ee16bed9df50f/36), `e2e/quicktime-finder-journey.mjs` |
| `.ics` to Calendar, `.vcf` to Contacts | done | [An `.ics` opens Calendar with the import's sheet](#project-artifact/art_3911243b768b7538/9), `e2e/calendar-open-journey.mjs`. [A `.vcf` opens Contacts and adds its card](#project-artifact/art_819e645e9197a100/65), read back from the server: `e2e/open-in-apps-journey.mjs`. Contacts adds it and says so, without the question a Mac asks first |
| `.webloc` or a URL file to Safari | done | A double-click in Finder opens the address in a tab, read back from the server: `e2e/open-in-apps-journey.mjs` |
| Open With and a per-file default | done | The map was stale. File > Open With and Always Open With in Finder, keeping the default on the server, [Choose, and keep as the default](#project-artifact/art_a7e016210b9b9bc1/396): `e2e/finder-rows-more-journey.mjs`. Get Info's Open with and Change All (`finder-info.tsx`) use the same `appsForFile` and `chooseOpenerFor` |
| Mail attachment opens in the right app | done | The attachment's Open button puts it in Downloads and opens it, or shows it in Quick Look: [in TextEdit](#project-artifact/art_819e645e9197a100/64), `e2e/open-in-apps-journey.mjs` |

## Clipboard between apps (8: 5 done, 2 built-unchecked, 1 partial)

| Item | Status | Main |
| --- | --- | --- |
| Text copied and pasted between apps | done | [Copied in Notes by Edit > Copy and pasted in TextEdit by Edit > Paste](#project-artifact/art_a7e016210b9b9bc1/90); from TextEdit into Notes by the key and by Edit > Paste, read back from the server: `e2e/cross-app-text-journey.mjs` |
| `copyText` helper, which says whether it worked | built-unchecked | Siri's Copy reaches the clipboard, read back: `e2e/cross-app-rows-journey.mjs`. When the browser refuses, Siri says so: `e2e/desktop-batch3-journey.mjs` |
| Finder's file clipboard | done | [Pasted in a second Finder window](#project-artifact/art_feed73a04b7ab5a0/4) |
| File names on the system clipboard | partial | **Limit:** a page's clipboard takes text, HTML and PNG; no browser lets a page write a list of files, and a page cannot read the files of a copy made elsewhere. Writing the names as plain text was left out by decision, so copying files changes only the desktop's own clipboard, and a copy made outside the browser does not replace the copied files. |
| Spotlight's copy | done | Command-C copies the result: `e2e/spotlight-keys-journey.mjs` |
| Paste copied files into another app | done | Command-V after Command-C on a desktop icon, into Mail, Messages and Photos: `e2e/desktop-into-apps-journey.mjs`. [Edit > Paste from the menu bar into a note](#project-artifact/art_a7e016210b9b9bc1/510), which needs no leave from the browser, read back from the server: `e2e/cross-app-more-journey.mjs`. A copy made outside the browser does not replace copied files, so a later paste brings the files |
| Pictures and rich text between apps | built-unchecked | [A photo copied in Photos pastes into a note as a picture](#project-artifact/art_a7e016210b9b9bc1/320) and into a new message as an attachment: `e2e/pictures-between-apps-journey.mjs`. Rich text: bold copied in TextEdit stays bold in Notes, read back from the server, `e2e/cross-app-text-journey.mjs`. A picture on the computer's clipboard reaches Photos, TextEdit, Messages, and now Notes and Mail's New Message: `e2e/mail-notes-batch7-journey.mjs`, Chromium, the only browser that lets a page write a picture there. The map was stale on Preview: its Edit > Copy of a picture or a selection writes a PNG, and `e2e/preview-photos-batch9-journey.mjs` read it from the clipboard and pasted it into Notes, Mail and Messages |
| Show Clipboard window | done | Finder's Edit menu: [the file copied](#project-artifact/art_819e645e9197a100/55), `e2e/edit-footer-journey.mjs` |

## Share sheet (7: 5 done, 2 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Link rows in any app: `LinkShareItems` | done | [Safari's Share > Notes](#project-artifact/art_a7e016210b9b9bc1/101), `e2e/share-links-journey.mjs`, which also runs them from News and Stocks |
| Links to Mail, Messages, Notes, Reminders | built-unchecked | Notes and Messages: [the note made](#project-artifact/art_a7e016210b9b9bc1/101), `e2e/share-links-journey.mjs`; Mail: `e2e/mail-share-journey.mjs`; Reminders: `e2e/reminders-share-journey.mjs` |
| AirDrop dimmed with its reason | done | [Dimmed in Finder's Share menu](#project-artifact/art_a7e016210b9b9bc1/627), the reason read from the row: `e2e/cross-app-rows-journey.mjs` |
| Share files from Finder and Quick Look | done | Finder's Share > Messages: [the file in the conversation](#project-artifact/art_a7e016210b9b9bc1/99), `e2e/messages-share-files-journey.mjs`; Share > Mail: `e2e/mail-share-journey.mjs`; Share > Notes with a file: `e2e/notes-drop-journey.mjs` on the hosted site. [Quick Look's Share](#project-artifact/art_a7e016210b9b9bc1/509), to Notes, read back from the server: `e2e/cross-app-more-journey.mjs` |
| Share pictures and files from other apps | built-unchecked | Photos, Preview, QuickTime Player, Photo Booth and Voice Memos have the file rows. Share in Photos to Notes: [the picture in the note](#project-artifact/art_a7e016210b9b9bc1/320), `e2e/pictures-between-apps-journey.mjs`. [Preview's File > Share > Mail](#project-artifact/art_a7e016210b9b9bc1/513) attaches the picture, the New Message in front, and closed, the draft on the server holds it: `e2e/cross-app-more-journey.mjs`. Voice Memos to Mail and Messages, QuickTime Player to Mail and Photo Booth to Messages, each sent to another account and its bytes read from what they received: `e2e/small-rows-batch12-journey.mjs` |
| Extensions preference chooses the rows | done | Notes switched off in the pane, kept on the server, [and gone from Finder's Share menu](#project-artifact/art_a7e016210b9b9bc1/511), Mail staying: `e2e/cross-app-more-journey.mjs` |
| Add to Photos, Add to Reading List | done | [Add to Photos from Quick Look](#project-artifact/art_a7e016210b9b9bc1/512), read back from the library: `e2e/cross-app-more-journey.mjs`. Add to Reading List from another app's Share menu joins what Safari keeps, opening Safari: `e2e/share-reading-list-journey.mjs` |

## Addresses and desktop effects (3: 3 done)

| Item | Status | Main |
| --- | --- | --- |
| `openUrl` queue to Safari | done | [Spotlight's web search in a Safari tab](#project-artifact/art_a7e016210b9b9bc1/100), `e2e/spotlight-journey.mjs`; [a saved link](#project-artifact/art_a7e016210b9b9bc1/98), `e2e/open-in-apps-journey.mjs` |
| `requestDesktopEffects`: open an app, set the appearance | done | [Siri setting dark mode](#project-artifact/art_a7e016210b9b9bc1/641) and opening Calculator: `e2e/siri-rows-journey.mjs` |
| Spotlight's web search uses the queue | done | [A tab in Safari](#project-artifact/art_a7e016210b9b9bc1/100), read back from the server, `e2e/spotlight-journey.mjs` |

## Dock, Spotlight, Mission Control (5: 4 done, 1 partial)

| Item | Status | Main |
| --- | --- | --- |
| Dock opens and raises apps | done | [TextEdit raised over Notes from its tile, with its menus in front](#project-artifact/art_a7e016210b9b9bc1/90), also with text being edited or just after a menu: `e2e/cross-app-text-journey.mjs`. A New Message opened from a menu no longer comes back over the app a tile opened just after: `e2e/apps-window-menu-journey.mjs`. A tile pressed within about 200 ms of a menu closing can miss it |
| Spotlight opens apps and files | done | [A file in its application, and an application by name](#project-artifact/art_a7e016210b9b9bc1/625): `e2e/cross-app-rows-journey.mjs`. Other results open the app, not the item |
| Notification opens its app | built-unchecked | [The banner's Show opens it](#project-artifact/art_a7e016210b9b9bc1/628), and a press on the banner itself: `e2e/cross-app-rows-journey.mjs`. The app is asked to show the item where it can |
| Mission Control lists every app's windows | done | [Every window, live and apart](#project-artifact/art_a7e016210b9b9bc1/97), `e2e/mission-control-journey.mjs` |
| Look Up from a menu | done | [Services > Look Up in Dictionary](#project-artifact/art_a8d16e1712d88efa/1) in every application's menu acts on the selected text; a context-menu Look Up is each app's own, as TextEdit's |

## Build items, most used first

These land before Finder's own items. Each lands with a short note to the app workers saying how to use it.

1. **C1 Shared drag.** New `demos/desktop/desktop-drag.ts`: a payload of drive items, `registerDropTarget(element, accept, drop)`, one drag image, one highlight. Finder moves onto it, and Dock tiles become targets. First consumers proving it: Finder to Photos, Mail and Notes, working with those apps' workers on the receiving side. Mail needs attachments, which main cut; the export holds that earlier work.
2. **C2 Open in the right app.** One `openFile(entry)` over `finder-open.ts`, an extended kind table (sound, movie, `.ics`, `.vcf`, URL file), Open With and a kept default. A generic `openItem(app, id)` so Spotlight, Notification Center and Siri can open the item, not just the app. Each receiving app takes its requests with its own worker.
3. **C3 Desktop clipboard.** New `desktop-clipboard.ts`: copied drive items shared by all windows, kept alongside the browser's clipboard text. Pasting files into apps that take them. Show Clipboard. Spotlight moves to `copyText`.
4. **C4 File share sheet.** `shareFiles` beside `shareLink`, with receivers in Mail, Messages, Notes and Photos. Finder and Quick Look turn Share on. AirDrop stays dimmed with its reason.
5. **C5 Text and link drag.** Plain text and links dragged between apps, using native `DataTransfer`.

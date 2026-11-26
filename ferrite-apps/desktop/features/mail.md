# Feature inventory: Mail

Read from GitHub, main commit `e62c2ac9`. Nothing was built or run for this inventory, and the shared tree was not read.

**Status.** `missing`: main has nothing for it. `partial`: main has some of it, and the note says what is absent. `built-unchecked`: main's code has it, and nobody has checked it in a browser for this inventory. No row says done. A row becomes done only with a screenshot of it working in the running app.

**Source of the real app's list.** The menu items and shortcuts are written from knowledge of Mail on macOS 10.15. They were not checked on a Mac, or against the reference screenshots, because the tree is stale. Fix a wrong row when it is found.

**Files read.** `demos/mail/`: `app.ts`, `mail.tsx`, `mail-live.tsx`, `mail-compose.tsx`, `mail-preferences.tsx`, `mail.mdx`, the start of `mail-data.ts`. `demos/desktop/`: `desktop-menus.tsx`, `desktop-app-menus.ts`, `desktop.tsx` and `desktop-windows.tsx`. Also the desktop README and the open work ledger.

**How the menu bar works.** `app.ts` names nine menus. The desktop fills each from its title. It carries out Hide, Hide Others, Show All, Quit, Close Window, Enter Full Screen, Minimize, Zoom and Bring All to Front. Mail registers its own items only in Format and Edit, and only from the New Message window. So Mailbox and Message show one dimmed row, "This demo has no … commands", in `desktop-menus.tsx`.

## Counts

| Section | Rows | done | built-unchecked | partial | missing |
| --- | --- | --- | --- | --- | --- |
| Mail menu | 9 | 5 | 3 | 1 | 0 |
| File menu | 15 | 9 | 6 | 0 | 0 |
| Edit menu | 24 | 13 | 11 | 0 | 0 |
| View menu | 16 | 12 | 3 | 1 | 0 |
| Mailbox menu | 15 | 11 | 3 | 1 | 0 |
| Message menu | 22 | 19 | 3 | 0 | 0 |
| Format menu | 18 | 1 | 17 | 0 | 0 |
| Window menu | 9 | 5 | 4 | 0 | 0 |
| Help menu | 2 | 0 | 2 | 0 | 0 |
| Preferences window | 9 | 4 | 3 | 2 | 0 |
| Windows | 4 | 1 | 3 | 0 | 0 |
| Sidebar | 10 | 4 | 6 | 0 | 0 |
| Favorites bar | 3 | 1 | 2 | 0 | 0 |
| Message list | 2 | 0 | 2 | 0 | 0 |
| Message pane | 8 | 2 | 5 | 0 | 1 |
| Viewer toolbar | 13 | 1 | 12 | 0 | 0 |
| New Message toolbar | 8 | 2 | 6 | 0 | 0 |
| New Message fields | 13 | 1 | 12 | 0 | 0 |
| Context menus | 4 | 3 | 1 | 0 | 0 |
| Keyboard | 7 | 0 | 7 | 0 | 0 |
| Drag and drop | 8 | 3 | 5 | 0 | 0 |
| Multi-selection | 3 | 3 | 0 | 0 | 0 |
| Saved state | 6 | 2 | 4 | 0 | 0 |
| Server and ledger | 9 | 0 | 7 | 1 | 1 |
| Cross-app | 14 | 3 | 11 | 0 | 0 |
| **Total** | **251** | **105** | **138** | **6** | **2** |

A row driven by the batch's journey stays `built-unchecked` until its screenshot is published and linked.

## Menus

### Mail menu

| Item | Status | Note |
| --- | --- | --- |
| About Mail | done | Desktop's item. [The About window](#project-artifact/art_0ec4ebf78af349f9/80). `mail-rows-journey`. |
| Preferences… ⌘, | built-unchecked | Opens Mail's Preferences window, or brings an open one forward. A press on the viewer covers it, as on a Mac; the command and ⌘, bring it back, key (`rows-batch23-journey`, screenshot `mail-preferences-behind`, not published). With a New Message window the viewer itself places (outside the desktop, which manages its own), a press on that window sends Preferences under the viewer too. |
| Accounts… | built-unchecked | Opens System Preferences on Internet Accounts. Driven in Chromium by the batch's journey; its screenshot is not published yet. |
| Add Account… | partial | Dimmed, and says why: outside mail needs a mail provider account, which only the owner can set up. Same journey. |
| Services | built-unchecked | The map was stale: the desktop's `ServicesItems` lists what applies to the selection, and says No Services Apply otherwise (`desktop-menus.tsx`). Not driven for Mail. |
| Hide Mail ⌘H | done | Desktop's item. Mail's window gone with no tile of its own, read from the window by `mail-rows-journey`; [same section](#project-artifact/art_0ec4ebf78af349f9/82). Item driven, not the key. |
| Hide Others ⌥⌘H | done | Desktop's item. [Calculator hidden, Mail left](#project-artifact/art_0ec4ebf78af349f9/82). `mail-rows-journey`. Item driven, not the key. |
| Show All | done | Desktop's item. Brings Calculator back, read from the window; [same section](#project-artifact/art_0ec4ebf78af349f9/82). `mail-rows-journey`. |
| Quit Mail ⌘Q | done | Keeps an open draft; `mail-drafts-journey`. |

### File menu

| Item | Status | Note |
| --- | --- | --- |
| New Message ⌘N | done | Item and key: [a New Message open](#project-artifact/art_0ec4ebf78af349f9/83). `mail-rows-journey`. A browser may keep Ctrl-N for itself. |
| New Viewer Window ⌥⌘N | built-unchecked | Another viewer of the same mail, a window of the desktop, as many as asked for: it reads the same server and shows its own mailbox and selection. The person's kept view and settings stay the first viewer's to write, and a further viewer is not reopened after a reload. `mail-notes-batch3-journey`. |
| Open Message ⌘O | done | The item opens the selected message's window, `mail-message-window-journey`. The key has only code behind it. |
| Close Window ⌘W | done | New Message and the viewer both keep the draft. |
| Close All ⌥⌘W | done | [The File row with Option held](#project-artifact/art_0ec4ebf78af349f9/83) and its key: the New Message and the viewer close, the message stays a draft on the server. `mail-rows-journey`. |
| Save ⌘S | done | Saves a New Message window's text now; `mail-drafts-journey`. |
| Save As… ⇧⌘S | done | One message as an `.eml`, several as an mbox, with their whole text, read from the downloaded file by `mail-rows-journey`; a download shows nothing, so the link is [the same section's page](#project-artifact/art_0ec4ebf78af349f9/79). Absent: the panel's Format choice (Rich Text, Plain Text) and attachments' bytes. |
| Save as Stationery | built-unchecked | File's row, while a New Message is the key window: names it, and keeps its subject and text under `mail.stationery`, about 4 KB in all; past that the alert refuses and says so. Unit tests only. |
| Attach Files… ⇧⌘A | done | [Three files: from the drive, the computer and Finder](#project-artifact/art_193e88d1bee786c4/23). Open panel of the drive, with From This Computer. `mail-attachments-journey`. |
| Save Attachments… | built-unchecked | Every file of the messages selected goes to Downloads on the drive, and an alert names them. Dimmed on a message with none. Driven in Chromium by the batch's journey; screenshot not published yet. Each file keeps Save to Downloads and Download. |
| Quick Look Attachments ⌘Y | built-unchecked | Finder's Quick Look shows the first file, read back by the same journey. It puts the files in Downloads first, since Quick Look reads the drive; real Mail leaves no copy. |
| Add to Calendar | built-unchecked | The `.ics` files of the messages selected go to Calendar's import, which asks where they go; the attachment in the reader has the same as a button. Dimmed with why on a message with none. It puts the file in Downloads first, as Open does, since Calendar reads the drive. Screenshot `pim5-add-to-calendar`. `pim-batch5-journey` reads the event from the server, across a reload, in Chromium, Firefox and WebKit (`--only mail`, 7 steps each, also Raw Source's window). |
| Import Mailboxes… | built-unchecked | An mbox file from the computer becomes a mailbox of its name under On My Mac, on the server (`POST /api/mail/import`), and an alert says how many. Importing the same file again makes nothing twice, read back from the server in Chromium by a journey kept out of the tree; screenshot not published. Absent: the drive's Open panel, and files inside a message: only the text is read. |
| Export as PDF… | done | [The page handed to the browser](#project-artifact/art_0ec4ebf78af349f9/79), with sender, subject and text. A headless browser shows no dialog, so the dialog itself is unchecked. `mail-rows-journey`. |
| Print… ⌘P | done | [The page handed to the browser](#project-artifact/art_193e88d1bee786c4/31), with headers and whole text, `mail-print-journey`. A headless browser shows no dialog, so the dialog itself is unchecked. |

### Edit menu

| Item | Status | Note |
| --- | --- | --- |
| Undo ⌘Z | done | New Message's text, and in the viewer moves, flags, marks and mutes; checked in `mail-commands-journey`. |
| Redo ⇧⌘Z | done | Item and key on a flag, read from the server by `mail-rows-journey`; [same section](#project-artifact/art_0ec4ebf78af349f9/85). |
| Cut ⌘X | done | New Message's text, and in the viewer the messages selected, copied as Copy copies them and then deleted as Delete does; only messages that reached the clipboard are deleted. `mail-rows-journey`. |
| Copy ⌘C | done | The Edit item, on the messages selected (sender, subject, text) and on text selected, read from the clipboard; [same section](#project-artifact/art_0ec4ebf78af349f9/85). `mail-rows-journey`. |
| Paste ⌘V | done | New Message's text, and a picture from the computer's clipboard becomes an attachment (`mail-notes-batch7-journey`). Dimmed in the viewer, with the reason: the browser's clipboard holds messages only as text, so there is nothing to put in a mailbox. |
| Select All ⌘A | done | [The whole list selected](#project-artifact/art_0ec4ebf78af349f9/85), by the item and the key. New Message's text is `mail-compose-editor-journey`'s. `mail-rows-journey`. |
| Emoji & Symbols ⌃⌘Space | built-unchecked | The map was stale: the desktop's Edit footer shows the character viewer, which types where the person was typing (`desktop-menus.tsx`, `desktop-characters.tsx`). Not driven for Mail. New Message's Emoji pull-down still offers five characters; see its row. |
| Paste and Match Style ⌥⇧⌘V | built-unchecked | New Message: the editors' row (`EditorMoreItems`). Its code has TextEdit's tests; the row is listed by a unit test and not driven for Mail. |
| Paste as Quotation ⇧⌘V | built-unchecked | New Message: the clipboard's text as one quote level, as text, with a line to go on under it; `> ` lines in a plain message. Driven in Chromium by the batch's journey; screenshot not published yet. |
| Delete | done | Viewer's Edit menu: to the Trash, read from the server; [same section](#project-artifact/art_0ec4ebf78af349f9/85). `mail-rows-journey`. |
| Append Selected Messages | built-unchecked | New Message: From, Subject, Date and the whole text of what the viewer has selected, at the end. Dimmed with a reason when nothing is selected. Same journey. |
| Attachments submenu | built-unchecked | Include Original Attachments in Reply brings a reply's original's files in, read and uploaded anew, and Martin's copy holds the same bytes; dimmed with the reason on a reply to a message with no files (`mail-rows-batch11-journey`). Always Send and Send Windows-Friendly Attachments are checks that can be chosen, the first kept as `mail.windowsFriendly`, and they change no byte, which each row's tooltip says: real Mail strips resource forks, and a file from a browser or the drive has none. Bytes read back the same with it on. Insert at End starts unchecked, as real Mail does (kept as `mail.attachmentsAtEnd`); off, a file takes the insertion point of a rich text message, Remove takes its place out, and the reader shows the file between the words and not again under them. `rows-batch22-journey`, Chromium, read back from the text and the server; screenshot not published. Limits: in the window being written the file is a chip with its name, also listed under the text with its commands. A list preview or notification reads the name in with the words. A plain text message has no place for a file, so the row is checked and dimmed with that reason. A file is found in the text by its name, so of two of one name the first mark gets the first. |
| Complete Address | built-unchecked | Finishes what To, Cc or Bcc holds unfinished, from the contacts; leaving the field for the menu has made it a token, and that token is replaced. Dimmed with a reason when there is nothing to finish. No key, as ⌥⎋ and F5 are the browser's. Unit test and the same journey. |
| Find > Mailbox Search ⌥⌘F | done | [What is typed narrows the list](#project-artifact/art_0ec4ebf78af349f9/86). The menu item left the keyboard in the list until this change. Key driven in a page reading as a Mac's, whose browser identity was changed for the step; off a Mac, Control-Option-F is the desktop's Enter Full Screen and comes first. `mail-rows-journey`. |
| Find > Find ⌘F | done | [Opens a bar over the message](#project-artifact/art_0ec4ebf78af349f9/37), in the viewer and a message's own window; matches marked and counted, across inline formatting but not from one line to the next. `mail-find-journey`. New Message now has the editors' Find bar and its keys, driven by the batch's journey. Marks need CSS custom highlights (Firefox 140 or newer); without them the bar still counts. |
| Find > Find Next ⌘G | done | [Menu, key, the bar's button and Return](#project-artifact/art_0ec4ebf78af349f9/81). `mail-rows-journey`. |
| Find > Find Previous ⇧⌘G | done | [Menu, key, the bar's button and Shift-Return](#project-artifact/art_0ec4ebf78af349f9/81). `mail-rows-journey`. |
| Find > Jump to Selection ⌘J | done | [Scrolls to the match by the item, to the selection by the key](#project-artifact/art_0ec4ebf78af349f9/84), read from the pane's scroll position. `mail-rows-journey`. A browser may keep Ctrl-J for itself. |
| Find > Use Selection for Find ⌘E | done | [Item and key](#project-artifact/art_0ec4ebf78af349f9/84). `mail-rows-journey`. |
| Spelling and Grammar submenu | built-unchecked | New Message: the desktop's panel, Check Document Now, Check Spelling While Typing, which is the Composing preference, and Check Grammar With Spelling, shared with TextEdit. Autocorrect is dimmed with its reason. Panel opened by the batch's journey. |
| Substitutions submenu | built-unchecked | New Message: the desktop's panel and checks, kept with the person's settings under `mail.substitutions`; applied as a message is typed. Panel opened by the batch's journey. Data Detectors is dimmed with its reason. |
| Transformations submenu | built-unchecked | New Message: Upper, Lower and Capitalize on the selection. Make Upper Case driven by the batch's journey. |
| Speech submenu | built-unchecked | New Message's Edit menu (the browser's `speechSynthesis`) and a message text's menu in the viewer. Dimmed where the browser has no voice. Not driven with sound. |
| Start Dictation | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer. |

### View menu

| Item | Status | Note |
| --- | --- | --- |
| Sort By submenu | done | Date, Flags, From, Mailbox, Subject, To, Unread, Ascending, Descending; Subject checked in `mail-commands-journey`. Absent: Attachments and Size, which headers do not hold. |
| Filter > Enable Message Filter ⌘L | done | [Unread mail only](#project-artifact/art_0ec4ebf78af349f9/87), by the item; the key turns it off. `mail-rows-journey`. |
| Show or Hide Mailbox List ⇧⌘M | done | Key checked in the journey. |
| Filter > Flagged, To: Me, Cc: Me, With Attachments, From VIPs | done | Each chosen in the menu; From VIPs driven in `mail-vips-journey`. |
| Message > All Headers ⇧⌘H | done | Every header line this desktop keeps: From, To, Cc, Subject and Date. It has no transport headers. `mail-source-journey`. |
| Message > Raw Source ⌥⌘U | built-unchecked | [Those lines and the whole text](#project-artifact/art_193e88d1bee786c4/50), now in a window of its own on the desktop, one per message, the reader left as it was; choosing it again, or the window's close button, closes it. Without a desktop it stays in the viewer's pane. Screenshot `pim5-raw-source`. `pim-batch5-journey`. |
| Organize by Conversation | done | Kept with the view, across a reload. A subject with Re: and Fwd: taken off, among people other than you who overlap. A thread has one row with its count; selected whole, the pane shows all of it, messages of other mailboxes marked "In Sent". Commands act on what this mailbox lists, Mute on all of it. A search is listed flat, and so is Drafts. [A thread read](#project-artifact/art_0ec4ebf78af349f9/38) and [opened, with its pane](#project-artifact/art_0ec4ebf78af349f9/39); `mail-conversations-journey`. Off by default, unlike Mail on a Mac, since the reference screenshots show a flat list. |
| Expand and Collapse All Conversations | done | Both items, the row's triangle, and the Right and Left arrows, all driven in the same journey; [opened, with its pane](#project-artifact/art_0ec4ebf78af349f9/39). |
| Show or Hide Favorites Bar ⌥⇧⌘H | done | Item checked in the journey. |
| Hide Toolbar | built-unchecked | And Show Toolbar, in the viewer, kept with the view on the server. Driven in Chromium by the batch's journey, read back from the server; screenshot not published yet. |
| Customize Toolbar… | built-unchecked | A sheet of the toolbar's items with Use Default Set, as Automator's: taken out at once and kept with the view; Mute taken out and still out after a reload in the same journey. Absent: reordering and spaces. |
| Show Tab Bar and Show All Tabs | partial | A message window and a New Message window can join as tabs of one window, using TextEdit's document tabs (`mail-tabs.tsx`): View > Show Tab Bar, + on the bar for a New Message tab, Show All Tabs as an overview of cards, Window > Show Previous or Next Tab, Move Tab to New Window and Merge All Windows, kept as `mail.tabs` with the person's settings. `mail-tabs.test` drives these against the real window manager with no browser. `mail-tabs-prefs-journey --only tabs` drives them in Chromium, Firefox and WebKit, the group read from the server: Show Tab Bar, + for a New Message tab on one frame, choosing a tab, Show All Tabs and a card, Show Previous and Next Tab, Move Tab to New Window, Merge All Windows, closing a tab leaves the other in front, and Show Tab Bar dimmed with the reason while the viewer is key (15 steps). As in real Mail, message and New Message windows take tabs and the viewer does not, so its dimmed rows are not a gap. **Why partial:** a viewer holds one New Message window, so two tabs of New Message need two viewers, and + is absent once that one is among the tabs, where real Mail opens another each time; a page cannot enter full screen as tabs by itself, so full screen does not join windows. |
| Bcc Address Field ⌥⌘B | done | [Bcc, Reply-To and Priority in a New Message](#project-artifact/art_0ec4ebf78af349f9/3). View's item and the key; which fields show is kept with the person's settings. `mail-fields-journey` reads the message from the server: the person gets it, only the Sent copy names them. |
| Reply-To Address Field ⌥⌘R | done | Same. A reply goes there, unless the message is one's own. |
| Priority Field | done | Same. Kept with the draft across a reload. |
| Enter Full Screen ⌃⌘F | done | Desktop's item. [The window fills the screen](#project-artifact/art_0ec4ebf78af349f9/88), and Exit gives its size back. Off a Mac the key is Control-Option-F. `mail-rows-journey`. |

### Mailbox menu

Registered by the viewer.

| Item | Status | Note |
| --- | --- | --- |
| Get All New Mail ⇧⌘N | done | [Journey](#project-artifact/art_193e88d1bee786c4/1): `mail-commands-journey` presses the key until four messages arrive. |
| Erase Deleted Items… | done | [Alert](#project-artifact/art_193e88d1bee786c4/3), then erased on the server. ⇧⌘⌫. |
| Go To > Inbox ⌘1, Sent ⌘2, Drafts ⌘3 | done | Menu and keys; ⌘2 checked in `mail-commands-journey`. A browser may keep Ctrl-1 to Ctrl-9 for its tabs. |
| Online Status > Take All Accounts Offline | built-unchecked | Built in the served desktop: the item flips to Take All Accounts Online, Get Mail, Synchronize and Rebuild dim, what was loaded stays across a reload (a copy in this browser's IndexedDB), an unread message says it has not been downloaded, and a send waits in the Outbox in the sidebar under its idempotency key. Online sends it; a lost answer stays in the Outbox and Get Mail resends the same key, delivered once; a refusal stays with its reason; Delete takes a message out. Neither Mail nor the Dock reads the mailboxes while offline: the Dock's count comes from the same kept copy (`mail-outbox.test`, `mail-rows-batch11-journey`). Log Out, and any page that finds no one signed in, forgets the copy of the mailboxes; the Outbox and a too-large draft waiting to be saved stay in this browser, readable by anyone with its storage, until that person is next online, because they exist nowhere else; they are shown to no other account. Limits: flags, moves, erasures, drafts and attachment reads still reach the server, and so does asking Siri about mail or an Automator mail action; the desktop's stream still announces a delivery; a waiting message cannot be edited; its unsent files can be cleared after a day. Dimmed with a reason on the undeployed demo. |
| Synchronize All Accounts | built-unchecked | Reads the mailboxes from the server again, as there is one account. Same journey. |
| Erase Junk Mail ⌥⌘J | done | Same alert; checked in `mail-commands-journey`. |
| New Mailbox… | done | [Trips under On My Mac, two messages moved in](#project-artifact/art_193e88d1bee786c4/21). Alert with a name; kept on the server per person. `mail-mailboxes-journey`. |
| New Smart Mailbox… | done | [The list after a reload](#project-artifact/art_0ec4ebf78af349f9/1). The sheet's conditions, any or all, and whether Trash and Sent count; kept with the person's settings, `mail-smart-journey` reads them from the server. Conditions read the first 4,000 characters of a message not opened yet, and the pages loaded. |
| Edit Smart Mailbox… | done | Same journey. Menu bar and the row's menu. |
| Duplicate Smart Mailbox | done | Same journey, from the row's menu. |
| Rename Mailbox… | done | Menu bar and the mailbox's contextual menu, a mailbox the person made or a Smart Mailbox. Same screenshot; `mail-mailboxes-journey` reads it back from the server. |
| Delete Mailbox… | done | Asks, then moves its messages to the Trash, where Mail on a Mac erases them: nothing is erased without a second step. Same screenshot; `mail-mailboxes-journey` reads it back from the server. |
| Export Mailbox… | done | In the Mailbox menu and on a mailbox's row: an `.mbox` of what it holds, read from the file by `mail-rows-journey`, whose [window in the same run](#project-artifact/art_0ec4ebf78af349f9/87) shows the mailbox; a download shows nothing. Says to Load More first while older messages are not listed (not driven). Attachments' bytes are not in the file. |
| Use This Mailbox For submenu | partial | On a mailbox the person made, Sent, Trash, Archive and Junk are real, kept under `mail.roles`: the server files the sender's copy where the send names (`sent_box`, carried by a send waiting in the Outbox too), Delete moves there (a draft still leaves by the server's own Trash), and erasing from the Trash's stand-in hands the message to the Trash first, which is the only place the server erases from. Toolbar, menus and the rules for muted mail follow Archive and Junk. A deleted mailbox gives the role back. Drafts stays dimmed with the true reason: the server keeps a draft only in Drafts and replaces it there. `tests/mail.rs`, `mail-batch-two.test.tsx`, `mail-quote-roles-journey`. |
| Rebuild | built-unchecked | Forgets the messages' texts held in the page and reads the mailboxes from the server again. Same journey and a unit test. |

### Message menu

The menu is registered by the viewer. `built-unchecked` here means the item and its key exist and the journey did not drive that one.

| Item | Status | Note |
| --- | --- | --- |
| Send ⇧⌘D | done | The key drives every send in `mail-commands-journey`. |
| Reply ⌘R | done | [Item and key: addressed to the sender, Re:](#project-artifact/art_0ec4ebf78af349f9/89). `mail-rows-journey`. |
| Reply All ⇧⌘R | done | Item and key: to the sender, others in Cc, not oneself; [same section](#project-artifact/art_0ec4ebf78af349f9/89). `mail-rows-journey`. |
| Forward ⇧⌘F | done | [Item and key: Fwd:, the text, nobody addressed](#project-artifact/art_0ec4ebf78af349f9/90). `mail-rows-journey`. |
| Mark > As Read and As Unread ⇧⌘U | done | On the whole selection, read back from the server in the journey. |
| Mark > As Junk Mail ⇧⌘J | done | Key checked in the journey. |
| Archive ⌃⌘A | done | Item checked in the journey. The key needs Command and Control, so it works only on a Mac. |
| Move to submenu | done | [Bravo filed in Archive](#project-artifact/art_0ec4ebf78af349f9/184), read from the server, and Undo names it a Move. `mail-rows-more-journey`. |
| Flag submenu | done | [Message > Flag on three messages](#project-artifact/art_193e88d1bee786c4/1). Keys ⌥⌘1 to ⌥⌘7, Clear ⌥⌘0. |
| Mute | built-unchecked | On the whole thread, Sent copy too, by the same conversations whether the list shows them or not; new mail of a muted thread is muted when it is first listed, and delivery brings no notification for it: a muted conversation's subject and people are kept in the person's space (`mute/`), read on delivery. `mail-notes-batch3-journey`, reading the notification inbox from the server. |
| Delete ⌫ | done | Item, ⌘⌫ and the Delete key, and on a selection of two, read from the server each time; Undo after each; [same section](#project-artifact/art_0ec4ebf78af349f9/186). `mail-rows-more-journey`. |
| Send Again ⇧⌘D | done | Item and key: a New Message from a sent message, addressed as it was, read from the window. No screenshot of its own. `mail-rows-more-journey`. |
| Forward as Attachment | done | [A New Message with the message as a file](#project-artifact/art_0ec4ebf78af349f9/56); the other person receives the file. Without its own attachments' bytes. `mail-files-journey`. |
| Redirect ⇧⌘E | done | Item and key: a New Message with the same subject and text, and nobody addressed; [same section](#project-artifact/art_0ec4ebf78af349f9/90). `mail-rows-journey`. It sends as an ordinary message from the person: the original sender is not kept. |
| Mark > Low, Normal and High Priority | done | [The row's mark](#project-artifact/art_0ec4ebf78af349f9/182): each item chosen in the Mark submenu, stored on the server and marked on the row. `mail-rows-more-journey`. |
| Move Again ⌥⌘T | done | By the item and the key, each read from the server, after Move to; [same section](#project-artifact/art_0ec4ebf78af349f9/184). `mail-rows-more-journey`. |
| Copy to submenu | done | Kept on the server, the same text and files under an id of its own, read back with the original still in the Inbox by `mail-rows-more-journey`; a request sent again makes nothing twice (`tests/mail.rs`). No screenshot of its own. Undo does not take a copy back. |
| Apply Rules ⌥⌘L | done | [Charlie filed by the rule](#project-artifact/art_0ec4ebf78af349f9/186), on the selection, by item and key, and Undo takes it back, read from the server. `mail-rows-more-journey`. |
| Add Sender to Contacts ⇧⌘Y | done | [The new card](#project-artifact/art_193e88d1bee786c4/48): opens Contacts on a card naming the sender's account, or the one already there. Dimmed for several, or for your own mail. `mail-add-sender-journey` reads the card from the server. |
| Add Sender to VIPs | done | [Listed with its star](#project-artifact/art_0ec4ebf78af349f9/2): becomes Remove Sender from VIPs; kept with the person's settings, `mail-vips-journey` reads them from the server and after a reload. A person is compared by address alone. |
| Block Contact | built-unchecked | And Unblock Contact: kept with the person's settings under `mail.blocked`; the sender's messages say so over their text, with Unblock. Mail's default leaves them in the Inbox; Preferences > Junk Mail lists who is blocked, takes one off, and can move new mail from them to the Trash. The list has a unit test, the Trash choice has not been driven. |
| Remove Attachments | built-unchecked | Asks first, as it cannot be undone, then the server takes the files off the message (`remove_attachments` on `PATCH /api/mail/messages/<id>`); a repeat changes nothing and a draft is refused (`model.rs` test). Read back from the server by the same journey. Dimmed on a message with none. Absent: a line in the text naming what was removed, as a Mac writes. Another copy keeps its files, and the bytes are not freed. |

### Format menu

Registered only while New Message was the window last used; empty for the viewer, which is correct.

| Item | Status | Note |
| --- | --- | --- |
| Font > Show Fonts ⌘T | built-unchecked | |
| Font > Bold ⌘B | built-unchecked | |
| Font > Italic ⌘I | built-unchecked | |
| Font > Underline ⌘U | built-unchecked | |
| Font > Bigger ⌘+ | built-unchecked | |
| Font > Smaller ⌘- | built-unchecked | |
| Font > Show Colors ⇧⌘C | built-unchecked | |
| Text > Align Left ⌘{ | built-unchecked | |
| Text > Center ⌘\| | built-unchecked | |
| Text > Justify | built-unchecked | |
| Text > Align Right ⌘} | built-unchecked | |
| Style > Strikethrough | built-unchecked | In Font, checked at the insertion point. |
| Lists submenu | done | [A bulleted list, as the reader gets it](#project-artifact/art_0ec4ebf78af349f9/62). Insert Bulleted List driven; Numbered is the same command. Absent: Dashed. `mail-format-journey`. |
| Indentation submenu | built-unchecked | Increase ⌘] and Decrease ⌘[. `mail-format-journey`. |
| Quote Level > Increase ⌘' | built-unchecked | [Two levels in a New Message](#project-artifact/art_0ec4ebf78af349f9/72). Each selected line, or the line of the insertion point, takes one level more; a line is the deepest block with no block inside it, a list item or a plain table cell keeping its quote inside it. Sent with the message. Undo and Redo take it back and forth as one step, and put the very nodes back, so past the level what was typed before it can still be undone by the browser's history. `mail-format-journey`, `mail-quote-roles-journey`, in Chromium; this behaviour's screenshot not published yet. |
| Quote Level > Decrease ⌥⌘' | built-unchecked | Takes each selected line out of its nearest quote, splitting what lies between. A parent list item leaves its unselected nested list where it is. Splitting a nested list partway leaves no bullet of no text: an item the split leaves with only a list goes, the list keeping its indent as a list directly inside a list, which is what a sent message keeps. Undo as for Increase. `mail-format-journey`, `mail-quote-roles-journey`, in Chromium; screenshot not published yet. |
| Make Plain Text ⇧⌘T | built-unchecked | Asks first where it would take styles away; the message goes without styled text. Make Rich Text gives the commands back, not the styles. `mail-format-journey`. |
| Copy Style and Paste Style | built-unchecked | ⌥⌘C and ⌥⌘V: font, size, styles, colours and alignment of the insertion point's text. Not driven in the journey. |

### Window menu

| Item | Status | Note |
| --- | --- | --- |
| Minimize ⌘M | done | [A tile of its own in the Dock](#project-artifact/art_0ec4ebf78af349f9/187), by item and key. `mail-rows-more-journey`. |
| Zoom | done | [Grows the window](#project-artifact/art_0ec4ebf78af349f9/181), and again gives its size back. `mail-rows-more-journey`. |
| Bring All to Front | done | Mail's windows above Calculator, read from their stacking order by `mail-rows-more-journey`; [the window after it](#project-artifact/art_0ec4ebf78af349f9/183), where New Message lies behind the larger viewer. |
| Open windows list | done | [Names both windows](#project-artifact/art_0ec4ebf78af349f9/185), and choosing one brings it forward. `mail-rows-more-journey`. |
| Tile Window to Left and Right of Screen | built-unchecked | The map was stale: the shared desktop menu has both rows (`desktop-menus.tsx`). Not driven for Mail. |
| Message Viewer ⌘0 | done | [The menu row and its key, driven](#project-artifact/art_0ec4ebf78af349f9/57): both bring the viewer forward from a New Message. `apps-window-menu-journey`. |
| Activity ⌥⌘0 | built-unchecked | A window of its own: checking for new mail, sending, and when mail was last checked. Driven in Chromium by the batch's journey; screenshot not published yet. Absent: per-message progress. |
| Previous Recipients | built-unchecked | A window of its own, read from the Sent messages loaded: search, New Message, Add to Contacts for someone with an account, and Remove From List, kept under `mail.recipientsRemoved`. Same journey and unit tests. |
| Connection Doctor | built-unchecked | A window of its own: asks this desktop's mail server, says how long it took and who is signed in, with Check Again; says outside mail is not set up. Same journey and unit tests. |

### Help menu

| Item | Status | Note |
| --- | --- | --- |
| Mail Help | built-unchecked | The map was stale: on a desktop with Help Viewer the row opens it (`desktop-menus.tsx` `requestHelp`). Not driven for Mail. The Help button in Preferences stays dimmed, with its reason. |
| Search field | built-unchecked | The map was stale: `HelpMenuSearch`, on a desktop with Help Viewer. Not driven for Mail. |

## Preferences window

All eight panes exist. `mail.mdx`: only General has a reference capture, the other seven are stand-ins. What the served desktop cannot act on is dimmed there with its reason; off it the panes keep the capture's look.

| Item | Status | Note |
| --- | --- | --- |
| General | partial | Search-in-Trash and search-in-Junk act. Check for new messages acts: Every minute, 5 minutes or hour by the clock, Manually only on Get Mail, Automatically as the server announces (Every minute and Manually driven under a fast-forwarded browser clock in `mail-rows-batch11-journey`; the check is a timer of the page, so no clock server is involved). Archive or delete muted messages acts on new mail of a muted thread (Archive driven and read from the server, same journey). New messages sound plays on a message reaching the Inbox, and choosing one plays it; Play sounds for other mail actions plays on a message sent and on a Get Mail that brings nothing. All are Web Audio tones under the Sound pane's alert volume and Mute, and a sound of this name is a stand-in, since Apple's files are not part of this project (`mail-sounds.test`, `mail-notes-batch7-journey`, read as the tones asked for and the setting from the server). Mail arriving while the desktop's own notification sounds plays that alert too, which `desktop-notifications.tsx` owns. Downloads folder acts: Save, Save Attachments, Open and Add to Calendar put a file in Downloads or on the Desktop, as chosen, driven on a calendar file's arrival, with the message's button read as Save to Desktop; the only folders offered are those two, where real Mail has Other… (`mail-tabs-prefs-journey`, the file read from the drive with parent `desktop`). Add invitations to Calendar automatically acts: a calendar file arriving in the Inbox goes to that folder and opens Calendar's Import sheet unasked. Real Mail adds it silently; here the person still presses Import, since Calendar's import asks which calendar (same journey, the event read from the server). Automatically try sending later acts: with it on, a send with no known outcome closes the window and waits in the Outbox under its key, tried each minute and on Get Mail; off, the window holds it as before (same journey, under a route answering 503 in place of a failing server: the Outbox listed it and Martin had one copy from the server). Such a send plays no sent sound, since nothing has gone (`mail-sounds.test`). Remove unedited downloads acts: `mail-downloads.ts` lists each file Mail saves with its version, and After Message is Deleted (on a message erased from the server, the default as in real Mail) or When Mail Quits moves to the Trash those still as saved, where real Mail deletes them outright, so a removal can be undone; Never leaves them. A file saved before this list existed is never touched. Driven on two people in Chromium and read from the drive: the unedited file went to the Trash when its message was erased and one saved over since stayed, Never left the file and forgot it, and Quit Mail moved a file that had stayed while Mail ran (`mail-tabs-prefs-journey`, `mail-downloads.test`); a file renamed, moved or locked since is left alone only as far as `mail-downloads.test` shows, under a stand-in for the drive; `mail-tabs-prefs-journey` passes whole in Chromium, Firefox and WebKit, so Downloads folder, invitations, send later and these downloads are driven in all three. Closing a page does not count as quitting, a message that the server alone removes does not count as erased, and closing Mail's last window counts as quitting; none of those three was driven in a browser. **Why partial:** still dimmed with their reasons (`SERVED_SETTING_REASONS`): New message notifications, since the server decides those and the filter would go in the server or `desktop-notifications.tsx`, outside Mail's page; split view, since Mail here has none; Encrypted Messages, since nothing here is encrypted. |
| Accounts | partial | Names the person's one account: full name and address. Download attachments automatically acts, kept as `mail.downloadAttachments`: off, a picture or recording is read from the server only on Show Picture or Play, counted in `rows-batch22-journey` (Chromium, Show Picture driven, Play not). It is one check where real Mail has a pop-up, and it does not change a file that was never read ahead. **Why partial, a true limit:** looked at again and nothing more is a page's to do: Enable this account is dimmed since each person has one account, always on (Take All Accounts Offline is what a page can do of it, and exists); Mail Drop is dimmed since no iCloud exists to send a file past 10 MB through; Add Account stays dimmed, since outside mail needs a provider account only the owner can set up; and so there are no Mailbox Behaviors or Server Settings tabs. |
| Junk Mail | built-unchecked | A filter that learns: word counts over Junk against the person's other mailboxes (`mail-junk.ts`). It files new mail once it has seen 3 junk messages and is 90% sure, and each message moved in or out of Junk teaches it. Exempt senders in Contacts and senders written to before act. Trust junk mail headers stays dimmed with the reason: mail here comes only from this desktop's accounts. Blocked senders with Remove and their move to the Trash as before. `mail-batch-three.test`, `mail-notes-batch3-journey`, read from the server. |
| Fonts & Colors | built-unchecked | Message font and size act on a New Message and on a message shown, across a reload; it is the reader's choice and is not sent with the message. Fixed-width acts on a message with no styled text. Message list font and size (9 to 13, which the rows have room for) and Color quoted text, which acts on quote levels in styled text, are new; unit test of the font's style, the CSS not driven. A reply's automatic quote is not a quote level, so it stays uncoloured. `mail-settings-journey`. |
| Viewing | done | [The list with To/Cc, photos and addresses](#project-artifact/art_0ec4ebf78af349f9/40). Most-recent-at-top, To/Cc label, contact photos (a monogram, off by default so that the list matches the reference) and Smart Addresses act. Load remote content is dimmed and says why: nothing here loads from outside. `mail-settings-journey`. Absent: List Preview lines, Bold addresses. |
| Composing | built-unchecked | [The pane](#project-artifact/art_0ec4ebf78af349f9/41). Check spelling, Cc myself and Quote the original act; groups are dimmed and say why. A forward always quotes. Message format is new: Plain Text starts each new message plain. Send new messages from is dimmed with the reason: one account. The new rows are not driven. `mail-settings-journey`. |
| Signatures | done | [The pane](#project-artifact/art_0ec4ebf78af349f9/28). Make, name, edit and remove; Choose Signature with None, each, At Random and In Sequential Order, and Place above quoted text, all kept with the person's settings. Plain text, set in the message's own font, so Always match my default message font is checked and dimmed, with the reason. `mail-signatures-journey`; At Random and In Sequential Order have unit tests only. One list, as this desktop has one account. |
| Rules | done | [The pane](#project-artifact/art_0ec4ebf78af349f9/32) and [a rule's sheet](#project-artifact/art_0ec4ebf78af349f9/33). Add, Edit, Duplicate, Remove and each rule's On checkbox, kept with the person's settings. Conditions as a Smart Mailbox's; actions move, flag, mark as read, delete. Each message the server delivers to the Inbox runs them once, in the browser, however many arrive, and mail arriving while no browser is open runs at the next open: the server keeps a mark on the message until then (`rules_pending`, ended by the same request as the rules' change), so a reload or a second browser repeats nothing. Mail from before this mark never runs by itself. Conditions on the text read a message's first 4,000 characters. After a save it asks whether to run on the mailbox, which means what the mailbox holds, not what a search lists: `mail-rules-journey` drove both answers under a search. The list holds what fits a person's 4,096-byte setting, about 15 rules; past that a rule is refused with a note rather than lost. |
| Settings survive a reload | done | Kept with the person's settings. [After a reload](#project-artifact/art_193e88d1bee786c4/29), `mail-view-journey`. |

## Windows and views

### Windows

| Item | Status | Note |
| --- | --- | --- |
| Viewer | built-unchecked | Three panes. |
| New Message | built-unchecked | A desktop window of its own. One at a time on the served desktop. |
| Message window from a double click | done | [A window of its own](#project-artifact/art_193e88d1bee786c4/30) with Delete, Reply, Reply All and Forward; `mail-message-window-journey`. One window per message. While it is the window last used, File, Edit and Message act on its own message, and its other commands (Mark, Flag, Move) are absent from those menus. The windows do not return after a reload. |
| Classic layout | built-unchecked | [The list above the message](#project-artifact/art_0ec4ebf78af349f9/65), by Preferences > Viewing > Use classic layout, kept on the server, its divider dragged. Its list has a line a message in the columns From, Subject and Date Received, each head sorting and turning the order; kept across a reload. Column widths are fixed. `mail-batch-three.test`, `mail-notes-batch3-journey`, `mail-favorites-journey`. |

### Sidebar

| Item | Status | Note |
| --- | --- | --- |
| Inbox | built-unchecked | Unread badge. |
| Drafts | built-unchecked | Count badge. |
| Sent | built-unchecked | |
| Junk | built-unchecked | Listed only while it holds a message. |
| Trash | built-unchecked | Listed only while it holds a message. |
| Archive | built-unchecked | Listed only while it holds a message. |
| Smart Mailboxes section | done | [Lists the person's own, with an unread count](#project-artifact/art_0ec4ebf78af349f9/1). `mail-smart-journey`. |
| Custom mailboxes (On My Mac) | done | [Trips under On My Mac](#project-artifact/art_193e88d1bee786c4/21). `mail-mailboxes-journey`. |
| VIPs | done | [One row per person](#project-artifact/art_0ec4ebf78af349f9/2), holding their mail from every mailbox but the Trash, Junk and Drafts. `mail-vips-journey`. |
| Flagged mailboxes | done | [A row per colour under Flagged](#project-artifact/art_0ec4ebf78af349f9/64), once more than one colour is in use, each listing its own colour. `mail-favorites-journey`. |

### Favorites bar

| Item | Status | Note |
| --- | --- | --- |
| Mailboxes button | built-unchecked | |
| Inbox, Sent and Drafts scopes | built-unchecked | |
| Adding other mailboxes as favorites | done | [A mailbox on the bar](#project-artifact/art_0ec4ebf78af349f9/63), by a mailbox's menu or by dragging it there; in that order Go To and ⌘1 to ⌘9 follow it; kept on the server. `mail-favorites-journey`. |

### Message list

| Item | Status | Note |
| --- | --- | --- |
| Rows: sender, date, subject, preview, unread dot, mute mark, flag dot | built-unchecked | Single selection. |
| Load More for older pages | built-unchecked | First two pages (1,000 messages). |

### Message pane

| Item | Status | Note |
| --- | --- | --- |
| Header: sender, time, subject, monogram | built-unchecked | |
| Styled text rebuilt from what formatting writes | built-unchecked | |
| Web addresses open in Safari | built-unchecked | `linkTextNodes`. |
| Details and Hide | built-unchecked | Shows To, Cc, Bcc and Reply-To, each person a token as the pointer comes over them, with a contextual menu: New Email and Copy Address. Unit test. Absent: a Mac's chevron on the token; the menu opens by Control-click or right click. |
| Hover bar (Delete, Archive, Reply, Reply All, Forward) | done | [Over the message the pointer is on](#project-artifact/art_0ec4ebf78af349f9/55), each message of a stack its own; Reply driven. For the pointer only: the toolbar has the same commands for the keyboard and assistive technology. `mail-files-journey`. |
| Attachment strip | done | [Picture shown, files with Save to Downloads and Download](#project-artifact/art_193e88d1bee786c4/24). A plain list, not Mail's icons. `mail-attachments-journey` reads the bytes back. |
| Unsubscribe banner | missing | Nothing can show it: it reads a mailing list's headers, and messages here are sent only between this desktop's accounts, with no such header kept. It waits on outside mail. |
| Share on an attachment | built-unchecked | The attachment's Share button: Mail, Messages, AirDrop (dimmed), Notes and Add to Photos, handing over the attachment's bytes. `mail-notes-batch4-journey` reads the picture from the Photos library. |

### Viewer toolbar

| Item | Status | Note |
| --- | --- | --- |
| Get Mail | built-unchecked | Also moves to the Inbox, which real Mail does not do. |
| New Message | built-unchecked | |
| Archive | built-unchecked | Dimmed on a draft, with a reason. |
| Delete | built-unchecked | |
| Junk | built-unchecked | |
| Reply | built-unchecked | |
| Reply All | built-unchecked | |
| Forward | built-unchecked | |
| Flag split button | built-unchecked | |
| Mute | built-unchecked | Pressed when all selected are muted; acts on their whole threads. |
| Move to… | built-unchecked | |
| Search field | built-unchecked | Sender, subject and text, as tokens or words. Search matches a message's first 4,000 characters until it is opened. |
| Search scope bar and tokens (All, Mailbox, From:, Subject:, Save) | done | All or the mailbox shown; `from:` and `subject:` as typed, or from the field's suggestions; Backspace takes one off; Save makes a Smart Mailbox that lists what the search looked through, Junk and Drafts included when it did; it is dimmed with a reason while the scope is a Smart Mailbox. [Tokens and scope](#project-artifact/art_0ec4ebf78af349f9/35) and [Save](#project-artifact/art_0ec4ebf78af349f9/36); `mail-search-journey`. A long token leaves a second one little room in the field. |

### New Message toolbar

| Item | Status | Note |
| --- | --- | --- |
| Send | built-unchecked | |
| Show Format Bar | built-unchecked | |
| Header Fields | done | Cc, Bcc, Reply-To and Priority. [Same screenshot](#project-artifact/art_0ec4ebf78af349f9/3). Absent: Customize. |
| Emoji | built-unchecked | Five characters, and on a desktop Show Emoji & Symbols, which opens the desktop's character viewer on the message. Not driven. |
| Include Original Message | built-unchecked | On a reply just started, takes the quote out or puts it in, and follows the text when the quote is deleted by hand; a unit test drives it, no journey yet. Dimmed with a reason on a new message, a forward and a saved draft. |
| Attach | done | The map was stale: it opens the panel of [Attach Files](#project-artifact/art_193e88d1bee786c4/23), `mail-attachments-journey`. Dimmed with a reason only where nothing keeps files. |
| Markup | built-unchecked | The toolbar's Markup, and Markup on a picture attached here: a sheet with Select, Sketch, Rectangle, Oval, Line, Arrow and Text in three inks, and Preview's signatures, drawn by Preview's markup code, and Undo of each change. Select chooses a mark, to move it, resize it by its handles or delete it with Delete. Done replaces the file with a PNG holding the marks, and that is what is sent (`mail-notes-batch7-journey` reads the pixels of the recipient's copy; `preview-photos-batch9-journey` moves, resizes and signs; `mail-attachments.test`). Dimmed with the reason until the message holds a picture; Signature dimmed with the reason while Preview keeps none. A picture of a reopened draft is read from the server when Markup asks, through the draft as it is after its last save; what Martin receives holds the mark over it, after a reload (`mail-tabs-prefs-journey` reads his pixels; `mail-tabs.test`). Its screenshot is not published yet. |
| Photo Browser | built-unchecked | Pull-down of the newest 24 pictures of the person's Photos library, not movies, hidden or deleted ones; choosing one attaches it. A unit test of the list and of the file it gives; not driven. Absent: a Mac's panel of thumbnails. Dimmed with a reason where nothing keeps files. |

### New Message fields

| Item | Status | Note |
| --- | --- | --- |
| To tokens | built-unchecked | |
| Cc tokens | built-unchecked | |
| Completions from Contacts | built-unchecked | `/api/contacts/people`. |
| Subject | built-unchecked | |
| Rich text message | built-unchecked | |
| Fonts panel | built-unchecked | |
| Colors panel | built-unchecked | |
| Send of unknown outcome held, with Edit Anyway | built-unchecked | |
| Token menu | built-unchecked | Copy Address, Edit Address, Add to Contacts (for someone with an account, opens their card), Move to the other field, Remove. Copy and Edit driven by the batch's journey; Add to Contacts by a unit test. |
| Format bar | built-unchecked | Font, size, colour, styles, alignment, and now bulleted and numbered lists and indentation, each a momentary segment. The list driven by the batch's journey; screenshot not published yet. No capture shows this bar. |
| From account row | built-unchecked | Not shown, which is right: a Mac with one account shows To, Cc and Subject alone, as the reference screenshot of a New Message does, and this desktop gives each person one. Preferences > Composing > Send new messages from says the same, dimmed. |
| Signature | done | [A pop-up under Subject](#project-artifact/art_0ec4ebf78af349f9/30) inserts, swaps and takes off the lines it placed, known by a mark that stays in a saved draft, and nothing else. A draft whose signature has since changed in Preferences, or gone from it, shows As Written and keeps those words until another is chosen. A signature the person edits in the message becomes their own text: the pop-up then says None and leaves it. Swapping is not one Undo step. `mail-signatures-journey` reads what the recipient got. |
| Stationery | built-unchecked | A pop-up under Subject, once any is kept: what was kept goes before what the message holds, and its subject fills an empty Subject. Unit test. Absent: Apple's stationery designs, which are its own artwork, and removing one kept, other than replacing it by saving under its name. |

## Context menus

| Item | Status | Note |
| --- | --- | --- |
| Message row | done | [Contextual menu](#project-artifact/art_193e88d1bee786c4/4): Reply, Mark, Archive, Move to, Flag, Mute, Delete. |
| Mailbox row | done | Open, Get New Mail, Mark All as Read, Erase; checked in the journey. |
| Message text (Copy, Look Up, link commands) | built-unchecked | In the viewer and a message's own window: Look Up on the selection, Copy, Select All, Open Link and Copy Link over a link, Start and Stop Speaking. Look Up's name, Copy and Copy Link driven by the batch's journey; screenshot not published yet. Without a selection Look Up is dimmed: a right click here does not select a word, as a Mac's does. |
| Favorites bar item | done | [Open, Remove from Favorites Bar, Hide Favorites Bar](#project-artifact/art_0ec4ebf78af349f9/63). `mail-favorites-journey`. |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| ⌘, Preferences | built-unchecked | |
| Delete and Backspace in the list | built-unchecked | |
| Arrow keys and type-select in the lists | built-unchecked | |
| Format menu keys | built-unchecked | |
| Return on a row | built-unchecked | Opens the message, or a draft. |
| The menu items' keys above (⌘N, ⌘R, ⇧⌘R, ⇧⌘F, ⇧⌘D, ⇧⌘N, ⌘1 and on) | built-unchecked | All bound; those the journey pressed are done in their rows. |
| Space to page through a message | built-unchecked | Space and Shift-Space, from the list or anywhere outside a control; at the end Space goes on to the next message. `mail-files-journey`. |

## Drag and drop

Mail's messages and mailboxes drag with the browser's own drag; tokens and files with the shared drag between apps.

| Item | Status | Note |
| --- | --- | --- |
| Messages onto a mailbox | done | [One or several, ringed while over it](#project-artifact/art_193e88d1bee786c4/2). |
| Mailbox onto the Favorites bar | done | [Dragged from the sidebar, landing before the button dropped on](#project-artifact/art_0ec4ebf78af349f9/63); a button dragged on the bar moves. Dragging one off the bar does nothing: use its menu. `mail-favorites-journey`. |
| Reordering mailboxes | built-unchecked | On My Mac's rows: one dragged onto another lands before it, kept with the view. Driven in Chromium by the same journey, across a reload; screenshot not published. Drafts, Sent and the like keep their places. |
| Message to Finder as a file | built-unchecked | Each message goes as an `.eml` with its whole text and stays in its mailbox. Real mouse drag onto a Finder window: `mail-batch-drags-journey` passes all 4 steps in Chromium, Firefox 157 and Playwright's WebKit 27.2 on Linux, the file listed there, and a message let go past the browser's window lands nowhere. The drag is followed from the document, its last `dragover` giving the place and a `drop` ending it, since Firefox's `dragend` reports 0, 0 and WebKit's `dropEffect` stays what was allowed. Screenshot not published. Limit: a drag cancelled with Esc over Finder or the desktop lands as if let go, since no browser tells a page it was Esc, as before this change in Chromium. A real Safari and a release onto another application were not run. |
| File from Finder into New Message | done | Same screenshot as Attach Files; real mouse drag in `mail-attachments-journey`. Finder's Share > Mail opens a New Message holding the file, same journey. |
| Picture from Photos into New Message | built-unchecked | The map was stale: Photos starts the shared drag with the picture's drive file (`photos-desktop.tsx`) and a New Message takes any such file (`useDesktopDrop` in `mail-compose.tsx`). Read, not driven. |
| Token between To and Cc | built-unchecked | And Bcc: the field let go over takes it, and the one it left gives it up; Option keeps it in both. Real mouse drag To to Cc in Chromium; screenshot not published. |
| Contact from Contacts into To | built-unchecked | Stale row: Contacts has started the drag since `contacts-drag.ts`. The fields take a drag whose item has type `application/x-macalicious-address` and the address as its name; a real mouse drag of a card puts its address in To, read in the field. `contacts-calendar-batch3-journey`, `pim-batch5-journey`. |

## Multi-selection

`ListView` has `selectionMode="multiple"` and now `rowDraggable`, with ⌘-click, Shift and ⌘A. Mail uses both.

| Item | Status | Note |
| --- | --- | --- |
| Selecting several messages | done | [Command-click and Shift](#project-artifact/art_193e88d1bee786c4/1); the pane says how many and reads none. |
| Actions on all selected messages | done | Move, flag, read, delete, junk, archive, mute act on all; flag and read checked on the server. |
| Select All in the list | done | [Item and key](#project-artifact/art_0ec4ebf78af349f9/85). `mail-rows-journey`. |

## Saved state

| Item | Status | Note |
| --- | --- | --- |
| Messages, read, flag, mute, moves, Trash | built-unchecked | On the server (`/api/mail`). |
| Draft kept when New Message closes | built-unchecked | Close button and ⌘W. Idempotency key on the save. |
| Open draft when the viewer closes or Mail quits | done | **Ledger item.** `mail-drafts-journey` closes the viewer and quits Mail with the window open; the last words are in Drafts. [After a reload](#project-artifact/art_193e88d1bee786c4/5). |
| Open draft while typing, across a reload | built-unchecked | Saved about three seconds after the last change and when the page goes away. A message too large for a request that outlives the page is kept in localStorage as the page goes and saved on the next start, so the browser no longer asks before leaving. `mail-rows-batch11-journey` reloads at once and reads the last words from the server. A browser refusing the localStorage write loses those last seconds. |
| Preferences | built-unchecked | Kept with the person's settings. `mail-view-journey` shows a Search setting after a reload; the other settings go through the same record. |
| Selected mailbox, sort, filter, pane sizes | done | Kept with the person's settings, so they follow to another browser. [After a reload](#project-artifact/art_193e88d1bee786c4/29), `mail-view-journey`, read from the server. A divider's position saves half a second after the drag, or as the window closes. |

## Server and ledger

| Item | Status | Note |
| --- | --- | --- |
| Send and draft idempotency | built-unchecked | Ledger: done, `6e83ba16` and `8903dc1b`. |
| Ambiguous send, sent again after its window closed | built-unchecked | **Older finding, held on main; fixed.** [The window that could not tell](#project-artifact/art_193e88d1bee786c4/33). `mail-lost-answer-journey`: the server delivers, the answer is lost, the page reloads, the draft is sent again, and Martin has one copy. The key stays in the browser until the server answers, and the server treats a resend from a later draft as the same message. Edit Anyway lets the key go and says it may arrive twice. A message edited before it is sent again is a new message. Two tabs pressing Send on the same recovered message in the same moment now share one key: IndexedDB's read-write transaction takes the read and the write of the key as one, across tabs. `mail-send-keys.browser.test` runs 25 rounds of two real tabs asking at once, and the old `localStorage` code failed that test (each tab made its own key) before this change; `mail-notes-batch7-journey` reads the one key on both tabs' requests, one copy at Martin's and no key left afterwards. When the second tab's request comes while the first is under way, the server may answer 503: that window says it cannot tell, and sent again it is the same message. A tab that presses Send after the other's answer has come is a new send, as a key gone means a message answered. |
| Erased message's text when the first delete fails | built-unchecked | **Older finding, already fixed on main.** The tombstone stays unfinished and the next listing deletes the text. `tests/mail.rs`, `an_unfinished_erasure_is_finished_by_the_next_listing`. |
| Unfinished send replaying a Sent copy already erased | built-unchecked | **Older finding, half held; fixed.** The tombstone already kept the copy erased. The answer still returned a header for it; it now says the message was erased. `tests/mail.rs`. |
| `DELETE /api/mail/trash` | built-unchecked | **Ledger item, closed by removing it.** It took no ids, so a retry could erase newer mail, and no page called it: Erase Deleted Items erases by id. The route answers 404, read in `pim-batch5-journey`. |
| Failed erase reply | built-unchecked | **Ledger item.** The list says so, and the message comes back on the next read. |
| Search over long messages | built-unchecked | A word past the 4,000 characters a header holds is found by `GET /api/mail/search`, which reads the whole text of the long messages only; a hit in mail not yet listed makes the list read on until it holds it. `mail-notes-batch3-journey`. |
| Attachments on the server | partial | Uploaded in pieces, up to 10 MB each and 10 a message; read only through a message in the reader's own mailbox; abandoned uploads are cleared. Erasing the last message that names a sent file, or taking the file off it, frees its bytes: every delivery, resend, copy and draft is noted across accounts before it is stored (`mail/copies.rs`), a stop part way is finished by the next listing, and a copy a stopped send has yet to deliver holds the bytes for two days, longer than any resend. `tests/mail.rs`, reading the store and the blobs back. Limits: a file never sent stays when its draft is erased or drops it (a window may still send it; freeing it needs a change in `attachments.rs`), a file sent before the count existed is never freed, a double store failure can leave one unnamed piece, and two sessions sending the same file in the same moment make the loser attach it anew. |
| Outside email | missing | Needs a provider key only the owner holds. Stays refused by name, as main does. |

## Cross-app

| Item | Status | Note |
| --- | --- | --- |
| Share > Mail from Safari, News and Stocks | built-unchecked | `mail-share-journey`. |
| Address completion from Contacts | built-unchecked | |
| Arrival notification | built-unchecked | |
| Spotlight finds mail | done | Newest 200 messages, not Trash or Junk. Choosing one shows its mailbox with it selected: `spotlight-items-journey`, [screenshot](#project-artifact/art_193e88d1bee786c4/36). |
| Links open in Safari | built-unchecked | |
| Copy between apps | built-unchecked | Text, from New Message's Edit menu and from the viewer's, through the browser's clipboard, which every app of the desktop shares. |
| Contacts' mail button opens New Message | done | Contacts' row: `contacts-reach-journey`. |
| `mailto:` links | built-unchecked | Mail addresses in a message's text, plain or styled, are links to a New Message; driven in Chromium by the same journey. Its contextual menu has New Message and Copy Address. Another app's `mailto:` link opens a New Message too (`desktop-open-url.test.ts`). |
| Finder Share > Mail | done | The map was stale: Finder's Share > Mail opens a New Message holding the file, `mail-attachments-journey`; [same screenshot as Attach Files](#project-artifact/art_193e88d1bee786c4/23). |
| Dock unread badge | built-unchecked | The tile counts the Inbox's unread messages, or All Mailboxes' as Preferences' Dock unread count says, and the row is no longer dimmed. `e2e/desktop-batch3-journey.mjs`. |
| Dock icon menu (Get New Mail, New Message) | built-unchecked | While Mail's window is open. `mail-files-journey`. |
| Share from a message | built-unchecked | File > Share and the message row's menu: Copy, Notes (a new note of the whole message), Messages (a text file of it), Reminders and the Reading List (its first web address, dimmed with the reason without one), AirDrop dimmed with the reason. `mail-batch-three.test`; Notes driven in `mail-notes-batch3-journey`, read from the server. |
| Data detectors (add a date to Calendar, a person to Contacts) | built-unchecked | A date in a message's text, plain or styled, opens Calendar's Quick Event holding it; addresses are `mailto:` links; a person of this desktop in Details has Add to Contacts. `mail-batch-three.test`; the date driven in `mail-notes-batch3-journey`. |
| Siri sends mail | built-unchecked | “Email Martin about the ferry” shows a draft card; Send sends it through the server, Cancel sends nothing, and a refusal keeps the message. `e2e/desktop-batch3-journey.mjs`. |

## Calls made

- **Attachments are back.** Main had cut them; the server module and upload code come from an earlier version. The owner's later direction names drag from Finder into Mail. A Guest User uploads none, since nobody can read a guest's files and a guest's allowance ends with it.
- **Deleting from the Trash stays without an alert.** The ledger leaves this to decide. Catalina asks only for Erase Deleted Items, so that command gets the alert.
- **Outside mail and Add Account stay unavailable**, shown as such, per the brief.
- **Rules run in the browser, not on the server.** The settings hold them and a Smart Mailbox's conditions decide them, as the brief asks. The server only keeps the per-message mark and takes the change once.
- **A reply's Sent copy counts in its conversation but is not acted on with it.** Delete on a thread takes what the mailbox lists, so a person's Sent copy never goes by surprise. Mute takes it all.

## Build items, most-used first

Each lands as small reviewed commits. Each row changes to done only with a browser screenshot.

1. **Message and Mailbox commands.** Register the Message menu (Reply, Reply All, Forward, Send, Mark, Archive, Move to, Flag, Mute, Delete), plus File > New Message, Mailbox > Get All New Mail and Go To, and View > Mailbox List, with every key. Add Mark as Unread.
2. **Multi-selection.** `selectionMode="multiple"` on the list, with the toolbar and menu acting on all selected messages. Depends on the server's per-message routes only.
3. **Context menus.** Message row, mailbox row, message text, Favorites bar.
4. **Drafts survive.** Save an open draft when the viewer closes or Mail quits, save while typing, ⌘S. This is the ledger's first front-end item.
5. **Erasing.** Erase Deleted Items with its alert, Erase Junk Mail, handle a failed erase reply, bound or remove `DELETE /api/mail/trash` (removed).
6. **Mailboxes and dragging.** Server support for mailboxes of the person's own; New, Rename and Delete Mailbox; drag messages onto mailboxes; favorites.
7. **Attachments.** Server storage, Attach Files, drag from Finder and Photos, the strip, Save and Quick Look, Photo Browser, Markup. Waits on the integration worker's drag. Start from the export.
8. **Message window and second viewer.** Double click and Return open a message; ⌘O, ⌥⌘N.
9. **Conversations.** Threading, Organize by Conversation, mute by thread.
10. **Search and sorting.** Scope bar and tokens, the whole Sort By menu, the whole Filter menu, ⌥⌘F, ⌘L.
11. **Smart mailboxes.** New, Edit and Duplicate; VIPs and Flagged; fills the empty sidebar section.
12. **New Message depth.** Bcc, Reply-To and Priority fields; Include Original; lists, indentation, quote level, Make Plain Text; emoji palette; Copy and Paste Style.
13. **Preferences that act and persist.** Store the settings; Viewing, Composing, Signatures, Fonts & Colors, Rules, Junk Mail.
14. **Print and export.** Print, Export as PDF, Export and Import Mailbox, All Headers, Raw Source.
15. **Cross-app.** Contacts' mail button, `mailto:`, Dock badge and menu, Add Sender to Contacts, share from a message, data detectors, Finder Share > Mail.
16. **Remaining Edit and Window items.** Find, Spelling, Substitutions, Transformations, Speech, Message Viewer ⌘0, Activity, Previous Recipients, Customize Toolbar, Connection Doctor. Items a browser cannot do are shown dimmed with a reason.

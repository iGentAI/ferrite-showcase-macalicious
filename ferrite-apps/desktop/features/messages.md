# Feature inventory: Messages

Read from GitHub, main commit `e62c2ac9`. Nothing was built or run for this inventory, and the shared tree was not read.

**Status.** `missing`: main has nothing for it. `partial`: main has some of it, and the note says what is absent. `built-unchecked`: main's code has it, and nobody has checked it in a browser for this inventory. No row says done. A row becomes done only with a screenshot of it working in the running app.

**Source of the real app's list.** The menu items and shortcuts are written from knowledge of Messages on macOS 10.15. They were not checked on a Mac, or against the reference screenshots, because the tree is stale. Fix a wrong row when it is found.

**Files read.** `demos/messages/`: `app.ts`, `messages-live.tsx`, `messages.mdx`, and `messages.tsx` and `messages-accounts.tsx` for their menus, keys and details. `demos/desktop/`: `desktop-menus.tsx`, `desktop.tsx`. Also the desktop README and the open work ledger.

**How the menu bar works.** `app.ts` names seven menus. Messages registers its own File, Edit, View and Buddies items (`messages-menus.tsx`); the rest are the desktop's.

## Counts

| Section | Rows | done | built-unchecked | partial | missing |
| --- | --- | --- | --- | --- | --- |
| Messages menu | 7 | 0 | 7 | 0 | 0 |
| File menu | 8 | 3 | 5 | 0 | 0 |
| Edit menu | 16 | 7 | 9 | 0 | 0 |
| View menu | 6 | 4 | 2 | 0 | 0 |
| Buddies menu | 10 | 4 | 6 | 0 | 0 |
| Window menu | 6 | 0 | 6 | 0 | 0 |
| Help menu | 2 | 0 | 2 | 0 | 0 |
| Preferences window | 4 | 1 | 3 | 0 | 0 |
| Windows | 2 | 1 | 1 | 0 | 0 |
| Conversation list | 8 | 2 | 6 | 0 | 0 |
| New conversation | 5 | 0 | 5 | 0 | 0 |
| Transcript | 13 | 1 | 12 | 0 | 0 |
| Message field | 6 | 2 | 4 | 0 | 0 |
| Details popover | 9 | 4 | 5 | 0 | 0 |
| Context menus | 3 | 1 | 2 | 0 | 0 |
| Keyboard | 7 | 1 | 6 | 0 | 0 |
| Drag and drop | 6 | 1 | 5 | 0 | 0 |
| Multi-selection | 2 | 1 | 1 | 0 | 0 |
| Saved state | 6 | 2 | 4 | 0 | 0 |
| Ledger | 5 | 2 | 3 | 0 | 0 |
| Cross-app | 11 | 1 | 10 | 0 | 0 |
| **Total** | **142** | **38** | **104** | **0** | **0** |

## Menus

### Messages menu

| Item | Status | Note |
| --- | --- | --- |
| About Messages | built-unchecked | Desktop's item. |
| Preferences… ⌘, | built-unchecked | Hosted as a window of the desktop. |
| Hide Messages ⌘H | built-unchecked | |
| Hide Others ⌥⌘H | built-unchecked | |
| Show All | built-unchecked | |
| Services | built-unchecked | The desktop's submenu (`desktop-services.tsx`): with text selected, the services that apply; with none, dimmed "No Services Apply", as on a Mac. Read from the code. |
| Quit Messages ⌘Q | built-unchecked | Quits. What is on its way goes out when Messages next opens, to an account or to the shared room (see Saved state). |

### File menu

| Item | Status | Note |
| --- | --- | --- |
| Close Window ⌘W | built-unchecked | |
| New Message ⌘N | done | [Screenshot of the run](#project-artifact/art_193e88d1bee786c4/8), item checked in `messages-menus-journey`. A browser may keep Ctrl-N for itself. |
| Open ⌘O | built-unchecked | The drive's Open panel; what is chosen opens in the application that opens it, or shows in Finder, so a saved transcript opens in TextEdit. Panel driven with ⌃O and cancelled in a scratch journey; opening a file not driven. Dimmed with its reason on a page with no drive. |
| Delete Conversation… | done | [Alert](#project-artifact/art_193e88d1bee786c4/18), `messages-delete-journey`. For this account alone: the others keep it, and something new brings it back with only that. Not offered for the shared room. With several rows selected it reads Delete 2 Conversations… (`messages-several-journey`). |
| Send File… and Attach ⌥⌘F | done | [The Open panel](#project-artifact/art_193e88d1bee786c4/49): the menu item, its key and the field's Attach button open the drive's Open panel, with From This Computer; `messages-send-file-menu-journey`, `messages-attachments-journey`. |
| Save Transcript | built-unchecked | Downloads a text file of who said what, with the messages the window has loaded. `messages-transcript-journey`. Absent: the panel choosing where, and pictures. |
| Print… ⌘P | built-unchecked | The same transcript through the browser's print dialog; the page it is given is checked in the journey, the dialog is not. |
| Export as PDF | built-unchecked | The same page; the browser's dialog saves the PDF. |

### Edit menu

Each works on the message field, or Copy on the transcript's selected text. The keys are the browser's own in a field. 

| Item | Status | Note |
| --- | --- | --- |
| Undo ⌘Z | done | Item checked in `messages-menus-journey`. |
| Redo ⇧⌘Z | built-unchecked | Item. |
| Cut ⌘X | done | Item checked in the journey. |
| Copy ⌘C | built-unchecked | Item. |
| Paste ⌘V | done | Item checked in the journey. The browser asks before a page reads the clipboard; refused, nothing is pasted. |
| Select All ⌘A | done | Item checked in the journey. |
| Find ⌘F | done | Key checked in the journey. |
| Emoji & Symbols ⌃⌘Space | done | [The palette](#project-artifact/art_0ec4ebf78af349f9/24). The desktop's Characters palette, whose chosen character lands in the field; its emoji button opens it too. `messages-field-block-journey` passes. The palette holds about 70 characters, not the full set. |
| Paste and Match Style | built-unchecked | The field holds plain text, so it pastes as Paste does. `apps-dock-journey`. |
| Delete | built-unchecked | The selection in the field. `apps-dock-journey`. |
| Clear Chat Transcript ⌥⌘K | done | [Its alert](#project-artifact/art_0ec4ebf78af349f9/13). With its alert. For this account alone, on the server: the conversation stays listed, empty, and the others keep everything. Not offered for the shared room. `messages-clear-journey` passes, reload included. |
| Find Next ⌘G | built-unchecked | And Find Previous ⇧⌘G: the next conversation the search lists. Absent: moving through matches inside a transcript. `apps-dock-journey`. |
| Spelling and Grammar | built-unchecked | The editors' submenu on the message field: the panel, Check Document Now, Check Spelling While Typing (kept with the person's settings), and Check Grammar With Spelling, shared with TextEdit. Automatic correction is dimmed with its reason. Panel opened in a scratch journey; `messages-rows.test.tsx` finds an unknown word. |
| Substitutions | built-unchecked | The editors' submenu and panel, kept with the person's settings; Smart Quotes checked in a scratch journey (`it's` becomes `it’s`). Data Detectors' row is dimmed with its reason here too, though the transcript has its own (see Transcript). |
| Speech | built-unchecked | Start and Stop Speaking, with the browser's voice; dimmed where it has none. Row seen in a scratch journey; no speech was heard. |
| Start Dictation | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer. |

### View menu

| Item | Status | Note |
| --- | --- | --- |
| Enter Full Screen ⌃⌘F | built-unchecked | |
| Make Text Bigger ⌘+ | done | Key checked in the journey, with ⌘=. |
| Make Text Smaller ⌘- | done | Item checked in the journey. |
| Make Text Normal Size ⌘0 | done | Key checked in the journey. |
| All Messages and Unknown Senders | built-unchecked | Unknown: nobody else in it is on one of the person's Contacts cards. Kept with the person's settings. `messages-several-journey` passes. |
| Show or Hide the list | done | [Hidden](#project-artifact/art_0ec4ebf78af349f9/25). Hide and Show Conversation List; the window controls move over the transcript, ⌘F brings the list back, a width dragged by hand is not kept. Kept with the person's settings, across a reload. `messages-several-journey` passes. |

### Buddies menu

| Item | Status | Note |
| --- | --- | --- |
| Show Info ⌘I | done | [Screenshot](#project-artifact/art_193e88d1bee786c4/8), key checked in the journey. |
| Next Conversation ⌃⇥ | built-unchecked | Item checked in the journey. A browser keeps Ctrl-Tab from a web page, so it has no key and shows none. |
| Previous Conversation ⌃⇧⇥ | built-unchecked | Item checked in the journey. No key, as above. |
| Go to Conversation ⌘1 to ⌘9 | done | Keys checked in the journey; the conversations are listed in this menu. |
| Start FaceTime Video | done | [Calling the person](#project-artifact/art_193e88d1bee786c4/34). Opens FaceTime and calls the one other person; dimmed for a group or the shared room. `messages-transcript-journey`. |
| Start FaceTime Audio | built-unchecked | The same, as an audio call; only the Video item was driven. |
| Invite to Share My Screen | built-unchecked | Dimmed with its reason: it lets someone control this computer, which a web page cannot allow. Checked in a scratch journey. |
| Ask to Share Screen | built-unchecked | Dimmed with its reason: a web page cannot see or control another person's computer. |
| Add to Contacts | built-unchecked | Opens Contacts on a card naming the one other person's account, or the one already there. `messages-send-file-menu-journey`. |
| Block Person | done | [Blocked](#project-artifact/art_0ec4ebf78af349f9/11). Block Person… with its alert, then Unblock Person, for a conversation of two. A server rule (`blocked.rs`): what they write while blocked never shows to this person, tells them nothing and counts as nothing unread, stays away after an unblock, and they are not told. Rooms are not covered: a room's writers are not accounts. `messages-field-block-journey` passes. Absent: the blocked list in Preferences. Not driven: that no notification comes, which is the server's check in `tell_members` and was read, not run. |

### Window menu

| Item | Status | Note |
| --- | --- | --- |
| Minimize ⌘M | built-unchecked | |
| Zoom | built-unchecked | |
| Bring All to Front | built-unchecked | |
| Open windows list | built-unchecked | |
| Tile Window | built-unchecked | Shared desktop menu, Tile Window to Left and Right of Screen (`desktop-menus.tsx`). |
| Messages ⌘0 | built-unchecked | Item and key: brings the main window forward, or opens it. `apps-window-menu-journey`. |

### Help menu

| Item | Status | Note |
| --- | --- | --- |
| Messages Help | built-unchecked | The desktop's row opens Help Viewer on Messages (`desktop-menus.tsx`). Preferences' Help buttons now do the same: `messages-reasons.test.tsx`. |
| Search field | built-unchecked | The desktop's `HelpMenuSearch`, shown with Help Viewer on the desktop. Read from the code. |

## Preferences window

| Item | Status | Note |
| --- | --- | --- |
| General | built-unchecked | Text size and Play sound effects with Message received sound act (`messages-sounds.test.tsx`: a tone per choice, standing in for Apple's sounds; none was heard). Served, Keep messages, Save history, both Notify rows and Save received files to are dimmed, each with its reason, because the server decides them. |
| iMessage | built-unchecked | Served, it names the person's account in place of the invented Apple ID. Send read receipts acts; iCloud, the addresses and Start from are dimmed with their reasons. `messages-reasons.test.tsx`. |
| Blocked | done | [Listed, added and removed](#project-artifact/art_0ec4ebf78af349f9/49), read from the server in `messages-separate-journey`. Absent: choosing from Contacts; a person is added by account name. |
| Settings survive a reload | built-unchecked | Kept with the person's settings; both windows read and write them. `messages-saved-journey`. |

## Windows and views

### Windows

| Item | Status | Note |
| --- | --- | --- |
| Main window | built-unchecked | |
| A conversation in its own window | done | [That window](#project-artifact/art_0ec4ebf78af349f9/48). The row's Open in Separate Window: that conversation without the list, in a window of its own, kept by the window's id with the person's settings so it comes back after a reload. Double-click does not open one. `messages-separate-journey`. |

### Conversation list

| Item | Status | Note |
| --- | --- | --- |
| Rows: name, time, last message | built-unchecked | |
| Search | built-unchecked | Name and messages held in the window. |
| Unread dot | built-unchecked | |
| Do Not Disturb mark | built-unchecked | |
| Ferrite Room, shared with everyone | built-unchecked | First in the list. |
| Conversations between accounts | built-unchecked | One-to-one and groups. |
| Pictures | done | [A contact's picture, initials, and a group's two together](#project-artifact/art_0ec4ebf78af349f9/68). The picture of the person's contact card that names the account, else initials; a group shows up to three. The shared room keeps its plain disc. `messages-pictures-journey`. |
| Delete button on a row's hover | done | [The button](#project-artifact/art_0ec4ebf78af349f9/26). Takes the time's place while the pointer is over the row, and asks first. `messages-several-journey` passes. |

### New conversation

| Item | Status | Note |
| --- | --- | --- |
| To field | built-unchecked | |
| Contacts offered as typed | built-unchecked | |
| Several people make a group | built-unchecked | |
| First message makes it on the server | built-unchecked | |
| A link shared with Messages starts the message | built-unchecked | |

### Transcript

| Item | Status | Note |
| --- | --- | --- |
| Bubbles, blue and green | built-unchecked | |
| Time headers | built-unchecked | |
| Delivered and Read | built-unchecked | |
| Typing indicator | built-unchecked | |
| Group member's name | built-unchecked | |
| Load Earlier Messages | built-unchecked | |
| Not Delivered and Try Again | built-unchecked | |
| Reply | built-unchecked | From the menu after each message. |
| Web addresses open in Safari | built-unchecked | `linked-text.tsx`. |
| Tapbacks | built-unchecked | A pull-down after each message, a right click, and a double click on the bubble (double click checked in a scratch journey; it no longer selects a word there, so drag to select). Only the newest hundred messages take them: an older one's are dimmed with the reason. |
| Attachments shown inline | done | [A picture and a file in a conversation](#project-artifact/art_193e88d1bee786c4/28): the file's name in the bubble, then the picture, Save to Downloads and Download. Members alone can read them. `messages-attachments-journey`. |
| Data detectors | built-unchecked | [A date's menu](#project-artifact/art_0ec4ebf78af349f9/67): an address offers New Mail Message, a date Create Event (Quick Event opens holding it), each also Copy. New, unit-tested on what is found, the menus not driven: a street address offers Show in Maps, `flight UA 123` Track Flight, a UPS or USPS number Track Shipment. A phone number offers Copy, and Call with FaceTime dimmed with its reason. Other carriers' numbers are plain digits and are not found. `messages-detectors-journey`, `messages-detectors.test.ts`. |
| Message effects | built-unchecked | [Balloons, as the other person sees them](#project-artifact/art_0ec4ebf78af349f9/69). A message's words set off a screen effect once, for both people: Happy Birthday balloons, Congratulations confetti, Happy New Year fireworks, Pew Pew lasers, with stand-in shapes. Not for someone who asks for less motion, and not again after a reload. Catalina's Messages has no way to choose an effect, and nothing on this desktop can send the bubble effects (Slam, Loud, Gentle, Invisible Ink) a phone sends, so none is ever received. `messages-effects-journey`. |

### Message field

| Item | Status | Note |
| --- | --- | --- |
| Text field | built-unchecked | |
| Return sends | built-unchecked | |
| Unsent text kept per conversation | built-unchecked | While the window lives. |
| Emoji button | built-unchecked | Opens the desktop's Characters palette; see Emoji & Symbols. |
| Record audio | done | [A recording played by the other person](#project-artifact/art_0ec4ebf78af349f9/66). A press records, Stop ends it, it can be heard first, Cancel or Send, and it goes as an attachment the other person plays in the transcript. In a conversation between accounts; dimmed with the reason in the shared room. Chromium's fake microphone stood in for a real one. `messages-audio-journey`. |
| Option-Return for a new line | done | [Two lines](#project-artifact/art_0ec4ebf78af349f9/10). The field grows to six lines, then scrolls; the bubble keeps the line break and the server the text. `messages-field-block-journey` passes. |

### Details popover

| Item | Status | Note |
| --- | --- | --- |
| Do Not Disturb | built-unchecked | Kept on the server. |
| Leave a group | built-unchecked | `POST /conversations/<id>/leave`. |
| Rename a group | done | [Group Name in Details](#project-artifact/art_193e88d1bee786c4/45); `messages-details-journey` sees the name in the list, on the other member's page and after a reload. |
| Members | done | Listed in Details, same journey. |
| Add a member | done | [In Details](#project-artifact/art_0ec4ebf78af349f9/9). For a group; a conversation of two has its id from its two people, so the server refuses (`409`). The new member sees what is said from then on. Contacts are offered as typed. `messages-details-more-journey` passes. |
| Send Read Receipts for this conversation | done | [Same screenshot](#project-artifact/art_0ec4ebf78af349f9/9). A checkbox that overrides Preferences' setting, kept with the person's settings; turning it off takes the receipt back on the server. `messages-details-more-journey` passes, reload included. |
| Send My Current Location | built-unchecked | Asks the browser where the person is and sends a Maps link at once; refused, it says so and sends nothing; dimmed with its reason without a position. `messages-location.test.tsx` and `messages-rows.test.tsx`, with a stand-in `navigator.geolocation`; no real position was read. |
| FaceTime buttons | built-unchecked | Video and Audio, for a conversation of two; Video driven to a ring on the server, Audio not pressed. Dimmed with the reason for a group or the shared room, as in Buddies: FaceTime here calls one account. |
| Pictures and files of the conversation | built-unchecked | Read from the server (`GET .../files`), newest first, what this person can see, up to 200 or 40 pages of history back, and says when there are older ones. `messages-details-more-journey` passes. No screenshot of a file listed was published; the row stays unchecked. |

## Context menus

| Item | Status | Note |
| --- | --- | --- |
| Conversation row (Details, Do Not Disturb, Delete) | done | [Row's menu](#project-artifact/art_193e88d1bee786c4/20), `messages-row-menu-journey`. Open in Separate Window is not offered yet. |
| Message bubble (Copy, Tapback, Delete) | built-unchecked | Copy, every tapback, Remove Tapback and Reply on a right click: `messages-bubble-menu-journey`, [screenshot](#project-artifact/art_193e88d1bee786c4/39). Delete…, with its alert, for this person alone on the server: `messages-clear-journey`. |
| Message field (Spelling, Paste) | built-unchecked | Cut, Copy, Paste, Select All, then Spelling and Grammar, Substitutions and Speech. It takes the place of the browser's own menu. Opened and Show Spelling chosen in a scratch journey. |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| ⌘, Preferences | built-unchecked | |
| Return sends | built-unchecked | |
| Return in the list goes to the field | built-unchecked | |
| Arrow keys in the list | built-unchecked | |
| Type-select in the list | built-unchecked | |
| Escape closes Details | built-unchecked | |
| The menu items' keys above (⌘N, ⌘I, ⌘1 to ⌘9, ⌘F, ⌘+, ⌘-, ⌘0, ⌘P) | done | [After ⌘I](#project-artifact/art_193e88d1bee786c4/41), `messages-keys-journey` presses each and reads what it did; of ⌘1 to ⌘9 it presses ⌘1 and ⌘2. ⌃⇥ stays with the browser. |

## Drag and drop

Drive items travel by the desktop's own drag; text, contacts and bookmarks by the browser's.

| Item | Status | Note |
| --- | --- | --- |
| File from Finder into a conversation | done | Mouse drag in `messages-attachments-journey`; a conversation of accounts, not the shared room. |
| Picture from Photos into a conversation | built-unchecked | Photos drags the picture's drive file, and a conversation between accounts takes any such item. Read from the code, not driven. |
| A picture from the transcript to Finder | built-unchecked | An attachment's row in the transcript starts the desktop's drag with its bytes (`ReceivedAttachment`), which Finder takes. Read from the code, not driven. |
| Contact into To | built-unchecked | A card from Contacts carries its name; To finds the contact's account as when offered. `messages-rows.test.tsx` drops the data; the drag between the windows was not driven. |
| Text into the field | built-unchecked | The browser's own drop, with the mouse from a bubble into the field in a scratch journey. |
| Link from Safari into the field | built-unchecked | A bookmark carries an address alone, which goes after what is typed: `messages-rows.test.tsx` drops the data; the drag was not driven. A link with words is the browser's own drop. |

## Multi-selection

| Item | Status | Note |
| --- | --- | --- |
| Several conversations | done | [Two selected](#project-artifact/art_0ec4ebf78af349f9/15). Command-click, Shift and Command-A select rows; Delete, the row's menu and File delete those that can be, after asking once, each for this person alone. The conversation shown stays one. `messages-several-journey` passes. |
| Several messages | built-unchecked | Command-click selects and lets go, a plain click or Escape lets go of all; Delete or the bubble's menu deletes them after asking once, each for this person alone; Copy takes them all. Selecting and deleting two, read back from the server, in a scratch journey. `messages-rows.test.tsx`. |

## Saved state

| Item | Status | Note |
| --- | --- | --- |
| Account conversations | built-unchecked | On the server. |
| Ferrite Room | built-unchecked | Newest 200 messages. |
| Do Not Disturb | built-unchecked | On the server. |
| Outbox across a reload | built-unchecked | [After a reload it arrives once](#project-artifact/art_193e88d1bee786c4/7), `messages-outbox-journey`. Kept in the browser under their keys and sent again when Messages opens, for accounts and now for the shared room: a room message left behind arrived once, read from the server, in a scratch journey; `messages-room-outbox.test.tsx`. Past ten minutes a room message says Not Delivered, with Try Again. |
| Unsent text across a reload | done | [Back in its field](#project-artifact/art_193e88d1bee786c4/32). Kept in this browser under the account, per conversation; `messages-saved-journey`. Text in a conversation that has not been started yet is not kept. |
| Selected conversation | done | [The same screenshot](#project-artifact/art_193e88d1bee786c4/32). Kept with the person's settings, read from the server in `messages-saved-journey`. A conversation deleted since opens on the Ferrite Room. |

## Ledger

| Item | Status | Note |
| --- | --- | --- |
| Read receipts while hidden | done | [Screenshot of the same run](#project-artifact/art_193e88d1bee786c4/7). Nothing is marked read, and no receipt is sent, until the page is in view; `messages-outbox-journey` checks both sides. |
| `messages.mdx` says a conversation cannot be left | done | Corrected: a group can be left; a conversation of two cannot. |
| Index of conversations | built-unchecked | Read from the person's activity index, the most recently active first, clearing stale entries as it goes (`conversations.rs`). The older per-conversation index is copied into it as an account's lists are read. |
| One read of a conversation at a time | built-unchecked | **Older finding, already fixed on main.** `useConversationReads` runs one read per conversation and queues the next, so an older reply cannot overwrite a newer one; what a send acknowledged stays until a read holds it. Read from the code. |
| Group id depending on its title | built-unchecked | **Older finding, no path in the app.** The server's id includes the title, on purpose, but the window starts a group with its recipients alone and renames it through its own route, so a resend always finds the first. Read from the code. |

The ledger's outbox row is in Saved state, and it marks overlapping reads and group ids done (`2d375af2`, `4431bef6`, `01eafc92`).

## Cross-app

| Item | Status | Note |
| --- | --- | --- |
| Share > Messages from Safari, News and Stocks | built-unchecked | `messages-share.test.tsx`. |
| Contacts offered in To | built-unchecked | |
| Notification Center | built-unchecked | |
| Spotlight | built-unchecked | The person's own conversations, the newest 30, each up to its 100 newest messages, leaving out what they deleted or blocked. Return opens a one-to-one conversation; a group's asks Messages through `openItem`, which now shows it. Shared rooms are not searched. `e2e/spotlight-people-journey.mjs` |
| Contacts' message button opens a conversation | built-unchecked | Shows the conversation already open with that person, from a closed Messages and from an open one, and a new message to someone with none. `pim-batch5-journey`, `messages-compose-to.test.tsx`, `contacts-reach-journey`. Screenshot `pim5-message-button`, not published. |
| FaceTime from a conversation | done | Buddies > Start FaceTime Video, [same screenshot](#project-artifact/art_193e88d1bee786c4/34). |
| Dock unread badge | built-unchecked | The Dock's red count (`useDockBadges`): Messages' notifications not yet cleared, which the server sends for what others write, so it counts those and not unread conversations. Read from the code. |
| Dock icon menu | built-unchecked | New Message, while the window is open. `apps-dock-journey`. |
| Finder Share > Messages | built-unchecked | [A new message carrying the file](#project-artifact/art_193e88d1bee786c4/44), listed over the field with Remove, for the person to address; it goes to whoever that message is sent to, read from their server. The files a new message carries are kept in the desktop's settings (`messages.sharedFiles`): after a reload Messages starts a new message carrying them again, and Remove or sending takes them off the server. `e2e/media-batch4-journey.mjs` (`--part messages`) read the setting back over two reloads; `messages-share.test.tsx`. Several new messages' files come back as one new message. Files with no copy on the drive (a Mail attachment) are not kept. Screenshot not yet published |
| Pasting a picture | built-unchecked | ⌘V in the message field, `messages-audio-journey`, and now Edit > Paste and the field's Paste, which read a picture where the browser allows it and text otherwise. `messages-rows.test.tsx` with a stand-in clipboard; the menu's paste of a picture was not driven. |
| Siri sends a message | built-unchecked | "Message Ann saying I'm late" opens a new message to the account on Ann's card, or to the name said, with the text in its field for the person to send. Siri does not send it by itself. `desktop-siri-message.test.ts`. |

## Calls made

- **Attachments are back in scope.** The ledger marks them obsolete: main cut them, and they survive only in an earlier version. The owner's later direction names cross-app drag, so this inventory lists them as missing.
- **Reply stays** though it came to Messages after 10.15. It is built, and removing it helps nobody.
- **The outbox keeps messages.** The ledger offers "keep or say". The bar is that data survives a reload, so the build item keeps them, and says so if it cannot.

## Build items, most-used first

Each lands as small reviewed commits. Each row changes to done only with a browser screenshot.

1. **Outbox across a reload and read receipts while hidden.** The ledger's third front-end item. Keep unsent messages with their idempotency keys in storage and resend them; send no receipt while the page is hidden; fix the stale `mdx` line.
2. **Menus with keys.** File > New Message, Buddies (Show Info, Next and Previous Conversation, ⌘1 to ⌘9), View's text size, working Edit items on the field, ⌘F.
3. **Delete Conversation and Clear Transcript.** Server route and hover button, per person.
4. **Context menus.** Row and bubble, with Tapback on a right click and double click.
5. **Details popover.** Members, Add a member, Rename a group, per-conversation read receipts.
6. **Attachments.** Server storage, inline display, drag and paste, Send File. Waits on the integration worker's drag. Start from the export.
7. **Saved state.** Unsent text, selected conversation, preferences.
8. **Cross-app.** Contacts' message button, FaceTime from a conversation, Dock badge and menu, Finder Share, search of the person's own conversations.
9. **A conversation in its own window, emoji palette, contact pictures, Option-Return.**
10. **Remaining items.** Print, Save Transcript, Block, Unknown Senders, screen sharing, data detectors, Spelling and the other Edit submenus. Items a browser cannot do are shown dimmed with a reason.

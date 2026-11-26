# Feature inventory: Contacts

Read from GitHub, main commit `e62c2ac9`. Nothing was built or run for this inventory, and the shared tree was not read.

**Status.** `missing`: main has nothing for it. `partial`: main has some of it, and the note says what is absent. `built-unchecked`: main's code has it, and nobody has checked it in a browser for this inventory. No row says done. A row becomes done only with a screenshot of it working in the running app.

**Source of the real app's list.** The menu items and shortcuts are written from knowledge of Contacts on macOS 10.15. They were not checked on a Mac, or against the reference screenshots, because the tree is stale. Fix a wrong row when it is found.

**Files read.** `demos/contacts/`: `app.ts`, `contacts.tsx`, `contacts-card.tsx`, `contacts-desktop.tsx`, and the first 22,000 bytes of `contacts.mdx`. `demos/desktop/`: `desktop-menus.tsx`, `desktop.tsx`, `desktop-windows.tsx`.

**Two defects read from the code.** A card cannot be deleted: `contacts.tsx` removes fields, and has no command that removes a card. And the card's buttons do nothing on the desktop: `ContactCard` reports them through `onAction`, and `app.ts`, `desktop.tsx` and `desktop-windows.tsx` give no handler. `contacts.mdx` says of a served card that "a message goes to the account name and mail to that address", which this reading does not support. To confirm in the browser.

**How the menu bar works.** `app.ts` names seven menus. Contacts registers Card (Edit Card) and File (New Card); the rest are the desktop's.

## Counts

| Section | Rows | done | built-unchecked | partial | missing |
| --- | --- | --- | --- | --- | --- |
| Contacts menu | 8 | 6 | 2 | 0 | 0 |
| File menu | 12 | 10 | 1 | 1 | 0 |
| Edit menu | 18 | 12 | 5 | 1 | 0 |
| View menu | 5 | 5 | 0 | 0 | 0 |
| Card menu | 13 | 9 | 4 | 0 | 0 |
| Window menu | 6 | 5 | 1 | 0 | 0 |
| Help menu | 2 | 0 | 2 | 0 | 0 |
| Preferences window | 5 | 0 | 5 | 0 | 0 |
| Windows | 3 | 3 | 0 | 0 | 0 |
| Sidebar | 6 | 4 | 2 | 0 | 0 |
| List of names | 4 | 4 | 0 | 0 | 0 |
| Finished card | 19 | 12 | 7 | 0 | 0 |
| Card being edited | 12 | 8 | 3 | 1 | 0 |
| Commands and sheets | 8 | 6 | 2 | 0 | 0 |
| Context menus | 3 | 2 | 1 | 0 | 0 |
| Keyboard | 5 | 5 | 0 | 0 | 0 |
| Drag and drop | 6 | 2 | 4 | 0 | 0 |
| Multi-selection | 2 | 2 | 0 | 0 | 0 |
| Saved state | 7 | 6 | 1 | 0 | 0 |
| Cross-app | 13 | 6 | 7 | 0 | 0 |
| **Total** | **157** | **107** | **47** | **3** | **0** |

Rows marked with a screenshot name rather than a link were checked in the browser; their files wait to be published to the project library.

## Menus

### Contacts menu

| Item | Status | Note |
| --- | --- | --- |
| About Contacts | done | [The window](#project-artifact/art_0ec4ebf78af349f9/129). Desktop's item. `contacts-rows-journey`. |
| Hide Contacts ⌘H | done | Item and key, read from the window's state. [Hide Others run](#project-artifact/art_0ec4ebf78af349f9/141). `contacts-rows-journey`. |
| Hide Others ⌥⌘H | done | [Other windows gone](#project-artifact/art_0ec4ebf78af349f9/141). Item driven; the key by Calendar's journey on the same menu. `contacts-rows-journey`. |
| Show All | done | Brings them back, [same run](#project-artifact/art_0ec4ebf78af349f9/141). `contacts-rows-journey`. |
| Quit Contacts ⌘Q | done | Item and key close its windows, read from the page. [Same run](#project-artifact/art_0ec4ebf78af349f9/141). `contacts-rows-journey`. |
| Services | built-unchecked | The desktop's list: with text selected on a card it offers what applies, read in `contacts-calendar-batch3-journey`; with none, dimmed "No Services Apply". |
| Accounts… | built-unchecked | Opens System Preferences on Internet Accounts. `contacts-calendar-batch3-journey`. |
| Preferences… ⌘, | done | [A window of its own](#project-artifact/art_0ec4ebf78af349f9/58). `contacts-preferences-journey`. |

### File menu

| Item | Status | Note |
| --- | --- | --- |
| Close Window ⌘W | done | [File menu](#project-artifact/art_0ec4ebf78af349f9/137). Item and key. `contacts-rows-journey`. |
| New Card ⌘N | done | [Screenshot](#project-artifact/art_193e88d1bee786c4/15), key checked in `contacts-menus-journey`. A browser may keep Ctrl-N for itself. |
| New Smart Group ⌥⌘N | done | [Its sheet](#project-artifact/art_0ec4ebf78af349f9/154), the group read from the server. Served desktop. One rule. `contacts-rows-journey`. |
| Import… ⌘O | done | [File menu](#project-artifact/art_0ec4ebf78af349f9/137). A vCard from the computer, read from the server. `contacts-rows-journey`. |
| Export > Export vCard… | done | [File menu](#project-artifact/art_0ec4ebf78af349f9/137). The card shown, or the names selected, the download read. `contacts-rows-journey`. |
| New Group ⇧⌘N | done | [Groups in the sidebar](#project-artifact/art_0ec4ebf78af349f9/4). Its name is typed in the sidebar. `contacts-groups-journey` reads it from the server and after a reload. |
| New Group from Selection | done | The card shown or the names selected, in the same journey. |
| New Smart Group from Current Search | done | [Named for the search](#project-artifact/art_0ec4ebf78af349f9/153), read from the server. `contacts-rows-journey`. |
| Save ⌘S | partial | Dimmed, saying Contacts saves every change as it is made. Checked against the reference: it cannot say whether Catalina's File menu lists Save. `10-15-Catalina-Light-Contacts.png` and `-Dark-Contacts.png`, the only two Contacts captures, are crops of the window with no menu bar and no File menu open, so the row stays, unproven either way, until a Mac is read. |
| Export > Contacts Archive… | built-unchecked | Screenshot `contacts-batch-archive-alert`. Every card, group, smart group and picture in one file, read from the download; File > Import asks, then replaces what is there, read from the server. **Not Apple's format:** the file is named `.abbu` but is one JSON document of this desktop's own, so a Mac cannot read it and this window cannot read a Mac's. `contacts-census-journey --batch`. |
| Export as PDF… | done | [File menu](#project-artifact/art_0ec4ebf78af349f9/137). The card selected; the page handed to the browser read. A headless browser shows no dialog. `contacts-rows-journey`. |
| Print… ⌘P | done | [File menu](#project-artifact/art_0ec4ebf78af349f9/137). The card selected: name, company and every labelled field, read from the page handed to the browser. Absent: the styles and layouts Contacts prints, and the dialog itself is unchecked. `contacts-rows-journey`. |

### Edit menu

Dimmed desktop rows, "Contacts adds no Edit commands".

| Item | Status | Note |
| --- | --- | --- |
| Edit Card ⌘L | done | Key checked in the journey. |
| Find ⌘F | done | Key checked in the journey. |
| Delete Card | done | [Alert](#project-artifact/art_193e88d1bee786c4/9), checked after a reload in `contacts-delete-journey`. The person's own card cannot be deleted: the desktop makes it again. |
| Undo ⌘Z | done | [Undo Delete Card, the card back](#project-artifact/art_0ec4ebf78af349f9/70). New, edit, delete, merge and import, one step each, kept on the server as they are undone; while a card is edited, they act on the field being edited. Only while the window lives. A deleted card comes back without its picture, which the server has already removed. `contacts-undo-journey`. |
| Redo ⇧⌘Z | done | [The same run](#project-artifact/art_0ec4ebf78af349f9/70). `contacts-undo-journey`. |
| Cut ⌘X | done | The card or the names selected as a vCard, then deleted without the alert; Undo Cut brings them back. A card with a picture still gets Delete Card's alert, since neither the clipboard nor Undo brings its picture back. Your own card stays. `contacts-print-journey`. |
| Copy ⌘C | done | [The run](#project-artifact/art_193e88d1bee786c4/35). The card as a vCard, or the text selected on it, each read back in `contacts-print-journey`. While a card is edited, the item is dimmed and the key is the field's own. |
| Paste ⌘V | done | A vCard on the clipboard becomes new cards, shown as an import is; Undo Paste takes them back. While a card is edited, the item is dimmed and the key is the field's own. `contacts-print-journey`. |
| Remove from Group | done | [A group shown](#project-artifact/art_0ec4ebf78af349f9/4). The card or the names selected; the card stays. `contacts-groups-journey`. |
| Rename Group | done | [The row's menu](#project-artifact/art_0ec4ebf78af349f9/6). Also a smart group, and a double-click on the row. `contacts-groups-journey`. |
| Delete Group | done | [The alert](#project-artifact/art_0ec4ebf78af349f9/135); the cards stay. By the row's menu and by Edit, read from the server. The Delete key was not pressed in this run. `contacts-rows-journey`. The commands pull-down's Delete Smart Group asks too: see Commands and sheets. |
| Select All ⌘A | done | Every name shown; same journey. |
| Spelling and Grammar | built-unchecked | Screenshot `cc3-spelling`. On the card's note, which now holds lines of text; Show Spelling and Grammar opens on it in `contacts-calendar-batch3-journey`, the panel itself shared with Calendar. **Limit:** the one-line fields are not walked, because `desktop/text-tools.tsx` reads a text area or editable text only; there the row is dimmed. |
| Substitutions | built-unchecked | The note's, as for Spelling, kept under `contacts`. The submenu read in `contacts-calendar-batch3-journey`; the replacements share `desktop/text-substitutions` and were not typed here. |
| Transformations | built-unchecked | Screenshot `contacts-batch-edit-menu`. Make Upper Case changed the text selected in a field, read from the field and then the server; Make Lower Case and Capitalize share its path and were not pressed. Dimmed, saying why, with nothing selected. `contacts-census-journey --batch`. |
| Speech | built-unchecked | Start Speaking is offered, for the text selected or else the card; unit tests see the words reach a stub `speechSynthesis`. Nothing was heard: the headless browser has no audio to check. `contacts-text-rows.tsx`. |
| Start Dictation | built-unchecked | Screenshot `contacts-batch-edit-menu`, of the row when it was dimmed. The desktop's row: types what the browser's recognizer hears, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer. `contacts-census-journey --batch`. |
| Emoji & Symbols | built-unchecked | Pressed in Contacts, the Character Viewer opens and closes. `contacts-calendar-batch3-journey`. |

### View menu

| Item | Status | Note |
| --- | --- | --- |
| Enter Full Screen ⌃⌘F | done | [Full screen](#project-artifact/art_0ec4ebf78af349f9/139). The item, and Exit brings back its size. The key names Control and Command, which match only on Apple platforms, so it was not pressed. `contacts-rows-journey`. |
| Show or Hide Groups ⌘1 | done | [Hidden](#project-artifact/art_0ec4ebf78af349f9/140). Item and key. `contacts-rows-journey`. |
| Card Only and List and Card | done | [Card Only](#project-artifact/art_0ec4ebf78af349f9/5). ⌘2 and ⌘3, a choice of this demo. Kept with the person's settings. Find shows the list. `contacts-layout-journey`. |
| Sort By First or Last Name | done | [View > Sort By](#project-artifact/art_193e88d1bee786c4/26), screenshot `contacts-batch-sort-first`. Kept with the person's settings. The bold name in a row follows the sort, in the order the names are shown. `contacts-view-journey`, `contacts-census-journey --batch`. |
| Display Last Name Before First | done | [In the list and the card's title](#project-artifact/art_0ec4ebf78af349f9/58), kept with the person's settings, across a reload. `contacts-preferences-journey`. |

### Card menu

| Item | Status | Note |
| --- | --- | --- |
| Mark as a Company ⌘\ | done | [Marked](#project-artifact/art_0ec4ebf78af349f9/133). Item and key, read from the server. `contacts-rows-journey`. |
| Make This My Card | built-unchecked | Screenshot `contacts-batch-my-card`. The mark and the account name move to the card, read from the server; the old card stays as an ordinary one; Undo gives them back. `contacts-census-journey --batch`. |
| Choose Custom Image… ⌥⌘I | done | [On a card](#project-artifact/art_0ec4ebf78af349f9/149). The item, read from the server; the key was not pressed in this run. `contacts-rows-journey`. |
| Clear Custom Image | done | [The card without it](#project-artifact/art_0ec4ebf78af349f9/133), read from the server. `contacts-rows-journey`. |
| Go to Next Card ⌘] | done | Key checked in the journey. |
| Go to Previous Card ⌘[ | done | Key checked in the journey. |
| Look for Duplicates… | done | [Merged](#project-artifact/art_0ec4ebf78af349f9/51). Cards of one name, whatever the case and accents, and entries a card holds twice; an alert counts them, and Merge puts everything on one card. A card with no name is never a duplicate. `contacts-merge-journey`. |
| Add Field submenu | done | [Nickname](#project-artifact/art_0ec4ebf78af349f9/130): the card goes to editing with the keyboard in the field, read from the server. Phonetic First and Last Name, Job Title, Department, Address, Related Name, Date, Social Profile have `contacts-fields-journey`. Absent: Prefix, Middle Name, Suffix, Maiden Name, Pronunciation. `contacts-rows-journey`. |
| Merge Selected Cards ⇧⌘\| | built-unchecked | [One card, with what both held](#project-artifact/art_0ec4ebf78af349f9/51). The person's own card stays, else the first with a picture, else the first. Every different entry, the first value of a single field with any other in the note, each different note, and the group memberships of them all. The merged card and the removal of the others are stored in one write; the groups are written first with the card that stays, and keep the ids of the others, which name no card and are ignored when a group is read, so no failure can take a card out of a group. One picture stays, as on a Mac: a card with none takes the picture of a card that goes, read back from the server under its id; where both have one the other goes to Downloads and a notice says so, a step real Contacts does not take, since a merged card holds one and Undo cannot bring a picture back. A picture that cannot be moved stops the merge with a notice. Undo brings the card back with no picture, naming none that is gone; a picture moved stays on the card it moved to. Cards that together pass the 50 entries or 5,000 note characters a card can hold are not merged, and a notice says so. `contacts-merge-journey`, `rows-batch22-journey` (Chromium); screenshot not published. Limit: a card put in another group during the moment the first group write takes gets the kept card in that group with the merge, not before it. |
| Reorder Last Name Before First | built-unchecked | The first and last names change places, on the server; Undo Reorder Names takes it back. Screenshot `contacts-batch-reorder`. `contacts-census-journey --batch`. |
| Go to My Card | done | Selects the person's own card, leaving a group that does not hold it. `contacts-view-journey`. |
| Share My Card… | built-unchecked | Screenshot `contacts-batch-share-notes`. A submenu of Mail, Messages and Notes, with AirDrop dimmed; Notes took the person's card as a `.vcf`, read in Notes' window. Mail and Messages rows of this submenu were not pressed. `contacts-census-journey --batch`. |
| Open in New Window ⌘I | done | [A card in its window](#project-artifact/art_0ec4ebf78af349f9/73). The cards selected, each in a window of its own; a double click on a name and the list's menu too. `contacts-window-journey`. |

### Window menu

| Item | Status | Note |
| --- | --- | --- |
| Minimize ⌘M | done | [In the Dock](#project-artifact/art_0ec4ebf78af349f9/146). Item and key. `contacts-rows-journey`. |
| Zoom | done | [Zoomed](#project-artifact/art_0ec4ebf78af349f9/158), and again brings back its frame. `contacts-rows-journey`. |
| Bring All to Front | done | [Over Calculator](#project-artifact/art_0ec4ebf78af349f9/132), read from the windows' order. `contacts-rows-journey`. |
| Open windows list | done | [The main window and a card's](#project-artifact/art_0ec4ebf78af349f9/157); a row brings its window forward. `contacts-rows-journey`. |
| Tile Window | built-unchecked | Screenshot `cc3-tiled`. Left pressed in Contacts, the window read at the left of the screen; Right shares its path. `contacts-calendar-batch3-journey`. |
| Contacts ⌘0 | done | [The menu](#project-artifact/art_0ec4ebf78af349f9/157). Item and key bring the main window forward from a card's. `contacts-rows-journey`. |

### Help menu

| Item | Status | Note |
| --- | --- | --- |
| Contacts Help | built-unchecked | The row was stale: it opens Help Viewer, driven in `contacts-calendar-batch3-journey`, with the screenshot `cc3-contacts-help`. |
| Search field | built-unchecked | The Help menu's own search finds Contacts' menu rows as it is typed, read in `contacts-calendar-batch3-journey`. |

## Preferences window

| Item | Status | Note |
| --- | --- | --- |
| General (default account, sort, name order, address format) | built-unchecked | Screenshot `contacts-batch-prefs-general`. Show first name and Sort By act, shared with the View menu. Address Format lays out a card's addresses: Germany read on a card as `53111 Bonn`, and from the server as `contacts.addressFormat`. Default account shows and says why it does not change. `contacts-preferences-journey`, `contacts-census-journey --batch`. |
| Accounts | built-unchecked | Lists iCloud and On My Mac, the two a card can be in, both kept on this desktop's server, which the pane says. Enable this account turned off takes the account's cards out of the list, the search and exports, and its group out of the sidebar; the cards stay on the server and come back with it on, and it stays off across a reload (`contacts.accountsOff`). The last account on is dimmed, saying why. General's Default Account is now a pop-up (`contacts.defaultAccount`, iCloud at first), deciding where a card made outside an account's group goes. `rows-batch22-journey`, Chromium, read from the server; screenshot not published. Limits: no account can be added or removed, as a desktop has no other, and the row's Description and Server tabs are absent. Search covers what is shown; a Spotlight result in an account turned off is not revealed. |
| Template | built-unchecked | Screenshot `contacts-batch-prefs-template`, `contacts-batch-new-card`. A checkbox per field; a new card starts with those ticked. `contacts.template` read from the server. Prefix, Middle Name and the other fields Contacts has that cards here lack are not offered. `contacts-census-journey --batch`. |
| Phone | built-unchecked | Screenshot `contacts-batch-prefs-phone`, `contacts-batch-card`. Automatically format phone numbers: a finished card reads `(555) 010-0000`; a number that is not North American stays as typed. Formats are not editable, as they are on a Mac. `contacts.phoneFormat` read from the server. `contacts-census-journey --batch`. |
| vCard | built-unchecked | Screenshot `contacts-batch-prefs-vcard`. Notes and photos are choices, each kept, and notes off was read in an export. vCard Format offers 3.0 and 2.1, kept across a reload and read in an export; 2.1 writes bare types and quoted-printable UTF-8 (`contacts-vcard-21.test.ts`, `calendar-reminders-batch4-journey`). Enable private me card: each phone, email, URL and IM of My Card then has a check, kept with the card, and a field unchecked is left out of the card's vCard, read in an export (`pim-batch5-journey`, `contacts-value-rows.test.ts`). Encoding, for 2.1, offers Unicode (UTF-8) and Western (Windows Latin 1), for Outlook: kept across a reload and read in an export as `CHARSET=WINDOWS-1252`, and a value Windows Latin 1 cannot hold stays UTF-8 and says so; dimmed under 3.0 with the reason (`contacts-vcard-21.test.ts`, `mail-notes-batch7-journey`). Whether Outlook itself reads the file was not tried: no Outlook here. `contacts-census-journey --batch`. |

## Windows and views

### Windows

| Item | Status | Note |
| --- | --- | --- |
| Three panes | done | [Three panes](#project-artifact/art_0ec4ebf78af349f9/159). `contacts-rows-journey`. |
| Card only | done | [Same screenshot](#project-artifact/art_0ec4ebf78af349f9/5). `contacts-layout-journey`. |
| A card in its own window | done | [Same screenshot](#project-artifact/art_0ec4ebf78af349f9/73). Edits and Done there write the same card and count for Undo; its window closes when the card is gone, and windows do not come back after a reload. `contacts-window-journey`. |

### Sidebar

| Item | Status | Note |
| --- | --- | --- |
| All Contacts | done | [Every card](#project-artifact/art_0ec4ebf78af349f9/152). `contacts-rows-journey`. |
| All iCloud | built-unchecked | Lists only the cards of that account: with one card made in All iCloud and one in All on My Mac, the server holds them as `icloud` and `mac`, each list shows its own, All Contacts both, and All iCloud the same after a reload. `rows-batch23-journey`, screenshot `contacts-all-icloud`, not published. `contacts-rows-journey` still reads only an account with no On My Mac card. |
| All on My Mac | built-unchecked | A card made while it is shown has the account `mac`, read from the server; it alone is listed there, and still after a reload. Screenshot `pim5-all-on-my-mac`, not published. `pim-batch5-journey`. |
| Smart Groups section | done | [Both listed](#project-artifact/art_0ec4ebf78af349f9/149). Served desktop. `contacts-rows-journey`. |
| Groups of the person's own | done | [Section Groups](#project-artifact/art_0ec4ebf78af349f9/4), by name, on the server at `/api/contacts/groups`. `contacts-groups-journey`. In a section of their own rather than under iCloud. |
| Hiding the sidebar | done | [Controls on the list](#project-artifact/art_0ec4ebf78af349f9/140). View > Hide Groups. `contacts-rows-journey`. |

### List of names

| Item | Status | Note |
| --- | --- | --- |
| Rows, sort name in semibold | done | [Rows](#project-artifact/art_0ec4ebf78af349f9/159), the weight read from the page. `contacts-rows-journey`. |
| Search | done | [No Results](#project-artifact/art_0ec4ebf78af349f9/150). Names, note and every field, ignoring case. Accents were not typed in this run. `contacts-rows-journey`. |
| My card's mark | done | [On the person's row](#project-artifact/art_0ec4ebf78af349f9/159). `contacts-rows-journey`. |
| Sort order setting | done | [After a reload](#project-artifact/art_193e88d1bee786c4/35). View > Sort By, kept with the person's settings; `contacts-print-journey` reads it from the server. |

### Finished card

| Item | Status | Note |
| --- | --- | --- |
| Name and company | done | [The card](#project-artifact/art_0ec4ebf78af349f9/138). `contacts-rows-journey`. |
| Picture or monogram | done | [Monogram](#project-artifact/art_0ec4ebf78af349f9/138), and [picture](#project-artifact/art_0ec4ebf78af349f9/149). `contacts-rows-journey`. |
| Phones | done | [The card](#project-artifact/art_0ec4ebf78af349f9/138). `contacts-rows-journey`. |
| Email addresses | done | [The card](#project-artifact/art_0ec4ebf78af349f9/138). `contacts-rows-journey`. |
| Messaging names | done | [The card](#project-artifact/art_0ec4ebf78af349f9/138). `contacts-rows-journey`. |
| Note | done | [The card](#project-artifact/art_0ec4ebf78af349f9/138). `contacts-rows-journey`. |
| Account row | done | [The person's account](#project-artifact/art_0ec4ebf78af349f9/159). Served desktop. `contacts-rows-journey`. |
| Plus, New Contact | done | [A card to fill in](#project-artifact/art_0ec4ebf78af349f9/136). `contacts-rows-journey`. |
| Edit and Done | done | [Editing](#project-artifact/art_0ec4ebf78af349f9/136). `contacts-rows-journey`. |
| Commands pull-down | done | [Add a Desktop User](#project-artifact/art_0ec4ebf78af349f9/134). Served desktop. `contacts-rows-journey`. |
| Message, call, video and mail buttons | done | Open Messages, FaceTime and Mail; `contacts-reach-journey` presses message, mail and video ([call](#project-artifact/art_193e88d1bee786c4/13), with a fake camera). `contacts-rows-journey` presses the audio button. |
| FaceTime row | built-unchecked | In `contacts-rows-journey` the video button then the audio button each leave FaceTime calling, and the requests that placed them read `video` then `audio`. No one answered these calls, so no sound or picture travelled from this row. No screenshot of it reviewed. |
| Label menus | built-unchecked | The email label's first row opens a message to the address, read from the To field in `contacts-calendar-batch3-journey`. Send Message and the rest take the same handler. Search with Spotlight is dimmed on a served desktop, saying Spotlight takes no search from an application yet. |
| Badges on a hovered row | built-unchecked | Pressed on a hovered email row, a message opens. `contacts-calendar-batch3-journey`. |
| Web addresses | built-unchecked | Screenshot `contacts-batch-web-address`. A web address on a card is a link that opens in Safari. `contacts-census-journey --batch`. |
| Birthday | built-unchecked | Typed as a person says it, a date with no year among them, or picked with the date picker beside it; the picker's step read from the server in `contacts-calendar-batch3-journey`, the rest in `contacts-card-rows.test.tsx`. Calendar's Birthdays reads it: see Cross-app. |
| Share menu | built-unchecked | Screenshot `contacts-batch-share-menu`, `contacts-batch-share-mail`. Mail took the card as a `.vcf` on a new message; Notes shares the path, and was pressed through Share My Card. Messages shares it and was not pressed. AirDrop is dimmed: it needs a nearby device, which a web page cannot reach. `contacts-census-journey --batch`. |
| Postal address, with Show on Map | built-unchecked | Shown, edited, in vCard, searched. Copy Mailing Label. Show on Map searches for the address in Maps; `e2e/contacts-fields-journey.mjs` runs it. |
| Other fields (nickname, job title, department, related name, date, social profile, phonetic names) | done | [On a card](#project-artifact/art_0ec4ebf78af349f9/7), on the server and after a reload: `contacts-fields-journey`. A date is typed, as a birthday is, with no date picker. View Profile was not pressed in a browser. |

### Card being edited

| Item | Status | Note |
| --- | --- | --- |
| Text fields for every value | done | [Filled in](#project-artifact/art_0ec4ebf78af349f9/136), read from the server. `contacts-rows-journey`. |
| Label pop-ups | done | [A label changed](#project-artifact/art_0ec4ebf78af349f9/136). `contacts-rows-journey`. |
| Custom label | done | [On the card](#project-artifact/art_0ec4ebf78af349f9/138), read from the server. Was a defect in a real browser: the closing menu took the keyboard from the field and ended it. `contacts-rows-journey`. |
| Remove a field | done | [The editor](#project-artifact/art_0ec4ebf78af349f9/136); its red button. `contacts-rows-journey`. |
| Empty row adds a field | done | [The editor](#project-artifact/art_0ec4ebf78af349f9/136). `contacts-rows-journey`. |
| Company checkbox | done | [The editor](#project-artifact/art_0ec4ebf78af349f9/136), read from the server. `contacts-rows-journey`. |
| Info and Picture segments | done | [Picture](#project-artifact/art_0ec4ebf78af349f9/148). `contacts-rows-journey`. |
| Monogram and Silhouette | done | [Silhouette](#project-artifact/art_0ec4ebf78af349f9/148), read from the server. `contacts-rows-journey`. |
| Choose Picture…, Choose from Drive…, Remove Picture | built-unchecked | [A picture chosen](#project-artifact/art_0ec4ebf78af349f9/147), read from the server, and removed; a PNG picked from the drive's Pictures folder through Choose from Drive… is on the card, read from the server, across a reload. Screenshot `pim5-choose-from-drive`, not published. `contacts-rows-journey`, `pim-batch5-journey`. |
| Ringtone and text tone | built-unchecked | Kept with the card, and choosing one sounds it: each of the ten names has its own short tone, drawn with Web Audio in `contacts-tones.ts`. The sounds are original stand-ins under Catalina's names, since Apple's ringtones are not ours to ship; a name from elsewhere, such as an imported card's Marimba, sounds the plain Note. It follows Output volume, Mute and the alert volume. `contacts-card-rows.test.tsx` holds the pitches, with a stand-in for Web Audio; in Chromium a probe that was not committed chose all ten on a new card and read a different set of pitches from the page's audio output for each. Nothing was heard, and the sounds were not judged by ear. |
| Crop and zoom a picture | built-unchecked | Screenshot `cc3-picture-editor`. Card > Edit Custom Image… or a double click on the picture: Zoom and a drag frame it, from the whole file while this window has it, else from the square the server keeps. A photo of red and blue halves framed on its left came back all red from the server, and stayed so after a reload. `contacts-calendar-batch3-journey`; the Zoom slider by `cropSquare`'s unit test, not by a drag. |
| Discard an edit | built-unchecked | Screenshot `contacts-batch-discard`. Card > Discard Changes puts the card back as it was and ends the edit, or takes away a card just made with its New Card step, each read from the server. A picture chosen during the edit stays, since it is on the server already. `contacts-census-journey --batch`. |

### Commands and sheets

Served desktop. These live in a pull-down in the card's bar.

| Item | Status | Note |
| --- | --- | --- |
| Add Desktop User… | done | [The sheet](#project-artifact/art_0ec4ebf78af349f9/134). `contacts-rows-journey`. |
| Import vCard… | done | Read from the server, [same run](#project-artifact/art_0ec4ebf78af349f9/142). `contacts-rows-journey`. |
| Import vCard from Drive… | done | [The drive's panel](#project-artifact/art_0ec4ebf78af349f9/142), read from the server. `contacts-rows-journey`. |
| Export Card and Export All Cards as vCard | done | Each download read. [The commands](#project-artifact/art_0ec4ebf78af349f9/134). `contacts-rows-journey`. |
| Save Card and Save All Cards to Drive… | done | Each file read from the drive. [The commands](#project-artifact/art_0ec4ebf78af349f9/134). `contacts-rows-journey`. |
| New Smart Group… | done | [Several rules](#project-artifact/art_0ec4ebf78af349f9/71): any or all of up to 20, on 14 fields, each contains, does not contain, is, begins with or ends with; Desktop User is or is not. Kept on the server. `contacts-smart-rules-journey`. |
| Delete Smart Group | built-unchecked | Screenshot `contacts-batch-delete-smart-group`. The same alert as Delete Group; Cancel keeps it, and Delete takes it from the server. `contacts-census-journey --batch`. |
| Pictures in vCard files | built-unchecked | Screenshot `contacts-batch-card`. An imported JPEG or PNG is the card's picture, read from the server; an export writes it, read from the download. A picture in any other format is left out and said (unit test). Copy, Paste and a drag carry none. `contacts-census-journey --batch`. |

## Context menus

| Item | Status | Note |
| --- | --- | --- |
| Name row (Edit Card, Delete Card, New Group from Selection) | done | [The menu](#project-artifact/art_0ec4ebf78af349f9/8). The row under the pointer, or the names selected with it; Remove from Group inside a group. `contacts-groups-journey`. |
| Group row (Edit Smart Group, Rename, Delete, Export) | done | [The menu](#project-artifact/art_0ec4ebf78af349f9/6). Edit Smart Group opens the rule builder, `contacts-smart-rules-journey`. Rename and Delete on groups and smart groups, Export on every row, as one vCard file named for the group, read in `contacts-groups-journey`. |
| Field value (Copy, Search, Add to) | built-unchecked | Screenshot `contacts-batch-value-menu`. Copy, read from the clipboard; Search in Contacts, read back; Look Up, opening Dictionary on a word and dimmed with why on what is not one, such as a number; an IM value no longer carries its service's name. Add to > New Card makes a card holding the value in its field, read from the server; Add to > VIPs adds an email address to Mail's VIPs, read in Mail's sidebar after a reload, and is dimmed with why on anything else. `calendar-reminders-batch4-journey`, `contacts-census-journey --batch`, `pim-batch5-journey`. Written from knowledge of the app, not checked on a Mac. |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| Arrow keys in the list | done | [The list](#project-artifact/art_0ec4ebf78af349f9/143). `contacts-rows-journey`. |
| Type-select in the list | done | [The name typed](#project-artifact/art_0ec4ebf78af349f9/143). `contacts-rows-journey`. |
| Return and Escape in a custom label | done | [The label kept](#project-artifact/art_0ec4ebf78af349f9/138). `contacts-rows-journey`. |
| The menu items' keys above (⌘N, ⌘L, ⌘F, ⌘], ⌘[, ⌘1, ⌘\) | done | [New Card's key](#project-artifact/art_193e88d1bee786c4/15). The map was stale: all are bound in `contacts.tsx` through `useWindowKeys`, and the rows above name their journeys. |
| Delete key removes a card | done | With the same alert; checked in `contacts-delete-journey`. |

## Drag and drop

| Item | Status | Note |
| --- | --- | --- |
| vCard file onto the list of names | done | [The card](#project-artifact/art_0ec4ebf78af349f9/151). A file dropped by synthetic drop events carrying a real `DataTransfer`, read from the server. `contacts-rows-journey`. A `.vcf` dragged from a Finder window onto any part of the window is read from the drive and imported, kept on the server across a reload: `open-items-batch6-journey`. |
| Card onto a group | done | [Crew](#project-artifact/art_0ec4ebf78af349f9/151), read from the server. `contacts-rows-journey`; two names in `contacts-groups-journey`. |
| Card to Finder as a vCard | built-unchecked | A real mouse drag from the list to the desktop writes `<name>.vcf` on the drive, its text read back as the card. `contacts-calendar-batch3-journey`. Finder windows take the same drop through the desktop's drop targets and were not driven. The drag stays the browser's own, with `text/vcard` and `DownloadURL`; off the browser cannot be shown headless. |
| Card into Mail or Messages | built-unchecked | Screenshots `cc3-card-in-to`, `cc3-card-attached`. A real mouse drag: on Mail's To field it gives the card's address (type `application/x-macalicious-address`), on the message it attaches the vCard. `contacts-drag.ts` offers the browser's drag to the desktop's drop targets. Messages takes the vCard by the same target; not driven. |
| Picture onto a card | built-unchecked | Screenshot `contacts-batch-picture-drop`. A file dropped on the card's head is its picture, read from the server. By synthetic drop events carrying a real `DataTransfer`. `contacts-census-journey --batch`. |
| Picture from Photos onto a card | built-unchecked | Screenshot `cc3-photo-on-card`. A photo dragged from Photos onto the card's head, the server's picture read as the photo's middle square. `contacts-calendar-batch3-journey`. |

## Multi-selection

| Item | Status | Note |
| --- | --- | --- |
| Several names | done | [Two selected](#project-artifact/art_193e88d1bee786c4/46): Command or Shift adds; the pane says how many. `contacts-select-several-journey`. |
| Delete, export or group several | done | [Two selected](#project-artifact/art_0ec4ebf78af349f9/151). Deleted after asking, exported as one vCard, and a group from the selection, each read back. Copy, Save to Drive and leaving My Card were not driven in this run. `contacts-rows-journey`. |

## Saved state

| Item | Status | Note |
| --- | --- | --- |
| Cards | done | [After a reload](#project-artifact/art_0ec4ebf78af349f9/149), from `/api/contacts/cards`. `contacts-rows-journey`. |
| Pictures | done | [After a reload](#project-artifact/art_0ec4ebf78af349f9/149). One key per card. `contacts-rows-journey`. |
| Smart groups | done | [After a reload](#project-artifact/art_0ec4ebf78af349f9/149). `contacts-rows-journey`. |
| Groups of the person's own | done | [After a reload](#project-artifact/art_0ec4ebf78af349f9/149). A document of their own. `contacts-rows-journey`. |
| Groups shown, Card Only | done | [Groups hidden after a reload](#project-artifact/art_0ec4ebf78af349f9/149), read from the person's settings. Card Only has `contacts-layout-journey`. `contacts-rows-journey`. |
| A change from another browser | done | [Merged](#project-artifact/art_0ec4ebf78af349f9/144), both changes read from the server. The alert for one that cannot merge was not driven. `contacts-rows-journey`. |
| Group shown, card chosen, sort order | built-unchecked | Screenshot `contacts-batch-after-reload`. `contacts.groupShown` and `contacts.cardChosen` read from the server, both back after a reload, with the sort order. `contacts-census-journey --batch`. |

## Cross-app

| Item | Status | Note |
| --- | --- | --- |
| Mail's address completion | built-unchecked | Mail's own To field offers a card with an account as it is typed. `contacts-calendar-batch3-journey`. `GET /api/contacts/people` lists the desktop user, read from the server; [Add Desktop User](#project-artifact/art_0ec4ebf78af349f9/134). |
| Messages' To field | done | [Offered](#project-artifact/art_0ec4ebf78af349f9/145) as it is typed. `contacts-rows-journey`. |
| Spotlight finds and opens a contact | done | [The card](#project-artifact/art_0ec4ebf78af349f9/155). `contacts-rows-journey`. |
| Mail button opens New Message | done | [New Message](#project-artifact/art_193e88d1bee786c4/11), `contacts-reach-journey`. |
| Message button opens a conversation | built-unchecked | [To filled in](#project-artifact/art_193e88d1bee786c4/12) for someone with no conversation; with one already open with that person, it shows that one, not a new message, from a closed Messages and an open one. `contacts-reach-journey`, `pim-batch5-journey`, `messages-compose-to.test.tsx`. |
| Video button places a FaceTime call | done | [Calling](#project-artifact/art_0ec4ebf78af349f9/156), with a fake camera. On the served desktop. `contacts-rows-journey`. |
| Call button places a FaceTime Audio call | built-unchecked | The card's FaceTime audio button places a call whose request says `audio`, read in `contacts-rows-journey` after the video call before it. The big Call button was not clicked. |
| Birthdays in Calendar | built-unchecked | The row was stale: Calendar's Birthdays reads every card's birthday (`demos/calendar/calendar-birthdays.tsx`), with `calendar-birthdays-journey` behind it; that journey was not rerun for this row. |
| Address opens in Maps | built-unchecked | The map was stale: Show on Map searches Maps for the address, and `contacts-fields-journey` runs it; no screenshot of it here. |
| `.vcf` opened from Finder | built-unchecked | The map was stale: `app.ts` takes `.vcf` and `ContactsCommands` reads each opened file through `onOpenFileRequest`. Not driven from Finder for this row. |
| Siri finds a person | built-unchecked | Siri looks the name up in `/api/contacts/cards` and shows the found card. `e2e/desktop-batch3-journey.mjs`. |
| Copy a card as vCard | done | Edit > Copy; the clipboard read in the browser. [The card](#project-artifact/art_0ec4ebf78af349f9/138). `contacts-rows-journey`. |
| Dock icon menu | done | New Card, read from the server. [After it](#project-artifact/art_0ec4ebf78af349f9/145). `contacts-rows-journey`. |

The open work ledger has no open item for Contacts.

## Calls made

- **Delete Card comes first.** Listed in the Edit menu, because that is where macOS has it, but it is the first build item: an address book that cannot delete is a defect, not a depth gap.
- **Call button.** Without telephones, it places a FaceTime Audio call to a desktop user, and stays dimmed with its reason on any other card.

## Build items, most-used first

Each lands as small reviewed commits. Each row changes to done only with a browser screenshot.

1. **Delete Card.** Edit item, Delete key and alert. Server keeps the rest; remove its picture too.
2. **Wire the card's buttons.** Message, call, video, mail, the label menus, badges and Share, opening Messages, FaceTime and Mail. Reconcile with the `mdx` line. Check whether the integration worker's opening route fits.
3. **Menus with keys.** File (New Card, Import, Export), Card (Next, Previous, Mark as Company, pictures), Edit (Find), Card (Edit Card), View (Show Groups, Sort By).
4. **Groups.** New Group, drag cards onto a group, Rename and Delete, New Group from Selection.
5. **Multi-selection.** Delete, export and group several.
6. **Context menus.** Name row, group row, field value.
7. **Missing fields.** Postal address with Show on Map, nickname, job title, department, related name, date, social profile, phonetic names; Add Field; a real birthday date.
8. **Preferences window.** General, Accounts, Template, Phone, vCard.
9. **Duplicates and merging.** Look for Duplicates, Merge Selected Cards.
10. **Smart group builder.** Several rules, Edit, Delete with an alert, from the current search.
11. **Cross-app.** Birthdays in Calendar, `.vcf` from Finder, card to Finder and Mail, pictures from Photos, Siri, Copy as vCard.
12. **Views.** Card only, a card in its own window, Discard an edit, picture cropping, Undo and Redo.
13. **Remaining items.** Print, PDF, Archive, pictures in vCard files, Share My Card, ringtone preview, Spelling and the other Edit submenus. Items a browser cannot do are shown dimmed with a reason.

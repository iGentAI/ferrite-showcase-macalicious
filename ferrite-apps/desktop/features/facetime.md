# Feature inventory: FaceTime

Read from GitHub, main commit `e62c2ac9`, then corrected row by row against the code. `missing` and `partial` rows were last read against main commit `2698563b`.

**Status.** `missing`: main has nothing for it. `partial`: main has some of it, and the note says what is absent. `built-unchecked`: main's code has it, and it has no screenshot of it working for this inventory. A row becomes done only with a screenshot of it working in the running app.

**Source of the real app's list.** The menu items and shortcuts are written from knowledge of FaceTime on macOS 10.15. They were not checked on a Mac, or against the reference screenshots, because the tree is stale. Fix a wrong row when it is found.

**Files read.** `demos/facetime/`: `app.ts`, `facetime.tsx`, the first 15,000 bytes of `facetime.mdx`, and `facetime-live.tsx` for its menus and operations. `demos/desktop/desktop-menus.tsx`. Also the desktop README's FaceTime section and the open work ledger.

**How the menu bar works.** `app.ts` names six menus. FaceTime registers its own rows in FaceTime, Edit, Video, Window and the Dock's menu. The rest are the desktop's.

## Counts

| Section | Rows | done | built-unchecked | partial | missing |
| --- | --- | --- | --- | --- | --- |
| FaceTime menu | 8 | 1 | 7 | 0 | 0 |
| File menu | 1 | 0 | 1 | 0 | 0 |
| Edit menu | 8 | 0 | 8 | 0 | 0 |
| Video menu | 9 | 5 | 4 | 0 | 0 |
| Window menu | 7 | 1 | 6 | 0 | 0 |
| Help menu | 2 | 0 | 2 | 0 | 0 |
| Preferences window | 2 | 2 | 0 | 0 | 0 |
| Windows | 3 | 0 | 3 | 0 | 0 |
| Sidebar | 9 | 0 | 9 | 0 | 0 |
| Preview and call | 13 | 6 | 7 | 0 | 0 |
| Context menus | 2 | 1 | 1 | 0 | 0 |
| Keyboard | 6 | 1 | 5 | 0 | 0 |
| Drag and drop | 1 | 0 | 1 | 0 | 0 |
| Multi-selection | 1 | 0 | 1 | 0 | 0 |
| Saved state | 4 | 1 | 3 | 0 | 0 |
| Server and ledger | 7 | 1 | 5 | 0 | 1 |
| Cross-app | 7 | 3 | 4 | 0 | 0 |
| **Total** | **90** | **22** | **67** | **0** | **1** |

## Menus

### FaceTime menu

| Item | Status | Note |
| --- | --- | --- |
| About FaceTime | built-unchecked | Desktop's item. |
| Hide FaceTime ⌘H | built-unchecked | |
| Hide Others ⌥⌘H | built-unchecked | |
| Show All | built-unchecked | |
| Quit FaceTime ⌘Q | built-unchecked | Closing leaves the call this page holds. |
| Services | built-unchecked | The desktop's submenu: "No Services Apply" dimmed, saying why, with no text selected, and the services for the text selected otherwise (`desktop-services.tsx`). Stale row corrected from the code; not driven from FaceTime. |
| Preferences… ⌘, | built-unchecked | A window of the desktop: [Settings](#project-artifact/art_0ec4ebf78af349f9/44) and [Blocked](#project-artifact/art_0ec4ebf78af349f9/43). `facetime-preferences-journey`. |
| Turn FaceTime Off ⌘K | done | [Off](#project-artifact/art_0ec4ebf78af349f9/45), kept with the person's settings, in every browser of theirs: the camera is let go, nothing is placed, and a call to them rings out unanswered. The pane has Turn On. `facetime-preferences-journey`, by key. |

### File menu

| Item | Status | Note |
| --- | --- | --- |
| Close Window ⌘W | built-unchecked | |

### Edit menu

[`EditRows`](../../../demos/desktop/desktop-edit-rows.tsx) in `facetime-live.tsx`: the rows act on the recipient field or Add Person's field, and are dimmed with "Click in the recipient field to edit its text." when no field has the keyboard. Cut's live state and Copy were driven in a browser on the recipient field; Undo, Redo, Paste and Select All have unit tests of their state in the window, and the shared rows' own tests.

| Item | Status | Note |
| --- | --- | --- |
| Undo ⌘Z | built-unchecked | The field's own undo. |
| Redo ⇧⌘Z | built-unchecked | The field's own redo. |
| Cut ⌘X | built-unchecked | Live with text selected in the field, read in a browser. |
| Copy ⌘C | built-unchecked | Chosen in a browser; the field keeps the keyboard. |
| Paste ⌘V | built-unchecked | Through the browser's clipboard, which says when it refuses. |
| Select All ⌘A | built-unchecked | The field's text. |
| Start Dictation | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer. |
| Emoji & Symbols | built-unchecked | The desktop's Edit footer (`desktop-menus.tsx`). |

### Video menu

| Item | Status | Note |
| --- | --- | --- |
| End Call | built-unchecked | Dimmed with a reason while no call is placed or on. |
| Add Person… | done | [Opens the call panel's field](#project-artifact/art_0ec4ebf78af349f9/179). Dimmed with a reason with no call, or with four people in it. `facetime-group-journey`. |
| Enter Full Screen ⌃⌘F | built-unchecked | The item in the Video menu, Exit Full Screen while in it, on the window's green-button command; the key is the desktop's. Dimmed, saying why, off the desktop. Live state read in a browser; choosing it is a unit test, on a stand-in server. |
| Mute ⇧⌘M | done | Key checked in the journey. |
| Pause Video | done | Item checked in the journey. |
| Camera submenu | done | [The browser's cameras, the one in use chosen](#project-artifact/art_0ec4ebf78af349f9/42). A choice is kept by the device's name with the person's settings, since a browser's device ids change, comes back after a reload and goes on a call under way without ending it, which the journey reads from the other person's picture; a kind that a device switch cannot supply stays as it was, and a kind the call started without joins on the next call. `facetime-devices-journey`, on Chromium's fake cameras. |
| Microphone submenu | built-unchecked | As Camera, on the browser's fake microphones; what they carry was not listened to. |
| Output submenu | built-unchecked | Chromium's fake outputs; the sound's route was not listened to. The item checked is the sink the picture really has during a call, and a refusal says so. Dimmed and says why where the browser cannot choose (`setSinkId`). |
| Use Portrait or Landscape ⌘R | done | [Upright, with the item Use Landscape](#project-artifact/art_0ec4ebf78af349f9/77). Turns the window's frame, kept across a reload. `facetime-window-journey`. |

### Window menu

| Item | Status | Note |
| --- | --- | --- |
| Minimize ⌘M | built-unchecked | |
| Zoom | built-unchecked | |
| Bring All to Front | built-unchecked | |
| Open windows list | built-unchecked | |
| Tile Window | built-unchecked | Shared desktop menu, Tile Window to Left and Right of Screen (`desktop-menus.tsx`). |
| FaceTime | built-unchecked | Item and ⌘0. `apps-window-menu-journey`. |
| Always on Top | done | [Over Calculator, which is in front](#project-artifact/art_0ec4ebf78af349f9/78). Over every ordinary window, kept across a reload. `facetime-window-journey`. |

### Help menu

| Item | Status | Note |
| --- | --- | --- |
| FaceTime Help | built-unchecked | The desktop's row opens Help Viewer on a search for "FaceTime", which finds the topic "Make calls with FaceTime" (`src/apps/help_viewer/mod.rs`). |
| Search field | built-unchecked | The desktop's Help search field (`help-menu-search.tsx`), seen in FaceTime's Help menu in a browser. |

## Preferences window

| Item | Status | Note |
| --- | --- | --- |
| Settings (account, Caller ID, ringtone, location, Live Photos) | done | [The pane](#project-artifact/art_0ec4ebf78af349f9/44): the account the person logged in with, Enable this account (as Turn FaceTime Off), and the ringtone, kept and heard as the person chooses it and as a call rings: 27 of Mac's names, with phrases of our own, since Apple's sounds are not shipped; the sound itself was not listened to. Location and Live Photos are dimmed and say why: the desktop does not know where a person is, and a picture goes straight to the other person's browser, so this desktop cannot stop it being kept. Caller ID is absent: a person has one address here. |
| Blocked | done | [The pane](#project-artifact/art_0ec4ebf78af349f9/43): one list on the server with Messages (Buddies > Block Person), added by account name, with Remove. A blocked person's call rings out for them, and the person who blocked them gets no ring, line or notification (`tests/facetime_blocked.rs`, `facetime-preferences-journey`). |

## Windows and views

### Windows

| Item | Status | Note |
| --- | --- | --- |
| Main window | built-unchecked | Dark in both appearances. |
| Full screen | built-unchecked | |
| Picture in picture | built-unchecked | The journey enters and leaves it in Chromium, reading the element the browser floats; the browser's own window is not in a page's screenshot, so this row stays unchecked. Video > Enter Picture in Picture floats the other person's picture in the browser's own window, and Exit brings it back. Dimmed and says why with no picture, or where the browser offers none. `facetime-window-journey`. |

### Sidebar

| Item | Status | Note |
| --- | --- | --- |
| All and Missed | built-unchecked | |
| Recipient field | built-unchecked | |
| Audio and Video buttons | built-unchecked | |
| Recent rows | built-unchecked | Name, kind, time. |
| Call-back button on a row | built-unchecked | |
| Missed calls in red | built-unchecked | |
| Completions from Contacts in the field | built-unchecked | A list directly under the field, over the rows (position read in a browser): the person's cards that name a desktop user, by full name or account name. Down and Up Arrow walk it, Return chooses, Escape puts it away until the text changes. A card with only an email or a number is not offered: FaceTime here rings accounts, and such a card names none. `facetime-completions-journey`. |
| Recents grouped by person | built-unchecked | Calls next to each other with one person, of one kind and way, are one row with their count; Remove takes them all. `facetime-recents-journey`. |
| Info button, opening the contact | built-unchecked | On each row with an account: opens the person's card in Contacts, driven in a browser. Dimmed with "<name> is not in your Contacts. Choose Add to Contacts." for someone with no card. |

### Preview and call

| Item | Status | Note |
| --- | --- | --- |
| Camera preview | built-unchecked | Asked for when the window opens. Abstract placeholder off the served desktop. |
| Call panel with End | built-unchecked | |
| Incoming panel with Decline and Accept | built-unchecked | |
| The other person's picture | built-unchecked | WebRTC. `facetime-journey`. |
| Own picture in the corner | built-unchecked | |
| Join Here panel | done | [End on it](#project-artifact/art_193e88d1bee786c4/14) ends the call for both people, and the first tab stays out (`facetime-ledger-journey`). The ledger's defect did not reproduce on main; no code change. |
| Notice | done | "Looking for the call…" gives way after the last look to saying the server could not be reached; reproduced first, then checked in the journey. |
| Mute button | done | [In the call](#project-artifact/art_193e88d1bee786c4/17), `facetime-controls-journey`, checked on the track this browser sends, with a fake microphone. |
| Video-off button | done | Pause Video and Resume Video, checked on the track this browser sends, with a fake camera. |
| Full-screen button | built-unchecked | Full Screen and Exit Full Screen in the call panel, driven both ways in a browser during a call. Only on a window of the desktop. |
| Add Person, Group FaceTime | done | [Three people, one named tile each](#project-artifact/art_0ec4ebf78af349f9/180). Up to 4 people, as a WebRTC mesh: each browser holds one connection to each other person, one tile each, named for its person, and no media server. Add Person in the panel and Video > Add Person…, with Contacts suggestions, by account name. Limits: someone who left, declined or missed the call cannot be rung again in it; a call records at most 12 people; each description has a share of the stored call (28 KiB among three, 14 KiB among four), so a browser sending more cannot reach that person and is told so; no relay, so strict NAT still fails, for that person only. `tests/facetime_group.rs`, `facetime-group-journey`. |
| Live Photo | built-unchecked | The call panel's button tells the others in the call (`POST /calls/<id>/live-photo`, `tests/facetime_notes.rs`) and only then keeps a still of the first picture in Photos as "FaceTime Photo of <name>", and the three seconds after the moment, with their sound, as a movie beside it, "FaceTime Live Photo of <name>"; a still alone when the browser cannot record, and it says so. Dimmed, saying why, with no picture. Unit test with a stand-in recorder (`facetime-live-photo.test.ts`). On Chromium's fake camera `facetime-batch-journey` read the sentence that both were kept and the still in the library on the server; the movie's own row in the library was not read back, and a real camera and microphone were not used. The seconds before the press are absent: a page has them only by recording every call all along. |
| Call timer | done | Running time beside the kind of call; checked in the journey. |

## Context menus

The server has `DELETE /api/facetime/calls` and `DELETE /api/facetime/calls/<id>`. No window uses them.

| Item | Status | Note |
| --- | --- | --- |
| Recent row (Call Back, Remove from Recents, Add to Contacts, Block) | built-unchecked | Call Back, Add to Contacts, Block This Caller and Unblock This Caller, Remove from Recents and Remove All Recents. Removal: `facetime-recents-journey`. Call Back and Block: unit tests of the window; not driven in a browser. A call placed while the last hang-up is still on its way is refused as "already in a call" until it arrives. |
| Remove All Recents | done | Same menu; a call still in progress stays. `facetime-recents-journey`. |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| Return in the field places a video call | built-unchecked | Ignores a Return that ends a composition. |
| A call puts the keyboard on End | built-unchecked | |
| Arrow keys in recents | built-unchecked | |
| Return on a row calls back | built-unchecked | |
| ⌃⌘F Full Screen | built-unchecked | |
| ⇧⌘M Mute | done | Checked in the journey. |

## Drag and drop

| Item | Status | Note |
| --- | --- | --- |
| Contact from Contacts onto the window | built-unchecked | A real drag of a Contacts row onto the window in a browser fills the recipient field with the account name, or with the name of a card that names none, and takes the keyboard. Of several cards, the first. |

## Multi-selection

| Item | Status | Note |
| --- | --- | --- |
| Several recent rows, for Remove | built-unchecked | Command- and Shift-click, then the menu's Remove from Recents or Delete. The sidebar holds one selection for assistive technology; the others are announced. `facetime-recents-journey`. |

## Saved state

| Item | Status | Note |
| --- | --- | --- |
| Recents | built-unchecked | On the server, newest 100. |
| A call after a reload | built-unchecked | Offered with Join Here on a new seat. |
| Filter chosen | done | Kept with the person's settings; `facetime-filter-journey` reads it from the server and after a reload, [screenshot](#project-artifact/art_193e88d1bee786c4/38). |
| Camera and microphone chosen | built-unchecked | Video menu. |

## Server and ledger

| Item | Status | Note |
| --- | --- | --- |
| Cancelled placement, retried leave, seats | built-unchecked | Ledger: done. It notes that no test makes a leave fail. |
| Cancelled place or join whose reply was lost | built-unchecked | **Older finding, already fixed on main.** With the window open, the rechecks find the call held by this page while none is wanted and leave it; browser cases in `facetime-live.browser.test.tsx`. With the window closed and the reply lost nothing is left to hang up, so the seat lapses: the server ends the call after 25 s without a sign of life, and ringing stops with it. |
| Unconfirmed leave when the window closes | built-unchecked | **Older finding, held in part; fixed.** Closing the window alone never lost it, since the retries outlive the window. The page going away did: an unanswered hang-up now goes once more in a request that outlives the page, browser case in `facetime-live.browser.test.tsx`. A window reopened meanwhile has a new page token, so it offers Join Here and never rejoins by itself. |
| Delayed leave from an old page | built-unchecked | **Older finding, already fixed on main.** A leave counts only from the seat the account still holds; unit test `a_resent_join_keeps_its_seat_and_another_page_takes_a_new_one`. |
| WebKit's received picture | built-unchecked | The black reading was the journey's: its coloured camera never reached WebKit, which kept its own mock camera. With the stand-in on the interface, `facetime-journey` passes all 20 steps in Playwright's WebKit 27.2 on Linux, each person reading the other's colour over WebRTC; `facetime-window-journey` passes 11 there, where no Picture in Picture is offered. Firefox 157 passes 20 and 12. |
| Clearing finished calls | done | The two commands above, on the server's routes. |
| Calls across strict NAT | missing | Needs a TURN relay only the owner can supply. The window says so; stays unavailable, per the brief. |

## Cross-app

| Item | Status | Note |
| --- | --- | --- |
| Incoming alert with Decline and Answer | built-unchecked | |
| Contacts' video and call buttons place a call | done | [Call](#project-artifact/art_193e88d1bee786c4/13), `contacts-reach-journey` presses the video button with a fake camera. The audio button has the same path and no browser step. |
| FaceTime from Messages | done | [Calling the person](#project-artifact/art_193e88d1bee786c4/34), `messages-transcript-journey` reads the ringing call from the server. |
| Spotlight finds a recent call | built-unchecked | The newest call with each person, saying how it went. Return opens FaceTime and rings nobody. `e2e/spotlight-people-journey.mjs` |
| Siri places a call | built-unchecked | "FaceTime Ann", "call Ann" and "audio call Ann" open FaceTime on the account on Ann's card, or the name said, for the person to place the call. `desktop-siri-message.test.ts`. |
| Dock badge of missed calls | built-unchecked | A missed call leaves a notification, which the Dock counts, unless the person has blocked the caller. `tests/facetime_notes.rs`. |
| Dock icon menu of recents | done | [The last five people called](#project-artifact/art_0ec4ebf78af349f9/59), each calling them back, while the window is open. `facetime-recents-journey`. |

## Calls made

- **Group FaceTime is back in scope.** The ledger says main cut it. It is part of the real app, so it was a build item, last among calling features. It is built as a mesh rather than from the export, since the app has no media server.
- **The relay and Blocked.** The relay stays unavailable. Blocked is built without it, since it is a server rule.

## Build items, most-used first

Each lands as small reviewed commits. Each row changes to done only with a browser screenshot.

1. **The ledger's two defects.** End on Join Here ends the call; clear "Looking for the call…". This is the ledger's fifth front-end item.
2. **Call controls.** Mute, video off, full-screen button and timer, with the Video menu's Mute and Pause Video.
3. **Devices.** Camera, Microphone and Output submenus, remembered across a reload.
4. **Recents.** Context menu, Remove and Remove All on the server's routes, multi-selection, group by person, saved filter.
5. **People.** Completions from Contacts, the info button, Add to Contacts, Contacts' buttons placing calls (with the Contacts wiring item).
6. **Preferences.** Settings pane, ringtone that plays, Blocked with its server rule, Turn FaceTime Off.
7. **Group FaceTime.** Add Person and several tiles. Built as a mesh of up to 4 people; see Preview and call.
8. **Cross-app.** FaceTime from Messages, Dock badge and menu, Spotlight, Siri.
9. **Remaining items.** Picture in picture, Always on Top, Live Photo, Edit items on the field, orientation. Items a browser cannot do are shown dimmed with a reason.

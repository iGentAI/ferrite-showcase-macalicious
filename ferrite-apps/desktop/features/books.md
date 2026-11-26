# Feature inventory: Books

Main commit read: `e62c2ac9`, from GitHub only. Nothing was built or run.

Status: **missing**; **partial** (the note says what is absent); **built-unchecked** (in main's code, not yet seen running). No row is done: done needs a screenshot in a browser. Every status rests on main's source; a menu row's status includes its key equivalent. Scope is the hosted Ferrite desktop, where Books reads public-domain texts from Project Gutenberg and Standard Ebooks. Real-app wording and keys come from knowledge of macOS 10.15 (no Mac; captures show no menu) and are provisional. Services and the window list are generated lists, so each is one row.

Read: `demos/books/` (`app.ts`, `books.mdx`, `books.tsx`, `books-reader.tsx`, `books-store-view.tsx`), `demos/desktop/desktop-menus.tsx`, `demos/spotlight/spotlight-desktop.tsx`, the desktop README's Books limits. The desktop registers **Store** and, while reading, **Controls**; "Shell" means the desktop's own row. `books.mdx`'s "Not built" list describes the docs demo.

## Menus

| Menu | Item | Key | Status | Notes |
| --- | --- | --- | --- | --- |
| Books | About Books | | built-unchecked | Shell |
| Books | Preferences… | ⌘, | done: [books-preferences.png](#project-artifact/art_a7e016210b9b9bc1/562) | Justify text, Auto-Night Theme; kept per person. `e2e/books-views-journey.mjs` |
| Books | Services | | built-unchecked | Stale row: the shell's `ServicesItems` (`demos/desktop/desktop-services.tsx`) acts on the words selected on a page; "No Services Apply" without a selection |
| Books | Hide Books | ⌘H | built-unchecked | Shell |
| Books | Hide Others | ⌥⌘H | built-unchecked | Shell |
| Books | Show All | | built-unchecked | Shell |
| Books | Quit Books | ⌘Q | built-unchecked | Shell |
| File | New Collection | ⇧⌘N | done: [books-menu-file.png](#project-artifact/art_6a3da0a5b88d531a/62) | Chrome keeps ⇧⌘N for itself outside a test; the menu row always works |
| File | Add to Library… | ⌘O | built-unchecked | An EPUB or a PDF from the computer, kept on the drive in Documents/Books. Refused by name when it is neither or is a damaged EPUB. Chromium, scratch journey: a real Gutenberg EPUB and a built PDF. Screenshot not published |
| File | Open Book | | done: [books-menu-file.png](#project-artifact/art_6a3da0a5b88d531a/62) | The cover last clicked or focused; dimmed until there is one |
| File | Close | ⌘W | built-unchecked | Shell |
| File | Reveal in Finder | | built-unchecked | A book added from a file: Finder at that file. Any other is dimmed with the reason: its text is on the desktop's server, not the drive |
| File | Get Info | ⌘I | done: [books-info.png](#project-artifact/art_a7e016210b9b9bc1/368) | A sheet: author, source, date added, what holds it. The key is typed in the window; a selected cover |
| File | Remove from Library | ⌘⌫ | done: [books-several.png](#project-artifact/art_a7e016210b9b9bc1/367) | Every selected cover |
| File | Share Book ▸ Mail | | built-unchecked | The book's page at its source, for the book in front or the cover last clicked; dimmed with neither. `books-server.test.tsx` |
| File | Share Book ▸ Messages | | built-unchecked | Same |
| File | Share Book ▸ Notes | | built-unchecked | Same; the test reads the link handed to Notes |
| File | Print… | ⌘P | built-unchecked | The page shown with its pictures, through the browser's print dialog (`printDocument`); a picture goes in the print frame as a data address, as that frame may load nothing else. Dimmed with no book open. `e2e/books-text-batch8-journey.mjs` |
| Edit | Undo | ⌘Z | built-unchecked | Highlights, their colours and notes, and bookmarks, for as long as the book's window is open (100 steps). The place is not undone |
| Edit | Redo | ⇧⌘Z | built-unchecked | Same |
| Edit | Cut | ⌘X | built-unchecked | Dimmed with the reason, as a book's text cannot be changed |
| Edit | Copy | ⌘C | done: [books-menu-edit.png](#project-artifact/art_6a3da0a5b88d531a/61) | The journey reads the words back from the clipboard |
| Edit | Paste | ⌘V | built-unchecked | Dimmed with the reason |
| Edit | Delete | | built-unchecked | Dimmed with the reason |
| Edit | Copy, Paste, Select All on a reader's field | | built-unchecked | The Note, search and Go to Page popovers stay open under a menu, and while one's field had the keyboard Edit's Cut, Copy, Paste, Delete and Select All act on it. A browser that refuses to read the clipboard says to press ⌘V. `e2e/books-depth-journey.mjs` runs Select All, Copy, Paste and Cut in the note and the search |
| Edit | Undo, Redo, Cut, Copy, Paste, Select All in the library | | built-unchecked | Stale row: `EditRows` acts on the search field that has the keyboard. Select All with no field selects the covers |
| Edit | Select All | ⌘A | done: [books-menu-edit.png](#project-artifact/art_6a3da0a5b88d531a/61) | The page shown |
| Edit | Find | ⌘F | done: [books-find.png](#project-artifact/art_6a3da0a5b88d531a/56) | In a book, the search in the book; in the library, its search field. The Edit menu follows the window in front |
| Edit | Look Up | | done: [books-look-up.png](#project-artifact/art_6a3da0a5b88d531a/59) | Dimmed unless the selection is one word or phrase |
| Edit | Add Highlight | ⌃⌘H | done: [books-highlight-by-key.png](#project-artifact/art_6a3da0a5b88d531a/50) | Yellow |
| Edit | Add Note | ⌃⌘N | done: [books-add-note-menu.png](#project-artifact/art_6a3da0a5b88d531a/55) | A note left open by a press elsewhere or a menu is kept, as Done keeps it |
| Edit | Speech ▸ Start Speaking | | built-unchecked | The text handed to the browser was checked; headless Chromium has no audio |
| Edit | Speech ▸ Stop Speaking | | built-unchecked | Same |
| Edit | Start Dictation | | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer |
| Edit | Emoji & Symbols | ⌃⌘Space | built-unchecked | Stale row: the shell's `EditFooter` opens the Character Viewer |
| View | Show/Hide Sidebar | ⌃⌘S | done: [books-hide-sidebar.png](#project-artifact/art_6a3da0a5b88d531a/51) | |
| View | Grid | | built-unchecked | The journey goes back to it and reads the covers; no screenshot of the row |
| View | List | | done: [books-list.png](#project-artifact/art_a7e016210b9b9bc1/560) | Title, Author, Date Added; a heading sorts as Sort By does, in its one direction. Kept across a reload. Authors and Categories list their books flat here |
| View | Sort By ▸ Most Recent | | done: [books-menu-view-sort.png](#project-artifact/art_6a3da0a5b88d531a/64) | |
| View | Sort By ▸ Title | | done: [books-menu-view-sort.png](#project-artifact/art_6a3da0a5b88d531a/64) | |
| View | Sort By ▸ Author | | done: [books-menu-view-sort.png](#project-artifact/art_6a3da0a5b88d531a/64) | |
| View | Sort By ▸ Manually | | done: [books-menu-view-sort.png](#project-artifact/art_6a3da0a5b88d531a/64) | The choice is saved. The screenshot shows the row only; dragging to order is the row "Reorder covers for Manually" |
| View | Single Page | ⌘1 | built-unchecked | `books.pageLayout` in the person's settings; dimmed with no book open |
| View | Two Pages | ⌘2 | built-unchecked | Same |
| View | Scroll | ⌘3 | built-unchecked | Same |
| View | Show Hidden Books | | built-unchecked | Hide Book, on a cover's menu, keeps the book in a list the library saves; this row brings them back, dimmed. Dimmed with the reason while none is hidden. Kept as `books.showHidden`. Chromium, scratch journey |
| View | Hide iCloud Books | | built-unchecked | Dimmed with the reason: the library is on the desktop's server, none of it in iCloud |
| View | Zoom In | ⌘+ | done: [books-menu-view.png](#project-artifact/art_6a3da0a5b88d531a/63) | The text of an open book; dimmed without one |
| View | Zoom Out | ⌘- | done: [books-menu-view.png](#project-artifact/art_6a3da0a5b88d531a/63) | Same |
| View | Actual Size | ⌘0 | done: [books-menu-view.png](#project-artifact/art_6a3da0a5b88d531a/63) | Same |
| View | Enter Full Screen | ⌃⌘F | built-unchecked | Shell |
| Controls | Previous Page | ← | done: [books-menu-controls.png](#project-artifact/art_6a3da0a5b88d531a/60) | |
| Controls | Next Page | → | done: [books-menu-controls.png](#project-artifact/art_6a3da0a5b88d531a/60) | |
| Controls | Add/Remove Bookmark | ⌘D | done: [books-controls-bookmark.png](#project-artifact/art_6a3da0a5b88d531a/57) | |
| Controls | Library | ⇧⌘L | done: [books-menu-controls.png](#project-artifact/art_6a3da0a5b88d531a/60) | Called Show Library |
| Controls | Go to Page… | | done: [books-go-to-page.png](#project-artifact/art_6a3da0a5b88d531a/54) | Numbers are of pages at the present size |
| Controls | Table of Contents | | done: [books-table-of-contents.png](#project-artifact/art_6a3da0a5b88d531a/65) | Opens the bar's menu. Headings may run over two lines (`CHAPTER I.` over its title, [books-contents-alice.png](#project-artifact/art_6a3da0a5b88d531a/70)) or be a numeral and a title in capitals (`I. A SCANDAL IN BOHEMIA`, [books-contents-holmes.png](#project-artifact/art_6a3da0a5b88d531a/71)). A book kept before these rules has its contents found again from its kept parts the next time it is opened |
| Controls | Previous Bookmark | | done: [books-menu-controls.png](#project-artifact/art_6a3da0a5b88d531a/60) | |
| Controls | Next Bookmark | | done: [books-menu-controls.png](#project-artifact/art_6a3da0a5b88d531a/60) | |
| Controls | Previous Chapter | | done: [books-menu-controls.png](#project-artifact/art_6a3da0a5b88d531a/60) | Dimmed with no heading before the page |
| Controls | Next Chapter | | done: [books-menu-controls.png](#project-artifact/art_6a3da0a5b88d531a/60) | Dimmed with no heading after the page |
| Controls | Play / Pause | | built-unchecked | For the audiobook window in front: Play or Pause, Previous Chapter, Next Chapter and Show Library. `e2e/preview-books-batch14-journey.mjs` chose Play, Pause and Next Chapter. With no audiobook open the row stays dimmed with its reason |
| Store | Book Store | | built-unchecked | |
| Store | Audiobook Store | | built-unchecked | LibriVox's catalogue, its shelf and its search |
| Store | Library | | built-unchecked | |
| Store | Featured | | built-unchecked | Standard Ebooks' new releases, a page of its own |
| Store | Top Charts | | built-unchecked | Project Gutenberg's most downloaded, a page of its own |
| Store | Purchased | | built-unchecked | The library's All Books: every book got is listed there |
| Store | Authors | | built-unchecked | The library's Authors row |
| Store | Sign In | | built-unchecked | Dimmed with the reason. Call: the desktop's account stands in |
| Store | View My Account | | built-unchecked | Same |
| Window | Minimize | ⌘M | built-unchecked | Shell |
| Window | Zoom | | built-unchecked | Shell |
| Window | Bring All to Front | | built-unchecked | Shell |
| Window | Library window in the list | | built-unchecked | Shell |
| Window | Book windows in the list | | built-unchecked | The app's own rows, Library and the book, above the desktop's: the shell's list comes from the manager, and the two share one managed window. The shell's own Books row stays below them. Chromium, scratch journey |
| Help | Books Help | | built-unchecked | The desktop's row opens Help Viewer on a search for Books (`desktop-menus.tsx`) |

## Library window

| Item | Status | Notes |
| --- | --- | --- |
| Sidebar toggle | built-unchecked | |
| Library segment | built-unchecked | |
| Book Store segment | built-unchecked | |
| Audiobook Store segment | built-unchecked | |
| Search | built-unchecked | |
| Row All Books | built-unchecked | |
| Row Books | built-unchecked | |
| Row Audiobooks | built-unchecked | Lists the audiobooks got from LibriVox; the journey got Alice's Adventures in Wonderland (`lv-200`) and read it back from the server and from the row |
| Row PDFs | built-unchecked | PDFs added by File > Add to Library or a drop; says how to add one while empty. Chromium, scratch journey |
| Row Authors | built-unchecked | |
| Row Categories | built-unchecked | |
| Row Want to Read | done: [books-cover-menu.png](#project-artifact/art_a7e016210b9b9bc1/366) | On the served desktop; takes dragged covers |
| Row Finished | done: [books-cover-menu.png](#project-artifact/art_a7e016210b9b9bc1/366) | Same |
| Row Series | built-unchecked | Neither source says which series a book is in, so a book belongs when its title names a volume (`, Vol. 3`, `Book 2`, `Part IV`). One heading per series, volumes in order; says so while empty. Chromium, scratch journey |
| Row My Samples | built-unchecked | The books got by Sample. Chromium, scratch journey |
| Collections | built-unchecked | |
| Add collection | built-unchecked | |
| Rename collection | done: [books-info.png](#project-artifact/art_a7e016210b9b9bc1/368) | The row's menu, or a double click; the sheet shows the name it took |
| Delete collection | built-unchecked | The row's menu, with a question; its books stay. Driven in `books-library-journey` |
| Covers grid | built-unchecked | Sources' covers |
| Sort Most Recent | built-unchecked | |
| Sort Title | built-unchecked | |
| Sort Author | built-unchecked | |
| Sort Manually | built-unchecked | Drag a cover or list row before another; kept as the order of the library's `books` |
| Open by double click | built-unchecked | |
| Open by Return | built-unchecked | |
| Open by Space | built-unchecked | |
| List view with columns | done: [books-list.png](#project-artifact/art_a7e016210b9b9bc1/560) | Selects, opens, drags and has the cover's menu |
| Progress on a cover | built-unchecked | 1 to 100 percent, kept in the library's `pages`; 100 means the last page, so a book read in View > Scroll stops at 99. Provisional look: no capture shows it |
| New badge | built-unchecked | Until the book is first opened with this build, so a book read before it says New until reopened. Provisional look |
| Library full at 500 books | built-unchecked | README |
| Library full by bytes or at 100 collections, on a new collection | done: [books-library-full-collection.png](#project-artifact/art_6a3da0a5b88d531a/58) | Refused in the window with nothing sent. A change of Sort By at the very limit (one byte more) is not checked; the server's refusal is told |

## Book Store

| Item | Status | Notes |
| --- | --- | --- |
| Popular at Project Gutenberg | built-unchecked | |
| New at Standard Ebooks | built-unchecked | |
| Search Project Gutenberg | built-unchecked | |
| Search Standard Ebooks | built-unchecked | |
| Get | built-unchecked | |
| Read a book already got | built-unchecked | |
| More Books | built-unchecked | |
| Try Again after a failure | built-unchecked | |
| Book detail page | built-unchecked | A cover opens it: the source's summary, Get or Read, Share, More by the author |
| Sample | built-unchecked | On a book's page and a shelf item's menu. Neither source has samples, so it is the start of the book: a tenth of the text, at least 20,000 characters. The cover says Sample and the book's end offers Get Book. Chromium, scratch journey; the end of a sample by unit test |
| Show a book's rating | built-unchecked | The average of this desktop's ratings, on the book's page, which says neither source has any. Chromium, scratch journey |
| Rate a book | built-unchecked | One rating per person, in `/api/books/reviews/<book>`, the space everyone shares. Chromium, scratch journey |
| Read reviews | built-unchecked | What others of this desktop wrote, without names. Unit test for others' reviews; the journey has one reviewer |
| Write a review | built-unchecked | With a rating; can be updated or removed. Forgetting the library does not remove it. Chromium, scratch journey for writing; Remove and Update are not driven |
| Price and Buy | built-unchecked | Every book says Free and Get stands in for Buy: both sources are free, so nothing is sold |
| Top Charts shelf | built-unchecked | Project Gutenberg's most downloaded; there is no chart of this store's own |
| Featured shelf | built-unchecked | Standard Ebooks' new releases; nobody here chooses features |
| Genre browse | built-unchecked | Twelve genres on the store's home and Store > Genres: a subject at Project Gutenberg (`s.<genre>`), a search at Standard Ebooks. Chromium, scratch journey, real listings |
| Author page | built-unchecked | The author's name on a book's page: a search of both sources for that name, so a namesake can appear |
| Audiobook Store shelves | built-unchecked | One shelf, LibriVox's catalogue from its start, since its API has no order of popularity; a page of 24, with more on request. The field searches the start of a title and an author's whole last name, which is all the API can search: "carroll" and "alice" found `lv-200` in the journey, on real LibriVox. A book's page lists its chapters and lengths. A cover pressed among search results now opens the page in either store, and a new search leaves it. Some covers at the Internet Archive answered HTTP 500 on the run; such a book shows a drawn cover with its title and author |

## Reader window

| Item | Status | Notes |
| --- | --- | --- |
| Library button | built-unchecked | |
| Table of Contents button | built-unchecked | |
| Notes button | built-unchecked | |
| Notes list | built-unchecked | |
| Search button | built-unchecked | |
| Search results list | built-unchecked | |
| Bookmarks button | built-unchecked | |
| Real text paged to the window | built-unchecked | Numbers change with size |
| Previous page button | built-unchecked | |
| Next page button | built-unchecked | |
| Highlight colours | built-unchecked | Pointer only |
| Add Note to a highlight | built-unchecked | |
| Remove Highlight | built-unchecked | |
| Highlight from the keyboard | built-unchecked | Shift and an arrow select from the top of the page (Selection.modify), Option by the word, then ⌃⌘H, ⌃⌘N or the Edit menu's rows. Chromium, scratch journey with the menu row; ⌃⌘H does not match off Apple platforms and was not pressed there |
| Study Cards | built-unchecked | In the Notes panel: each highlight's words, its note on the back. Chromium, scratch journey |
| Italics of a store book | built-unchecked | Project Gutenberg sets words off with underscores (`_very_`). The reader shows them in italics in every view and prints them so; the underscores stay in the page, hidden, because a place, a bookmark and a highlight are offsets that count them, and the hidden copy the page is measured in has the same markup. An emphasis a page break cuts in two is finished on both pages. Bookmarks, highlights, speech and printed lines take the words without the marks, and Search finds a phrase across them, at the place the offsets count. `books-text.test.ts`, `books-pictures.test.tsx`, `e2e/books-journey.mjs` |
| Pictures of the source: an EPUB | built-unchecked | Read from the file on the drive, nothing fetched: `img`, an SVG's `image` and a picture named by the reading order, in Single Page, Two Pages and Scroll. A picture is a position between two characters, taking none of the text, so a book's places, bookmarks, highlights and search results mean what they did. A picture alone at its offset may fill the page but for two lines of the words after it: a page starts at a text offset and ends past it, so a plate with no words on its page at all would need a place no offset names. Several at one offset share 70% of the height. Print takes the page's pictures too. An EPUB of pictures alone opens, its text one line for each picture ("Picture 1"), each picture standing before its line, so each has a place of its own, kept across a reload. `e2e/books-pictures-batch6-journey.mjs`, `e2e/books-text-batch8-journey.mjs`, `books-pictures.test.tsx` |
| Pictures of the source: a store book | built-unchecked | `GET /api/books/pictures/<book>` reads the book's HTML edition in rounds and places each `img` before the paragraph its following words are found in, compared by letters and digits, and before an "[Illustration]" paragraph where the text has one. The text and its offsets do not change, and that word stays on the page under its picture. `/pictures/<book>/<n>` passes one file through from the source each time. Real Project Gutenberg in Chromium, `e2e/media-rows-batch11-journey.mjs`: pg-1400 lists 16 pictures in the text's order, and the reader draws one at its own offset, the page's words exactly the book's; pg-35149's cover (2,562,901 bytes) comes through ingress byte for byte. `books-pictures.test.tsx`, `pictures.rs`. Limits: a file named more than once is left out (Gutenberg's "enlarge" icon, also a repeated ornament). A picture whose following words are not in the kept text is left out: pg-65492's cover, followed by a note only its EPUB has. A book whose cover stands first opens on that cover and at most two lines. Past 4 MiB, or past 5.2 s of fetching, the route answers 413 by its code; no listed picture that large was found, so that was not run. The largest reply run is 2.56 MB. Standard Ebooks' path is unit-tested for addresses and not run: the one edition tried answered 451 |
| Two-page spread | built-unchecked | Two columns of the page, measured across both. Census `books.reader.two-pages` in Chromium |
| Scrolling view | built-unchecked | More text arrives at the end and, by code and no browser run, the start; the place follows the top of the view when scrolling rests. Census `books.reader.scroll` in Chromium |
| Appearance button | done: [books-appearance-popover.png](#project-artifact/art_6a3da0a5b88d531a/52) | Aa in the bar |
| Font family | done: [books-appearance-popover.png](#project-artifact/art_6a3da0a5b88d531a/52) | Original, Georgia, Palatino, Times New Roman, San Francisco; each falls back where the system lacks it. Apple's own book faces are not included |
| Font size | done: [books-appearance-popover.png](#project-artifact/art_6a3da0a5b88d531a/52) | Eight sizes, 13 to 32 points |
| Theme White | done: [books-theme-white.png](#project-artifact/art_6a3da0a5b88d531a/69) | |
| Theme Sepia | done: [books-theme-sepia.png](#project-artifact/art_6a3da0a5b88d531a/68) | |
| Theme Gray | done: [books-theme-gray.png](#project-artifact/art_6a3da0a5b88d531a/66) | |
| Theme Night | done: [books-theme-night.png](#project-artifact/art_6a3da0a5b88d531a/67) | |
| Auto-Night | done: [books-preferences.png](#project-artifact/art_a7e016210b9b9bc1/562) | In Preferences: off, a page with no theme chosen stays white |
| Justification | done: [books-preferences.png](#project-artifact/art_a7e016210b9b9bc1/562) | In Preferences |
| Search with Google from a selection | built-unchecked | Edit menu and the page's menu; opens in Safari |
| Search Wikipedia from a selection | built-unchecked | Same |
| Move the window on its own | built-unchecked | By its bar, within the desktop window that holds both: it still goes with the library when that moves. The place is not kept across a reload. Chromium, scratch journey |
| Resize the window on its own | built-unchecked | By the left, right and bottom edges and corners, down to 420 by 420 points; the top is its bar. The size is not kept across a reload. Chromium, scratch journey with the corner |
| Full-screen book | built-unchecked | The green button acts on the one desktop window, and the book fills it while it is in front. Chromium, scratch journey |
| Audiobook player | built-unchecked | A book window with one audio element, playing each chapter straight from `https://archive.org/download/`, with chapters listed beside it. The place is kept in `/api/books/reading/lv-<n>` as seconds across the whole recording. Real LibriVox and Internet Archive in Chromium, `e2e/preview-books-batch14-journey.mjs`: the sound played, Chapter 3 from its own file, the server kept 1406 against 1406.17 by the player, and after a reload the player stood at Chapter 3, 31 s, paused. The same journey runs in WebKit and in Firefox. Firefox with no audio output answers any format, a generated WAV too, with `error` "Failed to decode media" just after `playing`, so the player says the chapter failed; with PulseAudio's null sink, which the journey starts where the machine has no sound server, the same MP3 plays with no error. A chapter whose bytes no decoder takes (the journey's stand-in for one) says "The Internet Archive did not give this chapter" in the window and offers Play. An error that arrives while the sound plays stops the player, as real Books stops and says it could not play: the element is paused, so Play asks for the sound again, and a place not yet reached in a chapter that never loaded is kept (`books-audiobook-player.test.tsx`, jsdom with its media element stubbed; not yet run in a real browser). Limit: chapter lengths are LibriVox's, and one can be wrong (`lv-200`'s Chapter 9 lists 15 s): in such a chapter the slider and times follow the listed length, and a place kept past it reopens in the next chapter. No sleep timer or playback speed |
| PDF view | built-unchecked | Pages drawn by pdf.js from the drive, contents, bookmarks, place. Absent: selecting, highlights and search. Chromium, scratch journey with a built two-page PDF |
| EPUB import | built-unchecked | Rebuilt with the README's two fixes: an entry goes to the inflater in pieces, and a document is read in the encoding it declares, refused by name if the browser has none. Its pictures show in the reader (Pictures of the source: an EPUB). Chromium, scratch journey with Gutenberg's Alice |

## Context menus

| Where | Item | Status |
| --- | --- | --- |
| Cover | Open | built-unchecked |
| Cover | Remove from Library | built-unchecked |
| Cover | Add to Collection ▸ a collection | built-unchecked |
| Cover | Mark as Finished | done: [books-cover-menu.png](#project-artifact/art_a7e016210b9b9bc1/366) |
| Cover | Add to Want to Read | done: [books-cover-menu.png](#project-artifact/art_a7e016210b9b9bc1/366) |
| Cover | Hide Book | built-unchecked: Unhide Book for one hidden, in a scratch journey |
| Cover | Get Info | done: [books-info.png](#project-artifact/art_a7e016210b9b9bc1/368) |
| Cover | Share | built-unchecked: Share Book, the cover the menu opened on |
| Cover | Reveal in Finder | built-unchecked: for a book added from a file, its file; otherwise dimmed with the reason |
| Collection | Rename | built-unchecked |
| Collection | Delete | built-unchecked |
| Collection | New Collection | built-unchecked |
| Page selection | Highlight | done: [books-page-menu.png](#project-artifact/art_a7e016210b9b9bc1/561) |
| Page selection | Add Note | built-unchecked: the row is in the screenshot, the journey does not choose it |
| Page selection | Look Up | built-unchecked: same |
| Page selection | Search | done: [books-page-menu.png](#project-artifact/art_a7e016210b9b9bc1/561) |
| Page selection | Copy | built-unchecked: same as Add Note |
| Page selection | Speech ▸ Start Speaking | built-unchecked: headless Chromium has no audio |
| Page selection | Speech ▸ Stop Speaking | built-unchecked: same |
| Page selection | Share | built-unchecked: the book's link, titled with the quote |
| Store item | Get | built-unchecked: Read for a book already got |
| Store item | Share | built-unchecked |
| Store item | Copy Link | built-unchecked: the test reads the clipboard call |

## Keys outside the menus

| Key | Status | Notes |
| --- | --- | --- |
| Right Arrow turns on | built-unchecked | From anywhere in the reader |
| Page Down turns on | built-unchecked | Same |
| Left Arrow turns back | built-unchecked | Same |
| Page Up turns back | built-unchecked | Same |
| Escape clears the search | built-unchecked | |
| Arrows in the sidebar | built-unchecked | |
| Type-select in the sidebar | built-unchecked | |

## Drag and drop, multi-selection

| Item | Status | Notes |
| --- | --- | --- |
| Drag a book to a collection | built-unchecked | A row of the sidebar takes it |
| Drag several books to a collection | done: [books-several.png](#project-artifact/art_a7e016210b9b9bc1/367) | |
| Reorder covers for Manually | built-unchecked | Several selected move together. In Authors and Categories, which group the covers, a drop is not taken |
| Drop an EPUB from Finder | built-unchecked | A file of the drive stays where it is; one from the computer is kept in Documents/Books. Unit test through the desktop's drop target; no browser run |
| Drop a PDF from Finder | built-unchecked | Same code; the unit test drops EPUBs |
| Shift-click a range of covers | done: [books-several.png](#project-artifact/art_a7e016210b9b9bc1/367) | From the last cover clicked without Shift |
| Command-click several covers | done: [books-several.png](#project-artifact/art_a7e016210b9b9bc1/367) | ⌘A selects all; the Edit menu's Select All row does too (that row built-unchecked) |
| Remove several | done: [books-several.png](#project-artifact/art_a7e016210b9b9bc1/367) | |

## Saved state

| Item | Status | Notes |
| --- | --- | --- |
| Library | built-unchecked | `/api/books/library` |
| Collections | built-unchecked | |
| Sort | built-unchecked | |
| Place in a book | built-unchecked | `/api/books/reading/<book>` |
| Bookmarks | built-unchecked | |
| Highlights | built-unchecked | |
| Notes on highlights | built-unchecked | |
| Book texts kept | built-unchecked | Limits `8f57a4f6`, `c4dff9be` |
| Open book across a reload | built-unchecked | Comes back in front; the sandbox could not reach Gutenberg, so its text was not seen |
| Selected row | done: [books-info.png](#project-artifact/art_a7e016210b9b9bc1/368) | Also the Library, store segment and sidebar shown |
| Theme | done: [books-appearance-after-reload.png](#project-artifact/art_6a3da0a5b88d531a/53) | `books.theme` in the person's settings, read back after a reload |
| Text size | done: [books-appearance-after-reload.png](#project-artifact/art_6a3da0a5b88d531a/53) | `books.textSize` |
| Font family | done: [books-appearance-after-reload.png](#project-artifact/art_6a3da0a5b88d531a/53) | `books.textFace` |
| View | done: [books-list.png](#project-artifact/art_a7e016210b9b9bc1/560) | `books.layout` |

## Cross-app

| Item | Status | Notes |
| --- | --- | --- |
| Storage Management offers the library for forgetting | built-unchecked | README |
| Finder opens an EPUB here | built-unchecked | The descriptor's `opens`: the book joins the library from where it is on the drive and opens. A PDF stays Preview's, with Books under Open With. Unit test through `requestOpenFile`; no browser run |
| Look Up by key from a page | built-unchecked | |
| Look Up from a menu | done: [books-look-up.png](#project-artifact/art_6a3da0a5b88d531a/59) | |
| Share a quote to Notes | built-unchecked | The quote goes as the title of the book's link: Notes makes a note of it, and does not receive it as body text |
| Share a quote to Mail | built-unchecked | Same; the test reads the link handed to Mail |
| Share a quote to Messages | built-unchecked | Same |
| Spotlight finds books | built-unchecked | Library books by title and author. Return opens Books. `e2e/spotlight-people-journey.mjs` |

## Open work ledger

- **Repeated chapter titles, arrow keys, surrogate pairs at page breaks, size limits:** done on main; built-unchecked above where shown.
- **README lines 838 and 916 still say every book is kept for good.** Open. Build item 13.
- **Books stored before `8f57a4f6` and never reopened stay outside the cache count.** Open, `text.rs:1227, 1312`. Build item 13.
- **EPUB import:** rebuilt from an earlier version with the README's two fixes; the README's Books limits still say it was cut.

## Calls made

- Audiobooks: LibriVox, the public-domain source. The server reads only its catalogue API, through the egress destination `https://librivox.org/api/feed/audiobooks` of `books`, and keeps a book's chapters for a week. The sound and covers go from the Internet Archive straight to the browser, so no audio passes through the server.
- A store account is not built: the desktop's account stands in.
- Ratings and reviews have no public source. They are kept per desktop, without names, and the window says they are this desktop's own.

## Build items, most used first

1. **Reading appearance.** Font family, size, four themes, saved per account. Built; Auto-Night is left out: with no theme chosen the page follows the desktop's appearance, and there is no way back to that once one is chosen.
2. **Menus with keys.** File, Edit, View, Controls complete. Built except the rows that stay missing above, which need other build items (EPUB, Share, Print, Get Info, view modes).
3. **Collections.** Rename, Delete, drag books, several; multi-selection; cover context menu.
4. **Want to Read, Finished, progress.**
5. **View modes.** Two pages, Scroll, list view, Manually by drag.
6. **EPUB import.** Add to Library, drop from Finder, stored on the drive.
7. **Keyboard highlights and context menu.**
8. **Reader window.** A window of the desktop: move, resize, Window list, full screen; reopen across a reload.
9. **Pictures of the source** through egress, for a store book; an EPUB's own are built.
10. **Store depth.** Book detail, lists, scopes, the desktop's own ratings and reviews.
11. **Export and share.** Print, Share, Get Info, Reveal, quote into Notes.
12. **PDF.** Open from the drive in a Books page view.
13. **Ledger fixes.** README lines; count older books. Spotlight `books` kind with the Spotlight worker.
14. **Help.** Help opens Help Viewer; `books.mdx` says what the served app does.

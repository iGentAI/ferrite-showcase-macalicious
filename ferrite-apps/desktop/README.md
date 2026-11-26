# macalicious-desktop: the desktop as a Ferrite application

This folder is a [Ferrite](https://ferrite.cloud) application
that serves the Macalicious desktop page (`docs/desktop`) and gives each demo app
a place for its server half. It is one constrained Rust crate with one
dependency, `ferrite-app`, and it has three routes:

| Route | Kind | What answers |
| --- | --- | --- |
| `/` | `content`, from the `site` blob | the desktop's built files, which the app publishes into the blob at boot |
| `/api/` | `api`, through the `requests` queue | the session endpoint, the app registry, and one module per app under `/api/<app>/` |
| `/health` | `api` | liveness |

The hosted desktop is available at [macalicious.ferrite.run](https://macalicious.ferrite.run/).
Chess lazily loads Reckless in a browser worker when opened; the build and port
details are in [tools/reckless-wasm/README.md](../../tools/reckless-wasm/README.md).

## Set up

You need:

- Rust 1.89 or newer;
- a checkout of the public Ferrite SDK
  ([iGentAI/ferrite-sdk](https://github.com/iGentAI/ferrite-sdk)) beside this
  repository, at `../ferrite-sdk` relative to the repository root. `Cargo.toml`
  takes `ferrite-app` and the test harness `ferrite-app-test` from it by path;
- the `ferrite` CLI: `curl -fsSL https://downloads.ferrite.cloud/install.sh | sh`;
- the repository's npm dependencies (`npm install` in the repository root), for
  the desktop build and Playwright.

The path dependency names the SDK and does not copy it. When you run
`ferrite deploy`, the attested build replaces it with the platform's own
vetted crate.

## Build, test and run

Run every command from this folder (`ferrite-apps/desktop`).

```bash
node scripts/pack-site.mjs   # build docs/desktop and pack it into src/site_assets{.rs,/}
cargo test --features local-egress # complete local suite, including denied-egress tests
ferrite check                # admission gate, spec statics, cargo check
ferrite check --target upstream
ferrite test
ferrite dev --port 8787      # http://127.0.0.1:8787/
```

Before deployment, run the complete local suite above (or `npm run desktop:test`
from the repository root), then the shared suite on the hosted SDK with
`ferrite test --remote`. See [test profiles](tests/README.md) for the exact
outbound-fixture distinction.

After `ferrite deploy` reports registration, wait for the exact prepared site to
finish publishing before browser acceptance:

```bash
node scripts/wait-for-site.mjs https://macalicious.ferrite.run
```

This checks the public marker against `src/site_assets.rs`, retries publication
lag for at most two minutes, and fails on a stale or unavailable build. Registration
alone does not prove that the public assets are ready.

`ferrite dev` denies egress by default. Network Utility's Lookup asks a public
DNS-over-HTTPS resolver through the application's one declared egress, so run
`ferrite dev --port 8787 --egress allow` to see real answers; under the default
the lookup route answers 502 and the window says the lookup failed.

Run `pack-site.mjs` again after any change to the desktop, a demo or the
library. Until you do, the app keeps serving the build it was compiled with.
`--from <dir>` packs a build that already exists, such as the output of
`npx vite build --config docs/desktop/vite.config.ts --outDir <dir>`.

For a hosted deployment, use `node scripts/pack-site.mjs --compact-assets`.
This keeps all files and apps, limits generated WebP images to 1280 pixels on
either axis, and encodes them at quality 60 when that reduces their size. Source
artwork stays unchanged. Changed assets, their stylesheets, and scripts receive
new content-derived names, and the entry document uses those names. This brings
the packed submission below the platform's 16 MiB record limit; the original
21 MB submission is refused before a build starts. After packing, deploy once
with the released CLI and retain its `.ferrite/deployments` journal.

With `ferrite dev` running, the browser journey is:

```bash
PLAYWRIGHT_BROWSERS_PATH=<browsers> node e2e/desktop-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]
```

The journey opens the desktop, checks that it came from the blob the app
published, and launches Calculator from the Dock. It types 12 + 3 = and reads
15 from the display, then records the result on the session's paper tape
through `/api/calculator/tape`. It reloads the page and checks that the session
survived. Finally it opens a second browser context and checks that it gets a
different session with an empty tape. The script exits 0 only when every step
passed and neither page logged a console error, a page error or a failed
request. It writes `desktop.png` and `calculator.png` to `--out`, which
defaults to `e2e/output/` (ignored by git).

## How the desktop's files reach Ferrite storage

A Ferrite application has no build step and cannot read files when it is
compiled: the admission gate refuses `build.rs`, `include_bytes!` and
`include_str!` of anything that is not submitted source. Under `ferrite dev`,
Forge copies a `site/` folder into the content blob, but only for the local
loop. A deployment embeds `site/index.html` alone. So the built files reach the
blob as Rust source that the app writes into its blob when it starts.

1. `scripts/pack-site.mjs` runs the Vite build of `docs/desktop` into
   `dist/site/` and writes `src/site_assets.rs` with its parts in
   `src/site_assets/`. The parts hold one base64 string per built file, at
   most 14 MiB of source each, because a deploy refuses any source file over
   its 16 MiB record limit. A file of a compressible type (scripts, styles,
   HTML, SVG, JSON, WebAssembly, source maps, text) also gets a brotli and a
   gzip copy, each kept only when it is at least a tenth smaller. No file may
   be over 3.5 MiB as it is, since the app answers each in one api reply
   (below). `src/site_assets.rs` lists the files in order, plus a build id: the
   SHA-256 of every path, its bytes and its copies.
2. At boot, `site::seed` reads `ferrite-site.json` from the `site` blob. When
   that marker names this build and the live `index.html` is byte for byte
   this build's page, the upload is skipped, so restarts and extra instances
   cost two reads. Otherwise it deletes the marker, writes every compressed
   copy (under `<path>.br` and `<path>.gz`), then every asset, then
   `index.html` (the step that makes the build live), then the marker. A
   process that dies partway leaves no marker, and the next boot publishes
   again. Every file except `index.html` must carry a content hash in its name
   (`name-<8 characters>.ext`, as Vite writes them); `pack-site.mjs` refuses a
   build that breaks this rule, so assets of different builds never overwrite
   each other.

   One limit remains: during a rolling deploy, an old instance that restarts
   after the new one published puts the old `index.html` back. The next boot
   of a new instance repairs it. Old assets are never deleted, so a page of
   either build loads completely.
3. The app serves the blob itself (`src/site_serve.rs`): `ferrite.json` routes
   `/` to its api face with `accept-encoding` and `if-none-match` forwarded,
   so every path that is not `/api/`, `/health` or `/favicon.ico` reaches it.
   Each file goes out in the best coding the browser takes among the copies
   the build made (brotli, then gzip, then as it is; the browser's `q` values
   first, and never one it gives `q=0`), with `Vary: Accept-Encoding`. A
   hashed name is cached with `public, max-age=31536000, immutable`;
   `index.html` with `no-cache`. Every reply has an `ETag`, and a matching
   `If-None-Match` gets a 304. While a build is still being published, the app
   answers its own files from the build itself. `/ferrite-site.json` shows
   which build is live.

   The gateway prefers any api route that matches over every content route,
   so with the api at `/` there is no content route left, and every reply
   must fit in about 4 MiB. The page's main script is 5.5 MB as it is, 1.6 MB
   in gzip and 1.2 MB in brotli, so it is sent only compressed: a browser that
   accepts neither gets a 406, and every browser accepts gzip. Splitting the
   script instead (Vite's `codeSplitting`, tried on 15 November) reordered the
   page's stylesheet, so demo rules that override a component's at equal
   specificity lost, and the desktop picture shrank to a third of the screen.
   Binary files cannot be compressed further, so the chess network ships as
   sixteen parts of 4 MiB (`tools/reckless-wasm/build.mjs`) and the scene
   model as two halves the page joins (`demos/photos/photos-scenes.ts`).

The `site` workload allows 512 read and 128 write request units per second at
64 KiB per unit. Its ten-second burst accommodates two replicas publishing the
roughly 12 MiB packed site at startup. A smaller publication budget can make
seeding repeatedly stop before the index is written. Verify `/index.html` and
the build marker; a successful `/health` response alone does not prove the
desktop is published.

This folder deliberately has no `site/` folder, so under `ferrite dev` the
page comes only from what the app published, the same path a deployment
takes.

With `--compact-assets`, the build is 335 files and 65.3 MiB, plus 2.5 MiB of
brotli and 3.0 MiB of gzip copies (15 November 2026). Most of it is the chess
network (60 MiB in sixteen parts, already compressed) and WebP pictures. The
largest file is a chess network part of 3.3 MB. The generated module is about
95 MB of Rust source. It is build output and not committed:
`src/site_assets.rs` and `src/site_assets/` are listed in `.gitignore`, and a
fresh checkout runs `pack-site.mjs` before its first `cargo build`.

## Sessions

Every `/api/` request has a per-browser session (`src/session.rs`). The first
request without one gets a `mac_session` cookie: 32 random bytes, `HttpOnly`,
`SameSite=Lax`, `Path=/`, kept for 400 days, and `Secure` unless the browser
shows the request goes to a plain-HTTP loopback page, as `ferrite dev` serves
the app. The server's session
record expires after the same 400 days; data a module keeps for the session
does not expire on its own, and a module that needs a limit sets one with
`put_expiring`. WebKit does not keep a `Secure` cookie set over plain HTTP,
even on `localhost`, so the cookie leaves `Secure` out only when the browser
marks the request `Sec-Fetch-Site: same-origin` and the page that sent it
(its `Origin`, or its `Referer` when there is no `Origin`) is plain HTTP on
`127.0.0.1`, `localhost` or `[::1]`. A missing `Sec-Fetch-Site`, any other
value, an opaque (`null`) origin or no page address keeps `Secure`. The
`/api/` route forwards `Origin` and `Referer` for that. The server stores only a
record keyed by the token's SHA-256, the session id. That id is what replies
show and what keys storage. A cookie with no record behind it, whether forged
or left over from wiped state, is replaced with a new session, never adopted.

Known limit, accepted for a demo: if the gateway redelivers a first request
that had no cookie (its reply was lost), the redelivery creates a second
session. Anything the first delivery wrote stays in the first session, which
no browser holds.

`GET /api/session` answers `{"session": "<id>", "created_ms": …, "new": …}`.
A browser writing from another site is refused with 403 before any module
runs, because its `sec-fetch-site` header names a different site. Such a
request would not carry the session cookie anyway. There is no `Origin`
check: upstream's SDK does not tell the app which host the request was sent
to, so the guard is `sec-fetch-site` plus the `SameSite=Lax` cookie.

These sessions are anonymous: they separate browsers, not people. A
deployment with users of its own adds sign-in through the `auth` package
(`ferrite add auth`) and keys module storage by that identity instead.

## Adding an app module

An app's server half is one `AppModule` (`src/module.rs`) in its own folder,
`src/apps/<name>/`, where `<name>` matches its demo folder, `demos/<name>`.
The router hands it every request under `/api/<name>/`. To add one:

1. Create `src/apps/<name>/mod.rs` exporting `pub const MODULE: AppModule`.
2. In `src/apps/mod.rs`, add `mod <name>;` and `<name>::MODULE,` to `MODULES`,
   one line each, in alphabetical order.

Nothing else in the core changes. A test in `src/apps/mod.rs` checks that every
name is unique, URL-safe and not one of the router's own names (`session`,
`apps`). `GET /api/apps` lists the registered modules. Here is the shape of a
module, cut down from `src/apps/calculator/mod.rs`:

```rust
use ferrite_app::serde_json;

use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule { name: "notes", title: "Notes", handle };

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    match (cx.request.method, cx.request.path) {
        // GET /api/notes/count: this browser's own counter.
        ("GET", "/count") => match cx.storage.user().get_json::<u64>("count").await {
            Ok(n) => Response::json(200, &serde_json::json!({ "count": n.unwrap_or(0) })),
            Err(e) => Response::error(503, &e.to_string()),
        },
        _ => Response::not_found(),
    }
}
```

The `ApiCtx` a handler receives carries:

| Field | What it is |
| --- | --- |
| `request` | `method`; `path` below `/api/<name>`, always starting with `/`; `query`; `body`; `idempotency_key`, the browser's own `idempotency-key` header or `None` (see the rules below); `header(name)`; `query_param(name)`; `json::<T>()`, which returns a ready 400 response on bad input |
| `session` | the browser's `Session`, with `id`, `created_ms` and `is_new` |
| `storage` | the module's keys in the `data` store. `user()` is this session's space, `apps/<name>/users/<session>/`. `shared()` is one space for every session, `apps/<name>/shared/`. Each space has `get`, `put`, `put_expiring`, `delete`, `get_versioned`, `put_if_version`, `create_expiring` (write only if absent), `get_json`, `put_json` and `list(prefix, limit)` |
| `ctx` | the application's `AppContext`, for anything else the spec declares |
| `now_ms` | the platform clock; an app has no other clock |

Rules for modules:

- Reply with `Response`: `Response::json`, `Response::error`,
  `Response::not_found`, or `Response::new(...).add_header(...)`. API replies
  are sent with `cache-control: no-store` unless the module sets its own
  `cache-control`.
- Do not set cookies. The session owns the one `set-cookie` header a reply
  may carry, and the router drops any other.
- Deduplicate only by the browser's own key. A demo that wants a resent
  write recognised sends an `idempotency-key` header with a fresh random
  value per write, such as `crypto.randomUUID()`. The `/api/` route forwards
  it, and the module sees it as `request.idempotency_key` (1 to 128 visible
  ASCII characters, otherwise `None`). Without the header, a write is simply
  processed. There is deliberately no fallback to the gateway's correlation
  id or any other server counter, which can repeat after a restart. Keep
  markers in the session's own space (`storage.user()`) and claim them with
  `create_expiring`, the store's atomic create-if-absent, as the Calculator's
  tape does.
- Bodies are capped at 256 KiB per request and replies at about 4 MiB. Larger
  uploads go in chunks.
- A module that needs a binding the spec does not declare yet, such as a
  stream route, topics or a second blob, adds it to `ferrite.json` and reaches
  it through `cx.ctx`. Keep API routes under `/api/`: the api route at `/`
  serves the desktop's files (`src/site_serve.rs`), and the gateway matches
  `api` and `stream` routes before `content` routes, so a content route added
  now would never be reached.
- Run `ferrite check --target upstream`. It reports any SDK name that exists
  only in the local twin, which is the code a hosted build would refuse.

A demo calls its module through `sessionFetch` and `withDeadline`
(`demos/desktop/desktop-server.ts`), never plain `fetch`: `sessionFetch` sends
the page's first `/api/` request alone so a fresh browser gets one session,
and `withDeadline` aborts a request that hangs. For example, the Calculator
tape reads `/api/calculator/tape` that way (`demos/calculator/calculator-tape.ts`).
The same demo also runs on the static documentation site, which has no
`/api/`, so it must keep working when that request fails.

`scripts/pack-site.mjs` builds the desktop with `VITE_MACALICIOUS_API=1` in the
environment. A demo calls its module only when
`import.meta.env.VITE_MACALICIOUS_API === "1"`. The documentation builds leave
the flag unset, so their pages never request `/api/` and never log the 404
that request would get. Under the flag, a demo still keeps working when a
request fails. A `--from <dir>` build has to set the flag itself.

A demo that keeps one whole document (Calendar's events, Contacts' cards,
System Preferences' settings) uses `src/apps/document.rs` on the server and
`serverDocument` / `useServerState` from `demos/desktop/desktop-server.ts` in
the browser. The server owns the revision: a `GET` answers `rev` with the
document, a `PUT` sends back the `rev` it is based on, and the server stores it
only if that is still the stored revision, then answers the next one. Any other
base gets 409 with the current document and revision. The browser keeps one
channel per document for the whole page, shared by every window, and logs a
save that fails.

A 409 never sends the page's copy over the server's. The channel keeps the
document as it last read or stored it, and merges the person's unsaved change
onto the copy the 409 carries (`demos/desktop/document-merge.ts`): whatever the
change left alone takes the server's newer value, records merge field by field,
and lists of items with an `id` (or the keys a demo names) and lists of distinct
strings or numbers merge item by item. An item's own lists of members (a page's
marks, a collection's books) merge in turn, while its other fields go together
and are the person's when both sides changed them. A removal on either side
wins over an edit on the other, so a document, field or item forgotten or
deleted in another browser never comes back from a window that had not seen it
go. Every window is shown the result, which is saved on the new revision; when
nothing of the change is left, nothing is sent and the window is told its
change was not kept. A refusal that carries the page's own earlier save, stored
though its answer never came, counts as that save stored. A merge the server
refuses as it is (400, 413, 422) gives way to the server's copy. The same merge
applies when a save that failed is saved again on the next load, and to a
caller that watches no window (System Preferences' settings, Music's playback),
whose next change is applied to whatever the page has read since.

Some documents merge in a way of their own. Keychain Access keeps the server's
keychain, and the window whose change was refused says what was not saved and
shows the saved keychain: Use Saved Version keeps it, Keep My Version saves its
own over it (an encrypted keychain is replaced whole, never merged). Music's
playback keeps the page's copy (the player's queue, song and place go together)
unless it was forgotten elsewhere since the page read it: stored as nothing where
the page last saw a playback, or stored under another epoch (`epoch`, a random
name a playback is given when it is first saved after being empty or forgotten)
than the one the page read. The page then takes the forget up: only the song
loaded stays, at its place, and Up Next, Recently Played and the play counts
stay forgotten; that is saved, the page goes on saving, and its window says the
playback was forgotten. A page that found the playback empty and named it
itself reads it back once its save has landed, so a forget made after that is
taken up too. A change that meets the library forgotten elsewhere is not kept:
the window shows the forgotten library and says so. System Preferences applies a
change made after a forget to nothing, so the setting changed is kept and no
other comes back. QuickTime's recents are named by file and held to the
server's 20, Preview's marks by page and id, and Books' readings by bookmark
place and highlight id, with the bookmarks in order.

Notes, Reminders and Stickies use `demos/desktop/synced-document.ts` with the
same server rule, and a simpler client: one save in flight per document, never
aborted before its deadline, and nothing sent as the page is hidden. Every read
and save settles within `REQUEST_DEADLINE_MS` (15 seconds), so a save the
server never answers neither stops the document saving nor holds back, as a
write under way, the loading of another browser's change. A save that meets a
network error or its deadline before any answer is resent once, unchanged. By
default, on a 409 or an unknown outcome the window drops its unsaved change,
reads the stored document, and every window of that app shows it, unless the
stored document is the page's own save, stored though its answer never came:
the changes made meanwhile are then kept and saved on it. Reminders then makes
its own change again on the stored reminders, field by field (see Reminders).
Notes and Stickies opt in to more (`refreshOnRemoteChange`, `merge`). A change
saved in another window or browser reaches their open windows, which keep the
note shown, the keyboard and the caret. A change still being typed when another
window saved first is merged onto the stored document record by record and
saved: a note's text, formats and dates go together, while its folder, or a
sticky's colour, frame and states, are each merged on their own. After four
refused merges in a row the change stays unsaved until the next edit. Where both
windows changed the same note's text, the version saved first stays, and the
window whose change arrived second says so. Notes keeps that window's version as
a note of its own beside it, titled "<title> (conflicted copy)", and shows a
banner with Show My Version, Keep My Version (the two swap) and OK. Stickies
shows "Changed in another window." at the foot of the note, with Keep Mine and
OK. TextEdit keeps the keyboard and the caret when another window's change
replaces its document; when both windows changed its text at once, the window
whose save was refused keeps its own version and says so above the document,
with Keep Mine (its version saved over the other) and OK. The limits: Stickies
and TextEdit hold the window's own version in that page only until the person
chooses, so reloading or closing the page first
keeps the version saved first; a conflict over anything but a note's text (a
sticky's colour, a note's folder) keeps the version saved first without a
notice; and any other change made to TextEdit's draft in both windows at once (a
rename while the other window types) is merged by the shared `document-merge.ts`,
where this window's value wins a field both changed.
`e2e/editors-conflict-journey.mjs` checks the notices.

Notes, TextEdit and Stickies fill the desktop's Edit menu: Undo, Redo, Cut, Copy, Paste and
Select All act on the text the window last had the keyboard in, which takes the keyboard back.
Paste reads the clipboard through `navigator.clipboard`, which a browser may refuse to a menu
(WebKit, and Chromium unless the person grants clipboard access): the menu then dims Paste and
says that ⌘V (Ctrl+V) still pastes, which it does. Firefox pastes the page's own copies
without asking. `e2e/editors-edit-journey.mjs` checks every command from the menu bar.

The Fonts panel of Notes, TextEdit and Stickies lists Catalina's families and checks, in the
browser showing it, which of them that computer has a font for: the others are dimmed, cannot be
chosen, and the panel says why. No fonts are served by the desktop; on a computer without
Catalina's fonts most of the list is dimmed. `e2e/editors-fonts-journey.mjs` checks the dimming
against a separate layout measurement.

On the desktop, the menu bar holds each editor's own commands while its window is the one in
front: Notes' Format menu (Title, Heading, Body, and the Font and Text submenus), TextEdit's
Format menu (Font, Text, Make Plain Text / Make Rich Text) and Stickies' Font and Color menus.
They act on the window's selection, and the window takes the keyboard back when the menu
closes. `e2e/editors-journey.mjs` checks them in each engine.

Notes' Format menu also has Bulleted List (⇧⌘7) and Numbered List (⇧⌘9), checked by the list
the insertion point is in: choosing one makes the selected lines that kind of list, choosing it
again takes them out, and the other kind changes the list's kind. Add Table makes a 2 × 2 table,
and Format > Table works on the table the insertion point is in: Add Row Above (⌥⌘↑), Add Row
Below (⌥⌘↓), Add Column Before (⌥⌘←) and Add Column After (⌥⌘→) add empty cells and put the
insertion point in the new one, and Delete Row and Delete Column take the cell's row or column
out (the last one takes the table out). Tab and Shift-Tab go from cell to cell, and Tab in the
last cell adds a row. The items are dimmed outside a table. A table is saved with the note's
formats, so it is kept through a reload, another window and a restart of the server. Edit > Undo
does not undo a row or column change. TextEdit and Stickies have no tables, as in Catalina.
`e2e/editors-lists-journey.mjs` checks the lists, and `e2e/editors-tables-journey.mjs` the tables.

### TextEdit, Font Book and Help Viewer

These three keep their data with `src/apps/document.rs` and `useServerState`,
under the same revision rule, and only when the desktop app serves them. Each
window is inert and marked busy until its first read answers. A stored
document the browser cannot read is left alone: nothing is saved over it.

- `src/apps/textedit/`: `/api/textedit/draft` keeps the open document (name,
  rich or plain format, lines, rich HTML, the ruler and its edited state), saved
  as it changes; `/api/textedit/files` keeps the documents and folders the Save
  sheet files, which the Open panel lists. The server refuses more than 200
  files, a document over 262,144 characters or 20,000 lines, a name over 255
  characters, an id longer than a full path of such names, folders deeper
  than 16, HTML or a ruler on a plain document, and
  an edited state on a saved one. The browser rebuilds stored HTML from an
  allowlist of elements, styles and attributes before showing it.
- `src/apps/font_book/`: `/api/font-book/library` keeps the user's collections
  (at most 100, of at most 2,000 families each, names 1 to 100 characters, no
  duplicates) and the families turned off.
- `src/apps/help_viewer/`: `GET /api/help-viewer/books` answers the server's
  own book, "Macalicious Desktop Help" (fourteen topics about the desktop,
  among them Spotlight, Storage Management, Activity Monitor and the App
  Store), and
  `GET /api/help-viewer/search?q=` searches it: up to 8 words of 200
  characters (a longer search is refused with 400, and the browser does not
  send one), every word required, matched as a prefix, ranked by title, then
  summary, then body, at most 50 results. `/api/help-viewer/place` keeps the
  page last read, which the window opens again. The server book is added to the
  contents and its results are listed first.

Limits: fonts added from a file in Font Book are not kept. A TextEdit body over
the gateway's 256 KiB request limit is refused with 413 and logged as a failed
save. Help Viewer searches only the server's book. A document forgotten on
the server (`DELETE`) reopens each app's starting state in its windows. Two
windows editing at once
follow the last-writer rule of the other synced documents.

### Status menus, the Apple menu and Finder

The menu bar's status menus state only what the browser reports: no Time Machine backup (Back Up
Now and Enter Time Machine are dimmed), the network's online state (`navigator.onLine`, live; Turn
Wi-Fi Off is dimmed, since a web page cannot switch Wi-Fi), and the battery where the engine
reports it (`navigator.getBattery`, Chromium only; elsewhere "Battery status unknown"). Show
Percentage and the Apple menu's Recent Items (the apps this account opened, newest first) are kept
per account; when two windows of one account open apps at once, Recent Items keeps the apps both
opened, newest first; Show Percentage keeps the change saved last. Sleep darkens the display and then locks; Restart… asks, then reloads the desktop
with the session kept; Shut Down… asks, then signs out through `/api/session/sign-out`. Finder's
Share and Get Info's Stationery pad, Locked and Hide extension are dimmed with the reason: the
desktop has no share destination, and the drive does not keep those settings. Known limit:
WebKit's headless build reports `navigator.onLine === false`, so its Wi-Fi menu says Offline.

Each app's own menus carry the commands its window performs, enabled when the window's own
control is; a menu an app has no commands for says so, dimmed. After a menu command the keyboard
goes back to the window that was in front, unless a dialog, another window or a menu opened
straight after has taken it.

System Preferences keeps every pane's settings per account, across reloads and server restarts,
and opens on the pane last shown. On the served desktop a note under each pane says which settings
take effect there: General's appearance, accent, highlight, Recent items, sidebar icon size, menu
bar hiding, scroll bars and font smoothing, the Dock's size, magnification, position, hiding,
minimize effect, title bar double click and indicators, and the desktop picture. The rest are kept
and shown again, but change nothing. Seventeen panes whose library demo shows facts of the captured
Mac (Network's IP address, Time Machine's backup, Software Update's beta) show a page of
`demos/system-preferences/served-pages.tsx` instead: what the browser and the application really
report, and a plain statement of what a web page cannot know or change. Controls
whose sheet or window no reference screenshot shows say so in a popover; Help opens Help Viewer.

### Launchpad, App Store and Force Quit

`GET /api/apps` answers, beside the modules, `catalogue`: every app the desktop
hosts (`src/apps/catalogue.rs`), each with `id` (its demo folder), `name`,
`category`, a one-line `summary` and `preinstalled`. Finder is not listed.
`demos/desktop/desktop-library.test.ts` fails when the catalogue and the demos
name different apps. When this app serves the desktop, the Dock and Launchpad
show the apps that come with it and those the session got from the App Store
(`demos/desktop/desktop-library.ts`). Until the catalogue, the library and the
layout have answered, they show none; when the catalogue cannot be read, they
show every app. Every other build shows every app, as before.

- `src/apps/app_store/`: `/api/app-store/library` keeps `{"installed": [...]}`,
  the apps the session got, under the revision rule of `document.rs`. An id
  must be an app of the catalogue that is not preinstalled, listed once. The App
  Store window then sells the catalogue's apps in place of its invented ones:
  each section lists the apps of its categories under Get More Apps and
  Installed. A finished Get (Get, Install, the download) is saved, which puts
  the app in the Dock and Launchpad at once, since every window shares one
  channel to the document. Open opens an installed app. Icons stay the store's
  abstract placeholders. Removing an app is a `PUT` of the list without it,
  from two places (`demos/desktop/desktop-library.ts`, `removeFromLibrary`):
  Uninstall on the store's account page, and Launchpad's delete badge, which
  the apps got from the store show while Option is held
  (`demos/app-store/app-store-launchpad.tsx`); pressing one asks "Delete
  'Books'?" over Launchpad. The app leaves the Dock and Launchpad of every
  browser of the person; its data stays, and an app that is open stays in the
  Dock until it is quit. A removal the server does not keep is said so (on the
  account page, or in an alert over Launchpad) and sent again with the
  library's next read, as every document of the channel is.
- `src/apps/launchpad/`: `/api/launchpad/layout` keeps `{"order": [...],
  "page": n}`: the session's order (catalogue ids, each once; apps it leaves out
  follow those it lists) and the page Launchpad was left on (below 16). Drag an
  app onto another to give it that place, or press Option and Left or Right
  Arrow; turning the page is saved too.
- Force Quit calls no route. Its descriptor says `managesApplications`, so the
  desktop gives it `runningApplications` (the apps with a window open, by name,
  then Finder) and `onQuitApplication`, which closes every window of the app.
  Finder relaunches: its windows close and it stays listed. This works the same
  in every build of the desktop.

Limits: apps that come with the desktop cannot be removed. Launchpad shows the
apps on a 7 by 5 grid whatever the screen size, and moves an app between pages
only from the keyboard. A Get is saved when its download finishes in the window,
so a page closed during the download keeps nothing.

### Console, Activity Monitor, About This Mac and System Information

These four show the desktop application itself, because that is all a Ferrite
application can see. Each window keeps the captured Mac's invented data in
every build except the one this app serves.

The application keeps two records of its own (`src/applog.rs`), in the `data`
store, shared by every session:

- **The log**, `desktop/log/`: one key per entry, written create-only so
  instances never overwrite each other, kept for 24 hours. An entry has its
  time, a level (`default`, `info`, `debug`, `error`, `fault`), a process (the
  module's name or `macalicious-desktop`), a category and a message of at most
  500 characters. Boot logs the start and the site publication. The router logs
  every write (any method but `GET` and `HEAD`) and every reply of 400 or more
  as `POST /api/calculator/tape answered 201`, under the module's name, or
  under `macalicious-desktop` for a name no module has; Calculator adds a line
  when it appends to or clears a tape. No entry carries a session id, a query
  string or a body. Writing the log never fails a request: a failed write is
  traced and dropped.
- **Request counters**, `desktop/requests/<module>`: requests, writes, replies
  of 400 or more, first and last time, for every module and for `session` and
  `apps`; a name no module has is not counted. A counter is updated with
  compare-and-set, four tries; under heavier contention an increment is
  dropped, so the counts are a floor. The same write keeps the timing of the
  module's last five minutes (`src/timing.rs`): for each minute, the requests
  per latency bucket (250 µs to 8.2 s, doubling), their total server time,
  the store calls they made and their errors. The router times a request from
  its call to the module to the end of the module's change notification, on
  the platform clock's sub-millisecond reading, and counts every store call
  the module makes through its storage or any helper given it (`src/store.rs`:
  each module request gets a counted store handle). Timing therefore costs no
  store call of its own. Requests the router answers itself are counted but
  not timed.

The routes:

- `src/apps/console/`: `GET /api/console/log[?limit=n]` answers `{"entries":
  [...], "now_ms"}`, the newest entries (at most 500), oldest first. The
  Console window's device is `macalicious-desktop` and its messages are those
  entries, read when the window opens, every 2 seconds (one read at a time) and
  on Reload; new ones, including an entry written late under an earlier time,
  are added without a reload, and Clear hides what was shown until Reload. The
  report sources (crash, spin, log and diagnostic reports, the system log) are
  empty.
- `src/apps/activity_monitor/`: `GET /api/activity-monitor/requests` answers
  `{"counters": [...], "now_ms"}`, and `GET /api/activity-monitor/ferrite`
  the last five minutes per module and in total: requests, requests per
  second, errors, store calls and store calls per request, mean, median and
  95th-percentile server time (the percentiles estimated within their
  bucket), each minute's figures for a graph, and the deployment generation
  and instance that answered. Both read one page of counters. The window,
  "Activity Monitor (This Desktop)", has three views. Applications lists the
  desktop's running applications with their windows and minimized windows,
  read in the browser from the window manager's `data-window-id` and
  `data-minimized` hooks; its descriptor says `managesApplications`, so Quit
  Process quits an application through the desktop as Force Quit does
  (Finder relaunches). Ferrite lists the modules' figures and graphs the
  median and 95th percentile; Network shows the round trips the browser timed
  to `/health` and to the Ferrite view's own read. The window reads every 2
  seconds, one round at a time, and not while the page is hidden.
- `src/apps/about_this_mac/`: `GET /api/about-this-mac/facts` answers the
  application's name, deployment generation (0 when nothing deployed it, as
  under `ferrite dev`), instance (`null` locally), site build, file and module
  counts, the platform clock, and the bytes and keys each module keeps for this
  session. Each module's count stops at 10,000 keys and is then marked
  `truncated`, and the windows write its figures (and the totals) as "at
  least". The window's version line is the site build; its details are
  Deployment, Instance, App Modules, Session Data, Browser and the browser's
  logical processor count; Displays is the browser's screen; Storage is the
  person's Ferrite drive against its quota, by kind of file as Storage
  Management reports it (the reply's `drive`), with what the apps keep in the
  data store beside it, which the quota does not count.
- `src/apps/system_information/`: `GET /api/system-information/report`
  answers `{"facts", "modules", "counters"}`. The outline is Browser (what
  `navigator`, `screen` and `navigator.storage.estimate()` report, with Display
  and Storage under it) and Ferrite Application (the facts, App Modules with
  each module's route and counts, and Session Storage).

Gaps, as the app mapping records them:

- Console shows only this application's own log. There is no system log, and
  other applications' logs are out of reach.
- Activity Monitor shows what the application measures of itself: Ferrite
  exposes no processes, CPU, memory, energy or disk figures to an application,
  so the window has none of those views. Its server time leaves out the
  router's own work outside the module (the session, the bookkeeping, the
  log), the gateway, the queue's wait and the network; the figures are for
  everyone together, by module, never by person, and a count dropped under
  contention takes its timing with it.
- About This Mac shows deployment facts, storage used and what the browser
  reports. There are no hardware facts (model, processor, memory, graphics,
  serial number), and the data store reports no capacity.
- System Information is the browser's facts and the application's own. There
  is no hardware report.

### Home, Keychain Access and Storage Management

These three keep their data with `src/apps/document.rs` and `useServerState`,
under the same revision rule, and only when the desktop app serves them. Each
window is inert and marked busy until its first read answers, and a stored
document the browser cannot read is left alone.

- `src/apps/home/`: `/api/home/homes` keeps the session's homes: rooms,
  accessories with their states, and scenes. The server refuses more than 10
  homes, 50 rooms, 200 accessories or 100 scenes a home, a name that is blank
  or over 100 characters, an id used twice across the homes, an accessory kind
  other than light, lamp, outlet, TV, speaker, garage door and sensor, an
  accessory in a room its home does not have, a scene that sets another home's
  accessory, a brightness or humidity over 100, and any field it does not know.
  A session with no homes starts from the sample homes and saves nothing until
  something changes. Home does not come with the desktop: get it from the App
  Store first.
- `src/apps/keychain_access/`: `/api/keychain-access/vault` keeps the "login"
  keychain, encrypted in the browser. The window asks for a keychain password
  (at least 8 characters) when it opens, derives a key from it with
  PBKDF2-SHA-256 (600,000 iterations, a random 16-byte salt) and seals the
  items with AES-GCM (a fresh 12-byte IV for every save), all with WebCrypto.
  The server stores only the envelope, `{"version": 1, "kdf": {"name",
  "iterations", "salt"}, "iv", "ciphertext"}`, and refuses anything else: other
  fields, fewer than 100,000 or more than 10,000,000 iterations, a salt or IV
  of the wrong length, or a ciphertext over 200,000 characters. The password,
  the item names and their passwords never leave the browser unencrypted.
  `+` adds a password item; Info shows one, with its password only after Show
  Password, and deletes it. A keychain password and an item's password each
  hold at most 4,096 characters, and an
  addition that would make the keychain larger than the server keeps is
  refused in the window ("The keychain is full") before anything changes.
  Home likewise offers no accessory or scene past the module's limits.
- `src/apps/storage_management/`: `GET /api/storage-management/usage` answers,
  for every module, the bytes and keys this session keeps (`truncated` past
  10,000 keys, as About This Mac counts them) and the documents a person can
  forget, each with its own module's route (`forget`, always
  `/api/<app>/<key>`), and `drive`, the person's Ferrite drive against its
  128 MiB quota (`drive.rs`): used, freeing (bytes the drive is still
  deleting), reserved (open uploads) and available bytes, each kind of file
  (Documents, Photos, Music, Movies, Other Files, the Trash; a content counts
  once however many copies name it, so the kinds add up to what the quota
  counts), and the 500 largest files. The window is titled "Ferrite Drive -
  … available of …" and lists the kinds, Large Files (5 MB or more) and App
  Data, the documents the apps keep in the data store. Delete… on a drive file
  erases it through `POST /api/files/ops`, Empty Trash empties the drive's
  Trash the same way, and Delete… on an app's document sends `DELETE` to its
  route; each asks first, as macOS does, and the usage is read again after.
  Show in Finder opens Finder on the file's folder with the file selected
  (`demos/finder/finder-open.ts`, app `finder`). A document
  is listed only while it holds something: Books' and Podcasts' libraries, Calendar's events,
  Contacts' cards, Font Book's library, Help Viewer's place, Home's homes, the keychain, Launchpad's
  layout, Network Utility's lookups, System Preferences' settings, TextEdit's draft and files, and
  the App Store's library. Other data (the Calculator tape, Notes, Messages, Notification Center's
  inbox) is counted but not offered here. A stored drive that cannot be read answers 503 rather
  than reading as empty.

Gaps, as the app mapping records them:

- Home's accessories are simulated: there is no HomeKit, nothing is switched
  in the world, and the Homes menu says so. Home has no live updates (another
  browser sees a change on its next read) and no automations.
- A keychain password cannot be recovered. A forgotten one leaves the keychain
  unreadable; forget it with `DELETE /api/keychain-access/vault` or from
  Storage Management, and make a new one. Closing the window locks the
  keychain. There is one keychain, "login"; the other keychains in the sidebar
  are empty in the served build.
- Storage Management's capacity is the drive's quota, not a disk: the data
  the apps keep in the store has no capacity and is not counted against it.
  A window left open on a document forgotten here keeps showing it until it
  changes: its next save meets the forgotten document (409), is merged onto
  it, and brings nothing forgotten back.

### Spotlight, Network Utility and Notification Center

These three show what other modules keep, or what the world answers, rather
than a document of their own, and do so only when the desktop app serves them.
Every call goes through `sessionFetch` and `withDeadline`.

- `src/apps/spotlight/`: `GET /api/spotlight/search?q=<text>` searches what
  the person keeps in Contacts (cards), Mail (subject, people and the start of
  the text of the newest 200 messages, not the Trash or Junk), Calendar
  (events), Reminders (to-dos not completed), Notes (titles only for a locked
  note), Stickies, TextEdit (files), the drive (folders and files outside the
  Trash, by name and tags, and the first 100 text files by their words),
  Safari (bookmarks and history), Music (songs) and Photos (photos and
  albums), reading each module's stored document. A search reads the newest
  200 Mail messages, and about 1 MB of their headers at most: long messages,
  in a script of three bytes a character, are searched as far as the newest
  86 or so. When older messages were left, Spotlight says under its results
  how many of the newest were searched. The words of a text file
  are read from the `files` blob once per content, at most 12 new files a
  search, and kept in Spotlight's own space of the person (`text/…`, listed in
  `texts`); a search where nothing changed makes three store calls when the
  drive has text files and Mail at most 32 messages (Mail's module keeps a
  header per message; until it does, its page is empty). Every word
  of the query must appear; titles that start with it come first; at most 10
  results a kind, a query of at most 200 characters and 8 words. The
  desktop's Spotlight (`demos/spotlight/spotlight-desktop.tsx`) lists these
  after the applications, grouped by kind, with a preview; it works out sums
  and unit conversions in the browser, asks Dictionary for a one-word query,
  and offers a web search last, which opens in a new tab of the person's
  Safari. Return opens the result: a contact in Contacts, a text file in
  TextEdit, another file in Finder (selected in its folder), a web page in
  Safari.
- `src/apps/network_utility/`: `GET /api/network-utility/lookup?host=<name or
  IPv4 address>` asks Cloudflare's DNS-over-HTTPS resolver
  (`https://cloudflare-dns.com/dns-query`, the application's only egress
  destination, handle `dns` in `ferrite.json`) for A and AAAA records, or PTR
  for an IPv4 address, and answers each question's status and records. The
  Lookup pane prints them as dig does. `GET` and `DELETE
  /api/network-utility/history` read and forget the session's last lookups
  (host, time and record count), which the Lookup pane lists before the first
  lookup. The other tools say why they cannot run, and Info shows "No
  Interfaces Visible" with every value Unknown.
- `src/apps/notification_center/`: each person's notifications. A module calls
  `notify`; `GET /api/notification-center/inbox` lists them with Do Not
  Disturb, `DELETE` clears one, an application's group or all of them, `PUT
  /api/notification-center/dnd` sets Do Not Disturb, and `POST
  /api/notification-center/notify` lets a page raise one for its own person.
  The personal stream `/live/me` brings them to every browser the person has
  open, as banners, or as alerts that stay until acted on, and the panel the
  menu bar's extra opens lists them by application. Today shows the widgets
  the person chose. Escape or a press beside the panel hides it.

Gaps, as the app mapping records them:

- Spotlight has no relevance ranking, stemming or fuzzy matching, and searches
  only the first 4,000 characters of a text file's first 192 KiB piece. It
  searches the person's own Messages conversations, not shared rooms, which
  belong to everyone who names them. A one-word query's look-up goes to
  Dictionary's sources on the Internet; no currency is converted.
- Network Utility has Lookup only: Ping, Traceroute, Port Scan and Finger need
  sockets, Netstat and Info need the machine's tables and interfaces, and the
  whois services reachable over HTTPS answer with redirects the egress does
  not follow. There is one resolver, and the module sets no deadline of its
  own (upstream Core has no egress deadline call); the platform's egress
  timeout bounds each question.

### Photo Booth, Books and Podcasts

These three keep their data only when the desktop app serves them, and every
call goes through `sessionFetch` and `withDeadline`. Books and Podcasts use
`src/apps/document.rs` and `useServerState` under the revision rule; their
windows are inert and marked busy until the first read answers, and a stored
document the browser cannot read is left alone. Photo Booth and Books do not
come with the desktop: get them from the App Store first. The text of a book
is kept in the space every account shares, so each book is fetched from its
source once; that cache keeps at most 200 books and 150 MB, and when it is
full the book read longest ago goes, fetched again when someone next opens it.

- `src/apps/photo_booth/`: `GET /api/photo-booth/photos` lists the session's
  photos oldest first (`id`, `effect`, `taken_ms`, `bytes`) with the limits;
  `PUT /api/photo-booth/photos/<id>?effect=<effect>` stores one JPEG, sent as
  the raw body (`image/jpeg`); `GET` of the same path returns it, and `DELETE`
  of one photo or of the list forgets it. The server refuses a body that is not
  a JPEG (it reads the first bytes), an effect that is not one of the window's
  25, an id that is not 1 to 64 letters, digits, `-`, `_` or `.`, a photo over
  240,000 bytes (413) and a 51st photo (409). The id is the browser's own: a
  photo sent again after a lost reply is answered 200 with the one stored, not
  stored twice. The session's photos are one versioned index (every change a
  compare-and-set, retried on a conflict, so the limit holds however many
  uploads arrive together) and one key per image, written before the index
  names it under a key no other upload shares unless it holds the same bytes;
  an image is deleted only after the index stops naming it. The window asks for the browser's camera (`getUserMedia`) and
  shows it in the previews and the camera view; the shutter draws the shown
  camera frame into a canvas and encodes a JPEG, at lower qualities until it
  fits. The strip reads the images of its last ten pictures; Delete or
  Backspace on a picture deletes it. Without a camera the window says so and
  the shutter is unavailable. The window is inert until the list has loaded;
  when the list cannot be read it says so and takes and deletes nothing.
- `src/apps/books/`: Books reads public-domain books from Project Gutenberg
  and Standard Ebooks and keeps each person's place in them. Every outside
  request goes through the `books` egress handle, whose destinations are
  `https://www.gutenberg.org/` and `https://standardebooks.org/`, and is made
  only when someone opens the Book Store, searches it, or opens a book that is
  not kept.
  - `GET /api/books/store?shelf=popular|standard-ebooks[&page=n]` and
    `GET /api/books/store?q=<text>&source=gutenberg|standard-ebooks[&page=n]`
    answer `{"books": [{"id", "title", "author", "source", "cover",
    "summary"?}], "more"}`, from Gutenberg's OPDS listing by downloads and its
    OPDS search, and from Standard Ebooks' new-releases Atom feed and its Atom
    search (`/feeds/atom/all?query=`, which answers without the patrons'
    sign-in its full catalogue asks for). One fetch reads at most 768 KB in at
    most 6 seconds. A listing is kept for everyone in the shared space, the
    shelves for 6 hours and a search for 24, and one cut short is answered but
    not kept. Covers load in the browser straight from the sources.
  - `GET /api/books/text/<book>` answers a book's index and
    `GET /api/books/text/<book>/<n>` part `n` of its text. Ids are `pg-<n>` (a
    Gutenberg number) and `se.<author>.<title>[.<translator>[.<illustrator>]]`
    (a Standard Ebooks path). The index gives each part's length in UTF-16
    code units, so an offset names the same character in every browser, where
    the reading text begins (after Gutenberg's header), up to 600 chapter
    headings found in the text, and the credit and licence lines.
    - The first request for a book fetches it once for everyone. For Gutenberg
      the book's OPDS record comes first, and a book whose rights do not say
      "public domain", or that is an audio book, is refused (403 or 404). The
      text is Gutenberg's `cache/epub/<n>/pg<n>.txt` (prose paragraphs
      unwrapped, verse and indented lines kept) or Standard Ebooks'
      single-page XHTML turned into paragraphs, read as a stream (`news/fetch.rs`)
      because a buffered egress reply is refused above 1 MiB.
    - One request reads at most 2.4 MB of the source in the 5.2 seconds it may
      spend. When the stream is cut, the text up to the last whole paragraph is
      kept, and the request for the next part fetches the rest with a `Range`
      request, so a book of any length arrives in rounds, up to 120 parts
      (about 19 MB; a longer book is marked `truncated`). Egress passes no
      response headers, so a book is complete only when the source says nothing
      follows: the whole file read to its end, an empty range, or 416.
    - Without `ETag` or `Content-Range` there is no validator for a range, so
      each round after the first reads the 4 KiB before the place it goes on
      from again and checks them against the SHA-256 the index kept. A file
      that changed length before that point is another edition: the book is not
      continued, and what is kept stays, marked `changed` and `truncated`, so
      every place and note still names the words it named. A same-length edit
      earlier in the file is not seen; it joins two editions at a paragraph and
      moves no offset.
    - Shared keys: `text/<book>/index` (replaced with compare-and-set),
      `text/<book>/g<generation>/part/<n>` (at most 160,000 bytes, written
      before the index names it, under a random generation per round, so a
      round that loses the compare-and-set cannot change text an index names
      and removes what it wrote) and `text/<book>/claim`, created only where
      none is kept, expiring after 15 seconds and removed when the fetch is
      done, which makes a second request for a book being fetched wait up to 5
      seconds for what the first keeps. A kept book is kept for good, because
      every place and note is an offset into the text as it was kept.
  - `/api/books/library` keeps one document per person through `document.rs`:
    the collections, the Sort By choice, the demo's page places, and `books`,
    the books the person got (`{"id", "title", "author", "source", "added",
    "cover"?}`), left out while empty. It refuses more than 100 collections,
    500 books in them or in the library, a book twice, an id no source has or
    that belongs to another source, a title that is blank or over 300
    characters, a cover that is not a picture at one of the two sources, a
    library that grows past 200,000 bytes, 1,000 bookmarks, a page of 0 or
    over 100,000, a sort other than recent, title, author and manual, and any
    field it does not know.
  - `/api/books/reading/<book>` keeps the person's reading of one book:
    `{"place", "bookmarks": [{"at", "label"}], "highlights": [{"id", "start",
    "end", "color", "text", "note"}]}`, every offset in UTF-16 units of the
    book's whole text. It refuses more than 500 bookmarks (in order, each place
    once) or 500 highlights, a highlight that is empty or covers more than
    50,000 characters, a colour other than yellow, green, blue, pink and
    purple, a label over 200 characters, an excerpt over 300 or a note over
    2,000, and a document over 200,000 bytes. The person's readings are slots
    named in one record (`readings`): a book takes the next slot the first time
    its reading is saved, and at most 500 books have one between two forgets,
    so a person's readings take at most 500 keys whatever ids their requests
    name. `DELETE /api/books/library` forgets the library and every reading:
    one compare-and-set raises the readings' generation, so every reading reads
    as none at once and a page left open from before is answered 409, and then
    every slot that may hold an earlier generation's document is overwritten
    with an empty one. Emptying that runs past 5 seconds answers 503; the record
    keeps how far it got, and forgetting again finishes it.
  - The window: the library lists the person's books, never the demo's
    placeholders. The Book Store segment is the real store (Get, then Read),
    the Audiobook Store says there are no audiobooks, and a cover's menu
    removes a book. The reader (`demos/books/books-reader.tsx`) cuts the real
    text into pages that fit the window, measured in a hidden copy of the page.
    A page always starts at the place saved, so a place kept in one browser
    opens at the same words in another. Next Page, Previous Page and the arrow
    keys turn pages and save the place; Table of Contents lists the headings,
    Bookmarks adds or removes the page's bookmark, Notes lists the highlights,
    and Search fetches the parts not read yet before it lists results.
    Selecting words opens a menu of the five colours and Add Note. The credit
    and licence line and a link to the book's page stay under the text.
- `src/apps/podcasts/`: `/api/podcasts/library` keeps the shows followed, the
  episodes played to their end, the whole seconds heard of each started episode
  (at most a day) and the Preferences settings, each only among the choices the
  Preferences window offers. The place in each started episode is kept for the
  person, every 10 seconds of listening and at every pause and skip, and an
  episode opened again, or after a reload, goes on from there. The menu bar's
  Controls menu plays, pauses, skips and plays the next episode in Up Next.
- Photo Booth: Export… in a picture's contextual menu downloads its original;
  a camera the browser refuses, finds none of, or cannot start is said so in
  its own words, and Take Photo is dimmed.

Storage Management offers the Books and Podcasts libraries for forgetting;
Photo Booth's photos are counted there but not offered.

Gaps, as the app mapping records them:

- Photo Booth's first two effect pages are computed on the camera's pixels
  (`demos/photo-booth/photo-booth-effects.ts`), the same arithmetic for the live
  view, saved pictures and clips; the third page stays CSS over the camera.
  Distortions centre on the frame, with no face tracking. A picture saves
  through the Photos library with its effect baked in, and the original goes to
  Pictures/Photo Booth on the person's drive. `/api/photo-booth/photos` remains
  for the photos stored before that; the desktop window no longer writes to it.
- Books has no audiobooks. A person's own EPUB or PDF is kept on their drive and
  read in the browser, text only for an EPUB, and this desktop's reviews carry no
  names; the Book Store's books are read from the server's shared space. The
  reader shows text only, without the sources' pictures, themes, font sizes or
  two-page spreads. Standard Ebooks' search is its public Atom search, a single
  page. Page numbers count pages of the length the window shows, so they change
  with its size. A highlight's menu opens only with the pointer. Removing a
  book from the library keeps its reading, which comes back if the book is got
  again; a person who has read 500 books forgets the library to read a 501st.
- A window left open while the library is forgotten elsewhere keeps showing
  it until its next change, which meets the forgotten library (409), is merged
  onto it by the desktop's client and brings nothing back; the window then
  shows the forgotten library and says its change was not kept. Of two windows
  open on one book that both change its reading, the merge keeps both sides'
  bookmarks and highlights, and the place of the one changed last.
- The shared space keeps every book anyone opened, for good: it is bounded by
  the two sources' catalogues (some 75,000 Gutenberg books), not by a budget.
- Podcasts reads real shows: Apple's directory (search, lookup and the top
  chart) and each show's own feed, through the `podcasts` egress handles
  (`podcasts` and `podcasts-2`). The server keeps the person's library (shows
  followed, queue, places, played, speed and settings) as one document and
  never fetches or relays audio: an episode plays in the browser straight from
  its publisher. A show whose feed is on a host the desktop cannot reach is
  listed but cannot be followed, and the window says why.

### News

News reads real stories from publishers' RSS and Atom feeds through the
application's `news` egress handles (`news`, `news-2` and `news-3`: a handle
holds at most 16 destinations, `src/apps/egress.rs`), which declare each feed
address exactly (37 feeds of 22 publishers). Egress matches a literal
destination prefix, follows no redirect, passes no response headers and
refuses a buffered reply over 1 MiB, so `src/apps/news/fetch.rs` reads a source
as a stream, keeps the first bytes it needs (a feed's newest items come first)
and stops at a 6-second budget inside the gateway's 8-second deadline.
`src/apps/news/feed.rs` reads RSS 2.0, RSS 1.0 and Atom, keeps only
`http`/`https` addresses, turns HTML into plain paragraphs and drops an item
the body was cut inside. Both are shared with Podcasts.

- `GET /api/news/catalogue` lists the publishers (`channels`) and 10
  `topics`, each merging the topic feeds of two or three publishers
  (`src/apps/news/sources.rs`; a test checks every feed address against the
  `news` egress destinations).
- `GET /api/news/sources/<id>` answers one feed's stories (headline,
  plain-text summary, picture address, link, date, author). A feed is kept in
  the shared space for 15 minutes for every reader and read again from the
  publisher when someone asks for it after that, so no timer polls
  publishers nobody reads. One request refreshes a stale feed at a time (a
  20-second claim) while others get the kept copy with `stale: true`; a
  refresh that fails answers the kept copy with the reason, or 502.
- `/api/news/library` keeps the person's followed and blocked channels,
  Saved Stories (150) and History (60) as snapshots, so a saved story stays
  readable after its feed moves on. It refuses an id that is not plain, a
  link or picture that is not a web address, a story listed twice and a
  library over 200,000 bytes.

The window (`demos/news/news-live-window.tsx`) leads Today with the newest
stories of the channels followed, offers Follow and Block in Discover
Channels and on each channel, reads its feeds again while it stays open, and
opens a story's full page in Safari (Read Full Story, Share > Open in Safari,
the Today widget): Safari opens for it if it is not open, and shows the page or
says it opens outside Safari. Share > Copy Link copies the story's link. A
person's channels, Saved Stories and History are kept on the server for them,
across reloads and restarts, and no other account sees them. The server never
fetches or keeps an article. `node e2e/news-journey.mjs` (under
`ferrite dev --egress allow`) checks Today against the feeds the server read,
opens, saves and follows, reloads, and checks another browser sees none of
it.

### Safari: links from other apps

Another app opens a web address in Safari through `demos/desktop/desktop-open-url.ts`:
`openUrl(url, from)` accepts only absolute http(s) addresses without a user name, queues the
request, and opens Safari. The window takes queued requests once its kept tabs have loaded, so a
link opened while Safari is closed arrives as a new tab in front, kept like any other.

Share menus that share a link (Safari, News, Stocks) use one helper,
`demos/desktop/desktop-share-link.tsx`. Copy Link puts the address on the clipboard. Mail,
Messages, Notes and Reminders take the link through a queue and an event, as `openUrl` hands
one to Safari. Share > Mail opens a New Message, its subject the link's title and its text the
address; Share > Messages starts a new message holding the link, for the person to address and
send; Share > Notes makes a new note of it, with its title and address, saved like any other
note; Share > Reminders makes a reminder in the list shown (from a smart list, the first list),
titled with the link's title, its address in the URL field. Each app takes the links shared while
it was closed when it opens; nothing is sent by itself. AirDrop, which needs nearby devices, is
always dimmed. Known limits: in Messages, picking an existing conversation from the list instead
of typing its name gives up the new message and its link, as the compose button's draft always
is; in Notes the address is a plain line of text, not a rich link.

Safari's File, View, History and Bookmarks menus carry its commands (New Tab, Reopen Last Closed
Tab, Open Location, Close Tab; Favorites bar, sidebar, Tab Overview, Stop, Reload, Reader;
Show All History, Back, Forward, Home and the recent visits; Show Bookmarks, Show Reading List,
Add Bookmark, Add to Reading List and the Favorites) with their usual key equivalents, which the
window handles while it has the keyboard.

Safari never shows a remote site inside the desktop. A Ferrite application's egress hands it only
the status and body of a reply, never its headers, so the server cannot see X-Frame-Options or a
Content-Security-Policy frame-ancestors refusal, and a browser gives a page that frames another
site no reliable signal of such a refusal either. So the server fetches and re-renders the pages
of the sites it lists, and offers every other page in a real tab of the visitor's browser. Before
it does, it looks the name up (for at most 2.5 seconds): a name that does not exist gets "Safari
Can't Find the Server", a name that resolves into a private network is refused, and a lookup that
could not run is said on the page. Typed addresses are normalised as the browser's URL parser
writes them (lower-case host, international names in their ASCII form), and a number such as
"1.5" is a search. A redirect is followed only when its body names the target. The journey
(`e2e/safari-journey.mjs`) serves its refusal, redirect and download fixtures from a local HTTP
proxy that only its own browser uses.

A file of a listed site (a picture, a PDF, an EPUB) opens as a page that offers Download to
Downloads Folder: the server fetches it, as it fetches a page (`GET /api/safari/file`), and the
window saves it into the person's Downloads folder through the drive, where Finder lists it
(Show in Finder). Files are limited to the 1 MB a Ferrite application can fetch; a larger one is
refused with that reason.

Safari keeps each person's open tabs, Favorites and bookmarks, Reading List and history on the
server, in that person's own space: they come back after a reload and a server restart, and no
other account sees them. Every page that opens is added to History, by the server, or by the
window when the server had no time left in its reply.

### Music

Music is a real player when this app serves the desktop
(`demos/music/music-desktop.tsx`; the documentation keeps the demo window). Its
module, `src/apps/music/`, keeps for the person signed in:

- `/api/music/library`: the songs, playlists and Loved, under the revision
  rule of `document.rs`. A song names where its sound is: a file of the
  person's drive (`src/apps/files/`, by its file id) or an openly licensed
  Internet Archive item and its files by format (`mp3`, `ogg`, `flac`) with
  the item's licence. The server refuses more than 500 songs or 100
  playlists, texts over 200 characters, a playlist or Loved naming a song the
  library does not have, a file that is not audio, a path that leaves the
  item, and an Archive song whose licence is not a Creative Commons licence or
  public-domain mark. The licence is the server's to decide: the item route
  records, for the person, the licence and playable files it found in the
  item's own metadata, and a save that adds or changes an Archive song must
  name exactly those.
- `/api/music/playback`: Up Next (at most 1,000, with its unshuffled order),
  the place in the song, Shuffle, Repeat, volume, Recently Played (50), play
  counts, and the Internet Archive songs played without being added (200), so
  that Up Next and Recently Played can still name them after a reload. It also
  keeps the playback's `epoch`, a plain id of at most 64 characters (optional;
  absent in a playback saved before it was kept). The
  place is saved at a pause, a seek and a change of song, and every 10 seconds
  while the song plays. As the page goes away (a reload, a closed tab), what
  changed since is sent once more with a `keepalive` request, which the browser
  lets outlive the page; it is best effort: at most 64 KiB, and refused (409)
  when an ordinary save of the page landed just before. After a reload the song shows that place and resumes
  from it once its sound has loaded, clamped to the length the browser finds
  in it; a song saved within a second of its end had finished and starts from
  0:00. `e2e/music-controls-journey.mjs` checks every playback control on the
  media element, after a reload and, with `--phase set` and `--phase check`,
  across a restart of `ferrite dev`.
- `/api/music/preferences`: the Preferences settings this desktop carries out, under the
  revision rule: List Size, the notification when the song changes, and Keep on top of all
  other windows for the MiniPlayer. The server takes those three fields and no other. The
  window shows Music's other settings dimmed, each with the value that is true here, and a
  note under each pane says why (there is no iTunes Store, no ratings, no crossfade,
  enhancement or Sound Check, songs added are always copied to Music on the drive, and so on);
  they are not kept.
- `/api/music/artwork/<sha256>`: covers read from uploaded songs' tags and
  made small in the browser, JPEG or PNG of at most 100,000 bytes, at most
  500. A cover is named by the SHA-256 of its bytes, so it is stored once
  however many songs share it, and a body with another digest is refused. The
  name is the same for everyone who keeps that cover, so the reply is
  `private, no-cache`: the browser asks again each time, and a person signed
  in after another is answered by the server, never by its cache. A cover the
  saved library no longer names is forgotten.
- `GET /api/music/archive/search?q=&page=` and
  `GET /api/music/archive/item/<identifier>`, through the `archive` egress
  handle (`https://archive.org/advancedsearch.php` and
  `https://archive.org/metadata/`). The search always adds
  `mediatype:audio AND licenseurl:*creativecommons.org*`, and the person's
  words are reduced to letters and digits, so no query can widen that filter;
  the item route checks the licence again. Only those small JSON answers pass
  through egress; under `ferrite dev`, run with `--egress allow`.

No audio passes through the application. An uploaded song goes to the drive
in pieces under 256 KiB, is read back in pieces and joined into one `Blob` in
the browser, which plays it, so a seek is answered from memory; the content
routes that serve the desktop's own files are public and cannot serve a
person's songs. An Internet Archive song plays straight from archive.org,
which answers range requests, so the browser fetches only what it plays or
seeks to.

A song that cannot play says why, in the window's banner and its display: a
file the browser cannot decode (damaged, or in a format it does not play), an
Internet Archive track whose address does not answer, one whose address answers
without sound the browser plays (the Archive may have it unavailable for now),
one that stops arriving for 15 seconds, or an uploaded song whose file is gone
from the drive. Nothing is then left playing or loading, the place is kept, and
Play loads the song again. A file chosen in Add Songs… whose length the browser
cannot find is refused before it is uploaded. Known limit: WebKit itself fails
some loads of an Archive track (one in three in a probe with no app code); the
window then says the Archive did not give a file it could play, and Play tries
again.

`node e2e/music-journey.mjs` (under `ferrite dev --egress allow`) uploads a
generated song in pieces, plays, pauses and seeks it, reloads and checks that
it resumes from where it was paused, loves it and adds it to a new playlist,
then finds, plays and adds an Internet Archive track and checks everything
after a second reload. Firefox needs an audio output device to play sound; on
a headless Linux host start PulseAudio's null sink first
(`pulseaudio --start --exit-idle-time=-1`).

Gaps: an uploaded song starts once all of it is read back from the drive;
deleting a song from the library leaves its
file in the drive's Music folder. There is no now-playing item in the menu bar
or Notification Center, which Catalina does not have either; Music shows its
song-change notification while it is in the background, when Preferences ask
for it.

### TV and QuickTime Player

TV plays YouTube videos and QuickTime Player plays the person's own movies.
No video passes through the application: YouTube streams to the browser, and a
movie is read back from the drive into the browser, which plays it.

- `src/apps/tv/`: `/api/tv/library` keeps the person's YouTube library under
  the revision rule: the videos it knows (id, title, channel), History (newest
  first, at most 200), Up Next (200), Watch Later (500) and the place in each
  started video. `GET /api/tv/video?link=` reads a YouTube link (or id) and
  answers the video's title and channel from YouTube's oEmbed endpoint through
  the egress handle `youtube`; the request is built from the id alone.
  `GET /api/tv/search?q=` searches YouTube through the YouTube Data API when
  the secret `youtube_api_key` is set, and otherwise answers
  `{"available": false}`, which the window explains.
- `GET`, `PUT`, `DELETE /api/tv/preferences`: the one Preferences setting the
  YouTube window carries out, List Size, per account. TV's other settings are
  shown dimmed with why.
- In the browser, a video plays in YouTube's official IFrame Player API
  (`youtube-nocookie.com`) with TV's controller under it; nothing is
  downloaded or rehosted. The menu bar's Controls menu plays, pauses and skips
  in the player (dimmed while YouTube has refused the video) and adds the video
  shown to Up Next or Watch Later.
- `src/apps/quicktime_player/`: `/api/quicktime-player/recents` keeps the
  person's recent movies (drive file id, name, when, and the place in whole
  seconds; at most 20). QuickTime Player opens a movie from the person's drive
  (or uploads one from the computer into Movies), reads it back in pieces
  through `demos/desktop/desktop-files.ts` and plays it in a `<video>` with
  play, pause, seek, frame steps, scan speeds, volume, Picture in Picture and
  full screen; the Open panel's Recents reopen a movie where it was left.
  The menu bar's File menu has Open File… (Command-O), which shows the Open
  panel, and Open Recent, whose movies open from the drive where they were left.

Gaps:

- YouTube refuses to play to some networks, data-centre addresses among them
  (player error 150). TV then says so and offers Watch on YouTube; a person's
  own browser at home is not affected.
- Searching YouTube needs the `youtube_api_key` secret, which is not set; TV
  plays pasted links and its own collection only.
- A movie is read whole before it plays (the drive answers pieces, not
  ranges); the drive takes files of up to 64 MiB. QuickTime Player has no
  recording, trimming or export.

`node e2e/tv-journey.mjs [--url …] [--browser chromium|firefox|webkit]
[--allow-youtube-refusal]` plays a pasted YouTube link in TV, saves it to
Watch Later and Up Next and finds them after a reload, then opens
`e2e/fixtures/test-pattern.webm` in QuickTime Player and plays it from the
drive.

### Calendar

Calendar keeps each person's events and own calendars as one document
(`/api/calendar/events`, revision-checked, `src/apps/document.rs`); an earlier
build's plain list of events still reads.

- **Calendars.** Home and Work to start with; New Calendar, Rename, Color and
  Delete in the list's contextual menu. Birthdays, US Holidays and Siri
  Suggestions stay built in.
- **Events.** Title, location, start and end or all-day, repeat (every day,
  every week on the start's weekday, every month on its day or every year,
  ending after a count or on a date, with removed occurrences), notes and
  URL, edited in the event's popover; Delete or Backspace deletes, asking
  about one occurrence of a repeating event.
- **Two windows, two browsers.** Another browser of the same account shows a change without a
  reload. A save another browser got in before (409) is merged onto the stored calendar (events by
  id; whatever either side deleted stays deleted) and saved; a change to an event deleted elsewhere
  is not kept, and the window says so. When both changed the same event, the save that lands
  second keeps its whole version of it. `e2e/calendar-sync-journey.mjs` checks it.
- **Preferences.** The General pane's settings (days per week, first day, scrolling, the day's
  hours, hours shown, default calendar, Birthdays and Holidays) are kept per account
  (`/api/calendar/settings`), so a reload, another browser and a restart keep them. Alerts, the
  Advanced options, an alternate calendar and Calendar Help are not built: they are dimmed, each
  saying why. The window's first week is laid out from the stored first day from its first frame:
  the events' read answers the preferences too, and the window draws nothing until that read
  settles.
- **Time zones.** Events keep their instants, and a repeating event keeps its own zone (the zone
  it was made in, or its file's TZID): its occurrences are at the same moment in every browser,
  across either zone's change of the clocks. Import and export keep the zone (one VTIMEZONE per
  zone). `e2e/calendar-ics-journey.mjs` checks it with browsers on New York's and Tokyo's clocks.
- **Search.** Lists every event whose title, location or notes match, at its
  next occurrence.
- **Import and export.** iCalendar (`.ics`) files, read and written in the
  browser (`demos/calendar/calendar-ics.ts`), from and to the computer or the
  person's drive (`src/apps/files`); nothing of a file reaches this module but
  the events it adds to the document. `calendar.mdx` says what is read and
  written.
- **Invitations.** A signed-in account (not a Guest User) invites other
  accounts by exact account name: an event's `invitees` in the document.
  `GET /api/calendar/people/<name>` checks a name as it is typed; there is no
  listing of accounts. After each save the module brings the person's
  invitations in line with the document (`invites.rs`): one card per invited
  event in its shared space (`invites/<organizer>/<event>`), one inbox entry
  per invitee (`inbox/<invitee>/<token>`), and a notification with Accept
  and Decline to each new invitee. A change of the event's time asks everyone
  again; someone taken off, or an event deleted, is told it is cancelled and
  loses the inbox entry. Invitees read their invitations with
  `GET /api/calendar/inbox` and answer the version they saw with
  `POST /api/calendar/inbox/<token>/<version>/accept` or `/decline` (409 once
  the time changed since); the organizer reads the answers with
  `GET /api/calendar/sent` and is told of each answer once.
  The card is written first, marking who is still to be told and who is
  still to be cleared, and every later step can be made again, so a
  reconcile cut short is finished by the next one; `GET /sent` carries on
  with it and says `pending` while some is left. A card the save did not
  change is not written, and only the people whose view changed are told to
  read again. One request's reconcile does a bounded amount of this work (a
  budget of 240 steps, each step's store calls estimated from above, about
  20 people told, beyond a first unit of work it always does), and the
  window reads `/sent` again while it is pending, for up to five minutes; a
  save invites at most 20 people new to it, each looked up and their inbox
  counted before the save. Reconciles run one at a time under a
  lock of the organizer's own that expires after 10 seconds; one that finds
  it held leaves the work to the holder, which reads the document's revision
  again after giving the lock up and goes round again for a save that landed
  meanwhile. An answer is checked in the same compare-and-set as it is
  written, so it never lands once the person was taken off, nor on a version
  they did not see. Every route starts from the requesting account's own
  inbox or cards, and no account id reaches a browser. At most 20 people per
  event, 50 invited events per person and 500 invitations per inbox. The
  reconcile alone puts and clears the inbox entries of the people a card
  names; reading an inbox clears only an entry whose card names the person
  nowhere, and a full one gives up those of events that ended more than 30
  days ago to make room, each by a compare-and-set on the entry. A save that
  would still overfill someone's inbox is refused with 422, which tells the
  organizer that much about them.

- **Alerts.** An event's popover sets its alert (At time of event to 2 days before; for an all-day
  event, 9 AM on its day or before it). While Calendar is open, the alert shows under the menu bar
  at its moment, on the event's own clock (a weekly 8:00 New York meeting alerts at 7:50 New York
  time anywhere), and stays until its occurrence ends or Close, which is saved with the event; an
  alert missed while Calendar was closed shows when it opens. Not done: alerts while Calendar is
  closed, alerts of invitations, default alerts for new events, Snooze, and alerts in iCalendar
  files. `e2e/calendar-alerts-journey.mjs` checks it on a driven browser clock.
- **Dragging.** In the week and day views an event of your own calendars moves where it is dragged,
  to another day and time in steps of 15 minutes (an all-day event by whole days), and its top or
  bottom edge changes when it starts or ends; Escape gives a drag up. A repeating event asks whether
  to change only that occurrence (it becomes an event of its own) or all of them. The change is
  saved like any other. Touch scrolls instead, and from the keyboard dates change in the popover.
  `e2e/calendar-drag-journey.mjs` checks it with real pointer events.

Not done: subscribing to public holiday calendars, and:

- **At a phone's width** (420 px) the page never scrolls sideways. On a screen narrower than an
  app's smallest window (Calendar 680 pt, Reminders 520 pt), the window opens at the left edge
  with its close button showing and runs past the right edge; move it to see the rest.

### Reminders

Reminders keeps each person's lists as one document (`/api/reminders/data`,
revision-checked like Notes).

- **Due dates and times.** A reminder is due on a day, optionally at a minute,
  read in the time zone of the browser that set it (`timeZone`, an IANA name).
  It alerts at that minute, or at 9:00 on the day, on that zone's clocks, so
  every browser of the person names the same instant; a browser in another
  zone shows a timed reminder at that moment on its own clocks, and changing
  its day or time there puts it in that browser's zone. The browser sends each
  alert's instant with every save. A reminder saved before `timeZone` was kept
  is read in the browser's own zone, and the first save from a browser names
  that browser's zone for it: from the zone it was set in, its alert stays at
  the same instant; first saved from another zone, it is read in that zone, as
  every save read it before.
- **Alerts.** The server decides by the platform's clock that a reminder has
  fallen due: `GET /api/reminders/alerts` lists the fired alerts that were not
  dismissed, which an open Reminders window asks for every few seconds and
  shows under the menu bar; closing one posts
  `/api/reminders/alerts/<id>/dismiss`, retried after `Retry-After`. Alerts
  show only while a Reminders window is open.
- **Repeats.** Every day, weekday, week, two weeks, month or year, with an
  optional end day. Completing a repeating reminder moves it to its next day
  and keeps it to do.
- **Lists.** Add List (or File > New List) makes a list; Show Info in a list's contextual menu
  renames it and changes its colour (a name of 1 to 100 characters; the popover says why it
  refuses one), and Delete asks, then removes the list and every reminder in it. File > New
  Reminder adds to the list shown. View > Show Completed keeps completed reminders in view, where
  a click on the circle makes one to do again; that choice belongs to the window and is not saved.
- **Shared links.** Share > Reminders in Safari, News and Stocks makes a reminder in the list
  shown (from a smart list, the first list), titled with the link's title, its address in the
  URL field. A link shared while Reminders is closed is taken when it opens.
  `e2e/reminders-share-journey.mjs` checks it (with `ferrite dev --egress allow`).
- **Two windows, two browsers.** A save another window or browser got in before (409) is not
  lost: the window takes in the stored reminders and makes its own changes again on them, field
  by field, then saves that. Whatever either side removed stays removed. A window taking in
  another's change keeps a reminder being typed, its open popover and what it shows. When both
  changed the same field of a reminder, the save that lands second keeps its value.

- **Shared lists.** A signed-in account (not a Guest User) shares one of its
  own lists with other accounts by exact account name
  (`src/apps/reminders/shared.rs`). The list leaves the owner's document and
  becomes a document of its own in the module's shared space
  (`lists/<id>`, ids `sh-` and 24 hex digits), with its own revision, which
  everyone on it reads with `GET /api/reminders/shared` and writes with
  `PUT /api/reminders/shared/<id>` (409 on an old revision); each person has
  an index entry per list (`members/<account>/<id>`). The owner adds and
  removes people (`POST /shared/<id>/people`, `DELETE
  /shared/<id>/people/<name>`) and stops sharing (`POST /shared/<id>/stop`:
  the list goes back into the owner's document before the shared one goes);
  anyone leaves (`POST /shared/<id>/leave`; an owner who leaves passes the
  list to the next person on it, and one alone on it takes it back). Every
  change is a compare-and-set that checks, in the same write, that the person
  is still on the list, and every route answers 404 to anyone who is not; no
  account id reaches a browser. At most 20 people besides the owner, 20
  shared lists per person and 500 reminders per shared list. Reminders of a
  shared list raise no alerts. A list taken back (Stop Sharing, or its owner
  leaving it with nobody else on it) alerts again at once: the window asks
  `PUT /api/reminders/alerts` to arm the alerts its due reminders lack, each
  only while its reminder still says the day, minute and zone the browser
  worked the instant out from. An add or share that does not go through takes back
  what it wrote, and a read deletes an index entry whose list does not name
  its person once it is a minute old (an add writes its entry before the
  change that names the person, so a younger one may belong to an add under
  way).

Not done: alerts delivered while Reminders is closed, and alerts for shared
lists. `node e2e/reminders-journey.mjs` runs under
`ferrite dev --clock-ms <epoch ms>`, or with `--live` on a hosted app.

### Photos

`src/apps/photos/` keeps each person's library in their own space: photo records in 64 shards by
id (the drive file of the original, name, title, caption, keywords, place, type, bytes, pixel
size, taken and added dates, camera settings, favourite, hidden, Recently Deleted, the edit
recipe), an index of albums, folders, smart albums, keywords and slideshows, and the window's
settings, with a JPEG thumbnail per photo and per edit under keys of their own. A library kept in
the old single document is moved across on its first read. Originals are files of the person's
drive (Pictures), uploaded in pieces under the gateway's 256 KiB request limit. Editing is
non-destructive: the page renders the recipe from the original; Revert to Original forgets it.

- `GET /api/photos/library[?from=<shard>]` answers one page and says where the next begins;
  `POST /api/photos/photos`, `POST|DELETE /api/photos/photos/<id>`,
  `GET /api/photos/thumbs?ids=`, `POST /api/photos/purged`.
- `POST|DELETE /api/photos/folders[/<id>]`, `PUT|DELETE /api/photos/smart-albums/<id>`,
  `PUT /api/photos/keywords`, `PUT|DELETE /api/photos/projects/<id>`, `PUT /api/photos/settings`.
- `POST /api/photos/albums` `{id, name}`; `POST /api/photos/albums/<id>` `{name?, sort?, add?,
  remove?, from?}`: `sort` is `custom` (order added), `oldest`, `newest` or `title`; with `from`
  the photos added leave that album in the same write (Move to). `DELETE /api/photos/albums/<id>`.
- Limits: at least 5,000 photos (Recently Deleted included; a shard takes 160, 10,240 in all),
  100 albums, 100 folders, 100 smart albums,
  64 MiB per original, 96 KB per thumbnail; Recently Deleted keeps a photo 30 days.
- One original belongs to one photo: `file/<drive id>` claims it, created only if absent, before the
  record is written, and marks it gone for good when the page confirms its removal. A photo's id is
  never used twice: the shard that held it keeps the id, and `GET /library` writes no repairs, leaving
  out any reference to a photo it does not hold.
- The page imports JPEG, PNG, GIF and WebP pictures and MP4, MOV and WebM movies the browser can
  play, judged by the file's bytes; HEIC/HEIF and AVIF,
  non-pictures, damaged pictures, files over 64 MiB and files past the library's limit are
  refused by name with the reason, before anything is uploaded.
- Another browser of the same person shows a change at once: the router counts Photos writes
  and the personal stream's `macalicious:server-change` (`app: "photos"`) makes the window read
  the library again.
- Photos dragged onto an album in the sidebar are added to it; a selected photo carries the whole
  selection, and files dragged from the computer still import on the window, not on a row.
- Journey: `node e2e/photos-journey.mjs --browser chromium|firefox|webkit
  [--restart-command "<stop and start ferrite dev on the same data root>"]`.

### Scripts: Automator and Script Editor

Scripts run in the application's own interpreter (`src/qjs/`, generated from the `qjs-engine` source package)
with a 5-second wall budget, one at a time. Known limit: while a script runs (up to 5 seconds),
it holds one of the process's runtime workers. If that worker was the one driving timers and
I/O, other timers in the same process (under `ferrite dev` and in the in-process tests) can wait
until the script ends. `MAX_CONCURRENT = 1` bounds this to one script at a time.

Script Editor's script takes the desktop's Edit menu (Undo, Redo, Cut, Copy, Paste as plain text,
Select All), as the other editors do; `e2e/script-editor-edit-journey.mjs` checks it. A script is
kept by Save Script, in Documents/Scripts; unsaved text is not kept across a reload.

### Preview

Preview works on the person's own files in their drive (`src/apps/files`),
read and written in pieces by the browser helper `demos/desktop/desktop-files.ts`.
The window (`demos/preview/preview-app.tsx`) opens pictures and PDFs from the
drive through the shared Open dialog. A picture is drawn on a canvas; PDF
pages and their thumbnails are drawn by Mozilla's pdf.js (`pdfjs-dist`, a dev
dependency of the library, loaded only when the first PDF is opened; pdf.js
starts its worker from the build's own `pdf.worker` file, which the content
route serves as `text/javascript`). Zoom, Rotate Left and Right, a picture's
crop and size, searching a PDF's text, and markup (Sketch, Line, Arrow,
Rectangle, Oval, Text, signatures drawn on a pad) all work. A text mark holds
at most 2,000 characters: its box takes no more and says so when it is full,
and the mark keeps exactly the text shown. Save writes a picture back in its
own format with the edits and the markup drawn in: the saved picture is a new
file, and the one it replaces goes to the Trash with its markup still kept, so
putting it back brings the markup back. Export saves a JPEG, PNG or PDF copy to
the drive and Download hands one to the computer. A PDF is written in the
browser, one 150 dpi JPEG a page with the markup drawn in. One operation (open,
save, export, download) runs at a time, and nothing is edited while one runs or
while the file's stored markup loads (the window is `aria-busy` then).
Closing the window, opening another file or leaving the page asks first while
changes only the window holds would be lost.

Its module, `src/apps/preview/`, keeps what the file cannot hold, in the
person's own space:

- `GET`, `PUT`, `DELETE /api/preview/markup/<file id>`: the file's markup,
  with the revision rule of `document.rs`. Marks are in fractions of the
  page; each kind (`rect`, `oval`, `line`, `arrow`, `sketch`, `text`,
  `signature`) is checked for the fields it may have, colours are `#rrggbb`,
  coordinates stay within a page's width of the page, and a file has at most
  500 marks and 20,000 points. Markup is kept for at most 1,000 files per
  person, counted in an `index` document changed only with compare-and-set:
  a save lists its file before writing and confirms the listing after, a file
  comes off the index only while its markup is absent, and a save that cannot
  be confirmed puts back the markup it replaced. Listings whose save stored
  nothing are reclaimed before a full index refuses a file.
- `GET`, `PUT /api/preview/signatures`: the person's signatures, at most ten.

`tests/preview.rs` covers the revision rule, refusals, isolation between
people, the 1,000-file bound, saves that store nothing and deletes racing
saves; `tests/accounts_isolation.rs` probes the module like every other.
`node e2e/preview-journey.mjs` gets Preview, uploads a picture and a two-page
PDF to the drive, opens, turns, crops, marks up, saves and exports the picture,
then opens the PDF, checks pdf.js drew its pages, finds a word, adds an arrow
and a signature and exports it. It takes `--browser chromium|firefox|webkit`.

### Voice Memos

Voice Memos does not come with the desktop: get it from the App Store first. It
has no server module of its own: it keeps the person's recordings as audio
files in a `Voice Memos` folder inside Music on their drive (`src/apps/files/`,
through `demos/desktop/desktop-files.ts`), so each person, signed in or a
guest, has their own, and Finder shows the same files. The window
(`demos/voice-memos/voice-memos-app.tsx`) records from the browser's microphone
(`getUserMedia`) with `MediaRecorder`, in the first of Ogg Opus (Firefox), WebM
Opus (Chromium) and MP4 (Safari) that the browser records. In a browser without
`MediaRecorder` (WebKit on Linux) it writes the samples Web Audio hands it as a
16-bit WAV file. While the timer runs, the waveform draws the microphone's
level; a take stops by itself at ten minutes, and the microphone is released
when it ends or the window closes. Done uploads the take under a name made from
the id it got when it started, with the extension that matches its type
(`.ogg`, `.webm`, `.m4a`, `.wav`). The upload refuses a name that is taken and
treats a file of that name holding exactly the take's bytes as an earlier save
of it, so a retry never makes a second copy.

The list holds the folder's audio files that are not in the Trash, newest
first, with lengths the browser decodes. A recording plays from its own file in
an `<audio>` element, with its decoded waveform. Rename keeps the extension and
is refused for a name the folder already has. Delete moves the file to the
drive's Trash, from where Finder can put it back. Trim keeps the stretch
between two sliders, channel by channel, and uploads it as a 16-bit WAV file
under the same title; the original goes to the Trash only after that upload
succeeds. A take the drive refuses stays in the list as a "Not saved" row with
Retry and Discard. Recently Deleted, under the list, shows what of the folder
is in the Trash, plays it, and has Recover and Delete; File, the toolbar and a
row's menu have Share, for the apps that take files. Preferences, at
`/api/voice-memos/preferences` (`src/apps/voice_memos/`), choose whether a take
is written in the browser's format or as WAV, and when a recording in Recently
Deleted leaves the drive: at once, after 1, 7 or 30 days (the default), or never.

`node e2e/voice-memos-journey.mjs` gets Voice Memos and records about three
seconds with the browser's fake microphone, finds the file on the drive and in
the list after a reload, plays, renames, trims and deletes it, and removes
everything it made. Firefox plays sound only with an audio output device, so
on a headless Linux host start one first (`pulseaudio --start
--exit-idle-time=-1` gives PulseAudio's null sink). It also checks, in a second
browser whose microphone the browser denies, that Voice Memos says it is not
allowed to use the microphone and records nothing, and that another person sees
none of the recordings. Chromium denies its permission prompt only when headed,
so that step needs a display (`DISPLAY`) for Chromium.

### Find My

Find My does not come with the desktop: get it from the App Store first. The
window (`demos/find-my/find-my-desktop.tsx`) asks the browser for its position
with the Geolocation API and reports it to `src/apps/find_my/`, which keeps each
browser as one of the person's devices in the person's own space. Every browser
signed in to an account is a device of that account; before anyone signs in,
the browser's session is the person. A device is named by a hash of its
browser's own id (`Session::browser`, the id of the browser's first session,
which every later session of that browser carries through sign-ins and
sign-outs), so a browser stays one device, nobody else's request reaches it
whatever id it names, and there is no sharing between accounts.

- `PUT /api/find-my/me` with `{"lat", "lon", "accuracy_m", "label",
  "reported_at"}` records this browser's position. `reported_at` is when the
  browser made the report, by its own clock, and a device keeps its newest
  report by that time, with compare-and-set: a report no newer than the stored
  one (an older one that arrives late, or a second one made in the same
  millisecond) changes nothing and is answered with the stored device and
  `"applied": false`. A report dated more than ten minutes ahead of the
  platform's clock is refused with 400, so a fast clock that is then set right
  holds its device for at most that long.
- `GET /api/find-my/devices` lists the person's browsers with their last
  position and when the platform received it, this browser first, then the 50
  most recently seen. A stored device that cannot be read fails the listing
  with 503 rather than being left out, until its browser's next valid report
  replaces it.
- `POST /api/find-my/devices/<id>/sound` asks that browser to play a sound the
  next time it reads the list; each request has a random id, and
  `DELETE …/sound?request=<id>` clears only the request it names.
  `DELETE /api/find-my/devices/<id>` forgets a device.

A device is forgotten 7 days after its last report, and a Play Sound request,
or the mark a played one leaves, after 10 minutes. `tests/find_my.rs` holds the module's routes, the ordering of
reports sent out of order and of two made in the same millisecond, and the
week's expiry; `tests/accounts_isolation.rs` holds that one account neither sees
nor changes another's devices, even by their real ids.
`node e2e/find-my-journey.mjs` gets Find My, reports the browser's fixed
position, plays a sound through the module, finds the device after a reload,
checks that a late, older report changes nothing, and removes the device.

### Weather and exchange rates

The `weather` module (`src/apps/weather/`) reads Open-Meteo's forecast and
geocoding services through the egress handle `weather`, declared down to those
two paths; the Calculator module (`src/apps/calculator/rates.rs`) reads the
European Central Bank's daily reference file through the handle `rates`,
declared down to that one file. Neither needs a key or a payment. Run
`ferrite dev --egress allow` to reach them locally. Open-Meteo's free service is
for non-commercial use, under about 10,000 calls a day, with attribution, which
the desktop's views show; a deployment that charges for itself needs its paid
plan or another source, such as MET Norway.

- `GET /api/weather/forecast?lat=&lon=`: the current reading and five days at a
  point rounded to two decimals, read for everyone at most every 15 minutes, with
  its `source`, the source's local `observed` time and `read_at`. When Open-Meteo
  cannot be reached in two tries, a reading of the last 3 hours is answered with
  `stale` saying why; with none, 200 `{"unavailable": why}`, since Maps and Today
  ask without the person asking.
- `GET /api/weather/places?q=`: at most six places by name, kept for a week.
- `GET /api/calculator/rates`: units of each currency per euro, on the bank's
  `date`, read at most every 6 hours; `?update=1` asks now, at most once a
  minute. When the bank cannot be read, the last rates kept are answered with
  `stale` saying why.

With nothing kept, a bank or a place search that is down is a 502 saying so, and nothing of an
answer out of its documented shape is kept. Calculator's Convert menu, Spotlight,
Today's Weather widget, Maps and Siri read these routes and say the source and
its time beside what they show. Today's places are kept per person
(`weather.places`); `weather.useLocation` asks for the browser's position only
when the person presses Use My Location, and after that only when the browser
says the permission is already granted. Temperatures follow Language & Region.

### Stocks

Stocks does not come with the desktop: get it from the App Store first. Its
module, `src/apps/stocks/`, reads market data from one provider behind
`provider.rs`: today CNBC's public quote, chart, symbol and RSS services, which
need no key, through the egress handle `stocks` in `ferrite.json`. Live quotes
are therefore on with no secret to set; run `ferrite dev --egress allow` to
reach them locally. CNBC's services are not a licensed data feed, promise no
service and their terms were not checked for redistribution, so a deployment
with real traffic should add a keyed provider (Finnhub or Polygon, say) as a
second `Provider`, its hosts under the `stocks` handle and its key as a Ferrite
secret.

Every provider call goes through `src/apps/fetch.rs`, which sends the
application's `user-agent` (CNBC's services refuse a request without one),
gives up after at most 5 seconds (a quotes call that waited for another gets
what its request has left), inside the 8-second API deadline, and refuses an
answer over 1 MiB, as egress itself does. Each answer is read strictly and
kept for everyone in the module's shared space; one that is out of its
documented shape fails the request with 502, naming the mismatch, and nothing
of it is kept.

- `GET /api/stocks/quotes?symbols=AAPL,.SPX` (at most 50): the quotes of the
  symbols kept from the last minute, and one provider call for all the others.
  Only one quotes call is on its way at a time for the whole application, held
  by a lease in the shared space. A request that finds the lease taken waits
  for that call's quotes instead of asking again, and leaves the symbols that
  call does not ask for in a shared list. The request that takes the lease next
  asks for them in its own call, its own symbols first and at most 50 in all;
  those that do not fit wait for the call after. So requests that waited for
  one call are mostly answered by the next one, not each by a call of its own
  in turn. The list is a hint: when it cannot be read or written, each request
  calls for its own symbols, as before. The call is given no more time than its
  request and its lease have left. A symbol the provider does not know is
  listed under `missing`, and kept as unknown for the minute too, so it is not
  asked for again either. A request that arrives while a slow call is on its
  way still waits for it, and answers 503 if that call outlasts its time.
- `/chart?symbol=&range=` (`1D` to `2Y`, kept two minutes for the day and an
  hour otherwise), `/search?q=` (kept a day) and `/news` (CNBC's Business News
  and Earnings feeds, kept ten minutes; when one feed fails, the other's
  stories are answered and kept for a minute only).
- `GET`/`PUT`/`DELETE /watchlist` and `/alerts`: the person's own documents
  under the revision rule. A stored document is held to the same rules as a
  `PUT` when it is read, and one that breaks them is answered 503 rather than
  shown or acted on. A price alert fires once, on the server, when a quote
  fetched for the person crosses it; a `GET` of the alerts checks those that
  have not fired, which is how Notification Center fires them while the window
  is shut.

The watchlist can be reordered in the window: Share > Move Up and Move Down for the symbol shown,
Option-Up and Option-Down Arrow on a row, or a row dragged onto another. Each new order is saved in
the person's watchlist, so it is kept across reloads and restarts, and no other account sees it.

The window asks each watchlist symbol's day chart for its sparkline, so a page
of N symbols is N chart requests to the application a minute; they cost the
provider at most one call per symbol every two minutes for everyone, but
several windows missing the same expired chart at once may each ask for it.
`tests/stocks.rs` holds the module without a provider (bad requests, 502,
the revision rule, quotes and unknown symbols answered from the cache, the
lease's wait and a lapsed lease, an alert fired once against a kept quote,
stored documents that break the rules); the parsers of CNBC's real answers are unit tests in
`provider.rs`, and `tests/accounts_isolation.rs` probes both documents.
`node e2e/stocks-journey.mjs` (under `ferrite dev --egress allow`, as a Guest
User) reads real quotes, charts and the news, adds a symbol found by the
search, sets a price alert that fires on the server, finds both after a reload
and removes the symbol again.

### Mail

Mail is mail between the accounts of this desktop (`src/apps/mail`). Every
person has their own mailboxes, kept in their own space: each message is a
header (`m/<id>`, what the list shows and the first 4,000 characters of its
text) and a body (`b/<id>`, its full text and its styled text). An id sorts
newest first. `GET /api/mail/messages` answers at most 500 headers, and about
1 MB of them, at a time, with a `next` cursor (`?after=`), so a page of long
previews stays under the reply limit; before anyone signs in it answers an
empty list. A
body is refused when its text and styled text together pass 190 KB, one stored
value. `POST /api/mail/send` resolves every recipient by account name
(`martin`, `martin@macalicious`, `Martin Klein <martin@macalicious>`, `Martin
Klein (martin)`) and refuses the whole message, naming the addresses, when one
is not an account (`422 {"unknown"}`) or is an internet address (`422
{"outside"}`). A body with a field Mail does not name, such as `attachments`,
is refused (400) rather than sent without it.

Delivery writes the recipient's copy into the recipient's own space, body
first and then the header, created only if absent. The sender gets a Sent
copy, the recipient a notification, and both a move of their Mail change count
on their personal stream (`/live/me`), which makes their open Mail windows read
the mailboxes again. With the browser's `idempotency-key`, a resend within a
day continues what the first delivery did, to the accounts the first attempt
resolved, and stores nothing twice. A person sends at most 200 messages a day
(`SENDS_PER_DAY`, counted in their own space by `src/apps/allowance.rs` once
the send's record is its own; 429 past it, and a resend takes nothing), which
bounds what one account can make the others keep. A Guest User, which needs
no account and whose count ends with it, sends no mail (403). Read, flags, mute and moves are a `PATCH` of one header.

Mail's New Message window uses the editors' shared path: while it is the window last used, the
desktop's Edit menu (Undo, Redo, Cut, Copy, Paste, Select All) acts on the message, as in Notes,
TextEdit and Stickies, and its Fonts panel dims the families the browser cannot draw, saying why.
`e2e/mail-compose-editor-journey.mjs` checks both. The Edit menu acts on the message only; in the
To, Cc and Subject fields the keyboard's own editing keys work.

Closing a New Message window saves what it holds as a draft (`POST
/api/mail/drafts`); the window closes only once the draft is kept, an emptied
saved draft is erased, and a draft opens again with its whole text and styles.

A message is erased (one at a time, or the Trash with `DELETE /trash?after=`,
at most about 2,000 entries a request, answering `more` and `next` while there
is more) by a compare-and-set that turns its header into a tombstone at the
version found in the Trash, so a message moved out of the Trash meanwhile is
never erased. The body is deleted next, and only then is the tombstone marked
finished and given a day's expiry, so a resend of a send never delivers an
erased copy again. An erasure that stopped before its body was deleted keeps
an unfinished tombstone, which the next listing that reads it finishes. A
delivery that finds its copy erased by the time its header write loses deletes
the body it wrote.

The window reads the mailboxes when it opens, when it gains focus, when the
person's Mail change count moves, with Get Mail and after the person's own
sends and saves, one read at a time. A read keeps the window's own copy of a
message whose flag, read state, move or erasure is still being sent. The first
two pages (1,000 messages) are read; with older mail on the server the list
says "Older messages are not loaded." with Load More. A send that gets no
answer, or a server error, holds its New Message window as it is, with Send
still available under the same key and the window not closable, so the message
is delivered once whatever happened; Edit Anyway lets it go. **Known limits:** search covers the messages read, and a message's
first 4,000 characters until it has been opened. A draft save carries the
browser's idempotency key: a save whose answer was lost and is made again (the
window closed again with the same draft) is stored once, for a day
(`draft-key/<hash>` pins the draft's id). Two different saves racing to replace
one draft can still leave both.

Outside (internet) email is not offered, by the owner's decision: no
outside-mail provider is configured or included, and an outside address is
refused by name, with the reason.

`tests/mail.rs` checks delivery between two accounts and nowhere else,
resends, refused addresses and fields, flags, moves, drafts, paging past 500
messages, the Trash, an unfinished erasure and the daily allowance. The
two-person journey (Chris writes to Martin with a bold word; Martin's desktop
shows a banner, Get Mail brings it into his open Inbox, he sees it bold and
replies; Chris flags, searches and trashes, and everything is kept after a
reload) needs a pepper in `ferrite.local.toml`, as for every journey with
accounts:

```bash
node scripts/pack-site.mjs && ferrite dev --port 8787
node e2e/mail-journey.mjs --url http://127.0.0.1:8787 --browser chromium   # or firefox, webkit
```

### Messages between accounts

Besides the public rooms ("Example: Messages" below), Messages holds
conversations between accounts (`src/apps/messages/conversations.rs`): one to
one, groups of up to 10, or a conversation with oneself. A conversation is one
document in the shared space, `convs/<id>`. Members are kept by account id
(the session's principal), so the same person in two browsers is one member. A
one-to-one id is derived from the two account ids, so writing to the same
person again finds the same conversation. An id is not a secret, so every
route checks that the caller is a member, and everyone else is answered 404. A
conversation is never on the public live feed: a stream open carries no
session, so `/live/messages/<id>` refuses a conversation's id. Every change
moves each other member's Messages change count on their own personal stream,
and their open windows read the conversation again through `GET
/api/messages/conversations/<id>`, which answers members only.

The document holds its members (account ids kept on the server, names shown),
an optional group name, its newest messages, a small receipt of every keyed
message for 15 minutes (a resend is stored once, and the same key with another
message is refused; the 200 receipts are shared out equally among the
members, and a member whose share is full drops their own oldest receipt for a
new one, so nobody waits), each member's read position and when each member last typed. It
stays within 100 messages and 150 KB: older messages move to pages of at most
50 messages and 120 KB, each written once under a fresh name
(`convs/<id>/p/<n>-<random>`) before the compare-and-set that drops them, each
naming the page before; `GET .../history?page=<name>` reads them back from the
conversation's `older`. Unread counts are the messages after the member's read
position. Each member has `convs/<id>` in their own space, holding when the
conversation was last written to (a time that only moves forward), which is
how their list finds the most recent. A message tells every other member
through Notification Center. A person starts at most 100 conversations and
writes at most 2,000 messages a day (429 past them), and a Guest User starts
none (403): nobody can address a guest, and a conversation would outlive it. A
start naming more than 10 people is refused before any name is looked up.

**Do Not Disturb** (a conversation's Details) is kept per account on the server
(`/api/messages/muted`, keys `muted/<id>` in the person's own Messages space, at
most 200): a muted conversation's messages send that person no notification,
while the messages still arrive unread. Each room is muted on its own
(`room-<room>`). It survives a reload and a restart of the server, and another
account never sees it.

The window reads the open conversation when the person's Messages change count
moves, when it gains focus and every 15 seconds while the page is visible, one
read at a time (a change heard during a read is read after it). The list
follows changes at most every 5 seconds, since typing and read receipts move
the count too and a list read reads up to a hundred conversations. **Known limits:** a message is held only
in the open window until the server takes it. A read position is always kept,
for unread counts, and shown to the others only when the reader's window sends
`receipt: true`; the served desktop sends it unless Messages > Preferences
turns read receipts off. Tapbacks (love, like, dislike, laugh, emphasize,
question) and replies are kept on the messages they belong to; a tapback can
be set only on a message among the newest hundred. The list is read from an index ordered by
activity (`recent/<inverted time>/<id>` beside `convs/<id>` in the person's space), so it is
always the person's most recent conversations however many they have been in; an account made
before this index has its older entries copied in by its first list. A member of a group (three
or more) can leave it from Details (`POST .../leave`): it goes from their list, they can no
longer read or write it, and the others are told. A conversation of two cannot be left.

`tests/messages.rs` checks two accounts messaging and a third reaching
nothing, through real personal streams (and the public feed refusing a
conversation), one account in two browsers, resends, groups and their names,
unread counts across history pages, Guest Users and the daily allowance. The
journey (three people, to include a group; Ann's isolation is checked by who
is in each conversation, and her session is refused Chris and Martin's
transcript):

```bash
node e2e/messages-journey.mjs --url http://127.0.0.1:8787 --browser chromium   # or firefox, webkit
```

Cut from this version of Mail and Messages, because review kept finding
storage that was never reclaimed: attachments (Mail's Attach, Markup and
Photo Browser stay dimmed and say why, "Attachments are not available: this
Mail sends text and styles only, and keeps no files with messages.", as their
tooltip and description, and a request carrying attachments is refused;
Messages' Record audio says the same of audio messages), and the background
transcript cache of conversations that are not open. 

A web address in a message (a Messages bubble, a Mail body, plain or styled) is a link that opens
in Safari in a new tab (`openUrl`, `demos/desktop/desktop-open-url.ts`), never in the desktop
page; only absolute http(s) addresses with a host and no user name become links, and anything
else stays text. The links are built from the message's text, never parsed as HTML.

### Example: Calculator

Calculator computes in the browser. Its module, `src/apps/calculator/`, keeps
a session's paper tape:

- `GET /api/calculator/tape` answers `{"entries": [...]}`, oldest first, at
  most 100 entries. Entries are ordered by a per-session sequence number, not
  by clock, and the store keeps only the newest 100.
- `POST /api/calculator/tape` with `{"expression": "12+3", "result": "15"}`
  appends an entry and answers 201. When the request carries the browser's
  own `idempotency-key`, a resend with the same key in the same session,
  within a day, answers 200 with the same entry and appends nothing, even
  when deliveries race. A resend after the entry was cleared or dropped by
  the 100-entry limit answers the same way and does not bring the entry
  back. A POST without the header is appended every time it arrives.
- `DELETE /api/calculator/tape` clears every entry admitted before it. It is
  not deduplicated: a DELETE that is sent or delivered again clears again,
  including entries appended in between. An append admitted before a clear
  whose write lands after it is never shown, and the append removes its
  entry itself.

A keyed append is marked done only after its entry is written and the tape
is pruned to 100. One that dies partway is finished by its next delivery. An
unkeyed append that dies partway is not resumed, and the next append prunes
whatever it left.

The Calculator window records each finished calculation on the tape and shows
it under Window > Show Paper Tape (`demos/calculator/calculator-tape.ts`). It
reads and writes the per-session tape with ordinary requests to
`/api/calculator/tape`, through `sessionFetch` and `withDeadline`; there is no
stream route for the tape, and the window loads it once when it opens, so
another window or browser sees new entries only after it is opened again. The
browser journeys and `tests/desktop.rs` exercise the tape route.

## Live updates

Messages and Chess update without a reload: a message sent in one browser
appears in every other browser showing that room, and a move on one board
appears on the other player's. The pages subscribe to a stream route,
`/live/<app>/<document>`, which answers with server-sent events
(`src/live.rs`):

| Route | Kind | What answers |
| --- | --- | --- |
| `/live/` | `stream`, through the `live` queue | one producer per subscription, sending frames through the `frames` queue |

- The first event, and one after every change, is `state`:
  `{"version": n, "state": …}`, the whole document with its store version.
  A page that missed an event, or reconnected, loses nothing by taking the
  newest one.
- Each producer reads its document's version every 250 ms. Reading the
  store, rather than passing notes between tasks, keeps it right across
  restarts: whichever process wrote, the version moves.
- After 5 seconds without a change a `ping` event follows. A process that
  dies leaves the connection open but silent, so the pages reopen a feed
  that has said nothing for 12 seconds.
- A subscription ends itself after 5 minutes (measured on the platform clock)
  with a terminal `ended` event, and `EventSource` reconnects. One process
  serves at most 128 subscriptions (`busy` beyond that); a path that names no
  document gets a terminal `refused`.
- Frames go out through `frame_publish` in `src/live.rs`. Ferrite Cloud's
  gateway ends a stream session at the first frame that carries no number, so
  a plain `publish` closes the stream with nothing delivered, even though the
  queue accepts the frame and `ferrite dev` streams it. The hosted builder's
  SDK numbers frames with `FramePublish`; the CLI 0.1.20 twin has no such trait
  and its Forge takes plain frames. The module picks whichever the SDK offers.
  A browser that closes its stream leaves one small numbering entry in the
  hosted process until the process ends.

The route is `/live/`, not under `/api/`, because a route's kind belongs to
its prefix and `/api/` is an `api` route. Upstream Core forwards no request
headers on a stream OPEN, so a subscription has no session: a feed is public
to anyone who can name it, and serves only documents in a module's shared
space (`storage.shared()`).

A module adds a feed by exporting a `LiveFeed` (`app`, `key`: the rest of the
path to a key in its shared space, `view`: the stored bytes to the JSON a page
receives) and listing it in `FEEDS` in `src/apps/mod.rs`. Write the document
with `put_if_version`, so concurrent writers never lose each other's changes.

Known limit with more than one instance: the OPEN and the close of one
subscription can reach different processes, so a producer may miss its close
and run to its 5-minute deadline, and a redelivered OPEN may start a second
producer. Both send whole states with versions, which pages de-duplicate.

The person's own stream, `/live/me`, opened with a ticket from
`POST /api/session/ticket`, carries their notifications, Do Not Disturb and,
for each module, how many changes they have made and which browser made the
last one, and when the count began (`src/apps/notification_center/`). The
router counts a change after every write a module answers below 400, and names
the change's number in the reply's `x-macalicious-change` header. The page
(`demos/desktop/desktop-live.ts`) keeps the numbers of its own writes, and of
the writes another tab of the browser tells it of, and loads an app's documents
again only for a change it holds no number for. A change counted while the
page's own writes to that app still wait for their replies may be one of
theirs, so it waits for those replies, never past the 15-second request
deadline, and only a reply naming that very change takes it away; when more
such changes wait than writes are under way, the app is loaded at once. A count
that starts again, lower or with another beginning, loads the app; one that is
gone loads it only if a change of it was still waiting.

### Example: Messages

A room is one document, `rooms/<room>`, holding its newest 200 messages and,
apart from them, a receipt for each keyed message of the last 15 minutes (at
most 1,000): the stored message and the SHA-256 of its name and text.

- `GET /api/messages/me` answers `{"author": "<id>"}`, the public id (the
  first 16 characters of the session id) this session's messages carry.
- `GET /api/messages/rooms/<room>` answers `{"version", "state":
  {"messages": [...]}}`, the feed's body, or 409 when the stored room cannot
  be read; the feed then sends `{"unreadable": true}`, with no messages.
- `POST /api/messages/rooms/<room>` with `{"text", "name"}` appends one
  message (`seq`, `author`, `name`, `text`, `at_ms`) and answers 201. Text is
  1 to 1,000 characters. With the browser's `idempotency-key`, a key the
  receipts know answers 200 with the original stored message when the name
  and text match, even after it has left the newest 200, and 422 when they do
  not; an unknown key is stored as new. The key check and the append are one
  compare-and-set.
- `GET /live/messages/<room>` is the room's feed.

The desktop's Messages window shows the room `desktop` (or `?room=<id>`) as
"Ferrite Room". Each message gets one idempotency key for its whole life.
The window sends one message at a time; each attempt (request and answer)
fails after 10 seconds, and failed attempts are retried with the same key
until 10 minutes after the message was created; a message still waiting for
its turn then is not sent on its own any more. A message without Delivered
is on its way. One the server refuses, or still unanswered after those 10
minutes, shows Not Delivered with Try Again. Try Again first reads the room
(`GET /api/messages/rooms/<room>`) and looks for the message's key: a message
found there is taken as stored and sent no more. Otherwise it sends the
message once more with the same key (one attempt; if the read or the attempt
fails, the message shows Not Delivered again). A feed state without a messages array says the server cannot read the
conversation, with Reload.

Known limits of this design:

- A message is found by its key only while it is among the room's newest 200.
  Try Again more than 15 minutes after a stored message whose answer was lost,
  once that message has also left the newest 200, adds it again; the original
  is no longer shown by then.
- A room that takes more than 1,000 keyed messages in 15 minutes drops the
  oldest receipts early; automatic resends of those messages can then add
  them twice.
- Pending messages live in the page: reloading it forgets the ones not yet
  stored.

### Example: Chess

Chess has two kinds of game. An open board, `games/<game>` in the shared
space, is a game any browser naming it can join; the desktop's board plays one
when the page's address carries `?game=<id>`. A game of the person's own,
against the computer or against another account, belongs to its players: only
they can read it or move in it, and the window plays these when the address
names no board.

- `GET /api/chess/me` answers `{"author"}`, the public id this person plays
  under, and for a signed-in account `name` and `full_name`.
- `GET /api/chess/mine` answers `{"games", "invitations"}`: the person's
  newest 30 games, each summed up (opponent, side, status `invited`,
  `playing` or `over`, winner, reason, plies), and the invitations among them
  waiting for this person's answer. A game the server cannot read is listed as
  `{"id", "status": "unreadable"}`.
- `POST /api/chess/games` with `{"computer": {"side", "level"}}` (level 1
  to 4) makes a game against the computer. Its owner holds both seats, and
  the owner's page chooses the computer's moves and sends them like its own.
- `POST /api/chess/invitations` with `{"to": "<account name>", "side":
  "white" | "black" | "random"}` invites another account. The game is written
  first, with both seats taken, then put on the inviter's list and delivered
  to the invited person's `invitations`, and the invited person gets a
  notification with Accept and Decline. A person may have at most 12
  invitations waiting for an answer, at most 3 of them from any one person;
  the check and the delivery are one compare-and-set of that document, and a
  new invitation past either limit is refused rather than push one out. An
  unanswered invitation stops counting after a week. Both creating routes
  take the page's `idempotency-key`: a resend gets the game the first
  delivery made (`200`), and the same key asking for another game is refused
  (`409`). Games of one's own need a signed-in account, and a Guest User
  cannot invite.
- `POST /api/chess/games/<game>/accept` and `.../decline` are the invited
  person's answer; the person who invited withdraws the invitation with
  `decline`. `.../resign` gives up a game in progress. Each resend of an
  answer that stands answers `200`.
- `GET /api/chess/games/<game>` answers `{"version", "state"}`. For a game
  that belongs to its players, anyone else gets `404`, as for every write.
- `POST /api/chess/games/<game>/plies` with `{"number", "ply", "from",
  "to", "promotion"?}` or `{"number", "ply", "draw": true}` adds ply `ply`
  to game `number` and answers `201` with the new state. On an open board the
  first person to move a side holds it (`403` for anyone else); a game
  between accounts takes moves only once accepted and until it ends; a stale
  ply or game, a move the rules refuse, or a draw that cannot be claimed gets
  `409` with the current state; a resend of the same ply gets `200`.
- `POST /api/chess/games/<game>/new` with `{"number"}` starts an open
  board's next game; once a side is held, only the two players may.
- `POST /api/chess/games/<game>/reset` deals with a stored game the server
  cannot read: one on the person's own list is taken off it (a game against
  the computer is deleted with it), and an open board starts again at its
  first game. An id this module made (32 hex digits) is never taken for an
  open board, so a resend of a reset finds nothing to do. A game that reads is
  left alone (`409`).
- `GET /live/chess/<game>` is an open board's feed. A stream open carries no
  session, so the feed never shows a game that belongs to its players: it
  sends `{"private": true}` for one. Instead every write to a game between
  accounts, and every resend of one, counts a change in the other player's Chess
  (`notification_center::touched`), which their own personal stream carries
  to their pages, and the pages read the game again.

The server replays the plies with the rules of chess
(`src/apps/chess/rules.rs`, a port of `demos/chess/chess-game.ts` checked
against published perft counts) and adds only a legal move or a draw the side
to move may claim, so every stored game is one the pages can replay; a replay
moves in place, a ply's work at a time. Each person's list (`games/<id>` in
their own space) keeps the newest 200 games, and only the person's own
requests put a game on it: the inviter's when the invitation is sent, the
invited person's when they accept. Nobody else's request can push a game off
it. A game against the computer that leaves its owner's list is deleted, since
nobody else can reach it.

The desktop's Chess window (`demos/chess/chess-account.tsx`) shows a move once the
server has it and keeps no game of its own; it opens on the person's newest game still
being played, or on an empty board that asks for New Game, and never starts a game by
itself. Against the computer it chooses the computer's moves in a Web Worker
(`demos/chess/chess-engine.worker.ts`), so the desktop goes on answering while it thinks,
and drops a move found for a position the game has since left. With `?game=<id>` in the
page's address the window plays that open board instead (`demos/chess/chess-live.tsx`).

Known limits: a game between accounts stays in the shared space after the
lists that held it have let it go; and four accounts that each send three
invitations can keep a person from receiving more for a week, unless the
person declines them.

### Example: FaceTime

FaceTime makes audio and video calls between two accounts. Ferrite carries no media: sound
and picture go peer to peer between the two browsers over WebRTC, with a public STUN server
to find each side's address, and the module (`src/apps/facetime/`) is only the signalling.
There is no TURN relay, so two browsers that can reach each other only through one (both
behind strict NAT) do not connect, and the window says so. A call is one document in the
shared space, `calls/<id>`, with a random id given only to its two members; each member's
line for it is in their own space (`recents/<id>`).

- `GET /api/facetime/me` answers `{"name", "full_name"}`, or `{"name": null}`.
- `GET /api/facetime/calls` answers `{"recents", "incoming", "active", "server_ms"}`: the
  person's newest 100 calls, the call ringing for them, and the call they are in. Reading it
  brings the person's unfinished calls up to date: a call rings for 45 seconds and is then
  missed.
- `POST /api/facetime/calls` with `{"to": "<account name>", "kind": "audio" | "video",
  "page": "<token>"}` and the page's `idempotency-key` places a call and answers `201`; a
  resend gets the call the first delivery placed. The callee gets an alert with Decline and
  Answer. A person holding a seat in another call is refused (`409`, with that call).
- `GET /api/facetime/calls/<id>`, for a member only, answers `{"version", "state",
  "server_ms"}`. With `?seat=<n>` from the page holding seat `n` it is also that page's sign
  of life.
- `POST /api/facetime/calls/<id>/join` with `{"page"}`, `.../decline`, `.../leave` with
  `{"seat"}`, and `.../signal` with `{"from", "to", "offer", "revision"}` or `{"from",
  "to", "answer", "generation"}` answer with the call. Anyone else gets `404`.
- `DELETE /api/facetime/calls` clears the person's finished calls, and
  `DELETE /api/facetime/calls/<id>` one of them; a call in progress stays listed.

Every page names itself with a random page token, and each join takes a seat, a number that
only grows, tied to that page. A resend of the same page's join keeps its seat; another page
(a reload, a second tab) takes a new seat, which replaces the old one. A join carries the
page's `idempotency-key`, and a member's last eight join keys are kept, so a join delivered
again after a later page took the seat changes nothing. A person holding a seat in one call
can neither place nor answer another. A leave or a signal
names the sender's seat and counts only while the account still holds it, so a hang-up from a
page that has been replaced, arriving late, never ends the call of the page that replaced it.
A page in a call reads it every few seconds, which refreshes its seat at most every 8
seconds; a seat not heard from for 25 seconds has gone (its tab closed without hanging up),
and the call ends. The member with the later seat offers to the earlier one, which answers;
offers and answers are whole descriptions with their candidates gathered, at most 64 KiB
each, and the stored call is kept under 180 KiB. The other member hears of every change
through their own personal stream (`notification_center::touched`), and there is no feed for
a call. A call is kept in the shared space for a day after it was last heard of (it ended, or
it was placed or read), for a late request of one of its pages to find it ended, and then goes
by itself; each member's line keeps the history. A refusal (`409`) of an action on a call
carries the call as it stands, so a page that sent an out-of-date signal takes the newer
state first.

A person's list is pruned to its newest 100 finished calls by their own looks only (at most
50 lines a look), never by the caller's request. One person may ring another at most 10 times
an hour, and a call to someone whose list already holds 300 lines is refused until they look. A Guest User's line is written only by the guest's own requests, so it keeps the
guest's expiry; the guest's next look brings it up to date.

A person is in one call at a time: placing or answering claims their seat with compare-and-set
before the call is written, so of two windows placing or answering at the same moment one is
refused (“You are already in a call.”). Known limits: many accounts calling one person can
still fill that person's history, ten calls an hour each; and in Playwright's WebKit 26.6 on Linux
a received camera picture reads black (either side's, the side varying between runs), an engine
limit: Chromium and Firefox show both.

The desktop's FaceTime window (`demos/facetime/facetime-live.tsx`) runs one operation at a
time (placing or answering), bound to a token that End and Decline revoke, so a cancelled
request is never sent again. A call whose reply was lost is unknown, not failed: the window
reads `GET /api/facetime/calls` again a few times over the next 16 seconds, and takes up a call
its page holds while the person wants one, or leaves it from that seat when they no longer do.
A call another page holds (a second tab) is offered with Join Here and End, never taken up by
itself; closing the window or the tab hangs up from its seat.

### Running the app journeys

`ferrite dev` keeps everything in one file, `.ferrite/state/world.json`, and rewrites it whole every few
seconds. It grows with each journey's accounts. At about 150 MB, live stream frames arrive about every
6 seconds instead of within a quarter of a second, and a journey step that waits 5 seconds for one
fails. Before judging live-update timing, restart the server with `ferrite dev --fresh`.
With `ferrite dev` running, `node e2e/textedit-journey.mjs`,
`node e2e/font-book-journey.mjs` and `node e2e/help-viewer-journey.mjs` (each
with `[--url …] [--out <dir>]`) open the app from the desktop, change its data,
reload, and check that the change came back from the server. Each removes the
data it wrote at the end and exits 0 only with every step passed and no
console or HTTP error. `node e2e/launchpad-journey.mjs` moves an app and turns
the page, then checks both after a reload. `node e2e/app-store-journey.mjs` gets
Books and finds it in the Dock and Launchpad after a reload, uninstalls it from
the account page, gets it again and deletes it from Launchpad with Option held.
`node e2e/force-quit-journey.mjs` quits Maps from the Force Quit window.
`node e2e/console-journey.mjs` watches a Calculator write appear in Console
without a reload and checks that no log entry carries the session cookie.
`node e2e/activity-monitor-journey.mjs` finds Calculator and its windows,
checks the Ferrite view's requests, server time and store calls for it and the
Network view's round trips, and quits it with Quit Process.
`node e2e/about-this-mac-journey.mjs` and
`node e2e/system-information-journey.mjs` check that the windows show the
application's facts and the browser's, and no hardware facts.
`node e2e/home-journey.mjs` gets Home, switches a light and runs a scene, and
finds both after a reload. `node e2e/keychain-access-journey.mjs` makes a
keychain and adds a password, checks that no request and nothing stored holds
them unencrypted, then unlocks it after a reload.
`node e2e/storage-management-journey.mjs` puts files of each kind in a
person's drive, checks the report and the window against the quota, empties
the Trash, erases a large file and forgets the keychain (each confirmed), and
checks that a second person's drive is empty. `node e2e/spotlight-journey.mjs`
(under `ferrite dev --egress allow`, for Dictionary) saves a contact, a sticky
note, a text file and a bookmark, finds each with the search route (the file
by its words, and again after a rename) and not as another person, works out a
sum and a conversion, opens Contacts with Return and opens a web search in a
new Safari tab. `node e2e/network-utility-journey.mjs` (under
`ferrite dev --egress allow`) looks up example.com, checks the resolver's
records in the Lookup pane, and finds the lookup listed after a reload.
`node e2e/notification-center-journey.mjs` fires a reminder's alert, has a
second browser write a message, and clears both from the panel.
`node e2e/photo-booth-journey.mjs` gets Photo Booth, takes a Sepia picture
with the browser's camera (Playwright's fake camera: Chromium's
`--use-fake-device-for-media-stream`, Firefox's `media.navigator.streams.fake`,
WebKit's mock camera with the camera permission), reads the photo and its JPEG
back from the server, finds it in the strip after a reload and deletes it with
the Delete key. `node e2e/books-journey.mjs` needs `ferrite dev --egress
allow`: a new account gets Books, searches the real Book Store, gets Alice's
Adventures in Wonderland, turns its real pages, adds a bookmark and a highlight
with a note, reloads and finds all three; a Guest User in a second browser sees
none of it but can read the shared text, and the same account in a third
browser opens the book at the same words with the same bookmark and highlight.
It allows a cover the source does not have (404) and Gutenberg not answering
once (a 502 the window asks again, which then succeeds), and nothing else. `node e2e/podcasts-journey.mjs`
follows a show from Top Charts and leaves the Up Next episode a minute in, and
finds both after a reload. `journey()` in `e2e/app-journey.mjs` takes
`launchOptions` and `contextOptions` by engine for such needs.
`node e2e/reminders-journey.mjs` needs `ferrite dev --clock-ms <epoch ms>`: it
sets Forge's clock to 8:00 and advances it past the 9:00 alert. On a hosted
app, which has no clock to drive, pass `--live --url <app URL>`. The browser
computes an alert as 9:00 on the due day in its own time zone, so the journey
runs it in the time zone whose clocks next show 9:00 and starts 90 seconds
before then: the alert fires when the platform's real clock passes it. A run
can wait up to an hour before it starts.
The journeys built on `e2e/app-journey.mjs` take `--browser
chromium|firefox|webkit` (Chromium by default). A screenshot that times out
(WebKit can leave a font loading for good) is logged as a warning, not a
failure, and `ferrite dev`'s own live-reload stream being closed by a reload
is not counted as a failed request.

`demos/keychain-access/keychain-access-races.test.tsx` covers two windows of
Keychain Access on one page: a window that seals an addition while another
window saves a newer keychain refuses its save instead of writing over the
other window's items, and an open Info dialog closes, taking the item's
password off the page, when another window replaces or forgets the keychain.

### Running the live journeys

With `ferrite dev` running:

```bash
PLAYWRIGHT_BROWSERS_PATH=<browsers> node e2e/live-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser chromium|firefox|webkit]
```

`--browser` picks Playwright's engine: Chromium unless it names Firefox or
WebKit.

Two browser contexts, in a room and game of their own, exchange a message each
way and play e4 and e5; the script checks that each reaches the other without
a reload, that the seats are right, and that the second browser cannot move
White. It exits 0 only with every step passed and no console or HTTP error.

`node e2e/chess-journey.mjs [--url …] [--out <dir>] [--browser …]` has two people make
accounts at the login window (`e2e/people-kit.mjs`) and open Chess: one plays the computer,
then invites the other by account name, who accepts from Games; each move reaches the other's
board without a reload, and a resignation and a replay of the finished game follow. Run it
under `ferrite dev` with a `ferrite.local.toml` that sets the `mac_password_pepper` secret
(any 64 hex digits for a local run).

`node e2e/facetime-journey.mjs` has two people call each other with the engines' fake cameras,
each painted a colour of its own, and checks that each browser shows the other's live picture,
carried over WebRTC; that the callee's second tab offers the call and takes it up when asked,
while the first lets it go; that hanging up ends it in both; and that a declined audio call is
a missed call in the callee's list.

Under `ferrite dev --chaos 8`, which kills the app every few seconds,
`node e2e/messages-chaos.mjs [--url …] [--count 15]` has two browsers send
messages and checks that both windows and the server's room hold every one
exactly once, numbered without gaps, in the order sent.

## Files

| Path | Role |
| --- | --- |
| `ferrite.json` | services (`site` blob, `requests`, `live` and `frames` queues, `data` store), bindings and routes |
| `src/lib.rs` | boot (site publication, API workers, the live loop) and the router |
| `src/live.rs` | the `/live/` stream route: subscriptions, producers, frames |
| `src/site.rs` | publishing the packed build into the blob, and a base64 decoder |
| `src/session.rs` | per-browser sessions |
| `src/http.rs` | `Response`, cookies, the cross-site guard |
| `src/module.rs` | the module interface: `AppModule`, `ApiCtx`, `Request`, `Storage` |
| `src/applog.rs` | the application's own log and request counters |
| `src/apps/` | the registry and one folder per app module |
| `src/apps/files/` | the drive: `/api/files/` lists it, `/api/files/ops` changes it, `/api/files/uploads` and `/api/files/content/<id>` move bytes. A save in place (`existing: "overwrite"`) names the `base` version it was made from and is refused with 412 when the file has another. `GET /api/files/versions/<id>` lists the versions a file keeps, `GET /api/files/versions/<id>/<version>?piece=<n>&count=<k>` reads one, `POST /api/files/versions/<id>/<version>/restore` with `{base}` makes it the file's bytes, keeping what it replaces, and `POST /api/files/versions/<id>/keep` with `{version}` marks the file's bytes as asked for (File > Save) |
| `tests/desktop.rs` | boot, publication, sessions and routing on the in-process Forge planes |
| `tests/live.rs` | the `/live/` route on the in-process Forge planes |
| `tests/facetime_chess.rs` | Chess invitations, answers, moves by the two players only and games against the computer; FaceTime calls rung, answered on a seat tied to a page, hung up, missed and ended by a closed tab, on the in-process Forge planes |
| `tests/textedit_font_book_help_viewer.rs` | TextEdit, Font Book and Help Viewer routes on the in-process Forge planes |
| `tests/launchpad_app_store.rs` | the catalogue, the App Store's library and Launchpad's layout on the in-process Forge planes |
| `tests/system_apps.rs` | the Console log, Activity Monitor counters, About This Mac facts and System Information report on the in-process Forge planes |
| `tests/system_apps_b16.rs` | the counted store handle and the router's timing in the request counters; Activity Monitor's Ferrite view; Spotlight's search of the drive's files and words, bookmarks, its store calls and bounds, and per-person isolation; Storage Management's drive report |
| `tests/storage_management.rs` | Home's homes, the keychain envelope, the usage report and every forgettable document on the in-process Forge planes |
| `tests/spotlight_network_utility.rs` | Spotlight's per-session search and bounds, Network Utility's refusals, history and missing egress, and Notification Center's forward-only mark on the in-process Forge planes |
| `tests/photo_booth_books_podcasts.rs` | Photo Booth's photos (refusals, resend, the 50-photo limit, deleting); the Books and Podcasts libraries per session; Books' library with its books, each person's reading of a book (refusals, the revision rule, one slot per book and at most 500, Forget emptying every slot), its store and text routes answering 502 when egress refuses and 503 without the handle, and a kept text served in parts from the generation its index names, fetched again once it has run out; and Podcasts' listed feed hosts, egress refusals and each person's queue, on the in-process Forge planes |
| `src/apps/mail/` | Mail between the desktop's accounts |
| `src/apps/messages/conversations.rs` | Messages conversations between accounts, members by account id, only members reach them |
| `src/apps/allowance.rs` | daily allowances of what one person may make others keep (mail sent, conversations started, messages written) |
| `tests/mail.rs` | Mail between accounts: delivery into the recipient's own mailbox and nowhere else, resends, refused addresses, flags, moves, drafts, paging, the Trash and the daily allowance |
| `tests/messages.rs` | Messages between accounts: conversations only their members reach (checked on real personal streams), one account in two browsers, resends, read receipts, typing, tapbacks, replies, history pages, Guest Users and the daily allowance |
| `scripts/pack-site.mjs` | builds and packs the desktop into `src/site_assets.rs` and `src/site_assets/` (generated, ignored) |
| `e2e/desktop-journey.mjs` | the Playwright journey under `ferrite dev` |
| `e2e/live-journey.mjs` | two browsers: Messages and Chess updating live |
| `e2e/chess-journey.mjs` | two accounts: a game against the computer, an invitation accepted, moves both ways, a resignation and a replay |
| `e2e/facetime-journey.mjs` | two accounts: a video call connected over WebRTC, taken up in a second tab, hung up, and a declined call missed |
| `e2e/messages-chaos.mjs` | Messages under `ferrite dev --chaos`: nothing lost or doubled |
| `e2e/textedit-journey.mjs`, `e2e/font-book-journey.mjs`, `e2e/help-viewer-journey.mjs` | each app's data kept across a reload |
| `e2e/launchpad-journey.mjs`, `e2e/app-store-journey.mjs`, `e2e/force-quit-journey.mjs` | Launchpad's layout and the apps got kept across a reload; Force Quit on the served desktop |
| `e2e/console-journey.mjs`, `e2e/activity-monitor-journey.mjs`, `e2e/about-this-mac-journey.mjs`, `e2e/system-information-journey.mjs` | the four windows that show the application itself |
| `e2e/home-journey.mjs`, `e2e/keychain-access-journey.mjs`, `e2e/storage-management-journey.mjs` | Home's homes and the encrypted keychain kept across a reload; the drive against its quota, and files and a document erased from Storage Management |
| `e2e/spotlight-journey.mjs`, `e2e/network-utility-journey.mjs`, `e2e/notification-center-journey.mjs` | saved data found by Spotlight; a real DNS lookup and its history; reminders and messages cleared from Notification Center |
| `e2e/photo-booth-journey.mjs`, `e2e/books-journey.mjs`, `e2e/podcasts-journey.mjs` | a camera picture uploaded, listed and deleted; a real Gutenberg book got, read, bookmarked and highlighted, kept across a reload and in another browser of the same person, and not seen by another person; Podcasts' follow and place kept across a reload |
| `e2e/mail-journey.mjs`, `e2e/messages-journey.mjs`, `e2e/people-kit.mjs` | two people: styled mail delivered, answered, flagged, searched and trashed; three people: a conversation started by account name, delivery, Read, typing, a tapback and a group, with Ann kept out by membership; the kit holds the shared steps of the journeys of several people |

## What is verified

Verified by running, locally only:

- `cargo test` and `ferrite test`;
- `ferrite check` and `ferrite check --target upstream`, which reports no SDK
  name missing upstream;
- `ferrite dev` serving the full desktop from the blob the app published;
- the browser journey passing.

Hosted on October 13, 2026: generation 1 is running, the app publishes all 281
frontend files (11,627,798 bytes), and Calculator's saved tape survives a page
reload in Chrome. The successful build is
`bj-1791904371325-04c0c901344f2a5a5f88e0b7e407aaf1`, with source digest
`f6affc3736ac9cfa5a223538806cfe995030411b95288e1923b4b188821cd2d4`.
Two earlier attempts remain in the journal: the oversized request started no
build, and the first accepted compilation rejected a log formatting expression
that assumed `generation()` implements `Display`. The app now uses `Debug`,
which supports both the local SDK's integer and the hosted optional value.
The successful deployment costs 15,000 micros; the rejected build costs zero.

Not verified by the hosted demo:

- every app's hosted browser journey or publication timing distribution;
- `ferrite check --remote`, the platform's own gate;
- behaviour with more than one instance;
- browsers other than Chromium for the journeys that do not take `--browser`.
  `e2e/live-journey.mjs`, `e2e/desktop-journey.mjs` and every journey built on
  `e2e/app-journey.mjs` (Home, Keychain Access, Storage Management, Spotlight,
  Network Utility, Notification Center, Photo Booth, Books, Podcasts and the
  others listed under "Running the app journeys") take
  `--browser chromium|firefox|webkit`.

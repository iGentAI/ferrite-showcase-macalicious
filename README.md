# Macalicious

Macalicious rebuilds the interface of macOS 10.15 Catalina as React components on
[Base UI](https://base-ui.com), in plain HTML, CSS and JavaScript. Every control is drawn with
CSS in the light and dark appearances and measured against the
[512 Pixels Aqua Screenshot Library](https://512pixels.net/projects/aqua-screenshot-library/macos-10-15-catalina/).
The repository also holds a desktop built from those components, with windows, a Dock, a menu bar
and 49 application demos, and a Ferrite application that serves that desktop with accounts, files
and data kept on the Ferrite cloud platform. The hosted desktop is at
[macalicious.ferrite.run](https://macalicious.ferrite.run/).

Macalicious is an independent demonstration; it is not affiliated with, sponsored by or endorsed
by Apple Inc.

```tsx
import { PushButton } from "macalicious/push-button";
import "macalicious/styles.css";

<PushButton>Cancel</PushButton>
<PushButton variant="primary">Go</PushButton>
```

This file serves two readers. The first half describes the component library and how its
fidelity is measured. The second half, from [Macalicious on Ferrite](#macalicious-on-ferrite),
describes how the desktop runs as a Ferrite application and how that application is verified.

## What it is

**A component library.** `src/components/` holds 161 components, one folder each: push buttons,
checkboxes, sliders, pop-up buttons, menus, toolbars, sidebars, table and column views, sheets,
alerts, windows and the parts of the desktop itself (Dock, menu bar, Launchpad, Mission Control,
login window). Behaviour, focus management and accessibility come from Base UI, which has no
styles; the appearance is this library's own CSS. A component can be used as a package import
(`macalicious/<name>`, one entry point per component, with a stylesheet the application imports)
or copied into a project as source with `npx macalicious add <name>`, in the manner of shadcn/ui.
The package is not published to npm, and `package.json` is marked private.

**A desktop and its applications.** `demos/` holds 50 demos. One is the desktop: a window manager,
the Dock, the menu bar and its status menus, Launchpad, Mission Control and Spaces, Spotlight,
Notification Center and the login window. The others are applications built from the library,
among them Finder, Mail, Safari, Calendar, Notes, Photos, Music, Messages, FaceTime, Maps,
TextEdit, Preview, Terminal, Chess and System Preferences. A demo is documentation first: it shows
how the components compose into a real window, and it is compared with its reference screenshot
as a component is. The demos are not part of the package.

**A documentation site.** `docs/` is a small Vite and MDX site with a page per component and per
demo, live examples, props tables read from the source, and guides for installation, theming,
building a window and building an application. The same folder scan writes the documentation as
plain Markdown for coding agents (`llms.txt`, `llms-full.txt` and a file per page), into the site
and into the package. The desktop is also built as a page that fills the browser window
(`docs/desktop/`).

**A fidelity method.** Appearance is measured and scored. Dimensions and colours are read from
the reference screenshots into a written specification (`reference/spec/`), the design tokens
take their values from it, and every token is tagged as measured, computed from measurements,
taken from a catalogue or provisional. The visual harness (`visual/`) then renders an example in a
real browser at 1x and 2x, crops the matching region out of a reference screenshot, and scores the
difference with a mismatch score and a mean colour difference, each against a budget declared next
to the component. For a state no screenshot shows, such as a pressed button, it checks the colours
of chosen pixels instead. At this commit the specifications hold 2,781 comparisons in 212 files.

## What it is based on

- **macOS 10.15 Catalina** is the visual reference, in its two appearances, Aqua and Dark Aqua,
  and its eight accent colours. The interface is Apple's design. No Apple font, icon, desktop
  picture or sound file is in the repository; see [Licensing](#licensing).
- **The 512 Pixels Aqua Screenshot Library** is the measurement source: 294 full-size screenshots
  of Catalina, all captured at 2x. They are third-party images and are not in the repository.
  `reference/manifest.json` catalogues each one with its source URL, dimensions and SHA-256, and
  `npm run reference:fetch` downloads them for local use.
- **Base UI** (`@base-ui/react`) is the component foundation. It supplies behaviour and
  accessibility without styles, which is the division this library needs.
- **Plain HTML, CSS and JavaScript.** There is no Tailwind and no CSS-in-JS runtime. Tokens are
  CSS custom properties named after AppKit's semantic colours, each appearance-dependent value is
  written once with `light-dark()`, and state such as size, variant and whether a window is key is
  carried by `data-*` attributes, so a control needs no context or listeners for its look. The
  cost is a browser baseline of Chrome and Edge 123, Safari 17.5 and Firefox 128. React 19 is a
  peer dependency.

[ARCHITECTURE.md](ARCHITECTURE.md) gives each of these decisions with its reason.

## Macalicious on Ferrite

### The application

`ferrite-apps/desktop` is a Ferrite application named `macalicious-desktop`. A Ferrite
application is one constrained Rust crate: it names exactly one runtime dependency, the SDK
`ferrite-app`, has no build script, and may not read files at compile time, and the platform's
admission gate refuses a submission that breaks those rules. What the application may use is
declared in `ferrite.json`: its storage services, its routes and every outside address it may
call. The crate serves the same desktop the documentation site shows, and gives each application
a server half, so that what a person does on the desktop is kept and is theirs.

The application has two kinds of route. `/` is a request and reply route on which the
application serves the desktop's built files from a blob, compressed and cached (below). `/api/`
is a request and reply route too: a router answers the session and account
endpoints and hands every other request to one of 46 modules, one per application or shared
service, under `/api/<name>/`. `/live/` is a stream route that answers with server-sent events.
`/health` answers liveness. The application is declared with 256 MB of memory and half a CPU.

The desktop offers 42 applications through its catalogue (`src/apps/catalogue.rs`), of which 32
come with it and 10 are got from its App Store; Finder is always present and is not listed. Three
demos of the library are left out of the Ferrite build because nothing in them can do its job on
a cloud platform: Airport Utility, Boot Camp Assistant and Disk Utility. `not-deployed.json`
gives the reasons.

### How the desktop is packed and served

A Ferrite deployment carries source, and a source file may not exceed the platform's 16 MiB
record limit. The built desktop is 335 files and about 65 MiB, most of it artwork and the chess
engine's network, so it cannot be submitted as files. `scripts/pack-site.mjs` therefore runs the
Vite build of `docs/desktop` and writes the result as Rust source: one base64 string per file, and
a brotli and a gzip copy of each script, stylesheet and other compressible file where that saves
a tenth or more, in parts of at most 14 MiB, with a build id that is the SHA-256 of every path,
its bytes and its copies. The generated module is not committed.

When the application starts, it reads a marker from its `site` blob. If the marker names this
build and the live `index.html` is this build's page, nothing is uploaded. Otherwise it writes
every asset, then `index.html`, then the marker, so a process that dies partway leaves no marker
and the next start publishes again. Every file but `index.html` carries a content hash in its
name, so assets of different builds never overwrite each other. The application then serves the
blob itself (`ferrite-apps/desktop/src/site_serve.rs`): each file in the best coding the browser
accepts, hashed names cached for a year and `index.html` checked on every visit, with ETags and
304s. One reply holds at most about 4 MiB. The page's main script (5.5 MB) is therefore sent only
compressed, which every browser accepts, and the chess network and the photo scene model are split
into parts. `/ferrite-site.json` says
which build is live. The build is made with
`VITE_MACALICIOUS_API=1`; the demos call their modules only under that flag, so the static
documentation site never requests `/api/`.

### Platform services

The application declares six services and uses them as follows.

| Service | Kind | Use |
| --- | --- | --- |
| `site` | blob | The packed desktop, published at start and served at `/`. |
| `requests` | queue | Carries `/api/`, `/health` and `/favicon.ico` requests to the application. |
| `live`, `frames` | queues | Stream subscriptions and the frames sent to them. |
| `data` | store | Every record: sessions, accounts, each module's documents, the application's own log and request counters. |
| `files` | blob | The bytes of the files in each person's drive. |

**Accounts.** Ferrite passes no verified identity to this application, so the desktop keeps its
own accounts in the `data` store (`src/accounts/`). A browser gets an anonymous session cookie;
signing up or in at the login window names an account in the session, and from then on every
module's storage is keyed by the account. Passwords are hashed with PBKDF2-HMAC-SHA-256 over a
server-side pepper, which is a Ferrite secret (`mac_password_pepper`) and is never in source or
in the store. A Guest User account lasts 24 hours and its data is deleted at sign-out. Five
failed sign-ins lock a name for 15 minutes; the limit is per name because the gateway gives an
application no verified client address.

**Files.** Each person has a drive with a 128 MiB quota (`src/apps/files/`), which Finder and the
open and save panels show. The folder tree is one document in the store, changed by
compare-and-set. A file's bytes are objects in the `files` blob, uploaded in pieces of 192 KiB
because a request body is capped at 256 KiB. A file keeps earlier versions, which can be listed
and restored.

**Photos.** The original of a photo is a file of the person's drive. The Photos module keeps a
record and a small thumbnail per photo, and the albums, folders and keywords. Editing is
non-destructive: an edit is a recipe that the page renders from the original in a canvas, and no
image is processed on the server.

**Clipboard.** The clipboard belongs to the browser and uses no platform service. Text goes
through `navigator.clipboard`, which a browser may refuse; the menu then dims Paste and says that
the keyboard shortcut still works. Copying files in Finder holds the items in the page alone
(`demos/desktop/desktop-clipboard.ts`), so every window and application of the desktop can paste
them and nothing reaches other programs on the computer.

**Documents and conflicts.** Most applications keep one document per person under a revision
rule: a save names the revision it was based on, and the server stores it only if that is still
the stored revision, otherwise it answers 409 with the current document. The page merges the
person's unsaved change onto that copy, field by field and item by item, and a removal on either
side wins over an edit on the other.

**Live updates.** Messages and Chess update without a reload through `/live/<app>/<document>`,
and each person has a stream of their own, opened with a ticket, that carries notifications and
tells every browser they have open when one of their documents changed elsewhere.

**Outside content.** `ferrite.json` declares 19 egress handles with 128 destinations, and the
application can reach nothing else. They serve Books (Project Gutenberg and Standard Ebooks),
Dictionary, News and Podcasts feeds, Music (the Internet Archive and radio stations), TV, Stocks,
Weather, Maps (OpenStreetMap search and routing), Network Utility's lookups, and Safari, which
fetches pages of a fixed list of sites on the server and shows them in a sandboxed frame.

**Secrets.** Besides the pepper, the code reads `mac_signup` (closes sign-up or restricts it to an
invitation code), `youtube_api_key` (TV's search) and `siri_anthropic_api_key` with `siri_model`
(Siri's optional model). The committed `ferrite.json` declares no `siri` egress handle, so a
deployment from it answers only the commands Siri understands without a model.

**What the platform does not carry.** FaceTime's sound and picture go peer to peer between
browsers over WebRTC, and the module is only the signalling. The chess engine runs in a browser
worker. Script Editor and Automator run a person's JavaScript on the server in a QuickJS
interpreter that is itself vendored into the crate and bounded by a fuel count.

[ferrite-apps/desktop/README.md](ferrite-apps/desktop/README.md) documents every module, its
routes, its limits and its recorded gaps.

### The SDK dependency

`Cargo.toml` takes `ferrite-app`, and the test harness `ferrite-app-test`, by path from a checkout
of the public Ferrite SDK ([iGentAI/ferrite-sdk](https://github.com/iGentAI/ferrite-sdk)) beside
this repository: `../ferrite-sdk` relative to the root of this checkout. Locally the crate
compiles against that SDK, which runs on the Forge runtime behind `ferrite dev`. An attested build
on Ferrite Cloud replaces the dependency with the platform's own vetted crate, so the path names
the SDK and does not copy it. Four Ferrite source packages are vendored into the crate as
generated source: the JavaScript engine and the SHA-256 and HMAC routines the accounts use, which
`ferrite-packages.json` names, and the WebAssembly interpreter and codec that the engine depends
on.

### Deployment

Deployment is done with the `ferrite` command from `ferrite-apps/desktop`: pack the site with
`node scripts/pack-site.mjs --compact-assets`, run the local suite (`npm run desktop:test`) and
the shared suite on the hosted SDK (`ferrite test --remote`), set the secrets with
`ferrite secrets set`, deploy with `ferrite deploy`, and then wait for the new build's marker with
`node scripts/wait-for-site.mjs <url>`, because registration alone does not prove that the public
assets are ready. `--compact-assets` limits generated images to 1,280 pixels and re-encodes them.
The packed site is still about 65 MiB, and the source of the hosted desktop was submitted as a
series of bounded commits for that reason.

## Why it is interesting

As a component library, the interest is in the method. Every value in the tokens can be traced to
a measurement or is marked as an estimate, and every component carries comparisons against the
screenshots that fail when a change moves it outside its budget. The result is a statement of how
close each control is, at which scale and in which engine, which a library styled by eye cannot
make.

As a Ferrite application, the interest is in the size and the state. A small demo exercises a
route, a store and a deploy. This application puts 46 modules behind one router in a single crate
with a single dependency, and it has to solve what a product has to solve inside the platform's
limits:

- accounts and password hashing inside the application, because the platform passes no identity;
- per-person isolation of every module's data, including the move of an anonymous browser's data
  into an account;
- concurrent editing from several windows and browsers, with revisions, merges and conflict
  notices, and saves that survive a lost reply;
- uploads larger than a request may be, with quotas, resends and deletion that is safe against
  writes still in flight;
- streams to many browsers that stay correct across restarts of the application;
- a declared allow-list of 128 outside destinations, with fetches bounded in time and size;
- a frontend of about 65 MiB delivered through storage, since a deployment carries only source.

Work at this scale also meets differences that a small demo does not reach. The desktop's README
records several: a stream frame that the local runtime delivers and the hosted gateway drops
unless it is numbered, a value that formats differently in the local SDK and the hosted one, and
a submission refused for its size before a build starts. A sweep of 642 browser drivers over the
deployed application is what finds such things.

## Repository layout

```text
src/components/<name>/    a component: code, styles, tests, docs page, examples, visual comparisons
src/lib/                  small helpers, one concern per file
src/styles/               design tokens
demos/<app>/              the desktop and the application demos, laid out like components
docs/                     documentation site, guides (docs/content) and the Markdown export
docs/desktop/             the desktop as a page that fills the browser window
visual/                   visual comparison harness
reference/                screenshot catalogue (manifest.json) and the measured specification
scripts/, bin/            build steps, convention check, scaffolder; the `macalicious` command
test/                     tests of the repository as a whole
ferrite-apps/desktop/     the Ferrite application: src/, tests/, e2e/ (browser drivers), features/
tools/reckless-wasm/      the browser port of the chess engine (AGPL-3.0)
```

- [CONTRIBUTING.md](CONTRIBUTING.md): where files go, API and styling conventions, performance
  rules, definition of done.
- [ARCHITECTURE.md](ARCHITECTURE.md): the decisions and their reasons.
- [AGENTS.md](AGENTS.md): the entry point for coding agents.

## Develop, build and test

### The library

Node 22.23.4 or newer is required on Node 22, 24.22.1 or newer on Node 24, and 26.12.1 or newer
on Node 26.

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies. |
| `npm run dev` | Documentation site with live reload on http://localhost:3000. |
| `npm run typecheck` | Type-check everything. |
| `npm run lint` | Biome and the convention check. `npm run format` fixes formatting. |
| `npm test` | Unit, accessibility and server-render tests. A browser test skips an engine that is not installed. |
| `npm run build` | Library to `dist/`, copy-in registry, size report, Markdown docs in `dist/docs/`. |
| `npm run docs:build` | Static site and Markdown export to `docs/dist/`. `npm run docs:preview` serves it. |
| `npm run check` | The five checks above in sequence. |
| `npm run desktop:build` | The desktop page to `docs/dist/desktop/`; run after `docs:build`. `npm run desktop:dev` serves it on http://localhost:3001. |
| `npm run visual:install` | Once: download the browser used for visual comparisons. |
| `npm run reference:fetch` | Once: download the reference screenshots. |
| `npm run visual` | Compare components with the reference screenshots; results in `visual/output/`. |
| `npm run new -- <name>` | Scaffold a component that already passes every check. |

The reference screenshots are needed for visual comparisons and for the specification tools:

```bash
npm run reference:fetch                # all 294 files, about 1 GB
npm run reference:fetch -- Finder-Go   # only files whose name contains the text
npm run reference:fetch -- --check     # verify what is on disk, download nothing
```

### The Ferrite application

You need Rust 1.89 or newer, the npm dependencies of this repository, the `ferrite` command and a
checkout of the public SDK beside this repository:

```bash
git clone https://github.com/iGentAI/ferrite-sdk
git clone https://github.com/iGentAI/ferrite-showcase-macalicious
curl -fsSL https://downloads.ferrite.cloud/install.sh | sh
cd ferrite-showcase-macalicious && npm install
```

Run these from `ferrite-apps/desktop`:

```bash
node scripts/pack-site.mjs          # build docs/desktop and pack it into src/site_assets{.rs,/}
ferrite check                       # admission gate, spec statics, cargo check
ferrite test                        # the Rust suite on the in-process Forge planes
cargo test --features local-egress  # the same suite with the denied-egress tests
ferrite dev --port 8787             # the desktop on http://127.0.0.1:8787/
```

A fresh checkout must run `pack-site.mjs` before its first build, because the packed site is
generated and not committed, and again after any change to the desktop, a demo or the library.
`npm run desktop:test` at the repository root runs the complete local suite with its two
pre-checks. Accounts need a pepper: for a local run, a `ferrite.local.toml` beside `ferrite.json`
with a `[secrets]` table that sets `mac_password_pepper` to any 64 hexadecimal digits. That file
is ignored by git and must stay so.

To deploy a copy of your own, sign in (`ferrite login --ephemeral --endpoint
https://mcp.ferrite.cloud/mcp` opens a trial account), set the pepper with
`ferrite secrets set mac_password_pepper`, and follow [Deployment](#deployment).

## Verifying on Ferrite

The application has two layers of checks. The Rust tests run the router and every module on the
in-process Forge planes. The browser drivers in `ferrite-apps/desktop/e2e/` operate the served
desktop as a person would.

| Asset | Where | What it covers |
| --- | --- | --- |
| Rust tests | `ferrite-apps/desktop/src` and `ferrite-apps/desktop/tests/` | The router and every module on the in-process Forge planes: accounts and isolation, each application's documents, files and quotas, streams, declared egress and the deployment manifest. |
| Browser drivers | `ferrite-apps/desktop/e2e/`, 642 drivers named `*-journey.mjs` and the helper `app-journey.mjs` | One application or desktop feature each, operated as a person would, with a reload and a check that the change came back from the server. |
| Feature inventories | `ferrite-apps/desktop/features/`, 50 application files and a README | What each Catalina application does and how much of it works here; the reference the drivers are written against. |

```bash
npm run check          # the library: types, lint, tests, build, docs
npm run desktop:test   # the application: two pre-checks and the Rust suite
```

**The drivers.** There are 643 files named `*-journey.mjs`. One, `app-journey.mjs`, is the helper
the others import. A typical driver opens the desktop, uses one application, reloads, and checks
that what it did came back from the server; many open several browsers or accounts. Each can be
run alone against `ferrite dev` or a deployed copy:

```bash
node ferrite-apps/desktop/e2e/<name>-journey.mjs --url http://127.0.0.1:8787
```

The drivers were written with macOS keyboard conventions and need Playwright
(`npx playwright install chromium`). They are not run by `npm test` or by any automated pipeline.

## Status and known gaps

**The library.** Every component of the measured inventory is implemented, documented and
visually compared, and all 2,781 comparisons were within budget at both scales when last run on
7 November 2026. The limits are stated on the Fidelity page (`docs/content/fidelity.mdx`). The
comparisons have run only in Chromium on Linux with the fallback font, so how close the
components are in Safari, in Firefox or with the real San Francisco font is not known. Text is
San Francisco only on Apple devices, vibrancy over the real desktop cannot be reproduced, and
hairlines on 1x displays have no 1x reference. The package has not been published.

**The applications.** The feature inventories in `ferrite-apps/desktop/features/` list what each
real Catalina application does and how much of it works here. On 7 November they held 3,152 rows
done, 3,168 built but without the published screenshot the rule for done asks for, 64 partial and
5 missing. Rows that no web page can do are dimmed in the interface with the reason.

**On Ferrite.** On the hosted desktop, not every application's journey has been run and behaviour
with more than one instance is not verified. Several limits are accepted and documented: a stream
subscription carries no session, so a feed is public to anyone who can name it and serves only
shared documents; and FaceTime has no relay, so two browsers behind strict NAT do not connect.

## Licensing

The original work in this repository is released under the MIT licence
([LICENSE](LICENSE)), copyright 2026 iGent AI. [NOTICE](NOTICE) lists what that does not cover.
In short:

- The reference screenshots belong to 512 Pixels. They are used locally for comparison and are
  not in the repository, which holds only the catalogue of source links and the measurements
  taken from them.
- macOS and its interface are Apple's. No file from macOS is included. The application icons and
  desktop pictures in the demos were generated with an image model for this project, and several
  were made to resemble Catalina's; the MIT licence cannot grant rights in the designs they
  resemble.
- The chess engine (Reckless, in `tools/reckless-wasm/` and `demos/chess/vendor/reckless/`) is
  under the GNU Affero General Public License version 3, and its source is offered from the Chess
  window.
- sql.js (MIT), two MediaPipe models (Apache 2.0), the SCOWL word list, one CPython installer
  file (PSF licence) and a public-domain NASA portrait used as a test fixture are vendored under
  their own terms.
- The optional fallback font is Inter (SIL Open Font License), which comes from npm and is not in
  the repository.

The hosted Ferrite platform is proprietary and not open source.

## Support and security

Questions and support: info@igent.ai. Report a security issue privately to
security@ferrite.cloud.

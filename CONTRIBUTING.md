# Contributing

This guide is for anyone adding a component or an application demo. Many people work on this
repository at once, so the layout is designed around one rule: **everything a component needs
lives in its own folder, and every list is generated.** Adding a component never requires
editing a file that someone else is editing.

## Commands

```bash
npm install               # Node 22.23.4 or newer (24.22.1+ on 24, 26.12.1+ on 26)
npm run dev               # docs site with live reload, http://localhost:3000
npm run new -- <name>     # scaffold src/components/<name>/
npm run typecheck         # TypeScript
npm run lint              # Biome + convention check (npm run format fixes formatting)
npm test                  # Vitest
npm run build             # library to dist/, registry, size report, Markdown docs, package check
npm run docs:build        # static docs site to docs/dist/, with llms.txt and a .md per page;
                          # checks its links and examples, writes docs/dist/coverage.md
npm run check             # all five of the above, in that order
npm run visual:install    # once: browser for visual comparisons
npm run visual -- <name>  # compare with the reference screenshots
```

Before you hand work over, `npm run check` and `npm run visual -- <name>` must pass.

**Browser tests.** A `<name>.browser.test.tsx` file tests what only a browser can show, in
Chromium, Firefox and WebKit. `npm test` skips an engine that is not installed, so a machine
with Chromium alone still runs the rest. Where the engines must be there, set
`REQUIRE_BROWSER_TESTS=1` (`npm run check:browsers` does): the run then fails unless every
engine a file runs in is installed, and names each one that is missing. With the variable set,
a file that runs in the three engines never passes on Chromium alone. Every file runs in the
three today. A file that had to run in fewer by design would say so in its call
(`requireEveryEngine("the <Name> tests", ["chromium"])`) and be held to those engines; it
would be listed, with its engines, in `FEWER_ENGINES` in
`test/browser-engines.test.ts`, which is empty: a file that is not listed may not name engines
in its call.
Install the engines with `npx playwright install --with-deps chromium firefox webkit`.

A browser test file takes `ENGINES` and `installed` from `test/browser-engines.ts` and calls
`requireEveryEngine("the <Name> tests")` once, as a statement of the module, with that string
written out. It does not read the variable or ask Playwright what is installed itself:
`test/browser-engines.test.ts` parses every `*.browser.test.ts(x)` file in the repository,
wherever it is, and fails one that does not import the guard and call it so, that chooses its
own engines, or that names `REQUIRE_BROWSER_TESTS` or `executablePath`, so the guards cannot
drift apart. (That `ENGINES` and `installed` come from the helper too is the convention; the
test does not check it.) Report a browser test result per engine, and call a run "three
engines" only when it was made with the variable set.

**While other people's components are unfinished.** The convention check, the docs build and
the agent-docs tests fail on any component folder that lacks a required file or what its
documentation page needs (see
[Markdown for coding agents](#examples-docs-tests-visual-comparison)). In a tree that also
holds folders you do not own, name yours in `ENFORCE_COMPONENTS`:

```bash
ENFORCE_COMPONENTS=label,text-field npm run check
```

Problems in the named folders, and in the guides, demos and shared files, fail as usual.
Problems in every other component folder are printed in a separate "not enforced" section and
do not fail. Without the variable every folder is enforced; integration builds and the
published snapshot run without it.

Two parts of `npm run check` do not read the variable, because they work on the whole tree:

- **Biome** (the first half of `npm run lint`) reports every file. When someone else's file
  stops it, lint your own folders, then run the rest of the suite step by step:
  `npx biome check src/components/label src/components/text-field`, then
  `node scripts/check-conventions.mjs`, `npm test`, `npm run build`, `npm run docs:build`.
- **`npm run typecheck`** compiles everything, so a type error in another folder fails it.

The size budget at the end of `npm run build` does read it: a component outside the named ones
that is over the budget is printed as "over budget, not enforced". `npm run visual -- <name>`
runs and validates only the folders that match, so another folder's unfinished comparison
file does not stop yours.

## Where files go

```text
src/components/<name>/
  index.ts               named exports: the public surface
  <name>.tsx             the component (more part files are fine: <name>-item.tsx)
  <name>.css             its styles (imported by <name>.tsx)
  <name>.test.tsx        behaviour tests
  <name>.mdx             docs page, appears at /components/<name>
  <name>.visual.json     comparisons with reference screenshots
  examples/*.tsx         one default-exported example per file
src/lib/                 small shared helpers (cn, control sizes, appearance)
src/styles/tokens/       design tokens
demos/<app>/             application demos (see demos/README.md)
docs/content/*.mdx       guides
reference/               screenshots and measured spec. Read only: owned by other work.
```

`<name>` is kebab-case and is the AppKit or Human Interface Guidelines name of the control:
`push-button`, `pop-up-button`, `segmented-control`, `disclosure-triangle`. The same word, in
PascalCase, is the component (`PopUpButton`), and prefixed with `mac-` it is the CSS class
(`.mac-pop-up-button`).

These pick themselves up from the folder, with nothing to register:

- the package entry `macalicious/<name>` and the root entry
- the stylesheet `macalicious/<name>.css` and its inclusion in `styles.css`
- the docs page, the sidebar link and the props table
- the baseline tests of every example (render, server render, accessibility)
- the visual comparisons
- the copy-in registry item used by `npx macalicious add <name>`

Do not create `src/index.ts` or any other hand-maintained list. `npm run lint` rejects it.

### Shared files

A component sometimes depends on a shared file. Keep any edit to one small and additive; the
token files are not edited from a component at all:

- **Tokens** (`src/styles/tokens/*.css`) have a single owner, the thread or person keeping
  the token layer. Do not edit these files from a component: send the owner a request naming
  the token, its Aqua and Dark Aqua values, its [tag](#token-tags) and the measurement behind
  it, and keep the value in your own token file until it lands (see
  [Component token files](#component-token-files)). One owner keeps two components from
  adding the same value under two names and keeps the files free of concurrent edits.
  The values follow the measured token sheet,
  `reference/spec/tokens.md`; where a token departs from the sheet, the comment beside it says
  why. A value becomes a shared token when it is used by more than one component or is part
  of Catalina's vocabulary (a system colour, a control metric); the owner appends it to the
  relevant block and tags it. An existing token's value does not change without checking the
  components that use it with `npm run visual`. Values private to one component stay in its
  folder. A private colour always goes in the component's own token file, also when it is
  the same in both appearances; any other private value stays in its CSS unless it differs
  between the appearances, in which case it goes in the token file too.
  A token whose value contains `var()` of an accent token must be declared in `accent.css`, in
  the block that matches `[data-accent]`, or it will not follow an accent set on a subtree.
  A colour that differs between the appearances uses `light-dark()`; a length, percentage or
  number that does uses `--mac-appearance-dark` in `calc()` and is declared for
  `:root, [data-appearance]` (see `appearance.css` and the filters in `materials.css`).
- **`src/lib`**: add a file rather than growing an existing one. One concern per file.
- **`package.json`**: a new dependency needs a reason. Base UI, React and nothing else at
  runtime is the target.

### Working tree and publication checkout

When several threads build the library in one shared workspace, two trees exist and each has
one job:

- The **workspace root** is the working tree. All ongoing work happens here, unpublished
  component folders included.
- **`macalicious/`** (git-ignored at the root) is the publication checkout: the registered
  clone of the repository, holding what is on the pull request. Nothing is developed there.

Files move between the two by name, never as a tree:

- Publish only files you own, each named explicitly. Before copying one into the checkout,
  compare checksums of the root file, the checkout file and the version you started from. If
  the checkout holds a change you did not make and that is not in the root, stop and tell its
  owner; do not overwrite it.
- Never sync, mirror or delete a whole tree in either direction. A whole-tree copy removes
  other owners' unpublished folders or undoes published changes.
- A fix made directly in the checkout is copied back to the root in the same turn, so the
  root does not fall behind.
- Where the checkout's version of a file is newer than the root's, the checkout's is the
  baseline: start from it rather than from the stale root copy.
- Run the checks on a local-disk copy that has the files to be published laid over the
  checkout, and publish only after `npm run check` passes there.

## Component API conventions

**Start from Base UI.** If [Base UI](https://base-ui.com/react/components/button) has a
primitive for the control, build on it and keep its API: the same part names, the same props,
the same `data-*` state attributes. Import it by subpath (`@base-ui/react/checkbox`), never
from the package root. Only when Base UI has nothing suitable (a window, a title bar, a source
list) write the element yourself, following the WAI-ARIA Authoring Practices pattern for it.

**Props.**

- Export an interface named `<Component>Props` from the component file, with a JSDoc comment
  on every prop and `@default` where there is one. The docs props table is generated from it.
- Extend the Base UI props (`extends BaseCheckbox.Root.Props`) or the native element's props
  (`extends ComponentProps<"div">`), and spread the rest onto the element, so consumers can
  pass `id`, `aria-*`, `data-*`, `style` and event handlers.
- Name props after AppKit where a concept exists: `size` is `"regular" | "small" | "mini"`
  (`ControlSize` from `src/lib/control-size`; the one exception is `ToolbarComboBox`, which
  takes a toolbar's two sizes, `"regular" | "small"`), `variant` selects a bezel style,
  `disabled` disables. Booleans are positive adjectives (`disabled`, `bordered`), not
  `isDisabled`.
- Support controlled and uncontrolled use the way Base UI does (`value` + `onValueChange`,
  `defaultValue`; `open` + `onOpenChange`, `defaultOpen`).
- Reflect every visual prop as a `data-*` attribute (`data-size`, `data-variant`). CSS selects
  on attributes, never on generated class names.

**Refs.** React 19: `ref` is a normal prop. Do not use `forwardRef`. The ref goes to the
outermost DOM element of the part.

**className and style.** Always merge, never replace. Base UI accepts a function of state as
`className`; `withClassName("mac-<name>", className)` from `src/lib/cn` keeps that working.
For plain elements use `cn("mac-<name>", className)`.

**Composition.** A control with one part is one component (`PushButton`). A control with
several parts is exported as named parts that mirror Base UI's anatomy
(`Menu`, `MenuItem`, `MenuSeparator`), each a thin styled wrapper. Add a convenience component
only when the assembled form is the same nearly every time. Keep Base UI's `render` prop
working so a part can be rendered as another element or component.

**Exports.** Named exports only, listed one by one in `index.ts` (no `export *`). Export the
props type next to the component. Library source imports siblings relatively
(`../other-component`, `../../lib/cn`); examples, demos and docs import through the public
path (`macalicious/<name>`), exactly as a consumer would.

**Client and server.** Components must render on the server. Read `window`, `document` and
storage only in effects or event handlers. A component file that uses hooks or handlers of its
own starts with `"use client";`.

## Accessibility and keyboard

- Semantics, focus management, typeahead and dismissal come from Base UI. Do not reimplement
  or switch them off.
- Use the native element when there is one (`<button>`, `<input>`), and never remove a native
  role.
- Everything operable with a pointer is operable with the keyboard, with the keys macOS uses:
  Space and Return activate, arrow keys move within a group (radio group, segmented control,
  menu, tabs, list), Escape cancels, Tab moves between controls. With macOS full keyboard
  access every control is in the tab order; do that.
- Show keyboard focus with `:focus-visible` and the focus ring tokens
  (`--mac-focus-ring-width`, `--mac-focus-ring-color`). Never remove the outline without
  drawing the ring.
- A control without visible text requires an accessible name; document that in the page's
  Accessibility section and make the examples show it.
- Respect `prefers-reduced-motion` (no movement, opacity changes only),
  `prefers-reduced-transparency` (the material tokens already switch), and
  `forced-colors` (borders must survive).
- Disabled controls use the real `disabled` attribute or `aria-disabled`, never just a look.
- Write tests for the keyboard behaviour. The baseline suite runs axe on every example; it does
  not prove a control is usable.

## Styling conventions

Plain CSS in `<name>.css`, imported by the component. No CSS-in-JS, no utility framework, no
preprocessor.

- **Tokens only.** Colours, fonts, radii, shadows and control metrics come from
  `var(--mac-*)`. A raw colour in component CSS fails lint: a hex colour, a colour function
  or a named colour such as `white`, in any letter case and also when spelled with CSS
  escapes (`r\65 d`). A named colour is not reported in a property whose value is names of
  your own, such as `animation-name` or `grid-area`. `transparent`, `currentColor`, the
  forced-colours system
  colours (`ButtonText`, `GrayText`) and a relative colour whose origin is one `--mac-*`
  token without a fallback (`rgb(from var(--mac-color-label) r g b / 0.5)`) are not raw
  colours. A colour that belongs to the component alone goes in its token file (see
  [Component token files](#component-token-files)), also when it is the same in both
  appearances. The one exception is the alpha of a `mask` or `mask-image`, where black means
  "keep" and is not a colour anyone sees: mark that line, or the line above it,
  `/* raw-color-ok: mask alpha */`. Lint honours the mark for that one declaration and on no
  other property; a mark that trails one declaration does not cover the next.
- **Never test the appearance.** No `prefers-color-scheme`, no `[data-appearance]`, no
  `light-dark()` in component CSS. Tokens resolve the appearance. If a value differs between
  Aqua and Dark Aqua, it is a token: a shared one in `src/styles/tokens/`, or one of the
  component's own (next section).
- **What lint can and cannot see.** The two rules above are checked by `npm run lint`
  (`scripts/lib/raw-colors.mjs`). It is a convention check, not a CSS parser: it reports the
  colours and appearance tests someone writes in the ordinary course of work, in any spelling
  CSS accepts. Every lint check of a component stylesheet reads it the same way: text in a
  string, a comment, an attribute selector's value or the contents of `url()` is not syntax
  and is never taken for a class, a property, a colour or an appearance test
  (`content: ".foo"` names no class). It reads component stylesheets only, so a colour in a `style` prop is not
  seen; it skips strings and `url()`, so a colour inside an inline SVG is not seen (use the
  image as a mask and colour it with a token); and the properties that take names and never
  colours are a fixed list, so in any other property a custom name that is also a colour
  name (`coral`) is reported. The rules hold where lint cannot see, too.
- **Class names** are `.mac-<name>` for the root and `.mac-<name>-<part>` for parts. State is
  selected with attributes and pseudo-classes: `[data-disabled]`, `[data-size="small"]`,
  `:active`, `:focus-visible`.
- **Low specificity.** Wrap state and variant selectors in `:where()` so a consumer's single
  class overrides them: `.mac-push-button:where([data-size="small"])`. No `!important`, no ids,
  no element selectors reaching into children you do not own.
- **Private variables** are `--_name`. A variable a consumer is meant to set is
  `--mac-<name>-<property>` and is documented on the page.
- **Sizing.** One AppKit point is one CSS pixel. The element's box is the control's alignment
  rectangle, so the spacing AppKit documents works as plain `gap`. Draw the visible bezel
  inside it (see `push-button.css`). Hairlines are `var(--mac-hairline)`.
- **Window state.** A window is key, main or inactive, exposed as `data-window-state` on an
  ancestor. Use the selectors in [Window state](#window-state) below. Do not listen for focus
  events or read a context to do it.
- **Transient states in docs.** Support `[data-force~="pressed"]`, `[data-force~="focus"]`
  and `[data-force~="hover"]` next to the real pseudo-classes, so galleries and visual
  comparisons can show them.
- **No bitmaps, no canvas.** Chrome is drawn with CSS: gradients, borders, shadows, masks.
  Glyphs (chevrons, checkmarks) are CSS shapes or inline SVG that you drew, using
  `currentColor`. Never copy Apple's icon artwork or SF Symbols.
- **Fonts.** `font: var(--mac-font-control-regular)` and friends. Never name a font family in
  component CSS.

### Component token files

A value that differs between Aqua and Dark Aqua and is used by one component only, or a
colour of the component's own that no shared token holds, goes in
`<name>.tokens.css`, next to `<name>.css`, so that adding a component does not mean editing
the shared token files. It is the one file in a component folder where `light-dark()`,
`[data-appearance]` and raw colours are allowed, and `npm run lint` holds it to these rules:

- It contains only declarations of custom properties named `--mac-<name>-*`, on `:root`,
  `[data-appearance]` or `[data-accent]`. No class selectors and no other properties; rules
  for elements stay in `<name>.css`, which reads the values with `var()`.
- A value built from an accent token is declared for `:root, [data-accent]`, like the shared
  tokens in `accent.css`, or it will not follow an accent set on a subtree.
- Every value carries a [token tag](#token-tags), like a shared token.
- The component imports it directly before its stylesheet:
  `import "./<name>.tokens.css";` then `import "./<name>.css";`. The build puts it at the
  top of `dist/components/<name>.css` (and so into `dist/styles.css`), and
  `npx macalicious add` copies it with the folder.

`npm run new` scaffolds the file with one placeholder value; delete the file and its import
when a component has no such value. `push-button.tokens.css` is the smallest example and
`box.tokens.css` one with several measured values.

Move a value to `src/styles/tokens/` when a second component needs it, by asking the owner of
the shared token files (see [Shared files](#shared-files)); do not read another component's
`--mac-<other>-*` values.

### Window state

AppKit distinguishes three window states, and Catalina draws each differently. The library
exposes the state as one attribute, `data-window-state`, on the window's root element.
Everything inside reads it with a CSS ancestor selector.

| `data-window-state` | The window | Frame: title bar, toolbar, title, shadow, materials | Window controls | Controls inside |
| --- | --- | --- | --- | --- |
| `key`, or no attribute | receives keyboard input | active | coloured | accent, focus ring, emphasised selection |
| `main` | is the front document window while a panel or its own sheet is key | active, identical to key | all three grey (`--mac-color-window-control-main`); coloured again while the pointer is over the group | as in an inactive window |
| `inactive` | is behind another window, or the whole page is in the background | flat title bar (`--mac-material-titlebar-inactive`), dimmed title (`--mac-color-window-frame-text-inactive`), smaller shadow (`--mac-shadow-window-inactive`), opaque materials (`--mac-material-*-opaque`) | all three grey (`--mac-color-window-control-inactive`); coloured again while the pointer is over the group | no accent, no focus ring, unemphasised selection |

**Who sets it.**

- The window component sets the attribute on its root element and always writes it out,
  `key` included. It takes the state as a prop (`state`, default `"key"`); a window manager
  decides which window is key.
- `trackWindowActivation()` from `macalicious/lib/window-activation` sets `inactive` on
  `<html>` while the browser window is in the background and removes it otherwise.
- Nothing else sets it. A control never sets it, never takes it as a prop and never mirrors it
  in React state or context.
- No attribute anywhere means key, so a control used outside any window looks active.

**How a control reads it.** A control has one question: is my window key? Its accent fill,
focus ring and emphasised selection apply only then. Negate the two other states:

```css
/* accent look, only in the key window */
.mac-push-button:where(
  [data-variant="primary"]:not(:where([data-window-state="main"], [data-window-state="inactive"]) *)
) { … }

/* or the other way round: what changes when the window is not key */
.mac-checkbox:where(:where([data-window-state="main"], [data-window-state="inactive"]) *) { … }
```

Write the selector exactly like this, so that a search finds every control that reacts to the
window state. `push-button.css` is the reference.

**How window chrome reads it.** The frame changes only when the window is inactive; the
window controls also change in a main window.

```css
.mac-title-bar:where([data-window-state="inactive"] *) { … }
.mac-window:where([data-window-state="inactive"], [data-window-state="inactive"] *) { … }
.mac-window-controls:where([data-window-state="main"] *) { … }
```

The window's own rule lists both forms because the attribute can be on the window itself or,
when the whole page is in the background, on `<html>`.

**Window controls under the pointer.** In a main or inactive window the three controls are
grey until the pointer is over the group; then all three show their colours and glyphs, as in
a key window, and turn grey again when it leaves. The same holds when the whole page is in the
background. The hover is tracked on the group, not per button, and the exception is written
into the grey rule:

```css
.mac-window-controls:where(:not(:hover)) > .mac-window-controls-button:where([data-window-state="main"] *) { … }
```

A disabled control stays grey under the pointer. Focusing a control from the keyboard shows
the glyphs without restoring the colours and, as for every control in a window that is not
key, without a focus ring. No reference screenshot shows a hovered main or inactive window:
this is native Catalina behaviour recorded as an inference (provisional), not a measurement.

**Precedence.** CSS cannot select the nearest ancestor that carries the attribute, so a
state that is not key wins over `key` wherever it is among the ancestors: when `<html>` is
inactive, every window on the page is inactive, whatever its own attribute says. That is the
behaviour of an application in the background. Two consequences: windows do not nest, and
exactly one window on a page is key at a time.

**Popups.** Menus, popovers, sheets and alerts that Base UI renders through a portal are
outside their window's element. Like their AppKit counterparts they are windows of their own
and are key while they are open, so they follow only the state on `<html>`. A window sets
itself to `main` while its sheet is open.

**In examples and comparisons.** Put the attribute on a wrapper element in the example, as
`push-button/examples/states.tsx` does. Docs pages list the look in the Variants and states
table. No screenshot shows a control in a window that is not key, so those looks are tagged
provisional.

## Measuring from the reference

1. Find the control in `reference/manifest.json` / `reference/screenshots/`, in a light and a
   dark screenshot. If a measured spec for it exists in `reference/spec/`, start there.
2. Read exact pixels with `npm run visual:crop` (see the Visual comparison guide). It reports
   sRGB values; raw values from an image editor that ignores the embedded colour profile are
   wrong for saturated colours.
3. Divide pixel distances by two for points. Borders in the screenshots are one device pixel:
   `var(--mac-hairline)`.
4. Translucent colours: solve for the alpha that gives the measured value over the measured
   background, and store the translucent colour, so the control also looks right on other
   backgrounds.
5. A state with no screenshot is tagged `[provisional]` and listed as such on the docs page.
   Do not present a guess as measured.
6. A measured dimension is not always the CSS value that reproduces it. Check the value in
   the browser with `npm run visual` and keep the one that matches the pixels, with a comment
   giving both (the push button corner is nominally 4 pt and is drawn with 3.5px).

### Token tags

Every token carries one tag, in the comment on its line or above it. The tag says where the
value comes from; the spec's grade for the same value is in the last column.

| Tag | Meaning | Spec grade |
| --- | --- | --- |
| `[measured]` | read from a reference screenshot, after conversion to sRGB | [M] |
| `[measured, computed]` | computed from measured pixels: an alpha recovered from a composite over a known background, a fitted shadow, a font size from a cap height | [C] |
| `[catalog]` | documented by Apple (AppKit catalog, Human Interface Guidelines), not observed in a screenshot | [D] |
| `[provisional]` | inferred; no screenshot shows it | [I] |

The tag applies to the declarations that follow it in the same block until the next tag, so
put a tag on any line whose status differs from the one before it. A token has one tag: if any
part of its value is inferred (one appearance, or one term of a filter), tag it provisional and
say in the comment which part is measured. The Theming page shows the
tags; it reports both measured forms as measured.

## Examples, docs, tests, visual comparison

**Examples** (`examples/*.tsx`) are small, complete programs with one default export. They are
the previews in the docs, the fixtures of the baseline tests and the subjects of the visual
comparisons. Name files in kebab-case; prefix the ones built for a comparison with `visual-`.

**Docs page** (`<name>.mdx`): frontmatter with `title` and `description`, then, in this order:
a first `<Example>` with no heading, Usage, Guidelines (what the Human Interface Guidelines say
about when and how to use the control), Variants and states, Sizes, API (`<PropsTable
name="…Props" />` plus a table of data attributes and CSS variables), Accessibility, Visual
comparison (measured scores, and what is provisional). `<Example name="x" both />` shows Aqua
and Dark Aqua side by side; `hideCode` hides the source.

**Tests** (`<name>.test.tsx`, Vitest + Testing Library): assert behaviour through roles and
user events, not markup. Cover: default render and attributes, each prop's effect, pointer and
keyboard activation, disabled behaviour, controlled and uncontrolled use, `ref`, `className`
and prop forwarding. Do not snapshot the DOM, and do not test Base UI itself.

**Visual comparison** (`<name>.visual.json`): at least one comparison per appearance against a
reference crop. Every comparison has `budget` and `deltaBudget` for 1x and 2x, set just above
the measured scores (the first gates shape, the second gates colour); lint and the runner
reject a file without them, with an unknown key, or with budgets so large that nothing could
fail. When text dominates the score, add the same comparison with the text masked, at
`threshold` 0.05 and a 2x budget about 0.05 points above its score: that one gates the
drawing. States no screenshot shows (pressed, keyboard focus, a window that is not key, mini)
are checked with `expect`: real input, then the colours of chosen pixels, taken from the spec.
A folder that is not compared yet says so with `"pending"`, which lint lists without failing.
The guide is `docs/content/visual-comparison.mdx`; `push-button.visual.json` is the reference.

**Names.** A component folder cannot be called `tokens`, `styles`, `lib`, `index`,
`fallback-font` or `package` (the package and the registry use those), and two components
cannot export the same name, because the package root exports every component: prefix a
generic name with the component (`ToolbarItem`, not `Item`). Lint and the build fail on both.
Source files may sit in subfolders of the component; stylesheets stay at its top level, because
the package ships only those: lint, the package build and the registry build each refuse a
stylesheet in a subfolder. Every stylesheet in the folder is imported by the component's code
(a module that `index.ts` reaches through static imports at run time; `import type` and
`import()` do not count, because the package ships a component's stylesheets at once): the
source loads only the imported ones, so lint and the package build refuse one that nothing
imports. The package orders a component's stylesheets as its code imports them; the build stops
at an import of the component's own files it cannot follow, such as `./box.js` for `box.tsx`.

**What a component's files may refer to.** The package ships a component's code and its
top-level stylesheets, and the registry copies its `.ts`, `.tsx` and `.css` files; nothing
else travels. So lint (and, for stylesheets, the package build) refuses what neither would
carry:

- a stylesheet import that is not `import "./file.css"` of the component's own file: names
  imported or re-exported from a stylesheet (there are no CSS modules), `import()` of a
  stylesheet, a stylesheet from an npm package, or another component's stylesheet (use the
  component through its folder instead);
- `@import` in component CSS: the package joins a component's stylesheets into one file, where
  it would be ignored;
- `url()` of a file in component CSS: only `data:` URIs and `#fragment` references are allowed
  (inline an SVG; bitmaps are not allowed at all);
- `import.meta` in component source: `import.meta.url` names a file beside the module and
  `import.meta.env` belongs to one bundler; neither the package build nor the registry
  follows them.

The optional `styles/fallback-font.css` is the one stylesheet with a dependency of its own
(`@fontsource-variable/inter`); `macalicious add` does not install it, and the file and the
Installation guide say so.

**Markdown for coding agents.** The builds also write the documentation as plain Markdown
(`llms.txt`, `llms-full.txt` and a page per component and guide: `docs/agent-docs.ts`). A
component's page is assembled from its folder, so there is nothing to write, but the folder
must hold what the page needs. `npm run docs:build` fails, naming the file, when:

- the folder has no `<name>.mdx` with a title and description, or no example other than the
  `visual-` ones (`examples/basic.tsx` is the page's minimal example);
- `index.ts` exports a `…Props` type whose export does not lead to an interface or type alias
  declared in the folder, so its props cannot be read (the declaration may carry `export`
  itself or be named in an export list, `export type { ItemProps }`);
- a prop's `@default` contradicts the literal default in the component's parameter list;
- the page's `<Example>` or `<PropsTable>` names something that does not exist.

It warns about a prop or component without a JSDoc description, a computed default with no
`@default` to describe it, a page without an `## Accessibility` section, and a link to a page
that does not exist. `AGENT_DOCS_STRICT=1` turns the warnings into failures.
`test/agent-docs.test.ts` then checks every generated page against the source with a second
reader: each prop with its type and default, each example against its file, and each
`import` in a code block, including the hand-written ones in a Usage section, against what the
package really exports. A Guidelines section that links no source is marked "not verified" in
the Markdown; link the Apple document you checked it against to remove the mark.

**Site check.** After prerendering, `npm run docs:build` checks the site it built
(`docs/site-check.mjs`, `docs/browser-pass.mjs`), with nothing to register:

- every internal link and anchor, in the HTML pages and in the Markdown export, must lead to
  a page, a file or a heading that exists, or the build fails naming the page and the link.
  Headings get GitHub's ids (`## Token tags` is `#token-tags`), so a link to a section works
  on the site and on GitHub alike. Write a link to another page from the site root
  (`/components/box`): a relative link in a page is refused, because a route is served with
  and without a trailing slash and the link would mean a different page at each;
- when Playwright has a Chromium (`npm run visual:install`), every component and demo page is
  opened in Aqua and in Dark Aqua: an example that paints nothing, never finishes loading or
  ignores the appearance fails the build (under `ENFORCE_COMPONENTS`, only in the named
  component folders and in the demos), and a page or console error is reported. The same
  pass takes the light and dark pictures of each page's first example that the Components
  and Demos index pages (`docs/content/components.mdx`, `demos.mdx`)
  show, into `docs/dist/screenshots/`; they are build output and are never committed.
  Without a browser the build says so and the index pages have cards without pictures;
  `REQUIRE_BROWSER_TESTS=1` makes that a failure, and `DOCS_BROWSER=0` skips the pass for a
  quick build;
- `docs/dist/coverage.md` (and `coverage.json`) lists every component of the measured
  inventory (`reference/spec/inventory.json`), every other component folder and every demo
  with what its page has: props table, examples, rendering in both appearances, sidebar and
  index links, screenshots. An inventory entry that is a set of tokens rather than a
  component is claimed by the guide that documents it, with `inventory: <id>, <id>` in the
  guide's frontmatter (the inventory's own "implemented by" entry, when it names a guide,
  counts too). Read the report before calling the documentation complete.

## Performance rules

A page can hold hundreds of these controls. Each one must cost almost nothing.

- **CSS does the work.** Hover, pressed, focus, disabled, selected, window-inactive, size and
  appearance are all CSS states. Do not hold them in React state or mirror them with listeners.
- **No unnecessary re-renders.** No state above where it is needed; no context value that is a
  new object on every render (`useMemo` it); pass primitives rather than fresh objects as
  props; never define a component inside a component. Changing one item must not re-render its
  siblings.
- **No per-instance global listeners.** Nothing mounts its own `window`, `document`, `resize`
  or `scroll` listener, or its own observer. Share one (as `trackWindowActivation` does), use
  what Base UI provides, or use CSS.
- **No layout thrash.** Do not read layout (`getBoundingClientRect`, `offsetWidth`) while
  rendering or in a loop with writes. Position popups with Base UI's positioner. Let CSS size
  things.
- **Compositor-friendly animation.** Animate `opacity` and `transform` only; never
  `transition: all`. Keep durations short, as Catalina's are.
- **Cheap effects.** `backdrop-filter` and large blurred shadows are expensive: only on the
  surfaces that have a material in Catalina (sidebar, menu, popover, title bar), never on a
  repeated control.
- **Tree-shakeable.** No side effects at module scope other than the stylesheet import. No
  default exports, no `export *`. One entry point per component.
- **Small.** A component's own JavaScript and its CSS are each limited to 3 kB gzipped (3072 B),
  checked by `npm run build`. No runtime dependency beyond React and Base UI. If a component
  needs more, split it into parts that can be imported separately. How the check counts:
  - *Own code* is the component's entry and everything its own code brings in. The components
    it is built from are not counted: each is held to the budget under its own name.
  - *The built JavaScript is counted as it ships:* not minified, and without documentation
    comments. The build leaves JSDoc out of the JavaScript (`output.comments` in
    `vite.config.ts`), because the type declarations carry it; writing or shortening a
    documentation comment therefore does not change a component's size. Licence comments
    and annotations such as `@__PURE__` are kept, and counted.
  - *A helper in `src/lib` is charged in full to every component that imports it.* Moving code
    to `src/lib` therefore saves nothing, and code the source maps cannot place is charged too.
  - *Helpers counted once* are the exception, for code that several components really share:
    the files named in `scripts/lib/shared-helpers.mjs`. Each is measured once, held to the
    same 3 kB, and not charged to its users. A file gets on that list by review, not by where
    it is, and the check counts its users in the built package: with fewer than two it is
    charged to the one component that uses it. The file says what a pull request that adds a
    helper must show.
  - The report also prints what each component *loads* (its own code, its helpers and the
    components it is built from, with all of theirs) and what the whole library loads with
    every file counted once; `node scripts/report-size.mjs --with table-view,list-view` prints
    it for a set of components. That figure, not a component's own, is what a page pays.
- **Mind memory.** Clean up every effect. No module-level caches that grow without bound. Long
  lists and tables must work with virtualisation (accept a rendered range; do not require all
  rows as elements).
- **Render lazily.** Popups, menus and sheets are not in the DOM until opened (Base UI's
  default; keep it).

## Definition of done

- [ ] Built on the Base UI primitive, if one exists
- [ ] Every variant, size and state in the reference screenshots, in Aqua and Dark Aqua
- [ ] Inactive-window and disabled looks; keyboard focus ring
- [ ] Tokens only; `npm run lint` passes
- [ ] Tests for behaviour and keyboard; `npm test` passes
- [ ] Docs page with examples, guidelines, props table, accessibility notes
- [ ] Visual comparison in both appearances, with both budgets and the scores recorded; state
      checks for what no screenshot shows
- [ ] Anything not measured is tagged provisional and listed on the docs page
- [ ] `npm run check` passes

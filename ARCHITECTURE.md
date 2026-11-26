# Architecture

The decisions behind the repository layout, each with its reason. Change them deliberately:
a dozen people build on these at once.

## Shape

One package, `macalicious`, in one repository:

```text
src/components/<name>/   a component: code, styles, tests, docs, examples, visual comparisons
src/lib/                 small helpers
src/styles/              tokens
demos/<app>/             application demos
docs/                    documentation site (Vite + MDX), guides in docs/content
visual/                  visual comparison harness
scripts/                 build steps, convention check, scaffolder
bin/                     the `macalicious` command (copy-in)
reference/               screenshots and measured spec (owned elsewhere, read only)
```

**One package, not a monorepo.** Per-component packages would give every contributor a
`package.json`, a version and a release to manage, and consumers dozens of installs. A single
package with one entry point per component gives the same bundle result with none of that.

**Colocation.** Everything about a component is in its folder, and the docs site, test runner,
build, registry and visual harness discover folders by globbing. There is no index file, route
table, story list or registry manifest to edit, which is what makes concurrent work safe. The
root entry (`import … from "macalicious"`) is generated at build time.

## Base UI

Components are built on `@base-ui/react` (1.8.0 when this was written; the package formerly
published as `@base-ui-components/react`). Base UI supplies behaviour, focus management and
accessibility and has no styles, which is exactly the split this library needs: all the visual
work is ours, none of the interaction work is. It is a regular dependency, imported by subpath
so only the primitives in use are bundled.

## Distribution: package and copy-in

shadcn/ui distributes source: a command copies a component into your project and you own it.
That suits teams who restyle everything. This library's whole value is its exact styling, so
most users are better served by a versioned package they can update. Both are supported from
the same source:

- **Package.** `npm install macalicious`, `import { PushButton } from "macalicious/push-button"`.
  ESM, one entry per component, TypeScript declarations, CSS as separate files.
- **Copy-in.** `npx macalicious add push-button` copies the component folder, the helpers it
  imports and the tokens into the project. The registry it reads (`dist/registry/*.json`) is
  generated from the source tree: a component's files are its folder, its npm dependencies and
  dependencies on other components are read from its import statements. Files keep their
  relative layout, so no import rewriting is needed.

The registry items are modelled on shadcn's item shape. The `shadcn` command itself expects a
`components.json` and path aliases in the consuming project and was not tested against this
registry, so the library ships its own small command instead of depending on it.

**CSS is not imported by the published JavaScript.** Source files import their stylesheet
(`import "./push-button.css"`), which is right for the docs, tests and copy-in. The package
build strips those imports and emits `dist/components/<name>.css`, `dist/tokens.css` and
`dist/styles.css`. JavaScript that imports CSS breaks in Node, in server components and in
some bundlers; a stylesheet the application imports works everywhere. `tokens.css` and
`styles.css` are minified and lose their comments (the token files are mostly measurement
notes, most of their size); the commented source is what copy-in delivers.

## Styling: plain CSS and tokens

No Tailwind, no CSS-in-JS runtime. Catalina controls are a few gradients, hairlines and
shadows per state; plain CSS expresses them directly, costs nothing at runtime, and can be read
next to a screenshot measurement. Nothing was found that plain CSS could not do.

**Tokens** are CSS custom properties on `:root` in `src/styles/tokens/`: colour, accent,
typography, metrics, elevation, materials, controls. Names follow AppKit's semantic colours
(`--mac-color-label`, `--mac-color-window-background`). The values are those of the measured
token sheet in `reference/spec/tokens.md`, and every value is tagged measured, computed from
measurements, catalog or provisional (CONTRIBUTING, "Token tags"). A token holds the CSS value
that reproduces the screenshot in a browser, which is not always the dimension AppKit would
state: translucent layers that overlap are stored as the alphas that composite to the measured
row, and the control corner that measures a nominal 4 pt is 3.5px.

**Appearance uses `light-dark()`.** Each appearance-dependent token is written once as
`light-dark(<aqua>, <dark aqua>)`. `:root` declares `color-scheme: light dark`, so the page
follows the operating system; `data-appearance="light|dark"` sets `color-scheme` and therefore
switches every token, on the page or on any subtree. The alternative, a second block of
overrides under `[data-appearance="dark"]` plus a copy inside a `prefers-color-scheme` media
query, states every dark value twice and makes nested appearances fragile. The cost is a
browser baseline of Chrome 123, Safari 17.5 and Firefox 128, and build tools must not
down-level `light-dark()` (set `build.cssTarget` in Vite).

`light-dark()` accepts only colours. The few values of another type that differ between the
appearances (the blur radius and saturation of a material) interpolate with
`--mac-appearance-dark`, a number that `appearance.css` keeps at 0 in Aqua and 1 in Dark Aqua
from the same three sources as `color-scheme`; such a token is declared for
`:root, [data-appearance]` so that a subtree that switches appearance recomputes it. The dark
value is still written once.

**Accent and highlight** are two input colours per appearance, set by `data-accent` /
`data-highlight` presets or directly. For the eight Catalina accents the bezel and control
fills (five gradient stops, hairlines, glyph shadow) and the highlight are tables of values
measured from the accent screenshots, because the accents do not follow one rule: orange is
nearly flat in dark, graphite is a cool grey and inverts its glyphs in dark. The emphasised
selection and the focus ring are measured for blue only and derived for the other seven, which
no screenshot shows on a list or a focused control. For any other colour the same tokens
are derived from the inputs with relative colour syntax
(`oklch(from var(--mac-accent-light) …)`), fitted to blue, so a custom accent works without
writing a theme. The derivation is declared at zero specificity (`:where()`), so a preset
always wins. Tokens that combine accent tokens (the bezel gradients) live in `accent.css` in a
rule that matches `[data-accent]`: a custom property that contains `var()` is resolved on the
element that declares it and inherited as a finished value, so declaring it on `:root` alone
would freeze the page's accent into every subtree.

**Shared tokens and component tokens.** Component CSS may not write a colour or test the
appearance, so every value that differs between Aqua and Dark Aqua is a token. Putting all
of them in `src/styles/tokens/` would make those eight files the one place every component
author edits at once, and would fill the shared vocabulary with values only one control uses.
So there are two homes. `src/styles/tokens/` holds Catalina's vocabulary and anything two
components share, and has a single owner who takes requests. A component's own
appearance-dependent values live in `<name>.tokens.css` in its folder, named
`--mac-<name>-*`, which the convention check holds to declarations of that prefix on `:root`,
`[data-appearance]` or `[data-accent]`. The prefix makes the owner of a value readable from
its name and keeps two folders from colliding; the restriction to declarations keeps the
rule "appearance comes from tokens" checkable, because the only file allowed to say
`light-dark()` cannot style an element. The file travels with the folder: it is part of
`dist/components/<name>.css`, of `dist/styles.css` and of the copy-in registry item.

**State through attributes.** Variants and sizes are `data-*` attributes; the window state is
`data-window-state="key|main|inactive"` on the window element, read by everything inside with
an ancestor selector. Components therefore need no context, state or listeners for their look,
which is the main reason they are cheap. The three values are AppKit's: controls ask only
whether their window is key, the frame only whether it is inactive, and the window controls
distinguish all three. An absent attribute means key, so a control on a plain page looks
active, and the same attribute on `<html>` puts the whole page in the background when the
browser window loses focus. CSS cannot select the nearest ancestor with an attribute, so a
state that is not key takes precedence wherever it sits; that matches an application in the
background and is why windows do not nest. The alternative, a React context read by every
control, would re-render every control in a window each time focus moves between windows.

**Geometry.** A control's CSS box is its AppKit alignment rectangle and the bezel is drawn
inside it on a pseudo-element. Layout distances from the Human Interface Guidelines then apply
as plain CSS gaps, and shadows never affect layout.

## Typography

The system font stack resolves to San Francisco on Apple devices. Elsewhere it falls through to
`Mac System Fallback`, an `@font-face` alias of Inter with San Francisco's vertical metrics,
declared in an optional stylesheet. No Apple font file is in the repository or the package;
Inter comes from the `@fontsource-variable/inter` package (SIL Open Font License), which is an
optional peer dependency.

## Tooling

| Job | Tool | Why |
| --- | --- | --- |
| Build, dev server, docs | Vite 8 | One tool for the library build, the docs site and the visual harness page. |
| Types | TypeScript 7 (`tsc`) | Type checking and declaration output. |
| Lint and format | Biome | One fast binary, one config; no plugin matrix to keep in step. |
| Conventions | `scripts/check-conventions.mjs` | The rules in CONTRIBUTING that a linter does not know: file layout, class prefixes, tokens only. |
| Tests | Vitest, Testing Library, jsdom, axe-core | Behaviour tests per component; baseline render, server-render and accessibility tests for every example. |
| Docs | MDX, Shiki | Pages are prose with live examples; code is highlighted at build time. |
| Props tables | oxc-parser | Read from the exported `*Props` interface and its JSDoc. TypeScript 7 has no JavaScript compiler API, so docgen tools built on it do not run. |
| Visual comparison | Playwright, sharp, pixelmatch | A real browser, ICC-aware image decoding, a standard pixel metric. |

**Docs site.** A small custom Vite + MDX site rather than Storybook or a docs framework: the
site must itself be built from the library, host full application demos, and stay out of
contributors' way. Pages are discovered from the file system, examples are real files that the
tests and the visual harness also use, and `npm run docs:build` prerenders every page to
static HTML.

**Markdown for coding agents.** The same folder scan also writes the documentation as plain
Markdown (`docs/agent-docs.ts`): `llms.txt`, `llms-full.txt` and a file per page. A component's
file is assembled from its folder, not converted from its HTML: exports from `index.ts`, props,
defaults and JSDoc from the source, data attributes and states from the stylesheet, code from
`examples/`, prose from the docs page. It is emitted twice, into the site and into the package
(`dist/docs/`), so an agent in a consumer project reads it from `node_modules`. Generating it
rather than writing it is the point: a second, hand-kept description of every component would
drift. The docs build fails when a folder lacks what its page needs, and a test re-reads the
source with an independent text scanner and compares, because nobody proofreads generated
files.

**Visual harness.** Comparisons are declared in JSON next to the component, so adding one is
adding data. The runner launches Chromium once per device scale with a true scale factor;
Playwright's emulated `deviceScaleFactor` lays sub-pixel hairlines out on a 1x grid and made
every bezel a device pixel too thick. References are decoded through their embedded Display P3
profile to sRGB before comparison.

## Known limits

See the Fidelity limits page (`docs/content/fidelity.mdx`): text off Apple platforms, vibrancy
over the desktop, hairlines on 1x displays, and antialiasing of curves.

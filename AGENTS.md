# Macalicious: guide for coding agents

Macalicious is a React component library that reproduces the macOS 10.15 Catalina interface in
the light (Aqua) and dark (Dark Aqua) appearances. Behaviour and accessibility come from
[Base UI](https://base-ui.com) (`@base-ui/react`); every control is drawn with plain CSS and
design tokens. This file tells an agent where the documentation is and the few rules that are
not obvious from one component's page. It applies to two situations:

- **Using the library** in another project: read "Find the documentation", "Use a component"
  and "Attributes that theme a page".
- **Working in this repository**: read those, then "Work in this repository".

## Find the documentation

The documentation exists as plain Markdown, generated from the source tree at build time. It
is never written by hand, so it matches the code it ships with. Read it instead of guessing
prop names.

| File | What it holds |
| --- | --- |
| `llms.txt` | The index: one line per guide, component and demo, with a link to its Markdown file. |
| `components/<name>.md` | One component, self-contained: purpose, import lines, a minimal example, every prop with type and default, options (variants, sizes), styling hooks (classes, data attributes, states), then usage, guidelines, accessibility and fidelity notes. |
| `<guide>.md` | One guide: `installation.md`, `theming.md`, `building-a-window.md`, `fidelity.md` and the others listed in `llms.txt`. |
| `llms-full.txt` | All of the above in one file. Large; prefer the single pages. |

Where those files are:

| You are | Location |
| --- | --- |
| in a project that installed the package | `node_modules/macalicious/dist/docs/` |
| in a project, with a shell | `npx macalicious docs` (the index), `npx macalicious docs <name>` (a component or guide), `npx macalicious docs full` |
| reading the published documentation site | `/llms.txt`, `/llms-full.txt`, and `<page URL>.md` for any page (each HTML page names its Markdown twin in a `<link rel="alternate" type="text/markdown">`) |
| in this repository | `npm run build` writes `dist/docs/`; `npm run docs:build` writes the same files into `docs/dist/`. Without a build, read the sources they are generated from: `src/components/<name>/<name>.mdx`, `<name>.tsx` and `examples/`, and `docs/content/*.mdx`. |

The list of components is whatever `llms.txt` lists. Do not assume a Catalina control exists
as a component because macOS has it; check the index.

## Use a component

Two ways, from the same source. Requirements: React 19, and browsers with CSS `light-dark()`
(Chrome and Edge 123, Safari 17.5, Firefox 128).

**As a package** (the package is not published to npm yet; see `installation.md`):

```tsx
import "macalicious/styles.css"; // once: tokens and every component's styles
import { PushButton } from "macalicious/push-button"; // one entry point per component
```

- Component entry points are `macalicious/<name>`, where `<name>` is the kebab-case folder
  name (`push-button` exports `PushButton` and the type `PushButtonProps`).
- Helpers are `macalicious/lib/<name>`: `appearance` (`setAppearance`, `setAccent`,
  `setHighlight`, `ACCENTS`), `window-activation` (`trackWindowActivation`), `cn`,
  `control-size`.
- The JavaScript never imports CSS. Import `macalicious/styles.css` once, or
  `macalicious/tokens.css` plus `macalicious/<name>.css` for each component used; a component's
  page lists the stylesheets it needs, in the order to import them (the stylesheets of the
  components it is built from come first).
- `macalicious/fallback-font.css` is optional: a metric-compatible fallback for platforms
  without the San Francisco font (needs `@fontsource-variable/inter`).

**As copied source**, in the style of shadcn/ui:

```bash
npx macalicious list
npx macalicious add push-button            # into src/components/macalicious
npx macalicious add push-button --dir app/ui/mac --dry-run
```

`add` copies the component folder, the helpers it imports, the components it uses, the
token stylesheets and the theming helpers (`lib/appearance.ts`, `lib/window-activation.ts`),
keeping their relative layout (`<dir>/components/<name>/`, `<dir>/lib/`,
`<dir>/styles/`). Then import the component from the copied folder and import
`<dir>/styles/index.css` once. Copied components import their own stylesheet. `add` prints the
npm dependencies to install and does not overwrite an edited file without `--overwrite`.

Rules that hold for every component:

- Components accept the props of the Base UI primitive or the HTML element they are built on,
  and pass unknown props through, so `id`, `aria-*`, `data-*`, `className`, `style`, `ref` and
  event handlers work. The props table lists a component's own props and names the type the
  rest come from.
- `size` is `"regular" | "small" | "mini"` on every control that has sizes. One exception:
  `ToolbarComboBox` takes a toolbar's two sizes, `"regular" | "small"`.
- One CSS pixel is one AppKit point. A control's box is its alignment rectangle, so the
  distances are plain CSS gaps: 12px between controls (`var(--mac-space-control-gap)`), 20px
  from a window edge (`var(--mac-space-window-margin)`).
- Do not restyle a component by overriding its class with new colours. Use the tokens
  (`var(--mac-*)`, listed in `theming.md`) so both appearances keep working.
- Do not give a control an `inactive` or `windowState` prop. Window state is an attribute on
  an ancestor (next section).

## Attributes that theme a page

All styling state is carried by attributes, set on `<html>` or on any element to affect that
subtree. No provider component and no context are involved.

| Attribute | Values | Effect |
| --- | --- | --- |
| `data-appearance` | `light`, `dark`; absent follows the operating system | Aqua or Dark Aqua for the element and everything inside. |
| `data-accent` | `blue`, `purple`, `pink`, `red`, `orange`, `yellow`, `green`, `graphite`, or `custom` with `--mac-accent-light` and `--mac-accent-dark` set on the same element | Accent colour: default buttons, checked controls, selection, focus ring. Absent means blue. |
| `data-highlight` | one of the eight accent names, or `accent` | Text-selection highlight, when it should differ from the accent. |
| `data-window-state` | `key`, `main`, `inactive`; absent counts as key | The window an element belongs to. Controls keep their accent colour, focus ring and emphasised selection only in a key window. |

`data-window-state` is set only by a window component on its own root element and by
`trackWindowActivation()` on `<html>` (it mirrors the browser window's focus). A state that is
not `key` on any ancestor wins, so windows do not nest and exactly one window on a page is key.
Menus and popovers render in a portal and count as key windows of their own. Details:
`building-a-window.md`.

Components report their own state through attributes too (`data-size`, `data-variant`,
`data-disabled` and others); each component page lists them under "Styling hooks". The
attribute `data-force` exists only to pin a transient state in documentation and visual tests;
do not use it in an application.

## What is and is not exact

Read `fidelity.md` before promising a pixel match. In short: values tagged measured come from
the reference screenshots; values tagged provisional are estimates; text is San Francisco only
on Apple devices; no Apple fonts, icons or wallpapers are included, and demos use stand-in
artwork. A component page's "Guidelines" section paraphrases Apple's Human Interface Guidelines
and is marked "not verified" unless it links the source it was checked against.

## Work in this repository

Read `CONTRIBUTING.md` (where files go, API and styling conventions, window state, definition
of done) and `ARCHITECTURE.md` (why) before changing anything. The essentials:

```text
src/components/<name>/   one component: index.ts, <name>.tsx, <name>.css, <name>.test.tsx,
                         <name>.mdx (docs page), <name>.visual.json, examples/*.tsx
src/lib/                 small helpers, one concern per file
src/styles/tokens/       design tokens (shared; change with care)
demos/<app>/             application demos, same layout as a component
docs/content/*.mdx       guides; docs/content/examples/*.tsx are their live examples
docs/                    documentation site and the Markdown export (docs/agent-docs.ts)
visual/                  comparison of examples with reference screenshots
reference/               screenshot catalogue and measured spec (read only)
```

- Every list is generated from the folders: package entries, the docs sidebar, props tables,
  the copy-in registry, the baseline tests and the Markdown export. Never add an index file,
  route table or component list; `npm run lint` rejects `src/index.ts`.
- `npm run new -- <name>` scaffolds a component that already passes every check.
- Component CSS uses tokens only: no raw colours, no `light-dark()`, no test of the appearance.
  A value that differs between Aqua and Dark Aqua is a token: shared in `src/styles/tokens/`,
  or the component's own in `<name>.tokens.css` (CONTRIBUTING, "Component token files").
- A docs page is assembled into its Markdown twin automatically. Keep JSDoc on every prop with
  `@default`, keep `examples/basic.tsx` minimal and complete, and keep the page's sections in
  the order CONTRIBUTING gives. The build names the file when something a page needs is missing.

Commands (Node 22.23.4 or newer; 24.22.1+ on Node 24, 26.12.1+ on Node 26):

| Command | Use |
| --- | --- |
| `npm install` | Install dependencies. |
| `npm run dev` | Docs site with live reload on http://localhost:3000; also serves `/llms.txt` and the `.md` pages. |
| `npm run typecheck` | TypeScript. |
| `npm run lint` | Biome and the convention check (`npm run format` fixes formatting). |
| `npm test` | Unit tests; render, server-render and accessibility checks of every example; checks of the Markdown export against the source. |
| `npm run build` | Library, copy-in registry, size report and `dist/docs/`. |
| `npm run docs:build` | Static site and Markdown export in `docs/dist/`; fails when a component folder lacks what its page needs. |
| `npm run check` | The five above, in that order. Run it before handing work over. |
| `npm run visual -- <name>` | Compare examples with the reference screenshots (`npm run visual:install` and `npm run reference:fetch` once). |

`ENFORCE_COMPONENTS=<name>,<name>` limits the folder checks to the named components while
other folders in the tree are unfinished; see `CONTRIBUTING.md`, Commands.

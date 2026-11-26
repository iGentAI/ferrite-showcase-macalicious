# Demos

Full application demos (Finder, Calculator, System Preferences, …) live here, one folder per
application. A demo is documentation: it shows how the components compose into a real Catalina
window, appears in the docs site under **Demos** and on its [demo index](../docs/content/demos.mdx)
with a light and a dark picture taken by the docs build, and is compared with its reference
screenshot like a component. Demos are not part of the published package.

```text
demos/calculator/
  calculator.mdx            docs page (frontmatter: title, description; layout: full for wide pages)
  calculator.tsx            the demo's own components and state
  calculator.css            demo-specific styles, classes prefixed .mac-calculator
  examples/
    basic.tsx               export default: the demo as shown in the docs (<Example name="basic" />)
    visual-window.tsx       sized to the reference screenshot, for the visual comparison
  calculator.visual.json    comparisons against reference/screenshots, light and dark
  calculator.test.tsx       behaviour tests (optional but expected for interactive demos)
```

Rules:

- Import components the way a consumer does: `import { PushButton } from "macalicious/push-button"`.
- Build from library components. If a demo needs a control the library lacks, add it to
  `src/components` rather than styling it privately in the demo.
- No Apple artwork: application icons, desktop pictures and photographs are replaced by neutral
  placeholders or original drawings.
- Every file in `examples/` is rendered, server-rendered and checked for accessibility
  violations by `npm test` with no registration.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the conventions shared with components.

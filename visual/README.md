# Visual comparison harness

Renders an example in a real browser at 1x and 2x and either compares it with a crop of a
reference screenshot (a diff image, a mismatch score and a mean colour difference, each with a
required budget) or, for a state no screenshot shows, checks the pixels the comparison expects.

```bash
npm run visual:install          # once
npm run visual                  # all comparisons
npm run visual -- push-button   # filter
npm run visual:crop -- --file <screenshot.png> --row 306   # inspect a reference
```

The guide for adding a comparison, the field reference and the scoring method are in
[`docs/content/visual-comparison.mdx`](../docs/content/visual-comparison.mdx) (the "Visual
comparison" page of the docs site).

| Path | Purpose |
| --- | --- |
| `run.mjs` | Runner: finds `*.visual.json`, drives the browser, writes `output/`. |
| `crop.mjs` | Reference inspection: sizes, crops, pixel rows and columns in sRGB. |
| `harness/` | The page that renders one example alone. |
| `checks/harness/` | The harness's own checks, run with the others by `npm run visual`: fixtures that prove in the browser that the pointer is parked away from the example and that `forcedColors` switches forced colours on. |
| `lib/compare.mjs` | Reference loading (ICC to sRGB, 2x2 averaging to 1x), pixel comparison, expected pixels, composite sheet. |
| `lib/spec.mjs` | The rules for `*.visual.json`, applied by the runner and by `npm run lint`. |
| `lib/output.mjs` | Prepares the output directory; removes only files an earlier run wrote. |
| `lib/report.mjs` | `report.json` and `report.html`. |
| `visual.schema.json` | Schema of `*.visual.json`, for editors. |
| `output/` | Results. Not committed. A run replaces its own images and reports and leaves other files alone. |

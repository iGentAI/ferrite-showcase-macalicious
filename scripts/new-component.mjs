#!/usr/bin/env node
// Scaffold a component: npm run new -- <kebab-name>
//
// Creates src/components/<name>/ with every file the conventions require, in a state that
// already passes typecheck, lint and tests. Replace the placeholder markup, styles and
// reference crop with the real component. The visual file starts with "pending": lint lists
// it as unfinished until it holds a comparison in each appearance and "pending" is removed.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { componentNameProblem } from "./lib/names.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2];

if (!name || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
  console.error("Usage: npm run new -- <component-name>   (kebab-case, e.g. pop-up-button)");
  process.exit(2);
}
const problem = componentNameProblem(name);
if (problem) {
  console.error(`Cannot create src/components/${name}: ${problem}.`);
  process.exit(2);
}

const dir = path.join(root, "src/components", name);
if (existsSync(dir)) {
  console.error(`src/components/${name} already exists.`);
  process.exit(1);
}

const Pascal = name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
const title = name.replace(/(^|-)([a-z0-9])/g, (_, dash, c) => (dash ? " " : "") + c.toUpperCase());

const files = {
  "index.ts": `export type { ${Pascal}Props } from "./${name}";
export { ${Pascal} } from "./${name}";
`,

  [`${name}.tsx`]: `import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./${name}.tokens.css";
import "./${name}.css";

export interface ${Pascal}Props extends ComponentProps<"div"> {
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
}

/**
 * ${title}. Replace this element with the matching Base UI primitive where one exists
 * (import it by subpath, for example \`@base-ui/react/checkbox\`).
 */
export function ${Pascal}({ size = "regular", className, ...props }: ${Pascal}Props) {
  return <div data-size={size} className={cn("mac-${name}", className)} {...props} />;
}
`,

  [`${name}.css`]: `/*
 * ${title}.
 *
 * States
 *   [data-size="small" | "mini"]       control size
 *   [data-disabled]                    disabled
 *   :where([data-window-state="main"], [data-window-state="inactive"]) *
 *                                      not the key window (CONTRIBUTING, "Window state")
 */
.mac-${name} {
  box-sizing: border-box;
  border: var(--mac-hairline) solid var(--mac-${name}-border);
  color: var(--mac-color-control-text);
  font: var(--mac-font-control-regular);
}

.mac-${name}:where([data-size="small"]) {
  font: var(--mac-font-control-small);
}

.mac-${name}:where([data-size="mini"]) {
  font: var(--mac-font-control-mini);
}
`,

  [`${name}.tokens.css`]: `/*
 * ${title}: the values that differ between Aqua and Dark Aqua and belong to this component
 * alone (CONTRIBUTING, "Component token files"). Only --mac-${name}-* declarations, each with
 * a token tag. A value a second component needs is requested from the owner of
 * src/styles/tokens/ instead. Delete this file and its import if the component needs none.
 */
:root {
  /* [provisional] scaffold placeholder: replace with the measured edge */
  --mac-${name}-border: light-dark(rgb(0 0 0 / 0.15), rgb(255 255 255 / 0.15));
}
`,

  [`${name}.test.tsx`]: `import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { ${Pascal} } from "./index";

describe("${Pascal}", () => {
  it("renders with its class and default size", () => {
    render(<${Pascal} data-testid="subject">Content</${Pascal}>);
    const element = screen.getByTestId("subject");
    expect(element).toHaveClass("mac-${name}");
    expect(element).toHaveAttribute("data-size", "regular");
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <${Pascal} ref={ref} className="extra" id="subject">
        Content
      </${Pascal}>,
    );
    expect(ref.current).toHaveClass("mac-${name}", "extra");
    expect(ref.current).toHaveAttribute("id", "subject");
  });
});
`,

  [`${name}.mdx`]: `---
title: ${title}
description: One sentence saying what the control is for.
---

<Example name="basic" both />

## Usage

\`\`\`tsx
import { ${Pascal} } from "macalicious/${name}";
import "macalicious/${name}.css";
\`\`\`

## API

<PropsTable name="${Pascal}Props" />

## Accessibility

Describe the role, the keyboard behaviour and what the consumer must supply (labels).
`,

  [`${name}.visual.json`]: `{
  "$schema": "../../../visual/visual.schema.json",
  "pending": "Scaffolded: no reference crop chosen yet.",
  "comparisons": []
}
`,

  "examples/basic.tsx": `import { ${Pascal} } from "macalicious/${name}";

export default function Basic() {
  return <${Pascal}>${title}</${Pascal}>;
}
`,
};

for (const [file, content] of Object.entries(files)) {
  const target = path.join(dir, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
  console.log(`created src/components/${name}/${file}`);
}

console.log(`
Next:
  1. Find the control in reference/screenshots and measure it:  npm run visual:crop -- --file <png> --row <y>
  2. Build it on the Base UI primitive, styled only with tokens: shared ones from
     src/styles/tokens, its own appearance-dependent values in ${name}.tokens.css.
  3. Add examples, tests, the docs page, and comparisons in ${name}.visual.json (light and dark,
     each with budget and deltaBudget), then delete its "pending" line.
  4. npm run check && npm run visual -- ${name}
See CONTRIBUTING.md.`);

import axe from "axe-core";
import { expect } from "vitest";

/**
 * Assert that axe-core finds no accessibility violations in `container`.
 *
 * Colour contrast is not checked: jsdom does not compute styles, so axe's contrast rule cannot
 * run here, and no other test in the suite measures contrast.
 */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`)).toEqual(
    [],
  );
}

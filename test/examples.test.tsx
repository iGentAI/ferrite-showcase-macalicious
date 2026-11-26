import { cleanup, render } from "@testing-library/react";
import type { ComponentType } from "react";
import { renderToString } from "react-dom/server";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import { expectNoA11yViolations } from "./a11y";

/**
 * Baseline checks that every example of every component, demo and guide gets for free, with no
 * file to register: it renders in the browser environment and on the server without errors or
 * console noise, and axe-core finds no accessibility violations.
 */
const modules = import.meta.glob<{ default: ComponentType }>([
  "../src/components/*/examples/*.tsx",
  "../demos/*/examples/*.tsx",
  "../docs/content/examples/*.tsx",
]);

// The spies are created per test: `restoreMocks` in vitest.config.ts restores every spy after
// each test, so a spy created once at module level would only observe the first test.
let consoleError: MockInstance<typeof console.error>;
let consoleWarn: MockInstance<typeof console.warn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error");
  consoleWarn = vi.spyOn(console, "warn");
});

// Checked after every test, the accessibility one included, and after unmounting, so a warning
// logged by an effect or its cleanup fails the test as well.
afterEach(() => {
  cleanup();
  expect(consoleError).not.toHaveBeenCalled();
  expect(consoleWarn).not.toHaveBeenCalled();
});

/**
 * How long an example's module may take to load. Loading is the bundler transforming the
 * example and everything it imports, which for the desktop demo is every application demo and
 * most of the library: seconds on a busy machine, and not what these tests are about. It gets
 * a limit of its own, so that a test's limit covers the rendering it checks.
 */
const LOAD_TIMEOUT = 120_000;

describe.each(Object.keys(modules).sort())("example %s", (file) => {
  const load = modules[file] as () => Promise<{ default: ComponentType }>;
  let Example: ComponentType;

  // A module that logs an error or a warning while it loads fails here, as an example that
  // logs one while it renders fails its test. The spies of `beforeEach` are not installed yet.
  beforeAll(async () => {
    const error = vi.spyOn(console, "error");
    const warn = vi.spyOn(console, "warn");
    try {
      ({ default: Example } = await load());
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
      warn.mockRestore();
    }
  }, LOAD_TIMEOUT);

  it("has a default export that renders without errors or warnings", () => {
    expect(typeof Example).toBe("function");
    const { container } = render(<Example />);
    expect(container).not.toBeEmptyDOMElement();
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("renders on the server", () => {
    expect(renderToString(<Example />)).not.toBe("");
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Example />);
    await expectNoA11yViolations(container);
  });
});

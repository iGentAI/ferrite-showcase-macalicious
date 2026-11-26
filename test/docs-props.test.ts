// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PropsDoc } from "../docs/plugins.ts";
import { Description } from "../docs/src/description.tsx";
import { codeSpans, findProps } from "../docs/src/props.ts";

/**
 * Props tables are looked up by component folder and interface name. They used to be keyed
 * by interface name alone, so with two components exporting an `ItemProps` one component's
 * page showed the other's props.
 */
const doc = (name: string, prop: string) => ({ name, props: [{ name: prop }] }) as PropsDoc;
const all = {
  "toolbar/ItemProps": doc("ItemProps", "toolbarOnly"),
  "stepper/ItemProps": doc("ItemProps", "stepperOnly"),
  "stepper/StepperProps": doc("StepperProps", "value"),
};
const propOf = (dir: string | undefined, name: string) =>
  findProps(all, dir, name).doc?.props[0]?.name;

describe("findProps", () => {
  it("gives a component page its own interface of that name", () => {
    expect(propOf("src/components/stepper", "ItemProps")).toBe("stepperOnly");
    expect(propOf("src/components/toolbar", "ItemProps")).toBe("toolbarOnly");
  });

  it("lets any page name another component's interface outright", () => {
    expect(propOf("docs/content", "toolbar/ItemProps")).toBe("toolbarOnly");
    expect(propOf("src/components/stepper", "toolbar/ItemProps")).toBe("toolbarOnly");
  });

  it("resolves a bare name elsewhere only when one component has it", () => {
    expect(propOf("docs/content", "StepperProps")).toBe("value");
    expect(findProps(all, "docs/content", "ItemProps")).toEqual({
      ambiguous: ["toolbar/ItemProps", "stepper/ItemProps"],
    });
    expect(findProps(all, "docs/content", "MissingProps")).toEqual({});
  });
});

/**
 * A props description is JSDoc, where backticks mark code. The site's props table used to
 * print them as characters, while the Markdown export of the same page showed inline code.
 */
describe("codeSpans", () => {
  const text = (value: string) => ({ text: value, code: false });
  const code = (value: string) => ({ text: value, code: true });

  it("splits a description at its code spans", () => {
    expect(codeSpans("Shown while `value` is empty.")).toEqual([
      text("Shown while "),
      code("value"),
      text(" is empty."),
    ]);
    expect(codeSpans("`a`, `b`")).toEqual([code("a"), text(", "), code("b")]);
    expect(codeSpans("No code here.")).toEqual([text("No code here.")]);
    expect(codeSpans("")).toEqual([]);
  });

  it("closes a span only at a run of the same length, and drops one space of padding", () => {
    expect(codeSpans("A type such as ``a`b``.")).toEqual([
      text("A type such as "),
      code("a`b"),
      text("."),
    ]);
    expect(codeSpans("`` `quoted` ``")).toEqual([code("`quoted`")]);
    expect(codeSpans("`a``b`")).toEqual([code("a``b")]);
    expect(codeSpans("` `")).toEqual([code(" ")]);
  });

  it("keeps a backtick run that is never closed as text", () => {
    expect(codeSpans("A lone ` stays.")).toEqual([text("A lone ` stays.")]);
    expect(codeSpans("Open `` then `one` span.")).toEqual([
      text("Open `` then "),
      code("one"),
      text(" span."),
    ]);
  });

  it("reads an escaped backtick outside a span as text, not as a delimiter", () => {
    expect(codeSpans("Write \\`literal\\` here.")).toEqual([text("Write `literal` here.")]);
    // The escape takes the first backtick; the one after it opens a span.
    expect(codeSpans("\\``x`")).toEqual([text("`"), code("x")]);
    // An escaped backslash is text, so the backtick after it is a delimiter.
    expect(codeSpans("\\\\`x`")).toEqual([text("\\"), code("x")]);
    expect(codeSpans("A path such as C:\\dir.")).toEqual([text("A path such as C:\\dir.")]);
  });

  it("keeps a backslash inside a span, where it escapes nothing", () => {
    expect(codeSpans("`a\\`b`")).toEqual([code("a\\"), text("b`")]);
    expect(codeSpans("`\\n`")).toEqual([code("\\n")]);
  });
});

describe("Description", () => {
  const html = (value: string) => renderToStaticMarkup(createElement(Description, { text: value }));

  it("draws code spans as inline code and everything else as text", () => {
    expect(html('Use `size="small"` in a <b>toolbar</b>.')).toBe(
      "Use <code>size=&quot;small&quot;</code> in a &lt;b&gt;toolbar&lt;/b&gt;.",
    );
    expect(html("")).toBe("");
  });

  it("draws an escaped backtick as a backtick", () => {
    expect(html("Write \\`literal\\` here, and `code`.")).toBe(
      "Write `literal` here, and <code>code</code>.",
    );
  });
});

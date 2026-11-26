import { createElement, Fragment, type ReactNode } from "react";
import { codeSpans } from "./props.ts";

/** A JSDoc description, with its Markdown code spans drawn as inline code. */
export function Description({ text }: { text: string }) {
  // Passed as separate children, not as a list: the pieces of one text never reorder.
  const children: ReactNode[] = [];
  for (const span of codeSpans(text)) {
    children.push(span.code ? createElement("code", null, span.text) : span.text);
  }
  return createElement(Fragment, null, ...children);
}

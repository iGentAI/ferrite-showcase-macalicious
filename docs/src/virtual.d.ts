declare module "virtual:docs-pages" {
  import type { ComponentType } from "react";

  export interface Page {
    path: string;
    dir: string;
    title: string;
    description: string;
    group: string;
    order: number;
    layout: string;
    ownHeading: boolean;
    /** Site-relative path of the page as plain Markdown, e.g. "components/push-button.md". */
    markdown: string;
    load: () => Promise<{ default: ComponentType<{ components?: Record<string, unknown> }> }>;
  }
  export const pages: Page[];
}

declare module "virtual:docs-props" {
  export const props: Record<string, import("../plugins.ts").PropsDoc>;
}

declare module "virtual:docs-tokens" {
  export const tokens: Record<string, import("../plugins.ts").TokenDoc[]>;
}

declare module "*.mdx" {
  import type { ComponentType } from "react";

  const Content: ComponentType<{ components?: Record<string, unknown> }>;
  export default Content;
}

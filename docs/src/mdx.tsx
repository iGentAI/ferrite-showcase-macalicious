import { pages as allPages, type Page } from "virtual:docs-pages";
import { props as allProps } from "virtual:docs-props";
import { tokens as allTokens } from "virtual:docs-tokens";
import {
  type AnchorHTMLAttributes,
  type ComponentType,
  createContext,
  type LazyExoticComponent,
  lazy,
  Suspense,
  type TableHTMLAttributes,
  use,
} from "react";
import { Description } from "./description.tsx";
import { findProps } from "./props.ts";

/** The page being rendered; lets <Example name> find the page's own examples folder. */
export const PageContext = createContext<Page | null>(null);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// Examples live next to what they document: a component, a demo, or the guides in docs/content.
const exampleModules = import.meta.glob<{ default: ComponentType }>([
  "../../src/components/*/examples/*.tsx",
  "../../demos/*/examples/*.tsx",
  "../content/examples/*.tsx",
]);
const exampleSources = import.meta.glob<{ default: { code: string; html: string } }>(
  [
    "../../src/components/*/examples/*.tsx",
    "../../demos/*/examples/*.tsx",
    "../content/examples/*.tsx",
  ],
  { query: "?source" },
);

/** Glob key of an example, from the repository-relative folder of its page. */
const exampleKey = (dir: string | undefined, name: string) =>
  dir?.startsWith("docs/")
    ? `../${dir.slice(5)}/examples/${name}.tsx`
    : `../../${dir}/examples/${name}.tsx`;

interface ExampleEntry {
  Component: LazyExoticComponent<ComponentType>;
  Source: LazyExoticComponent<ComponentType>;
}

const exampleCache = new Map<string, ExampleEntry | null>();

function Highlighted({ html }: { html: string }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: highlighted at build time from a file in this repository
  return <div className="docs-code" dangerouslySetInnerHTML={{ __html: html }} />;
}

function getExample(key: string): ExampleEntry | null {
  let entry = exampleCache.get(key);
  if (entry === undefined) {
    const load = exampleModules[key];
    const loadSource = exampleSources[key];
    entry =
      load && loadSource
        ? {
            Component: lazy(load),
            Source: lazy(async () => {
              const { html } = (await loadSource()).default;
              return { default: () => <Highlighted html={html} /> };
            }),
          }
        : null;
    exampleCache.set(key, entry);
  }
  return entry;
}

export interface ExampleProps {
  /** File name, without extension, in the page's examples/ folder. */
  name: string;
  /** Render the preview twice, in Aqua and Dark Aqua, side by side. */
  both?: boolean;
  /** Hide the source code (for galleries). */
  hideCode?: boolean;
}

/** A live preview of an example file, with its source. */
export function Example({ name, both = false, hideCode = false }: ExampleProps) {
  const page = use(PageContext);
  const key = exampleKey(page?.dir, name);
  const example = getExample(key);

  if (!example) {
    return (
      <p className="docs-error" role="alert">
        Example not found: <code>{`${page?.dir}/examples/${name}.tsx`}</code>
      </p>
    );
  }

  const { Component, Source } = example;
  return (
    <figure className="docs-example" data-example={name}>
      <Suspense fallback={<div className="docs-preview" aria-busy="true" />}>
        {both ? (
          <div className="docs-preview-pair">
            <div className="docs-preview" data-appearance="light">
              <Component />
            </div>
            <div className="docs-preview" data-appearance="dark">
              <Component />
            </div>
          </div>
        ) : (
          <div className="docs-preview">
            <Component />
          </div>
        )}
      </Suspense>
      {hideCode ? null : (
        <Suspense fallback={<div className="docs-code" aria-busy="true" />}>
          <Source />
        </Suspense>
      )}
    </figure>
  );
}

/** Props table generated from an exported `*Props` interface and its JSDoc comments. */
export function PropsTable({ name }: { name: string }) {
  const page = use(PageContext);
  const { doc, ambiguous } = findProps(allProps, page?.dir, name);
  if (!doc) {
    return (
      <p className="docs-error" role="alert">
        {ambiguous ? (
          <>
            More than one component exports <code>{name}</code>: name one of{" "}
            <code>{ambiguous.join(", ")}</code>.
          </>
        ) : (
          <>
            No exported interface named <code>{name}</code>.
          </>
        )}
      </p>
    );
  }
  return (
    <>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr>
              <th scope="col">Prop</th>
              <th scope="col">Type</th>
              <th scope="col">Default</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            {doc.props.map((prop) => (
              <tr key={prop.name}>
                <th scope="row">
                  <code>{prop.name}</code>
                  {prop.required ? <span className="docs-required"> required</span> : null}
                </th>
                <td>
                  <code>{prop.type}</code>
                </td>
                <td>{prop.defaultValue ? <code>{prop.defaultValue}</code> : "–"}</td>
                <td>
                  <Description text={prop.description} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {doc.extends.length > 0 ? (
        <p className="docs-note">
          Also accepts every prop of <code>{doc.extends.join(", ")}</code>.
        </p>
      ) : null}
    </>
  );
}

const isColor = (value: string) => /^(#|rgb|oklch|light-dark|color-mix)/.test(value);

/** Token table generated from one of the files in src/styles/tokens. */
export function TokenTable({ file }: { file: string }) {
  const list = allTokens[file];
  if (!list) {
    return (
      <p className="docs-error" role="alert">
        No token file named <code>{file}.css</code>.
      </p>
    );
  }
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Value</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {list.map((token) => (
            <tr key={token.name}>
              <th scope="row">
                {isColor(token.value) ? (
                  <span className="docs-color" style={{ background: `var(${token.name})` }} />
                ) : null}
                <code>{token.name}</code>
              </th>
              <td>
                <code>{token.value}</code>
              </td>
              <td>
                {token.status ? (
                  <span className="docs-status" data-status={token.status}>
                    {token.status}
                  </span>
                ) : (
                  "–"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface PageListProps {
  /** Sidebar group whose pages are listed: "Components", "Demos", … */
  group: string;
  /** Comma-separated folder names: list only these pages of the group, those that exist. */
  only?: string;
  /** Comma-separated folder names: leave these pages of the group out. */
  except?: string;
  /** Shown instead of the list while there is nothing to list. */
  empty?: string;
  /**
   * Show the pages as cards with their light and dark screenshots instead of a plain list;
   * "large" for whole windows. A page without screenshots gets a card without pictures.
   */
  gallery?: boolean | "large";
}

declare global {
  /** Set by docs/build.mjs while prerendering: the routes that have screenshots. */
  var __DOCS_SCREENSHOTS__: string[] | undefined;
}

let screenshotRoutes: Set<string> | undefined;

/**
 * The routes with a light and a dark screenshot. The build takes them from the built site in a
 * browser (docs/browser-pass.mjs) and writes the list into every page, so the prerendered HTML
 * and the client agree. The dev server and a build without a browser have none.
 */
function screenshots(): Set<string> {
  if (typeof document === "undefined") return new Set(globalThis.__DOCS_SCREENSHOTS__ ?? []);
  if (!screenshotRoutes) {
    let list: string[] = [];
    try {
      list = JSON.parse(document.getElementById("docs-screenshots")?.textContent ?? "[]");
    } catch {
      // Not this build's list; show the cards without pictures.
    }
    screenshotRoutes = new Set(list);
  }
  return screenshotRoutes;
}

const APPEARANCE_NAMES = { light: "Aqua", dark: "Dark Aqua" } as const;

/**
 * The pages of one group, with their descriptions. Generated from the folders like the
 * sidebar, so a guide that points at "every component" or "the demos" never goes stale, and a
 * guide written before the pages it points at shows its `empty` text until they arrive.
 */
export function PageList({ group, only, except, empty, gallery = false }: PageListProps) {
  const names = only?.split(",").map((name) => name.trim());
  const excluded = except?.split(",").map((name) => name.trim()) ?? [];
  const list = allPages.filter((page) => {
    const name = page.path.split("/").pop() ?? "";
    return page.group === group && (!names || names.includes(name)) && !excluded.includes(name);
  });
  if (list.length === 0) {
    return empty ? (
      <p className="docs-note">
        <em>{empty}</em>
      </p>
    ) : null;
  }
  if (gallery) {
    const withShots = screenshots();
    return (
      <ul className="docs-gallery" data-size={gallery === "large" ? "large" : undefined}>
        {list.map((page) => (
          <li key={page.path}>
            <a className="docs-card" href={`${BASE}${page.path}`}>
              {withShots.has(page.path) ? (
                <span className="docs-card-shots">
                  {(["light", "dark"] as const).map((appearance) => (
                    <img
                      key={appearance}
                      data-appearance={appearance}
                      src={`${BASE}/screenshots${page.path}-${appearance}.png`}
                      alt={`${page.title} in ${APPEARANCE_NAMES[appearance]}`}
                      loading="lazy"
                      decoding="async"
                    />
                  ))}
                </span>
              ) : null}
              <span className="docs-card-title">{page.title}</span>
              {page.description ? <span className="docs-card-text">{page.description}</span> : null}
            </a>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul>
      {list.map((page) => (
        <li key={page.path}>
          <a href={`${BASE}${page.path}`}>{page.title}</a>
          {page.description ? `: ${page.description}` : null}
        </li>
      ))}
    </ul>
  );
}

/** Internal links in Markdown are written from the site root; prefix the configured base. */
function Anchor({ href = "", children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const external = /^[a-z]+:/i.test(href);
  return (
    <a
      href={href.startsWith("/") ? `${BASE}${href}` : href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : null)}
      {...rest}
    >
      {children}
    </a>
  );
}

/**
 * A Markdown table, in the box the generated tables have: wider than the column (five columns
 * of unbroken headings at a phone's width), it scrolls on its own instead of widening the page.
 */
function MarkdownTable(props: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="docs-table-wrap">
      <table {...props} />
    </div>
  );
}

/** Components available in every .mdx page without an import. */
export const mdxComponents = {
  Example,
  PropsTable,
  TokenTable,
  PageList,
  a: Anchor,
  table: MarkdownTable,
};

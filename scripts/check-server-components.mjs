#!/usr/bin/env node
// The built package inside a React Server Components application, for real: pack it, install
// it in a new Next.js App Router project, import every JavaScript entry of the package (the
// root entry, every component and every helper, as package.json "exports" names them) from a
// server component, show what each entry exports in the page, render the components that
// keep state, and build the application.
//
//   npm run build && node scripts/check-server-components.mjs
//   node scripts/check-server-components.mjs --keep     leave the application on disk
//   NEXT_VERSION=latest node scripts/check-server-components.mjs    another Next.js version
//
// It needs the network (it installs next, react and react-dom) and takes a minute or two, so
// it is not part of `npm run check`. What `npm run build` checks on every run is the cause it
// guards against: scripts/check-package.mjs fails when a built file that holds a module
// marked "use client" does not open with the directive. This script is the consequence, in the
// framework that reads the directive: without it the build below stops while it prerenders the
// page, because a server component cannot call useState.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { packageEntries } from "./lib/package-entries.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keep = process.argv.includes("--keep");
// The Next.js version this check was last run against. A fixed default, so that repeating the
// check on the same library gives the same answer; NEXT_VERSION tries another.
const NEXT_TESTED = "16.3.8";
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (!existsSync(path.join(root, "dist/components"))) {
  console.error("dist/components is missing: run `npm run build` first.");
  process.exit(2);
}
// Every JavaScript entry "exports" names, with the names taken from the source tree: an entry
// the build did not write stops the check here instead of being left out of it.
const { entries, missing } = packageEntries(root, pkg);
if (missing.length > 0) {
  console.error(
    `server components check failed: package.json "exports" names ${missing.length} entr${missing.length === 1 ? "y" : "ies"} with no built file; run \`npm run build\`:\n${missing.map((entry) => `  ${entry.specifier} -> ${path.relative(root, entry.file)}`).join("\n")}`,
  );
  process.exit(1);
}
// What each entry exports when it is loaded, which the page built below must show too.
const exportsOf = (module) =>
  Object.keys(module)
    .filter((name) => name !== "default" && name !== "__esModule")
    .sort()
    .join(" ");
for (const entry of entries) {
  entry.exports = exportsOf(await import(pathToFileURL(entry.file).href));
}
const components = entries
  .map((entry) => /^[^/]+\/([a-z0-9-]+)$/.exec(entry.specifier)?.[1])
  .filter(Boolean);

/** The components the page renders, with the markup each must leave in the built page. */
const RENDERED = [
  ["box", '<Box title="Server components">', "mac-box"],
  [
    "page-control",
    '<PageControl count={3} defaultPage={1} aria-label="Pages" />',
    "mac-page-control",
  ],
  ["progress-bar", '<ProgressBar value={64} aria-label="Progress" />', "mac-progress-bar"],
  ["progress-spinner", '<ProgressSpinner aria-label="Working" />', "mac-progress-spinner"],
  ["push-button", "<PushButton>OK</PushButton>", "mac-push-button"],
].filter(([name]) => components.includes(name));

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", CI: "1" },
    shell: process.platform === "win32",
  });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
};
const fail = (message, output = "") => {
  console.error(`server components check failed: ${message}`);
  if (output) console.error(output.trim().split("\n").slice(-40).join("\n"));
  console.error(`\nThe application is in ${app}`);
  process.exit(1);
};

const app = await mkdtemp(path.join(tmpdir(), "macalicious-rsc-"));

const packed = run("npm", ["pack", "--json", "--pack-destination", app], root);
if (packed.status !== 0) fail("npm pack", packed.output);
const tarball = JSON.parse(packed.output.slice(packed.output.indexOf("[")))[0].filename;

const pascal = (name) =>
  name
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
const react = pkg.peerDependencies.react;
await writeFile(
  path.join(app, "package.json"),
  `${JSON.stringify(
    {
      name: "macalicious-server-components-check",
      private: true,
      dependencies: {
        [pkg.name]: `file:./${tarball}`,
        next: process.env.NEXT_VERSION ?? NEXT_TESTED,
        react,
        "react-dom": pkg.peerDependencies["react-dom"],
      },
    },
    null,
    2,
  )}\n`,
);
await mkdir(path.join(app, "app"));
await writeFile(
  path.join(app, "app/layout.jsx"),
  `import "${pkg.name}/styles.css";

export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
);
// No "use client" here: this file is a server component, and so is everything it imports that
// does not say otherwise. Every entry is imported and the names it exports are written into
// the page, so an entry cannot be dropped as unused and the built page shows that the server
// build saw the same exports as the package has; the components that keep state are rendered,
// which is where a lost directive shows (the build stops with "useState is not a function").
await writeFile(
  path.join(app, "app/page.jsx"),
  `${entries.map((entry, i) => `import * as entry${i} from "${entry.specifier}";`).join("\n")}
${RENDERED.map(([name]) => `import { ${pascal(name)} } from "${pkg.name}/${name}";`).join("\n")}

const entries = [
${entries.map((entry, i) => `  ["${entry.specifier}", entry${i}],`).join("\n")}
];
const exportsOf = (module) =>
  Object.keys(module)
    .filter((name) => name !== "default" && name !== "__esModule")
    .sort()
    .join(" ");

export default async function Page() {
  return (
    <main data-entries={entries.length} data-rendered-by={typeof window === "undefined" ? "server" : "client"}>
      <ul>
        {entries.map(([specifier, module]) => (
          <li key={specifier} data-entry={specifier}>{exportsOf(module)}</li>
        ))}
      </ul>
${RENDERED.map(([name, jsx]) => (name === "box" ? "" : `      ${jsx}`))
  .filter(Boolean)
  .join("\n")}
${RENDERED.some(([name]) => name === "box") ? `      ${RENDERED.find(([name]) => name === "box")[1]}inside</Box>` : ""}
    </main>
  );
}
`,
);

console.log(`server components check: installing next in ${app}`);
const installed = run("npm", ["install", "--no-audit", "--no-fund"], app);
if (installed.status !== 0) fail("npm install", installed.output);
const next = JSON.parse(
  await readFile(path.join(app, "node_modules/next/package.json"), "utf8"),
).version;

const built = run("npx", ["next", "build"], app);
if (built.status !== 0) {
  fail(
    `next build (Next.js ${next}) does not accept the package in a server component`,
    built.output,
  );
}

const htmlFile = path.join(app, ".next/server/app/index.html");
if (!existsSync(htmlFile))
  fail(`the page was not prerendered (${htmlFile} is missing)`, built.output);
const html = await readFile(htmlFile, "utf8");
const absent = [
  `data-entries="${entries.length}"`,
  'data-rendered-by="server"',
  ...entries.map((entry) => `<li data-entry="${entry.specifier}">${entry.exports}</li>`),
  ...RENDERED.map(([, , marker]) => marker),
].filter((marker) => !html.includes(marker));
if (absent.length > 0) fail(`the prerendered page lacks ${absent.join(", ")}`);

console.log(
  `server components check: Next.js ${next} built a server component that imports all ${entries.length} JavaScript entries of the package (${components.length} components, ${entries.length - components.length} others) with the exports each has, and renders ${RENDERED.map(([name]) => name).join(", ")}`,
);
if (keep) console.log(`The application is in ${app}`);
else await rm(app, { recursive: true, force: true });

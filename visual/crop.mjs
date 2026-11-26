#!/usr/bin/env node
// Reference-screenshot inspection tool. See visual/README.md.
//
//   npm run visual:crop -- --file <name.png> --size
//   npm run visual:crop -- --file <name.png> --crop x,y,w,h [--zoom 8] [--out path.png]
//   npm run visual:crop -- --file <name.png> --row y[,x0,x1]     print one row of pixels
//   npm run visual:crop -- --file <name.png> --col x[,y0,y1]     print one column of pixels
//   npm run visual:crop -- --file <name.png> --at x,y            print one pixel
//
// All coordinates are in image pixels (the reference screenshots are 2x: 2 px = 1 CSS px).
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { referencePath, repoRoot } from "./lib/paths.mjs";

const { values } = parseArgs({
  options: {
    file: { type: "string" },
    crop: { type: "string" },
    zoom: { type: "string", default: "1" },
    out: { type: "string" },
    row: { type: "string" },
    col: { type: "string" },
    at: { type: "string" },
    size: { type: "boolean", default: false },
  },
});

if (!values.file) {
  console.error(
    "Usage: npm run visual:crop -- --file <screenshot.png> [--size|--crop|--row|--col|--at]",
  );
  process.exit(2);
}

const file = referencePath(values.file);
const nums = (s) => s.split(",").map(Number);
const hex = ([r, g, b, a]) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}${a < 255 ? ` a=${(a / 255).toFixed(3)}` : ""}`;

if (values.crop) {
  const [left, top, width, height] = nums(values.crop);
  const zoom = Number(values.zoom);
  const out = path.resolve(
    values.out ??
      path.join(
        repoRoot,
        "visual/output/crops",
        `${path.parse(file).name}-${left}-${top}-${width}x${height}@${zoom}.png`,
      ),
  );
  await mkdir(path.dirname(out), { recursive: true });
  let img = sharp(file).extract({ left, top, width, height });
  if (zoom !== 1) {
    img = sharp(await img.png().toBuffer()).resize({ width: width * zoom, kernel: "nearest" });
  }
  await img.png().toFile(out);
  console.log(out);
} else {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = (x, y) => {
    const i = (y * info.width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  // Collapse runs of identical pixels so gradients and edges are easy to read.
  const printRun = (coords, label) => {
    let start = 0;
    for (let i = 1; i <= coords.length; i++) {
      const prev = hex(px(...coords[i - 1]));
      if (i === coords.length || hex(px(...coords[i])) !== prev) {
        const a = label(coords[start]);
        const b = label(coords[i - 1]);
        console.log(
          `${a === b ? a : `${a}..${b}`}\t${prev}${i - start > 1 ? `\tx${i - start}` : ""}`,
        );
        start = i;
      }
    }
  };
  if (values.size) {
    console.log(
      `${info.width} x ${info.height} px (${info.width / 2} x ${info.height / 2} pt at 2x)`,
    );
  } else if (values.at) {
    const [x, y] = nums(values.at);
    console.log(hex(px(x, y)));
  } else if (values.row) {
    const [y, x0 = 0, x1 = info.width - 1] = nums(values.row);
    const coords = [];
    for (let x = x0; x <= x1; x++) coords.push([x, y]);
    printRun(coords, (c) => c[0]);
  } else if (values.col) {
    const [x, y0 = 0, y1 = info.height - 1] = nums(values.col);
    const coords = [];
    for (let y = y0; y <= y1; y++) coords.push([x, y]);
    printRun(coords, (c) => c[1]);
  }
}

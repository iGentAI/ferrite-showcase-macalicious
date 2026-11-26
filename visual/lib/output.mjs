import { existsSync, statSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

/** The files the runner writes for one comparison: <name>@<scale>x.<kind>.png. */
const OWN_IMAGE = /^[a-z][a-z0-9-]*@[12]x\.(actual|expected|diff|compare)\.png$/;
const OWN_REPORTS = ["report.html", "report.json"];

/**
 * Make the output directory ready for a run of the given folders, removing only what an
 * earlier run of this runner wrote there: the images of those folders and the two report
 * files. Nothing else is deleted, so pointing --out at a directory that holds other files
 * (or at the wrong directory) loses nothing, and other tools can keep their own files under
 * visual/output/.
 */
export async function prepareOutputDir(outDir, folders) {
  if (existsSync(outDir) && !statSync(outDir).isDirectory()) {
    throw new Error(`--out ${outDir} exists and is not a directory`);
  }
  await mkdir(outDir, { recursive: true });
  for (const report of OWN_REPORTS) await rm(path.join(outDir, report), { force: true });
  for (const folder of new Set(folders)) {
    const dir = path.join(outDir, folder);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isFile() && OWN_IMAGE.test(entry.name)) await rm(path.join(dir, entry.name));
    }
  }
}

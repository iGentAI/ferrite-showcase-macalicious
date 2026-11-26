import { writeFile } from "node:fs/promises";
import path from "node:path";

const pct = (n) => `${(n * 100).toFixed(2)}%`;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
/**
 * An image path as the value of a src attribute. The path is relative to the report; a folder
 * of the output directory may hold a character that means something in a URL (#, ?, %, a
 * space), and a path written on Windows has backslashes.
 */
const src = (file) => esc(String(file).split(/[\\/]/).map(encodeURIComponent).join("/"));

const sizeNote = (r) =>
  r.sizeMismatch
    ? `· <strong>size mismatch</strong>: actual ${r.actualSize.width}×${r.actualSize.height}, expected ${r.expectedSize.width}×${r.expectedSize.height}`
    : "";

function referenceSection(r) {
  return `
        <p>
          <strong>${pct(r.mismatch)}</strong> of ${r.comparedPixels} pixels differ by more than ${r.threshold}
          (budget ${pct(r.budget)}) · mean Δ ${r.meanDelta.toFixed(2)}/255 (budget ${r.deltaBudget.toFixed(2)})
          ${r.gated ? "" : "· budgets not enforced (--no-budget)"}
          ${r.slack && r.gated ? `· <strong>slack budget</strong>: the 2x budget may be at most ${r.highestBudget} (as written in the file) for this score${r.slackBudget ? "" : " (not enforced outside Chromium on Linux)"}` : ""}
          ${sizeNote(r)}
          ${r.resampledReference ? "· reference resampled to this scale" : ""}
        </p>
        <p class="ref">${esc(r.reference)} crop ${r.crop.x},${r.crop.y} ${r.crop.width}×${r.crop.height}</p>
        <figure><img src="${src(r.images.compare)}" alt="expected, actual and diff"><figcaption>expected · actual · diff</figcaption></figure>`;
}

function expectSection(r) {
  const rows = r.pixels
    .map(
      (pixel) => `
            <tr class="${pixel.pass ? "" : "bad"}">
              <td>${pixel.x}, ${pixel.y}</td>
              <td><span class="swatch" style="background:${esc(pixel.color)}"></span>${esc(pixel.color)} ±${pixel.tolerance}</td>
              <td>${pixel.actual ? `<span class="swatch" style="background:${esc(pixel.actual)}"></span>${esc(pixel.actual)}` : "outside the capture"}</td>
              <td>${esc(pixel.note)}</td>
            </tr>`,
    )
    .join("");
  return `
        <p>
          <strong>${r.pixels.length - r.failedPixels} of ${r.pixels.length}</strong> expected pixels match;
          no screenshot shows this state ${sizeNote(r)}
        </p>
        <table><thead><tr><th>Point</th><th>Expected</th><th>Rendered</th><th>Source of the value</th></tr></thead><tbody>${rows}</tbody></table>
        <figure><img src="${src(r.images.actual)}" alt="rendered example"><figcaption>rendered</figcaption></figure>`;
}

/** Write report.json (machine-readable) and report.html (side-by-side viewer) into outDir. */
export async function writeReport(outDir, results, browser) {
  const summary = { generated: new Date().toISOString(), browser, results };
  await writeFile(path.join(outDir, "report.json"), `${JSON.stringify(summary, null, 2)}\n`);

  const rows = results
    .map(
      (r) => `
      <section class="${r.pass ? "pass" : "fail"}">
        <h2>${esc(r.id)} <small>@${r.scale}x · ${esc(r.appearance)}</small></h2>
        <p>${esc(r.description ?? "")}</p>${r.kind === "expect" ? expectSection(r) : referenceSection(r)}
      </section>`,
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Macalicious visual comparisons</title>
<style>
  body { font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; margin: 24px; color-scheme: light dark; }
  section { border-left: 4px solid #28cd41; padding: 0 0 8px 12px; margin: 0 0 32px; }
  section.fail { border-color: #ff3b30; }
  h1 { font-size: 20px; } h2 { font-size: 15px; margin: 0; } small { font-weight: 400; opacity: .6; }
  p { margin: 4px 0; } .ref { opacity: .6; font-family: ui-monospace, Menlo, monospace; font-size: 11px; }
  figure { margin: 8px 0 0; } img { max-width: 100%; image-rendering: pixelated; } figcaption { opacity: .6; }
  table { border-collapse: collapse; margin: 6px 0; } th, td { text-align: left; padding: 2px 12px 2px 0; }
  tr.bad td { color: #ff3b30; font-weight: 600; }
  .swatch { display: inline-block; width: 10px; height: 10px; margin-right: 4px; border: 1px solid #8888; vertical-align: -1px; }
</style>
<h1>Visual comparisons</h1>
<p>${esc(browser.browser)} ${esc(browser.version)} · ${esc(summary.generated)}</p>
${rows}
</html>
`;
  await writeFile(path.join(outDir, "report.html"), html);
}

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("automator-page-steps");
const stamp = Date.now();

await run(async (page) => {
  await openDesktop(page, base, step);
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "automator"])],
    rev: library.rev,
  });
  await reloadDesktop(page);
  await launch(page, "Automator");
  const actions = page.getByRole("grid", { name: "Actions" });
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 15_000 });
  const outline = page.getByRole("treegrid", { name: "Action categories" });
  const stepOf = (name) =>
    page.locator('section[aria-label="Workflow"]').getByRole("group", { name, exact: true });
  const logRows = () => page.getByRole("grid", { name: "Log" }).getByRole("row").allInnerTexts();
  const add = async (name, grid = actions) => {
    await page.getByRole("searchbox", { name: "Search" }).fill(name);
    await grid.getByText(name, { exact: true }).dblclick();
    await page.getByRole("searchbox", { name: "Search" }).fill("");
  };
  const run1 = () =>
    page.getByRole("toolbar", { name: "Toolbar" }).getByRole("button", { name: "Run" }).click();
  const ended = () =>
    page
      .getByRole("grid", { name: "Log" })
      .getByText(/^Workflow (completed|failed)$/)
      .waitFor({ timeout: 20_000 });

  step(
    "the outline has the thirteen categories",
    (await outline.getByRole("row").allInnerTexts()).map((t) => t.trim()).join(",") ===
      "Library,Calendar,Contacts,Developer,Files & Folders,Fonts,Internet,Mail,Movies,Music,PDFs,Photos,Text,Utilities,Most Used,Recently Added",
  );
  await outline.getByText("PDFs", { exact: true }).click();
  await actions.getByText("Combine PDF Pages", { exact: true }).click();
  await shot(page, path.join(out, "automator-pdfs-dimmed.png"));
  await outline.getByText("Library", { exact: true }).click();

  // A page step between server steps, saved on the real server.
  await page.getByRole("textbox", { name: "Workflow name" }).fill(`Batch ${stamp}`);
  await add("Get Specified Text");
  await stepOf("Get Specified Text").getByRole("textbox", { name: "text" }).fill("two words");
  await add("Ask for Confirmation");
  await add("Change Case of Text");
  await page.keyboard.press("ControlOrMeta+S");
  await page.getByText(`Saved “Batch ${stamp}”`).waitFor({ timeout: 10_000 });
  step("the real server takes a workflow with a page step", true);
  await run1();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 10_000 });
  await shot(page, path.join(out, "automator-question.png"));
  await dialog.getByRole("button", { name: "OK" }).click();
  await ended();
  let log = await logRows();
  step(
    "the run hands the items across the question to the server",
    log.some((l) => l.includes("Change Case of Text completed, 1 item: TWO WORDS")),
    log.join(" | "),
  );

  await reloadDesktop(page);
  await launch(page, "Automator");
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 15_000 });
  step(
    "the page step comes back from the saved workflow",
    (await stepOf("Ask for Confirmation").count()) === 1,
  );

  // A file item goes back to the server through the script step.
  const clear = page.getByRole("button", { name: "New Workflow" });
  await clear.click();
  await page
    .getByRole("button", { name: "Don’t Save" })
    .click({ timeout: 2000 })
    .catch(() => undefined);
  const file = `Documents/auto-${stamp}.txt`;
  await add("New Text File");
  await stepOf("New Text File").getByRole("textbox", { name: "path" }).fill(file);
  await stepOf("New Text File").getByRole("textbox", { name: "text" }).fill("hello from a file");
  await add("Get Specified Finder Items");
  await stepOf("Get Specified Finder Items").getByRole("checkbox", { name: "Enabled" }).waitFor();
  await stepOf("Get Specified Finder Items").locator("textarea").fill(file);
  await stepOf("Get Specified Finder Items").getByRole("button", { name: "Options" }).click();
  await stepOf("Get Specified Finder Items")
    .getByRole("checkbox", { name: /Ignore/ })
    .click();
  await add("Read Text Files");
  await add("Copy Finder Items");
  await stepOf("Copy Finder Items").getByRole("button", { name: "Options" }).click();
  await stepOf("Copy Finder Items")
    .getByRole("checkbox", { name: /Ignore/ })
    .click();
  await run1();
  await ended();
  log = await logRows();
  step(
    "a file item reaches Read Text Files through the script step",
    log.some((l) => l.includes("Read Text Files completed, 1 item: hello from a file")),
    log.join(" | "),
  );

  // Copy on the real drive.
  await stepOf("Copy Finder Items")
    .getByRole("checkbox", { name: /Ignore/ })
    .click();
  await stepOf("Read Text Files").getByRole("button", { name: "Remove Read Text Files" }).click();
  await stepOf("New Text File").getByRole("button", { name: "Remove New Text File" }).click();
  await stepOf("Copy Finder Items").getByRole("textbox", { name: "to" }).fill("Desktop");
  await run1();
  await page.waitForTimeout(500);
  await ended();
  log = await logRows();
  const drive = (await api(page, "GET", "/api/files/")).json;
  step(
    "Copy Finder Items copies on the drive",
    drive.entries.some((e) => e.name === `auto-${stamp}.txt` && e.parent === "desktop"),
    log.join(" | "),
  );

  // Variables, and a pane size across a reload.
  await page.getByRole("radio", { name: "Variables" }).click();
  const variables = page.getByRole("grid", { name: "Variables", exact: true });
  await variables.getByText("Current day", { exact: true }).dblclick();
  const pane = page.getByRole("grid", { name: "Workflow variables" });
  await pane.getByText("Current day", { exact: true }).waitFor({ timeout: 5000 });
  await shot(page, path.join(out, "automator-variables.png"));
  step(
    "the Variables pane lists the variable with today's value",
    (await pane.innerText()).includes(new Date().toLocaleString("en-US", { weekday: "long" })),
  );

  const divider = page.getByRole("separator", { name: "Resize the log" });
  const box = await divider.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 60, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  const moved = (await divider.boundingBox()).y;
  await reloadDesktop(page);
  await launch(page, "Automator");
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(800);
  const after = (await page.getByRole("separator", { name: "Resize the log" }).boundingBox()).y;
  step(
    "the log pane's size comes back after a reload",
    Math.abs(after - moved) < 3 && moved < box.y - 30,
    `before ${box.y}, moved ${moved}, after ${after}`,
  );
});

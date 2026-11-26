#!/usr/bin/env node
// Photos' People from detected faces, in a real browser against the running app. The fixture's portrait, the same face small on
// a wide picture, two faces in one picture and a picture of nobody are imported; the page finds their faces while idle from the
// thumbnails, and the server keeps the boxes, read back from GET /api/photos/library across a reload. Faces are named in People
// and in Info with existing names reused, undone and redone, refused with Not a Face, and a person's round tile is cropped to
// the face. Every request stays on the desktop's origin, and the boxes are the only thing sent. With the model refused, the pane
// says so. Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/photos-people-batch20-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run, expectRefusal } = journey("photos-people-batch20");
const tag = Date.now().toString(36);
const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(
  path.join(here, "../../../demos/photo-booth/vendor/face-fixture.jpg"),
).toString("base64");
const PORTRAIT = `Portrait ${tag}`;
const SMALL = `Small ${tag}`;
const PAIR = `Pair ${tag}`;
const NOBODY = `Nobody ${tag}`;
const LATE = `Late ${tag}`;
const ANN = `Ann${tag}`;
const BO = `Bo${tag}`;

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;
const named = async (page, name) =>
  ((await library(page)).photos ?? []).find((photo) => photo.name === name);

async function launch(page) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 10_000 });
  await until(async () => !(await win.getAttribute("aria-busy")));
  return win;
}

/** Pictures drawn in the page: `{ name, width, height, faces: [{ x, y, height }] }`, on grey. */
const importPictures = async (win, pictures) => {
  const transfer = await win.page().evaluateHandle(
    async ({ fixture, pictures }) => {
      const bytes = Uint8Array.from(atob(fixture), (each) => each.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
      const data = new DataTransfer();
      for (const { name, width, height, faces } of pictures) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        const sky = context.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, "#7d9cb5");
        sky.addColorStop(1, "#b8a98c");
        context.fillStyle = sky;
        context.fillRect(0, 0, width, height);
        for (const face of faces) {
          const across = (face.height * image.width) / image.height;
          context.drawImage(image, face.x, face.y, across, face.height);
        }
        const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.92));
        data.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
      }
      return data;
    },
    { fixture: FIXTURE, pictures },
  );
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
};

const faceTile = (win, photo, face) => win.locator(`[data-face="${photo.id}:${face}"]`);
const nameField = (scope) => scope.getByRole("combobox", { name: /^Name / });
const person = (win, name, count) =>
  win.getByRole("button", { name: `${name}, ${count}`, exact: true });

await run(async (page) => {
  const shots = (name) => shot(page, path.join(out, `people-${name}.png`));
  const away = [];
  const awayWrites = [];
  const facePosts = [];
  const modelReads = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(base) && !/^(blob|data):/.test(url)) {
      away.push(url);
      if (request.method() !== "GET") awayWrites.push(url);
    }
    const { pathname } = /^(blob|data):/.test(url) ? { pathname: "" } : new URL(url);
    if (pathname === "/api/photos/faces") facePosts.push(request.postData() ?? "");
    if (pathname.endsWith(".tflite")) modelReads.push(url);
  });

  await openDesktop(page, base, step);
  let win = await launch(page);
  await importPictures(win, [
    { name: PORTRAIT, width: 720, height: 900, faces: [{ x: 0, y: 0, height: 900 }] },
    { name: SMALL, width: 1440, height: 960, faces: [{ x: 900, y: 60, height: 330 }] },
    {
      name: PAIR,
      width: 1200,
      height: 800,
      faces: [
        { x: 40, y: 50, height: 700 },
        { x: 660, y: 50, height: 700 },
      ],
    },
    { name: NOBODY, width: 900, height: 600, faces: [] },
  ]);

  const looked = await until(async () => {
    const all = await Promise.all([PORTRAIT, SMALL, PAIR, NOBODY].map((n) => named(page, n)));
    return all.every((photo) => Array.isArray(photo?.faces)) ? all : null;
  }, 90_000);
  step("the page looks at every picture while idle, and the server keeps what it finds", !!looked);
  if (!looked) throw new Error("the pictures were not looked at");
  const [portrait, small, pair, nobody] = looked;
  const portraitFace = portrait.faces[0];
  step(
    "the portrait has one face, its box where the fixture's face is",
    portrait.faces.length === 1 &&
      Math.abs(portraitFace.x + portraitFace.width / 2 - 0.586) < 0.1 &&
      Math.abs(portraitFace.y + portraitFace.height / 2 - 0.257) < 0.1,
    JSON.stringify(portrait.faces),
  );
  step(
    "a small face found through the tiles, about a thirtieth of the picture's long side",
    small.faces.length === 1 && small.faces[0].x > 900 / 1440,
    JSON.stringify(small.faces),
  );
  step(
    "two faces in one picture are two boxes",
    pair.faces.length === 2,
    JSON.stringify(pair.faces),
  );
  step("the picture of nobody is kept as looked at, with none", nobody.faces.length === 0);
  step(
    "the model came from the desktop itself",
    modelReads.length > 0 && modelReads.every((url) => url.startsWith(base)),
    modelReads[0],
  );
  const longest = Math.max(...facePosts.map((body) => body.length));
  step(
    "what goes to the server is the boxes: no picture in any POST /faces",
    facePosts.length >= 4 && longest < 2_000 && !/base64|\/9j\//.test(facePosts.join()),
    `${facePosts.length} posts, longest ${longest} bytes`,
  );

  await win.click({ position: { x: 700, y: 650 } });
  await page.keyboard.press("Control+4");
  await win.getByRole("heading", { name: "Unnamed Faces" }).waitFor({ timeout: 8_000 });
  await until(async () => (await win.locator("[data-face] img").count()) >= 4);
  await page.waitForTimeout(500);
  const note = await win.locator(".mac-photos-people-note").textContent();
  step(
    "People says where faces are found and that they are not matched",
    /no picture leaves it/.test(note) && /not matched/.test(note),
    note,
  );
  await shots("unnamed");
  step(
    "People offers each face to name",
    (await nameField(faceTile(win, portrait, 0)).count()) === 1 &&
      (await nameField(faceTile(win, pair, 1)).count()) === 1 &&
      (await win.locator(`[data-face^="${nobody.id}:"]`).count()) === 0,
  );
  const crop = await faceTile(win, portrait, 0)
    .locator("img")
    .evaluate((image) => {
      const box = image.getBoundingClientRect();
      const round = image.parentElement.getBoundingClientRect();
      return {
        zoom: box.width / round.width,
        radius: getComputedStyle(image.parentElement).borderRadius,
      };
    });
  step(
    "a face's tile is round and zoomed in on the face",
    crop.radius === "50%" && crop.zoom > 1.5,
    JSON.stringify(crop),
  );

  await faceTile(win, portrait, 0)
    .getByRole("button", { name: /^Open the photo/ })
    .click();
  const viewer = win.getByRole("button", { name: "Back", exact: true });
  await until(() => viewer.isEnabled());
  await page.waitForTimeout(400);
  await shots("opened-from-face");
  step("a face's tile opens its photo", await viewer.isEnabled());
  await viewer.click();
  await faceTile(win, portrait, 0).waitFor({ timeout: 5_000 });

  const field = nameField(faceTile(win, portrait, 0));
  await field.fill(ANN);
  await field.press("Enter");
  const first = await until(async () => {
    const photo = await named(page, PORTRAIT);
    return photo.faces[0].name === ANN ? photo : null;
  });
  step("naming a face puts the name on the face and the photo", first?.people?.includes(ANN));
  const tile = person(win, ANN, "1 Photo");
  await tile.waitFor({ timeout: 5_000 });
  await until(async () => (await tile.locator(".mac-photos-face-image").count()) === 1);
  await page.waitForTimeout(400);
  await shots("named");
  step("the person's tile is cropped to the face", true);

  const pairField = nameField(faceTile(win, pair, 0));
  await pairField.fill(ANN.toLowerCase());
  await pairField.press("Enter");
  await person(win, ANN, "2 Photos").waitFor({ timeout: 5_000 });
  const again = await named(page, PAIR);
  step(
    "a name already given is reused, keeping its spelling",
    again.faces[0].name === ANN && again.people.join() === ANN,
    JSON.stringify(again.people),
  );

  await win.locator(".mac-photos-people-note").click();
  await page.keyboard.press("ControlOrMeta+z");
  await person(win, ANN, "1 Photo").waitFor({ timeout: 5_000 });
  const undone = await until(async () => {
    const photo = await named(page, PAIR);
    return !photo.faces[0].name && (photo.people ?? []).length === 0 ? photo : null;
  });
  step("Undo takes the name off the face and the photo", !!undone);
  await page.keyboard.press("Shift+ControlOrMeta+z");
  await person(win, ANN, "2 Photos").waitFor({ timeout: 5_000 });
  step("Redo gives it back", (await named(page, PAIR)).faces[0].name === ANN);

  await faceTile(win, pair, 1).getByRole("button", { name: "Not a Face" }).click();
  await until(async () => (await faceTile(win, pair, 1).count()) === 0);
  const refused = await named(page, PAIR);
  step(
    "Not a Face is kept and no longer offered",
    refused.faces[1].not_a_face === true && (await faceTile(win, pair, 1).count()) === 0,
  );

  await person(win, ANN, "2 Photos").click();
  const list = win.getByRole("listbox", { name: ANN });
  await list.waitFor({ timeout: 5_000 });
  step(
    "a person's tile lists the photos with their name, grouped by the name alone",
    (await list.getByRole("option").count()) === 2 &&
      (await list.getByRole("option", { name: SMALL }).count()) === 0,
  );
  await win.getByRole("button", { name: "Back", exact: true }).click();

  await win.getByRole("treeitem", { name: "Photos", exact: true }).click();
  await win.getByRole("button", { name: "All Photos", exact: true }).click();
  await win.getByRole("option", { name: SMALL, exact: true }).click();
  const info = page.locator(".mac-photos-info-window");
  if (!(await info.isVisible())) await page.keyboard.press("ControlOrMeta+i");
  await info.waitFor({ timeout: 5_000 });
  const offered = info.getByRole("group", { name: "Faces" });
  await offered.waitFor({ timeout: 5_000 });
  await until(async () => (await offered.locator("img").count()) === 1);
  await page.waitForTimeout(400);
  await shots("info");
  const infoName = offered.getByRole("combobox", { name: "Name face 1" });
  await infoName.fill(BO);
  await infoName.press("Enter");
  const inInfo = await until(async () => {
    const photo = await named(page, SMALL);
    return photo.faces[0].name === BO ? photo : null;
  });
  step("Info offers a face to name, and keeps it", inInfo?.people?.includes(BO));
  await page.waitForTimeout(300);
  await shots("info-named");
  step(
    "Info's People field shows the name given to the face",
    (await info.getByText(BO, { exact: true }).count()) >= 1,
  );

  const peopleField = info.getByRole("textbox", { name: "People" });
  await peopleField.focus();
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  const taken = await until(async () => {
    const photo = await named(page, SMALL);
    return (photo.people ?? []).length === 0 && !photo.faces[0].name ? photo : null;
  }, 5_000);
  step("taking the name off in Info's People takes it off the face", !!taken);
  await infoName.fill(BO);
  await infoName.press("Enter");
  await until(async () => (await named(page, SMALL)).faces[0].name === BO);
  await info.getByRole("button", { name: "Close" }).first().click();

  const postsBefore = facePosts.length;
  await reloadDesktop(page);
  win = await page
    .locator(".mac-window:has(.mac-photos-body)")
    .first()
    .waitFor({ timeout: 8_000 })
    .then(() => page.locator(".mac-window:has(.mac-photos-body)").first())
    .catch(() => launch(page));
  await until(async () => !(await win.getAttribute("aria-busy")));
  await win.getByRole("treeitem", { name: "People", exact: true }).click();
  const back = person(win, ANN, "2 Photos");
  await back.waitFor({ timeout: 8_000 });
  await person(win, BO, "1 Photo").waitFor({ timeout: 8_000 });
  await until(async () => (await back.locator(".mac-photos-face-image").count()) === 1);
  await page.waitForTimeout(2_500);
  await shots("after-reload");
  step(
    "names and boxes survive a reload, and nothing is looked at twice",
    facePosts.length === postsBefore,
    `${facePosts.length - postsBefore} new posts`,
  );

  await back.click();
  await win.getByRole("listbox", { name: ANN }).waitFor({ timeout: 5_000 });
  await win.getByRole("option", { name: PORTRAIT, exact: true }).click();
  await page.keyboard.press("ControlOrMeta+r");
  const turned = await until(async () => {
    const photo = await named(page, PORTRAIT);
    return photo.edit?.rotate === 1 && Array.isArray(photo.faces) ? photo : null;
  }, 30_000);
  step(
    "a turn clears the boxes, the page looks again, and the person stays",
    turned?.people?.includes(ANN),
    JSON.stringify(turned?.faces),
  );

  // The model refused: the pane says so, and nothing fails aloud.
  const modelUrl = modelReads[0];
  await page.route("**/*.tflite", (route) => route.fulfill({ status: 503, body: "refused" }));
  expectRefusal(503, new URL(modelUrl).pathname);
  await reloadDesktop(page);
  win = await page
    .locator(".mac-window:has(.mac-photos-body)")
    .first()
    .waitFor({ timeout: 8_000 })
    .then(() => page.locator(".mac-window:has(.mac-photos-body)").first())
    .catch(() => launch(page));
  await until(async () => !(await win.getAttribute("aria-busy")));
  await importPictures(win, [
    { name: LATE, width: 720, height: 900, faces: [{ x: 0, y: 0, height: 900 }] },
  ]);
  await until(async () => !!(await named(page, LATE)), 20_000);
  await win.getByRole("treeitem", { name: "Photos", exact: true }).click();
  await win.getByRole("treeitem", { name: "People", exact: true }).click();
  const sorry = win.getByText("Faces could not be looked for this time.", { exact: false });
  await sorry.waitFor({ timeout: 30_000 }).catch(() => {});
  await shots("model-refused");
  step(
    "with the model refused, People says faces could not be looked for",
    await sorry.isVisible(),
  );
  step("the photo stays not looked at, for a later page", !(await named(page, LATE)).faces);
  await page.unroute("**/*.tflite");

  // Info's location map reads OpenStreetMap's tiles, as it always has; nothing else goes out.
  const other = away.filter((url) => !url.startsWith("https://tile.openstreetmap.org/"));
  step(
    "no picture, box or name left the desktop: only the map's tile reads",
    other.length === 0 && awayWrites.length === 0,
    `${away.length} tile reads; ${other.slice(0, 3).join(" ")}`,
  );

  for (const name of [PORTRAIT, SMALL, PAIR, NOBODY, LATE]) {
    const photo = await named(page, name);
    if (photo) await api(page, "DELETE", `/api/photos/photos/${photo.id}`);
  }
});

#!/usr/bin/env node
// Group FaceTime on Ferrite, in browsers of their own (Chromium's fake cameras and microphones): Ana calls
// Ben, Ben accepts, Ana adds Cleo from the call panel or the Video menu, and Cleo accepts. All three then show
// two live pictures, read from each video element (its size, and its time advancing), carried by a WebRTC
// mesh with the server only signalling. Mute and Pause reach the one track each connection sends, a camera
// chosen in the Video menu reaches both other people, and Picture in Picture floats the first picture. Ben
// hangs up: Ana and Cleo stay connected with one picture each. Ana hangs up: the call ends for Cleo. The call
// is in everyone's recent calls on the server, named for its first other person with a count of the rest, and
// the row is there after a reload. Then a second call: Cleo's signals to Ana are refused, so Cleo's window
// names Ana as not reached while the call goes on with Ben; and Dee, the fourth, rings, which dims Add
// Person, and declines, which ends nothing. Exits 0 only when every step passed and no page logged a console
// error, a page error, a failed request or an HTTP error, other than the signals refused on purpose.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/facetime-group-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("facetime-group");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const ana = { name: `fgana-${id}`, fullName: `Ana ${id}`, password };
const ben = { name: `fgben-${id}`, fullName: `Ben ${id}`, password };
const cleo = { name: `fgcleo-${id}`, fullName: `Cleo ${id}`, password };
const dee = { name: `fgdee-${id}`, fullName: `Dee ${id}`, password };

const windowOf = (page) => page.getByRole("region", { name: "FaceTime" }).first();
const stateOf = (page) => windowOf(page).getAttribute("data-call-state");
const panelOf = (page) => windowOf(page).locator('[aria-label="Call"]');
const incomingOf = (page) => windowOf(page).locator('[aria-label="Incoming call"]');
const calls = async (page) =>
  (await page.request.get(new URL("/api/facetime/calls", page.url()).href)).json();

/** Who each remote picture is, its size, and whether its time is advancing. */
async function pictures(page) {
  const sample = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("video[data-remote]")].map((video) => ({
        name: video.getAttribute("data-remote"),
        width: video.videoWidth,
        time: video.currentTime,
      })),
    );
  const first = await sample();
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  return (await sample()).map((each) => ({
    ...each,
    advancing: each.time > (first.find((other) => other.name === each.name)?.time ?? 0),
  }));
}

/** Whether `page` shows exactly the live pictures of `people`. */
const showsLive = async (page, people) => {
  const shown = await pictures(page);
  return (
    shown.length === people.length &&
    people.every((person) =>
      shown.some((each) => each.name === person.fullName && each.width > 0 && each.advancing),
    )
  );
};

/** Each of Chromium's fake cameras draws its own colour, so the other people's pictures say which is on. */
async function colourCameras(page) {
  const paint = () => {
    const media = navigator.mediaDevices;
    const real = media.getUserMedia.bind(media);
    media.getUserMedia = async (constraints) => {
      const stream = await real(constraints);
      const [device] = stream.getVideoTracks();
      if (!device) return stream;
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const context = canvas.getContext("2d");
      const draw = () => {
        context.fillStyle = device.label.endsWith("0") ? "rgb(220,40,40)" : "rgb(40,80,220)";
        context.fillRect(0, 0, 320, 240);
        context.fillStyle = "#fff";
        context.fillRect((Date.now() / 20) % 300, 200, 20, 20);
      };
      draw();
      setInterval(draw, 50);
      const [painted] = canvas.captureStream(20).getVideoTracks();
      Object.defineProperty(painted, "label", { value: device.label });
      const stop = painted.stop.bind(painted);
      painted.stop = () => {
        device.stop();
        stop();
      };
      return new MediaStream([painted, ...stream.getAudioTracks()]);
    };
  };
  await page.addInitScript(paint);
  await page.evaluate(paint);
}
const RED = [220, 40, 40];
const BLUE = [40, 80, 220];
const looksLike = (color, rgb) =>
  !!color && color.every((value, index) => Math.abs(value - rgb[index]) < 60);

/** The colour near the corner of the picture of the person named. */
const colourOf = (page, name) =>
  page.evaluate((who) => {
    const video = [...document.querySelectorAll("video[data-remote]")].find(
      (each) => each.getAttribute("data-remote") === who,
    );
    if (!video?.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0);
    return [...context.getImageData(4, 4, 1, 1).data.slice(0, 3)];
  }, name);

const openVideoMenu = (page) =>
  page.getByRole("menubar").getByRole("menuitem", { name: "Video", exact: true }).first().click();
const videoItem = (page, name) => page.getByRole("menu").last().getByRole("menuitem", { name });

await run(
  {
    chromium: {
      args: [
        "--use-fake-device-for-media-stream=device-count=2",
        "--use-fake-ui-for-media-stream",
        "--disable-features=WebRtcHideLocalIpsWithMdns",
      ],
    },
  },
  {},
  async ({ person }) => {
    const a = await person("ana", ana);
    const b = await person("ben", ben);
    const c = await person("cleo", cleo);
    await colourCameras(a);
    for (const [label, page] of [
      ["Ana", a],
      ["Ben", b],
      ["Cleo", c],
    ]) {
      await openFromDock(page, "FaceTime");
      const camera = await within(15_000, () =>
        page.evaluate(() => {
          const video = document.querySelector("video[data-self]");
          return !!video && video.videoWidth > 0;
        }),
      );
      step(`${label}'s FaceTime shows their own camera`, camera !== null, `${camera} ms`);
    }

    // ── Ana calls Ben, and Ben accepts ──
    await windowOf(a).getByRole("textbox", { name: "Recipient" }).fill(ben.name);
    await windowOf(a).getByRole("button", { name: "Video", exact: true }).click();
    const rang = await within(15_000, () => incomingOf(b).isVisible());
    step("the call rings for Ben", rang !== null, `${rang} ms`);
    await incomingOf(b).getByRole("button", { name: "Accept" }).click();
    const two = await within(
      30_000,
      async () => (await stateOf(a)) === "connected" && (await stateOf(b)) === "connected",
    );
    step("Ana and Ben connect", two !== null, `${two} ms`);
    step(
      "each of the two shows the other's one picture, with no name over it",
      (await within(15_000, () => showsLive(a, [ben]))) !== null &&
        (await within(15_000, () => showsLive(b, [ana]))) !== null &&
        (await windowOf(a).locator(".mac-facetime-tile-name").count()) === 0,
    );

    // ── Ana adds Cleo ──
    await panelOf(a).getByRole("button", { name: "Add Person" }).click();
    const field = panelOf(a).getByRole("textbox", { name: "Person to add" });
    await field.fill("nobody");
    await panelOf(a).getByRole("button", { name: "Cancel" }).click();
    step("Cancel closes the field", (await field.count()) === 0);
    await openVideoMenu(a);
    await videoItem(a, "Add Person…").click();
    step(
      "Video > Add Person… opens it again, empty",
      (await within(5_000, async () => (await field.inputValue()) === "")) !== null,
    );
    await field.fill(cleo.name);
    await shot(a, "facetime-add-person");
    await panelOf(a).getByRole("button", { name: "Add", exact: true }).click();
    const ringing = await within(10_000, async () =>
      (await panelOf(a).innerText()).includes(`${cleo.fullName} · Ringing…`),
    );
    step("Cleo shows in Ana's panel as Ringing…", ringing !== null);
    step("and the field has closed", (await field.count()) === 0);
    const toBen = await within(10_000, async () =>
      (await panelOf(b).innerText()).includes(`${cleo.fullName} · Ringing…`),
    );
    step("and in Ben's", toBen !== null);
    const rangCleo = await within(15_000, () => incomingOf(c).isVisible());
    step("the call rings for Cleo", rangCleo !== null, `${rangCleo} ms`);
    const named = await incomingOf(c).innerText();
    step(
      "Cleo's panel names the people in the call",
      named.includes(`${ana.fullName} and 1 other`),
      named,
    );

    await incomingOf(c).getByRole("button", { name: "Accept" }).click();
    const three = await within(
      45_000,
      async () =>
        (await showsLive(a, [ben, cleo])) &&
        (await showsLive(b, [ana, cleo])) &&
        (await showsLive(c, [ana, ben])),
    );
    for (const [label, page] of [
      ["Ana", a],
      ["Ben", b],
      ["Cleo", c],
    ]) {
      step(
        `${label} shows two pictures, both playing`,
        three !== null,
        JSON.stringify(await pictures(page)),
      );
    }
    const held = (await calls(a)).active?.state;
    const detail = await a.request.get(new URL(`/api/facetime/calls/${held?.id}`, a.url()).href);
    const seen = (await detail.json()).state;
    step(
      "Ana reads the two links of her seat",
      seen.links.length === 2 && seen.links.every((link) => link.answer),
      `description bytes: ${seen.links.flatMap((link) => [link.offer.length, link.answer.length]).join(", ")}`,
    );
    const tiled = await windowOf(a).locator(".mac-facetime-tile-name").allInnerTexts();
    step(
      "each tile is named for its person",
      tiled.includes(ben.fullName) && tiled.includes(cleo.fullName),
      tiled.join(", "),
    );
    await shot(a, "facetime-group");
    await shot(c, "facetime-group-cleo");

    // ── Mute, Pause, a new camera and Picture in Picture, on every connection ──
    const localTracks = (kind) =>
      a.evaluate((wanted) => {
        const stream = document.querySelector("video[data-self]")?.srcObject;
        const list = wanted === "audio" ? stream?.getAudioTracks() : stream?.getVideoTracks();
        return (list ?? []).map((track) => track.enabled);
      }, kind);
    await panelOf(a).getByRole("button", { name: "Mute" }).click();
    const silent = await within(3_000, async () => (await localTracks("audio")).every((on) => !on));
    step("Mute silences the one microphone track every connection sends", silent !== null);
    await panelOf(a).getByRole("button", { name: "Unmute" }).click();
    await panelOf(a).getByRole("button", { name: "Pause" }).click();
    const dark = await within(3_000, async () => (await localTracks("video")).every((on) => !on));
    step("Pause stops the one camera track every connection sends", dark !== null);
    await panelOf(a).getByRole("button", { name: "Resume" }).click();

    const seesAna = (rgb) =>
      within(15_000, async () => {
        const [toBen, toCleo] = [await colourOf(b, ana.fullName), await colourOf(c, ana.fullName)];
        return looksLike(toBen, rgb) && looksLike(toCleo, rgb);
      });
    step("Ben and Cleo both see Ana's first camera", (await seesAna(RED)) !== null);
    await openVideoMenu(a);
    await videoItem(a, "Camera").click();
    const cameras = a.getByRole("menuitemradio");
    await cameras.first().waitFor({ timeout: 5_000 });
    await a.locator('[role="menuitemradio"][aria-checked="false"]').first().click();
    step("a camera chosen during the call reaches both of them", (await seesAna(BLUE)) !== null);
    step(
      "the call goes on",
      (await stateOf(a)) === "connected" &&
        (await stateOf(b)) === "connected" &&
        (await stateOf(c)) === "connected",
    );

    const floats = await a.evaluate(() => document.pictureInPictureEnabled);
    await openVideoMenu(a);
    if (floats) {
      await videoItem(a, "Enter Picture in Picture").click();
      const floated = await within(8_000, () =>
        a.evaluate(() => {
          const first = document.querySelector("video[data-remote]");
          return first !== null && document.pictureInPictureElement === first;
        }),
      );
      step("Picture in Picture floats the first person's picture", floated !== null);
      await openVideoMenu(a);
      await videoItem(a, "Exit Picture in Picture").click();
      await within(8_000, () => a.evaluate(() => document.pictureInPictureElement === null));
    } else {
      await a.keyboard.press("Escape");
    }
    console.log(`picture in picture offered: ${floats}`);

    // ── Ben hangs up: Ana and Cleo go on ──
    await panelOf(b).getByRole("button", { name: "End" }).click();
    const goneBen = await within(
      20_000,
      async () =>
        (await stateOf(b)) === "idle" &&
        (await showsLive(a, [cleo])) &&
        (await showsLive(c, [ana])),
    );
    step("Ben is out, and Ana and Cleo stay connected with one picture each", goneBen !== null);
    step(
      "Ana's window is still connected",
      (await stateOf(a)) === "connected" && (await stateOf(c)) === "connected",
      `${await stateOf(a)} / ${await stateOf(c)}`,
    );
    const benLine = (await calls(b)).recents[0];
    step(
      "Ben's line is finished with the call still going on",
      benLine?.done === true && benLine.with.name === ana.name && benLine.with_more === 1,
      JSON.stringify(benLine),
    );
    await shot(a, "facetime-group-two-left");

    // ── Ana hangs up: the call ends for Cleo ──
    await panelOf(a).getByRole("button", { name: "End" }).click();
    const over = await within(
      20_000,
      async () => (await stateOf(a)) === "idle" && (await stateOf(c)) === "idle",
    );
    step("Ana hanging up ends the call for Cleo", over !== null);

    // ── The recent calls ──
    const lines = await within(10_000, async () => {
      const [mine, theirs] = await Promise.all([calls(a), calls(c)]);
      return (
        mine.recents[0]?.done === true &&
        mine.recents[0].with.name === ben.name &&
        mine.recents[0].with_more === 1 &&
        mine.recents[0].status === "outgoing" &&
        theirs.recents[0]?.done === true &&
        theirs.recents[0].with.name === ana.name &&
        theirs.recents[0].with_more === 1 &&
        theirs.recents[0].status === "incoming"
      );
    });
    step("the server's recent calls name the call for Ana and Cleo", lines !== null);
    const rowName = `${ben.fullName} and 1 other`;
    const list = (page) => windowOf(page).getByRole("tree", { name: "Recent calls" });
    const listed = await within(10_000, async () => (await list(a).innerText()).includes(rowName));
    step("Ana's row reads who it was with and how many others", listed !== null);
    await a.reload({ waitUntil: "load" });
    await a
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 30_000 });
    if (!(await windowOf(a).isVisible())) await openFromDock(a, "FaceTime");
    const kept = await within(15_000, async () => (await list(a).innerText()).includes(rowName));
    step("after a reload the row is there", kept !== null);
    await shot(a, "facetime-group-recents");

    // ── A second call: one connection cannot be made, and a fourth person declines ──
    allow(/\/signal\b/);
    allow(/status of 413/);
    await c.route(/\/api\/facetime\/calls\/[^/]+\/signal(\?|$)/, (route) => {
      const body = route.request().postDataJSON();
      return body.to === 1
        ? route.fulfill({ status: 413, contentType: "application/json", body: '{"error":"no"}' })
        : route.continue();
    });
    const d = await person("dee", dee);
    await openFromDock(d, "FaceTime");
    await windowOf(a).getByRole("textbox", { name: "Recipient" }).fill(ben.name);
    await windowOf(a).getByRole("button", { name: "Video", exact: true }).click();
    await within(15_000, () => incomingOf(b).isVisible());
    await incomingOf(b).getByRole("button", { name: "Accept" }).click();
    step(
      "Ana and Ben connect again",
      (await within(30_000, () => showsLive(a, [ben]))) !== null &&
        (await within(15_000, () => showsLive(b, [ana]))) !== null,
    );
    const addByPanel = async (who) => {
      await panelOf(a).getByRole("button", { name: "Add Person" }).click();
      await panelOf(a).getByRole("textbox", { name: "Person to add" }).fill(who.name);
      await panelOf(a).getByRole("button", { name: "Add", exact: true }).click();
      await within(10_000, async () =>
        (await panelOf(a).innerText()).includes(`${who.fullName} · Ringing…`),
      );
    };
    await addByPanel(cleo);
    await within(15_000, () => incomingOf(c).isVisible());
    await incomingOf(c).getByRole("button", { name: "Accept" }).click();
    const unreached = await within(25_000, async () =>
      (await windowOf(c).locator('[aria-label="Notice"]').innerText()).includes(
        `Could not connect to ${ana.fullName}`,
      ),
    );
    step("Cleo's window names Ana as the person it could not reach", unreached !== null);
    step(
      "and says the call goes on, on lines that fit the window",
      (await windowOf(c).locator('[aria-label="Notice"]').innerText()).includes(
        "The call goes on with the others.",
      ) &&
        (await windowOf(c)
          .locator('[aria-label="Notice"]')
          .evaluate((panel) => {
            const pane = panel.closest(".mac-facetime-camera").getBoundingClientRect();
            const box = panel.getBoundingClientRect();
            const line = panel.querySelector(".mac-facetime-hud-line");
            return (
              box.right <= pane.right &&
              box.left >= pane.left &&
              line.scrollWidth <= line.clientWidth
            );
          })),
    );
    step(
      "and the call goes on for Cleo with Ben",
      (await within(30_000, () => showsLive(c, [ben]))) !== null &&
        (await stateOf(c)) === "connected",
    );
    step(
      "and Ben still sees Ana beside Cleo",
      (await within(30_000, () => showsLive(b, [ana, cleo]))) !== null,
    );
    await shot(c, "facetime-group-unreached");

    await addByPanel(dee);
    const addButton = panelOf(a).getByRole("button", { name: "Add Person" });
    step(
      "with four in the call Add Person is dimmed and says why",
      (await addButton.isDisabled()) &&
        (await addButton.getAttribute("title")) === "A call holds at most 4 people.",
    );
    await within(15_000, () => incomingOf(d).isVisible());
    await incomingOf(d).getByRole("button", { name: "Decline" }).click();
    step(
      "Dee declining ends nothing, and gives the room back",
      (await within(10_000, () => addButton.isEnabled())) !== null &&
        (await stateOf(a)) === "connected" &&
        (await stateOf(b)) === "connected",
    );
    const missed = await within(10_000, async () => {
      const line = (await calls(d)).recents[0];
      return line?.done === true && line.status === "missed" && line.with.name === ana.name;
    });
    step("Dee's line says it was missed, and is finished", missed !== null);

    for (const page of [a, b, c]) {
      await panelOf(page).getByRole("button", { name: "End" }).click();
    }
    const ended = await within(
      20_000,
      async () =>
        (await stateOf(a)) === "idle" &&
        (await stateOf(b)) === "idle" &&
        (await stateOf(c)) === "idle",
    );
    step("everyone hanging up ends the call", ended !== null);
  },
);

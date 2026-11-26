#!/usr/bin/env node
// FaceTime's Video > Camera, Microphone and Output on Ferrite, in a real browser against the running
// app, with Chromium's fake devices (two cameras): each submenu lists the browser's devices with the
// one in use chosen; choosing a camera changes the window's own picture, is kept with the person's
// settings and comes back after a reload; a camera chosen during a call goes on the call without
// ending it. Exits 0 only when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error.
//
//   node e2e/facetime-devices-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("facetime-devices");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `fdchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `fdmartin-${id}`, fullName: `Martin ${id}`, password };

const windowOf = (page) => page.getByRole("region", { name: "FaceTime" }).first();
const stateOf = (page) => windowOf(page).getAttribute("data-call-state");
const kept = async (page) => {
  const reply = await page.request.get(
    new URL("/api/system-preferences/settings", page.url()).href,
  );
  return (await reply.json()).values?.["facetime.devices"] ?? {};
};
const selfCamera = (page) =>
  page.evaluate(
    () => document.querySelector("video[data-self]")?.srcObject?.getVideoTracks()[0]?.label ?? null,
  );
async function openSubmenu(page, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Video", exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name, exact: true }).click();
  const items = page.getByRole("menuitemradio");
  await items.first().waitFor({ timeout: 5_000 });
  return items;
}
const chooseOther = async (page, name) => {
  const items = await openSubmenu(page, name);
  const count = await items.count();
  let at = 0;
  for (let index = 0; index < count; index++) {
    if ((await items.nth(index).getAttribute("aria-checked")) !== "true") at = index;
  }
  const label = (await items.nth(at).innerText()).trim();
  await items.nth(at).click();
  return { count, label };
};

/**
 * Each of Chromium's fake cameras draws its own colour on a canvas in place of its own drawing, so that
 * the other person's picture says which is on the call: the second's own drawing could not be told
 * from no picture at all. The tracks keep the device's name. The rest of each device is real.
 */
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
      painted.addEventListener("ended", () => device.stop());
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
    const a = await person("chris", chris);
    const b = await person("martin", martin);
    await colourCameras(a);
    await colourCameras(b);
    for (const page of [a, b]) {
      await openFromDock(page, "FaceTime");
      await within(15_000, () =>
        page.evaluate(() => document.querySelector("video[data-self]")?.videoWidth > 0),
      );
    }
    const first = await selfCamera(a);
    const items = await openSubmenu(a, "Camera");
    step("Video > Camera lists the browser's cameras", (await items.count()) === 2);
    step(
      "the camera in use is chosen",
      (await a.locator('[role="menuitemradio"][aria-checked="true"]').count()) === 1,
    );
    await shot(a, "facetime-camera-menu");
    await a.keyboard.press("Escape");
    await a.keyboard.press("Escape");

    await chooseOther(a, "Camera");
    const changed = await within(10_000, async () => {
      const now = await selfCamera(a);
      return now !== null && now !== first;
    });
    step("choosing a camera changes the window's picture", changed !== null);
    const chosen = await selfCamera(a);
    step(
      "the choice is on the server",
      (await within(10_000, async () => (await kept(a)).camera === chosen)) !== null,
    );

    const microphone = await chooseOther(a, "Microphone");
    step("Video > Microphone lists the browser's microphones", microphone.count > 1);
    step(
      "the microphone chosen is the one on the server",
      (await within(10_000, async () => (await kept(a)).microphone === microphone.label)) !== null,
    );
    const output = await chooseOther(a, "Output");
    step("Video > Output lists the browser's outputs", output.count > 1);
    step(
      "the output chosen is the one on the server",
      (await within(10_000, async () => (await kept(a)).output === output.label)) !== null,
    );

    await a.reload({ waitUntil: "load" });
    await openFromDock(a, "FaceTime").catch(() => {});
    const back = await within(15_000, async () => (await selfCamera(a)) === chosen);
    step("after a reload the chosen camera is the one in use", back !== null);

    await windowOf(a).getByRole("textbox", { name: "Recipient" }).fill(martin.name);
    await windowOf(a).getByRole("button", { name: "Video", exact: true }).click();
    const incoming = windowOf(b).locator('[aria-label="Incoming call"]');
    await within(10_000, () => incoming.isVisible());
    await incoming.getByRole("button", { name: "Accept" }).click();
    const connected = await within(
      30_000,
      async () => (await stateOf(a)) === "connected" && (await stateOf(b)) === "connected",
    );
    step("a call connects with the chosen devices", connected !== null);
    const remoteColor = () =>
      b.evaluate(() => {
        const video = document.querySelector("video[data-remote]");
        if (!video?.videoWidth) return null;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        context.drawImage(video, 0, 0);
        return [...context.getImageData(4, 4, 1, 1).data.slice(0, 3)];
      });
    const seen = await within(15_000, async () => looksLike(await remoteColor(), BLUE));
    step("the other person sees the chosen camera's picture", seen !== null);
    await chooseOther(a, "Camera");
    const moved = await within(10_000, async () => (await selfCamera(a)) === first);
    step("a camera can be changed during the call", moved !== null);
    const arrived = await within(15_000, async () => looksLike(await remoteColor(), RED));
    step("the other person's picture changes to the new camera", arrived !== null);
    step(
      "the call goes on",
      (await stateOf(a)) === "connected" && (await stateOf(b)) === "connected",
    );
    await windowOf(a).locator('[aria-label="Call"]').getByRole("button", { name: "End" }).click();
    await within(
      15_000,
      async () => (await stateOf(a)) === "idle" && (await stateOf(b)) === "idle",
    );
  },
);

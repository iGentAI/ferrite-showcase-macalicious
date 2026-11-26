#!/usr/bin/env node
// FaceTime on Ferrite, two people: Chris and Martin each make an account at the login window,
// in browsers of their own (Playwright's fake camera and microphone in each engine), and open
// FaceTime. Chris calls Martin by his account name with Video; it rings in Martin's FaceTime
// with Accept and Decline; Martin accepts, and each browser shows the other's live picture,
// carried peer to peer over WebRTC (the server only signals). Martin then opens FaceTime in a
// second tab, which offers the call he is in; he takes it up there, the first tab lets it go,
// and Chris sees Martin's picture again. Chris hangs up, and the call is in both people's
// recent calls. Then Chris calls again with Audio and Martin declines: the call
// is a missed call, in red, in Martin's list. Exits 0 only when every step passed and no page
// logged a console error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/facetime-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                 [--browser chromium|chrome|firefox|webkit]
//
// Accounts are made fresh for each run, so the journey can run again on the same deployment.

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

/** A colour as an `[r, g, b]` triple, near enough to another to be the same camera. */
const looksLike = (color, rgb) =>
  !!color && color.every((value, index) => Math.abs(value - rgb[index]) < 60);

const { step, run, shot } = twoPeople("facetime");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `ftchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `ftmartin-${id}`, fullName: `Martin ${id}`, password };

const windowOf = (page) => page.getByRole("region", { name: "FaceTime" }).first();
const stateOf = (page) => windowOf(page).getAttribute("data-call-state");

/**
 * Give `page` a camera of its own colour: its FaceTime gets a canvas painted `rgb`, with a small
 * square moving across it so the picture keeps changing, in place of the engine's fake camera
 * (which looks the same in both browsers). The microphone stays the engine's fake one.
 */
async function paintCamera(page, rgb) {
  const paint = (rgb) => {
    // On the interface: WebKit may hand out a fresh object for `navigator.mediaDevices`.
    const real = MediaDevices.prototype.getUserMedia;
    const painted = async function (constraints) {
      const tracks = [];
      if (constraints?.video) {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 240;
        const context = canvas.getContext("2d");
        const draw = () => {
          context.fillStyle = `rgb(${rgb.join(",")})`;
          context.fillRect(0, 0, 320, 240);
          context.fillStyle = "#fff";
          context.fillRect((Date.now() / 20) % 300, 200, 20, 20);
        };
        draw();
        setInterval(draw, 50);
        tracks.push(...canvas.captureStream(20).getVideoTracks());
      }
      if (constraints?.audio) {
        tracks.push(...(await real.call(this, { audio: true })).getAudioTracks());
      }
      return new MediaStream(tracks);
    };
    Object.defineProperty(MediaDevices.prototype, "getUserMedia", {
      value: painted,
      configurable: true,
      writable: true,
    });
  };
  // For every document the page loads from now on (a reload, or the desktop loading itself again once
  // the account is made), and for the one it holds, unless it has yet to load one.
  await page.addInitScript(paint, rgb);
  if (page.url() !== "about:blank") await page.evaluate(paint, rgb);
}
const RED = [220, 40, 40];
const BLUE = [40, 80, 220];

/** The remote pictures a page shows: each one's size, its colour and whether it is playing. */
async function remotePictures(page) {
  const sample = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("video[data-remote]")].map((video) => {
        // The colour near the picture's top left corner, clear of the moving square.
        let color = null;
        if (video.videoWidth > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const context = canvas.getContext("2d");
          context.drawImage(video, 0, 0);
          const x = Math.floor(video.videoWidth / 8);
          const y = Math.floor(video.videoHeight / 8);
          color = [...context.getImageData(x, y, 1, 1).data.slice(0, 3)];
        }
        return {
          name: video.getAttribute("data-remote"),
          width: video.videoWidth,
          height: video.videoHeight,
          time: video.currentTime,
          color,
        };
      }),
    );
  const first = await sample();
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const second = await sample();
  return second.map((each, index) => ({
    ...each,
    advancing: each.time > (first[index]?.time ?? 0),
  }));
}

await run(
  // Fake camera and microphone in each engine. The two people are two browser contexts on one
  // machine, so they connect by their host addresses; the switches below keep the browsers from
  // hiding those behind mDNS names, which a sandbox without multicast cannot resolve, and let
  // Firefox use a link-local address (the test sandbox has no other). Real callers on different
  // networks reach each other through STUN instead.
  {
    chromium: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--disable-features=WebRtcHideLocalIpsWithMdns",
      ],
    },
    firefox: {
      firefoxUserPrefs: {
        "media.navigator.streams.fake": true,
        "media.navigator.permission.disabled": true,
        "media.peerconnection.ice.obfuscate_host_addresses": false,
        "media.peerconnection.ice.link_local": true,
      },
    },
  },
  { webkit: { permissions: ["camera", "microphone"] } },
  async ({ person, base }) => {
    const a = await person("chris", chris);
    const b = await person("martin", martin);
    step("Chris and Martin each have a desktop of their own", true);
    // Chris's camera shows red and Martin's blue, so each remote picture can be told apart.
    await paintCamera(a, RED);
    await paintCamera(b, BLUE);
    for (const [label, page] of [
      ["Chris", a],
      ["Martin", b],
    ]) {
      await openFromDock(page, "FaceTime");
      const camera = await within(15_000, async () =>
        page.evaluate(() => {
          const video = document.querySelector("video[data-self]");
          return !!video && video.videoWidth > 0;
        }),
      );
      step(`${label}'s FaceTime shows their own camera`, camera !== null, `${camera} ms`);
    }

    // ── Chris calls Martin with Video ──
    const field = windowOf(a).getByRole("textbox", { name: "Recipient" });
    await field.fill(martin.name);
    await windowOf(a).getByRole("button", { name: "Video", exact: true }).click();
    const calling = await within(10_000, async () => (await stateOf(a)) === "calling");
    step("Chris's FaceTime is calling", calling !== null);
    const incoming = windowOf(b).locator('[aria-label="Incoming call"]');
    const rang = await within(10_000, () => incoming.isVisible());
    step("the call rings in Martin's FaceTime", rang !== null, `${rang} ms`);
    step(
      "the ringing panel names Chris",
      (await incoming.innerText().catch(() => "")).includes(chris.fullName),
    );
    await shot(b, "facetime-ringing");

    await incoming.getByRole("button", { name: "Accept" }).click();
    const connected = await within(
      30_000,
      async () => (await stateOf(a)) === "connected" && (await stateOf(b)) === "connected",
    );
    step("the call connects in both browsers", connected !== null, `${connected} ms`);
    // Each sees the other's own camera: Chris's remote picture is Martin's blue, and Martin's is
    // Chris's red. The label alone is not trusted.
    for (const [label, page, other, rgb] of [
      ["Chris", a, martin, BLUE],
      ["Martin", b, chris, RED],
    ]) {
      const seen = await within(15_000, async () => {
        const pictures = await remotePictures(page);
        return (
          pictures.length === 1 &&
          pictures[0].width > 0 &&
          pictures[0].advancing &&
          looksLike(pictures[0].color, rgb)
        );
      });
      const pictures = await remotePictures(page);
      step(
        `${label} sees ${other.fullName}'s live picture, from ${other.fullName}'s camera`,
        seen !== null && pictures[0]?.name === other.fullName,
        JSON.stringify(pictures),
      );
    }
    await shot(a, "facetime-call-chris");
    await shot(b, "facetime-call-martin");

    // ── Martin takes the call up in a second tab ──
    const b2 = await b.context().newPage();
    // Before the page loads: the desktop brings back the FaceTime window Martin has open, and that
    // window asks for the camera as it opens, whatever the journey does afterwards.
    await paintCamera(b2, BLUE);
    await b2.goto(`${base}/`, { waitUntil: "load" });
    await b2
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 30_000 });
    await openFromDock(b2, "FaceTime");
    const offered = windowOf(b2).locator('[aria-label="Incoming call"]');
    const offer = await within(15_000, async () =>
      (await offered.innerText()).includes("In a call in another window"),
    );
    step("Martin's second tab offers the call he is in", offer !== null);
    step("the second tab took nothing up by itself", (await stateOf(b2)) === "idle");
    await offered.getByRole("button", { name: "Join Here" }).click();
    const moved = await within(
      30_000,
      async () =>
        (await stateOf(b2)) === "connected" &&
        (await stateOf(b)) === "idle" &&
        (await stateOf(a)) === "connected",
    );
    step(
      "the call moves to Martin's second tab, and his first tab lets it go",
      moved !== null,
      `${await stateOf(a)} / ${await stateOf(b)} / ${await stateOf(b2)}`,
    );
    const again = await within(20_000, async () => {
      const pictures = await remotePictures(a);
      return pictures.length === 1 && pictures[0].advancing && looksLike(pictures[0].color, BLUE);
    });
    step("Chris sees Martin's picture again, from the second tab", again !== null);
    await shot(b2, "facetime-second-tab-martin");

    // ── Chris hangs up ──
    step(
      "the call is still under way before hanging up",
      (await stateOf(a)) === "connected",
      `${await stateOf(a)} / ${await stateOf(b)}`,
    );
    await windowOf(a).locator('[aria-label="Call"]').getByRole("button", { name: "End" }).click();
    const over = await within(
      15_000,
      async () => (await stateOf(a)) === "idle" && (await stateOf(b2)) === "idle",
    );
    step("hanging up ends the call in both browsers", over !== null);
    await b2.close();
    for (const [label, page, other] of [
      ["Chris", a, martin],
      ["Martin", b, chris],
    ]) {
      const listed = await within(10_000, async () =>
        (await windowOf(page).getByRole("tree", { name: "Recent calls" }).innerText()).includes(
          other.fullName,
        ),
      );
      step(`the call is in ${label}'s recent calls`, listed !== null);
    }

    // ── Chris calls with Audio; Martin declines: a missed call ──
    await field.fill(martin.name);
    await windowOf(a).getByRole("button", { name: "Audio", exact: true }).click();
    const rangAgain = await within(10_000, () => incoming.isVisible());
    step("an audio call rings in Martin's FaceTime", rangAgain !== null);
    await incoming.getByRole("button", { name: "Decline" }).click();
    const ended = await within(10_000, async () => (await stateOf(a)) === "idle");
    step("declining ends the call for Chris", ended !== null);
    const missed = await within(
      10_000,
      async () => (await windowOf(b).locator(".mac-facetime-call-name[data-missed]").count()) > 0,
    );
    step("the declined call is a missed call in Martin's list", missed !== null);
    await shot(b, "facetime-recents-martin");
  },
);

// R5 map rows, shared by Maps and Find My (both draw the same tile map with the same map controls): Zoom in and
// Zoom out, the wheel, a pan with the mouse, Face north, the 3D button, the OpenStreetMap attribution link and
// Show Your Current Location. Real input only; each row reads the map's own state back (its `data-zoom`, the
// tiles it draws and where it draws them).

/** The rows for the map of the window `win()`; `id` prefixes the census ids, `meta` builds a row's metadata. */
export async function mapRows(c, page, win, id, meta) {
  const map = () => win().getByRole("application").first();
  const zoom = async () => Number(await map().getAttribute("data-zoom"));
  const tiles = () =>
    map()
      .locator("[data-tile]")
      .evaluateAll((all) =>
        all.map((t) => {
          const b = t.getBoundingClientRect();
          return { key: t.getAttribute("data-tile"), x: b.x, y: b.y };
        }),
      );
  const settle = () => page.waitForTimeout(600);
  /** Where a drag starts: off the map's middle, where a searched place's pin stands, and off its corners' controls. */
  const grip = (b) => ({ x: b.x + b.width * 0.35, y: b.y + b.height * 0.35 });

  await c.check(
    `${id}.map.zoom-in`,
    async () => {
      const before = await zoom();
      await win().getByRole("button", { name: "Zoom in" }).click();
      await settle();
      const after = await zoom();
      return {
        ok: after === before + 1,
        detail: `zoom ${before} -> ${after}; "${await map().getAttribute("aria-label")}"`,
      };
    },
    meta("window", "button", "Zoom in", "click Zoom in", "the map zooms in one level"),
  );
  await c.check(
    `${id}.map.zoom-out`,
    async () => {
      const before = await zoom();
      await win().getByRole("button", { name: "Zoom out" }).click();
      await settle();
      const after = await zoom();
      return { ok: after === before - 1, detail: `zoom ${before} -> ${after}` };
    },
    meta("window", "button", "Zoom out", "click Zoom out", "the map zooms out one level"),
  );
  await c.check(
    `${id}.map.wheel`,
    async () => {
      const b = await map().boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      const before = await zoom();
      await page.mouse.wheel(0, -500);
      await settle();
      const inward = await zoom();
      await page.mouse.wheel(0, 500);
      await settle();
      const outward = await zoom();
      return {
        ok: inward > before && outward < inward,
        detail: `zoom ${before} -> ${inward} -> ${outward}`,
      };
    },
    meta(
      "window",
      "application",
      "/Map, zoom \\d+.*/",
      "turn the mouse wheel over the map, in then out",
      "the map zooms in, then out",
    ),
  );
  await c.check(
    `${id}.map.pan`,
    async () => {
      const b = await map().boundingBox();
      const before = await tiles();
      const from = grip(b);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 120, from.y + 80, { steps: 10 });
      await page.mouse.up();
      await settle();
      const after = await tiles();
      const moved = before
        .map((t) => ({ t, a: after.find((x) => x.key === t.key) }))
        .filter(({ a }) => a)
        .map(({ t, a }) => [a.x - t.x, a.y - t.y]);
      const ok =
        moved.length > 0 &&
        moved.every(([dx, dy]) => Math.abs(dx - 120) <= 12 && Math.abs(dy - 80) <= 12);
      return {
        ok,
        detail: `${moved.length} tiles followed; first moved ${moved[0]?.map((n) => Math.round(n)).join(",")}`,
      };
    },
    meta(
      "window",
      "drag",
      "map",
      "drag the map 120,80 with the mouse",
      "the map follows the pointer",
    ),
  );
  await c.check(
    `${id}.map.face-north`,
    async () => {
      // This map has no rotate gesture: it always faces north, and Face north keeps it so. The
      // compass's pitch control lies over the ring's centre: click the ring itself, at its top.
      const ring = win().getByRole("button", { name: "Face north" });
      const box = await ring.boundingBox();
      await ring.click({ position: { x: (box?.width ?? 20) / 2, y: 3 } });
      await settle();
      const turned = await map().evaluate((e) =>
        [...e.querySelectorAll("*")].some((x) => /rotate\((?!0)/.test(x.style.transform || "")),
      );
      return { ok: !turned, detail: `the map faces north; turned ${turned}` };
    },
    meta("window", "button", "Face north", "click Face north", "the map faces north"),
  );
  await c.unavailable(
    `${id}.map.3d`,
    win().getByRole("button", { name: "3D", exact: true }),
    /3D|elevation|not offered|isn’t|can’t|needs/i,
    null,
    meta(
      "window",
      "button",
      "3D",
      "look at the 3D button in the compass",
      "unavailable: dimmed, saying why",
    ),
  );
  await c.check(
    `${id}.map.attribution`,
    async () => {
      const link = win().getByRole("link", { name: "© OpenStreetMap contributors" });
      const href = await link.getAttribute("href");
      const opened = page
        .context()
        .waitForEvent("page", { timeout: 10_000 })
        .catch(() => null);
      await link.click();
      const tab = await opened;
      const url = tab ? tab.url() : "";
      await tab?.close().catch(() => {});
      return {
        ok: href === "https://www.openstreetmap.org/copyright" && Boolean(tab),
        detail: `href ${href}; a new browser tab ${url || "(none)"}`,
      };
    },
    meta(
      "window",
      "link",
      "© OpenStreetMap contributors",
      "click the map's attribution",
      "OpenStreetMap's copyright page opens in a new browser tab",
    ),
  );
  await c.check(
    `${id}.map.current-location`,
    async () => {
      // Away from wherever the map is first: two drags of 300 px, then the button must bring it somewhere else
      // again (the browser's location, granted to the context).
      const b = await map().boundingBox();
      const from = grip(b);
      for (let i = 0; i < 2; i += 1) {
        await page.mouse.move(from.x + 200, from.y + 130);
        await page.mouse.down();
        await page.mouse.move(from.x - 100, from.y - 70, { steps: 10 });
        await page.mouse.up();
      }
      await page.waitForTimeout(600);
      const away = (await tiles())
        .map((t) => `${t.key}@${Math.round(t.x)},${Math.round(t.y)}`)
        .sort()
        .join(" ");
      await win().getByRole("button", { name: "Show Your Current Location" }).first().click();
      await page.waitForTimeout(1_500);
      const back = (await tiles())
        .map((t) => `${t.key}@${Math.round(t.x)},${Math.round(t.y)}`)
        .sort()
        .join(" ");
      return {
        ok: away !== back,
        detail: `panned away, then the map moved to the browser's location: ${away !== back}`,
      };
    },
    meta(
      "window",
      "button",
      "Show Your Current Location",
      "click Show Your Current Location (geolocation granted)",
      "the map centres on the browser's location",
    ),
  );
}

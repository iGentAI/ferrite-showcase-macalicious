// Shared steps of the B16 system-app journeys (Spotlight, Storage Management):
// a file put into the signed-in person's drive through the drive's own routes,
// from inside the page, in pieces as the desktop sends them.

/**
 * Uploads a file of `size` bytes (the text `text` repeated, or zeros) as `name` into `parent`
 * (a drive folder id such as "documents"), and answers its file id. `bytes`, a Buffer, gives a
 * binary file's content instead of `text`.
 */
export function uploadFile(
  page,
  {
    parent,
    name,
    type,
    text = "",
    bytes: given,
    size = given?.length ?? new TextEncoder().encode(text).length,
  },
) {
  return page.evaluate(
    async ({ parent, name, type, text, size, base64 }) => {
      const json = { "content-type": "application/json" };
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ parent, name, size, type }),
      });
      if (started.status !== 201) throw new Error(`upload refused: HTTP ${started.status}`);
      const { upload, piece_bytes: pieceBytes, pieces } = await started.json();
      const bytes = new Uint8Array(size);
      const encoded = base64
        ? Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
        : new TextEncoder().encode(text);
      for (let i = 0; i < size && encoded.length > 0; i += 1)
        bytes[i] = encoded[i % encoded.length];
      for (let n = 0; n < pieces; n += 1) {
        const piece = bytes.slice(n * pieceBytes, Math.min(size, (n + 1) * pieceBytes));
        const put = await fetch(`/api/files/uploads/${upload}/${n}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: piece,
        });
        if (put.status !== 200) throw new Error(`piece ${n} refused: HTTP ${put.status}`);
      }
      const done = await fetch(`/api/files/uploads/${upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      });
      if (done.status !== 200) throw new Error(`completion refused: HTTP ${done.status}`);
      return (await done.json()).created[0];
    },
    { parent, name, type, text, size, base64: given?.toString("base64") },
  );
}

/** Applies drive operations (`POST /api/files/ops`) from inside the page. */
export function driveOps(page, ops) {
  return page.evaluate(async (ops) => {
    const response = await fetch("/api/files/ops", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ops }),
    });
    return response.status;
  }, ops);
}

/** Opens an app by typing its name into Spotlight and pressing Return. */
export async function openWithSpotlight(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await page.getByRole("option", { name, exact: true }).first().waitFor({ timeout: 10_000 });
  await field.press("Enter");
}

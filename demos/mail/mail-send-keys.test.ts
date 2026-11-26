import { describe, expect, it } from "vitest";
import { forgetSendKey, sendKeyFor } from "./mail-send-keys";

const MESSAGE = { to: ["martin"], cc: [], subject: "Once", text: "only once", attachments: [] };

// jsdom has no IndexedDB; mail-send-keys.browser.test.ts holds the keys in a real browser.
describe("a message's send key, where the browser cannot store it", () => {
  it("sends with the fresh key alone, and forgetting it does no harm", async () => {
    expect(await sendKeyFor("chris", MESSAGE, "first")).toBe("first");
    expect(await sendKeyFor("chris", MESSAGE, "second")).toBe("second");
    await expect(forgetSendKey("chris", MESSAGE)).resolves.toBeUndefined();
  });
});

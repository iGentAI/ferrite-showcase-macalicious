import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("opens no channel on import, so that Node can exit after rendering the docs", async () => {
  const opened: string[] = [];
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      constructor(name: string) {
        opened.push(name);
      }
    },
  );
  vi.resetModules();
  const { onOutboxChange } = await import("./mail-outbox");
  expect(opened).toEqual([]);
  const stop = onOutboxChange(() => {});
  expect(opened).toEqual(["macalicious.mail.outbox"]);
  stop();
});

import { act, render } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { type DesktopEffect, onDesktopEffects } from "../desktop/desktop-effects";
import { askToReach, takeAddressRequests } from "../desktop/desktop-reach";
import { shareLink, takeSharedLinks } from "../desktop/desktop-share-link";
import { useMainWindowOpens } from "./messages-separate";

function Host({ main, separate }: { main: boolean; separate: boolean }) {
  useMainWindowOpens(main, separate);
  return null;
}

const asked: DesktopEffect[] = [];
const stop = onDesktopEffects((effects) => asked.push(...effects));
const settle = () => act(() => new Promise<void>((done) => setTimeout(done, 5)));
const newWindows = () => asked.filter((effect) => "newWindow" in effect);

afterAll(stop);
afterEach(() => {
  asked.length = 0;
  takeAddressRequests("messages");
  takeSharedLinks("messages");
});

describe("a separate Messages window", () => {
  it("asks for a main window when Contacts or a share reaches Messages and none is open", async () => {
    const separate = render(<Host main={false} separate />);
    askToReach({ app: "messages", to: "martin", name: "Martin" });
    await settle();
    expect(newWindows()).toEqual([{ newWindow: "messages", opening: undefined }]);
    // What was asked for waits for that window to take it.
    expect(takeAddressRequests("messages").map(({ to }) => to)).toEqual(["martin"]);
    // A second request while it is opening asks for no second window.
    shareLink("messages", "https://example.com/", "A page", "safari");
    await settle();
    expect(newWindows()).toHaveLength(1);

    const main = render(<Host main separate={false} />);
    expect(takeSharedLinks("messages").map(({ url }) => url)).toEqual(["https://example.com/"]);
    asked.length = 0;
    shareLink("messages", "https://example.com/two", "Another", "safari");
    await settle();
    expect(newWindows()).toEqual([]);
    main.unmount();
    separate.unmount();
  });

  it("asks for nothing when another application opens", async () => {
    const separate = render(<Host main={false} separate />);
    askToReach({ app: "facetime", to: "martin", name: "Martin" });
    await settle();
    expect(newWindows()).toEqual([]);
    takeAddressRequests("facetime");
    separate.unmount();
  });
});

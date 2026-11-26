import { afterEach, describe, expect, it, vi } from "vitest";
import { onOpenItemRequest, openItem, takeOpenItemRequests } from "./desktop-open-item";

const ADA = { app: "contacts", id: "card-ada", title: "Ada Lovelace" };

describe("opening a person's thing in its application", () => {
  afterEach(() => {
    takeOpenItemRequests("contacts");
    takeOpenItemRequests("notes");
  });

  it("keeps it for a window that has not opened, and gives it once", () => {
    openItem(ADA);
    expect(takeOpenItemRequests("notes")).toEqual([]);
    expect(takeOpenItemRequests("contacts")).toEqual([ADA]);
    expect(takeOpenItemRequests("contacts")).toEqual([]);
  });

  it("tells an open window, which keeps nothing waiting", () => {
    const heard = vi.fn();
    const other = vi.fn();
    const stop = onOpenItemRequest("contacts", heard);
    const stopOther = onOpenItemRequest("notes", other);
    openItem(ADA);
    stop();
    stopOther();
    expect(heard).toHaveBeenCalledWith(ADA);
    expect(other).not.toHaveBeenCalled();
    expect(takeOpenItemRequests("contacts")).toEqual([]);
  });

  it("keeps the newest twenty for a window that never opens", () => {
    for (let n = 0; n < 25; n += 1) openItem({ ...ADA, id: String(n) });
    const kept = takeOpenItemRequests("contacts");
    expect(kept).toHaveLength(20);
    expect(kept[0]?.id).toBe("5");
  });
});

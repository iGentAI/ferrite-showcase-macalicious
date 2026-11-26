import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLaunchpadRemoval } from "./app-store-launchpad";

// In a file of its own: the page reads the catalogue once, so this test's catalogue must be the
// first any test of the file serves.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("deleting an app from Launchpad", () => {
  it("deletes only an app got from the store, and says so when the server does not keep it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const catalogue = [
      { id: "books", name: "Books", category: "media", summary: "", preinstalled: false },
      { id: "notes", name: "Notes", category: "productivity", summary: "", preinstalled: true },
    ];
    const server = { installed: ["books"] as string[], rev: 2, down: true };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/apps") return { ok: true, json: async () => ({ apps: [], catalogue }) };
        if (init?.method === "PUT") {
          if (server.down) return { ok: false, status: 503, json: async () => ({ error: "down" }) };
          server.installed = (JSON.parse(String(init.body)) as { installed: string[] }).installed;
          server.rev += 1;
          return { ok: true, json: async () => ({ ...server }) };
        }
        return { ok: true, json: async () => ({ ...server }) };
      }),
    );
    function Launchpad() {
      const removal = useLaunchpadRemoval(true);
      return (
        <>
          <p>
            books {String(removal.removable("books"))}, notes {String(removal.removable("notes"))}
          </p>
          <button type="button" onClick={() => removal.ask({ id: "books", name: "Books" })}>
            Ask
          </button>
          {removal.alert}
        </>
      );
    }
    const user = userEvent.setup();
    render(<Launchpad />);
    expect(await screen.findByText("books true, notes false")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("Delete “Books”?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      await screen.findByText("“Books” is not deleted on the server yet."),
    ).toBeInTheDocument();
    expect(server.installed).toEqual(["books"]);
    await user.click(screen.getByRole("button", { name: "OK" }));

    server.down = false;
    await user.click(screen.getByRole("button", { name: "Ask" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(server.installed).toEqual([]));
    expect(await screen.findByText("books false, notes false")).toBeInTheDocument();
    expect(screen.queryByText("“Books” is not deleted on the server yet.")).toBeNull();
  });
});

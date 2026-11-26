import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetDesktopValues } from "../desktop/desktop-personal";
import { reloadServerDocuments } from "../desktop/desktop-server";
import { AppStore } from "./app-store";

afterEach(() => {
  forgetDesktopValues();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const BOOKS = {
  id: "books",
  name: "Books",
  category: "media",
  summary: "A library of books to read",
  preinstalled: false,
};
const CALCULATOR = {
  id: "calculator",
  name: "Calculator",
  category: "productivity",
  summary: "Sums",
  preinstalled: true,
};

/** The desktop's Ferrite application, answering `/api/apps` with `apps` and the library with
 * `installed` (`null` before anything was got). */
function serve(apps: unknown, installed: string[] | null = null) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      return { ok: true, json: async () => ({ ...JSON.parse(String(init.body)), rev: 1 }) };
    }
    if (url === "/api/apps") return { ok: true, json: async () => apps };
    return { ok: true, json: async () => ({ installed, rev: installed ? 3 : 0 }) };
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("the App Store on the desktop's Ferrite application", () => {
  it("sells nothing when the catalogue cannot be read, rather than its invented apps", async () => {
    serve({ apps: [] });
    render(<AppStore />);
    expect(await screen.findByText("The App Store Is Not Available")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Get, / })).toBeNull();
  });

  it("sells the catalogue's apps and keeps a finished Get in the session's library", async () => {
    const fetch = serve({ apps: [], catalogue: [BOOKS, CALCULATOR] });
    const user = userEvent.setup();
    render(<AppStore />);
    expect(await screen.findByRole("button", { name: "Open, Calculator" })).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector(".mac-app-store-page")).not.toHaveAttribute("inert"),
    );
    await user.click(screen.getByRole("button", { name: "Get, Books" }));
    await user.click(screen.getByRole("button", { name: "Install, Books" }));
    await waitFor(
      () => {
        const saves = fetch.mock.calls.filter(([, init]) => init?.method === "PUT");
        expect(saves.map(([url, init]) => [url, JSON.parse(String(init?.body)).installed])).toEqual(
          [["/api/app-store/library", ["books"]]],
        );
      },
      { timeout: 4000 },
    );
    expect(screen.getByRole("button", { name: "Open, Books" })).toBeInTheDocument();
  });

  it("installs an app only once the library holds it, and offers Retry when the save fails", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    // The server keeps the library, and refuses every save while `down`.
    const server = { installed: null as string[] | null, rev: 0, down: true };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/apps") {
          return { ok: true, json: async () => ({ apps: [], catalogue: [BOOKS, CALCULATOR] }) };
        }
        if (init?.method === "PUT") {
          if (server.down) return { ok: false, status: 503, json: async () => ({ error: "down" }) };
          server.installed = (JSON.parse(String(init.body)) as { installed: string[] }).installed;
          server.rev += 1;
          return { ok: true, json: async () => ({ installed: server.installed, rev: server.rev }) };
        }
        return { ok: true, json: async () => ({ installed: server.installed, rev: server.rev }) };
      }),
    );
    const user = userEvent.setup();
    render(<AppStore />);
    expect(await screen.findByRole("button", { name: "Open, Calculator" })).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector(".mac-app-store-page")).not.toHaveAttribute("inert"),
    );
    await user.click(screen.getByRole("button", { name: "Get, Books" }));
    await user.click(screen.getByRole("button", { name: "Install, Books" }));
    // The download ends; the save fails: no Open, no announcement that it is installed.
    const retry = await screen.findByRole(
      "button",
      { name: "Retry installing Books" },
      { timeout: 6000 },
    );
    expect(screen.queryByRole("button", { name: "Open, Books" })).toBeNull();
    expect(screen.getByText("Not Saved")).toBeInTheDocument();
    const status = document.querySelector(".mac-app-store-hidden");
    await waitFor(() => expect(status).toHaveTextContent("Books could not be saved to your apps"));
    expect(status).not.toHaveTextContent("Books is installed");
    expect(server.installed).toBeNull();

    // The server is back: Retry saves it, and only then is Books installed.
    server.down = false;
    await user.click(retry);
    expect(await screen.findByRole("button", { name: "Open, Books" })).toBeInTheDocument();
    expect(server.installed).toEqual(["books"]);
    await waitFor(() => expect(status).toHaveTextContent("Books is installed"));
  });

  it("counts an app as installed once the library holds it, whatever this window's save did", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const server = { installed: null as string[] | null, rev: 0 };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/apps") {
          return { ok: true, json: async () => ({ apps: [], catalogue: [BOOKS, CALCULATOR] }) };
        }
        if (init?.method === "PUT") {
          if (server.installed === null) {
            return { ok: false, status: 503, json: async () => ({ error: "down" }) };
          }
          server.rev += 1;
          return { ok: true, json: async () => ({ installed: server.installed, rev: server.rev }) };
        }
        return { ok: true, json: async () => ({ installed: server.installed, rev: server.rev }) };
      }),
    );
    const user = userEvent.setup();
    render(<AppStore />);
    expect(await screen.findByRole("button", { name: "Open, Calculator" })).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector(".mac-app-store-page")).not.toHaveAttribute("inert"),
    );
    await user.click(screen.getByRole("button", { name: "Get, Books" }));
    await user.click(screen.getByRole("button", { name: "Install, Books" }));
    await screen.findByRole("button", { name: "Retry installing Books" }, { timeout: 6000 });
    // Another browser installs it, and the server answers again: the library holds it now.
    server.installed = ["books"];
    // Well past any revision this page's one library channel saw in the tests before.
    server.rev = 1000;
    act(() => reloadServerDocuments("app-store"));
    expect(
      await screen.findByRole("button", { name: "Open, Books" }, { timeout: 6000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry installing Books" })).toBeNull();
  });

  it("uninstalls a got app from the person's library, and after a reload offers it again", async () => {
    // The server keeps the library: a save replaces it, a load reads what was saved.
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const library = { installed: ["books"] as string[] | null, rev: 3 };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/apps") {
          return { ok: true, json: async () => ({ apps: [], catalogue: [BOOKS, CALCULATOR] }) };
        }
        if (init?.method === "PUT") {
          library.installed = (JSON.parse(String(init.body)) as { installed: string[] }).installed;
          library.rev += 1;
          return { ok: true, json: async () => ({ ...library }) };
        }
        return { ok: true, json: async () => ({ ...library }) };
      }),
    );
    const user = userEvent.setup();
    const ready = async () => {
      expect(await screen.findByRole("button", { name: "Open, Calculator" })).toBeInTheDocument();
      await waitFor(() =>
        expect(document.querySelector(".mac-app-store-page")).not.toHaveAttribute("inert"),
      );
    };
    const first = render(<AppStore />);
    await ready();
    expect(screen.getByRole("button", { name: "Open, Books" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    await user.click(await screen.findByRole("button", { name: "Uninstall Books" }));
    await waitFor(() => expect(library.installed).toEqual([]));
    first.unmount();

    // A new window reads the library from the server: Books is not among the purchases and the
    // store offers it with Get.
    render(<AppStore />);
    await ready();
    expect(await screen.findByRole("button", { name: "Get, Books" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open, Books" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    await screen.findByRole("button", { name: "Sign Out" });
    expect(screen.queryByRole("button", { name: "Uninstall Books" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open, Books" })).toBeNull();
    expect(library.installed).toEqual([]);
  });

  it("says so when the server does not keep an Uninstall, and sends it again later", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const server = { installed: ["books"] as string[], rev: 3, down: true };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/apps") {
          return { ok: true, json: async () => ({ apps: [], catalogue: [BOOKS, CALCULATOR] }) };
        }
        if (init?.method === "PUT") {
          if (server.down) return { ok: false, status: 503, json: async () => ({ error: "down" }) };
          server.installed = (JSON.parse(String(init.body)) as { installed: string[] }).installed;
          server.rev += 1;
          return { ok: true, json: async () => ({ ...server }) };
        }
        return { ok: true, json: async () => ({ ...server }) };
      }),
    );
    const user = userEvent.setup();
    const view = render(<AppStore />);
    expect(await screen.findByRole("button", { name: "Open, Books" })).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector(".mac-app-store-page")).not.toHaveAttribute("inert"),
    );
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    await user.click(await screen.findByRole("button", { name: "Uninstall Books" }));
    // Said on the account page, and to assistive technology.
    expect(await screen.findAllByText(/Books is not uninstalled on the server yet/)).toHaveLength(
      2,
    );
    await waitFor(() =>
      expect(document.querySelector(".mac-app-store-hidden")).toHaveTextContent(
        "Books is not uninstalled on the server yet",
      ),
    );
    expect(server.installed).toEqual(["books"]);
    view.unmount();

    // The server is back: the library's next read sends the change again.
    server.down = false;
    render(<AppStore />);
    expect(await screen.findByRole("button", { name: "Get, Books" })).toBeInTheDocument();
    await waitFor(() => expect(server.installed).toEqual([]));
  });
});

describe("a category of the served catalogue", () => {
  it("lists exactly its own apps, even when another app's line names the category", async () => {
    // The page reads the catalogue once (desktop-library's memoised request): this catalogue is read
    // by a fresh copy of the modules, so it neither meets nor leaves the one the tests above read.
    vi.resetModules();
    const { AppStore: FreshAppStore } = await import("./app-store");
    // Jotter's line mentions "Productivity": a text search for the category's name would list it too.
    const JOTTER = {
      id: "jotter",
      name: "Jotter",
      category: "media",
      summary: "Productivity notes in a pocket",
      preinstalled: false,
    };
    serve({ apps: [], catalogue: [CALCULATOR, JOTTER] });
    const user = userEvent.setup();
    render(<FreshAppStore defaultSection="categories" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Productivity/ })).toHaveTextContent(/1 apps?$/),
    );
    await waitFor(() =>
      expect(document.querySelector(".mac-app-store-page")).not.toHaveAttribute("inert"),
    );
    await user.click(screen.getByRole("button", { name: /^Productivity/ }));
    expect(screen.getByRole("heading", { name: "Results for “Productivity”" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "1 App" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open, Calculator" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Jotter/ })).toBeNull();
  });
});

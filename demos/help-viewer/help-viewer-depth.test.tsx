import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalinaDesktop } from "../desktop/desktop";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import type { DesktopApp } from "../desktop/desktop-apps";
import { onDesktopEffects } from "../desktop/desktop-effects";
import { requestHelp } from "../desktop/desktop-help";
import { takePaneRequest } from "../system-preferences/pane-request";
import { helpViewerApp } from "./app";
import { helpLink } from "./help-menu-search";
import { HelpViewer, type HelpViewerProps } from "./help-viewer";
import { actionsOf, guideNamed, searchGuides } from "./help-viewer-guides";
import { readFeedback, withAnswer } from "./help-viewer-page-parts";

let stopHearing = () => {};
afterEach(() => {
  stopHearing();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function serve() {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT")
        return { ok: true, json: async () => JSON.parse(String(init.body)) };
      if (url === "/api/help-viewer/books") return { ok: true, json: async () => ({ books: [] }) };
      if (url.startsWith("/api/help-viewer/search")) {
        const query = new URLSearchParams(url.split("?")[1]).get("q");
        return { ok: true, json: async () => ({ query, results: [] }) };
      }
      return { ok: true, json: async () => ({ page: null, rev: 0 }) };
    }),
  );
}

async function openServed(props: HelpViewerProps = {}) {
  serve();
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(673);
  render(<HelpViewer state="key" {...props} />);
  await waitFor(() =>
    expect(document.querySelector(".mac-help-viewer-body")).not.toHaveAttribute("aria-busy"),
  );
}

const page = () => screen.getByRole("heading", { level: 1 }).textContent;
const effects = () => {
  const heard: unknown[] = [];
  stopHearing = onDesktopEffects((list) => heard.push(...list));
  return heard;
};

function MenuOf({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("help-viewer", title);
  return (
    <Menu>
      <MenuTrigger>Open {title}</MenuTrigger>
      <MenuPopup aria-label={title}>{items}</MenuPopup>
    </Menu>
  );
}

describe("Help Viewer's guides", () => {
  it("opens an application's guide from its Help row, where the application has one", async () => {
    await openServed();
    requestHelp("Calculator");
    await waitFor(() => expect(page()).toBe("Calculator Help"));
    expect(screen.getByRole("region", { name: "Calculator Help" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See your calculations on the tape" })).toBeVisible();
  });

  it("searches for an application without a guide", async () => {
    await openServed();
    requestHelp("Force Quit Applications");
    await waitFor(() => expect(page()).toBe("All Help"));
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue(
      "Force Quit Applications",
    );
  });

  it("finds a guide's topics in a search, only when served", async () => {
    expect(searchGuides("paper tape").map((topic) => topic.title)).toEqual([
      "See your calculations on the tape",
    ]);
    await openServed({ defaultQuery: "paper tape" });
    expect(screen.getByRole("link", { name: /^See your calculations on the tape/ })).toBeVisible();
  });

  it("says which guides name which application and pane", () => {
    expect(guideNamed("Notes")?.title).toBe("Notes Help");
    expect(guideNamed("Force Quit Applications")).toBeUndefined();
    expect(actionsOf("guide:safari:2")).toEqual([
      { label: "Open Safari", app: "safari" },
      { label: "Open Extensions preferences", pane: "extensions" },
    ]);
    expect(actionsOf("use-the-dock")).toEqual([{ label: "Open Dock preferences", pane: "dock" }]);
    expect(actionsOf("get-to-know-the-desktop")).toEqual([]);
  });
});

describe("links that act", () => {
  it("opens the guide's application and a pane of System Preferences", async () => {
    const heard = effects();
    await openServed({ opening: { page: "guide:safari:2" } });
    fireEvent.click(screen.getByRole("button", { name: "Open Safari" }));
    expect(heard).toContainEqual({ open: "safari" });
    fireEvent.click(screen.getByRole("button", { name: "Open Extensions preferences" }));
    expect(heard).toContainEqual({ open: "system-preferences" });
    expect(takePaneRequest()).toBe("extensions");
  });

  it("shows no such links off the desktop", () => {
    render(<HelpViewer state="key" opening={{ page: "use-the-dock" }} />);
    expect(page()).toBe("Use the Dock");
    expect(screen.queryByRole("button", { name: "Open Dock preferences" })).toBeNull();
  });
});

describe("another window", () => {
  it("opens on the page it was asked for and has a history of its own", async () => {
    await openServed({ opening: { page: "use-the-dock" } });
    expect(page()).toBe("Use the Dock");
    expect(screen.getByRole("button", { name: "Back" })).toHaveAttribute("aria-disabled", "true");
  });

  it("opens a link's page from the page's menu, and copies its address", async () => {
    const heard = effects();
    const write = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: write },
    });
    await openServed({ opening: { page: "basics" } });
    const link = screen.getByRole("link", { name: "Use the Dock" });
    fireEvent.contextMenu(link);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Open in New Window" }));
    expect(heard).toContainEqual({ newWindow: "help-viewer", opening: { page: "use-the-dock" } });
    fireEvent.contextMenu(link);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Copy Link" }));
    await waitFor(() =>
      expect(write).toHaveBeenCalledWith(
        `${location.origin}${location.pathname}#help=use-the-dock`,
      ),
    );
  });

  it("has no link rows on the page's text", async () => {
    await openServed({ opening: { page: "use-the-dock" } });
    fireEvent.contextMenu(screen.getByRole("heading", { level: 1 }));
    await screen.findByRole("menu", { name: "Page commands" });
    expect(screen.queryByRole("menuitem", { name: "Copy Link" })).toBeNull();
  });
});

describe("sharing a page", () => {
  it("shares the page's address with an app, and dims AirDrop with its reason", async () => {
    const heard = effects();
    await openServed({ opening: { page: "use-the-dock" } });
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await user.click(screen.getByRole("button", { name: "Share" }));
    const airDrop = await screen.findByRole("menuitem", { name: /AirDrop/ });
    expect(airDrop).toHaveAttribute("aria-disabled", "true");
    expect(airDrop).toHaveAttribute(
      "title",
      "AirDrop sends to nearby devices, which a web page can’t reach.",
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Notes/ }));
    expect(heard).toContainEqual({ open: "notes" });
  });

  it("has no address to share off the desktop", async () => {
    render(<HelpViewer state="key" />);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await user.click(screen.getByRole("button", { name: "Share" }));
    const reason = await screen.findByRole("menuitem", {
      name: "There is no web address to share.",
    });
    expect(reason).toHaveAttribute("aria-disabled", "true");
  });

  it("opens Help Viewer on the page a link names, and leaves the address clean", async () => {
    expect(helpLink("guide:notes:1")).toBe(
      `${location.origin}${location.pathname}#help=guide%3Anotes%3A1`,
    );
    location.hash = "#help=use-the-dock";
    render(<CatalinaDesktop apps={[helpViewerApp as unknown as DesktopApp]} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Use the Dock" })).toBeVisible();
    expect(location.hash).toBe("");
  });

  it("carries the page's address when a link is dragged", async () => {
    await openServed({ opening: { page: "basics" } });
    const carried = new Map<string, string>();
    fireEvent.dragStart(screen.getByRole("link", { name: "Use the Dock" }), {
      dataTransfer: { setData: (type: string, value: string) => carried.set(type, value) },
    });
    const address = `${location.origin}${location.pathname}#help=use-the-dock`;
    expect(carried.get("text/uri-list")).toBe(address);
    expect(carried.get("text/plain")).toBe(address);
    expect(carried.get("text/html")).toBe(`<a href="${address}">Use the Dock</a>`);
  });
});

describe("the File and View menus' rows", () => {
  it("dims Page Setup and New Tab with the reason", async () => {
    render(
      <>
        <HelpViewer state="key" />
        <MenuOf title="File" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open File" }));
    const setup = await screen.findByRole("menuitem", { name: /^Page Setup/ });
    expect(setup).toHaveAttribute("aria-disabled", "true");
    expect(setup).toHaveAttribute("title", "The browser's print dialog sets the page.");
    expect(screen.getByRole("menuitem", { name: /^New Tab/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("hides and shows the toolbar", async () => {
    render(
      <>
        <HelpViewer state="key" />
        <MenuOf title="View" />
      </>,
    );
    const toolbar = () => screen.queryByRole("toolbar", { name: "Help Viewer toolbar" });
    fireEvent.click(screen.getByRole("button", { name: "Open View" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Hide Toolbar" }));
    expect(toolbar()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open View" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Show Toolbar" }));
    expect(toolbar()).not.toBeNull();
  });

  it("customizes which items the toolbar shows", async () => {
    render(
      <>
        <HelpViewer state="key" />
        <MenuOf title="View" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open View" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Customize Toolbar…" }));
    const search = await screen.findByRole("checkbox", { name: "Search" });
    expect(screen.getAllByRole("checkbox").map((box) => box.textContent)).toEqual([
      "Back and Forward",
      "Table of Contents",
      "Share",
      "Book",
      "Search",
    ]);
    fireEvent.click(search);
    expect(screen.queryByRole("searchbox", { name: "Search" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Search" })).toBeNull());
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });
});

describe("was this page helpful?", () => {
  it("takes an answer on a topic and says where it stays", () => {
    render(<HelpViewer state="key" opening={{ page: "use-the-dock" }} />);
    const feedback = screen.getByRole("complementary", { name: "Feedback" });
    expect(within(feedback).getByText("Was this page helpful?")).toBeVisible();
    fireEvent.click(within(feedback).getByRole("button", { name: "Yes" }));
    expect(within(feedback).getByRole("status").textContent).toBe(
      "Thanks. Your answer is kept with your desktop and is not sent anywhere.",
    );
  });

  it("is not asked on a section's page", () => {
    render(<HelpViewer state="key" opening={{ page: "basics" }} />);
    expect(screen.queryByRole("complementary", { name: "Feedback" })).toBeNull();
  });

  it("keeps answers within one desktop value, dropping the oldest", () => {
    expect(readFeedback({ a: "yes", b: "maybe" })).toEqual({ a: "yes" });
    expect(readFeedback("yes")).toBeUndefined();
    let answers = withAnswer({}, "first", "no");
    for (let at = 0; at < 400; at += 1)
      answers = withAnswer(answers, `page-${at}-of-the-guide`, "yes");
    expect(answers.first).toBeUndefined();
    expect(answers["page-399-of-the-guide"]).toBe("yes");
    expect(new TextEncoder().encode(JSON.stringify(answers)).length).toBeLessThanOrEqual(4000);
  });
});

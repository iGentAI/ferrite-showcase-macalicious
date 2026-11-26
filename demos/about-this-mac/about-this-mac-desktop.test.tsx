import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aboutProps,
  browserName,
  DesktopAboutThisMac,
  deploymentText,
  factsFromServer,
} from "./about-this-mac-desktop";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const REPLY = {
  application: "macalicious-desktop",
  generation: 0,
  instance: null,
  build: "sha256:0123456789abcdef0123",
  site_files: 120,
  modules: 41,
  now_ms: 1_760_000_000_000,
  session_created_ms: 1_759_999_000_000,
  storage: {
    bytes: 2048,
    keys: 3,
    apps: [
      { name: "calculator", title: "Calculator", bytes: 2048, keys: 3, truncated: false },
      { name: "notes", title: "Notes", bytes: 0, keys: 0, truncated: false },
    ],
  },
};

const details = () =>
  within(screen.getByRole("tabpanel"))
    .getAllByRole("listitem")
    .map((item) => item.textContent);

describe("About This Mac on the desktop's Ferrite application", () => {
  it("reads only facts in the module's shape", () => {
    expect(factsFromServer(REPLY)).toMatchObject({ generation: 0, siteFiles: 120, modules: 41 });
    expect(factsFromServer({ ...REPLY, generation: -1 })).toBeUndefined();
    expect(
      factsFromServer({ ...REPLY, storage: { bytes: 1, keys: 1, apps: [{}] } }),
    ).toBeUndefined();
    expect(factsFromServer("facts")).toBeUndefined();
  });

  it("names the browser and the deployment in words", () => {
    expect(
      browserName(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36",
      ),
    ).toBe("Chrome 141");
    expect(
      browserName("Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0"),
    ).toBe("Firefox 144");
    expect(
      browserName(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15",
      ),
    ).toBe("Safari 26");
    expect(deploymentText(0)).toBe("Not deployed (local ferrite dev)");
    expect(deploymentText(1204)).toBe("Generation 1,204");
  });

  it("shows the application's facts and says it cannot read the hardware", () => {
    const props = aboutProps(factsFromServer(REPLY), false, {
      userAgent: "Firefox/144.0",
      processors: 8,
      width: 1440,
      height: 900,
      scale: 2,
    });
    expect(props.details?.map(([label]) => label)).toEqual([
      "Deployment",
      "Instance",
      "App Modules",
      "Session Data",
      "Browser",
      "Processors",
      "Hardware",
    ]);
    expect(props.versionDetails).toHaveLength(2);
    expect(props.info?.version).toBe("build 0123456789ab");
    // Only modules that keep something for the session are a storage category.
    expect(props.volume?.categories.map((category) => category.name)).toEqual(["Calculator"]);
    expect(props.volume?.capacity).toBe(0);
    expect(props.displays?.[0]?.size).toBe("1440 × 900 points at 2×");
    expect(aboutProps(undefined, true, { userAgent: "x" }).storageSummary).toBe("Not available");
  });

  it("shows the person's drive against its quota as the volume, when the server reports it", () => {
    const drive = {
      quota: 134_217_728,
      used: 3_006,
      available: 134_214_722,
      categories: [
        { id: "documents", name: "Documents", bytes: 6, files: 1 },
        { id: "photos", name: "Photos", bytes: 3_000, files: 1 },
        { id: "music", name: "Music", bytes: 0, files: 0 },
      ],
    };
    const props = aboutProps(factsFromServer({ ...REPLY, drive }), false, { userAgent: "x" });
    expect(props.volume?.name).toBe("Ferrite Drive");
    expect(props.volume?.capacity).toBe(134_217_728);
    expect(props.volume?.available).toBe(134_214_722);
    expect(props.volume?.categories.map((kind) => [kind.name, kind.size])).toEqual([
      ["Documents", 6],
      ["Photos", 3_000],
    ]);
    expect(props.storageSummary).toMatch(/available of .*; the apps keep .* more for you/);
    // A drive in another shape is left out, and the data store is shown as before.
    const odd = factsFromServer({ ...REPLY, drive: { quota: "a lot" } });
    expect(odd?.drive).toBeUndefined();
    expect(aboutProps(odd, false, { userAgent: "x" }).volume?.name).toBe("Ferrite Data Store");
  });

  it("marks session data as a floor when the server stopped counting a module", () => {
    const apps = REPLY.storage.apps.map((app, index) => ({ ...app, truncated: index === 0 }));
    const facts = factsFromServer({ ...REPLY, storage: { ...REPLY.storage, apps } });
    expect(facts?.storage.truncated).toBe(true);
    const props = aboutProps(facts, false, { userAgent: "x" });
    expect(props.details?.find(([label]) => label === "Session Data")?.[1]).toMatch(/^At least /);
    expect(props.storageSummary).toMatch(/^At least .* in at least 3 keys/);
    expect(factsFromServer(REPLY)?.storage.truncated).toBe(false);
  });

  it("reads the module when served, and shows its facts in place of the Mac's", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async () => ({ ok: true, json: async () => REPLY }));
    vi.stubGlobal("fetch", fetch);
    render(<DesktopAboutThisMac />);
    expect(fetch).toHaveBeenCalledWith("/api/about-this-mac/facts", expect.anything());
    await waitFor(() => expect(details()).toContain("Deployment Not deployed (local ferrite dev)"));
    expect(
      details().some((line) => /^(Processor|Memory|Serial Number|Graphics) /.test(line ?? "")),
    ).toBe(false);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Macalicious");
  });

  it("shows the captured Mac when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<DesktopAboutThisMac />);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("macOS Catalina");
  });

  it("lists every screen the browser names once it may read them, and offers to ask until then", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(REPLY), { status: 200 })),
    );
    const getScreenDetails = vi.fn(async () => ({
      screens: [
        { label: "Studio Left", width: 2560, height: 1440, devicePixelRatio: 2 },
        { label: "", width: 1920, height: 1080, devicePixelRatio: 1 },
      ],
    }));
    vi.stubGlobal("getScreenDetails", getScreenDetails);
    render(<DesktopAboutThisMac />);
    fireEvent.click(screen.getByRole("tab", { name: "Displays" }));
    expect(getScreenDetails).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Show Every Screen…" }));
    expect(await screen.findByText("Studio Left")).toBeInTheDocument();
    expect(screen.getByText("2560 × 1440 points at 2×")).toBeInTheDocument();
    expect(screen.getByText("Screen 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show Every Screen…" })).toBeNull();
  });

  it("says a browser without the interface tells only of its own screen", () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(REPLY), { status: 200 })),
    );
    render(<DesktopAboutThisMac />);
    fireEvent.click(screen.getByRole("tab", { name: "Displays" }));
    expect(
      screen.getByText("This browser tells a page about its own screen only."),
    ).toBeInTheDocument();
  });
});

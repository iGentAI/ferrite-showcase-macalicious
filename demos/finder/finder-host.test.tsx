import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { Finder, type FinderProps } from "./finder";
import { createFileSystem, HOME } from "./finder-data";
import { CONNECT_REASON, FinderConnectionFailed, FinderConnectToServer } from "./finder-dialogs";
import { FINDER_INFO_HOST, FinderInfo } from "./finder-info";
import { useFinderWindowCount } from "./finder-windows";

/*
 * What the host knows is passed in by the Finder served by Ferrite (finder.tsx): with it, Get Info and Connect to
 * Server say why a control cannot be used; without it, as in the library's examples and the visual comparisons, both
 * windows are drawn as captured.
 */

const PDF = `${HOME}/Documents/Aqua and Bondi.pdf`;
const root = createFileSystem();
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const dimmed = (element: HTMLElement) =>
  element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
const CAPTURED_HELP = "Use this application to open all documents like this one.";
const CAPTURED_FAILURE =
  "The server may not exist or it is unavailable at this time. Check the server name or IP address, check your network connection, and then try again.";

describe("a Finder outside a desktop", () => {
  it("has nowhere to move a tab to, so the tab stays", async () => {
    render(
      <Finder
        defaultTabs={[HOME, `${HOME}/Documents`]}
        DesktopWindow={(() => null) as unknown as FinderProps["DesktopWindow"]}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    fireEvent.contextMenu(tabs[0] as HTMLElement);
    const row = await screen.findByRole("menuitem", { name: "Move Tab to New Window" });
    expect(row).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(row);
    expect(screen.getAllByRole("tab", { hidden: true })).toHaveLength(2);
  });

  it("stays out of Merge All Windows on the drive, unlike one a desktop hosts and can close", () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ entries: [] })));
    const Count = () => <span data-testid="finder-windows">{useFinderWindowCount()}</span>;
    render(
      <>
        <Count />
        <Finder />
        <Finder onClose={() => {}} />
      </>,
    );
    expect(screen.getByTestId("finder-windows")).toHaveTextContent("0");
    render(
      <DesktopWindowHostContext value={{} as never}>
        <Finder onClose={() => {}} />
      </DesktopWindowHostContext>,
    );
    expect(screen.getByTestId("finder-windows")).toHaveTextContent("1");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});

describe("Get Info and the host's facts", () => {
  it("on the drive, without a desktop window, renames and lists what opens the file", async () => {
    const user = userEvent.setup();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const made = 1_700_000_000_000;
    const folder = { kind: "folder", size: 0, version: 0, created_ms: made, modified_ms: made };
    let drive = {
      rev: 1,
      usage: 5,
      quota: 1_000_000,
      piece_bytes: 1000,
      max_file_bytes: 1000,
      max_entries: 100,
      entries: [
        { ...folder, id: "documents", name: "Documents" },
        {
          ...folder,
          id: "note",
          parent: "documents",
          kind: "file",
          name: "Note.txt",
          type: "text/plain",
          size: 5,
        },
      ] as { id: string; name: string }[],
    };
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (String(url).startsWith("/api/files/ops")) {
        const { ops } = JSON.parse(String(init?.body)) as {
          ops: { op: string; id: string; name: string }[];
        };
        for (const op of ops) {
          if (op.op !== "rename") continue;
          drive = {
            ...drive,
            rev: drive.rev + 1,
            entries: drive.entries.map((each) =>
              each.id === op.id ? { ...each, name: op.name } : each,
            ),
          };
        }
      }
      return String(url).startsWith("/api/files")
        ? new Response(JSON.stringify(drive), { status: 200 })
        : new Response("{}", { status: 200 });
    });
    render(<Finder />);
    await user.click(await screen.findByRole("treeitem", { name: "Documents" }));
    await user.click(await screen.findByRole("option", { name: "Note.txt" }));
    await user.click(button("Action"));
    await user.click(await screen.findByRole("menuitem", { name: "Get Info" }));
    expect(screen.getByRole("combobox", { name: "Open with" })).toHaveTextContent(
      "TextEdit (default)",
    );
    const name = await screen.findByRole("textbox", { name: "Name & Extension" });
    await user.clear(name);
    await user.type(name, "Renamed.txt{Enter}");
    await screen.findByRole("option", { name: "Renamed.txt" });
    expect(drive.entries.find((each) => each.id === "note")?.name).toBe("Renamed.txt");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("with them, the permissions each say why", () => {
    render(<FinderInfo root={root} path={PDF} host={FINDER_INFO_HOST} />);
    for (const control of [
      button("Add a group"),
      button("Remove the selected user or group"),
      button(/lock/),
    ]) {
      expect(control).toBeDisabled();
      expect(control).toHaveAttribute("title", FINDER_INFO_HOST.permissions);
    }
  });

  it("keeps a new name, comments and a chosen application through the host", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onCommentChange = vi.fn();
    const onChangeOpener = vi.fn();
    render(
      <FinderInfo
        root={root}
        path={PDF}
        onRename={onRename}
        onCommentChange={onCommentChange}
        openers={["Preview", "TextEdit"]}
        onChangeOpener={onChangeOpener}
      />,
    );
    const name = screen.getByRole("textbox", { name: "Name & Extension" });
    await user.clear(name);
    await user.type(name, "Renamed.pdf{Enter}");
    expect(onRename).toHaveBeenCalledWith(PDF, "Renamed.pdf");
    await user.click(button("Comments:"));
    await user.type(screen.getByRole("textbox", { name: "Comments" }), "Read it");
    await user.tab();
    expect(onCommentChange).toHaveBeenCalledWith(PDF, "Read it");
    expect(screen.getByRole("combobox", { name: "Open with" })).toHaveTextContent(
      "Preview (default)",
    );
  });

  it("without them, as captured: Open with can be changed, the lock unlocks the list, nothing says why", async () => {
    const user = userEvent.setup();
    render(<FinderInfo root={root} path={PDF} />);
    const application = screen.getByRole("combobox", { name: "Open with" });
    expect(dimmed(application)).toBe(false);
    expect(application).not.toHaveAttribute("title");
    expect(screen.getByText(CAPTURED_HELP)).toBeInTheDocument();
    // Change All waits for another application to be chosen, as in Finder.
    expect(button("Change All...")).toBeDisabled();
    expect(button("Change All...")).not.toHaveAttribute("title");
    expect(screen.getByRole("textbox", { name: "Name & Extension" })).not.toHaveAttribute("title");
    await user.click(button("Comments:"));
    for (const reason of Object.values(FINDER_INFO_HOST)) {
      expect(screen.queryByText(reason)).not.toBeInTheDocument();
    }
    const lock = button(/lock/);
    expect(lock).toBeEnabled();
    expect(lock).not.toHaveAttribute("title");
    expect(button("Add a group")).toBeDisabled();
    await user.click(lock);
    expect(button("Add a group")).toBeEnabled();
  });
});

describe("Connect to Server and the host's reason", () => {
  const dialog = {
    open: true,
    onOpenChange: () => {},
    servers: [],
    favorites: [],
    onFavoritesChange: () => {},
    onConnect: () => {},
    onBrowse: () => {},
  };

  it("with it, the dialog says what a web page cannot reach", () => {
    render(<FinderConnectToServer {...dialog} unreachableReason={CONNECT_REASON} />);
    expect(screen.getByRole("combobox", { name: "Server Address" })).toBeInTheDocument();
    expect(screen.getByText(CONNECT_REASON)).toBeInTheDocument();
  });

  it("without it, the dialog is drawn as captured", () => {
    render(<FinderConnectToServer {...dialog} />);
    expect(screen.getByRole("combobox", { name: "Server Address" })).toBeInTheDocument();
    expect(screen.queryByText(CONNECT_REASON)).not.toBeInTheDocument();
  });

  it("the failure alert gives the host's reason, or macOS's words without it", () => {
    const { rerender } = render(
      <FinderConnectionFailed
        address="smb://far.local"
        onClose={() => {}}
        reason={CONNECT_REASON}
      />,
    );
    expect(screen.getByText(CONNECT_REASON)).toBeInTheDocument();
    expect(screen.queryByText(CAPTURED_FAILURE)).not.toBeInTheDocument();
    rerender(<FinderConnectionFailed address="smb://far.local" onClose={() => {}} />);
    expect(screen.getByText(CAPTURED_FAILURE)).toBeInTheDocument();
    expect(screen.queryByText(CONNECT_REASON)).not.toBeInTheDocument();
  });
});

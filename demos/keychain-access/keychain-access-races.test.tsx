// Two windows of Keychain Access on one page, sharing the page's one channel to the stored
// keychain (`serverDocument`), as two windows of the desktop do. "Another window" is played by
// giving that channel a body, which is the path another window's save takes to this one.
//
// Each test fails without one of the two race fixes in `keychain-access-desktop.tsx`:
// - `store` checks again, after sealing, that no other window replaced the keychain
//   (`ensureCurrent`), so a window never saves over another window's newer keychain;
// - `lock` closes an Info or Add dialog, so a keychain another window replaces or forgets
//   takes the open item's password off the page.
// The last block plays another browser: the server refuses this window's save (409) with the
// keychain saved there first, and the window must say so and keep its version on offer.

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serverDocument } from "../desktop/desktop-server";
import { ServedKeychainAccess } from "./keychain-access-desktop";
import * as vaultModule from "./keychain-access-vault";
import {
  createVault,
  type OpenVault,
  unlockVault,
  type VaultEnvelope,
} from "./keychain-access-vault";

// `sealVault` can be held at its next call, to let another window save while this one seals.
let hold: Promise<void> | null = null;
vi.mock("./keychain-access-vault", async (original) => {
  const actual = await original<typeof import("./keychain-access-vault")>();
  return {
    ...actual,
    sealVault: vi.fn(async (vault: Parameters<typeof actual.sealVault>[0]) => {
      const sealed = await actual.sealVault(vault);
      const wait = hold;
      hold = null;
      if (wait) await wait;
      return sealed;
    }),
  };
});

const ITERATIONS = 100_000;
const URL = "/api/keychain-access/vault";
const PASSWORD = "correct horse";

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
});
afterEach(() => {
  hold = null;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function serve(envelope: VaultEnvelope) {
  let rev = 1;
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      rev += 1;
      const { vault } = JSON.parse(String(init.body)) as { vault: unknown };
      return { ok: true, status: 200, json: async () => ({ vault, rev }) };
    }
    return { ok: true, status: 200, json: async () => ({ vault: envelope, rev }) };
  });
  vi.stubGlobal("fetch", fetchMock);
}

/** The keychains every PUT sent, in order. */
const saved = () =>
  fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === "PUT")
    .map(
      ([, init]) => JSON.parse(String((init as RequestInit).body)).vault as VaultEnvelope | null,
    );

const item = (id: string, name: string, secret: string) => ({
  id,
  keychain: "login",
  name,
  kind: "application password" as const,
  secret,
});

/** Renders one window and unlocks it with the keychain's password. */
async function unlockedWindow() {
  const user = userEvent.setup();
  const view = render(<ServedKeychainAccess iterations={ITERATIONS} />);
  const region = () =>
    within(view.container).getByRole("region", { name: "Keychain Access", hidden: true });
  const ask = await screen.findByRole("dialog", { name: "Unlock the “login” Keychain" });
  await user.type(within(ask).getByLabelText("Password:"), PASSWORD);
  await user.click(within(ask).getByRole("button", { name: "Unlock" }));
  await waitFor(() => expect(region()).toHaveAttribute("data-keychain-state", "unlocked"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  return { user, region };
}

/** The item passwords the page shows: Info's field after Show Password. */
const shownSecrets = () =>
  [...document.querySelectorAll("input")]
    .map((input) => input.value)
    .filter((value) => value.includes("s3cret"));

/** Another window of the page saves `vault`: the page's channel tells this window. */
function anotherWindowSaves(vault: VaultEnvelope | null) {
  act(() => serverDocument(URL).save({ vault }));
}

describe("Keychain Access when the person locks it", () => {
  const padlock = (region: HTMLElement) =>
    within(region).getByRole("button", { name: /^Lock the/, hidden: true });

  it("closes Info, and only the password shows the item again", async () => {
    const { vault } = await createVault(PASSWORD, ITERATIONS);
    serve(await vaultModule.sealVault({ ...vault, items: [item("login-1", "Wi-Fi", "s3cret")] }));
    const { user, region } = await unlockedWindow();
    fireEvent.mouseDown(within(region()).getByRole("row", { name: /Wi-Fi/ }));
    await user.click(within(region()).getByRole("button", { name: "Info" }));
    const info = await screen.findByRole("dialog", { name: "Wi-Fi" });
    await user.click(within(info).getByRole("button", { name: "Show Password" }));
    expect(shownSecrets()).toEqual(["s3cret"]);

    fireEvent.click(padlock(region()));
    await waitFor(() => expect(region()).toHaveAttribute("data-keychain-state", "locked"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(shownSecrets()).toEqual([]);
    expect(within(region()).queryByText("Wi-Fi")).toBeNull();
  });

  it("stops a change under way: it saves nothing and leaves the window locked", async () => {
    const { vault } = await createVault(PASSWORD, ITERATIONS);
    serve(await vaultModule.sealVault({ ...vault, items: [] }));
    const { user, region } = await unlockedWindow();
    await user.click(within(region()).getByRole("button", { name: "New Keychain Item" }));
    const add = await screen.findByRole("dialog", { name: "New Password Item" });
    await user.type(within(add).getByLabelText("Keychain Item Name:"), "Mine");
    await user.type(within(add).getByLabelText("Password:"), "my-secret");
    let release = () => {};
    hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await user.click(within(add).getByRole("button", { name: "Add" }));

    fireEvent.click(padlock(region()));
    await waitFor(() => expect(region()).toHaveAttribute("data-keychain-state", "locked"));
    await act(async () => {
      release();
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(region()).toHaveAttribute("data-keychain-state", "locked");
    expect(saved()).toEqual([]);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Keychain Access with two windows on one page", () => {
  it("refuses a save sealed on a keychain another window replaced meanwhile", async () => {
    const { vault, envelope } = await createVault(PASSWORD, ITERATIONS);
    const first = item("login-1", "Wi-Fi", "first-secret");
    const start = await vaultModule.sealVault({ ...vault, items: [first] });
    // The other window's newer keychain: the same key, with an item this window has not seen.
    const theirs = item("login-2", "Their Item", "their-secret");
    const newer = await vaultModule.sealVault({ ...vault, items: [first, theirs] });
    expect(envelope.kdf.salt).toBe(newer.kdf.salt);
    serve(start);

    const { user, region } = await unlockedWindow();
    await user.click(within(region()).getByRole("button", { name: "New Keychain Item" }));
    const add = await screen.findByRole("dialog", { name: "New Password Item" });
    await user.type(within(add).getByLabelText("Keychain Item Name:"), "Mine");
    await user.type(within(add).getByLabelText("Password:"), "my-secret");

    // This window starts sealing its addition; the other window's save lands before it ends.
    let release = () => {};
    hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    fireEvent.click(within(add).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(hold).toBeNull());
    anotherWindowSaves(newer);
    await act(async () => release());

    expect(
      await within(add).findByText("Another window changed the keychain. Try again."),
    ).toBeInTheDocument();
    // Nothing this window sealed was saved over the other window's keychain: the newest save is
    // still theirs, holding their item and not this window's.
    await serverDocument(URL).idle();
    const last = saved().at(-1);
    expect(last).toEqual(newer);
    const stored = await unlockVault(last as VaultEnvelope, PASSWORD);
    expect(stored.items.map((entry) => entry.name)).toEqual(["Wi-Fi", "Their Item"]);
    for (const envelope of saved()) {
      const opened = await unlockVault(envelope as VaultEnvelope, PASSWORD);
      expect(opened.items.map((entry) => entry.name)).not.toContain("Mine");
    }
    // The window shows the other window's item.
    await waitFor(() => expect(region().textContent).toContain("Their Item"));
  });

  it("closes an open Info dialog when another window replaces the keychain", async () => {
    const { vault } = await createVault(PASSWORD, ITERATIONS);
    const start = await vaultModule.sealVault({
      ...vault,
      items: [item("login-1", "Wi-Fi", "s3cret-value")],
    });
    serve(start);

    const openInfo = async (
      user: ReturnType<typeof userEvent.setup>,
      region: () => HTMLElement,
    ) => {
      const row = within(region())
        .getAllByRole("row")
        .find((entry) => within(entry).queryAllByRole("gridcell")[0]?.textContent === "Wi-Fi");
      await user.click(row ?? document.body);
      await user.click(within(region()).getByRole("button", { name: "Info" }));
      const info = await screen.findByRole("dialog", { name: "Wi-Fi" });
      await user.click(within(info).getByRole("button", { name: "Show Password" }));
      expect(shownSecrets()).toEqual(["s3cret-value"]);
    };

    // Replaced: another window's keychain under a new password (a new salt) locks this one.
    const { user, region } = await unlockedWindow();
    await openInfo(user, region);
    const other: OpenVault = (await createVault("another password", ITERATIONS)).vault;
    anotherWindowSaves(await vaultModule.sealVault(other));
    await waitFor(() => expect(region()).toHaveAttribute("data-keychain-state", "locked"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Wi-Fi" })).toBeNull());
    expect(shownSecrets()).toEqual([]);
    expect(document.body.textContent).not.toContain("s3cret-value");
  });

  it("closes an open Info dialog when another window forgets the keychain", async () => {
    const { vault } = await createVault(PASSWORD, ITERATIONS);
    serve(
      await vaultModule.sealVault({ ...vault, items: [item("login-1", "Wi-Fi", "s3cret-value")] }),
    );

    const { user, region } = await unlockedWindow();
    const row = within(region())
      .getAllByRole("row")
      .find((entry) => within(entry).queryAllByRole("gridcell")[0]?.textContent === "Wi-Fi");
    await user.click(row ?? document.body);
    await user.click(within(region()).getByRole("button", { name: "Info" }));
    const info = await screen.findByRole("dialog", { name: "Wi-Fi" });
    await user.click(within(info).getByRole("button", { name: "Show Password" }));
    expect(shownSecrets()).toEqual(["s3cret-value"]);

    anotherWindowSaves(null);
    await waitFor(() => expect(region()).toHaveAttribute("data-keychain-state", "none"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Wi-Fi" })).toBeNull());
    expect(shownSecrets()).toEqual([]);
    expect(document.body.textContent).not.toContain("s3cret-value");
  });
});

describe("Keychain Access when another browser saved the keychain first", () => {
  /**
   * The server holds `start`; its first save is refused (409) with `newer`, saved by another
   * browser meanwhile, and later saves are stored.
   */
  function serveConflict(start: VaultEnvelope, newer: VaultEnvelope) {
    let rev = 1;
    let refused = false;
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        if (!refused) {
          refused = true;
          rev += 1;
          return { ok: false, status: 409, json: async () => ({ vault: newer, rev }) };
        }
        rev += 1;
        const { vault } = JSON.parse(String(init.body)) as { vault: unknown };
        return { ok: true, status: 200, json: async () => ({ vault, rev }) };
      }
      return { ok: true, status: 200, json: async () => ({ vault: start, rev }) };
    });
    vi.stubGlobal("fetch", fetchMock);
  }

  /** A keychain with Wi-Fi, and the other browser's: the same key, with an item of its own. */
  async function keychains() {
    const { vault } = await createVault(PASSWORD, ITERATIONS);
    const first = item("login-1", "Wi-Fi", "first-secret");
    const start = await vaultModule.sealVault({ ...vault, items: [first] });
    const newer = await vaultModule.sealVault({
      ...vault,
      items: [first, item("login-2", "Their Item", "their-secret")],
    });
    return { start, newer };
  }

  it("takes Keep My Version away when the person locks, and only says what was not saved", async () => {
    const { start, newer } = await keychains();
    serveConflict(start, newer);
    const { user, region } = await unlockedWindow();
    await addMine(user, region);
    await screen.findByRole("dialog", { name: "Your Keychain Change Was Not Saved" });

    fireEvent.click(within(region()).getByRole("button", { name: /^Lock the/, hidden: true }));
    await waitFor(() => expect(region()).toHaveAttribute("data-keychain-state", "locked"));
    const notice = await screen.findByRole("dialog", { name: "Keychain Access" });
    expect(notice).toHaveTextContent("so adding “Mine” was not saved");
    expect(screen.queryByRole("button", { name: "Keep My Version" })).toBeNull();
  });

  /** Adds the item "Mine" from the window's + button; its save meets the other browser's. */
  async function addMine(user: ReturnType<typeof userEvent.setup>, region: () => HTMLElement) {
    await user.click(within(region()).getByRole("button", { name: "New Keychain Item" }));
    const add = await screen.findByRole("dialog", { name: "New Password Item" });
    await user.type(within(add).getByLabelText("Keychain Item Name:"), "Mine");
    await user.type(within(add).getByLabelText("Password:"), "my-secret");
    await user.click(within(add).getByRole("button", { name: "Add" }));
  }

  const names = async (envelope: VaultEnvelope | null | undefined) =>
    (await unlockVault(envelope as VaultEnvelope, PASSWORD)).items.map((entry) => entry.name);

  it("says what was not saved, shows the saved keychain, and Keep My Version saves this window's", async () => {
    const { start, newer } = await keychains();
    serveConflict(start, newer);
    const { user, region } = await unlockedWindow();
    await addMine(user, region);

    const notice = await screen.findByRole("dialog", {
      name: "Your Keychain Change Was Not Saved",
    });
    expect(notice).toHaveTextContent("so adding “Mine” was not saved");
    // The window shows the keychain saved first, not this window's.
    await waitFor(() => expect(region().textContent).toContain("Their Item"));
    expect(region().textContent).not.toContain("Mine");
    expect(saved()).toHaveLength(1);

    await user.click(within(notice).getByRole("button", { name: "Keep My Version" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await serverDocument(URL).idle();
    // This window's version is saved over the other, and the window shows it.
    expect(saved()).toHaveLength(2);
    expect(await names(saved().at(-1))).toEqual(["Wi-Fi", "Mine"]);
    await waitFor(() => expect(region().textContent).toContain("Mine"));
    expect(region().textContent).not.toContain("Their Item");
  });

  it("keeps the keychain saved first with Use Saved Version, and saves nothing more", async () => {
    const { start, newer } = await keychains();
    serveConflict(start, newer);
    const { user, region } = await unlockedWindow();
    await addMine(user, region);

    const notice = await screen.findByRole("dialog", {
      name: "Your Keychain Change Was Not Saved",
    });
    await user.click(within(notice).getByRole("button", { name: "Use Saved Version" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await serverDocument(URL).idle();
    expect(saved()).toHaveLength(1);
    await waitFor(() => expect(region().textContent).toContain("Their Item"));
    expect(region().textContent).not.toContain("Mine");
  });

  it("says nothing when its change was stored", async () => {
    const { start } = await keychains();
    serve(start);
    const { user, region } = await unlockedWindow();
    await addMine(user, region);
    await waitFor(() => expect(region().textContent).toContain("Mine"));
    await serverDocument(URL).idle();
    expect(await names(saved().at(-1))).toEqual(["Wi-Fi", "Mine"]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

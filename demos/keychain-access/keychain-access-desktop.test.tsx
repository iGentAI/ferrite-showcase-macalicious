import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { keychainAccessApp } from "./app";
import {
  DesktopKeychainAccess,
  readLayout,
  readSettings,
  ServedKeychainAccess,
  statusLine,
} from "./keychain-access-desktop";
import {
  createVault,
  envelopeFromServer,
  envelopeOfFile,
  sealItems,
  sealVault,
  unlockVault,
  type VaultEnvelope,
  type VaultItem,
  VaultTooLargeError,
  vaultReadable,
  WrongPasswordError,
  withImported,
} from "./keychain-access-vault";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** The least the server takes, so that the tests derive keys quickly. */
const ITERATIONS = 100_000;
const URL = "/api/keychain-access/vault";

function serve(reply: unknown) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "PUT"
      ? { ok: true, json: async () => JSON.parse(String(init.body)) }
      : { ok: true, json: async () => reply },
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const saves = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([url, init]) => ({
      url,
      text: String(init?.body),
      body: JSON.parse(String(init?.body)),
    }));

const dialog = () => screen.findByRole("dialog");
// `hidden` reads the list behind an open modal dialog as well.
const items = () =>
  within(screen.getByRole("grid", { name: "Items", hidden: true }))
    .queryAllByRole("row", { hidden: true })
    .filter((row) => row.hasAttribute("aria-selected"))
    .map((row) => within(row).getAllByRole("gridcell", { hidden: true })[0]?.textContent);

describe("the keychain's encryption", () => {
  it("keeps only an envelope that the password opens and no other does", async () => {
    const { vault, envelope } = await createVault("correct horse", ITERATIONS);
    expect(envelope.kdf).toMatchObject({ name: "PBKDF2-SHA-256", iterations: ITERATIONS });
    expect(atob(envelope.kdf.salt)).toHaveLength(16);
    expect(atob(envelope.iv)).toHaveLength(12);

    const item = {
      id: "login-1",
      keychain: "login",
      name: "https://example.com",
      kind: "Internet password" as const,
      account: "jordan",
      secret: "hunter2-secret",
    };
    const sealed = await sealVault({ ...vault, items: [item] });
    const text = JSON.stringify(sealed);
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("example.com");
    expect(text).not.toContain("correct horse");
    expect(sealed.iv).not.toBe(envelope.iv);

    expect((await unlockVault(sealed, "correct horse")).items).toEqual([item]);
    await expect(unlockVault(sealed, "wrong horse")).rejects.toBeInstanceOf(WrongPasswordError);
    const tampered: VaultEnvelope = {
      ...sealed,
      ciphertext: `${sealed.ciphertext.slice(0, -8)}AAAAAAA=`,
    };
    await expect(unlockVault(tampered, "correct horse")).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it("refuses to seal a keychain larger than the server keeps", async () => {
    const { vault } = await createVault("correct horse", ITERATIONS);
    const items = Array.from({ length: 40 }, (_, n) => ({
      id: `login-${n}`,
      keychain: "login" as const,
      name: `item ${n}`,
      kind: "Internet password" as const,
      secret: "x".repeat(4_096),
    }));
    await expect(sealVault({ ...vault, items })).rejects.toBeInstanceOf(VaultTooLargeError);
    await expect(sealVault({ ...vault, items: items.slice(0, 2) })).resolves.toMatchObject({
      version: 1,
    });
  });

  it("reads only a reply in the module's shape", async () => {
    const { envelope } = await createVault("correct horse", ITERATIONS);
    expect(vaultReadable({ vault: null })).toBe(true);
    expect(vaultReadable({ vault: envelope })).toBe(true);
    expect(vaultReadable({ vault: { ...envelope, version: 2 } })).toBe(false);
    expect(vaultReadable({ vault: { ...envelope, iv: "not base64!" } })).toBe(false);
    expect(vaultReadable({ rev: 1 })).toBe(false);
    expect(envelopeFromServer({ vault: null })).toBeNull();
    expect(envelopeFromServer({ vault: envelope })).toEqual(envelope);
  });
});

describe("what the window keeps of its layout", () => {
  it("keeps known choices and sizes, and nothing else that was stored", () => {
    expect(
      readLayout({
        keychain: "login",
        category: "passwords",
        sort: { column: "kind", direction: "descending" },
        widths: { name: 200, secret: 10, kind: -1 },
        sourcesWidth: 180,
        sourcesHidden: true,
        item: "my bank",
      }),
    ).toEqual({
      keychain: "login",
      category: "passwords",
      sort: { column: "kind", direction: "descending" },
      widths: { name: 200 },
      sourcesWidth: 180,
      keychainsHeight: undefined,
      sourcesHidden: true,
      statusHidden: false,
    });
    expect(readLayout({ keychain: "mine", sort: { column: "secret", direction: "up" } })).toEqual(
      expect.objectContaining({ keychain: undefined, sort: undefined }),
    );
    expect(readLayout("login")).toBeUndefined();
  });

  it("reads one stored value as one object, as the window renders from it", () => {
    const stored = { category: "passwords" };
    expect(readLayout(stored)).toBe(readLayout(stored));
  });

  it("counts the login keychain and says why another has nothing", () => {
    const login = { id: "login", name: "login", icon: "unlocked" } as const;
    const roots = { id: "system-roots", name: "System Roots", icon: "locked" } as const;
    expect(statusLine(login, 1)).toBe("1 item");
    expect(statusLine(login, 3)).toBe("3 items");
    expect(statusLine(roots, 0)).toBe(
      "A web page cannot read “System Roots”. Only your own keychains are kept here.",
    );
  });
});

describe("Keychain Access on the desktop's Ferrite application", () => {
  it("shows the invented keychains and asks no server when the page is not served", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<DesktopKeychainAccess />);
    expect(fetch).not.toHaveBeenCalled();
    expect(items().length).toBeGreaterThan(20);
    expect(keychainAccessApp.component).toBe(DesktopKeychainAccess);
  });

  it("makes a keychain, adds a password and saves only ciphertext", async () => {
    const user = userEvent.setup();
    const fetch = serve({ vault: null, rev: 0 });
    render(<ServedKeychainAccess iterations={ITERATIONS} />);
    // No invented item is shown in the served window.
    expect(items()).toEqual([]);

    let open = await dialog();
    expect(within(open).getByText(/Choose a password/)).toBeInTheDocument();
    await user.type(within(open).getByLabelText("New Password:"), "correct horse");
    await user.type(within(open).getByLabelText("Verify:"), "correct horse");
    await user.click(within(open).getByRole("button", { name: "Create" }));
    await waitFor(() => expect(saves(fetch)).toHaveLength(1));
    expect(saves(fetch)[0]?.url).toBe(URL);
    expect(saves(fetch)[0]?.text).not.toContain("correct horse");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "New Keychain Item" }));
    open = await dialog();
    await user.type(within(open).getByLabelText("Keychain Item Name:"), "https://example.com");
    await user.type(within(open).getByLabelText("Account Name:"), "jordan");
    await user.type(within(open).getByLabelText("Password:"), "hunter2-secret");
    await user.click(within(open).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(saves(fetch)).toHaveLength(2));
    const second = saves(fetch)[1];
    expect(second?.text).not.toContain("hunter2");
    expect(second?.text).not.toContain("example.com");
    await waitFor(() => expect(items()).toEqual(["https://example.com"]));
    // The secret is never in the page until asked for.
    expect(document.body.textContent).not.toContain("hunter2");

    // What was saved opens with the password, and holds the item and its secret.
    const opened = await unlockVault(second?.body.vault, "correct horse");
    expect(opened.items).toMatchObject([
      { name: "https://example.com", kind: "Internet password", account: "jordan" },
    ]);
    expect(opened.items[0]?.secret).toBe("hunter2-secret");
  });

  it("unlocks a stored keychain only with its password, and shows a password on request", async () => {
    const user = userEvent.setup();
    const { vault } = await createVault("correct horse", ITERATIONS);
    const envelope = await sealVault({
      ...vault,
      items: [
        {
          id: "login-1",
          keychain: "login",
          name: "Wi-Fi",
          kind: "application password",
          secret: "s3cret-value",
        },
      ],
    });
    const fetch = serve({ vault: envelope, rev: 4 });
    render(<ServedKeychainAccess iterations={ITERATIONS} />);
    const open = await dialog();
    await user.type(within(open).getByLabelText("Password:"), "wrong horse");
    await user.click(within(open).getByRole("button", { name: "Unlock" }));
    expect(
      await within(open).findByText("The password you entered is not correct."),
    ).toBeInTheDocument();
    expect(items()).toEqual([]);

    await user.clear(within(open).getByLabelText("Password:"));
    await user.type(within(open).getByLabelText("Password:"), "correct horse");
    await user.click(within(open).getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(items()).toEqual(["Wi-Fi"]));
    expect(saves(fetch)).toEqual([]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(
      within(screen.getByRole("grid", { name: "Items" }))
        .getAllByRole("row")
        .find((row) => within(row).queryAllByRole("gridcell")[0]?.textContent === "Wi-Fi") ??
        document.body,
    );
    await user.click(screen.getByRole("button", { name: "Info" }));
    const info = await dialog();
    expect(document.body.textContent).not.toContain("s3cret-value");
    await user.click(within(info).getByRole("button", { name: "Show Password" }));
    expect(within(info).getByRole("textbox", { name: "Password" })).toHaveValue("s3cret-value");

    await user.click(within(info).getByRole("button", { name: "Delete" }));
    // It asks first, and nothing goes until the answer.
    const asked = await screen.findByText(/Are you sure you want to delete/);
    expect(saves(fetch)).toHaveLength(0);
    const confirm = asked.closest("[role='dialog']") as HTMLElement;
    await user.click(within(confirm).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(saves(fetch)).toHaveLength(1));
    await waitFor(() => expect(items()).toEqual([]));
  });

  it("offers nothing that would save over a stored keychain it cannot read", async () => {
    const user = userEvent.setup();
    const fetch = serve({ vault: { version: 9 }, rev: 2 });
    render(<ServedKeychainAccess iterations={ITERATIONS} />);
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Keychain Access" })).not.toHaveAttribute(
        "aria-busy",
      ),
    );
    await user.click(screen.getByRole("button", { name: "New Keychain Item" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(saves(fetch)).toEqual([]);
  });
});

describe("an imported file", () => {
  const item = (id: string, name: string, secret: string): VaultItem => ({
    id,
    name,
    secret,
    kind: "application password",
    keychain: "login",
  });

  it("reads only the export format", async () => {
    const sealed = await sealItems([item("x", "a", "s")], "file password", ITERATIONS);
    expect(envelopeOfFile(JSON.stringify(sealed))).toEqual(sealed);
    expect(envelopeOfFile('{"nothing": true}')).toBeUndefined();
    expect(envelopeOfFile("not json")).toBeUndefined();
  });

  it("adds what the keychain lacks under free ids, and nothing the second time", () => {
    const held = [item("login-2", "kept", "one")];
    const file = [item("login-2", "new", "two"), item("login-9", "kept", "one")];
    const once = withImported(held, file);
    expect(once.items.map(({ id, name }) => [id, name])).toEqual([
      ["login-2", "kept"],
      ["login-3", "new"],
    ]);
    expect([once.added, once.skipped]).toEqual([1, 1]);
    const twice = withImported(once.items, file);
    expect(twice.items).toEqual(once.items);
    expect([twice.added, twice.skipped]).toEqual([0, 2]);
  });

  it("keeps an item with the same name and another password", () => {
    const { added } = withImported([item("a", "same", "one")], [item("b", "same", "two")]);
    expect(added).toBe(1);
  });
});

describe("the keychain's settings", () => {
  it("reads only what it knows, and only a usable wait", () => {
    expect(readSettings({ lockAfterMinutes: 5, lockWhenHidden: true, other: "x" })).toEqual({
      lockAfterMinutes: 5,
      lockWhenHidden: true,
    });
    expect(readSettings({ lockAfterMinutes: 0 })?.lockAfterMinutes).toBeUndefined();
    expect(readSettings({ lockAfterMinutes: 1441 })?.lockAfterMinutes).toBeUndefined();
    expect(readSettings("text")).toBeUndefined();
  });
});

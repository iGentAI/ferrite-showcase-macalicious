import { useCallback, useEffect, useRef, useState } from "react";
import { onReloadServerDocument, sessionFetch, withDeadline } from "../desktop/desktop-server";
import {
  createVault,
  isEnvelope,
  MAX_CIPHERTEXT_LENGTH,
  type OpenVault,
  openWithKey,
  sealVault,
  unlockVault,
  type VaultEnvelope,
  type VaultItem,
  VaultTooLargeError,
} from "./keychain-access-vault";

/**
 * The keychains a person makes beside “login”, in their own document on the server
 * (`ferrite-apps/desktop/src/apps/keychain_access`). Each is sealed as “login” is, under a password of
 * its own, whose key is derived here and never leaves the page: the server holds its name, for the
 * list, and its envelope. Writes go straight out and are awaited, not through the window's channel,
 * since moving an item removes it from where it was only once its new keychain has been stored.
 */
export const KEYCHAIN_OTHERS_URL = "/api/keychain-access/keychains";

/** The most keychains beside “login”: the module's limit. */
export const MAX_KEYCHAINS = 8;
/** The longest name the module takes. */
export const MAX_KEYCHAIN_NAME_LENGTH = 64;

export interface OtherKeychain {
  id: string;
  name: string;
  vault: VaultEnvelope;
}

const isOther = (value: unknown): value is OtherKeychain => {
  const keychain = value as Partial<OtherKeychain> | null;
  return (
    typeof keychain?.id === "string" &&
    typeof keychain.name === "string" &&
    isEnvelope(keychain.vault)
  );
};

/** The keychains of a reply, or `undefined` when it is not the module's. */
export function othersFromServer(
  reply: unknown,
): { keychains: OtherKeychain[]; rev: number } | undefined {
  const body = reply as { keychains?: unknown; rev?: unknown } | null;
  if (typeof body?.rev !== "number") return undefined;
  if (body.keychains === null) return { keychains: [], rev: body.rev };
  return Array.isArray(body.keychains) && body.keychains.every(isOther)
    ? { keychains: body.keychains, rev: body.rev }
    : undefined;
}

/** An item id its keychain does not hold yet. */
export function freshItemIds(
  keychain: string,
  held: readonly VaultItem[],
  count: number,
): string[] {
  const taken = new Set(held.map((entry) => entry.id));
  const ids: string[] = [];
  for (let n = held.length + 1; ids.length < count; n += 1) {
    const id = `${keychain}-${n}`;
    if (!taken.has(id)) ids.push(id);
  }
  return ids;
}

const newId = () => `keychain-${crypto.randomUUID().slice(0, 8)}`;

/** Whether the keychains together are what the server takes. */
function fits(keychains: readonly OtherKeychain[]): boolean {
  const total = keychains.reduce((sum, each) => sum + each.vault.ciphertext.length, 0);
  return total <= MAX_CIPHERTEXT_LENGTH;
}

export interface OtherKeychains {
  list: readonly OtherKeychain[];
  /** Those unlocked in this window, by id. */
  open: Readonly<Record<string, OpenVault>>;
  create: (name: string, password: string) => Promise<string>;
  unlock: (id: string, password: string) => Promise<void>;
  lock: (id: string) => void;
  lockAll: () => void;
  writeItems: (id: string, items: readonly VaultItem[]) => Promise<void>;
  changePassword: (id: string, current: string, next: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/** The other keychains of the window: what the server keeps and what this window has unlocked. */
export function useOtherKeychains(iterations?: number): OtherKeychains {
  const [list, setList] = useState<readonly OtherKeychain[]>([]);
  const [open, setOpen] = useState<Readonly<Record<string, OpenVault>>>({});
  const listNow = useRef(list);
  const openNow = useRef(open);
  const rev = useRef(0);

  const showOpen = useCallback((next: Readonly<Record<string, OpenVault>>) => {
    openNow.current = next;
    setOpen(next);
  }, []);

  // What the server holds now: a keychain with a new salt, or gone, locks; one that only changed
  // is read again under the key this window has.
  const adopt = useCallback(
    async (keychains: readonly OtherKeychain[], at: number) => {
      rev.current = at;
      listNow.current = keychains;
      setList(keychains);
      const kept: Record<string, OpenVault> = {};
      for (const [id, vault] of Object.entries(openNow.current)) {
        const stored = keychains.find((each) => each.id === id);
        if (stored?.vault.kdf.salt !== vault.kdf.salt) continue;
        try {
          kept[id] = { ...vault, items: await openWithKey(stored.vault, vault.key) };
        } catch {
          // No longer opens with this key: it stays locked.
        }
      }
      showOpen(kept);
    },
    [showOpen],
  );

  const read = useCallback(async () => {
    const reply = await withDeadline((signal) =>
      sessionFetch(KEYCHAIN_OTHERS_URL, { credentials: "same-origin", signal }),
    );
    const stored = reply.ok ? othersFromServer(await reply.json()) : undefined;
    if (stored) await adopt(stored.keychains, stored.rev);
  }, [adopt]);

  useEffect(() => {
    void read().catch(console.error);
    return onReloadServerDocument(KEYCHAIN_OTHERS_URL, () => void read().catch(console.error));
  }, [read]);

  const put = useCallback(
    async (keychains: readonly OtherKeychain[]) => {
      if (!fits(keychains)) throw new VaultTooLargeError();
      const reply = await withDeadline((signal) =>
        sessionFetch(KEYCHAIN_OTHERS_URL, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ keychains, rev: rev.current }),
          signal,
        }),
      );
      const body: unknown = await reply.json().catch(() => null);
      if (reply.status === 409) {
        const theirs = othersFromServer(body);
        if (theirs) await adopt(theirs.keychains, theirs.rev);
        else await read();
        throw new Error("Another window changed your keychains. Try again.");
      }
      if (!reply.ok) {
        const said = (body as { error?: unknown } | null)?.error;
        throw new Error(typeof said === "string" ? said : `The server answered ${reply.status}.`);
      }
      const next = (body as { rev?: unknown } | null)?.rev;
      if (typeof next === "number") rev.current = next;
      listNow.current = keychains;
      setList(keychains);
    },
    [adopt, read],
  );

  const replaced = (id: string, vault: VaultEnvelope) =>
    listNow.current.map((each) => (each.id === id ? { ...each, vault } : each));

  return {
    list,
    open,
    create: async (name, password) => {
      const { vault, envelope } = await createVault(password, iterations);
      const id = newId();
      await put([...listNow.current, { id, name, vault: envelope }]);
      showOpen({ ...openNow.current, [id]: vault });
      return id;
    },
    unlock: async (id, password) => {
      const stored = listNow.current.find((each) => each.id === id);
      if (!stored) throw new Error("That keychain is no longer kept here.");
      showOpen({ ...openNow.current, [id]: await unlockVault(stored.vault, password) });
    },
    lock: (id) => {
      const { [id]: _gone, ...rest } = openNow.current;
      showOpen(rest);
    },
    lockAll: () => showOpen({}),
    writeItems: async (id, items) => {
      const vault = openNow.current[id];
      if (!vault) throw new Error("That keychain is locked.");
      const next = { ...vault, items: [...items] };
      await put(replaced(id, await sealVault(next)));
      showOpen({ ...openNow.current, [id]: next });
    },
    changePassword: async (id, current, password) => {
      const stored = listNow.current.find((each) => each.id === id);
      const vault = openNow.current[id];
      if (!stored || !vault) throw new Error("That keychain is locked.");
      await unlockVault(stored.vault, current);
      const { vault: made } = await createVault(password, vault.kdf.iterations);
      const next = { ...made, items: vault.items };
      await put(replaced(id, await sealVault(next)));
      showOpen({ ...openNow.current, [id]: next });
    },
    remove: async (id) => {
      await put(listNow.current.filter((each) => each.id !== id));
      const { [id]: _gone, ...rest } = openNow.current;
      showOpen(rest);
    },
  };
}

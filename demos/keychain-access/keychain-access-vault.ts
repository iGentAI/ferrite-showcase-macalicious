import type { KeychainAccessItem, KeychainAccessKind } from "./keychain-access-data";

/**
 * The keychain as the `macalicious-desktop` Ferrite application keeps it
 * (`ferrite-apps/desktop/src/apps/keychain_access`): only an encrypted envelope. The window
 * derives an AES-GCM key from the keychain password with PBKDF2 (SHA-256, a random 16-byte salt)
 * and encrypts the whole list of items, secrets included, under a fresh 12-byte IV on every
 * save. The password, the key and the plain items never leave the page.
 */
export const KEYCHAIN_VAULT_URL = "/api/keychain-access/vault";

/** The key derivation's name, as the envelope records it. */
export const VAULT_KDF = "PBKDF2-SHA-256";
/** PBKDF2 iterations for a new keychain: OWASP's figure for PBKDF2 with SHA-256. */
export const VAULT_ITERATIONS = 600_000;
/** The fewest and most iterations the server takes, which the window takes too. */
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 10_000_000;
/** The shortest keychain password the window accepts. */
export const MIN_PASSWORD_LENGTH = 8;
/** The longest ciphertext the server takes, in base64 characters. */
export const MAX_CIPHERTEXT_LENGTH = 200_000;
/** The longest password or note an item may hold. */
export const MAX_SECRET_LENGTH = 4_096;

/** The keychain would be larger than the server keeps; nothing was changed. */
export class VaultTooLargeError extends Error {
  constructor() {
    super("The keychain is full: the server keeps at most 200,000 characters of it.");
    this.name = "VaultTooLargeError";
  }
}

/** What the server stores. */
export interface VaultEnvelope {
  version: 1;
  kdf: { name: typeof VAULT_KDF; iterations: number; salt: string };
  iv: string;
  ciphertext: string;
}

/** An item with its secret: a password, or a secure note's text. */
export interface VaultItem extends KeychainAccessItem {
  secret: string;
  /** What the person wrote about it. Sealed with the secret; the table never sees it. */
  comments?: string;
}

/** An unlocked keychain: the key derived from its password, and its items. */
export interface OpenVault {
  key: CryptoKey;
  kdf: VaultEnvelope["kdf"];
  items: readonly VaultItem[];
}

/** The password did not decrypt the keychain (or the envelope was changed). */
export class WrongPasswordError extends Error {
  constructor() {
    super("The password you entered is not correct.");
    this.name = "WrongPasswordError";
  }
}

const KINDS: readonly KeychainAccessKind[] = [
  "application password",
  "Internet password",
  "Web form password",
  "AirPort network password",
  "secure note",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (let at = 0; at < bytes.length; at += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(text);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at += 1) bytes[at] = binary.charCodeAt(at);
  return bytes;
}

const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

/** Whether `value` is an envelope the window can try to open. */
export function isEnvelope(value: unknown): value is VaultEnvelope {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.kdf)) return false;
  const { kdf, iv, ciphertext } = value;
  return (
    kdf.name === VAULT_KDF &&
    typeof kdf.iterations === "number" &&
    Number.isInteger(kdf.iterations) &&
    kdf.iterations >= MIN_ITERATIONS &&
    kdf.iterations <= MAX_ITERATIONS &&
    typeof kdf.salt === "string" &&
    BASE64.test(kdf.salt) &&
    typeof iv === "string" &&
    BASE64.test(iv) &&
    typeof ciphertext === "string" &&
    BASE64.test(ciphertext)
  );
}

/**
 * Whether a `GET` reply is one the window can read: an envelope, or `null` before the session
 * has made a keychain. Anything else is stored data that must not be saved over.
 */
export function vaultReadable(reply: unknown): boolean {
  const vault = isRecord(reply) ? reply.vault : undefined;
  return vault === null || isEnvelope(vault);
}

/** The envelope of a reply, `null` when the session has none, `undefined` when unreadable. */
export function envelopeFromServer(reply: unknown): VaultEnvelope | null | undefined {
  if (!vaultReadable(reply)) return undefined;
  return (reply as { vault: VaultEnvelope | null }).vault;
}

const isItem = (value: unknown): value is VaultItem =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  KINDS.includes(value.kind as KeychainAccessKind) &&
  typeof value.keychain === "string" &&
  typeof value.secret === "string" &&
  ["modified", "account", "where", "comments"].every(
    (field) => value[field] === undefined || typeof value[field] === "string",
  );

export async function deriveKey(password: string, kdf: VaultEnvelope["kdf"]): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(kdf.salt), iterations: kdf.iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * The envelope of an open keychain: its items encrypted under a fresh IV. Throws
 * `VaultTooLargeError` when the server would refuse it, so that no change is shown unsaved.
 */
export async function sealVault(vault: OpenVault): Promise<VaultEnvelope> {
  const iv = randomBytes(12);
  const plain = new TextEncoder().encode(JSON.stringify({ items: vault.items }));
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, vault.key, plain);
  const ciphertext = toBase64(new Uint8Array(sealed));
  if (ciphertext.length > MAX_CIPHERTEXT_LENGTH) throw new VaultTooLargeError();
  return {
    version: 1,
    kdf: vault.kdf,
    iv: toBase64(iv),
    ciphertext,
  };
}

/** A new, empty keychain locked with `password`, and its first envelope. */
export async function createVault(
  password: string,
  iterations: number = VAULT_ITERATIONS,
): Promise<{ vault: OpenVault; envelope: VaultEnvelope }> {
  const kdf = { name: VAULT_KDF, iterations, salt: toBase64(randomBytes(16)) } as const;
  const vault: OpenVault = { key: await deriveKey(password, kdf), kdf, items: [] };
  return { vault, envelope: await sealVault(vault) };
}

/**
 * `items` alone, sealed under a password of their own, as an export file holds them. The format is the
 * keychain's: JSON naming PBKDF2-SHA-256 and its salt, with an AES-GCM ciphertext.
 */
export async function sealItems(
  items: readonly VaultItem[],
  password: string,
  iterations: number = VAULT_ITERATIONS,
): Promise<VaultEnvelope> {
  const { vault } = await createVault(password, iterations);
  return sealVault({ ...vault, items: [...items] });
}

/** The largest file Import Items reads: an export can be no larger than a keychain. */
export const MAX_IMPORT_BYTES = 2 * MAX_CIPHERTEXT_LENGTH;

/** The envelope in the text of an exported file, or `undefined` when the text is not one. */
export function envelopeOfFile(text: string): VaultEnvelope | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return isEnvelope(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * `held` with the items of an imported file after it, under ids of their own. An item the keychain
 * already holds, the same in everything but its id and date, is not added again, so importing a file
 * twice changes nothing.
 */
export function withImported(
  held: readonly VaultItem[],
  imported: readonly VaultItem[],
): { items: VaultItem[]; added: number; skipped: number } {
  const sameness = ({ name, kind, account, where, comments, secret }: VaultItem) =>
    JSON.stringify([name, kind, account, where, comments, secret]);
  const seen = new Set(held.map(sameness));
  const taken = new Set(held.map((entry) => entry.id));
  const items = [...held];
  let n = held.length + 1;
  let skipped = 0;
  for (const entry of imported) {
    const same = sameness(entry);
    if (seen.has(same)) {
      skipped += 1;
      continue;
    }
    seen.add(same);
    while (taken.has(`login-${n}`)) n += 1;
    taken.add(`login-${n}`);
    items.push({ ...entry, id: `login-${n}`, keychain: "login" });
  }
  return { items, added: items.length - held.length, skipped };
}

/** The items of an envelope, with a key already derived (another window's save). */
export async function openWithKey(envelope: VaultEnvelope, key: CryptoKey): Promise<VaultItem[]> {
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.ciphertext),
    );
  } catch {
    throw new WrongPasswordError();
  }
  const content: unknown = JSON.parse(new TextDecoder().decode(plain));
  const items = isRecord(content) ? content.items : undefined;
  if (!Array.isArray(items) || !items.every(isItem)) {
    throw new Error("The keychain decrypted, but its items are not in a shape the window knows.");
  }
  return items;
}

/** Unlock an envelope with the keychain password. Throws `WrongPasswordError` when it is not. */
export async function unlockVault(envelope: VaultEnvelope, password: string): Promise<OpenVault> {
  const key = await deriveKey(password, envelope.kdf);
  return { key, kdf: envelope.kdf, items: await openWithKey(envelope, key) };
}

/** The kind of a new password item: an Internet password for a web address. */
export const passwordKind = (where: string): KeychainAccessKind =>
  /^https?:\/\//i.test(where.trim()) ? "Internet password" : "application password";

/** A moment as the window's dates are written: the browser's local `YYYY-MM-DDTHH:MM:SS`. */
export function localStamp(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(
    date.getHours(),
  )}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
}

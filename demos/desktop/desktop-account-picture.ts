/**
 * The account's picture: kept for the account as a small JPEG `data:` URL, and copied to this browser's
 * storage so that its login window can show it before anyone has signed in.
 */
export const ACCOUNT_PICTURE_KEY = "users-and-groups.picture";

/** What fits a setting of at most 4096 bytes (`MAX_VALUE_BYTES` of the server's settings). */
export const ACCOUNT_PICTURE_SIDE = 96;
export const ACCOUNT_PICTURE_CHARS = 4_000;

const BROWSER_KEY = "macalicious-account-pictures";

const BY_NAME_KEY = "macalicious-login-by-name";

/** Whether this browser's login window asks for a name and password instead of listing accounts. */
export function loginByName(): boolean {
  try {
    return window.localStorage.getItem(BY_NAME_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLoginByName(byName: boolean): void {
  try {
    if (byName) window.localStorage.setItem(BY_NAME_KEY, "1");
    else window.localStorage.removeItem(BY_NAME_KEY);
  } catch {
    // Without storage the login window keeps its list.
  }
}

export const readAccountPicture = (stored: unknown): string | undefined =>
  typeof stored === "string" && stored.startsWith("data:image/") ? stored : undefined;

function browserPictures(): Record<string, string> {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(BROWSER_KEY) ?? "{}");
    return typeof stored === "object" && stored !== null ? (stored as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** The picture this browser last saw for the account. */
export const browserPictureOf = (account: string): string | undefined =>
  readAccountPicture(browserPictures()[account]);

/** Keeps the account's picture for this browser's login window, or forgets it when there is none. */
export function rememberAccountPicture(account: string, picture: string | undefined): void {
  const { [account]: earlier, ...others } = browserPictures();
  if (earlier === picture) return;
  try {
    window.localStorage.setItem(
      BROWSER_KEY,
      JSON.stringify(picture ? { ...others, [account]: picture } : others),
    );
  } catch {
    // Without storage the login window shows its silhouette.
  }
}

"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { ImageWell } from "macalicious/image-well";
import { Label } from "macalicious/label";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { SecureTextField } from "macalicious/secure-text-field";
import { Slider } from "macalicious/slider";
import { type ReactNode, use, useEffect, useId, useRef, useState } from "react";
import { formatSize } from "../about-this-mac/about-this-mac-data";
import { useDesktopFacts } from "../about-this-mac/about-this-mac-desktop";
import { MY_CARD_ID } from "../contacts/contacts-data";
import { isPictureFile, pictureFromBlob } from "../contacts/contacts-picture";
import {
  ACCOUNT_PICTURE_CHARS,
  ACCOUNT_PICTURE_KEY,
  ACCOUNT_PICTURE_SIDE,
  loginByName,
  readAccountPicture,
  setLoginByName,
} from "../desktop/desktop-account-picture";
import { useDesktopDrop } from "../desktop/desktop-drag";
import { readFile } from "../desktop/desktop-files";
import { openItem } from "../desktop/desktop-open-item";
import { readIds, useDesktopSetting } from "../desktop/desktop-personal";
import { DOCK_OPEN_AT_LOGIN } from "../desktop/desktop-restore";
import { servedByDesktopApp, sessionFetch } from "../desktop/desktop-server";
import { requestSystem, useBattery, useOnline } from "../desktop/desktop-system";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { BRIGHTNESS_KEY, LEAST_BRIGHTNESS, NIGHT_SHIFT_KEY } from "./page-layers";
import { usePreference, usePreferences } from "./pane";
import { DISPLAY_SLEEP_KEY, SAVER_DELAYS } from "./panes/desktop-and-screen-saver/screen-saver";

/**
 * What a pane shows on the desktop served by the Ferrite application when its library demo shows
 * facts of the captured Mac (an IP address, a backup under way, a printer). A web page cannot read
 * or change those, so each page here shows what the browser and the application really report and
 * says plainly what cannot be known. Panes name their page as `served` in `definePane`.
 */

/** The signed-in person, as `GET /api/session` names them. */
export interface ServedAccount {
  name: string;
  fullName: string;
  guest: boolean;
}

/** The signed-in person; `null` until the session has answered, or when it could not be read. */
export function useServedAccount(): ServedAccount | null {
  const [account, setAccount] = useState<ServedAccount | null>(null);
  useEffect(() => {
    if (!servedByDesktopApp()) return;
    let live = true;
    sessionFetch("/api/session", {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    })
      .then(async (response) => (response.ok ? await response.json() : null))
      .catch(() => null)
      .then((reply) => {
        const found = reply?.account;
        if (live && typeof found?.name === "string") {
          setAccount({
            name: found.name,
            fullName: typeof found.full_name === "string" ? found.full_name : found.name,
            guest: found.guest === true,
          });
        }
      });
    return () => {
      live = false;
    };
  }, []);
  return account;
}

/** A fact: its label and its value. */
export type Fact = readonly [label: string, value: string];

/**
 * One page: a title, what is true of this desktop, the facts, `detail` under them, and what can be
 * done from here.
 */
export function ServedPage({
  title,
  statement,
  facts = [],
  detail,
  children,
}: {
  title: string;
  statement: string;
  facts?: readonly Fact[];
  detail?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mac-system-preferences-served">
      <h2>
        <Label textStyle="emphasized">{title}</Label>
      </h2>
      <Label render={<p />}>{statement}</Label>
      {facts.length > 0 ? (
        <Label
          render={<dl />}
          className="mac-system-preferences-served-facts"
          style={detail ? { flexShrink: 0 } : undefined}
        >
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}:</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </Label>
      ) : null}
      {detail}
      {children ? <div className="mac-system-preferences-served-actions">{children}</div> : null}
    </div>
  );
}

/** A button that opens another application of the desktop. */
function OpenApp({ id, children }: { id: string; children: ReactNode }) {
  const launch = use(DesktopWindowHostContext)?.launch;
  return (
    <PushButton disabled={!launch} onClick={() => launch?.(id)}>
      {children}
    </PushButton>
  );
}

/** A button that opens another pane of the window. */
export function OpenPane({ id, children }: { id: string; children: ReactNode }) {
  const { showPane } = usePreferences();
  return <PushButton onClick={() => showPane(id)}>{children}</PushButton>;
}

/** A check box that says whether the menu bar shows one of its menus (`setting-effects.ts`). */
function MenuBarChoice({
  setting,
  initial,
  children,
}: {
  setting: string;
  initial: boolean;
  children: string;
}) {
  const [shown, setShown] = usePreference(setting, initial);
  return (
    <Checkbox checked={shown} onCheckedChange={setShown}>
      {children}
    </Checkbox>
  );
}

/** The names of the desktop's applications, by id, once they have been read. */
export function useAppNames(): ReadonlyMap<string, string> {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    let live = true;
    void import("../desktop/desktop-apps").then(({ discoveredApps }) => {
      if (live) setNames(new Map(discoveredApps.map((app) => [app.id, app.name])));
    });
    return () => {
      live = false;
    };
  }, []);
  return names;
}

interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

/** `navigator.connection`, kept current; `undefined` in a browser without it. */
function useConnection(): NetworkInformation | undefined {
  const [connection] = useState(
    () => (navigator as Navigator & { connection?: NetworkInformation }).connection,
  );
  const [, changed] = useState(0);
  useEffect(() => {
    const listener = () => changed((count) => count + 1);
    connection?.addEventListener?.("change", listener);
    return () => connection?.removeEventListener?.("change", listener);
  }, [connection]);
  return connection;
}

const NOT_REPORTED = "Not reported by this browser";

/** Network: `navigator.onLine` and `navigator.connection`, and no invented interface. */
export function ServedNetwork() {
  const online = useOnline();
  const connection = useConnection();
  return (
    <ServedPage
      title="This Browser's Connection"
      statement="A web page is told only whether the browser is online and roughly how fast its connection is. It cannot see or change Wi-Fi, network names, IP addresses, locations or services."
      facts={[
        ["Status", online ? "Connected" : "Offline"],
        ["Connection speed class", connection?.effectiveType ?? NOT_REPORTED],
        [
          "Estimated bandwidth",
          connection?.downlink === undefined ? NOT_REPORTED : `${connection.downlink} Mbit/s`,
        ],
        [
          "Estimated round trip",
          connection?.rtt === undefined ? NOT_REPORTED : `${connection.rtt} ms`,
        ],
        ["IP address", "Not visible to a web page"],
        ["Network name", "Not visible to a web page"],
      ]}
    >
      <MenuBarChoice setting="network.showStatusInMenuBar" initial={true}>
        Show Wi-Fi status in menu bar
      </MenuBarChoice>
    </ServedPage>
  );
}

/** Bluetooth: what Web Bluetooth says, and no invented device. */
export function ServedBluetooth() {
  const [available, setAvailable] = useState<string>("Checking…");
  useEffect(() => {
    const bluetooth = (
      navigator as Navigator & { bluetooth?: { getAvailability?: () => Promise<boolean> } }
    ).bluetooth;
    if (!bluetooth?.getAvailability) {
      setAvailable(NOT_REPORTED);
      return;
    }
    let live = true;
    bluetooth.getAvailability().then(
      (yes) => {
        if (live) setAvailable(yes ? "Available" : "Not available");
      },
      () => {
        if (live) setAvailable(NOT_REPORTED);
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return (
    <ServedPage
      title="Bluetooth"
      statement="A web page cannot turn Bluetooth on or off, list the devices paired with this computer, or make it discoverable. Use the settings of your own computer for those."
      facts={[["Bluetooth in this browser", available]]}
    >
      <MenuBarChoice setting="bluetooth.showInMenuBar" initial={false}>
        Show Bluetooth in menu bar
      </MenuBarChoice>
    </ServedPage>
  );
}

/** Printers: the browser's print dialog chooses the printer. */
export function ServedPrinters() {
  return (
    <ServedPage
      title="Printers & Scanners"
      statement="A web page cannot list printers or scanners. Printing goes through your browser's own print dialog, which chooses the printer and the paper."
    >
      <PushButton onClick={() => window.print()}>Print This Page…</PushButton>
    </ServedPage>
  );
}

/** The person's Ferrite drive as a line, from About This Mac's facts. */
function useDriveLine(): string {
  const { facts, failed } = useDesktopFacts();
  if (failed) return "Not available";
  if (!facts) return "Reading…";
  const drive = facts.drive;
  return drive
    ? `${formatSize(drive.available)} available of ${formatSize(drive.quota)}`
    : "Not reported by this server";
}

/** Time Machine: nothing is backed up here, and the menu extra says the same. */
export function ServedTimeMachine() {
  const drive = useDriveLine();
  return (
    <ServedPage
      title="Time Machine"
      statement="This desktop has no Time Machine disk, so nothing is backed up. Your files and each app's data are kept by the server of this desktop, with the Trash as the only way back for a deleted file."
      facts={[
        ["Latest backup", "None"],
        ["Ferrite Drive", drive],
      ]}
    >
      <MenuBarChoice setting="time-machine.showInMenuBar" initial={true}>
        Show Time Machine in menu bar
      </MenuBarChoice>
      <OpenApp id="storage-management">Open Storage Management…</OpenApp>
    </ServedPage>
  );
}

/** What the desktop is running, from About This Mac's facts. */
function useDeployment(): readonly Fact[] {
  const { facts, failed } = useDesktopFacts();
  const none = failed ? "Not available" : "Reading…";
  return [
    [
      "Deployment",
      !facts
        ? none
        : facts.generation === 0
          ? "Not deployed (local ferrite dev)"
          : `Generation ${facts.generation}`,
    ],
    ["Site build", facts ? facts.build.replace(/^sha256:/, "").slice(0, 12) : none],
  ];
}

/** Startup Disk: the desktop starts from its deployment; Restart is the desktop's own. */
export function ServedStartupDisk() {
  const deployment = useDeployment();
  return (
    <ServedPage
      title="Startup Disk"
      statement="This desktop starts from its deployment on a Ferrite server, not from a disk. A web page cannot choose your computer's startup disk or use target disk mode. Restart… starts this desktop again, not your computer."
      facts={deployment}
    >
      <PushButton onClick={() => requestSystem("restart")}>Restart…</PushButton>
    </ServedPage>
  );
}

/** Software Update: the build that is running; a deployment is what updates it. */
export function ServedSoftwareUpdate() {
  const deployment = useDeployment();
  const [checked] = useState(() => new Date());
  return (
    <ServedPage
      title="Software Update"
      statement="This desktop is updated on its server: a new deployment reaches you the next time this page loads. There is nothing to download or install on your computer, and macOS updates are not offered here."
      facts={[
        ...deployment,
        [
          "Last checked",
          checked.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
        ],
      ]}
    >
      <PushButton onClick={() => window.location.reload()}>Reload the Desktop</PushButton>
    </ServedPage>
  );
}

/** Apple ID: the desktop has its own accounts. */
export function ServedAppleId() {
  const account = useServedAccount();
  const drive = useDriveLine();
  return (
    <ServedPage
      title="Your Account"
      statement="This desktop has no Apple ID and no iCloud. You sign in with an account of this desktop, and its Ferrite Drive stands in for iCloud Drive."
      facts={[
        ["Name", account?.fullName ?? "Reading…"],
        ["Account name", account?.name ?? "Reading…"],
        ["Ferrite Drive", drive],
      ]}
    >
      <OpenPane id="users-and-groups">Users & Groups…</OpenPane>
      <OpenApp id="storage-management">Open Storage Management…</OpenApp>
    </ServedPage>
  );
}

/** Family Sharing: there is no family here. */
export function ServedFamilySharing() {
  return (
    <ServedPage
      title="Family Sharing"
      statement="Family Sharing needs Apple IDs and is not available on this desktop. Accounts here keep their purchases, storage and calendars to themselves."
    />
  );
}

/** Internet Accounts: nothing outside the desktop is signed in to. */
export function ServedInternetAccounts() {
  const account = useServedAccount();
  return (
    <ServedPage
      title="Internet Accounts"
      statement="No outside accounts can be added here: this desktop has no mail provider and signs in to no iCloud, Google or Exchange account. Mail, Messages, Calendar and Contacts work between the accounts of this desktop."
      facts={[["Signed in as", account?.fullName ?? "Reading…"]]}
    >
      <OpenPane id="users-and-groups">Users & Groups…</OpenPane>
    </ServedPage>
  );
}

/** Wallet & Apple Pay: no card can be added. */
export function ServedWallet() {
  return (
    <ServedPage
      title="Wallet & Apple Pay"
      statement="Cards cannot be added here: Apple Pay needs a bank and your computer's own secure hardware. This desktop keeps no card details and makes no payments."
    />
  );
}

/** Touch ID: whether the browser can use a platform authenticator, and no invented fingerprint. */
export function ServedTouchId() {
  const [authenticator, setAuthenticator] = useState("Checking…");
  useEffect(() => {
    let live = true;
    const check = window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
    if (!check) {
      setAuthenticator(NOT_REPORTED);
      return;
    }
    check.call(window.PublicKeyCredential).then(
      (yes) => {
        if (live) setAuthenticator(yes ? "Available" : "Not available");
      },
      () => {
        if (live) setAuthenticator(NOT_REPORTED);
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return (
    <ServedPage
      title="Touch ID"
      statement="A web page cannot read fingerprints or see the ones saved on your computer, and this desktop signs in with a password."
      facts={[["Built-in authenticator in this browser", authenticator]]}
    />
  );
}

/** Brightness and Night Shift as layers over this page, since a page cannot change the screen. */
function PageLayerControls() {
  const [brightness, setBrightness] = usePreference<number>(BRIGHTNESS_KEY, 1);
  const [nightShift, setNightShift] = usePreference(NIGHT_SHIFT_KEY, false);
  return (
    <>
      <Label>Brightness of this page:</Label>
      <Slider
        aria-label="Brightness of this page"
        min={LEAST_BRIGHTNESS}
        max={1}
        step={0.05}
        value={brightness}
        onValueChange={(value) => setBrightness(value as number)}
        style={{ width: 180 }}
      />
      <Checkbox checked={nightShift} onCheckedChange={setNightShift}>
        Night Shift on this page
      </Checkbox>
    </>
  );
}

/** Whether a media query holds; a browser without `matchMedia` answers no. */
const mediaMatches = (query: string) => window.matchMedia?.(query).matches === true;

/** The widest colour range the browser says the screen shows. */
const colorRange = () =>
  (["rec2020", "p3", "srgb"] as const).find((gamut) => mediaMatches(`(color-gamut: ${gamut})`));

const COLOR_RANGE_NAMES = { rec2020: "Rec. 2020", p3: "Display P3", srgb: "sRGB" } as const;

/** What the browser says of high dynamic range; a browser that answers neither has not said. */
export function dynamicRangeFact(): string {
  if (mediaMatches("(dynamic-range: high)")) return "Yes";
  return mediaMatches("(dynamic-range: standard)") ? "No" : NOT_REPORTED;
}

/** Displays: what `screen`, the window and the media queries report. */
export function ServedDisplays() {
  const [, resized] = useState(0);
  useEffect(() => {
    const listener = () => resized((count) => count + 1);
    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, []);
  const { width, height, availWidth, availHeight, colorDepth } = window.screen;
  const { isExtended } = window.screen as Screen & { isExtended?: boolean };
  const range = colorRange();
  return (
    <ServedPage
      title="This Screen"
      statement="A web page can read the size of the screen the browser is on and what it can show, but it cannot change the resolution, brightness or colour profile, turn on automatic brightness or True Tone, use AirPlay or mirroring, or learn the display's name. The two controls here dim and warm this page only, not your screen."
      facts={[
        ["Size", `${width} × ${height} points`],
        ["Available to windows", `${availWidth} × ${availHeight} points`],
        ["This browser window", `${window.innerWidth} × ${window.innerHeight} points`],
        ["Pixel ratio", `${window.devicePixelRatio || 1}×`],
        ["Color depth", `${colorDepth}-bit`],
        ["Color range", range ? COLOR_RANGE_NAMES[range] : NOT_REPORTED],
        ["High dynamic range", dynamicRangeFact()],
        [
          "Other screens",
          isExtended === undefined
            ? NOT_REPORTED
            : isExtended
              ? "At least one is connected"
              : "None",
        ],
      ]}
    >
      <PageLayerControls />
    </ServedPage>
  );
}

/**
 * The other accounts used in this browser, as the login window lists them (`RECENT_ACCOUNTS_KEY` of
 * `desktop-accounts.tsx`, which is not imported: that module brings in the whole desktop).
 */
function accountsInThisBrowser(): readonly { name: string; fullName: string }[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem("macalicious-accounts") ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.flatMap((entry) =>
      typeof entry?.name === "string"
        ? [{ name: entry.name, fullName: String(entry.fullName ?? entry.name) }]
        : [],
    );
  } catch {
    return [];
  }
}

/** Change Password…: the current password and the new one twice, checked by the server. */
function ChangePassword({ onDone }: { onDone: (changed: boolean) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [verify, setVerify] = useState("");
  const [saying, setSaying] = useState("");
  const [busy, setBusy] = useState(false);
  const id = useId();
  const change = async () => {
    setBusy(true);
    setSaying("");
    try {
      const reply = await sessionFetch("/api/session/password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current, new: next }),
      });
      if (reply.ok) {
        onDone(true);
        return;
      }
      const body = (await reply.json().catch(() => null)) as { error?: unknown } | null;
      setSaying(typeof body?.error === "string" ? body.error : "The password was not changed.");
    } catch {
      setSaying("The server could not be reached, so the password was not changed.");
    } finally {
      setBusy(false);
    }
  };
  const fields = [
    ["Old password:", current, setCurrent, `${id}-old`],
    ["New password:", next, setNext, `${id}-new`],
    ["Verify:", verify, setVerify, `${id}-verify`],
  ] as const;
  return (
    <div className="mac-system-preferences-served-form">
      {fields.map(([label, value, set, field]) => (
        <div key={field}>
          <Label id={field}>{label}</Label>
          <SecureTextField
            aria-labelledby={field}
            value={value}
            onChange={(event) => set(event.currentTarget.value)}
          />
        </div>
      ))}
      <Label textStyle="small" color="secondary" role="status" render={<p />}>
        {saying ||
          (next && next !== verify
            ? "The new passwords do not match."
            : "Your other browsers will be signed out.")}
      </Label>
      <div>
        <PushButton onClick={() => onDone(false)}>Cancel</PushButton>
        <DefaultButton
          disabled={busy || current === "" || next === "" || next !== verify}
          onClick={() => void change()}
        >
          Change Password
        </DefaultButton>
      </div>
    </div>
  );
}

const NO_LOGIN_ITEMS: readonly string[] = [];

/**
 * The account's picture, chosen from this computer or dragged from Finder, and its card in Contacts.
 * It shows at this browser's login window and lock screen, and is kept for the account.
 */
function AccountCard() {
  const launch = use(DesktopWindowHostContext)?.launch;
  const [stored, setPicture] = useDesktopSetting<string | undefined>(
    ACCOUNT_PICTURE_KEY,
    readAccountPicture,
    undefined,
  );
  const [problem, setProblem] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const take = async (blob: Blob, name: string) => {
    setProblem("");
    try {
      setPicture(await pictureFromBlob(blob, ACCOUNT_PICTURE_SIDE, ACCOUNT_PICTURE_CHARS));
    } catch {
      setProblem(`“${name}” could not be used as your picture.`);
    }
  };
  const drop = useDesktopDrop<HTMLDivElement>({
    enabled: true,
    accepts: (item) => item.kind === "file" && isPictureFile(item.type, item.name),
    onDrop: (items) => {
      const last = items.at(-1);
      if (!last) return;
      readFile(last.id).then(
        (blob) => take(blob, last.name),
        () => setProblem(`“${last.name}” could not be read.`),
      );
    },
    refusal: () => "Only a picture can be your account's picture.",
    sayRefusal: setProblem,
  });
  const openCard = async () => {
    launch?.("contacts");
    // A person who has saved no card has the one Contacts makes for them.
    const reply = await sessionFetch("/api/contacts/cards", {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    const cards: readonly { id?: unknown; me?: unknown }[] = reply?.cards ?? [];
    const mine = cards.find((card) => card.me === true)?.id;
    openItem({
      app: "contacts",
      id: typeof mine === "string" ? mine : MY_CARD_ID,
      title: "My Card",
    });
  };
  return (
    <div ref={drop} className="mac-system-preferences-served-account">
      <ImageWell
        editable={false}
        aria-label="Your picture"
        style={{ width: 64, height: 64, flexShrink: 0 }}
      >
        {stored ? <img src={stored} alt="" width={52} height={52} /> : null}
      </ImageWell>
      <div>
        <PushButton size="small" onClick={() => file.current?.click()}>
          Edit…
        </PushButton>
        <PushButton size="small" disabled={!stored} onClick={() => setPicture("")}>
          Remove Picture
        </PushButton>
        <PushButton size="small" disabled={!launch} onClick={() => void openCard()}>
          Contacts Card: Open…
        </PushButton>
        <Label textStyle="small" color="secondary" role="status" render={<p />}>
          {problem || "Choose a picture, or drag one here from Finder."}
        </Label>
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        aria-label="Picture file"
        onChange={(event) => {
          const chosen = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (chosen) void take(chosen, chosen.name);
        }}
      />
    </div>
  );
}

/** Login Items: the applications that open at a new login, the Dock's Open at Login among them. */
/** Login Options: how this browser's login window asks who is logging in. */
function LoginOptions() {
  const [byName, setByName] = useState(loginByName);
  const id = useId();
  return (
    <div className="mac-system-preferences-served-account">
      <Label id={id}>Display login window as:</Label>
      <PopUpButton
        aria-labelledby={id}
        value={byName ? "name" : "list"}
        onValueChange={(value) => {
          setByName(value === "name");
          setLoginByName(value === "name");
        }}
        style={{ width: 180 }}
      >
        <PopUpButtonItem value="list">List of users</PopUpButtonItem>
        <PopUpButtonItem value="name">Name and password</PopUpButtonItem>
      </PopUpButton>
    </div>
  );
}

function LoginItems() {
  const names = useAppNames();
  const [items, setItems] = useDesktopSetting(DOCK_OPEN_AT_LOGIN, readIds, NO_LOGIN_ITEMS);
  const free = [...names].filter(([id]) => !items.includes(id));
  return (
    <div className="mac-system-preferences-served-list">
      <Label textStyle="emphasized">These items open when you log in:</Label>
      {items.length > 0 ? (
        <ul aria-label="Login Items">
          {items.map((id) => (
            <li key={id}>
              <Label>{names.get(id) ?? id}</Label>
              <PushButton
                size="small"
                aria-label={`Remove ${names.get(id) ?? id}`}
                onClick={() => setItems(items.filter((item) => item !== id))}
              >
                −
              </PushButton>
            </li>
          ))}
        </ul>
      ) : (
        <Label color="secondary">None</Label>
      )}
      <Menu>
        <MenuTrigger render={<PushButton size="small" />}>Add Login Item…</MenuTrigger>
        <MenuPopup sideOffset={4} style={{ maxHeight: 280, overflowY: "auto" }}>
          {free.map(([id, name]) => (
            <MenuItem key={id} onClick={() => setItems([...items, id])}>
              {name}
            </MenuItem>
          ))}
        </MenuPopup>
      </Menu>
    </div>
  );
}

/** Users & Groups: the accounts this browser knows, and the person's login items. */
export function ServedUsers() {
  const account = useServedAccount();
  const [changing, setChanging] = useState(false);
  const [changed, setChanged] = useState(false);
  const others = accountsInThisBrowser()
    .filter((entry) => entry.name !== account?.name)
    .map((entry) => entry.fullName);
  return (
    <ServedPage
      title="Users & Groups"
      statement="Accounts here belong to this desktop, not to your computer. New accounts are made at the login window, and only the accounts used in this browser are listed."
      facts={[
        ["Current user", account?.fullName ?? "Reading…"],
        ["Account name", account?.name ?? "Reading…"],
        ["Kind", account ? (account.guest ? "Guest" : "Standard") : "Reading…"],
        ["Other accounts in this browser", others.length > 0 ? others.join(", ") : "None"],
        ...(changed ? ([["Password", "Changed"]] as const) : []),
      ]}
      detail={
        <>
          <AccountCard />
          <LoginOptions />
          <LoginItems />
        </>
      }
    >
      {changing ? (
        <ChangePassword
          onDone={(done) => {
            setChanged(done);
            setChanging(false);
          }}
        />
      ) : account && !account.guest ? (
        <PushButton
          onClick={() => {
            setChanged(false);
            setChanging(true);
          }}
        >
          Change Password…
        </PushButton>
      ) : null}
    </ServedPage>
  );
}

/** Sharing: nothing on the computer is shared from a page. */
export function ServedSharing() {
  return (
    <ServedPage
      title="Sharing"
      statement="A web page cannot share your computer's screen, files, printers or remote login, and it has no name on your local network. Files on your Ferrite Drive are shared from Finder."
      facts={[
        ["This desktop's address", window.location.origin],
        ["Who can open your things", "Only your account, once signed in"],
      ]}
    >
      <OpenApp id="finder">Open Finder</OpenApp>
    </ServedPage>
  );
}

/** Turn display off after, which blanks this page after that long with no input on it. */
function DisplaySleepControl() {
  const [minutes, setMinutes] = usePreference<number>(DISPLAY_SLEEP_KEY, 0);
  const id = useId();
  return (
    <>
      <Label id={id}>Turn display off after:</Label>
      <PopUpButton
        aria-labelledby={id}
        value={String(minutes)}
        onValueChange={(value) => value && setMinutes(Number(value))}
        style={{ width: 140 }}
      >
        {SAVER_DELAYS.map(([each, title]) => (
          <PopUpButtonItem key={each} value={String(each)}>
            {title}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
    </>
  );
}

/** Energy Saver: the battery as the browser reports it. */
export function ServedEnergySaver() {
  const battery = useBattery();
  const [, setMinutes] = usePreference<number>(DISPLAY_SLEEP_KEY, 0);
  const [, setBatteryShown] = usePreference("energy-saver.showBatteryStatus", true);
  const level =
    battery === undefined
      ? "Reading…"
      : battery === null
        ? NOT_REPORTED
        : `${Math.round(battery.level * 100)}%`;
  const power =
    battery === undefined
      ? "Reading…"
      : battery === null
        ? NOT_REPORTED
        : battery.charging
          ? "Power adapter"
          : "Battery";
  return (
    <ServedPage
      title="Energy Saver"
      statement="A web page can read the battery where the browser allows it, but cannot change when your computer sleeps, or schedule it to start. Turn display off after blanks this page, not your screen, after that long with no input on it; a playing video holds it off."
      facts={[
        ["Battery level", level],
        ["Power source", power],
      ]}
    >
      <DisplaySleepControl />
      <MenuBarChoice setting="energy-saver.showBatteryStatus" initial={true}>
        Show battery status in menu bar
      </MenuBarChoice>
      <PushButton
        onClick={() => {
          setMinutes(0);
          setBatteryShown(true);
        }}
      >
        Restore Defaults
      </PushButton>
    </ServedPage>
  );
}

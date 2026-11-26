/**
 * What the AirPort Utility demo shows: the base stations of the network and the Wi-Fi devices
 * found nearby that are not set up yet. Every name, address and serial number is invented.
 */

/** How a node of the graph is doing; the names are the status dot's. */
export type AirPortStatus = "available" | "partially-available" | "unavailable";

/** A base station of the network: a node under the Internet in the graph. */
export interface AirPortBaseStation {
  /** Identifies the base station among the others. */
  id: string;
  /** The base station's name, shown under its picture. */
  name: string;
  /** The kind of device, such as `"AirPort Express"`. */
  model: string;
  /** The name of the Wi-Fi network it creates. */
  network: string;
  /** Its address on the network. */
  address: string;
  /** Its serial number. */
  serial: string;
  /** The version of its software. */
  version: string;
  /** How it is doing. */
  status: AirPortStatus;
}

/** A Wi-Fi device found nearby that is not set up: an entry of Other Wi-Fi Devices. */
export interface AirPortNearbyDevice {
  /** Identifies the device; it becomes the base station's id. */
  id: string;
  /** The kind of device, such as `"AirPort Express"`. */
  model: string;
  /** What the list calls it: the kind and the end of its hardware address. */
  label: string;
  /** Its serial number. */
  serial: string;
  /** The version of its software. */
  version: string;
}

/** What the setup sheet asks for. */
export interface AirPortSetup {
  /** The name of the Wi-Fi network to create. */
  network: string;
  /** The base station's name. */
  name: string;
  /** The network's password. */
  password: string;
  /** The password once more. */
  verify: string;
}

/** The fewest characters of a network's password (WPA2 Personal). */
export const PASSWORD_LENGTH = 8;

/** The devices the demo finds nearby when it is given none. */
export const defaultNearbyDevices: readonly AirPortNearbyDevice[] = [
  {
    id: "express-5f3a1c",
    model: "AirPort Express",
    label: "AirPort Express 5f3a1c",
    serial: "C86J4Q0XDV2R",
    version: "7.8.1",
  },
  {
    id: "extreme-0b72e4",
    model: "AirPort Extreme",
    label: "AirPort Extreme 0b72e4",
    serial: "C86K91T7FJ1R",
    version: "7.9.1",
  },
];

/** The words for a status, as the popovers and the node's accessible name say them. */
export function statusWords(status: AirPortStatus): string {
  if (status === "available") return "Connected";
  if (status === "partially-available") return "Needs attention";
  return "Not connected";
}

/** The sheet's fields as it opens for a device: the names it proposes and no password. */
export function proposeSetup(device: AirPortNearbyDevice): AirPortSetup {
  return { network: "Home Network", name: device.model, password: "", verify: "" };
}

/**
 * What keeps a setup from being finished, in the order the sheet's fields have, or `undefined`
 * when nothing does.
 */
export function setupProblem(setup: AirPortSetup): string | undefined {
  if (setup.network.trim() === "") return "Enter a network name.";
  if (setup.name.trim() === "") return "Enter a base station name.";
  if (setup.password.length < PASSWORD_LENGTH) {
    return `The password must be at least ${PASSWORD_LENGTH} characters.`;
  }
  if (setup.password !== setup.verify) return "The passwords do not match.";
  return undefined;
}

/** The first address of 10.0.1.x after the router's that no base station has. */
export function nextAddress(stations: readonly AirPortBaseStation[]): string {
  const taken = new Set(stations.map((station) => station.address));
  let host = 2;
  while (taken.has(`10.0.1.${host}`)) host += 1;
  return `10.0.1.${host}`;
}

/**
 * Sets a nearby device up as a base station of the network. A setup that is not complete, and
 * a device that is a base station already, leave the list as it is.
 */
export function setUp(
  stations: readonly AirPortBaseStation[],
  device: AirPortNearbyDevice,
  setup: AirPortSetup,
): AirPortBaseStation[] {
  if (setupProblem(setup) !== undefined) return [...stations];
  if (stations.some((station) => station.id === device.id)) return [...stations];
  return [
    ...stations,
    {
      id: device.id,
      name: setup.name.trim(),
      model: device.model,
      network: setup.network.trim(),
      address: nextAddress(stations),
      serial: device.serial,
      version: device.version,
      status: "available",
    },
  ];
}

/** Gives a base station another name. An empty name, or an unknown id, changes nothing. */
export function renameStation(
  stations: readonly AirPortBaseStation[],
  id: string,
  name: string,
): AirPortBaseStation[] {
  const next = name.trim();
  return stations.map((station) =>
    station.id === id && next !== "" ? { ...station, name: next } : station,
  );
}

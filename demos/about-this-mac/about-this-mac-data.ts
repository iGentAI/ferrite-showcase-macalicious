/** The five tabs of the title bar, in order. */
export const ABOUT_THIS_MAC_TABS = [
  // The widths are the segments of the capture (row y=424 of Light-About-This-Mac, dividers at
  // x=1500, 1627, 1751 and 1877), as the library's own comparison of the window sets them.
  { id: "overview", title: "Overview", width: 69 },
  { id: "displays", title: "Displays", width: 64 },
  { id: "storage", title: "Storage", width: 62 },
  { id: "support", title: "Support", width: 63 },
  { id: "service", title: "Service", width: 59 },
] as const;

/** The id of a tab. */
export type AboutThisMacTab = (typeof ABOUT_THIS_MAC_TABS)[number]["id"];

/** The tab an id names: Overview for an id that names none. */
export function resolveTab(id: unknown): AboutThisMacTab {
  return ABOUT_THIS_MAC_TABS.find((tab) => tab.id === id)?.id ?? "overview";
}

/** What the Overview pane says about the computer. An empty value leaves its line out. */
export interface AboutThisMacInfo {
  /** The product, set in bold at the start of the title. */
  systemName: string;
  /** The release, set light after the product. */
  releaseName: string;
  /** The version after the word "Version". */
  version: string;
  /** The model: a bold line of its own. */
  model: string;
  /** The Processor line. */
  processor: string;
  /** The Memory line. */
  memory: string;
  /** The Startup Disk line. */
  startupDisk: string;
  /** The Graphics line. */
  graphics: string;
  /** The Serial Number line: the label stays when the value is empty, as in the light capture. */
  serialNumber: string;
  /** The legal text of the footer, before the License Agreement link. */
  copyright: string;
}

/** The Overview of the light capture, which shows no serial number. */
export const defaultInfo: AboutThisMacInfo = {
  systemName: "macOS",
  releaseName: "Catalina",
  version: "10.15 Beta (19A582a)",
  model: "MacBook Pro (15-inch, 2019)",
  processor: "2.3 GHz 8-Core Intel Core i9",
  memory: "16 GB 2400 MHz DDR4",
  startupDisk: "Macintosh SSD",
  graphics: "Intel UHD Graphics 630 1536 MB",
  serialNumber: "",
  copyright: "™ and © 1983-2019 Apple Inc. All Rights Reserved.",
};

/** The Overview of the dark capture: the same computer with its serial number shown. */
export const darkCaptureInfo: AboutThisMacInfo = { ...defaultInfo, serialNumber: "C02YM33BLVCJ" };

/** The rows under the model, in order: the label and the fact it shows. */
export const ABOUT_THIS_MAC_DETAILS = [
  ["Processor", "processor"],
  ["Memory", "memory"],
  ["Startup Disk", "startupDisk"],
  ["Graphics", "graphics"],
  ["Serial Number", "serialNumber"],
] as const satisfies readonly (readonly [string, keyof AboutThisMacInfo])[];

/** A display of the Displays pane. */
export interface AboutThisMacDisplay {
  /** Identifies the display. */
  id: string;
  /** Its name. */
  name: string;
  /** Its diagonal and resolution. */
  size: string;
  /** The graphics card that drives it. */
  graphics?: string;
}

/** The built-in display of the computer the captures show. Invented: no capture shows the pane. */
export const defaultDisplays: readonly AboutThisMacDisplay[] = [
  {
    id: "built-in",
    name: "Built-in Retina Display",
    size: "15.4-inch (2880 × 1800)",
    graphics: "Intel UHD Graphics 630 1536 MB graphics",
  },
];

/** One kind of content in the legend of the Storage pane. */
export interface AboutThisMacStorageCategory {
  /** Identifies the category. */
  id: string;
  /** Its name. */
  name: string;
  /** What it takes, in bytes. */
  size: number;
}

/** The startup disk of the Storage pane. Sizes are bytes; a gigabyte is 1000³, as in macOS. */
export interface AboutThisMacVolume {
  /** The volume's name. */
  name: string;
  /** The line under its icon: capacity and medium. */
  kind: string;
  /** Its capacity. */
  capacity: number;
  /** What is free. */
  available: number;
  /**
   * What takes the rest, by kind of content. What is in use and no category accounts for is
   * listed after them as "Uncategorized" (`uncategorizedSize`).
   */
  categories: readonly AboutThisMacStorageCategory[];
}

const GB = 1e9;
const MB = 1e6;

/**
 * The startup disk as the Storage Management capture of the same computer describes it:
 * 195.81 GB available of 249.85 GB, and the categories of its sidebar. The sidebar accounts
 * for 35.92 GB of the 54.04 GB in use; the Storage pane lists the rest as "Uncategorized".
 */
export const defaultVolume: AboutThisMacVolume = {
  name: "Macintosh SSD",
  kind: "250 GB Flash Storage",
  capacity: 249.85 * GB,
  available: 195.81 * GB,
  categories: [
    { id: "documents", name: "Documents", size: 6.92 * GB },
    { id: "icloud-drive", name: "iCloud Drive", size: 3.6 * MB },
    { id: "music", name: "Music", size: 58.4 * MB },
    { id: "photos", name: "Photos", size: 256.3 * MB },
    { id: "tv", name: "TV", size: 6 * GB },
    { id: "system", name: "System", size: 16.36 * GB },
    { id: "other", name: "Other", size: 6.32 * GB },
  ],
};

const UNITS = [
  ["KB", 1e3, 0],
  ["MB", 1e6, 1],
  ["GB", 1e9, 2],
  ["TB", 1e12, 2],
] as const;

/**
 * A size as macOS writes it: decimal units, two decimals from a gigabyte up, one for megabytes
 * and none below, without trailing zeros ("249.85 GB", "3.6 MB", "6 GB"). Nothing, a negative
 * size and a value that is not a number are "Zero KB".
 */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0.5) return "Zero KB";
  if (bytes < 999.5) return `${Math.round(bytes)} bytes`;
  for (const [unit, scale, decimals] of UNITS) {
    const value = Number((bytes / scale).toFixed(decimals));
    // A value that rounds up to a thousand is written in the next unit: "1 GB", not "1000 MB".
    if (value < 1000 || unit === "TB") return `${value} ${unit}`;
  }
  return "Zero KB";
}

const amount = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

/** The bytes of a volume that are in use: nothing below zero, nothing above its capacity. */
export function usedSize(volume: Pick<AboutThisMacVolume, "capacity" | "available">): number {
  const capacity = amount(volume.capacity);
  return Math.max(0, capacity - Math.min(amount(volume.available), capacity));
}

/**
 * The bytes in use that no category accounts for: nothing when the categories cover what is
 * in use, or claim more.
 */
export function uncategorizedSize(volume: AboutThisMacVolume): number {
  const listed = volume.categories.reduce((sum, category) => sum + amount(category.size), 0);
  const rest = usedSize(volume) - listed;
  // Less than half a byte is the rounding of the sum, not content.
  return rest >= 0.5 ? rest : 0;
}

/** The line under the volume's name: "195.81 GB available of 249.85 GB". */
export function availability(volume: Pick<AboutThisMacVolume, "capacity" | "available">): string {
  const capacity = amount(volume.capacity);
  return `${formatSize(capacity - usedSize(volume))} available of ${formatSize(capacity)}`;
}

/** A link of the Support or the Service pane. */
export interface AboutThisMacLink {
  /** What a host's `onLink` is called with. */
  id: string;
  /** The link's text. */
  title: string;
}

/** A headed group of links, with an optional paragraph before them. */
export interface AboutThisMacLinkSection {
  /** The bold heading. */
  heading: string;
  /** A paragraph under the heading. */
  description?: string;
  /** The links, one per line. */
  links: readonly AboutThisMacLink[];
}

/** The Support pane. No capture shows it: the headings and links are stand-in wording. */
export const supportSections: readonly AboutThisMacLinkSection[] = [
  {
    heading: "macOS Resources",
    links: [
      { id: "macos-help", title: "macOS Help" },
      { id: "macos-support", title: "macOS Support" },
    ],
  },
  {
    heading: "Macintosh Resources",
    links: [
      { id: "user-manual", title: "User Manual" },
      { id: "specifications", title: "Specifications" },
      { id: "hardware-support", title: "Hardware Support" },
      { id: "important-information", title: "Important Information…" },
    ],
  },
];

/** The Service pane. No capture shows it: the text and links are stand-in wording. */
export const serviceSections: readonly AboutThisMacLinkSection[] = [
  {
    heading: "Service and Support Coverage",
    description:
      "This computer may be covered by a limited warranty or by a service plan. Coverage is checked with the serial number of the Overview pane.",
    links: [{ id: "coverage-status", title: "Check my service and support coverage status…" }],
  },
  {
    heading: "Repairs",
    description: "Service is available from the manufacturer and from authorised providers.",
    links: [
      { id: "repair-options", title: "Check my repair options…" },
      { id: "service-plans", title: "Learn more about service plans…" },
    ],
  },
];

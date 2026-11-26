import type { OutlineViewItem } from "macalicious/outline-view";

/** A headed block of a report: label and value lines under a bold heading. */
export interface SystemInformationSection {
  /** The heading, without its colon. */
  heading: string;
  /** The lines: a label, and a value that may be empty. */
  entries: readonly (readonly [label: string, value: string])[];
}

/**
 * A column of a report that lists things in a table. The first column names the row: its text
 * is the row's label for type-select and in the path at the bottom of the window.
 */
export interface SystemInformationColumn {
  id: string;
  title: string;
  /** Width in points; the column without one takes the rest. */
  width?: number;
  /** A date column holds `YYYY-MM-DDTHH:MM` and sorts by time. */
  kind?: "text" | "date";
}

/** A row of such a report, and the details shown under the table while it is selected. */
export interface SystemInformationRow {
  id: string;
  /** Text by column id. */
  cells: Readonly<Record<string, string>>;
  sections: readonly SystemInformationSection[];
}

/** What the report pane shows for a category. */
export type SystemInformationReport =
  | { kind: "properties"; sections: readonly SystemInformationSection[] }
  | {
      kind: "table";
      columns: readonly SystemInformationColumn[];
      rows: readonly SystemInformationRow[];
    }
  | { kind: "empty"; message: string };

/** A category of the outline; its `children` are categories too. */
export interface SystemInformationItem extends OutlineViewItem {
  id: string;
  name: string;
  report: SystemInformationReport;
}

/** The order of a table report: a column and a direction. */
export interface SystemInformationSort {
  column: string;
  direction: "ascending" | "descending";
}

const properties = (...sections: readonly SystemInformationSection[]): SystemInformationReport => ({
  kind: "properties",
  sections,
});

const section = (
  heading: string,
  ...entries: readonly (readonly [string, string])[]
): SystemInformationSection => ({ heading, entries });

const NOTHING: SystemInformationReport = { kind: "empty", message: "No information found." };

const leaf = (
  group: string,
  name: string,
  report: SystemInformationReport = NOTHING,
): SystemInformationItem => ({
  id: `${group}/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  name,
  report,
});

/** `2019-09-29T18:20` as System Information writes it: `9/29/19, 6:20 PM`. */
export function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year = "", month, day, hours, minutes] = match;
  const hour = Number(hours);
  return `${Number(month)}/${Number(day)}/${year.slice(2)}, ${hour % 12 || 12}:${minutes} ${hour < 12 ? "AM" : "PM"}`;
}

/** The text a cell shows. */
export function cellText(column: SystemInformationColumn, row: SystemInformationRow): string {
  const value = row.cells[column.id] ?? "";
  return column.kind === "date" ? formatDate(value) : value;
}

/**
 * A report as text, for Copy, Save and Print: headed lines, a table's rows tab separated under its
 * column titles, each row's details after them.
 */
export function reportAsText(item: SystemInformationItem): string {
  const report = item.report;
  const sections = (list: readonly SystemInformationSection[]) =>
    list.flatMap((section) => [
      `${section.heading}:`,
      ...section.entries.map(([name, value]) => `  ${name}: ${value}`),
      "",
    ]);
  const lines =
    report.kind === "empty"
      ? [report.message]
      : report.kind === "properties"
        ? sections(report.sections)
        : [
            report.columns.map((column) => column.title).join("\t"),
            ...report.rows.map((row) =>
              report.columns.map((column) => cellText(column, row)).join("\t"),
            ),
            "",
            ...report.rows.flatMap((row) => sections(row.sections ?? [])),
          ];
  return [item.name, "", ...lines].join("\n").trimEnd();
}

/** Rows as tab-separated lines under the column titles, in the order given. */
export function rowsAsText(
  columns: readonly SystemInformationColumn[],
  rows: readonly SystemInformationRow[],
): string {
  return [
    columns.map((column) => column.title).join("\t"),
    ...rows.map((row) => columns.map((column) => cellText(column, row)).join("\t")),
  ].join("\n");
}

/** A row's label: the text of its first column. */
export function rowLabel(
  columns: readonly SystemInformationColumn[],
  row: SystemInformationRow,
): string {
  const first = columns[0];
  return first ? cellText(first, row) : "";
}

/**
 * The rows in the order of a sort. Text is compared without regard to case and with its
 * numbers as numbers (10.15 after 10.9); dates by time. Rows that compare equal keep their
 * order, in both directions.
 */
export function sortRows(
  rows: readonly SystemInformationRow[],
  columns: readonly SystemInformationColumn[],
  sort: SystemInformationSort | undefined,
): readonly SystemInformationRow[] {
  const column = columns.find((candidate) => candidate.id === sort?.column);
  if (!sort || !column) return rows;
  const sign = sort.direction === "descending" ? -1 : 1;
  const compare = (a: string, b: string) =>
    column.kind === "date"
      ? a < b
        ? -1
        : a > b
          ? 1
          : 0
      : a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
  return [...rows].sort(
    (a, b) => sign * compare(a.cells[column.id] ?? "", b.cells[column.id] ?? ""),
  );
}

/** The categories from the top level down to the one with `id`; empty when there is none. */
export function pathTo(
  items: readonly SystemInformationItem[],
  id: string,
): readonly SystemInformationItem[] {
  for (const item of items) {
    if (item.id === id) return [item];
    const below = pathTo(item.children ?? [], id);
    if (below.length > 0) return [item, ...below];
  }
  return [];
}

const flatten = (items: readonly SystemInformationItem[]): readonly SystemInformationItem[] =>
  items.flatMap((item) => [item, ...flatten(item.children ?? [])]);

/**
 * The next category after `from`, going round, whose name or report holds `query` in any letter case.
 * `from` itself is the last one tried, so a word only it holds is found again.
 */
export function findCategory(
  items: readonly SystemInformationItem[],
  query: string,
  from: string,
): SystemInformationItem | undefined {
  const needle = query.trim().toLowerCase();
  if (needle === "") return undefined;
  const all = flatten(items);
  const start = all.findIndex((item) => item.id === from);
  for (let step = 1; step <= all.length; step += 1) {
    const item = all[(start + step) % all.length] as SystemInformationItem;
    if (`${item.name}\n${reportAsText(item)}`.toLowerCase().includes(needle)) return item;
  }
  return undefined;
}

const APPLICATION_COLUMNS: readonly SystemInformationColumn[] = [
  { id: "name", title: "Application Name" },
  { id: "version", title: "Version", width: 70 },
  { id: "source", title: "Obtained from", width: 100 },
  { id: "modified", title: "Last Modified", width: 120, kind: "date" },
  { id: "bits", title: "64-Bit (Intel)", width: 80 },
];

const application = (
  name: string,
  version: string,
  modified: string,
  folder = "/System/Applications",
  source = "Apple",
): SystemInformationRow => ({
  id: name,
  cells: { name, version, source, modified, bits: "Yes" },
  sections: [
    section(
      name,
      ["Version", version],
      ["Obtained from", source],
      ["Last Modified", formatDate(modified)],
      ["Kind", "Intel"],
      ["64-Bit (Intel)", "Yes"],
      [
        "Signed by",
        source === "Apple"
          ? "Software Signing, Apple Code Signing Certification Authority, Apple Root CA"
          : "Developer ID Application: Example Software",
      ],
      ["Location", `${folder}/${name}.app`],
    ),
  ],
});

const APPLICATIONS: readonly SystemInformationRow[] = [
  application("Activity Monitor", "10.14", "2019-09-29T18:20", "/System/Applications/Utilities"),
  application("Calculator", "10.15", "2019-09-29T18:20"),
  application("Calendar", "11.0", "2019-09-29T18:21"),
  application("Console", "1.1", "2019-09-29T18:20", "/System/Applications/Utilities"),
  application("Finder", "10.15", "2019-09-28T09:12", "/System/Library/CoreServices"),
  application("Keychain Access", "10.5", "2019-09-29T18:20", "/System/Applications/Utilities"),
  application("Mail", "13.0", "2019-09-29T18:22"),
  application("Music", "1.0", "2019-09-29T18:22"),
  application("Notes", "4.7", "2019-09-29T18:21"),
  application("Outliner", "3.2.1", "2019-08-14T11:05", "/Applications", "Identified Developer"),
  application("Podcasts", "1.0", "2019-09-29T18:22"),
  application("Reminders", "7.0", "2019-09-29T18:21"),
  application("Stickies", "10.2", "2019-09-29T18:20"),
  application("System Information", "10.15", "2019-09-29T18:20", "/System/Applications/Utilities"),
  application("System Preferences", "14.0", "2019-09-29T18:23"),
  application("TextEdit", "1.15", "2019-09-29T18:20"),
  application("Typesetter", "9.4", "2018-11-02T16:40", "/Applications", "Identified Developer"),
];

const EXTENSION_COLUMNS: readonly SystemInformationColumn[] = [
  { id: "name", title: "Extension Name" },
  { id: "version", title: "Version", width: 70 },
  { id: "modified", title: "Last Modified", width: 120, kind: "date" },
  { id: "loaded", title: "Loaded", width: 60 },
  { id: "source", title: "Obtained from", width: 100 },
];

const extension = (
  name: string,
  version: string,
  modified: string,
  loaded: "Yes" | "No",
): SystemInformationRow => ({
  id: name,
  cells: { name, version, modified, loaded, source: "Apple" },
  sections: [
    section(
      name,
      ["Version", version],
      ["Last Modified", formatDate(modified)],
      ["Bundle ID", `com.example.kext.${name}`],
      ["Loaded", loaded],
      ["Obtained from", "Apple"],
      ["Kind", "Intel"],
      ["Architectures", "x86_64"],
      ["64-Bit (Intel)", "Yes"],
      ["Location", `/System/Library/Extensions/${name}.kext`],
      ["Loadable", "Yes"],
      ["Dependencies", "Satisfied"],
    ),
  ],
});

const EXTENSIONS: readonly SystemInformationRow[] = [
  extension("AudioBridge", "3.5.3", "2019-09-28T22:14", "Yes"),
  extension("BacklightControl", "530.14", "2019-09-28T22:10", "Yes"),
  extension("CardReaderPort", "1.2.9", "2019-09-28T22:11", "No"),
  extension("DisplayPolicy", "5.1.16", "2019-09-28T22:15", "Yes"),
  extension("FireWirePort", "4.7.5", "2019-09-28T22:09", "No"),
  extension("KeyboardBacklight", "208.50", "2019-09-28T22:12", "Yes"),
  extension("LidSensor", "1.0.2", "2019-09-28T22:12", "Yes"),
  extension("SerialModem", "2.6.7", "2019-08-24T03:51", "No"),
  extension("ThermalMonitor", "3.1.9", "2019-09-28T22:16", "Yes"),
  extension("TrackpadDriver", "300.17", "2019-09-28T22:13", "Yes"),
];

const INSTALLATION_COLUMNS: readonly SystemInformationColumn[] = [
  { id: "name", title: "Software Name" },
  { id: "version", title: "Version", width: 80 },
  { id: "source", title: "Source", width: 110 },
  { id: "installed", title: "Install Date", width: 120, kind: "date" },
];

const installation = (
  name: string,
  version: string,
  source: string,
  installed: string,
): SystemInformationRow => ({
  id: `${name} ${version}`,
  cells: { name, version, source, installed },
  sections: [
    section(
      name,
      ["Version", version],
      ["Source", source],
      ["Install Date", formatDate(installed)],
    ),
  ],
});

const INSTALLATIONS: readonly SystemInformationRow[] = [
  installation("macOS 10.15", "10.15", "Apple", "2019-09-29T18:14"),
  installation("Gatekeeper Configuration Data", "181", "Apple", "2019-09-30T07:02"),
  installation("Outliner", "3.2.1", "Identified Developer", "2019-08-14T11:05"),
  installation("Typesetter", "9.4", "Identified Developer", "2018-11-02T16:40"),
  installation("Command Line Tools", "11.0", "Apple", "2019-10-01T09:30"),
  installation("Printer Software Update", "5.1", "3rd Party", "2019-07-03T13:27"),
];

/**
 * The categories of a MacBook Pro's report. The Hardware overview is the one of the reference
 * screenshots, which differ in the firmware's last part only; every other report is invented.
 */
export function createItems(bridgeVersion = "17.16.10569.5.1,0"): readonly SystemInformationItem[] {
  const hardware = (name: string, report?: SystemInformationReport) =>
    leaf("hardware", name, report);
  const network = (name: string, report?: SystemInformationReport) => leaf("network", name, report);
  const software = (name: string, report?: SystemInformationReport) =>
    leaf("software", name, report);
  return [
    {
      id: "hardware",
      name: "Hardware",
      report: properties(
        section(
          "Hardware Overview",
          ["Model Name", "MacBook Pro"],
          ["Model Identifier", "MacBookPro15,1"],
          ["Processor Name", "8-Core Intel Core i9"],
          ["Processor Speed", "2.3 GHz"],
          ["Number of Processors", "1"],
          ["Total Number of Cores", "8"],
          ["L2 Cache (per Core)", "256 KB"],
          ["L3 Cache", "16 MB"],
          ["Hyper-Threading Technology", "Enabled"],
          ["Memory", "16 GB"],
          ["Boot ROM Version", `1037.0.78.0.0 (iBridge: ${bridgeVersion})`],
          ["Serial Number (system)", ""],
          ["Hardware UUID", ""],
          ["Activation Lock Status", "Enabled"],
        ),
      ),
      children: [
        hardware("ATA"),
        hardware(
          "Apple Pay",
          properties(
            section(
              "Apple Pay Information",
              ["Platform ID", "J680"],
              ["Hardware", "0x00000042"],
              ["Firmware", "0x0260"],
              ["JCOP OS", "4.07"],
            ),
          ),
        ),
        hardware(
          "Audio",
          properties(
            section("Devices"),
            section(
              "MacBook Pro Microphone",
              ["Default Input Device", "Yes"],
              ["Input Channels", "1"],
              ["Manufacturer", "Apple Inc."],
              ["Current SampleRate", "48000"],
              ["Transport", "Built-in"],
            ),
            section(
              "MacBook Pro Speakers",
              ["Default Output Device", "Yes"],
              ["Default System Output Device", "Yes"],
              ["Manufacturer", "Apple Inc."],
              ["Output Channels", "2"],
              ["Current SampleRate", "48000"],
              ["Transport", "Built-in"],
            ),
          ),
        ),
        hardware(
          "Bluetooth",
          properties(
            section(
              "Hardware, Features, and Settings",
              ["Name", "ismh15"],
              ["Bluetooth Low Energy Supported", "Yes"],
              ["Handoff Supported", "Yes"],
              ["Instant Hot Spot Supported", "Yes"],
              ["Manufacturer", "Broadcom"],
              ["Transport", "UART"],
              ["Bluetooth Power", "On"],
              ["Discoverable", "Off"],
              ["Connectable", "Yes"],
            ),
          ),
        ),
        hardware(
          "Camera",
          properties(section("FaceTime HD Camera (Built-in)", ["Model ID", "UVC Camera"])),
        ),
        hardware("Card Reader"),
        hardware(
          "Controller",
          properties(
            section(
              "Controller Information",
              ["Model Name", "Apple T2 Security Chip"],
              ["Firmware Version", bridgeVersion],
              ["Boot UUID", ""],
            ),
          ),
        ),
        hardware(
          "Diagnostics",
          properties(
            section("Power On Self-Test", ["Last Run", "10/3/19, 8:52 AM"], ["Result", "Passed"]),
          ),
        ),
        hardware("Disc Burning"),
        hardware("Ethernet Cards"),
        hardware("Fibre Channel"),
        hardware("FireWire"),
        hardware(
          "Graphics/Displays",
          properties(
            section(
              "Intel UHD Graphics 630",
              ["Chipset Model", "Intel UHD Graphics 630"],
              ["Type", "GPU"],
              ["Bus", "Built-In"],
              ["VRAM (Dynamic, Max)", "1536 MB"],
              ["Vendor", "Intel"],
              ["Automatic Graphics Switching", "Supported"],
              ["Metal", "Supported, feature set macOS GPUFamily2 v1"],
            ),
            section(
              "Color LCD",
              ["Display Type", "Built-In Retina LCD"],
              ["Resolution", "2880 x 1800 Retina"],
              ["Framebuffer Depth", "24-Bit Color (ARGB8888)"],
              ["Main Display", "Yes"],
              ["Mirror", "Off"],
              ["Online", "Yes"],
              ["Automatically Adjust Brightness", "No"],
              ["Connection Type", "Internal"],
            ),
          ),
        ),
        hardware(
          "Memory",
          properties(
            section("Memory Slots", ["ECC", "Disabled"], ["Upgradeable Memory", "No"]),
            section(
              "BANK 0/ChannelA-DIMM0",
              ["Size", "8 GB"],
              ["Type", "DDR4"],
              ["Speed", "2400 MHz"],
              ["Status", "OK"],
            ),
            section(
              "BANK 2/ChannelB-DIMM0",
              ["Size", "8 GB"],
              ["Type", "DDR4"],
              ["Speed", "2400 MHz"],
              ["Status", "OK"],
            ),
          ),
        ),
        hardware(
          "NVMExpress",
          properties(
            section(
              "Apple SSD Controller",
              ["Capacity", "500.28 GB (500,277,792,768 bytes)"],
              ["TRIM Support", "Yes"],
              ["Model", "APPLE SSD AP0512M"],
              ["Link Width", "x4"],
              ["Link Speed", "8.0 GT/s"],
              ["Detachable Drive", "No"],
              ["BSD Name", "disk0"],
              ["Partition Map Type", "GPT (GUID Partition Table)"],
              ["Removable Media", "No"],
              ["S.M.A.R.T. status", "Verified"],
            ),
          ),
        ),
        hardware("PCI"),
        hardware("Parallel SCSI"),
        hardware(
          "Power",
          properties(
            section(
              "Battery Information",
              ["Fully Charged", "No"],
              ["Charging", "Yes"],
              ["Full Charge Capacity (mAh)", "7119"],
              ["Charge Remaining (mAh)", "5980"],
              ["Cycle Count", "41"],
              ["Condition", "Normal"],
            ),
            section(
              "AC Charger Information",
              ["Connected", "Yes"],
              ["Wattage (W)", "86"],
              ["Charging", "Yes"],
            ),
          ),
        ),
        hardware("Printers"),
        hardware("SAS"),
        hardware("SATA/SATA Express"),
        hardware("SPI"),
        hardware(
          "Storage",
          properties(
            section(
              "Macintosh HD",
              ["Available", "402.31 GB (402,306,371,584 bytes)"],
              ["Capacity", "499.96 GB (499,963,174,912 bytes)"],
              ["Mount Point", "/"],
              ["File System", "APFS"],
              ["Writable", "No"],
              ["Ignore Ownership", "No"],
              ["BSD Name", "disk1s5"],
            ),
            section(
              "Physical Drive",
              ["Device Name", "APPLE SSD AP0512M"],
              ["Media Name", "AppleAPFSMedia"],
              ["Medium Type", "SSD"],
              ["Protocol", "PCI-Express"],
              ["Internal", "Yes"],
              ["Partition Map Type", "Unknown"],
              ["S.M.A.R.T. Status", "Verified"],
            ),
          ),
        ),
        hardware(
          "Thunderbolt",
          properties(
            section(
              "Thunderbolt Bus 0",
              ["Vendor Name", "Apple Inc."],
              ["Device Name", "MacBook Pro"],
              ["Route String", "0"],
              ["Firmware Version", "33.1"],
              ["Port (Upstream)", "No device connected"],
              ["Link Status", "0x7"],
              ["Speed", "Up to 40 Gb/s x1"],
            ),
          ),
        ),
        hardware(
          "USB",
          properties(
            section("USB 3.1 Bus", ["Host Controller Driver", "AppleUSBXHCISPT"]),
            section(
              "Apple T2 Bus",
              ["Host Controller Driver", "AppleUSBVHCIBCE"],
              ["Touch Bar Backlight", "Built-in"],
              ["Touch Bar Display", "Built-in"],
              ["Ambient Light Sensor", "Built-in"],
              ["FaceTime HD Camera (Built-in)", "Built-in"],
            ),
          ),
        ),
      ],
    },
    {
      id: "network",
      name: "Network",
      report: properties(
        section(
          "Wi-Fi",
          ["Type", "AirPort"],
          ["Hardware", "AirPort"],
          ["BSD Device Name", "en0"],
          ["IPv4 Addresses", "192.168.1.24"],
          ["IPv4 Configuration Method", "DHCP"],
          ["IPv4 Router", "192.168.1.1"],
          ["DNS Server Addresses", "192.168.1.1"],
          ["Proxies Exceptions List", "*.local, 169.254/16"],
        ),
        section(
          "Thunderbolt Bridge",
          ["Type", "Ethernet"],
          ["Hardware", "Ethernet"],
          ["BSD Device Name", "bridge0"],
          ["IPv4 Configuration Method", "DHCP"],
        ),
      ),
      children: [
        network(
          "Firewall",
          properties(
            section(
              "Firewall Settings",
              ["Mode", "Allow all incoming connections"],
              ["Firewall Logging", "No"],
              ["Stealth Mode", "No"],
            ),
          ),
        ),
        network(
          "Locations",
          properties(
            section("Automatic", ["Active Location", "Yes"]),
            section(
              "Wi-Fi",
              ["Type", "IEEE80211"],
              ["BSD Device Name", "en0"],
              ["IPv4 Configuration Method", "DHCP"],
              ["IPv6 Configuration Method", "Automatic"],
            ),
          ),
        ),
        network("Volumes"),
        network("WWAN"),
        network(
          "Wi-Fi",
          properties(
            section(
              "Software Versions",
              ["CoreWLAN", "13.0 (1450.6)"],
              ["Menu Extra", "13.0 (1455.3)"],
              ["System Information", "12.0 (1300.2)"],
              ["IO80211 Family", "12.0 (1200.12.2b1)"],
            ),
            section(
              "en0",
              ["Card Type", "AirPort Extreme"],
              ["Supported PHY Modes", "802.11 a/b/g/n/ac"],
              ["Country Code", "US"],
              ["AirDrop", "Supported"],
              ["Auto Unlock", "Supported"],
              ["Status", "Connected"],
            ),
          ),
        ),
      ],
    },
    {
      id: "software",
      name: "Software",
      report: properties(
        section(
          "System Software Overview",
          ["System Version", "macOS 10.15 (19A583)"],
          ["Kernel Version", "Darwin 19.0.0"],
          ["Boot Volume", "Macintosh HD"],
          ["Boot Mode", "Normal"],
          ["Computer Name", "ismh15"],
          ["User Name", "ismh"],
          ["Secure Virtual Memory", "Enabled"],
          ["System Integrity Protection", "Enabled"],
          ["Time since boot", "1 day 6:12"],
        ),
      ),
      children: [
        software("Accessibility"),
        software("Applications", {
          kind: "table",
          columns: APPLICATION_COLUMNS,
          rows: APPLICATIONS,
        }),
        software("Developer"),
        software("Disabled Software"),
        software("Extensions", { kind: "table", columns: EXTENSION_COLUMNS, rows: EXTENSIONS }),
        software("Fonts"),
        software("Frameworks"),
        software("Installations", {
          kind: "table",
          columns: INSTALLATION_COLUMNS,
          rows: INSTALLATIONS,
        }),
        software("Legacy Software"),
        software("Logs"),
        software("Managed Client"),
        software("Preference Panes"),
        software("Printer Software"),
        software("Profiles"),
        software("Raw Support"),
        software("SmartCards"),
        software("Startup Items"),
        software("Sync Services"),
      ],
    },
  ];
}

/** The report of the light reference screenshot. */
export const defaultItems: readonly SystemInformationItem[] = createItems();

/** The report of the dark reference screenshot: a later firmware. */
export const darkCaptureItems: readonly SystemInformationItem[] = createItems("17.16.10571.5.1,0");

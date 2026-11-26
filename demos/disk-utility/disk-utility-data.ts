/**
 * The devices Disk Utility lists, and what its commands do to them. Everything here is plain
 * data and pure functions: no disk of the machine the page runs on is read or changed.
 */

/** An APFS volume. Sizes are in gigabytes (10^9 bytes), as Disk Utility prints them. */
export interface DiskUtilityVolume {
  /** Identifies the volume in the sidebar. */
  id: string;
  /** The volume's name. */
  name: string;
  /** The BSD device, such as `disk3s4`. */
  device: string;
  /** Space the volume's files take. */
  used: number;
  /** Space that can be freed on demand; it counts as available. */
  purgeable: number;
  /**
   * Space the volume holds beyond its files, such as snapshots: the capacity bar draws it as
   * used, the figures do not count it.
   * @default 0
   */
  reserved?: number;
  /**
   * The file system, after the bullet of the second line.
   * @default "APFS"
   */
  format?: string;
  /** Where the volume is mounted; `null` while it is not mounted. */
  mountPoint: string | null;
  /** Whether ownership is enforced on the volume. */
  owners: boolean;
  /** The system installed on the volume, as its third line: `macOS 10.15`. */
  system?: string;
  /** The volume the machine started from, or its data volume: it cannot be changed. */
  startup?: boolean;
}

/** An APFS container: the volumes in it share its space. */
export interface DiskUtilityContainer {
  /** Identifies the container in the sidebar. */
  id: string;
  /** The BSD device, such as `disk3`; the container is named after it. */
  device: string;
  /** The partition that holds the container, such as `disk2s2`. */
  store: string;
  /** The container's size. */
  capacity: number;
  /** Space no volume uses. */
  free: number;
  /** Volumes the sidebar does not list (Preboot, Recovery, VM); they count as sharing. */
  hiddenVolumes: number;
  /** The listed volumes. */
  volumes: readonly DiskUtilityVolume[];
}

/** A physical disk. */
export interface DiskUtilityDisk {
  /** Identifies the disk in the sidebar. */
  id: string;
  /** The disk's name, as its hardware reports it. */
  name: string;
  /** The BSD device, such as `disk2`. */
  device: string;
  /** The sidebar section the disk is listed in. */
  location: "internal" | "external";
  /** How the disk is connected. */
  connection: string;
  /** The disk's size. */
  capacity: number;
  /** The containers on the disk. */
  containers: readonly DiskUtilityContainer[];
}

/** What a sidebar row stands for, with the nodes above it. */
export type DiskUtilityTarget =
  | { kind: "disk"; id: string; disk: DiskUtilityDisk }
  | { kind: "container"; id: string; disk: DiskUtilityDisk; container: DiskUtilityContainer }
  | {
      kind: "volume";
      id: string;
      disk: DiskUtilityDisk;
      container: DiskUtilityContainer;
      volume: DiskUtilityVolume;
    };

/**
 * The devices of the Aqua screenshot. The names, the sizes of the selected volume and its
 * container, and the device identifiers `disk3` and `disk3s4` are the capture's; every other
 * number is invented.
 */
export const defaultDisks: readonly DiskUtilityDisk[] = [
  {
    id: "apple-ssd",
    name: "APPLE SSD AP0512M Media",
    device: "disk0",
    location: "internal",
    connection: "PCI-Express",
    capacity: 500.28,
    containers: [
      {
        id: "disk1",
        device: "disk1",
        store: "disk0s2",
        capacity: 499.96,
        free: 322.41,
        hiddenVolumes: 3,
        volumes: [
          {
            id: "macintosh-hd",
            name: "Macintosh HD",
            device: "disk1s5",
            used: 10.86,
            purgeable: 0,
            mountPoint: "/Volumes/Macintosh HD",
            owners: true,
            system: "macOS 10.15",
          },
          {
            id: "macintosh-hd-data",
            name: "Macintosh HD - Data",
            device: "disk1s1",
            used: 161.07,
            purgeable: 12.3,
            mountPoint: "/Volumes/Macintosh HD - Data",
            owners: true,
          },
        ],
      },
    ],
  },
  {
    id: "samsung-t3",
    name: "Samsung Portable SSD T3 Media",
    device: "disk2",
    location: "external",
    connection: "USB",
    capacity: 250.06,
    containers: [
      {
        id: "disk3",
        device: "disk3",
        store: "disk2s2",
        capacity: 249.85,
        free: 198.03,
        hiddenVolumes: 3,
        volumes: [
          {
            id: "macintosh-ssd",
            name: "Macintosh SSD",
            device: "disk3s4",
            used: 16.36,
            purgeable: 5.48,
            // The capture's bar is 46 of 600 pt wide: 19.15 GB of the container.
            reserved: 2.79,
            mountPoint: "/",
            owners: true,
            system: "macOS 10.15",
            startup: true,
          },
          {
            id: "macintosh-ssd-data",
            name: "Macintosh SSD - Data",
            device: "disk3s1",
            used: 21.52,
            purgeable: 5.48,
            mountPoint: "/System/Volumes/Data",
            owners: true,
            startup: true,
          },
          {
            id: "time-machine",
            name: "Time Machine",
            device: "disk3s6",
            used: 9.87,
            purgeable: 0,
            mountPoint: "/Volumes/Time Machine",
            owners: true,
          },
        ],
      },
    ],
  },
];

/**
 * The devices of the Dark Aqua screenshot: the same disks with less on the selected volume
 * (10.9 GB used, 191.72 GB free, 2.68 GB purgeable, and a bar 32 of 600 pt wide).
 */
export const darkCaptureDisks: readonly DiskUtilityDisk[] = defaultDisks.map((disk) => ({
  ...disk,
  containers: disk.containers.map((container) =>
    container.id === "disk3"
      ? {
          ...container,
          free: 191.72,
          volumes: container.volumes.map((volume) =>
            volume.id === "macintosh-ssd"
              ? { ...volume, used: 10.9, purgeable: 2.68, reserved: 2.43 }
              : volume,
          ),
        }
      : container,
  ),
}));

/** The file systems the Erase and Add Volume sheets offer. */
export const FORMATS = [
  "APFS",
  "APFS (Encrypted)",
  "APFS (Case-sensitive)",
  "APFS (Case-sensitive, Encrypted)",
] as const;

/** A size as Disk Utility prints it: `16.36 GB`, `10.9 GB`, `820 KB`, `Zero KB`. */
export function formatSize(gigabytes: number): string {
  if (!(gigabytes > 0)) return "Zero KB";
  const units = [
    ["TB", 1000],
    ["GB", 1],
    ["MB", 1e-3],
    ["KB", 1e-6],
  ] as const;
  const [unit, size] = units.find(([, each]) => gigabytes >= each) ?? units[3];
  const amount = gigabytes / size;
  // Two decimals at most and no trailing zeros; kilobytes are whole.
  const text =
    unit === "KB" ? String(Math.max(1, Math.round(amount))) : String(Number(amount.toFixed(2)));
  return `${text} ${unit}`;
}

/** The name a container goes by: `Container disk3`. */
export const containerName = (container: DiskUtilityContainer): string =>
  `Container ${container.device}`;

/** The row with this identifier and the nodes above it, or `undefined`. */
export function findTarget(
  disks: readonly DiskUtilityDisk[],
  id: string | null | undefined,
): DiskUtilityTarget | undefined {
  for (const disk of disks) {
    if (disk.id === id) return { kind: "disk", id: disk.id, disk };
    for (const container of disk.containers) {
      if (container.id === id) return { kind: "container", id: container.id, disk, container };
      for (const volume of container.volumes) {
        if (volume.id === id) return { kind: "volume", id: volume.id, disk, container, volume };
      }
    }
  }
  return undefined;
}

/** The name of what a row stands for. */
export function targetName(target: DiskUtilityTarget): string {
  if (target.kind === "volume") return target.volume.name;
  return target.kind === "container" ? containerName(target.container) : target.disk.name;
}

/** The volumes a row holds: the volume itself, or all of a container's or a disk's. */
export function targetVolumes(target: DiskUtilityTarget): readonly DiskUtilityVolume[] {
  if (target.kind === "volume") return [target.volume];
  if (target.kind === "container") return target.container.volumes;
  return target.disk.containers.flatMap((container) => container.volumes);
}

/** Whether a row is, or holds, a volume the machine started from. */
export const holdsStartupVolume = (target: DiskUtilityTarget): boolean =>
  targetVolumes(target).some((volume) => volume.startup === true);

/** How many volumes share a container's space, the hidden ones included. */
export const sharedBy = (container: DiskUtilityContainer): number =>
  container.volumes.length + container.hiddenVolumes;

/** What the toolbar may do with a row. */
export interface DiskUtilityAbilities {
  /** A volume can be added: the row is an APFS container or a volume in one, with room. */
  addVolume: boolean;
  /** The volume can be deleted: a volume the machine did not start from. */
  deleteVolume: boolean;
  /** First Aid can check it. */
  firstAid: boolean;
  /** It can be partitioned or given a volume. */
  partition: boolean;
  /** It can be erased: nothing the machine started from is on it. */
  erase: boolean;
  /** Another volume can be restored onto it. */
  restore: boolean;
  /** It can be mounted or unmounted. */
  mount: boolean;
}

/** What the toolbar may do with a row; nothing without one. */
export function abilities(target: DiskUtilityTarget | undefined): DiskUtilityAbilities {
  if (!target) {
    return {
      addVolume: false,
      deleteVolume: false,
      firstAid: false,
      partition: false,
      erase: false,
      restore: false,
      mount: false,
    };
  }
  const startup = holdsStartupVolume(target);
  const volume = target.kind === "volume";
  return {
    // A new volume needs room for its file system.
    addVolume: target.kind !== "disk" && target.container.free >= EMPTY_VOLUME_USED,
    deleteVolume: volume && !startup,
    firstAid: true,
    partition: true,
    erase: !startup,
    restore: volume && !startup,
    mount: volume && !startup,
  };
}

const mapContainers = (
  disks: readonly DiskUtilityDisk[],
  change: (container: DiskUtilityContainer) => DiskUtilityContainer,
): DiskUtilityDisk[] =>
  disks.map((disk) => {
    const containers = disk.containers.map(change);
    return containers.some((container, index) => container !== disk.containers[index])
      ? { ...disk, containers }
      : disk;
  });

/** The space a volume takes from its container: its files and what it holds beyond them. */
export const occupied = (volume: DiskUtilityVolume): number => volume.used + (volume.reserved ?? 0);

/**
 * The volumes Restore can copy onto a volume: every other volume whose space fits in what the
 * container has free once the destination's own space is given back.
 */
export function restoreSources(
  disks: readonly DiskUtilityDisk[],
  target: DiskUtilityTarget | undefined,
): DiskUtilityVolume[] {
  if (target?.kind !== "volume") return [];
  const room = target.container.free + occupied(target.volume);
  return disks
    .flatMap((disk) => disk.containers.flatMap((container) => container.volumes))
    .filter((candidate) => candidate.id !== target.id && occupied(candidate) <= room);
}

const mapVolume = (
  disks: readonly DiskUtilityDisk[],
  id: string,
  change: (volume: DiskUtilityVolume, container: DiskUtilityContainer) => DiskUtilityVolume,
): DiskUtilityDisk[] =>
  mapContainers(disks, (container) => {
    const before = container.volumes.find((volume) => volume.id === id);
    if (!before) return container;
    const after = change(before, container);
    if (after === before) return container;
    return {
      ...container,
      // What the volume gives up or takes comes out of the container's free space.
      free: Math.max(0, container.free + occupied(before) - occupied(after)),
      volumes: container.volumes.map((volume) => (volume === before ? after : volume)),
    };
  });

/** What a volume holds straight after it is made or erased: 820 KB of file system. */
export const EMPTY_VOLUME_USED = 0.00082;

/**
 * Adds an empty volume to a container. Its device takes the first slice number that is free,
 * and its identifier is derived from the device, so it is unique among the disks. A container
 * with less free space than an empty volume takes gets none: the disks come back unchanged
 * and `id` is `undefined`.
 */
export function addVolume(
  disks: readonly DiskUtilityDisk[],
  containerId: string,
  name: string,
  format: string = FORMATS[0],
): { disks: DiskUtilityDisk[]; id: string | undefined } {
  let id: string | undefined;
  const next = mapContainers(disks, (container) => {
    if (container.id !== containerId || container.free < EMPTY_VOLUME_USED) return container;
    const taken = new Set(container.volumes.map((volume) => volume.device));
    let slice = container.volumes.length + container.hiddenVolumes + 1;
    while (taken.has(`${container.device}s${slice}`)) slice += 1;
    const device = `${container.device}s${slice}`;
    id = `volume-${device}`;
    const volume: DiskUtilityVolume = {
      id,
      name: name.trim() || "Untitled",
      device,
      used: EMPTY_VOLUME_USED,
      purgeable: 0,
      mountPoint: `/Volumes/${name.trim() || "Untitled"}`,
      owners: true,
      format,
    };
    return {
      ...container,
      free: Math.max(0, container.free - volume.used),
      volumes: [...container.volumes, volume],
    };
  });
  return { disks: next, id };
}

/** Deletes a volume and returns its space to the container. Startup volumes stay. */
export function deleteVolume(disks: readonly DiskUtilityDisk[], id: string): DiskUtilityDisk[] {
  return mapContainers(disks, (container) => {
    const volume = container.volumes.find((candidate) => candidate.id === id);
    if (!volume || volume.startup) return container;
    return {
      ...container,
      free: container.free + occupied(volume),
      volumes: container.volumes.filter((candidate) => candidate !== volume),
    };
  });
}

/** Erases a volume: it is empty afterwards, mounted, and has the new name and format. */
export function eraseVolume(
  disks: readonly DiskUtilityDisk[],
  id: string,
  name: string,
  format: string = FORMATS[0],
): DiskUtilityDisk[] {
  return mapVolume(disks, id, (volume) => {
    if (volume.startup) return volume;
    const title = name.trim() || "Untitled";
    return {
      id: volume.id,
      device: volume.device,
      owners: volume.owners,
      name: title,
      used: EMPTY_VOLUME_USED,
      purgeable: 0,
      mountPoint: `/Volumes/${title}`,
      format,
    };
  });
}

/**
 * Restores one volume onto another: the destination takes the source's contents and name.
 * Nothing changes when the container has too little room for the copy (`restoreSources`
 * lists the volumes that fit).
 */
export function restoreVolume(
  disks: readonly DiskUtilityDisk[],
  id: string,
  sourceId: string,
): DiskUtilityDisk[] {
  const source = findTarget(disks, sourceId);
  if (source?.kind !== "volume" || source.id === id) return [...disks];
  return mapVolume(disks, id, (volume, container) => {
    if (volume.startup || occupied(source.volume) > container.free + occupied(volume)) {
      return volume;
    }
    return {
      ...volume,
      name: source.volume.name,
      used: source.volume.used,
      purgeable: source.volume.purgeable,
      reserved: source.volume.reserved,
      system: source.volume.system,
      mountPoint: volume.mountPoint === null ? null : `/Volumes/${source.volume.name}`,
    };
  });
}

/** Mounts or unmounts a volume. Startup volumes stay mounted. */
export function setMounted(
  disks: readonly DiskUtilityDisk[],
  id: string,
  mounted: boolean,
): DiskUtilityDisk[] {
  return mapVolume(disks, id, (volume) => {
    if (volume.startup || (volume.mountPoint !== null) === mounted) return volume;
    return { ...volume, mountPoint: mounted ? `/Volumes/${volume.name}` : null };
  });
}

/** One line of the information table or of the Info sheet. */
export interface DiskUtilityFact {
  label: string;
  value: string;
}

/** What the detail pane shows for a row. */
export interface DiskUtilitySummary {
  /** The large title. */
  name: string;
  /** The lines under it. */
  lines: readonly string[];
  /** The size in the outlined box. */
  capacity: string;
  /** The caption under the box, in capitals; absent for a disk. */
  caption?: string;
  /** The used share of the bar, from 0 to 1. */
  usedShare: number;
  /** The legend under the bar. */
  legend: readonly { key: "used" | "other" | "free"; label: string; value: string }[];
  /** The table's leading column, top to bottom. */
  leading: readonly DiskUtilityFact[];
  /** The table's trailing column. */
  trailing: readonly DiskUtilityFact[];
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** What the detail pane shows for a row. */
export function summarize(target: DiskUtilityTarget): DiskUtilitySummary {
  const { disk } = target;
  if (target.kind === "volume") {
    const { volume, container } = target;
    const purgeable = volume.purgeable > 0 ? ` (${formatSize(volume.purgeable)} purgeable)` : "";
    const count = sharedBy(container);
    return {
      name: volume.name,
      lines: [
        `APFS Volume • ${volume.format ?? FORMATS[0]}`,
        ...(volume.system ? [volume.system] : []),
      ],
      capacity: formatSize(container.capacity),
      caption: count === 1 ? "ONE VOLUME" : `SHARED BY ${count} VOLUMES`,
      usedShare: Math.min(1, (volume.used + (volume.reserved ?? 0)) / container.capacity),
      legend: [
        { key: "used", label: "Used", value: formatSize(volume.used) },
        // Disk Utility 10.15 prints two dashes here for a volume of a volume group.
        { key: "other", label: "Other Volumes", value: "--" },
        { key: "free", label: "Free", value: formatSize(container.free) },
      ],
      leading: [
        { label: "Mount Point:", value: volume.mountPoint ?? "Not Mounted" },
        { label: "Capacity:", value: formatSize(container.capacity) },
        {
          label: "Available:",
          value: `${formatSize(container.free + volume.purgeable)}${purgeable}`,
        },
        { label: "Used:", value: formatSize(volume.used) },
      ],
      trailing: [
        { label: "Type:", value: "APFS Volume" },
        { label: "Owners:", value: volume.owners ? "Enabled" : "Disabled" },
        { label: "Connection:", value: disk.connection },
        { label: "Device:", value: volume.device },
      ],
    };
  }
  if (target.kind === "container") {
    const { container } = target;
    const used = Math.max(0, container.capacity - container.free);
    return {
      name: containerName(container),
      lines: ["APFS Container"],
      capacity: formatSize(container.capacity),
      caption: `SHARED BY ${sharedBy(container)} VOLUMES`,
      usedShare: Math.min(1, used / container.capacity),
      legend: [
        { key: "used", label: "Used", value: formatSize(used) },
        { key: "free", label: "Free", value: formatSize(container.free) },
      ],
      leading: [
        { label: "Volume count:", value: String(sharedBy(container)) },
        { label: "Capacity:", value: formatSize(container.capacity) },
        { label: "Free:", value: formatSize(container.free) },
        { label: "Used:", value: formatSize(used) },
      ],
      trailing: [
        { label: "Type:", value: "APFS Container" },
        { label: "Physical stores:", value: container.store },
        { label: "Connection:", value: disk.connection },
        { label: "Device:", value: container.device },
      ],
    };
  }
  const partitioned = sum(disk.containers.map((container) => container.capacity));
  const internal = disk.location === "internal";
  return {
    name: disk.name,
    lines: [
      `${disk.connection} ${internal ? "Internal" : "External"} Physical Disk • GUID Partition Map`,
    ],
    capacity: formatSize(disk.capacity),
    usedShare: Math.min(1, partitioned / disk.capacity),
    legend: disk.containers.length
      ? [
          {
            key: "used",
            label: disk.containers.map(containerName).join(", "),
            value: formatSize(partitioned),
          },
        ]
      : [{ key: "free", label: "Free", value: formatSize(disk.capacity) }],
    leading: [
      { label: "Location:", value: internal ? "Internal" : "External" },
      { label: "Connection:", value: disk.connection },
      { label: "Partition Map:", value: "GUID Partition Map" },
      { label: "S.M.A.R.T. status:", value: internal ? "Verified" : "Not Supported" },
    ],
    trailing: [
      { label: "Capacity:", value: formatSize(disk.capacity) },
      { label: "Child count:", value: String(disk.containers.length + 1) },
      { label: "Type:", value: "Solid state" },
      { label: "Device:", value: disk.device },
    ],
  };
}

/** The lines First Aid reports while it checks a row, in order. */
export function firstAidSteps(target: DiskUtilityTarget): string[] {
  const name = targetName(target);
  const volumes = targetVolumes(target);
  return [
    `Running First Aid on “${name}”`,
    "Checking the container superblock.",
    "Checking the space manager.",
    "Checking the object map.",
    ...volumes.map((volume) => `Checking volume “${volume.name}” (${volume.device}).`),
    "Verifying allocated space.",
    `The ${target.kind} “${name}” appears to be OK.`,
    "Operation successful.",
  ];
}

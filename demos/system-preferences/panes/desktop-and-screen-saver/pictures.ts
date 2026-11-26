/** A desktop picture of the gallery. The drawings are in artwork.tsx, by id. */
export interface DesktopPicture {
  id: string;
  /** The name beside the preview, and the name of the picture's button in the gallery. */
  name: string;
}

/**
 * Dynamic desktops: pictures that change through the day, or stay on their light or dark
 * still. The gallery shows each split down the middle, day on the left and night on the right.
 */
export const DYNAMIC_DESKTOPS: readonly DesktopPicture[] = [
  { id: "catalina", name: "Catalina" },
  { id: "mojave", name: "Mojave" },
  { id: "solar-gradients", name: "Solar Gradients" },
];

/** Plain colours for the desktop. Catalina's own list is in no capture, so these are approximate. */
export const DESKTOP_COLORS: readonly (DesktopPicture & { color: string })[] = [
  { id: "color:black", name: "Black", color: "#000000" },
  { id: "color:stone", name: "Stone", color: "#6c6a65" },
  { id: "color:space-gray", name: "Space Gray", color: "#3f4044" },
  { id: "color:silver", name: "Silver", color: "#a9abb0" },
  { id: "color:blue", name: "Blue", color: "#1c5fa8" },
  { id: "color:dark-blue", name: "Dark Blue", color: "#123a68" },
  { id: "color:teal", name: "Teal", color: "#1b7c86" },
  { id: "color:green", name: "Green", color: "#3e7a44" },
];

/** Still pictures, in the order of the capture. No capture shows their names. */
export const DESKTOP_PICTURES: readonly DesktopPicture[] = [
  { id: "island-at-dusk", name: "Island at Dusk" },
  { id: "island-at-night", name: "Island at Night" },
  { id: "mountains", name: "Mountains" },
  { id: "sunlit-coast", name: "Sunlit Coast" },
  { id: "striated-rock", name: "Striated Rock" },
  { id: "green-bay", name: "Green Bay" },
  { id: "dark-clouds", name: "Dark Clouds" },
  { id: "cloudy-sea", name: "Cloudy Sea" },
];

/** How a dynamic desktop is shown: changing with the hour, or one of its two stills. */
export const MODES = [
  ["dynamic", "Dynamic"],
  ["light", "Light (Still)"],
  ["dark", "Dark (Still)"],
] as const;

/** The setting that holds the chosen picture (stored-picture.ts). */
export const PICTURE_KEY = "desktop-and-screen-saver.picture";

/** The source that is captured: Apple's own desktop pictures. */
export const DESKTOP_PICTURES_SOURCE = "desktop-pictures";

/** The folder macOS lists under Folders from the start. */
export const PICTURES_FOLDER = "Pictures";

export const folderId = (name: string) => `folder:${name}`;

/** A folder of the drive added to Folders, as `desktop-and-screen-saver.folders` keeps it. */
export const ADDED_FOLDER = "drive:";
export const addedFolder = (name: string) =>
  name.startsWith(ADDED_FOLDER) ? name.slice(ADDED_FOLDER.length) : undefined;

/** The choice of picture that names a file of the drive. */
export const drivePicture = (id: string): string => `drive:${id}`;

/** When the desktop changes to another picture of its folder. */
export const INTERVALS = [
  "When logging in",
  "When waking from sleep",
  "Every 5 seconds",
  "Every minute",
  "Every 5 minutes",
  "Every 15 minutes",
  "Every 30 minutes",
  "Every hour",
  "Every day",
] as const;

export type DesktopMode = (typeof MODES)[number][0];

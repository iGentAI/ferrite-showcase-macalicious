import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Startup Disk pane in Dark Aqua, 668 x 403 pt: as the Aqua
 * capture, but still looking for volumes (the spinner) and with Macintosh HD found before
 * Macintosh SSD, as in Dark-System-Preferences-Startup-Disk.
 *
 * Reference crop x=112 y=76 w=1336 h=806: the opaque frame without its shadow.
 */
export default function VisualStartupDiskDark() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 403,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="startup-disk"
        defaultSettings={{
          "startup-disk.scanning": true,
          "startup-disk.volumes": [
            { id: "macintosh-hd", name: "Macintosh HD", system: "macOS, 10.15", kind: "internal" },
            {
              id: "macintosh-ssd",
              name: "Macintosh SSD",
              system: "macOS, 10.15",
              kind: "external",
            },
          ],
        }}
      />
    </div>
  );
}

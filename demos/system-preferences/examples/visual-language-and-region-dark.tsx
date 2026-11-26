import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Language & Region pane in Dark Aqua, 668 x 517 pt: as the Aqua
 * capture, but with the formatting examples of the day after, when
 * Dark-System-Preferences-Language-and-Region was taken.
 *
 * Reference crop x=112 y=76 w=1336 h=1034: the opaque frame without its shadow.
 */
export default function VisualLanguageAndRegionDark() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 517,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="language-and-region"
        defaultSettings={{ "language-and-region.exampleTime": "2019-10-04T10:24:27" }}
      />
    </div>
  );
}

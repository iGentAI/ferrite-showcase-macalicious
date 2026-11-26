import {
  PreferencesToolbar,
  PreferencesToolbarItem,
  PreferencesToolbarRoot,
} from "macalicious/preferences-toolbar";
import { TitleBar } from "macalicious/title-bar";
import { Window } from "macalicious/window";

/* Item widths in points, measured between the labels of Music's preferences toolbar. */
const ITEMS: [value: string, label: string, width: number][] = [
  ["general", "General", 49],
  ["playback", "Playback", 54.75],
  ["files", "Files", 41],
  ["restrictions", "Restrictions", 69.75],
  ["advanced", "Advanced", 59.75],
];

/**
 * Visual comparison target: the title bar and toolbar of Music's preferences, a modal dialog
 * without window controls whose five items are centred as a group. Reference crop (2x pixels)
 * x=112 y=76 w=1066 h=156, i.e. 533 x 78 pt. The group sits 2.25 pt left of the exact centre
 * in the capture, which the example reproduces with a margin. Icons are left out and masked.
 */
export default function VisualMusic() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 533,
        height: 78,
        background: "#ffffff",
      }}
    >
      <PreferencesToolbarRoot
        defaultValue="general"
        render={<Window width={533} height={300} style={{ position: "absolute", inset: 0 }} />}
      >
        <TitleBar variant="unified" title="General">
          <PreferencesToolbar aria-label="Music preferences" alignment="center">
            {ITEMS.map(([value, label, width], index) => (
              <PreferencesToolbarItem
                key={value}
                value={value}
                style={{
                  width,
                  minWidth: 0,
                  paddingInline: 0,
                  marginInlineStart: index === 0 ? -4.5 : 0,
                }}
              >
                {label}
              </PreferencesToolbarItem>
            ))}
          </PreferencesToolbar>
        </TitleBar>
      </PreferencesToolbarRoot>
    </div>
  );
}

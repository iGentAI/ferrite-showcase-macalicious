import {
  PreferencesToolbar,
  PreferencesToolbarItem,
  PreferencesToolbarRoot,
} from "macalicious/preferences-toolbar";
import { TitleBar } from "macalicious/title-bar";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/* Item widths in points, measured between the labels of Mail's preferences toolbar: each is
   its label (or the 32 pt icon) plus 4.75 pt on each side. They are fixed here because the
   labels are set in the fallback font off Apple platforms. */
const ITEMS: [value: string, label: string, width: number][] = [
  ["general", "General", 49],
  ["accounts", "Accounts", 56.75],
  ["junk", "Junk Mail", 58.25],
  ["fonts", "Fonts & Colors", 85.75],
  ["viewing", "Viewing", 50],
  ["composing", "Composing", 67.75],
  ["signatures", "Signatures", 64.5],
  ["rules", "Rules", 41.5],
];

/**
 * Visual comparison target: the title bar and toolbar of Mail's preferences window, General
 * selected. Reference crop (2x pixels) x=112 y=76 w=1100 h=156, i.e. 550 x 78 pt: the top of
 * the window frame, with its rounded corners over the capture's transparent margin (matte
 * white). Mail leaves the minimize button enabled. The pane icons are Apple artwork and are
 * left out; the comparison masks them.
 */
export default function VisualMail() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 550,
        height: 78,
        background: "#ffffff",
      }}
    >
      <PreferencesToolbarRoot
        defaultValue="general"
        render={<Window width={550} height={300} style={{ position: "absolute", inset: 0 }} />}
      >
        <TitleBar variant="unified" title="General" controls={<WindowControls zoomDisabled />}>
          <PreferencesToolbar aria-label="Mail preferences">
            {ITEMS.map(([value, label, width]) => (
              <PreferencesToolbarItem
                key={value}
                value={value}
                style={{ width, minWidth: 0, paddingInline: 0 }}
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

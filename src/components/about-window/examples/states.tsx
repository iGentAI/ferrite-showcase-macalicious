import {
  AboutWindow,
  AboutWindowPanel,
  AboutWindowTab,
  AboutWindowTabs,
} from "macalicious/about-window";
import { Label } from "macalicious/label";

function Tabs({ force }: { force?: string }) {
  return (
    <AboutWindowTabs aria-label="Sections">
      <AboutWindowTab value="overview">Overview</AboutWindowTab>
      <AboutWindowTab value="displays" data-force={force}>
        Displays
      </AboutWindowTab>
      <AboutWindowTab value="storage">Storage</AboutWindowTab>
      <AboutWindowTab value="service" disabled>
        Service
      </AboutWindowTab>
    </AboutWindowTabs>
  );
}

/**
 * The tab control's states: a disabled tab in each window; pressed, focused, inactive. The
 * tabs come from a component, so each window names its first pane with `defaultValue`.
 */
export default function States() {
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <AboutWindow
        title="Pressed"
        width={420}
        defaultValue="overview"
        tabs={<Tabs force="pressed" />}
      >
        <AboutWindowPanel value="overview" style={{ padding: 20 }}>
          <Label>Key window: Displays is shown pressed, Service is disabled.</Label>
        </AboutWindowPanel>
      </AboutWindow>
      <AboutWindow
        title="Focused"
        width={420}
        defaultValue="overview"
        tabs={<Tabs force="focus" />}
      >
        <AboutWindowPanel value="overview" style={{ padding: 20 }}>
          <Label>Key window: Displays is shown with the keyboard focus.</Label>
        </AboutWindowPanel>
      </AboutWindow>
      <AboutWindow
        title="Inactive"
        width={420}
        state="inactive"
        defaultValue="overview"
        tabs={<Tabs />}
      >
        <AboutWindowPanel value="overview" style={{ padding: 20 }}>
          <Label>Inactive window: the control is dimmed.</Label>
        </AboutWindowPanel>
      </AboutWindow>
    </div>
  );
}

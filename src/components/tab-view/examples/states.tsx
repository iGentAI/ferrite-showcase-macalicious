import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";

const caption = {
  margin: "0 0 6px",
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

function Strip({ label, force }: { label: string; force?: "pressed" | "focus" }) {
  return (
    <TabView defaultValue="a" style={{ width: 240 }}>
      <TabViewList aria-label={label} data-force={force === "focus" ? "focus" : undefined}>
        <TabViewTab value="a">Display</TabViewTab>
        <TabViewTab value="b" data-force={force === "pressed" ? "pressed" : undefined}>
          Color
        </TabViewTab>
        <TabViewTab value="c" disabled>
          Night Shift
        </TabViewTab>
      </TabViewList>
      <TabViewPanel value="a" style={{ minHeight: 16 }} />
      <TabViewPanel value="b" style={{ minHeight: 16 }} />
      <TabViewPanel value="c" style={{ minHeight: 16 }} />
    </TabView>
  );
}

/**
 * The states of the strip. The third tab is disabled in every strip. Pressed and focused are
 * transient, so this gallery pins them with the `data-force` preview attribute.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(2, max-content)", gap: "16px 24px" }}
    >
      <div>
        <p style={caption}>Normal</p>
        <Strip label="Normal" />
      </div>
      <div>
        <p style={caption}>Second tab pressed</p>
        <Strip label="Pressed" force="pressed" />
      </div>
      <div>
        <p style={caption}>Keyboard focus</p>
        <Strip label="Focused" force="focus" />
      </div>
      <div data-window-state="main">
        <p style={caption}>Main window, not key</p>
        <Strip label="Main window" />
      </div>
      <div data-window-state="inactive">
        <p style={caption}>Inactive window</p>
        <Strip label="Inactive window" />
      </div>
    </div>
  );
}

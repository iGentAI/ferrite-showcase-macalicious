import { WindowTab, WindowTabBar } from "macalicious/window-tab-bar";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;
const cell = { display: "grid", gap: 6 } as const;
const noop = () => {};

function Bar({ force, disabled }: { force?: string; disabled?: boolean }) {
  return (
    <WindowTabBar aria-label="Folders" defaultValue="home" onNewTab={noop} style={{ width: 400 }}>
      <WindowTab value="recents" data-force={force} onClose={force ? noop : undefined}>
        Recents
      </WindowTab>
      <WindowTab value="home">Home</WindowTab>
      <WindowTab value="documents" disabled={disabled}>
        Documents
      </WindowTab>
    </WindowTabBar>
  );
}

/**
 * Every state side by side. Hover and keyboard focus are transient, so this gallery pins them
 * on the first tab with the `data-force` preview attribute.
 */
export default function States() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={cell}>
        <span style={caption}>Normal: the middle tab is selected</span>
        <Bar />
      </div>
      <div style={cell}>
        <span style={caption}>Pointer over the first tab, with its close button</span>
        <Bar force="hover" />
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus on the first tab</span>
        <Bar force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Last tab disabled</span>
        <Bar disabled />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <Bar />
      </div>
    </div>
  );
}

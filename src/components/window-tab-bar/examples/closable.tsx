import { WindowTab, WindowTabBar } from "macalicious/window-tab-bar";
import { useId, useState } from "react";

/**
 * Tabs that can be opened and closed. The bar is controlled: + appends a tab and selects it,
 * closing the selected tab selects a neighbour. The content below is wired to the selected
 * tab by hand (`role="tabpanel"`, `aria-labelledby`, `tabIndex`), because the bar does not
 * contain it.
 */
export default function Closable() {
  const [tabs, setTabs] = useState(["Recents", "Home", "Documents"]);
  const [selected, setSelected] = useState("Home");
  const [count, setCount] = useState(1);
  const prefix = useId();
  const tabId = (name: string) => `${prefix}-${name.replace(" ", "-")}`;

  function close(name: string) {
    const index = tabs.indexOf(name);
    const rest = tabs.filter((tab) => tab !== name);
    setTabs(rest);
    if (name === selected) setSelected(rest[Math.min(index, rest.length - 1)] ?? "");
  }

  return (
    <div style={{ width: 520 }}>
      <WindowTabBar
        aria-label="Folders"
        value={selected}
        onValueChange={(value) => setSelected(value as string)}
        onNewTab={() => {
          const name = `Folder ${count}`;
          setCount(count + 1);
          setTabs([...tabs, name]);
          setSelected(name);
        }}
      >
        {tabs.map((name) => (
          <WindowTab
            key={name}
            id={tabId(name)}
            value={name}
            onClose={tabs.length > 1 ? () => close(name) : undefined}
          >
            {name}
          </WindowTab>
        ))}
      </WindowTabBar>
      <div
        role="tabpanel"
        aria-labelledby={tabId(selected)}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the panel holds only text, so it is a tab stop itself, as the tabs pattern asks; else the keyboard skips from the bar past its content.
        tabIndex={0}
        style={{
          padding: 12,
          font: "var(--mac-font-body)",
          color: "var(--mac-color-label)",
          background: "var(--mac-color-control-background)",
        }}
      >
        Contents of {selected}
      </div>
    </div>
  );
}

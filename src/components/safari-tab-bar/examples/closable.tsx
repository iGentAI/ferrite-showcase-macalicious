import { SafariTab, SafariTabBar } from "macalicious/safari-tab-bar";
import { useId, useState } from "react";

/**
 * Tabs that can be opened and closed. The bar is controlled: + appends a tab and selects it,
 * closing the selected tab selects a neighbour, and the last tab cannot be closed. The content
 * below is wired to the selected tab by hand (`role="tabpanel"`, `aria-labelledby`), because
 * the bar does not contain it.
 */
export default function Closable() {
  const [tabs, setTabs] = useState(["Start Page", "Example Domain", "Documentation"]);
  const [selected, setSelected] = useState("Example Domain");
  const [count, setCount] = useState(1);
  const prefix = useId();
  const tabId = (name: string) => `${prefix}-${name.replaceAll(" ", "-")}`;

  function close(name: string) {
    const index = tabs.indexOf(name);
    const rest = tabs.filter((tab) => tab !== name);
    setTabs(rest);
    if (name === selected) setSelected(rest[Math.min(index, rest.length - 1)] ?? "");
  }

  return (
    <div style={{ width: 520 }}>
      <SafariTabBar
        aria-label="Tabs"
        value={selected}
        onValueChange={(value) => setSelected(value as string)}
        onNewTab={() => {
          const name = `Untitled ${count}`;
          setCount(count + 1);
          setTabs([...tabs, name]);
          setSelected(name);
        }}
      >
        {tabs.map((name) => (
          <SafariTab
            key={name}
            id={tabId(name)}
            value={name}
            onClose={tabs.length > 1 ? () => close(name) : undefined}
          >
            {name}
          </SafariTab>
        ))}
      </SafariTabBar>
      <div
        role="tabpanel"
        aria-labelledby={tabId(selected)}
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

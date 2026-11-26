import { AppSwitcher, AppSwitcherItem } from "macalicious/app-switcher";

/**
 * Visual state target: the switcher over a flat mid grey, 480 x 226 pt, so that the colour of
 * the panel and of the selection tile follow from the tokens alone: a flat backdrop is the
 * same after blur and saturation. It opens by itself with the second application selected;
 * the state checks move the selection with keys and the pointer, and close it.
 */
export default function VisualStates() {
  return (
    <div style={{ position: "relative", width: 480, height: 226, background: "#808080" }}>
      <AppSwitcher defaultOpen>
        {["Notes", "Mail", "Terminal"].map((name) => (
          <AppSwitcherItem
            key={name}
            value={name.toLowerCase()}
            icon={<div style={{ scale: "0.84", borderRadius: 28, background: "#404040" }} />}
          >
            {name}
          </AppSwitcherItem>
        ))}
      </AppSwitcher>
    </div>
  );
}

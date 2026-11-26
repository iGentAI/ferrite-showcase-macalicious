import { SmartSearchField, SmartSearchFieldButton } from "macalicious/smart-search-field";
import { useEffect, useRef, useState } from "react";

/**
 * A field wired the way a browser wires it. `value` is the text being edited and `address` the
 * page that is loaded: Return loads what was typed, Escape goes back to the loaded address,
 * and the Reload button turns into Stop while a page loads. One load is under way at a time:
 * a new one, Stop and unmounting cancel the timer that stands in for the network.
 */
export default function Browser() {
  const [address, setAddress] = useState("https://www.example.com/");
  const [value, setValue] = useState(address);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function stop() {
    clearTimeout(timer.current);
    setLoading(false);
  }

  function load(next: string) {
    clearTimeout(timer.current);
    setAddress(next);
    setValue(next);
    setLoading(true);
    timer.current = setTimeout(() => setLoading(false), 1200);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div style={{ display: "grid", gap: 8, width: 420 }}>
      <SmartSearchField
        value={value}
        onValueChange={setValue}
        onSubmit={load}
        secure={address.startsWith("https:")}
        trailing={
          loading ? (
            <SmartSearchFieldButton
              glyph="stop"
              aria-label="Stop loading this page"
              onClick={stop}
            />
          ) : (
            <SmartSearchFieldButton
              glyph="reload"
              aria-label="Reload this page"
              onClick={() => load(address)}
            />
          )
        }
      />
      <span style={{ font: "var(--mac-font-label)", color: "var(--mac-color-label-secondary)" }}>
        {loading ? "Loading" : "Loaded"}: {address}
      </span>
    </div>
  );
}

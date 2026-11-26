import { Menu } from "@base-ui/react/menu";
import { SearchField } from "macalicious/search-field";
import { type CSSProperties, useRef, useState } from "react";

const RECENTS = ["invoice 2019", "kind:pdf", "Catalina"];

const popup: CSSProperties = {
  // As wide as the field, so it sits flush with it whichever way it is aligned.
  minWidth: "var(--anchor-width)",
  padding: "4px 0",
  borderRadius: "var(--mac-radius-menu)",
  background: "var(--mac-material-popover-opaque)",
  boxShadow: "var(--mac-shadow-menu)",
  font: "var(--mac-font-menu)",
  color: "var(--mac-color-label)",
  outline: "none",
};
const heading: CSSProperties = {
  padding: "0 21px",
  font: "var(--mac-font-sidebar-header)",
  color: "var(--mac-color-label-secondary)",
};
const item: CSSProperties = { padding: "0 21px", cursor: "default", outline: "none" };
const highlighted: CSSProperties = {
  background: "var(--mac-color-selected-content-background)",
  color: "var(--mac-color-selected-menu-item-text)",
};

/**
 * A search field with a menu of recent searches. The field draws the chevron and asks for the
 * menu, from a click on the glass or from Down Arrow; the menu itself is the application's.
 * This one is a bare Base UI Menu with a few inline styles: use the library's menu component
 * where it is available.
 */
export default function SearchMenu() {
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <SearchField
        aria-label="Search documents"
        searchMenu
        value={query}
        onValueChange={setQuery}
        onSearchMenu={setAnchor}
        inputRef={input}
        style={{ width: 220 }}
      />
      <Menu.Root open={anchor !== null} onOpenChange={(open) => open || setAnchor(null)}>
        <Menu.Portal>
          <Menu.Positioner anchor={anchor} align="start" sideOffset={3}>
            <Menu.Popup style={popup} finalFocus={input}>
              <Menu.Group>
                <Menu.GroupLabel style={heading}>Recent Searches</Menu.GroupLabel>
                {RECENTS.map((recent) => (
                  <Menu.Item
                    key={recent}
                    onClick={() => setQuery(recent)}
                    style={(state) => (state.highlighted ? { ...item, ...highlighted } : item)}
                  >
                    {recent}
                  </Menu.Item>
                ))}
              </Menu.Group>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </>
  );
}

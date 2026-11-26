import { Checkbox } from "macalicious/checkbox";

const cell = { display: "grid", gap: 8, justifyItems: "start", alignContent: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * Every state side by side. Pressed and focused are transient, so this gallery pins them with
 * the `data-force` preview attribute; in an application they come from :active and
 * :focus-visible.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "20px 32px" }}
    >
      <div style={cell}>
        <span style={caption}>Normal</span>
        <Checkbox>Off</Checkbox>
        <Checkbox defaultChecked>On</Checkbox>
        <Checkbox indeterminate>Mixed</Checkbox>
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <Checkbox data-force="pressed">Off</Checkbox>
        <Checkbox defaultChecked data-force="pressed">
          On
        </Checkbox>
        <Checkbox indeterminate data-force="pressed">
          Mixed
        </Checkbox>
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <Checkbox data-force="focus">Off</Checkbox>
        <Checkbox defaultChecked data-force="focus">
          On
        </Checkbox>
        <Checkbox indeterminate data-force="focus">
          Mixed
        </Checkbox>
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <Checkbox disabled>Off</Checkbox>
        <Checkbox disabled defaultChecked>
          On
        </Checkbox>
        <Checkbox disabled indeterminate>
          Mixed
        </Checkbox>
      </div>
      <div style={cell} data-window-state="main">
        <span style={caption}>Main window, not key</span>
        <Checkbox>Off</Checkbox>
        <Checkbox defaultChecked>On</Checkbox>
        <Checkbox indeterminate>Mixed</Checkbox>
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <Checkbox>Off</Checkbox>
        <Checkbox defaultChecked>On</Checkbox>
        <Checkbox indeterminate>Mixed</Checkbox>
      </div>
    </div>
  );
}

import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";

// A chip in the title's colour: a solid block to read that colour from.
const chip = <span style={{ width: 24, height: 12, background: "currentColor" }} />;

const items = (
  <>
    <PopUpButtonItem value="a" image={chip}>
      A
    </PopUpButtonItem>
    <PopUpButtonItem value="b">B</PopUpButtonItem>
  </>
);

/**
 * Fixture for the two colour hooks of the button without a bezel, both set to pure colours on
 * the page: an enabled button without a bezel takes them, a disabled one and one with a bezel
 * do not. Each title starts with a chip drawn in the title's colour.
 *
 * 116 x 95 pt on white, 8 pt of page on every side and between the buttons, which are 100 pt
 * wide: y 8 to 29 (no bezel), 37 to 58 (no bezel, disabled), 66 to 87 (bezel).
 */
export default function VisualTint() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 8,
        background: "#ffffff",
        ["--mac-pop-up-button-borderless-color" as string]: "#ff0000",
        ["--mac-pop-up-button-borderless-arrow-color" as string]: "#0000ff",
      }}
    >
      <PopUpButton bordered={false} defaultValue="a" aria-label="Tinted" style={{ width: 100 }}>
        {items}
      </PopUpButton>
      <PopUpButton
        bordered={false}
        disabled
        defaultValue="a"
        aria-label="Disabled"
        style={{ width: 100 }}
      >
        {items}
      </PopUpButton>
      <PopUpButton defaultValue="a" aria-label="With a bezel" style={{ width: 100 }}>
        {items}
      </PopUpButton>
    </div>
  );
}

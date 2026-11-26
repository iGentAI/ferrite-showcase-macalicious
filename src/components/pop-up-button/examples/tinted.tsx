import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";

/**
 * A pop-up button without a bezel in an application's own colours, as the labels of a Contacts
 * card are: the two custom properties tint the title and the arrows of every enabled borderless
 * pop-up button inside the element they are set on.
 */
export default function Tinted() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        ["--mac-pop-up-button-borderless-color" as string]: "var(--mac-color-link)",
        ["--mac-pop-up-button-borderless-arrow-color" as string]:
          "color-mix(in srgb, var(--mac-color-link) 70%, transparent)",
      }}
    >
      <PopUpButton
        size="small"
        bordered={false}
        defaultValue="mobile"
        aria-label="Phone label"
        style={{ width: 56 }}
      >
        <PopUpButtonItem value="mobile">mobile</PopUpButtonItem>
        <PopUpButtonItem value="home">home</PopUpButtonItem>
        <PopUpButtonItem value="work">work</PopUpButtonItem>
      </PopUpButton>
      <span style={{ font: "var(--mac-font-body)" }}>(555) 010-0199</span>
    </div>
  );
}

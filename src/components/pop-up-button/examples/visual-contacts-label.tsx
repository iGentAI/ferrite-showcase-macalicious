import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";

/**
 * Visual comparison target: the label of a phone number on a Contacts card in edit mode, a
 * small pop-up button without a bezel that Contacts tints blue, with lighter arrows.
 *
 * Reference crop (2x pixels) x=992 y=326 w=120 h=34 in the light Contacts screenshot, i.e. 60
 * x 17 pt; no dark screenshot shows a card being edited. The title's ink starts 4.5 pt from
 * the crop's left edge and the arrows' ink ends 4.5 pt before its right edge; the width pins
 * the arrows there. The two colours are the capture's, set through the button's two hooks, and
 * the title is 12 pt as Contacts sets it, where the small size has 11 pt.
 */
export default function VisualContactsLabel() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 60,
        height: 17,
        paddingLeft: 4,
        background: "light-dark(#ffffff, #1e1e1e)",
        ["--mac-pop-up-button-borderless-color" as string]: "#4188f2",
        ["--mac-pop-up-button-borderless-arrow-color" as string]: "#77adf9",
      }}
    >
      <PopUpButton
        size="small"
        bordered={false}
        defaultValue="mobile"
        aria-label="Phone label"
        style={{ width: 56, height: 17, marginTop: -0.5, fontSize: 12 }}
      >
        <PopUpButtonItem value="mobile">mobile</PopUpButtonItem>
        <PopUpButtonItem value="home">home</PopUpButtonItem>
        <PopUpButtonItem value="work">work</PopUpButtonItem>
      </PopUpButton>
    </div>
  );
}

import { TokenField } from "macalicious/token-field";

/**
 * Visual comparison target: the recipient token in the To field of a Mail message.
 *
 * Reference crop (2x pixels) 244 x 46 at x=596 y=414 (Aqua) and x=600 y=406 (Dark Aqua), that
 * is 122 x 23 pt of the message header (#ffffff, #1e1e20). The token runs 235 px from 2.5 pt
 * right and 2 pt below the crop's origin: 117.5 x 19 pt.
 *
 * The token is as wide as its text. Off Apple platforms the fallback font sets "Stephen
 * Hackett" wider than San Francisco does, so the example tightens the letter spacing to bring
 * the token to the reference's width; an application sets none.
 */
export default function VisualMail() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 122,
        height: 23,
        padding: "2px 0 0 2.5px",
        overflow: "hidden",
        lineHeight: 0,
        background: "light-dark(#ffffff, #1e1e20)",
      }}
    >
      <TokenField
        aria-label="To"
        bordered={false}
        tokenMenu
        defaultValue={["Stephen Hackett"]}
        style={{ width: 160, letterSpacing: "-0.267px" }}
      />
    </div>
  );
}

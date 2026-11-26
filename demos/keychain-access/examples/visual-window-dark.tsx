import { KeychainAccess } from "../keychain-access";
import { darkCaptureItems, darkCaptureToday } from "../keychain-access-data";

/**
 * Visual comparison target: the whole Keychain Access window of the dark capture, taken a
 * day after the light one: the account tokens were renewed that morning, and what the light
 * capture dates "Today" reads "Yesterday".
 * Reference crop (2x pixels) x=112 y=76 w=1754 h=1186, i.e. the 877 x 593 pt frame, over the
 * capture's transparent margin (matte white).
 */
export default function VisualWindowDark() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 877,
        height: 593,
        background: "#ffffff",
      }}
    >
      <KeychainAccess
        items={darkCaptureItems}
        today={darkCaptureToday}
        defaultSelectedItemId="login-1"
        style={{ position: "absolute", inset: 0 }}
      />
    </div>
  );
}

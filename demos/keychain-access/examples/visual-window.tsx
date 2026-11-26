import { KeychainAccess } from "../keychain-access";

/**
 * Visual comparison target: the whole Keychain Access window of the light capture, with the
 * login keychain, All Items and the first row, the public key, selected.
 * Reference crop (2x pixels) x=112 y=76 w=1754 h=1186, i.e. the 877 x 593 pt frame, over the
 * capture's transparent margin (matte white).
 */
export default function VisualWindow() {
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
      <KeychainAccess defaultSelectedItemId="login-1" style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}

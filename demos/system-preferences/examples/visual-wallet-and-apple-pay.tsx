import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Wallet & Apple Pay pane, 668 x 334 pt, in the state both
 * captures show: no card added yet.
 *
 * Reference crop x=112 y=76 w=1336 h=668: the opaque frame without its shadow.
 */
export default function VisualWalletAndApplePay() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 334,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="wallet-and-apple-pay" />
    </div>
  );
}

import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Internet Accounts pane, 668 x 486 pt, in the state both
 * captures show: two accounts, neither selected, and the providers of a new account.
 *
 * Reference crop x=112 y=76 w=1336 h=972: the opaque frame without its shadow.
 */
export default function VisualInternetAccounts() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 486,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="internet-accounts" />
    </div>
  );
}

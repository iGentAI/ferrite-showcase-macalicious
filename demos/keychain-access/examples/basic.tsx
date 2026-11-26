import { Label } from "macalicious/label";
import { useState } from "react";
import { KeychainAccess } from "../keychain-access";

/**
 * Pick a keychain and a category, click a heading to sort, type in the search field and
 * select a row. The line under the window stands for what a host does with the two commands
 * the window hands over: the item window that Info, a double click or Return opens, and the
 * new item that "+" asks for.
 */
export default function Basic() {
  const [status, setStatus] = useState("Select an item and choose Info.");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <KeychainAccess
        width="100%"
        height={520}
        style={{ maxWidth: 877 }}
        defaultSelectedItemId="login-1"
        onInspect={(item) => setStatus(`${item.name}: ${item.kind} in ${item.keychain}.`)}
        onAdd={(keychain) => setStatus(`A new item would go into ${keychain.name}.`)}
      />
      <Label color="secondary" role="status">
        {status}
      </Label>
    </div>
  );
}

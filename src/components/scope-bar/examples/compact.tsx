import { ScopeBar, ScopeBarButton, ScopeBarGroup } from "macalicious/scope-bar";
import { useState } from "react";

/**
 * The compact bar Console shows under its toolbar: `size="small"` on the toolbar surface, with
 * two scopes that filter the list below. It has no label, so the group is named with
 * `aria-label`.
 */
export default function Compact() {
  const [shown, setShown] = useState("all");
  return (
    <ScopeBar surface="toolbar" size="small" style={{ width: 460 }}>
      <ScopeBarGroup
        aria-label="Show"
        value={shown}
        onValueChange={(value) => setShown(value as string)}
      >
        <ScopeBarButton value="all">All Messages</ScopeBarButton>
        <ScopeBarButton value="errors">Errors and Faults</ScopeBarButton>
      </ScopeBarGroup>
    </ScopeBar>
  );
}

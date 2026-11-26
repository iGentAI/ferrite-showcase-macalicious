import { PushButton } from "macalicious/push-button";
import {
  ScopeBar,
  ScopeBarAction,
  ScopeBarActionGroup,
  ScopeBarActions,
  ScopeBarButton,
  ScopeBarGroup,
  ScopeBarLabel,
} from "macalicious/scope-bar";
import { useEffect, useRef, useState } from "react";

/**
 * A find bar on the toolbar surface, as in Preview: the scopes sort the results, a segmented
 * pair steps through them and Done closes the bar. The group is controlled, and so is whether
 * the bar shows: the application owns that, here with a button that brings the bar back.
 * Closing and reopening each remove the focused button, so focus is moved by hand: to Find…
 * when the bar closes, and to the chosen scope when it opens again.
 */
export default function FindBar() {
  const [order, setOrder] = useState("page");
  const [match, setMatch] = useState(1);
  const [open, setOpen] = useState(true);
  const toggled = useRef(false);
  const findButton = useRef<HTMLElement>(null);
  const chosenScope = useRef<HTMLElement>(null);
  const show = (next: boolean) => {
    toggled.current = true;
    setOpen(next);
  };
  useEffect(() => {
    if (!toggled.current) return;
    toggled.current = false;
    (open ? chosenScope : findButton).current?.focus();
  }, [open]);
  if (!open) {
    return (
      <PushButton ref={findButton} onClick={() => show(true)}>
        Find…
      </PushButton>
    );
  }
  return (
    <ScopeBar surface="toolbar" style={{ width: 520 }}>
      <ScopeBarLabel>Sort by:</ScopeBarLabel>
      <ScopeBarGroup
        aria-label="Sort by"
        value={order}
        onValueChange={(value) => setOrder(value as string)}
      >
        <ScopeBarButton value="rank" ref={order === "rank" ? chosenScope : undefined}>
          Search Rank
        </ScopeBarButton>
        <ScopeBarButton value="page" ref={order === "page" ? chosenScope : undefined}>
          Page Order
        </ScopeBarButton>
      </ScopeBarGroup>
      <ScopeBarActions>
        <span style={{ marginInlineEnd: 2 }}>Match {match} of 7</span>
        <ScopeBarActionGroup aria-label="Matches">
          <ScopeBarAction
            glyph="previous"
            aria-label="Previous match"
            disabled={match === 1}
            onClick={() => setMatch(match - 1)}
          />
          <ScopeBarAction
            glyph="next"
            aria-label="Next match"
            disabled={match === 7}
            onClick={() => setMatch(match + 1)}
          />
        </ScopeBarActionGroup>
        <ScopeBarAction onClick={() => show(false)}>Done</ScopeBarAction>
      </ScopeBarActions>
    </ScopeBar>
  );
}

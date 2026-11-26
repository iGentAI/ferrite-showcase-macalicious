import {
  ScopeBar,
  ScopeBarAction,
  ScopeBarActions,
  ScopeBarButton,
  ScopeBarGroup,
  ScopeBarLabel,
} from "macalicious/scope-bar";

export default function Basic() {
  return (
    <ScopeBar style={{ width: 460 }}>
      <ScopeBarLabel>Search:</ScopeBarLabel>
      <ScopeBarGroup aria-label="Search" defaultValue="disk">
        <ScopeBarButton value="mac">This Mac</ScopeBarButton>
        <ScopeBarButton value="disk">“Macintosh SSD”</ScopeBarButton>
      </ScopeBarGroup>
      <ScopeBarActions>
        <ScopeBarAction>Save</ScopeBarAction>
        <ScopeBarAction glyph="plus" aria-label="Add search criterion" />
      </ScopeBarActions>
    </ScopeBar>
  );
}

import { Sidebar, SidebarItem, type SidebarProps } from "macalicious/sidebar";

function Cell(props: SidebarProps) {
  return (
    <Sidebar material="opaque" defaultValue="one" style={{ width: 100, height: 80 }} {...props}>
      <SidebarItem value="one" label="One" />
      <SidebarItem value="two" label="Two" />
    </Sidebar>
  );
}

/**
 * Visual check target for what no screenshot shows: three 100 x 80 pt sidebars of two rows
 * each, at the medium, small and large sizes, with the first row selected. The checks focus
 * the first sidebar with Tab (focus ring, accent selection), move its selection with the
 * arrow keys, and read the row heights of the other two off the grey selection.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", width: 300, height: 80 }}>
      <Cell aria-label="Medium" />
      <Cell aria-label="Small" size="small" />
      <Cell aria-label="Large" size="large" />
    </div>
  );
}

import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { BorderedListRow, BorderedListRows } from "../components/bordered-list";
import { ColumnView } from "../components/column-view";
import { GalleryView } from "../components/gallery-view";
import { IconView } from "../components/icon-view";
import { ListView } from "../components/list-view";
import { TableView } from "../components/table-view";

const label = (index: number) => ["One", "Two", "Three"][index] ?? "";
const nothing = () => null;
const items = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
];

const VIEWS: readonly (readonly [string, string, string, ReactNode])[] = [
  [
    "IconView",
    "listbox",
    "ArrowRight",
    <IconView key="view" aria-label="View" count={3} getItemLabel={label} renderIcon={nothing} />,
  ],
  [
    "ListView",
    "listbox",
    "ArrowDown",
    <ListView key="view" aria-label="View" count={3} renderRow={label} rowHeight={20} />,
  ],
  [
    "TableView",
    "grid",
    "ArrowDown",
    <TableView
      key="view"
      aria-label="View"
      columns={[{ id: "name", title: "Name" }]}
      rowCount={3}
      renderCell={label}
    />,
  ],
  [
    "GalleryView",
    "listbox",
    "ArrowRight",
    <GalleryView
      key="view"
      aria-label="View"
      count={3}
      getItemLabel={label}
      renderThumbnail={nothing}
      renderPreview={nothing}
    />,
  ],
  [
    "ColumnView",
    "listbox",
    "ArrowDown",
    <ColumnView key="view" aria-label="View" getChildren={(id) => (id === null ? items : null)} />,
  ],
  [
    "BorderedListRows",
    "listbox",
    "ArrowDown",
    <BorderedListRows key="view" aria-label="View">
      <BorderedListRow value="a" title="A" />
      <BorderedListRow value="b" title="B" />
    </BorderedListRows>,
  ],
];

// `fireEvent` answers false when a handler claimed the key.
describe.each(VIEWS)("Control with an arrow in %s", (_name, role, key, view) => {
  const shown = async (wrapper: ReactNode) => {
    render(wrapper);
    await act(async () => {});
    return screen.getByRole(role, { name: "View" });
  };

  it("moves its current item on a page of its own", async () => {
    const target = await shown(<div>{view}</div>);
    expect(fireEvent.keyDown(target, { key, ctrlKey: true })).toBe(false);
  });

  it("is left alone in a desktop that keeps it for the system, and the plain arrow is not", async () => {
    const target = await shown(<div data-system-arrows="">{view}</div>);
    expect(fireEvent.keyDown(target, { key, ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(target, { key, ctrlKey: true, shiftKey: true })).toBe(false);
    expect(fireEvent.keyDown(target, { key })).toBe(false);
  });
});

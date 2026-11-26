"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { OutlineView } from "macalicious/outline-view";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { StatusBar } from "macalicious/status-bar";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { RichTextView } from "macalicious/text-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { type MouseEvent, type ReactNode, type Ref, useMemo, useState } from "react";
import {
  cellText,
  defaultItems,
  pathTo,
  rowLabel,
  type SystemInformationItem,
  type SystemInformationReport,
  type SystemInformationRow,
  type SystemInformationSection,
  type SystemInformationSort,
  sortRows,
} from "./system-information-data";
import { ComputerIcon } from "./system-information-icons";
import "./system-information.tokens.css";
import "./system-information.css";

export interface SystemInformationProps extends Omit<WindowProps, "children"> {
  /**
   * The categories of the outline, each with its report.
   * @default defaultItems
   */
  items?: readonly SystemInformationItem[];
  /**
   * The model of the computer: the window's title.
   * @default "MacBook Pro"
   */
  modelName?: string;
  /**
   * The computer's name: the first component of the path at the bottom.
   * @default "ismh15"
   */
  computerName?: string;
  /**
   * Id of the selected category (controlled). An id that names no category of `items` shows
   * the first one.
   */
  selectedId?: string;
  /**
   * Id of the category selected at first (uncontrolled).
   * @default "hardware"
   */
  defaultSelectedId?: string;
  /** Called with the id of the category chosen in the outline. */
  onSelectedIdChange?: (id: string) => void;
  /** The title bar, for a host that needs an element of the window. */
  titleBarRef?: Ref<HTMLDivElement>;
  /** Ids of the categories expanded at first. Without it every top-level category is. */
  defaultExpanded?: readonly string[];
  /** Ids of the expanded categories (controlled). */
  expanded?: readonly string[];
  /** Called with the ids of the expanded categories when one is expanded or collapsed. */
  onExpandedChange?: (expanded: readonly string[]) => void;
  /** The width of the category list (controlled). */
  outlineSize?: number;
  /** Called with the width of the category list when its divider moves. */
  onOutlineSizeChange?: (size: number) => void;
  /** Shown under the report, over the path bar: the served desktop's find bar. */
  findBar?: ReactNode;
  /** The selected rows of each table report by category id (controlled). */
  selectedRows?: Readonly<Record<string, readonly string[]>>;
  /** Called with the selected rows of every table report when a selection changes. */
  onSelectedRowsChange?: (selected: Readonly<Record<string, readonly string[]>>) => void;
  /** The order of each table report by category id (controlled). */
  sorts?: Readonly<Record<string, SystemInformationSort>>;
  /** Called with the order of every table report when one changes. */
  onSortsChange?: (sorts: Readonly<Record<string, SystemInformationSort>>) => void;
  /** The items of the menu a secondary click on the report opens. Without it there is none. */
  reportMenu?: ReactNode;
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /** For the title bar: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: a window manager zooms the window here. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

const NO_ROWS: readonly string[] = [];

/** Headed blocks of label and value lines, as the report's read-only text. */
function ReportText({
  label,
  sections,
}: {
  label: string;
  sections: readonly SystemInformationSection[];
}) {
  return (
    <RichTextView readOnly aria-label={label} className="mac-system-information-report">
      {sections.map((section) => (
        <div key={section.heading} className="mac-system-information-section">
          <p className="mac-system-information-heading">{section.heading}:</p>
          {section.entries.length > 0 ? (
            <dl className="mac-system-information-entries">
              {section.entries.map(([name, value]) => (
                <div key={name} className="mac-system-information-entry">
                  <dt className="mac-system-information-entry-label">{name}:</dt>
                  <dd className="mac-system-information-entry-value">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ))}
    </RichTextView>
  );
}

/** A report that lists things: the sortable table over the details of its selected row. */
function ReportTable({
  name,
  report,
  rows,
  sort,
  onSortChange,
  selectedRows,
  onSelectedRowsChange,
}: {
  name: string;
  report: Extract<SystemInformationReport, { kind: "table" }>;
  rows: readonly SystemInformationRow[];
  sort: SystemInformationSort | undefined;
  onSortChange: (sort: SystemInformationSort) => void;
  selectedRows: readonly string[];
  onSelectedRowsChange: (ids: readonly string[]) => void;
}) {
  const columns = useMemo(
    () =>
      report.columns.map(
        (column): TableViewColumn => ({
          id: column.id,
          title: column.title,
          width: column.width,
          minWidth: column.width === undefined ? 120 : undefined,
          sortable: true,
        }),
      ),
    [report.columns],
  );
  // The details are the first selected row's, as the path bar's last component is.
  const selected = rows.find((row) => selectedRows.includes(row.id));
  return (
    <SplitView orientation="vertical" className="mac-system-information-split">
      <SplitViewPane defaultSize={152} minSize={56} maxSize={360}>
        <TableView
          aria-label={name}
          className="mac-system-information-table"
          columns={columns}
          rowCount={rows.length}
          rowHeight={16}
          size="mini"
          alternatingRows
          selectionMode="multiple"
          getRowId={(row) => rows[row]?.id ?? row}
          getRowLabel={(row) => {
            const entry = rows[row];
            return entry ? rowLabel(report.columns, entry) : "";
          }}
          value={selectedRows}
          onValueChange={(value) =>
            onSelectedRowsChange(value.filter((id) => typeof id === "string"))
          }
          sort={sort}
          onSortChange={onSortChange}
          renderCell={(row, column) => {
            const entry = rows[row];
            const definition = report.columns.find((candidate) => candidate.id === column.id);
            return entry && definition ? cellText(definition, entry) : null;
          }}
        />
      </SplitViewPane>
      <SplitViewDivider aria-label={`Resize the ${name} list`} />
      <SplitViewPane>
        <ReportText label={`${name} details`} sections={selected?.sections ?? []} />
      </SplitViewPane>
    </SplitView>
  );
}

/**
 * The System Information window of macOS 10.15: a plain title bar, the outline of categories
 * beside the report of the selected one, and the path of the selection at the bottom. A report
 * is label and value lines under bold headings, a sortable table over the details of its
 * selected row, or a line that says nothing was found. Apart from the Hardware overview of the
 * reference screenshots the reports are invented; nothing is read from the machine.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function SystemInformation({
  items = defaultItems,
  modelName = "MacBook Pro",
  computerName = "ismh15",
  selectedId,
  defaultSelectedId = "hardware",
  onSelectedIdChange,
  titleBarRef,
  defaultExpanded,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 751,
  height = 520,
  expanded,
  onExpandedChange,
  outlineSize,
  onOutlineSizeChange,
  findBar,
  selectedRows,
  onSelectedRowsChange,
  sorts,
  onSortsChange,
  reportMenu,
  ...windowProps
}: SystemInformationProps) {
  const [ownId, setOwnId] = useState(defaultSelectedId);
  const currentId = selectedId ?? ownId;
  // Each table report keeps its own order and its own selected rows while another is shown.
  const [ownSorts, setOwnSorts] = useState<Readonly<Record<string, SystemInformationSort>>>({});
  const [ownRows, setOwnRows] = useState<Readonly<Record<string, readonly string[]>>>({});
  const allSorts = sorts ?? ownSorts;
  const allRows = selectedRows ?? ownRows;

  // The window always shows a category: an id that names none, at first or after `items`
  // changed, stands for the first one, and the next choice in the outline replaces it.
  const found = pathTo(items, currentId);
  const path = found.length > 0 ? found : items.slice(0, 1);
  const current = path[path.length - 1];
  const report = current?.report;
  const currentSort = current ? allSorts[current.id] : undefined;
  const shownRows = useMemo(
    () => (report?.kind === "table" ? sortRows(report.rows, report.columns, currentSort) : []),
    [report, currentSort],
  );
  const currentRows = (current && allRows[current.id]) || NO_ROWS;
  const row = shownRows.find((candidate) => currentRows.includes(candidate.id));
  const chooseRows = (ids: readonly string[]) => {
    if (!current) return;
    const next = { ...allRows, [current.id]: ids };
    setOwnRows(next);
    onSelectedRowsChange?.(next);
  };
  const location = [
    computerName,
    ...path.map((item) => item.name),
    ...(row && report?.kind === "table" ? [rowLabel(report.columns, row)] : []),
  ]
    .filter(Boolean)
    .join(" › ");

  const reportView =
    !current || !report ? null : report.kind === "table" ? (
      <ReportTable
        key={current.id}
        name={current.name}
        report={report}
        rows={shownRows}
        sort={currentSort}
        onSortChange={(next) => {
          const all = { ...allSorts, [current.id]: next };
          setOwnSorts(all);
          onSortsChange?.(all);
        }}
        selectedRows={currentRows}
        onSelectedRowsChange={chooseRows}
      />
    ) : report.kind === "empty" ? (
      <RichTextView
        readOnly
        aria-label={`${current.name} report`}
        className="mac-system-information-report"
      >
        <p className="mac-system-information-message">{report.message}</p>
      </RichTextView>
    ) : (
      <ReportText label={`${current.name} report`} sections={report.sections} />
    );

  return (
    <Window width={width} height={height} {...windowProps}>
      <TitleBar
        ref={titleBarRef}
        title={modelName}
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />
      <WindowBody background="content" className="mac-system-information-body">
        <SplitView className="mac-system-information-split">
          <SplitViewPane
            defaultSize={163}
            size={outlineSize}
            onSizeChange={onOutlineSizeChange}
            minSize={110}
            maxSize={360}
          >
            <OutlineView
              aria-label="Categories"
              className="mac-system-information-outline"
              items={items}
              renderCell={(item) => item.name}
              getItemLabel={(item) => item.name}
              defaultExpanded={
                expanded ? undefined : (defaultExpanded ?? items.map((item) => item.id))
              }
              expanded={expanded}
              onExpandedChange={
                onExpandedChange
                  ? (next) => onExpandedChange(next.filter((id) => typeof id === "string"))
                  : undefined
              }
              value={current ? [current.id] : []}
              onValueChange={(value) => {
                // The outline always has a selection: a click that would clear it is ignored.
                const id = value[0];
                if (typeof id !== "string" || id === current?.id) return;
                setOwnId(id);
                onSelectedIdChange?.(id);
              }}
              rowHeight={16}
              size="mini"
            />
          </SplitViewPane>
          <SplitViewDivider aria-label="Resize the category list" />
          <SplitViewPane minSize={200} className="mac-system-information-pane">
            {reportMenu ? (
              <ContextualMenu>
                <ContextualMenuTrigger
                  className="mac-system-information-menu-frame"
                  onContextMenuCapture={(event: MouseEvent<HTMLElement>) => {
                    // A secondary click on a row outside the selection chooses that row.
                    const at = (event.target as Element)
                      .closest<HTMLElement>("[role='row'][data-row]")
                      ?.getAttribute("data-row");
                    const id = at == null ? undefined : shownRows[Number(at)]?.id;
                    if (id && !currentRows.includes(id)) chooseRows([id]);
                  }}
                >
                  {reportView}
                </ContextualMenuTrigger>
                <ContextualMenuPopup>{reportMenu}</ContextualMenuPopup>
              </ContextualMenu>
            ) : (
              reportView
            )}
          </SplitViewPane>
        </SplitView>
      </WindowBody>
      {findBar}
      <StatusBar
        variant="breadcrumb"
        role="group"
        aria-label="Path"
        leading={
          <>
            <ComputerIcon />
            <span>{location}</span>
          </>
        }
      />
    </Window>
  );
}

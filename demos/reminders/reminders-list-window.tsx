"use client";

import { Label } from "macalicious/label";
import { MenuItem } from "macalicious/menu-item";
import { ScrollView } from "macalicious/scroll-view";
import { TextField } from "macalicious/text-field";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { type MouseEvent, type PointerEvent, useRef, useState } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { useWindowKeys } from "../desktop/desktop-window-keys";
import type { Reminder, ReminderList } from "./reminders-data";
import { outlineRows } from "./reminders-tree";

const NOTHING: ReadonlySet<string> = new Set();

export interface RemindersListWindowProps extends Omit<WindowProps, "children" | "onChange"> {
  list: ReminderList;
  /** The reminders of this list. */
  reminders: readonly Reminder[];
  onToggleReminder: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onAdd: (title: string) => void;
  controlsProps?: WindowControlsProps;
  onDragRegionPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * One list in a window of its own, as File > Open List in New Window and a double click on its row open
 * it. It shows the same reminders as the main window: a change in either is the other's at once, and is
 * saved as any other. A reminder completed here stays until the window closes.
 */
export function RemindersListWindow({
  list,
  reminders,
  onToggleReminder,
  onRename,
  onAdd,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  ...props
}: RemindersListWindowProps) {
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const [completedHere, setCompletedHere] = useState<ReadonlySet<string>>(NOTHING);
  const newField = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const askNew = () => newField.current?.focus();
  useDesktopAppMenu(
    "reminders",
    "File",
    <MenuItem keyEquivalent="command+n" onClick={askNew}>
      New Reminder
    </MenuItem>,
    titleBar,
  );
  useDesktopAppMenu("reminders", "Edit", null, titleBar);
  useDesktopAppMenu("reminders", "View", null, titleBar);
  useWindowKeys(titleBar, props.state === "key", [{ equivalent: "command+n", run: askNew }]);
  const rows = outlineRows(
    reminders.filter((reminder) => !reminder.completed || completedHere.has(reminder.id)),
    NOTHING,
  );
  const left = reminders.filter((reminder) => !reminder.completed).length;
  const add = () => {
    const title = typed.trim();
    if (!title) return;
    onAdd(title);
    setTyped("");
  };
  return (
    <Window aria-label={`List ${list.name}`} className="mac-reminders-list-window" {...props}>
      <TitleBar
        ref={setTitleBar}
        title={list.name}
        controls={<WindowControls {...controlsProps} />}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />
      <WindowBody background="content" className="mac-reminders-list-window-body">
        <div className="mac-reminders-list-window-head">
          <h2 className="mac-reminders-title">{list.name}</h2>
          <Label color="secondary">{left}</Label>
        </div>
        <ScrollView className="mac-reminders-list-window-rows">
          <ul aria-label={list.name} className="mac-reminders-list-window-list">
            {rows.flatMap((row) =>
              row.kind === "reminder"
                ? [
                    <li
                      key={row.reminder.id}
                      className="mac-reminders-list-window-row"
                      data-depth={row.depth}
                    >
                      <button
                        type="button"
                        className="mac-reminders-circle mac-reminders-list-window-circle"
                        aria-label={`${row.reminder.completed ? "Not completed" : "Completed"}: ${row.reminder.title}`}
                        data-color={list.color}
                        data-completed={row.reminder.completed ? "" : undefined}
                        onClick={() => {
                          setCompletedHere((now) => new Set(now).add(row.reminder.id));
                          onToggleReminder(row.reminder.id);
                        }}
                      />
                      <TextField
                        key={row.reminder.title}
                        bezel="none"
                        aria-label="Title"
                        className="mac-reminders-list-window-field"
                        defaultValue={row.reminder.title}
                        onBlur={(event) => {
                          const title = event.currentTarget.value.trim();
                          if (title && title !== row.reminder.title) {
                            onRename(row.reminder.id, title);
                          } else event.currentTarget.value = row.reminder.title;
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                      />
                    </li>,
                  ]
                : [],
            )}
          </ul>
        </ScrollView>
        <div className="mac-reminders-list-window-new">
          <TextField
            aria-label="New Reminder"
            placeholder="New Reminder"
            inputRef={newField}
            value={typed}
            onValueChange={setTyped}
            onKeyDown={(event) => {
              if (event.key === "Enter") add();
            }}
          />
        </div>
      </WindowBody>
    </Window>
  );
}

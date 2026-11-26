"use client";

import { Alert, AlertButtons, AlertClose, AlertMessage, AlertPopup } from "macalicious/alert";
import { DefaultButton } from "macalicious/default-button";
import { ListView, ListViewRowTitle } from "macalicious/list-view";
import { PushButton } from "macalicious/push-button";
import { type ReactNode, useEffect, useState } from "react";

export interface QuickTimeChooserRow {
  id: string;
  name: string;
}

export interface QuickTimeChooserProps {
  /** What the dialog asks. */
  message: string;
  /** What its default button says. */
  action: string;
  /** Reads the rows each time the dialog opens; null while closed. */
  list: (() => Promise<QuickTimeChooserRow[]>) | null;
  onChoose: (row: QuickTimeChooserRow) => void;
  onCancel: () => void;
  /** Another way to answer, beside the buttons. */
  extra?: ReactNode;
}

/** A dialog asking for one row of a list: Add Clip to End's movies, Move To's folders. */
export function QuickTimeChooser({
  message,
  action,
  list,
  onChoose,
  onCancel,
  extra,
}: QuickTimeChooserProps) {
  const [rows, setRows] = useState<QuickTimeChooserRow[] | string | null>(null);
  const [selected, setSelected] = useState<(string | number)[]>([]);
  useEffect(() => {
    if (!list) return;
    let live = true;
    setRows(null);
    setSelected([]);
    list().then(
      (read) => {
        if (live) setRows(read);
      },
      (error: unknown) => {
        if (live) setRows(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      live = false;
    };
  }, [list]);
  const shown = Array.isArray(rows) ? rows : [];
  const choice = shown.find((row) => row.id === selected[0]);
  return (
    <Alert open={list !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertPopup>
        <AlertMessage>{message}</AlertMessage>
        <div className="mac-quicktime-player-chooser">
          {typeof rows === "string" ? (
            <p role="alert">{rows}</p>
          ) : (
            <ListView
              aria-label={message}
              count={shown.length}
              rowHeight={24}
              getRowId={(index) => shown[index]?.id ?? index}
              getRowLabel={(index) => shown[index]?.name ?? ""}
              renderRow={(index) => <ListViewRowTitle>{shown[index]?.name}</ListViewRowTitle>}
              value={selected}
              onValueChange={setSelected}
              onRowAction={(index) => {
                const row = shown[index];
                if (row) onChoose(row);
              }}
            />
          )}
        </div>
        {extra}
        <AlertButtons>
          <AlertClose render={<PushButton />}>Cancel</AlertClose>
          <DefaultButton disabled={!choice} onClick={() => choice && onChoose(choice)}>
            {action}
          </DefaultButton>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}

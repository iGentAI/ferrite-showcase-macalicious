"use client";

import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { useRef, useState } from "react";
import { type CachedFeed, readFeed } from "./podcasts-server";

/** The longest feed address the module takes (`hosts::MAX_FEED_URL`). */
const FEED_LENGTH = 1024;

/**
 * The address the module reads, in one form: whatever scheme is typed, or none, it is read as
 * `https://`, and the host is in lower case. The path and query keep their case. Text that is no
 * address stays as typed, for the module to refuse.
 */
export function feedAddress(typed: string): string {
  const address = `https://${typed.trim().replace(/^https?:\/\//i, "")}`;
  return URL.canParse(address) ? new URL(address).href : address;
}

/**
 * The id of a show added by its feed, which Apple's directory gave no id: the same address always
 * gives the same id, and it is a plain id as the module requires. 32-bit FNV-1a.
 */
export function showIdOfFeed(feed: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(feed)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return `feed-${(hash >>> 0).toString(16)}`;
}

/** File > Add a Show by URL: reads the feed first, so that only a show that can be read is added. */
export function AddShowSheet({
  anchor,
  onAdd,
  onCancel,
}: {
  anchor: Element | null;
  onAdd: (feed: string, read: CachedFeed) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const asked = useRef(0);
  const address = text.trim() === "" ? "" : feedAddress(text);
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (open) return;
        asked.current += 1;
        onCancel();
      }}
    >
      <SheetPopup anchor={anchor} width={420}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!address || reading) return;
            const ask = ++asked.current;
            setReading(true);
            setProblem(null);
            readFeed(address, 0).then(
              (reply) => {
                if (ask !== asked.current) return;
                setReading(false);
                onAdd(address, reply.feed);
              },
              (error: unknown) => {
                if (ask !== asked.current) return;
                setReading(false);
                setProblem(error instanceof Error ? error.message : String(error));
              },
            );
          }}
        >
          <SheetTitle>Add a Show by URL</SheetTitle>
          <SheetDescription>
            {problem ??
              (reading ? "Reading the feed…" : "Enter the address of the show's RSS feed.")}
          </SheetDescription>
          <TextField
            aria-label="Feed address"
            autoFocus
            maxLength={FEED_LENGTH}
            placeholder="https://feeds.example.com/show"
            value={text}
            onChange={(event) => setText(event.target.value)}
            style={{ width: "100%", marginBlock: 12 }}
          />
          <SheetActions>
            <SheetClose render={<PushButton />}>Cancel</SheetClose>
            <DefaultButton type="submit" disabled={!address || reading}>
              Add
            </DefaultButton>
          </SheetActions>
        </form>
      </SheetPopup>
    </Sheet>
  );
}

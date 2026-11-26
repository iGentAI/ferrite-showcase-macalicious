"use client";

import { Label } from "macalicious/label";
import { TextView } from "macalicious/text-view";
import { type CSSProperties, Fragment } from "react";
import { SpotlightArtwork } from "./spotlight-artwork";
import type { SpotlightItem } from "./spotlight-data";

export interface SpotlightPreviewPaneProps {
  /** The selected result. */
  item: SpotlightItem;
  /** Called with the phrase of a definition's cross-reference when it is chosen. */
  onSee: (phrase: string) => void;
}

/** The facts of a file, folder or application: its kind, then what the index holds. */
function Details({ item }: { item: SpotlightItem }) {
  const rows = [["Kind", item.kind] as const, ...(item.details ?? [])];
  return (
    <dl className="mac-spotlight-app-details">
      {/* Keyed by place: the facts are an ordered list that never changes within an item, and
          two facts may carry the same label. The list itself is keyed by the item's id. */}
      {Array.from(rows.entries(), ([place, [label, value]]) => (
        <div key={place} className="mac-spotlight-app-details-row">
          <Label
            render={<dt />}
            className="mac-spotlight-app-details-label"
            textStyle="small"
            color="secondary"
            align="end"
          >
            {label}
          </Label>
          <Label
            render={<dd />}
            className="mac-spotlight-app-details-value"
            textStyle="small"
            selectable
          >
            {value}
          </Label>
        </div>
      ))}
    </dl>
  );
}

/**
 * What the preview pane shows for the selected result: a dictionary entry, the text of a
 * file, a picture's placeholder over its facts, or the summary of a folder, an application or
 * a document.
 */
export function SpotlightPreviewPane({ item, onSee }: SpotlightPreviewPaneProps) {
  const { preview } = item;

  if (preview.type === "definition") {
    return (
      <article className="mac-spotlight-app-definition">
        <Label
          // The heading's text is the label's children, which Base UI passes in these props.
          render={(props) => <h2 {...props} />}
          className="mac-spotlight-app-definition-title"
          textStyle="title-1"
        >
          {item.name}
        </Label>
        <Label render={<p />} className="mac-spotlight-app-definition-text" selectable>
          {/* Keyed by place: the parts are an ordered list that never changes within an
              entry, and two parts may hold the same words. */}
          {Array.from(preview.text.entries(), ([place, part]) =>
            typeof part === "string" ? (
              <Fragment key={place}>{part}</Fragment>
            ) : (
              // A cross-reference: the library's link, a label rendered as `<a>`. In Spotlight
              // it opens Dictionary, which is what its address asks a Mac to do; here the click
              // is taken and the phrase is looked up instead.
              <Label
                key={place}
                render={<a href={`dict://${encodeURIComponent(part.see)}`} />}
                className="mac-spotlight-app-definition-link"
                textStyle="emphasized"
                color="link"
                onClick={(event) => {
                  event.preventDefault();
                  onSee(part.see);
                }}
              >
                {part.see}
              </Label>
            ),
          )}
        </Label>
      </article>
    );
  }

  if (preview.type === "text") {
    return (
      // The library's text view: it fills the pane, scrolls and takes the keyboard.
      <TextView
        key={item.id}
        className="mac-spotlight-app-text"
        aria-label={`Contents of ${item.name}`}
        readOnly
        monospace
        value={preview.text}
      />
    );
  }

  return (
    <div className="mac-spotlight-app-summary">
      {preview.type === "image" ? (
        // A picture is somebody's photograph or artwork: a flat frame of its proportions.
        <span
          className="mac-spotlight-app-picture"
          style={{ "--_ratio": preview.pixels.width / preview.pixels.height } as CSSProperties}
          aria-hidden="true"
        />
      ) : (
        <SpotlightArtwork category={item.category} size="preview" />
      )}
      <h2 className="mac-spotlight-app-summary-name">{item.name}</h2>
      <Details key={item.id} item={item} />
    </div>
  );
}

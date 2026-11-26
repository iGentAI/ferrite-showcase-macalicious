import { RichTextView } from "macalicious/text-view";

/** Styled content, edited in place by the browser. */
export default function Rich() {
  return (
    <div style={{ width: 320, height: 96 }}>
      <RichTextView aria-label="Document">
        <b>Think different.</b>
        <br />
        Here's to the <i>crazy</i> ones. The misfits. The rebels.
      </RichTextView>
    </div>
  );
}

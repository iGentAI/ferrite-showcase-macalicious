import { PushButton } from "macalicious/push-button";
import { useId, useState } from "react";

/**
 * A form's primary button submits on Return because it is `type="submit"`. While the request
 * runs the button is disabled but keeps focus (`focusableWhenDisabled`), so keyboard users are
 * not thrown back to the top of the page.
 */
export default function FormExample() {
  const [saving, setSaving] = useState(false);
  const labelId = useId();

  return (
    <form
      style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        setTimeout(() => setSaving(false), 1500);
      }}
    >
      <PushButton disabled={saving}>Cancel</PushButton>
      <PushButton
        type="submit"
        variant="primary"
        disabled={saving}
        focusableWhenDisabled
        aria-labelledby={labelId}
      >
        <span id={labelId}>{saving ? "Saving…" : "Save"}</span>
      </PushButton>
    </form>
  );
}

import { useRef, useState } from "react";
import { TextEdit, type TextEditActions, TextEditMenuBar, type TextEditStatus } from "../textedit";

/**
 * TextEdit with the document of the reference screenshots under its menu bar. Type, select
 * text and use the format bar, drag the ruler's markers, and open the dialogs from the File
 * menu: Open… is a window of its own, centred here on the example, and Save… and Print… are
 * sheets on the document. Format turns the document into plain text and back, and its Font and
 * Text submenus style the selection and open the Fonts and Colors panels.
 */
export default function Basic() {
  const actions = useRef<TextEditActions>(null);
  const [status, setStatus] = useState<TextEditStatus>();
  const [busy, setBusy] = useState(false);
  const [desktop, setDesktop] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setDesktop}
      style={{
        position: "relative",
        display: "grid",
        gap: 24,
        justifyItems: "center",
        paddingBlockEnd: 72,
      }}
    >
      <div style={{ justifySelf: "stretch" }}>
        <TextEditMenuBar actions={actions} status={status} disabled={busy} />
      </div>
      <TextEdit
        actionsRef={actions}
        onStatusChange={setStatus}
        onDialogChange={(dialog) => setBusy(dialog !== null)}
        panelContainer={desktop}
        style={{ maxWidth: "100%" }}
      />
    </div>
  );
}

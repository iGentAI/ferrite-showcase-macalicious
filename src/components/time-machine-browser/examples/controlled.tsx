import { TimeMachineBrowser } from "macalicious/time-machine-browser";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useState } from "react";

const backups = [
  { value: "yesterday", label: "Yesterday at 10:17 AM", mark: "Yesterday", files: ["Notes.txt"] },
  {
    value: "today-1",
    label: "Today at 9:12 AM",
    mark: "Today",
    files: ["Notes.txt", "Budget.numbers"],
  },
  {
    value: "today-2",
    label: "Today at 3:34 PM",
    files: ["Notes.txt", "Budget.numbers", "Plan.pdf"],
  },
  { value: "now", label: "Now", caption: "Now", files: ["Notes.txt", "Plan.pdf"] },
];

/**
 * Controlled: the application keeps the selected backup and renders what it holds. Restore is
 * enabled once a file is chosen; Cancel, Restore and Escape report through the callbacks.
 */
export default function Controlled() {
  const [value, setValue] = useState("today-2");
  const [file, setFile] = useState<string | null>(null);
  const [message, setMessage] = useState("Choose a file, then Restore.");
  const files = backups.find((backup) => backup.value === value)?.files ?? [];

  return (
    <div style={{ width: 720, maxWidth: "100%" }}>
      <div style={{ height: 480 }}>
        <TimeMachineBrowser
          backups={backups}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            setFile(null);
          }}
          title="Documents"
          restorable={file !== null}
          onRestore={(backup) => setMessage(`Restore ${file} from ${backup}.`)}
          onCancel={() => setMessage("Cancelled.")}
        >
          <Window width={380} height={220}>
            <TitleBar
              title="Documents"
              controls={<WindowControls minimizeDisabled zoomDisabled />}
            />
            <WindowBody
              background="content"
              style={{ padding: 12, display: "grid", gap: 4, alignContent: "start" }}
            >
              {files.map((name) => (
                <label key={name} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="radio"
                    name="time-machine-file"
                    checked={file === name}
                    onChange={() => setFile(name)}
                  />
                  {name}
                </label>
              ))}
            </WindowBody>
          </Window>
        </TimeMachineBrowser>
      </div>
      <p style={{ margin: "8px 0 0", font: "var(--mac-font-body)" }}>{message}</p>
    </div>
  );
}

import { ManagedWindow } from "macalicious/managed-window";
import { PushButton } from "macalicious/push-button";
import { WindowManager } from "macalicious/window-manager";
import { useState } from "react";
import { app } from "../app";

/**
 * What a desktop page does with the demo: it reads the descriptor and renders the component
 * in one managed window per note. Drag a note by its title bar, resize it by its edges, or
 * close it and open the notes again.
 */
export default function Hosted() {
  const [closed, setClosed] = useState<readonly string[]>([]);
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start", width: "100%" }}>
      <PushButton disabled={closed.length === 0} onClick={() => setClosed([])}>
        Open {app.name}
      </PushButton>
      <WindowManager style={{ justifySelf: "stretch", height: 380 }}>
        {app.notes.map((note) => (
          <ManagedWindow
            key={note.id}
            id={note.id}
            app={app.id}
            title={app.name}
            resizable={app.resizable}
            zoomButton="zoom"
            minWidth={app.minSize.width}
            minHeight={app.minSize.height}
            defaultFrame={note.frame}
            open={!closed.includes(note.id)}
            onOpenChange={(open) => {
              if (!open) setClosed((ids) => [...ids, note.id]);
            }}
            render={(props) => (
              <app.component
                {...props}
                noteId={note.id}
                color={note.color}
                defaultText={note.text}
              />
            )}
          />
        ))}
      </WindowManager>
    </div>
  );
}

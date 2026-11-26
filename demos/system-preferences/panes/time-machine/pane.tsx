import { definePane } from "../../pane";
import { ServedTimeMachine } from "../../served-pages";
import { TimeMachine } from "./time-machine";

export const pane = definePane({
  served: { component: ServedTimeMachine, height: 280 },
  height: 440,
  component: TimeMachine,
  keywords: [
    "backup",
    "back up automatically",
    "select disk",
    "local snapshots",
    "hourly backups",
    "restore",
    "menu bar",
  ],
});

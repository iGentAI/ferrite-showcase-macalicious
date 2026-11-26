import { definePane } from "../../pane";
import { ServedPrinters } from "../../served-pages";
import { PrintersAndScanners } from "./printers-and-scanners";

export const pane = definePane({
  served: { component: ServedPrinters, height: 240 },
  height: 438,
  component: PrintersAndScanners,
  keywords: [
    "printer",
    "scanner",
    "fax",
    "print queue",
    "options and supplies",
    "default printer",
    "paper size",
  ],
});

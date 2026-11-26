"use client";

import {
  BorderedList,
  BorderedListGroupRow,
  BorderedListRow,
  BorderedListRows,
} from "macalicious/bordered-list";
import { Box } from "macalicious/box";
import { Checkbox } from "macalicious/checkbox";
import { GradientButton } from "macalicious/gradient-button";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem, PopUpButtonSeparator } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { StatusDot } from "macalicious/status-dot";
import { useId } from "react";
import { PaneAt, PaneFooter, PaneForm, PaneRow } from "../../form";
import { usePreference, usePreferences } from "../../pane";
import { PrinterPicture } from "./artwork";
import "./printers-and-scanners.css";
import { Uncaptured } from "../uncaptured";

/** The detail box's top-left corner in the window frame. */
const BOX = { x: 229, y: 58 };

/**
 * The one printer of the captures, under a placeholder name: the captured name, location and
 * queue name belong to somebody's printer.
 */
const PRINTER = {
  id: "lp-2270dw",
  name: "Example LP-2270DW series",
  location: "Office",
  kind: "Example LP-2270DW-AirPrint",
  status: "Idle",
};

const PAPER_SIZES = ["US Letter", "US Legal", "A4", "A5", "JIS B5", "Envelope #10"];

/** The lines of the detail box under the buttons: title, value and the value's top edge. */
const DETAILS = [
  ["Location:", PRINTER.location, 191],
  ["Kind:", PRINTER.kind, 213],
  ["Status:", PRINTER.status, 235],
] as const;

/**
 * System Preferences > Printers & Scanners, with its one printer selected and idle. The
 * settings keep their state and print nothing; the buttons that add and remove a printer and
 * those that open the print queue and the options say that this is not part of the demo, as no
 * capture shows what they
 * open. Sharing Preferences opens the Sharing pane.
 *
 * Distances are those of reference/spec/apps/system-preferences-printers-and-scanners.md, in
 * points from the top-left corner of the window frame.
 */
export function PrintersAndScanners() {
  const [selected, setSelected] = usePreference<readonly string[]>(
    "printers-and-scanners.printer",
    [PRINTER.id],
  );
  const [shared, setShared] = usePreference("printers-and-scanners.shared", false);
  const [defaultPrinter, setDefaultPrinter] = usePreference<string>(
    "printers-and-scanners.defaultPrinter",
    "last-used",
  );
  const [paperSize, setPaperSize] = usePreference<string>(
    "printers-and-scanners.defaultPaperSize",
    "US Letter",
  );
  const { showPane } = usePreferences();
  const id = useId();

  return (
    <PaneForm labelWidth={361} gap={8}>
      <PaneAt x={19} y={58}>
        <BorderedList
          style={{ width: 198, height: 296 }}
          footerLabel="Edit printers"
          footer={
            <>
              {/* The cells are 23 pt wide here, narrower than the button's smallest width. */}
              <Uncaptured action="Add a printer, scanner or fax">
                <GradientButton
                  glyph="add"
                  aria-label="Add a printer, scanner or fax"
                  style={{ width: 23, minWidth: 0 }}
                />
              </Uncaptured>
              <Uncaptured action="Remove the selected printer">
                <GradientButton
                  glyph="remove"
                  aria-label="Remove the selected printer"
                  style={{ width: 23, minWidth: 0 }}
                />
              </Uncaptured>
            </>
          }
        >
          <BorderedListRows
            aria-label="Printers"
            rowHeight={33}
            value={selected}
            onValueChange={(value) => {
              if (value.length > 0) setSelected(value);
            }}
          >
            <BorderedListGroupRow style={{ height: 24 }}>Printers</BorderedListGroupRow>
            <BorderedListRow
              value={PRINTER.id}
              aria-label={`${PRINTER.name}, ${PRINTER.status}, Last Used`}
              textValue={PRINTER.name}
              title={PRINTER.name}
              leading={<PrinterPicture width={33} height={25} style={{ marginRight: 1.5 }} />}
            >
              {/* Not the row's subtitle: the captures draw this line in the row's text colour. */}
              <span className="mac-system-preferences-printers-and-scanners-status">
                <StatusDot status="available" size="small" style={{ marginTop: 1 }} />
                {PRINTER.status}, Last Used
              </span>
            </BorderedListRow>
          </BorderedListRows>
        </BorderedList>
      </PaneAt>

      <PaneAt x={BOX.x} y={BOX.y}>
        <Box aria-label={PRINTER.name} style={{ width: 420, height: 296 }}>
          <PaneForm origin={BOX}>
            <PaneAt x={254} y={91}>
              <PrinterPicture width={93} height={64} />
            </PaneAt>
            <PaneAt x={372} y={73}>
              <Label textStyle="emphasized">{PRINTER.name}</Label>
            </PaneAt>
            <PaneAt x={371} y={101}>
              <Uncaptured action="Open Print Queue…">
                <PushButton style={{ width: 160, paddingInline: 0 }}>Open Print Queue…</PushButton>
              </Uncaptured>
            </PaneAt>
            <PaneAt x={371} y={134}>
              <Uncaptured action="Options & Supplies…">
                <PushButton style={{ width: 160, paddingInline: 0 }}>
                  Options & Supplies…
                </PushButton>
              </Uncaptured>
            </PaneAt>

            {DETAILS.map(([title, value, y]) => (
              <PaneAt key={title} x={243} y={y} style={{ gap: 8 }}>
                <Label
                  textStyle="small-emphasized"
                  color="tertiary"
                  align="end"
                  style={{ width: 120 }}
                >
                  {title}
                </Label>
                <Label textStyle="small">{value}</Label>
              </PaneAt>
            ))}

            <PaneAt x={253} y={299}>
              <Checkbox checked={shared} onCheckedChange={setShared}>
                Share this printer on the network
              </Checkbox>
            </PaneAt>
            <PaneAt x={495} y={297}>
              <PushButton
                size="small"
                onClick={() => showPane("sharing")}
                style={{ width: 132, paddingInline: 0 }}
              >
                Sharing Preferences…
              </PushButton>
            </PaneAt>
          </PaneForm>
        </Box>
      </PaneAt>

      <PaneRow y={370} label="Default printer:" labelId={`${id}-printer`} labelOffset={2.5}>
        <PopUpButton
          aria-labelledby={`${id}-printer`}
          value={defaultPrinter}
          onValueChange={(value) => {
            if (value != null) setDefaultPrinter(value);
          }}
          style={{ width: 230 }}
        >
          <PopUpButtonItem value="last-used">Last Printer Used</PopUpButtonItem>
          <PopUpButtonSeparator />
          <PopUpButtonItem value={PRINTER.id}>{PRINTER.name}</PopUpButtonItem>
        </PopUpButton>
      </PaneRow>
      <PaneRow y={401} label="Default paper size:" labelId={`${id}-paper`} labelOffset={2.5}>
        <PopUpButton
          aria-labelledby={`${id}-paper`}
          value={paperSize}
          onValueChange={(value) => {
            if (value != null) setPaperSize(value);
          }}
          style={{ width: 230 }}
        >
          {PAPER_SIZES.map((size) => (
            <PopUpButtonItem key={size} value={size}>
              {size}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      </PaneRow>
      <PaneFooter x={627} y={401}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </PaneForm>
  );
}

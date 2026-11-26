import { Form, FormRow } from "macalicious/form";

const rows = [
  ["Model Name:", "MacBook Pro"],
  ["Model Identifier:", "MacBookPro15,1"],
  ["Processor Name:", "8-Core Intel Core i9"],
  ["Processor Speed:", "2.3 GHz"],
  ["Memory:", "16 GB"],
];

/**
 * Keys and values, as in a printer's Location, Kind and Status (labels at the end of their
 * column) and in System Information's Hardware Overview (labels at its start, small text).
 */
export default function Values() {
  return (
    <div style={{ display: "flex", gap: 40, alignItems: "start" }}>
      <Form render={<div />} style={{ "--mac-form-row-gap": "6px" } as never}>
        <FormRow kind="value" label="Location:">
          Castle
        </FormRow>
        <FormRow kind="value" label="Kind:">
          Printopia-D1FBAAFB-AirPrint
        </FormRow>
        <FormRow kind="value" label="Status:">
          Idle
        </FormRow>
      </Form>
      <Form
        render={<div />}
        size="small"
        labelAlign="start"
        style={{ "--mac-form-row-gap": "0px", "--mac-form-label-gap": "20px" } as never}
      >
        {rows.map(([key, value]) => (
          <FormRow key={key} kind="value" label={key}>
            {value}
          </FormRow>
        ))}
      </Form>
    </div>
  );
}

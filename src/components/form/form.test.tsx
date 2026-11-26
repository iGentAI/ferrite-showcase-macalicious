import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "../checkbox";
import { PopUpButton, PopUpButtonItem } from "../pop-up-button";
import { TextField } from "../text-field";
import { Form, FormRow, FormSeparator } from "./index";

describe("Form", () => {
  it("renders a form with its class, default size and label alignment", () => {
    render(<Form aria-label="Settings" />);
    const form = screen.getByRole("form", { name: "Settings" });
    expect(form.tagName).toBe("FORM");
    expect(form).toHaveClass("mac-form");
    expect(form).toHaveAttribute("data-size", "regular");
    expect(form).toHaveAttribute("data-label-align", "end");
  });

  it("reflects size and label alignment, and sets the label column's width", () => {
    const { rerender } = render(
      <Form data-testid="form" size="small" labelAlign="start" labelWidth={120} />,
    );
    const form = screen.getByTestId("form");
    expect(form).toHaveAttribute("data-size", "small");
    expect(form).toHaveAttribute("data-label-align", "start");
    expect(form.style.getPropertyValue("--mac-form-label-width")).toBe("120px");

    rerender(<Form data-testid="form" labelWidth="30%" style={{ width: 300 }} />);
    expect(form.style.getPropertyValue("--mac-form-label-width")).toBe("30%");
    expect(form).toHaveStyle({ width: "300px" });
  });

  it("forwards ref, className and native attributes, and renders another element", () => {
    const ref = createRef<HTMLFormElement>();
    const { rerender } = render(<Form ref={ref} className="extra" id="settings" />);
    expect(ref.current).toHaveClass("mac-form", "extra");
    expect(ref.current).toHaveAttribute("id", "settings");

    rerender(<Form data-testid="form" render={<div />} />);
    expect(screen.getByTestId("form").tagName).toBe("DIV");
    expect(screen.getByTestId("form")).toHaveClass("mac-form");
  });

  it("submits the values of its fields", async () => {
    const onFormSubmit = vi.fn();
    render(
      <Form onFormSubmit={onFormSubmit}>
        <FormRow label="Computer Name:">
          <TextField name="computer" defaultValue="ismh15" />
        </FormRow>
        <button type="submit">Apply</button>
      </Form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onFormSubmit).toHaveBeenCalledTimes(1);
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({ computer: "ismh15" });
  });
});

describe("FormRow", () => {
  it("names and describes the control of a field row", () => {
    render(
      <Form>
        <FormRow label="Computer Name:" description="Shown on your local network.">
          <TextField defaultValue="ismh15" />
        </FormRow>
      </Form>,
    );
    const field = screen.getByRole("textbox", { name: "Computer Name:" });
    expect(field).toHaveAccessibleDescription("Shown on your local network.");
  });

  it("names a pop-up button, and a click on the label does not open it", async () => {
    render(
      <Form>
        <FormRow label="Start week on:">
          <PopUpButton defaultValue="sunday">
            <PopUpButtonItem value="sunday">Sunday</PopUpButtonItem>
            <PopUpButtonItem value="monday">Monday</PopUpButtonItem>
          </PopUpButton>
        </FormRow>
      </Form>,
    );
    const button = screen.getByRole("combobox", { name: "Start week on:" });
    await userEvent.click(screen.getByText("Start week on:"));
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("makes a group row a group named by its label", () => {
    render(
      <Form>
        <FormRow label="Application:" kind="group" orientation="vertical">
          <Checkbox>Play sound effects</Checkbox>
          <Checkbox>Save history</Checkbox>
        </FormRow>
      </Form>,
    );
    const group = screen.getByRole("group", { name: "Application:" });
    expect(group).toHaveClass("mac-form-row");
    expect(group).toHaveAttribute("data-orientation", "vertical");
    // Each checkbox keeps its own name.
    expect(screen.getByRole("checkbox", { name: "Play sound effects" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Save history" })).toBeInTheDocument();
  });

  it("makes a value row a term and its definition", () => {
    render(
      <Form render={<div />}>
        <FormRow kind="value" label="Location:">
          Castle
        </FormRow>
      </Form>,
    );
    expect(screen.getByRole("term")).toHaveTextContent("Location:");
    expect(screen.getByRole("definition")).toHaveTextContent("Castle");
  });

  it("keeps a row without a label in the control column, with the control's own name", () => {
    render(
      <Form>
        <FormRow data-testid="row">
          <Checkbox>Show Holidays calendar</Checkbox>
        </FormRow>
      </Form>,
    );
    const row = screen.getByTestId("row");
    expect(row.querySelector(".mac-form-label")).toBeNull();
    expect(row.querySelector(".mac-form-controls")).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: "Show Holidays calendar" })).toBeInTheDocument();
  });

  it("disables the control of a disabled field row and marks the row", () => {
    render(
      <Form>
        <FormRow label="Password:" disabled data-testid="row">
          <TextField />
        </FormRow>
      </Form>,
    );
    expect(screen.getByTestId("row")).toHaveAttribute("data-disabled");
    expect(screen.getByRole("textbox", { name: "Password:" })).toBeDisabled();
  });

  it("disables the control of a disabled row that has no label", async () => {
    const onCheckedChange = vi.fn();
    render(
      <Form>
        <FormRow disabled data-testid="row">
          <Checkbox onCheckedChange={onCheckedChange}>Show Holidays calendar</Checkbox>
        </FormRow>
        <FormRow>
          <Checkbox>Show Birthdays calendar</Checkbox>
        </FormRow>
      </Form>,
    );
    expect(screen.getByTestId("row")).toHaveAttribute("data-disabled");
    const checkbox = screen.getByRole("checkbox", { name: "Show Holidays calendar" });
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(checkbox);
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(checkbox).not.toBeChecked();
    // A row that is not disabled leaves its control alone.
    const enabled = screen.getByRole("checkbox", { name: "Show Birthdays calendar" });
    await userEvent.click(enabled);
    expect(enabled).toBeChecked();
  });

  it("labels a control of another kind with a native label when given labelFor", async () => {
    render(
      <Form render={<div />}>
        <FormRow label="Homepage:" labelFor="homepage" data-testid="row">
          <input id="homepage" defaultValue="apple.com" />
        </FormRow>
      </Form>,
    );
    const label = screen.getByText("Homepage:");
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveClass("mac-form-label");
    expect(label).toHaveAttribute("for", "homepage");
    const input = screen.getByRole("textbox", { name: "Homepage:" });
    // A native label gives its control the focus when it is clicked.
    await userEvent.click(label);
    expect(input).toHaveFocus();
    // The row is a plain row: no group, and no Base UI field around the control.
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.getByTestId("row")).toHaveAttribute("data-kind", "field");
  });

  it("with labelFor, marks a disabled row and shows a description without wiring either", () => {
    render(
      <Form render={<div />}>
        <FormRow
          label="Homepage:"
          labelFor="homepage"
          disabled
          description="Opens in new windows."
          data-testid="row"
        >
          <input id="homepage" />
        </FormRow>
      </Form>,
    );
    const row = screen.getByTestId("row");
    expect(row).toHaveAttribute("data-disabled");
    expect(row.querySelector(".mac-form-description")).toHaveTextContent("Opens in new windows.");
    // As documented: disabling and describing the control are the caller's with labelFor.
    const input = screen.getByRole("textbox", { name: "Homepage:" });
    expect(input).toBeEnabled();
    expect(input).not.toHaveAccessibleDescription();
  });

  it("with labelFor, a group or value row is a plain labelled row", () => {
    render(
      <Form render={<div />}>
        <FormRow kind="group" label="Show:" labelFor="hours">
          <input id="hours" />
          <span>hours at a time</span>
        </FormRow>
        <FormRow kind="value" label="Kind:" labelFor="kind">
          <input id="kind" />
        </FormRow>
      </Form>,
    );
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.queryByRole("term")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Show:" })).toHaveAttribute("id", "hours");
    expect(screen.getByRole("textbox", { name: "Kind:" })).toHaveAttribute("id", "kind");
  });

  it("reflects alignment and forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Form>
        <FormRow ref={ref} label="Size:" align="center" className="extra" id="size-row">
          <TextField />
        </FormRow>
      </Form>,
    );
    expect(ref.current).toHaveClass("mac-form-row", "extra");
    expect(ref.current).toHaveAttribute("id", "size-row");
    expect(ref.current).toHaveAttribute("data-align", "center");
    expect(ref.current).toHaveAttribute("data-kind", "field");
  });
});

describe("FormSeparator", () => {
  it("is a separator with the form's class beside its own", () => {
    render(
      <Form>
        <FormSeparator className="extra" />
      </Form>,
    );
    expect(screen.getByRole("separator")).toHaveClass(
      "mac-separator",
      "mac-form-separator",
      "extra",
    );
  });
});

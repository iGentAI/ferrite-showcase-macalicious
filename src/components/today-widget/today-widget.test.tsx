import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "../switch";
import { TodayWidget, TodayWidgetDate, TodayWidgetRow, TodayWidgetSummary } from "./index";

describe("TodayWidget", () => {
  it("is a region named by its title, with the content after the header", () => {
    render(<TodayWidget title="Stocks">Prices</TodayWidget>);
    const widget = screen.getByRole("region", { name: "Stocks" });
    expect(widget).toHaveClass("mac-today-widget");
    expect(widget.firstElementChild).toHaveTextContent("Stocks");
    expect(widget.lastElementChild).toHaveTextContent("Prices");
  });

  it("has no header without a title and takes an aria-label instead", () => {
    render(<TodayWidget aria-label="Quick settings">Rows</TodayWidget>);
    const widget = screen.getByRole("region", { name: "Quick settings" });
    expect(widget).not.toHaveAttribute("aria-labelledby");
    expect(widget.children).toHaveLength(1);
  });

  it("hides the icon from assistive technology", () => {
    render(<TodayWidget title="Stocks" icon={<svg data-testid="icon" />} />);
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("gives each widget its own title id", () => {
    render(
      <>
        <TodayWidget title="Stocks" />
        <TodayWidget title="Weather" />
      </>,
    );
    expect(screen.getByRole("region", { name: "Stocks" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Weather" })).toBeInTheDocument();
  });

  it("forwards ref, className, style and attributes to the root", () => {
    const ref = createRef<HTMLElement>();
    render(
      <TodayWidget ref={ref} title="Stocks" className="extra" id="stocks" style={{ width: 300 }} />,
    );
    expect(ref.current?.tagName).toBe("SECTION");
    expect(ref.current).toHaveClass("mac-today-widget", "extra");
    expect(ref.current).toHaveAttribute("id", "stocks");
    expect(ref.current).toHaveStyle({ width: "300px" });
  });
});

describe("TodayWidgetRow", () => {
  it("names the control it holds and operates it from anywhere on the row", async () => {
    const onCheckedChange = vi.fn();
    render(
      <TodayWidgetRow label="Do Not Disturb">
        <Switch onCheckedChange={onCheckedChange} />
      </TodayWidgetRow>,
    );
    const control = screen.getByRole("switch", { name: "Do Not Disturb" });
    expect(control).toHaveAttribute("aria-checked", "false");
    await userEvent.click(screen.getByText("Do Not Disturb"));
    expect(control).toHaveAttribute("aria-checked", "true");
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
  });

  it("operates the control from the keyboard", async () => {
    render(
      <TodayWidgetRow label="Night Shift">
        <Switch />
      </TodayWidgetRow>,
    );
    await userEvent.tab();
    const control = screen.getByRole("switch", { name: "Night Shift" });
    expect(control).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(control).toHaveAttribute("aria-checked", "true");
  });

  it("hides the glyph and forwards ref, className and attributes", () => {
    const ref = createRef<HTMLLabelElement>();
    render(
      <TodayWidgetRow
        ref={ref}
        label="Night Shift"
        icon={<svg data-testid="glyph" />}
        className="extra"
        id="night-shift"
      />,
    );
    expect(ref.current?.tagName).toBe("LABEL");
    expect(ref.current).toHaveClass("mac-today-widget-row", "extra");
    expect(ref.current).toHaveAttribute("id", "night-shift");
    expect(screen.getByTestId("glyph").parentElement).toHaveAttribute("aria-hidden", "true");
  });
});

describe("TodayWidgetDate", () => {
  it("shows the two lines in order and forwards ref and className", () => {
    const ref = createRef<HTMLDivElement>();
    render(<TodayWidgetDate ref={ref} weekday="Thursday," date="October 3" className="extra" />);
    expect(ref.current).toHaveClass("mac-today-widget-date", "extra");
    expect(ref.current?.children[0]).toHaveTextContent("Thursday,");
    expect(ref.current?.children[1]).toHaveTextContent("October 3");
  });
});

describe("TodayWidgetSummary", () => {
  it("shows its paragraphs, hides the glyph and forwards ref and className", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <TodayWidgetSummary ref={ref} icon={<svg data-testid="weather" />} className="extra">
        <p>Partly cloudy.</p>
        <p>One event today.</p>
      </TodayWidgetSummary>,
    );
    const summary = ref.current as HTMLDivElement;
    expect(summary).toHaveClass("mac-today-widget-summary", "extra");
    expect(within(summary).getByText("Partly cloudy.")).toBeInTheDocument();
    expect(within(summary).getByText("One event today.")).toBeInTheDocument();
    expect(screen.getByTestId("weather").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("has no glyph box without a glyph", () => {
    render(
      <TodayWidgetSummary data-testid="summary">
        <p>Clear.</p>
      </TodayWidgetSummary>,
    );
    expect(screen.getByTestId("summary").children).toHaveLength(1);
  });
});

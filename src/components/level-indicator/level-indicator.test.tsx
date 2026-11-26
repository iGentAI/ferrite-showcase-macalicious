import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LevelIndicator } from "./index";

const meter = () => screen.getByRole("meter");
const filled = (selector: string) => meter().querySelectorAll(`${selector}[data-filled]`).length;

describe("LevelIndicator", () => {
  it("is a read-only continuous meter by default", () => {
    render(<LevelIndicator value={40} aria-label="Disk usage" />);
    const indicator = screen.getByRole("meter", { name: "Disk usage" });
    expect(indicator).toHaveClass("mac-level-indicator");
    expect(indicator).toHaveAttribute("data-variant", "continuous");
    expect(indicator).toHaveAttribute("data-level", "normal");
    expect(indicator).toHaveAttribute("aria-valuenow", "40");
    expect(indicator).toHaveAttribute("aria-valuemin", "0");
    expect(indicator).toHaveAttribute("aria-valuemax", "100");
    expect(indicator).not.toHaveAttribute("tabindex");
    expect(indicator.querySelector<HTMLElement>(".mac-level-indicator-fill")?.style.width).toBe(
      "40%",
    );
  });

  it("turns to warning and critical as a value rises past the limits", () => {
    const props = { warningValue: 70, criticalValue: 90, "aria-label": "Disk usage" };
    const { rerender } = render(<LevelIndicator value={69} {...props} />);
    expect(meter()).toHaveAttribute("data-level", "normal");
    rerender(<LevelIndicator value={70} {...props} />);
    expect(meter()).toHaveAttribute("data-level", "warning");
    rerender(<LevelIndicator value={95} {...props} />);
    expect(meter()).toHaveAttribute("data-level", "critical");
  });

  it("treats low values as the problem when the critical value is below the warning value", () => {
    const props = { warningValue: 30, criticalValue: 10, "aria-label": "Battery" };
    const { rerender } = render(<LevelIndicator value={80} {...props} />);
    expect(meter()).toHaveAttribute("data-level", "normal");
    rerender(<LevelIndicator value={25} {...props} />);
    expect(meter()).toHaveAttribute("data-level", "warning");
    rerender(<LevelIndicator value={10} {...props} />);
    expect(meter()).toHaveAttribute("data-level", "critical");
  });

  it("works with only one of the two limits", () => {
    const { rerender } = render(<LevelIndicator value={50} criticalValue={40} aria-label="L" />);
    expect(meter()).toHaveAttribute("data-level", "critical");
    rerender(<LevelIndicator value={50} warningValue={40} aria-label="L" />);
    expect(meter()).toHaveAttribute("data-level", "warning");
  });

  it("draws one discrete segment per unit and fills whole segments only", () => {
    const { rerender } = render(
      <LevelIndicator variant="discrete" value={3} max={8} aria-label="Signal" />,
    );
    expect(meter().querySelectorAll(".mac-level-indicator-segment")).toHaveLength(8);
    expect(filled(".mac-level-indicator-segment")).toBe(3);

    rerender(<LevelIndicator variant="discrete" value={3.6} max={8} aria-label="Signal" />);
    expect(filled(".mac-level-indicator-segment")).toBe(4);

    rerender(<LevelIndicator variant="discrete" value={20} max={8} aria-label="Signal" />);
    expect(filled(".mac-level-indicator-segment")).toBe(8);
  });

  it("counts segments from min", () => {
    render(<LevelIndicator variant="discrete" value={7} min={5} max={10} aria-label="Level" />);
    expect(meter().querySelectorAll(".mac-level-indicator-segment")).toHaveLength(5);
    expect(filled(".mac-level-indicator-segment")).toBe(2);
  });

  it("draws at most 100 segments, each a share of the range, and none for a range that is not finite", () => {
    const { container, rerender } = render(
      <LevelIndicator variant="discrete" max={5000} value={5000} aria-label="Level" />,
    );
    const segments = () => container.querySelectorAll(".mac-level-indicator-segment").length;
    const filled = () => container.querySelectorAll("[data-filled]").length;
    expect(segments()).toBe(100);
    expect(filled()).toBe(100);

    // 100 of 5000 is 2%: two of the hundred segments, not all of them.
    rerender(<LevelIndicator variant="discrete" max={5000} value={100} aria-label="Level" />);
    expect(filled()).toBe(2);

    rerender(
      <LevelIndicator
        variant="discrete"
        max={Number.POSITIVE_INFINITY}
        value={3}
        aria-label="Level"
      />,
    );
    expect(segments()).toBe(0);
  });

  it("colours each filled segment by its own level when tiered", () => {
    const levels = (container: HTMLElement) =>
      Array.from(container.querySelectorAll(".mac-level-indicator-segment")).map((segment) =>
        segment.getAttribute("data-level"),
      );
    const { container, rerender } = render(
      <LevelIndicator
        variant="discrete"
        tiered
        max={5}
        value={5}
        warningValue={3}
        criticalValue={5}
        aria-label="Disk"
      />,
    );
    expect(meter()).toHaveAttribute("data-tiered", "rising");
    expect(meter()).toHaveAttribute("data-level", "critical");
    expect(levels(container)).toEqual(["normal", "normal", "warning", "warning", "critical"]);

    // Low values are the problem: the first segments carry the warning. Empty ones carry none.
    rerender(
      <LevelIndicator
        variant="discrete"
        tiered
        max={5}
        value={4}
        warningValue={2}
        criticalValue={1}
        aria-label="Battery"
      />,
    );
    expect(meter()).toHaveAttribute("data-tiered", "falling");
    expect(levels(container)).toEqual(["critical", "warning", "normal", "normal", null]);

    // Not tiered: no segment carries a level, and the root's level colours them all.
    rerender(
      <LevelIndicator variant="discrete" max={5} value={5} warningValue={3} aria-label="Disk" />,
    );
    expect(meter()).not.toHaveAttribute("data-tiered");
    expect(levels(container)).toEqual([null, null, null, null, null]);
  });

  it("tells a tiered continuous fill where its colours change, along the fill", () => {
    const stops = (container: HTMLElement) => {
      const fill = container.querySelector(".mac-level-indicator-fill") as HTMLElement;
      return [fill.style.getPropertyValue("--_t1"), fill.style.getPropertyValue("--_t2")];
    };
    const { container, rerender } = render(
      <LevelIndicator tiered value={80} warningValue={40} criticalValue={60} aria-label="Disk" />,
    );
    // The fill is 80 long: 40 is half way along it and 60 three quarters.
    expect(stops(container)).toEqual(["50%", "75%"]);
    expect((container.querySelector(".mac-level-indicator-fill") as HTMLElement).style.width).toBe(
      "80%",
    );

    // Low values are the problem: red up to the critical value, yellow up to the warning.
    rerender(
      <LevelIndicator tiered value={80} warningValue={40} criticalValue={20} aria-label="B" />,
    );
    expect(meter()).toHaveAttribute("data-tiered", "falling");
    expect(stops(container)).toEqual(["25%", "50%"]);

    // Only a warning value: the second change never comes.
    rerender(<LevelIndicator tiered value={80} warningValue={40} aria-label="Disk" />);
    expect(stops(container)).toEqual(["50%", "1000000%"]);

    // Neither limit, or a style without levels: not tiered at all.
    rerender(<LevelIndicator tiered value={80} aria-label="Disk" />);
    expect(meter()).not.toHaveAttribute("data-tiered");
    rerender(
      <LevelIndicator variant="storage" tiered value={80} warningValue={40} aria-label="D" />,
    );
    expect(meter()).not.toHaveAttribute("data-tiered");
  });

  it("draws a rating as stars and has no warning level", () => {
    render(
      <LevelIndicator variant="rating" value={4} max={5} warningValue={1} aria-label="Rating" />,
    );
    expect(meter().querySelectorAll(".mac-level-indicator-star")).toHaveLength(5);
    expect(filled(".mac-level-indicator-star")).toBe(4);
    expect(meter()).not.toHaveAttribute("data-level");
    expect(meter()).toHaveAttribute("aria-valuenow", "4");
  });

  it("draws tick marks only under a continuous indicator and only for two or more", () => {
    const { rerender } = render(<LevelIndicator value={40} tickMarks={5} aria-label="Level" />);
    const ticks = () => meter().querySelector<HTMLElement>(".mac-level-indicator-ticks");
    expect(ticks()?.style.getPropertyValue("--_ticks")).toBe("5");

    rerender(<LevelIndicator value={40} tickMarks={1} aria-label="Level" />);
    expect(ticks()).not.toBeInTheDocument();

    rerender(<LevelIndicator variant="storage" value={40} tickMarks={5} aria-label="Level" />);
    expect(ticks()).not.toBeInTheDocument();
  });

  it("reflects the relevancy and storage variants", () => {
    const { rerender } = render(
      <LevelIndicator variant="relevancy" value={60} aria-label="Relevance" />,
    );
    expect(meter()).toHaveAttribute("data-variant", "relevancy");
    rerender(<LevelIndicator variant="storage" value={60} aria-label="Used" />);
    expect(meter()).toHaveAttribute("data-variant", "storage");
    expect(meter()).not.toHaveAttribute("data-level");
  });

  it("passes a custom value text through", () => {
    render(
      <LevelIndicator
        variant="rating"
        value={3}
        max={5}
        getAriaValueText={(_, value) => `${value} of 5 stars`}
        aria-label="Rating"
      />,
    );
    expect(meter()).toHaveAttribute("aria-valuetext", "3 of 5 stars");
  });

  it("keeps the tiers of a continuous fill in place when the value is beyond the range", () => {
    const stop = (container: HTMLElement, name: string) =>
      container
        .querySelector<HTMLElement>(".mac-level-indicator-fill")
        ?.style.getPropertyValue(name);
    const { container, rerender } = render(
      <LevelIndicator tiered value={200} warningValue={40} aria-label="Disk" />,
    );
    // The fill is the whole track, not twice it: the warning starts 40% along, not 20%.
    expect(stop(container, "--_t1")).toBe("40%");

    rerender(
      <LevelIndicator
        tiered
        min={20}
        max={120}
        value={500}
        warningValue={60}
        criticalValue={100}
        aria-label="Disk"
      />,
    );
    expect(stop(container, "--_t1")).toBe("40%");
    expect(stop(container, "--_t2")).toBe("80%");

    // Below the range there is no fill, and the stops fall outside it.
    rerender(<LevelIndicator tiered value={-50} warningValue={40} aria-label="Disk" />);
    expect(stop(container, "--_t1")).toBe("1000000%");
  });

  it("gives each of 100 segments an equal share of a range that is not whole", () => {
    const { container, rerender } = render(
      <LevelIndicator variant="discrete" max={150.4} value={149.3} aria-label="Level" />,
    );
    const filled = () => container.querySelectorAll("[data-filled]").length;
    expect(container.querySelectorAll(".mac-level-indicator-segment")).toHaveLength(100);
    // One segment stands for 1.504, not for the 1.5 of the rounded range: 149.3 is 99.3
    // segments, and only the whole range fills all hundred.
    expect(filled()).toBe(99);
    rerender(<LevelIndicator variant="discrete" max={150.4} value={150.4} aria-label="Level" />);
    expect(filled()).toBe(100);
  });

  it("keeps Base UI's state forms of className and style, and the function form of render", () => {
    render(
      <LevelIndicator
        value={1}
        aria-label="L"
        className={() => "from-state"}
        style={() => ({ opacity: 0.5 })}
        render={(props) => <div {...props} data-rendered="" />}
      />,
    );
    expect(meter()).toHaveClass("mac-level-indicator", "from-state");
    expect(meter()).toHaveAttribute("data-rendered");
    expect(meter().style.opacity).toBe("0.5");
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<LevelIndicator ref={ref} value={1} className="extra" id="level" aria-label="L" />);
    expect(ref.current).toBe(meter());
    expect(ref.current).toHaveClass("mac-level-indicator", "extra");
    expect(ref.current).toHaveAttribute("id", "level");
  });

  it("shows min when it is given no value", () => {
    render(<LevelIndicator min={2} max={8} aria-label="L" />);
    expect(meter()).toHaveAttribute("aria-valuenow", "2");
  });
});

describe("LevelIndicator, editable", () => {
  const slider = () => screen.getByRole("slider");
  const stars = () => document.querySelectorAll(".mac-level-indicator-star[data-filled]").length;

  it("is a named slider instead of a meter", () => {
    render(
      <LevelIndicator variant="rating" editable defaultValue={2} max={5} aria-label="Rating" />,
    );
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    const input = screen.getByRole("slider", { name: "Rating" });
    expect(input).toHaveAttribute("aria-valuenow", "2");
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("max", "5");
    expect(input.closest(".mac-level-indicator")).toHaveAttribute("data-editable");
    expect(stars()).toBe(2);
  });

  it("can be named by another element", () => {
    const { rerender } = render(
      <>
        <span id="volume">Alert volume</span>
        <LevelIndicator variant="discrete" editable max={10} aria-labelledby="volume" />
      </>,
    );
    // The name must reach the element that has the slider role, not only the group around it.
    const slider = screen.getByRole("slider", { name: "Alert volume" });
    expect(slider).toHaveAttribute("aria-labelledby", "volume");

    rerender(
      <>
        <span id="volume">Alert volume</span>
        <LevelIndicator variant="discrete" max={10} aria-labelledby="volume" />
      </>,
    );
    expect(screen.getByRole("meter", { name: "Alert volume" })).toBeInTheDocument();
  });

  it("can be described by another element", () => {
    const { rerender } = render(
      <>
        <span id="hint">Higher is louder.</span>
        <LevelIndicator
          variant="discrete"
          editable
          max={10}
          aria-label="Volume"
          aria-describedby="hint"
          aria-details="hint"
        />
      </>,
    );
    // The description belongs to the element with the slider role, not to the group around it.
    const slider = screen.getByRole("slider", { name: "Volume" });
    expect(slider).toHaveAccessibleDescription("Higher is louder.");
    expect(slider).toHaveAttribute("aria-details", "hint");
    const root = slider.closest(".mac-level-indicator");
    expect(root).not.toHaveAttribute("aria-describedby");
    expect(root).not.toHaveAttribute("aria-details");

    rerender(
      <>
        <span id="hint">Higher is louder.</span>
        <LevelIndicator variant="discrete" editable max={10} aria-label="Volume" />
      </>,
    );
    expect(screen.getByRole("slider")).not.toHaveAttribute("aria-details");
    expect(screen.getByRole("slider")).not.toHaveAccessibleDescription();

    rerender(
      <>
        <span id="hint">Higher is louder.</span>
        <LevelIndicator variant="discrete" max={10} aria-label="Volume" aria-describedby="hint" />
      </>,
    );
    expect(screen.getByRole("meter", { name: "Volume" })).toHaveAccessibleDescription(
      "Higher is louder.",
    );
  });

  it("has aria-details in server markup when read-only, and from its mount on when editable", () => {
    // `editable` may be a boolean that is only known when the component renders.
    const html = (editable: boolean) =>
      renderToString(
        <LevelIndicator editable={editable} max={10} aria-label="Volume" aria-details="hint" />,
      );
    expect(html(false)).toContain('aria-details="hint"');
    // Base UI has no prop that puts it on the range input, so it is set when the input mounts
    // (see "can be described by another element"): markup from a server has it after hydration.
    expect(html(true)).not.toContain("aria-details");
  });

  it("is reachable with Tab and changes with the arrow keys, Home and End (uncontrolled)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();
    render(
      <LevelIndicator
        variant="rating"
        editable
        defaultValue={2}
        max={5}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
        aria-label="Rating"
      />,
    );
    await user.tab();
    expect(slider()).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith(3);
    expect(onValueCommitted).toHaveBeenLastCalledWith(3, expect.anything());
    expect(slider()).toHaveAttribute("aria-valuenow", "3");
    expect(stars()).toBe(3);

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(stars()).toBe(1);
    await user.keyboard("{End}");
    expect(stars()).toBe(5);
    await user.keyboard("{ArrowRight}");
    expect(stars()).toBe(5);
    await user.keyboard("{Home}");
    expect(stars()).toBe(0);
    expect(onValueChange).toHaveBeenLastCalledWith(0);
  });

  it("follows the value prop when controlled and only reports changes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <LevelIndicator
        variant="rating"
        editable
        value={2}
        max={5}
        onValueChange={onValueChange}
        aria-label="Rating"
      />,
    );
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(3);
    expect(stars()).toBe(2);

    rerender(
      <LevelIndicator
        variant="rating"
        editable
        value={4}
        max={5}
        onValueChange={onValueChange}
        aria-label="Rating"
      />,
    );
    expect(stars()).toBe(4);
    expect(slider()).toHaveAttribute("aria-valuenow", "4");
  });

  it("works as a controlled component driven by state", async () => {
    const user = userEvent.setup();
    function Rating() {
      const [value, setValue] = useState(1);
      return (
        <LevelIndicator
          variant="rating"
          editable
          value={value}
          onValueChange={setValue}
          max={5}
          aria-label="Rating"
        />
      );
    }
    render(<Rating />);
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(stars()).toBe(3);
  });

  it("steps a continuous indicator by `step` and updates its level", async () => {
    const user = userEvent.setup();
    render(
      <LevelIndicator
        editable
        defaultValue={60}
        step={10}
        warningValue={70}
        criticalValue={90}
        aria-label="Disk"
      />,
    );
    const root = slider().closest(".mac-level-indicator");
    expect(root).toHaveAttribute("data-level", "normal");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(slider()).toHaveAttribute("aria-valuenow", "70");
    expect(root).toHaveAttribute("data-level", "warning");
    expect(root?.querySelector<HTMLElement>(".mac-level-indicator-fill")?.style.width).toBe("70%");
  });

  it("always steps segments and stars by one, whatever `step` says", async () => {
    const user = userEvent.setup();
    render(
      <LevelIndicator
        variant="discrete"
        editable
        defaultValue={3}
        max={10}
        step={5}
        aria-label="L"
      />,
    );
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(slider()).toHaveAttribute("aria-valuenow", "4");
  });

  it("steps a capped range by the share of it that one segment stands for", async () => {
    const user = userEvent.setup();
    const filled = () => document.querySelectorAll(".mac-level-indicator-segment[data-filled]");
    render(
      <LevelIndicator variant="discrete" editable defaultValue={0} max={5000} aria-label="L" />,
    );
    // 5000 units on 100 segments: an arrow key moves one segment, which is 50 units.
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(slider()).toHaveAttribute("aria-valuenow", "50");
    expect(filled()).toHaveLength(1);
    await user.keyboard("{PageUp}");
    expect(slider()).toHaveAttribute("aria-valuenow", "550");
    expect(filled()).toHaveLength(11);
    await user.keyboard("{ArrowLeft}");
    expect(slider()).toHaveAttribute("aria-valuenow", "500");
    expect(filled()).toHaveLength(10);
  });

  it("steps a capped range that is not whole by an equal share, up to max", async () => {
    const user = userEvent.setup();
    const filled = () => document.querySelectorAll(".mac-level-indicator-segment[data-filled]");
    render(
      <LevelIndicator variant="discrete" editable defaultValue={0} max={150.4} aria-label="L" />,
    );
    // 150.4 units on 100 segments: one segment is 1.504 units, not the 1.5 of a rounded range.
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(Number(slider().getAttribute("aria-valuenow"))).toBeCloseTo(1.504, 3);
    expect(filled()).toHaveLength(1);
    await user.keyboard("{End}");
    expect(Number(slider().getAttribute("aria-valuenow"))).toBeCloseTo(150.4, 3);
    expect(filled()).toHaveLength(100);
    await user.keyboard("{ArrowLeft}");
    expect(filled()).toHaveLength(99);
  });

  it("keeps the state forms of className and style, and the function form of render, when editable", () => {
    render(
      <LevelIndicator
        editable
        aria-label="L"
        className={() => "from-state"}
        style={() => ({ opacity: 0.5 })}
        render={(props) => <div {...props} data-rendered="" />}
      />,
    );
    const root = slider().closest<HTMLElement>(".mac-level-indicator");
    expect(root).toHaveClass("mac-level-indicator", "from-state");
    expect(root).toHaveAttribute("data-rendered");
    expect(root?.style.opacity).toBe("0.5");
  });

  it("calls the functions of className, style and render with the slider's state when editable", () => {
    render(
      <LevelIndicator
        editable
        disabled
        aria-label="L"
        // `disabled` and `dragging` are fields of the slider's state, which the meter's state
        // does not have: these lines compile only because `editable` selects the slider's types.
        className={(state) => (state.disabled ? "is-disabled" : "is-enabled")}
        style={(state) => ({ opacity: state.dragging ? 0.5 : 0.75 })}
        render={(props, state) => <div {...props} data-seen-disabled={String(state.disabled)} />}
      />,
    );
    const root = slider().closest<HTMLElement>(".mac-level-indicator");
    expect(root).toHaveClass("mac-level-indicator", "is-disabled");
    expect(root?.style.opacity).toBe("0.75");
    expect(root).toHaveAttribute("data-seen-disabled", "true");
  });

  it("cannot be focused or changed when disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <LevelIndicator
        variant="rating"
        editable
        disabled
        defaultValue={2}
        max={5}
        onValueChange={onValueChange}
        aria-label="Rating"
      />,
    );
    expect(slider()).toBeDisabled();
    expect(slider().closest(".mac-level-indicator")).toHaveAttribute("data-disabled");
    await user.tab();
    expect(slider()).not.toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("submits its value with a form under `name`", () => {
    render(
      <form data-testid="form">
        <LevelIndicator
          variant="rating"
          editable
          defaultValue={4}
          max={5}
          name="stars"
          aria-label="R"
        />
      </form>,
    );
    const data = new FormData(screen.getByTestId("form") as HTMLFormElement);
    expect(data.get("stars")).toBe("4");
  });

  it("uses a custom value text", () => {
    render(
      <LevelIndicator
        variant="rating"
        editable
        defaultValue={3}
        max={5}
        getAriaValueText={(_, value) => `${value} of 5 stars`}
        aria-label="Rating"
      />,
    );
    expect(slider()).toHaveAttribute("aria-valuetext", "3 of 5 stars");
  });

  it("forwards ref, className and native attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<LevelIndicator ref={ref} editable className="extra" id="level" aria-label="L" />);
    expect(ref.current).toHaveClass("mac-level-indicator", "extra");
    expect(ref.current).toHaveAttribute("id", "level");
    expect(ref.current).toContainElement(slider());
  });
});

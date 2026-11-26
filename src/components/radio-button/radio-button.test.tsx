import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { RadioButton, RadioGroup, type RadioGroupProps } from "./index";

function ScrollBars(props: RadioGroupProps) {
  return (
    <RadioGroup aria-label="Show scroll bars" {...props}>
      <RadioButton value="automatic">Automatically</RadioButton>
      <RadioButton value="scrolling">When scrolling</RadioButton>
      <RadioButton value="always">Always</RadioButton>
    </RadioGroup>
  );
}

/** The three buttons of ScrollBars, by title. */
function buttons() {
  const radio = (name: string) => screen.getByRole("radio", { name });
  return {
    automatic: radio("Automatically"),
    scrolling: radio("When scrolling"),
    always: radio("Always"),
  };
}

describe("RadioGroup and RadioButton", () => {
  it("renders a named group of unselected radio buttons named by their titles", () => {
    render(<ScrollBars />);
    const group = screen.getByRole("radiogroup", { name: "Show scroll bars" });
    expect(group).toHaveClass("mac-radio-button-group");
    expect(group).toHaveAttribute("data-orientation", "vertical");
    expect(group).toHaveAttribute("aria-orientation", "vertical");

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    for (const radio of radios) {
      expect(radio).not.toBeChecked();
      expect(radio).toHaveClass("mac-radio-button");
      expect(radio).toHaveAttribute("data-size", "regular");
    }
    expect(screen.getByRole("radio", { name: "When scrolling" })).toBeInTheDocument();
  });

  it("reflects orientation, size and mixed as data attributes", () => {
    render(
      <RadioGroup orientation="horizontal" aria-label="Group">
        <RadioButton value="a" size="small" mixed>
          A
        </RadioButton>
        <RadioButton value="b">B</RadioButton>
      </RadioGroup>,
    );
    expect(screen.getByRole("radiogroup")).toHaveAttribute("data-orientation", "horizontal");
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-orientation", "horizontal");
    const a = screen.getByRole("radio", { name: "A" });
    expect(a).toHaveAttribute("data-size", "small");
    expect(a).toHaveAttribute("data-mixed");
    expect(screen.getByRole("radio", { name: "B" })).not.toHaveAttribute("data-mixed");
  });

  it("takes a button's name from aria-label when it has no title", () => {
    const { container } = render(
      <RadioGroup aria-label="Group">
        <RadioButton value="a" aria-label="First" />
      </RadioGroup>,
    );
    expect(screen.getByRole("radio", { name: "First" })).toBeInTheDocument();
    expect(container.querySelector(".mac-radio-button-title")).toBeNull();
  });

  it("selects with the pointer, on the circle or the title, and deselects the others", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ScrollBars defaultValue="automatic" onValueChange={onValueChange} />);
    const { automatic, scrolling } = buttons();
    expect(automatic).toBeChecked();

    await user.click(screen.getByText("When scrolling"));
    expect(scrolling).toBeChecked();
    expect(scrolling).toHaveAttribute("data-checked");
    expect(automatic).not.toBeChecked();
    expect(onValueChange).toHaveBeenLastCalledWith("scrolling", expect.anything());

    await user.click(scrolling);
    expect(scrolling).toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("is one tab stop, and the arrow keys move the selection and wrap", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ScrollBars defaultValue="scrolling" />
        <button type="button">After</button>
      </>,
    );
    const { automatic, scrolling, always } = buttons();

    await user.tab();
    expect(scrolling).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(always).toHaveFocus();
    expect(always).toBeChecked();

    await user.keyboard("{ArrowDown}");
    expect(automatic).toHaveFocus();
    expect(automatic).toBeChecked();

    await user.keyboard("{ArrowUp}");
    expect(always).toBeChecked();

    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("selects the focused button with Space when nothing is selected", async () => {
    const user = userEvent.setup();
    render(<ScrollBars />);
    await user.tab();
    const { automatic } = buttons();
    expect(automatic).toHaveFocus();
    expect(automatic).not.toBeChecked();
    await user.keyboard(" ");
    expect(automatic).toBeChecked();
  });

  it("stays as its `value` prop says when controlled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<ScrollBars value="automatic" onValueChange={onValueChange} />);
    const { automatic, always } = buttons();

    await user.click(always);
    expect(onValueChange).toHaveBeenCalledWith("always", expect.anything());
    expect(automatic).toBeChecked();
    expect(always).not.toBeChecked();

    rerender(<ScrollBars value="always" onValueChange={onValueChange} />);
    expect(always).toBeChecked();
  });

  it("ignores the pointer and the keyboard when the group is disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ScrollBars disabled defaultValue="automatic" onValueChange={onValueChange} />);
    const { automatic, scrolling } = buttons();
    expect(scrolling).toHaveAttribute("aria-disabled", "true");
    expect(scrolling).toHaveAttribute("data-disabled");

    await user.click(scrolling);
    await user.tab();
    await user.keyboard("{ArrowDown}");
    await user.keyboard(" ");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(automatic).toBeChecked();
  });

  it("skips a single disabled button with the arrow keys and ignores clicks on it", async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup defaultValue="a" aria-label="Group">
        <RadioButton value="a">A</RadioButton>
        <RadioButton value="b" disabled>
          B
        </RadioButton>
        <RadioButton value="c">C</RadioButton>
      </RadioGroup>,
    );
    await user.click(screen.getByRole("radio", { name: "B" }));
    expect(screen.getByRole("radio", { name: "A" })).toBeChecked();

    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "C" })).toBeChecked();
  });

  it("does not change when read-only", async () => {
    const user = userEvent.setup();
    render(<ScrollBars readOnly defaultValue="automatic" />);
    await user.click(screen.getByRole("radio", { name: "Always" }));
    expect(screen.getByRole("radio", { name: "Automatically" })).toBeChecked();
  });

  it("submits the group's name and the selected value with a form", async () => {
    const user = userEvent.setup();
    let data: FormData | undefined;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <ScrollBars name="scrollbars" defaultValue="automatic" />
        <button type="submit">Save</button>
      </form>,
    );
    await user.click(screen.getByRole("radio", { name: "Always" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(data?.get("scrollbars")).toBe("always");
  });

  it("keeps its own classes when className is a string or a state function", () => {
    render(
      <RadioGroup className="extra" defaultValue="a" aria-label="Group">
        <RadioButton value="a" className={(state) => (state.checked ? "is-on" : "is-off")}>
          A
        </RadioButton>
      </RadioGroup>,
    );
    expect(screen.getByRole("radiogroup")).toHaveClass("mac-radio-button-group", "extra");
    expect(screen.getByRole("radio")).toHaveClass("mac-radio-button", "is-on");
  });

  it("forwards refs and attributes to the group and to the element with the radio role", () => {
    const groupRef = createRef<HTMLDivElement>();
    const radioRef = createRef<HTMLElement>();
    render(
      <RadioGroup ref={groupRef} aria-label="Group" data-testid="group" style={{ margin: 4 }}>
        <RadioButton ref={radioRef} value="a" aria-describedby="hint" data-testid="radio">
          A
        </RadioButton>
      </RadioGroup>,
    );
    expect(groupRef.current).toBe(screen.getByRole("radiogroup"));
    expect(screen.getByRole("radiogroup")).toHaveAttribute("data-testid", "group");
    expect(screen.getByRole("radiogroup")).toHaveStyle({ margin: "4px" });
    expect(radioRef.current).toBe(screen.getByRole("radio"));
    expect(screen.getByRole("radio")).toHaveAttribute("aria-describedby", "hint");
    expect(screen.getByRole("radio")).toHaveAttribute("data-testid", "radio");
  });
});

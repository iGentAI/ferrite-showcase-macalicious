import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ColorSwatch,
  ColorSwatchPicker,
  type ColorSwatchPickerProps,
  ThumbnailSwatch,
} from "./index";

function Accents(props: ColorSwatchPickerProps) {
  return (
    <ColorSwatchPicker aria-label="Accent color" {...props}>
      <ColorSwatch value="blue" aria-label="Blue" />
      <ColorSwatch value="purple" aria-label="Purple" />
      <ColorSwatch value="pink" aria-label="Pink" />
    </ColorSwatchPicker>
  );
}

const swatch = (name: string) => screen.getByRole("radio", { name });

describe("ColorSwatchPicker and ColorSwatch", () => {
  it("renders a named radio group of named swatches, none chosen", () => {
    render(<Accents />);
    expect(screen.getByRole("radiogroup", { name: "Accent color" })).toHaveClass(
      "mac-color-swatch-picker",
    );
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(swatch("Blue")).toHaveClass("mac-color-swatch-picker-swatch");
    expect(swatch("Blue")).not.toBeChecked();
  });

  it("takes a preset colour from `value` and marks it with data-color", () => {
    render(<Accents />);
    expect(swatch("Purple")).toHaveAttribute("data-color", "purple");
    expect(swatch("Purple").style.getPropertyValue("--mac-color-swatch-picker-color")).toBe("");
  });

  it("passes any other colour on as a custom property, merged with `style`", () => {
    render(
      <ColorSwatchPicker aria-label="Label color">
        <ColorSwatch value="teal" color="#30b0c7" aria-label="Teal" style={{ margin: 2 }} />
        <ColorSwatch value="brand" color="green" aria-label="Brand" />
      </ColorSwatchPicker>,
    );
    const teal = swatch("Teal");
    expect(teal).not.toHaveAttribute("data-color");
    expect(teal.style.getPropertyValue("--mac-color-swatch-picker-color")).toBe("#30b0c7");
    expect(teal).toHaveStyle({ margin: "2px" });
    // `color` wins over `value`: a preset name given as the colour of another value.
    expect(swatch("Brand")).toHaveAttribute("data-color", "green");
  });

  it("chooses with the pointer and reports the change", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Accents defaultValue="blue" onValueChange={onValueChange} />);
    expect(swatch("Blue")).toBeChecked();

    await user.click(swatch("Pink"));
    expect(swatch("Pink")).toBeChecked();
    expect(swatch("Pink")).toHaveAttribute("data-checked");
    expect(swatch("Blue")).not.toBeChecked();
    expect(onValueChange).toHaveBeenLastCalledWith("pink", expect.anything());
  });

  it("is one tab stop, and the arrow keys move the choice and wrap", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Accents defaultValue="purple" />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(swatch("Purple")).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(swatch("Pink")).toHaveFocus();
    expect(swatch("Pink")).toBeChecked();

    await user.keyboard("{ArrowRight}");
    expect(swatch("Blue")).toBeChecked();

    await user.keyboard("{ArrowLeft}");
    expect(swatch("Pink")).toBeChecked();

    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("chooses the focused swatch with Space when nothing is chosen", async () => {
    const user = userEvent.setup();
    render(<Accents />);
    await user.tab();
    await user.keyboard(" ");
    expect(swatch("Blue")).toBeChecked();
  });

  it("stays as its `value` prop says when controlled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<Accents value="blue" onValueChange={onValueChange} />);

    await user.click(swatch("Pink"));
    expect(onValueChange).toHaveBeenCalledWith("pink", expect.anything());
    expect(swatch("Blue")).toBeChecked();

    rerender(<Accents value="pink" onValueChange={onValueChange} />);
    expect(swatch("Pink")).toBeChecked();
  });

  it("ignores the pointer and the keyboard when disabled or read-only", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Accents disabled defaultValue="blue" onValueChange={onValueChange} />,
    );
    expect(swatch("Pink")).toHaveAttribute("data-disabled");
    await user.click(swatch("Pink"));
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(swatch("Blue")).toBeChecked();

    rerender(<Accents readOnly defaultValue="blue" onValueChange={onValueChange} />);
    await user.click(swatch("Pink"));
    expect(swatch("Blue")).toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("ignores a single disabled swatch", async () => {
    const user = userEvent.setup();
    render(
      <ColorSwatchPicker aria-label="Accent color" defaultValue="blue">
        <ColorSwatch value="blue" aria-label="Blue" />
        <ColorSwatch value="purple" aria-label="Purple" disabled />
      </ColorSwatchPicker>,
    );
    await user.click(swatch("Purple"));
    expect(swatch("Blue")).toBeChecked();
  });

  it("submits the group's name and the chosen value with a form", async () => {
    const user = userEvent.setup();
    let data: FormData | undefined;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <Accents name="accent" defaultValue="blue" />
        <button type="submit">Save</button>
      </form>,
    );
    await user.click(swatch("Purple"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(data?.get("accent")).toBe("purple");
  });

  it("keeps its own classes and forwards refs and attributes", () => {
    const groupRef = createRef<HTMLDivElement>();
    const swatchRef = createRef<HTMLSpanElement>();
    render(
      <ColorSwatchPicker ref={groupRef} className="extra" aria-label="Color" data-testid="group">
        <ColorSwatch
          ref={swatchRef}
          value="blue"
          aria-label="Blue"
          className={(state) => (state.checked ? "is-on" : "is-off")}
          data-testid="swatch"
        />
      </ColorSwatchPicker>,
    );
    const group = screen.getByRole("radiogroup");
    expect(groupRef.current).toBe(group);
    expect(group).toHaveClass("mac-color-swatch-picker", "extra");
    expect(group).toHaveAttribute("data-testid", "group");
    expect(swatchRef.current).toBe(swatch("Blue"));
    expect(swatch("Blue")).toHaveClass("mac-color-swatch-picker-swatch", "is-off");
    expect(swatch("Blue")).toHaveAttribute("data-testid", "swatch");
  });
});

describe("ThumbnailSwatch", () => {
  function Appearance(props: ColorSwatchPickerProps) {
    return (
      <ColorSwatchPicker aria-label="Appearance" {...props}>
        <ThumbnailSwatch value="light" label="Light">
          <span data-testid="art" aria-hidden="true" />
        </ThumbnailSwatch>
        <ThumbnailSwatch value="dark" label="Dark" />
        <ThumbnailSwatch value="auto" aria-label="Automatic" />
      </ColorSwatchPicker>
    );
  }

  it("is a radio named by its caption, or by aria-label when it has none", () => {
    const { container } = render(<Appearance />);
    expect(swatch("Light")).toHaveClass("mac-color-swatch-picker-thumbnail");
    expect(swatch("Light")).toContainElement(screen.getByTestId("art"));
    expect(swatch("Automatic")).toBeInTheDocument();
    expect(container.querySelectorAll(".mac-color-swatch-picker-thumbnail-label")).toHaveLength(2);
  });

  it("chooses with a click on the picture or the caption, and with the arrow keys", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Appearance defaultValue="light" onValueChange={onValueChange} />);

    await user.click(screen.getByText("Dark"));
    expect(swatch("Dark")).toBeChecked();
    expect(onValueChange).toHaveBeenLastCalledWith("dark", expect.anything());

    await user.keyboard("{ArrowRight}");
    expect(swatch("Automatic")).toBeChecked();

    await user.click(screen.getByTestId("art"));
    expect(swatch("Light")).toBeChecked();
  });

  it("is one tab stop, on the chosen thumbnail, and focus alone changes nothing", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <>
        <Appearance defaultValue="dark" onValueChange={onValueChange} />
        <button type="button">After</button>
      </>,
    );

    await user.tab();
    expect(swatch("Dark")).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();

    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("chooses the focused thumbnail with Space when none is chosen", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Appearance onValueChange={onValueChange} />);

    await user.tab();
    expect(swatch("Light")).toHaveFocus();
    expect(swatch("Light")).not.toBeChecked();

    await user.keyboard(" ");
    expect(swatch("Light")).toBeChecked();
    expect(onValueChange).toHaveBeenLastCalledWith("light", expect.anything());
  });

  it("does not choose a thumbnail of a disabled picker, by pointer or keyboard", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Appearance defaultValue="light" disabled onValueChange={onValueChange} />);

    for (const name of ["Light", "Dark", "Automatic"]) {
      expect(swatch(name)).toHaveAttribute("data-disabled");
      expect(swatch(name)).toHaveAttribute("aria-disabled", "true");
    }

    await user.click(screen.getByText("Dark"));
    expect(swatch("Light")).toBeChecked();

    // The chosen thumbnail stays reachable, so the keys below are sent to it.
    swatch("Light").focus();
    expect(swatch("Light")).toHaveFocus();
    await user.keyboard("{ArrowRight} ");
    expect(swatch("Light")).toBeChecked();
    expect(swatch("Dark")).not.toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("skips one disabled thumbnail and leaves the others to be chosen", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ColorSwatchPicker aria-label="Appearance" defaultValue="light" onValueChange={onValueChange}>
        <ThumbnailSwatch value="light" label="Light" />
        <ThumbnailSwatch value="dark" label="Dark" disabled />
        <ThumbnailSwatch value="auto" label="Auto" />
      </ColorSwatchPicker>,
    );
    expect(swatch("Dark")).toHaveAttribute("data-disabled");
    expect(swatch("Auto")).not.toHaveAttribute("data-disabled");

    await user.click(screen.getByText("Dark"));
    expect(swatch("Light")).toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();

    await user.click(screen.getByText("Auto"));
    expect(swatch("Auto")).toBeChecked();
    expect(onValueChange).toHaveBeenLastCalledWith("auto", expect.anything());
  });

  it("forwards ref, className and attributes to the element with the radio role", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <ColorSwatchPicker aria-label="Appearance">
        <ThumbnailSwatch ref={ref} value="light" label="Light" className="extra" data-testid="t" />
      </ColorSwatchPicker>,
    );
    expect(ref.current).toBe(swatch("Light"));
    expect(swatch("Light")).toHaveClass("mac-color-swatch-picker-thumbnail", "extra");
    expect(swatch("Light")).toHaveAttribute("data-testid", "t");
  });
});

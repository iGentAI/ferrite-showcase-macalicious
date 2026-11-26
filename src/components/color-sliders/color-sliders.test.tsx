import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ColorSliders, ColorSlidersChannel } from "./index";

const slider = (name: string) => screen.getByRole("slider", { name });
const field = (name: string) => screen.getByRole("textbox", { name }) as HTMLInputElement;
const model = () => screen.getByRole("combobox", { name: "Color model" });

describe("ColorSliders", () => {
  it("renders the RGB sliders of its colour, their number fields and the hex field", () => {
    render(<ColorSliders data-testid="root" defaultValue="#ff9300" />);
    expect(screen.getByTestId("root")).toHaveClass("mac-color-sliders");
    expect(model()).toHaveTextContent("RGB Sliders");
    expect(screen.getAllByRole("slider")).toHaveLength(3);
    expect(slider("Red")).toHaveValue("255");
    expect(slider("Green")).toHaveValue("147");
    expect(slider("Blue")).toHaveValue("0");
    expect(field("Green value")).toHaveValue("147");
    expect(field("Hex Color #")).toHaveValue("FF9300");
  });

  it("edits a component with its slider and with its number field", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorSliders defaultValue="#ff9300" onValueChange={onValueChange} />);
    slider("Blue").focus();
    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenLastCalledWith("#ff93ff");

    await user.clear(field("Green value"));
    expect(onValueChange).toHaveBeenLastCalledWith("#ff00ff");
    await user.type(field("Green value"), "64");
    expect(onValueChange).toHaveBeenLastCalledWith("#ff40ff");
    expect(slider("Green")).toHaveValue("64");
    // A number above the slider's range is not taken, and neither is text or a fraction.
    await user.type(field("Green value"), "0");
    await user.type(field("Green value"), "x");
    await user.type(field("Green value"), ".");
    expect(field("Green value")).toHaveValue("64");
    expect(field("Hex Color #")).toHaveValue("FF40FF");
  });

  it("takes a hex value once it is six digits, and restores the field when it is left", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorSliders onValueChange={onValueChange} />);
    const hex = field("Hex Color #");
    await user.clear(hex);
    await user.type(hex, "34c7");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(hex).toHaveValue("34c7");
    await user.type(hex, "59");
    expect(onValueChange).toHaveBeenLastCalledWith("#34c759");
    expect(slider("Green")).toHaveValue("199");
    await user.clear(hex);
    await user.type(hex, "zz");
    await user.tab();
    expect(hex).toHaveValue("34C759");
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("switches to HSB and to grey scale from the pop-up button", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onModelChange = vi.fn();
    render(
      <ColorSliders
        defaultValue="#0000ff"
        onValueChange={onValueChange}
        onModelChange={onModelChange}
      />,
    );
    await user.click(model());
    await user.click(await screen.findByRole("option", { name: "HSB Sliders" }));
    expect(onModelChange).toHaveBeenLastCalledWith("hsb");
    expect(slider("Hue")).toHaveValue("240");
    expect(slider("Saturation")).toHaveValue("100");
    slider("Hue").focus();
    await user.keyboard("{Home}");
    expect(onValueChange).toHaveBeenLastCalledWith("#ff0000");

    await user.click(model());
    await user.click(await screen.findByRole("option", { name: "Gray Scale Slider" }));
    expect(screen.getAllByRole("slider")).toHaveLength(1);
    slider("Brightness").focus();
    await user.keyboard("{ArrowLeft}");
    // Grey scale drops the saturation: 99% white.
    expect(onValueChange).toHaveBeenLastCalledWith("#fcfcfc");
  });

  it("keeps the hue while the HSB sliders pass through black", async () => {
    const user = userEvent.setup();
    render(<ColorSliders defaultModel="hsb" defaultValue="#0000ff" />);
    slider("Brightness").focus();
    await user.keyboard("{Home}");
    expect(field("Hex Color #")).toHaveValue("000000");
    expect(slider("Hue")).toHaveValue("240");
    await user.keyboard("{End}");
    expect(field("Hex Color #")).toHaveValue("0000FF");
  });

  it("is controlled by value and by model", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onModelChange = vi.fn();
    const { rerender } = render(
      <ColorSliders
        value="#ff0000"
        model="rgb"
        onValueChange={onValueChange}
        onModelChange={onModelChange}
      />,
    );
    slider("Red").focus();
    await user.keyboard("{Home}");
    expect(onValueChange).toHaveBeenLastCalledWith("#000000");
    expect(slider("Red")).toHaveValue("255");
    await user.click(model());
    await user.click(await screen.findByRole("option", { name: "HSB Sliders" }));
    expect(onModelChange).toHaveBeenLastCalledWith("hsb");
    expect(screen.getAllByRole("slider")).toHaveLength(3);
    expect(slider("Red")).toBeInTheDocument();

    rerender(<ColorSliders value="#00ff00" model="gray" />);
    expect(screen.getAllByRole("slider")).toHaveLength(1);
    expect(field("Hex Color #")).toHaveValue("00FF00");
  });

  it("keeps the opacity of the value it was given", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorSliders defaultValue="#ff000080" onValueChange={onValueChange} />);
    slider("Blue").focus();
    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenLastCalledWith("#ff00ff80");
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<ColorSliders ref={ref} className="extra" id="sliders" />);
    expect(ref.current).toHaveClass("mac-color-sliders", "extra");
    expect(ref.current).toHaveAttribute("id", "sliders");
  });
});

describe("ColorSlidersChannel", () => {
  it("shows a value rounded, in a named slider and a named field, and reports a typed one", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ColorSlidersChannel
        data-testid="row"
        name="Opacity"
        max={100}
        value={49.6}
        onValueChange={onValueChange}
      />,
    );
    expect(screen.getByTestId("row")).toHaveClass("mac-color-sliders-channel");
    expect(screen.getByTestId("row")).toHaveTextContent("Opacity");
    expect(slider("Opacity")).toHaveValue("50");
    expect(field("Opacity value")).toHaveValue("50");
    await user.type(field("Opacity value"), "{Backspace}");
    expect(onValueChange).toHaveBeenLastCalledWith(5);
    slider("Opacity").focus();
    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenLastCalledWith(100, expect.anything());
  });
});

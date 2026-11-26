import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MenuItem, MenuSeparator } from "../menu-item";
import { PullDownButton, type PullDownButtonProps } from "./index";

function Pdf({
  onSave = () => {},
  ...props
}: { onSave?: () => void } & Partial<PullDownButtonProps>) {
  return (
    <PullDownButton title="PDF" {...props}>
      <MenuItem>Open in Preview</MenuItem>
      <MenuItem onClick={onSave}>Save as PDF</MenuItem>
      <MenuSeparator />
      <MenuItem disabled>Send in Mail</MenuItem>
    </PullDownButton>
  );
}

const button = () => screen.getByRole("button", { name: "PDF" });
const highlighted = () => document.querySelector("[data-highlighted]");
const closed = () => waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

describe("PullDownButton", () => {
  it("is a menu button with the pop-up button's bezel and one down arrow", () => {
    render(<Pdf />);
    expect(button().tagName).toBe("BUTTON");
    expect(button()).toHaveClass("mac-pop-up-button", "mac-pull-down-button");
    expect(button()).toHaveAttribute("aria-haspopup", "menu");
    expect(button()).toHaveAttribute("data-arrows", "down");
    expect(button()).toHaveAttribute("data-size", "regular");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("reflects size and bordered as data attributes", () => {
    render(<Pdf size="small" bordered={false} />);
    expect(button()).toHaveAttribute("data-size", "small");
    expect(button()).toHaveAttribute("data-bordered", "false");
  });

  it("opens the library's menu, in the font of its size", async () => {
    const user = userEvent.setup();
    render(<Pdf size="small" />);
    await user.click(button());
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveClass("mac-menu");
    expect(menu).toHaveAttribute("data-size", "small");
    expect(button()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });

  it("runs the chosen command, closes, and keeps its title", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Pdf onSave={onSave} />);
    await user.click(button());
    await user.click(await screen.findByRole("menuitem", { name: "Save as PDF" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    await closed();
    expect(button()).toHaveTextContent("PDF");
  });

  it("opens with the Down Arrow and chooses with Return", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Pdf onSave={onSave} />);
    await user.tab();
    expect(button()).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("menu");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Open in Preview"));
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Save as PDF"));
    await user.keyboard("{Enter}");
    expect(onSave).toHaveBeenCalledTimes(1);
    await closed();
  });

  it("selects by typing the start of a title and passes over a disabled item", async () => {
    const user = userEvent.setup();
    render(<Pdf />);
    await user.click(button());
    await screen.findByRole("menu");
    await user.keyboard("s");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Save as PDF"));
    // "Send in Mail" is disabled: Down Arrow wraps to the first item instead.
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Open in Preview"));
  });

  it("closes on Escape and returns the focus to the button", async () => {
    const user = userEvent.setup();
    render(<Pdf />);
    await user.click(button());
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");
    await closed();
    await waitFor(() => expect(button()).toHaveFocus());
  });

  it("does not open when disabled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Pdf disabled onOpenChange={onOpenChange} />);
    expect(button()).toBeDisabled();
    expect(button()).toHaveAttribute("data-disabled");
    await user.click(button());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("reports opening and closing, and can be controlled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    function Owner() {
      const [open, setOpen] = useState(false);
      return (
        <Pdf
          open={open}
          onOpenChange={(next, details) => {
            onOpenChange(next);
            setOpen(next);
            void details;
          }}
        />
      );
    }
    render(<Owner />);
    await user.click(button());
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    await user.keyboard("{Escape}");
    await closed();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("takes an image in place of a title, named by aria-label", () => {
    render(
      <PullDownButton aria-label="Action" image={<svg data-testid="gear" aria-hidden="true" />}>
        <MenuItem>Duplicate</MenuItem>
      </PullDownButton>,
    );
    expect(screen.getByRole("button", { name: "Action" })).toContainElement(
      screen.getByTestId("gear"),
    );
  });

  it("passes ref, className, style and other props to the button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Pdf ref={ref} id="pdf" className="extra" style={{ width: 80 }} data-x="1" />);
    expect(ref.current).toBe(button());
    expect(button()).toHaveClass("mac-pull-down-button", "extra");
    expect(button()).toHaveAttribute("id", "pdf");
    expect(button()).toHaveAttribute("data-x", "1");
    expect(button()).toHaveStyle({ width: "80px" });
  });
});

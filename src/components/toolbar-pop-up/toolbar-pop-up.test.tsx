import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { MenuItem, MenuSeparator } from "../menu-item";
import { PopUpButtonItem } from "../pop-up-button";
import { Toolbar } from "../toolbar";
import { ToolbarButton } from "../toolbar-button";
import {
  ToolbarPopUp,
  ToolbarPullDown,
  type ToolbarPullDownProps,
  ToolbarSplitPullDown,
  type ToolbarSplitPullDownProps,
} from "./index";

const glyph = <svg data-testid="glyph" aria-hidden="true" />;
const closed = () => waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
const highlighted = () => document.querySelector("[data-highlighted]");

function Action({
  onInfo = () => {},
  ...props
}: { onInfo?: () => void } & Partial<ToolbarPullDownProps>) {
  return (
    <ToolbarPullDown image={glyph} aria-label="Action" {...props}>
      <MenuItem>New Folder</MenuItem>
      <MenuItem onClick={onInfo}>Get Info</MenuItem>
      <MenuSeparator />
      <MenuItem>Show View Options</MenuItem>
    </ToolbarPullDown>
  );
}

const action = () => screen.getByRole("button", { name: "Action" });

describe("ToolbarPullDown", () => {
  it("is a toolbar button with its glyph and a chevron that has a menu", () => {
    render(<Action />);
    expect(action().tagName).toBe("BUTTON");
    expect(action()).toHaveClass("mac-toolbar-button", "mac-toolbar-pop-up");
    expect(action()).toHaveAttribute("aria-haspopup", "menu");
    expect(action()).toContainElement(screen.getByTestId("glyph"));
    expect(action().querySelector(".mac-toolbar-pop-up-arrow")).toBeInTheDocument();
    expect(action()).not.toHaveAttribute("data-pressed");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows a title", () => {
    render(<Action image={undefined} title="View" aria-label={undefined} />);
    expect(screen.getByRole("button", { name: "View" })).toHaveTextContent("View");
  });

  it("marks the compact form on the button", () => {
    const { rerender } = render(<Action />);
    expect(action()).not.toHaveAttribute("data-compact");
    rerender(<Action compact />);
    expect(action()).toHaveAttribute("data-compact");
  });

  it("opens the library's menu and has the on bezel while it is open", async () => {
    const user = userEvent.setup();
    render(<Action />);
    await user.click(action());
    expect(await screen.findByRole("menu")).toHaveClass("mac-menu");
    expect(action()).toHaveAttribute("aria-expanded", "true");
    expect(action()).toHaveAttribute("data-pressed");
    await user.keyboard("{Escape}");
    await closed();
    expect(action()).not.toHaveAttribute("data-pressed");
    await waitFor(() => expect(action()).toHaveFocus());
  });

  it("runs the chosen command and closes", async () => {
    const user = userEvent.setup();
    const onInfo = vi.fn();
    render(<Action onInfo={onInfo} />);
    await user.click(action());
    await user.click(await screen.findByRole("menuitem", { name: "Get Info" }));
    expect(onInfo).toHaveBeenCalledTimes(1);
    await closed();
  });

  it("opens with the Down Arrow and chooses with Return", async () => {
    const user = userEvent.setup();
    const onInfo = vi.fn();
    render(<Action onInfo={onInfo} />);
    await user.tab();
    expect(action()).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("menu");
    await waitFor(() => expect(highlighted()).toHaveTextContent("New Folder"));
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Get Info"));
    await user.keyboard("{Enter}");
    expect(onInfo).toHaveBeenCalledTimes(1);
    await closed();
  });

  it("does not open when disabled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Action disabled onOpenChange={onOpenChange} />);
    expect(action()).toBeDisabled();
    await user.click(action());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("can be opened by its owner", async () => {
    render(<Action open onOpenChange={() => {}} />);
    expect(await screen.findByRole("menu")).toBeInTheDocument();
  });

  it("passes ref, className, style and other props to the button", () => {
    const ref = createRef<HTMLElement>();
    render(<Action ref={ref} id="action" className="extra" style={{ width: 46 }} data-x="1" />);
    expect(ref.current).toBe(action());
    expect(action()).toHaveClass("mac-toolbar-pop-up", "extra");
    expect(action()).toHaveAttribute("id", "action");
    expect(action()).toHaveAttribute("data-x", "1");
    expect(action()).toHaveStyle({ width: "46px" });
  });

  it("joins the arrow-key navigation of a toolbar", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Tools">
        <ToolbarButton>Back</ToolbarButton>
        <Action />
      </Toolbar>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(action()).toHaveFocus();
  });
});

describe("ToolbarPopUp", () => {
  function Font({ onValueChange }: { onValueChange?: (value: string | null) => void }) {
    return (
      <ToolbarPopUp
        aria-label="Font"
        defaultValue="helvetica"
        onValueChange={onValueChange}
        className="extra"
      >
        <PopUpButtonItem value="helvetica">Helvetica</PopUpButtonItem>
        <PopUpButtonItem value="menlo">Menlo</PopUpButtonItem>
      </ToolbarPopUp>
    );
  }
  const font = () => screen.getByRole("combobox", { name: "Font" });

  it("is a toolbar button that shows the current choice", () => {
    render(<Font />);
    expect(font().tagName).toBe("BUTTON");
    expect(font()).toHaveClass("mac-toolbar-button", "mac-toolbar-pop-up", "extra");
    expect(font()).not.toHaveClass("mac-pop-up-button");
    expect(font()).toHaveTextContent("Helvetica");
    expect(font().querySelector(".mac-toolbar-pop-up-arrow")).toBeInTheDocument();
  });

  it("changes the choice from its menu", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Font onValueChange={onValueChange} />);
    await user.click(font());
    expect(await screen.findByRole("listbox")).toHaveClass("mac-menu");
    expect(font()).toHaveAttribute("data-pressed");
    await user.click(screen.getByRole("option", { name: "Menlo" }));
    expect(onValueChange).toHaveBeenCalledWith("menlo", expect.anything());
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(font()).toHaveTextContent("Menlo");
  });
});

describe("ToolbarSplitPullDown", () => {
  function Highlight(props: Partial<ToolbarSplitPullDownProps>) {
    return (
      <ToolbarSplitPullDown
        image={glyph}
        aria-label="Highlight"
        menuLabel="Highlight colors"
        {...props}
      >
        <MenuItem>Yellow</MenuItem>
        <MenuItem>Green</MenuItem>
      </ToolbarSplitPullDown>
    );
  }
  const main = () => screen.getByRole("button", { name: "Highlight" });
  const menuPart = () => screen.getByRole("button", { name: "Highlight colors" });

  it("is two buttons in one group: the action and the menu", () => {
    render(<Highlight className="extra" />);
    const group = main().parentElement;
    expect(group).toHaveClass("mac-toolbar-segmented-control", "mac-toolbar-pop-up-split", "extra");
    expect(group).toContainElement(menuPart());
    expect(main()).not.toHaveAttribute("aria-haspopup");
    expect(menuPart()).toHaveAttribute("aria-haspopup", "menu");
    expect(menuPart()).toHaveClass("mac-toolbar-pop-up-menu-part");
  });

  it("acts on a click of the main part without opening the menu", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Highlight onClick={onClick} />);
    await user.click(main());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the menu from the menu part, with the pointer and with the keyboard", async () => {
    const user = userEvent.setup();
    render(<Highlight />);
    await user.click(menuPart());
    expect(await screen.findByRole("menu")).toHaveClass("mac-menu");
    expect(menuPart()).toHaveAttribute("data-pressed");
    await user.keyboard("{Escape}");
    await closed();
    menuPart().focus();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("menu");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Yellow"));
  });

  it("moves between its two parts with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Highlight />);
    await user.tab();
    expect(main()).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(menuPart()).toHaveFocus();
  });

  it("disables both parts", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Highlight disabled onClick={onClick} />);
    await user.click(main());
    await user.click(menuPart());
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(main()).toHaveAttribute("data-disabled");
    expect(menuPart()).toHaveAttribute("data-disabled");
  });
});

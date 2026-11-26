import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Launchpad, LaunchpadItem, type LaunchpadProps } from "./index";

const NAMES = ["Notes", "Reminders", "Calendar", "Contacts", "Maps", "Photos"];

function Apps({ onLaunch, ...props }: LaunchpadProps & { onLaunch?: (name: string) => void }) {
  return (
    <Launchpad columns={3} rows={2} {...props}>
      {NAMES.map((name) => (
        <LaunchpadItem key={name} label={name} onClick={() => onLaunch?.(name)}>
          <span data-testid={`icon-${name}`} />
        </LaunchpadItem>
      ))}
    </Launchpad>
  );
}

const item = (name: string) => screen.getByRole("button", { name });

describe("Launchpad", () => {
  it("renders nothing while closed", () => {
    render(<Apps />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notes" })).not.toBeInTheDocument();
  });

  it("is a dialog with a search field and one button per app", async () => {
    render(<Apps defaultOpen />);
    const dialog = await screen.findByRole("dialog", { name: "Launchpad" });
    expect(dialog).toHaveClass("mac-launchpad");
    expect(within(dialog).getByRole("searchbox", { name: "Search" })).toHaveValue("");
    for (const name of NAMES) expect(item(name)).toHaveClass("mac-launchpad-item");
    expect(screen.getByTestId("icon-Maps")).toBeInTheDocument();
    // The surface has the focus, so that nothing looks focused and typing starts a search.
    await waitFor(() => expect(dialog).toHaveFocus());
  });

  it("renders inside the container it is given", async () => {
    function Desktop() {
      const [element, setElement] = useState<HTMLDivElement | null>(null);
      return (
        <div ref={setElement} data-testid="desktop">
          <Apps defaultOpen container={element} />
        </div>
      );
    }
    render(<Desktop />);
    const dialog = await screen.findByRole("dialog");
    expect(screen.getByTestId("desktop")).toContainElement(dialog);
  });

  it("closes on Escape and on a click on the background", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Apps defaultOpen onOpenChange={onOpenChange} />);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    rerender(<Apps key="second" defaultOpen onOpenChange={onOpenChange} />);
    await user.click(await screen.findByRole("button", { name: "Close Launchpad" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("stays open when controlled until the prop changes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Apps open onOpenChange={onOpenChange} />);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<Apps open={false} onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("launches an app on click and closes", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn();
    const onOpenChange = vi.fn();
    render(<Apps defaultOpen onLaunch={onLaunch} onOpenChange={onOpenChange} />);
    await screen.findByRole("dialog");
    await user.click(item("Maps"));
    expect(onLaunch).toHaveBeenCalledWith("Maps");
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps Launchpad open for an item with closeOnClick off or a prevented click", async () => {
    const user = userEvent.setup();
    render(
      <Launchpad defaultOpen>
        <LaunchpadItem label="Stay" closeOnClick={false} />
        <LaunchpadItem label="Prevent" onClick={(event) => event.preventDefault()} />
      </Launchpad>,
    );
    await screen.findByRole("dialog");
    await user.click(item("Stay"));
    await user.click(item("Prevent"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("filters the apps while typing, from anywhere in Launchpad", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<Apps defaultOpen onSearchChange={onSearchChange} />);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog).toHaveFocus());
    await user.keyboard("co");
    const field = screen.getByRole("searchbox");
    expect(field).toHaveFocus();
    expect(field).toHaveValue("co");
    expect(onSearchChange).toHaveBeenLastCalledWith("co");
    expect(item("Contacts")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notes" })).not.toBeInTheDocument();
    // Typing with an app focused goes on in the field.
    await user.keyboard("{ArrowDown}");
    expect(item("Contacts")).toHaveFocus();
    await user.keyboard("n");
    expect(field).toHaveFocus();
    expect(field).toHaveValue("con");
  });

  it("matches the search without regard to case and launches the first match on Return", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn();
    render(<Apps defaultOpen defaultSearch="PHO" onLaunch={onLaunch} />);
    await screen.findByRole("dialog");
    expect(screen.getAllByRole("button", { name: /^(?!Close)/ })).toHaveLength(1);
    await user.click(screen.getByRole("searchbox"));
    await user.keyboard("{Enter}");
    expect(onLaunch).toHaveBeenCalledWith("Photos");
  });

  it("shows a controlled search and reports changes without applying them", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<Apps defaultOpen search="ma" onSearchChange={onSearchChange} />);
    await screen.findByRole("dialog");
    await user.type(screen.getByRole("searchbox"), "p");
    expect(onSearchChange).toHaveBeenCalledWith("map");
    expect(screen.getByRole("searchbox")).toHaveValue("ma");
    expect(item("Maps")).toBeInTheDocument();
  });

  it("moves among the apps with the arrow keys and opens one with Return", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn();
    render(<Apps defaultOpen onLaunch={onLaunch} />);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(item("Notes")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(item("Reminders")).toHaveFocus();
    // Three columns: down goes to the app below.
    await user.keyboard("{ArrowDown}");
    expect(item("Maps")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item("Maps")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(item("Contacts")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(item("Notes")).toHaveFocus();
    // Up from the first row goes to the search field, and down comes back.
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("searchbox")).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowRight}{ArrowRight}{Enter}");
    expect(onLaunch).toHaveBeenCalledWith("Calendar");
  });

  it("splits the apps into pages of columns times rows", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Apps defaultOpen columns={2} rows={2} onPageChange={onPageChange} />);
    await screen.findByRole("dialog");
    expect(item("Contacts")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Maps" })).not.toBeInTheDocument();
    const pages = screen.getByRole("group", { name: "Pages" });
    expect(within(pages).getAllByRole("button")).toHaveLength(2);
    await user.click(within(pages).getByRole("button", { name: "Page 2 of 2" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
    expect(item("Maps")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notes" })).not.toBeInTheDocument();
    // A search looks through every page and hides the dots.
    await user.type(screen.getByRole("searchbox"), "notes");
    expect(item("Notes")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Pages" })).not.toBeInTheDocument();
  });

  it("shows a controlled page and has no dots for a single page", async () => {
    const { rerender } = render(<Apps open columns={2} rows={2} page={1} />);
    await screen.findByRole("dialog");
    expect(item("Photos")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notes" })).not.toBeInTheDocument();
    rerender(<Apps open columns={3} rows={2} />);
    expect(screen.queryByRole("group", { name: "Pages" })).not.toBeInTheDocument();
  });

  it("takes its labels from props", async () => {
    render(<Apps defaultOpen searchLabel="Suchen" closeLabel="Schließen" />);
    await screen.findByRole("dialog");
    expect(screen.getByRole("searchbox", { name: "Suchen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Schließen" })).toBeInTheDocument();
  });

  it("forwards ref, className, style and other attributes to the overlay", async () => {
    const ref = createRef<HTMLDivElement>();
    const onKeyDown = vi.fn();
    render(
      <Apps
        defaultOpen
        ref={ref}
        className="shell"
        style={{ zIndex: 5 }}
        id="launchpad"
        onKeyDown={onKeyDown}
      />,
    );
    const dialog = await screen.findByRole("dialog");
    expect(ref.current).toBe(dialog);
    expect(dialog).toHaveClass("mac-launchpad", "shell");
    expect(dialog).toHaveStyle({ zIndex: "5" });
    expect(dialog).toHaveAttribute("id", "launchpad");
    await waitFor(() => expect(dialog).toHaveFocus());
    await userEvent.setup().keyboard("{ArrowDown}");
    expect(onKeyDown).toHaveBeenCalled();
  });
});

describe("LaunchpadItem", () => {
  it("is a button named by its label, outside a Launchpad too", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <LaunchpadItem label="Notes" ref={ref} className="app" data-app="notes" onClick={onClick}>
        <span data-testid="icon" />
      </LaunchpadItem>,
    );
    const button = screen.getByRole("button", { name: "Notes" });
    expect(ref.current).toBe(button);
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("mac-launchpad-item", "app");
    expect(button).toHaveAttribute("data-app", "notes");
    expect(button).toContainElement(screen.getByTestId("icon"));
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders another element through render", () => {
    render(<LaunchpadItem label="Site" render={<a href="#site" />} />);
    const link = screen.getByRole("link", { name: "Site" });
    expect(link).toHaveClass("mac-launchpad-item");
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Launchpad, LaunchpadItem } from "../launchpad";
import { LaunchpadFolder, type LaunchpadFolderProps } from "./index";

const NAMES = ["Terminal", "Console", "Grapher", "Screenshot"];

function Other({
  onLaunch,
  ...props
}: Partial<LaunchpadFolderProps> & { onLaunch?: (name: string) => void }) {
  return (
    <LaunchpadFolder label="Other" columns={2} {...props}>
      {NAMES.map((name) => (
        <LaunchpadItem key={name} label={name} onClick={() => onLaunch?.(name)}>
          <span data-testid={`icon-${name}`} />
        </LaunchpadItem>
      ))}
    </LaunchpadFolder>
  );
}

const tile = () => screen.getByRole("button", { name: "Other" });

describe("LaunchpadFolder", () => {
  it("is a closed tile named by its label, showing its items' icons small", () => {
    render(<Other />);
    expect(tile()).toHaveClass("mac-launchpad-item", "mac-launchpad-folder");
    expect(tile()).toHaveAttribute("aria-expanded", "false");
    expect(within(tile()).getByTestId("icon-Terminal")).toBeInTheDocument();
    expect(within(tile()).getByTestId("icon-Screenshot")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Terminal" })).not.toBeInTheDocument();
  });

  it("shows at most nine icons on the tile", () => {
    render(
      <LaunchpadFolder label="Many">
        {Array.from({ length: 11 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
          <LaunchpadItem key={index} label={`App ${index}`}>
            <span data-testid="mini" />
          </LaunchpadItem>
        ))}
      </LaunchpadFolder>,
    );
    expect(screen.getAllByTestId("mini")).toHaveLength(9);
  });

  it("opens on click into a dialog named by the folder, and closes on Escape", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Other onOpenChange={onOpenChange} />);
    await user.click(tile());
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.anything());
    const dialog = await screen.findByRole("dialog", { name: "Other" });
    expect(within(dialog).getByRole("heading", { name: "Other" })).toBeInTheDocument();
    for (const name of NAMES) {
      expect(within(dialog).getByRole("button", { name })).toBeInTheDocument();
    }
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(tile()).toHaveFocus());
  });

  it("opens from the keyboard with Return and moves among its apps with the arrow keys", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn();
    render(<Other onLaunch={onLaunch} />);
    await user.tab();
    expect(tile()).toHaveFocus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog");
    const app = (name: string) => within(dialog).getByRole("button", { name });
    await waitFor(() => expect(app("Terminal")).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    expect(app("Console")).toHaveFocus();
    // Two columns: down goes to the app below.
    await user.keyboard("{ArrowDown}");
    expect(app("Screenshot")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(app("Grapher")).toHaveFocus();
    await user.keyboard("{ArrowUp}{Enter}");
    expect(onLaunch).toHaveBeenCalledWith("Terminal");
  });

  it("closes when an app in it is chosen and when the area around the panel is clicked", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn();
    render(<Other defaultOpen onLaunch={onLaunch} />);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Grapher" }));
    expect(onLaunch).toHaveBeenCalledWith("Grapher");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(tile());
    await user.click(await screen.findByRole("button", { name: "Close folder" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("stays as its open prop says when controlled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Other open onOpenChange={onOpenChange} />);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<Other open={false} onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("renders the open folder inside the container it is given", async () => {
    function Desktop() {
      const [element, setElement] = useState<HTMLDivElement | null>(null);
      return (
        <div>
          <div ref={setElement} data-testid="desktop" />
          <Other defaultOpen container={element} closeLabel="Done" />
        </div>
      );
    }
    render(<Desktop />);
    const dialog = await screen.findByRole("dialog");
    expect(screen.getByTestId("desktop")).toContainElement(dialog);
    expect(within(dialog).getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("forwards ref, className, style and other attributes to the tile", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Other ref={ref} className="utilities" style={{ order: 2 }} data-folder="other" />);
    expect(ref.current).toBe(tile());
    expect(tile()).toHaveClass("mac-launchpad-folder", "utilities");
    expect(tile()).toHaveStyle({ order: "2" });
    expect(tile()).toHaveAttribute("data-folder", "other");
  });
});

describe("LaunchpadFolder in a Launchpad", () => {
  // The folder is a direct child: Launchpad's search reads its `label`.
  function Shell({ onLaunch }: { onLaunch?: (name: string) => void }) {
    return (
      <Launchpad defaultOpen columns={2} rows={2}>
        <LaunchpadItem label="Notes" />
        <LaunchpadFolder label="Other" columns={2}>
          {NAMES.map((name) => (
            <LaunchpadItem key={name} label={name} onClick={() => onLaunch?.(name)} />
          ))}
        </LaunchpadFolder>
      </Launchpad>
    );
  }

  it("does not close Launchpad when it opens, and Escape closes the folder first", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await screen.findByRole("dialog", { name: "Launchpad" });
    await user.click(tile());
    await screen.findByRole("dialog", { name: "Other" });
    // Launchpad stays, behind the folder, with its contents hidden.
    expect(screen.getByLabelText("Launchpad")).toHaveAttribute("data-nested-dialog-open");
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Other" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog", { name: "Launchpad" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes Launchpad when an app in the folder is chosen", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn();
    render(<Shell onLaunch={onLaunch} />);
    await screen.findByRole("dialog", { name: "Launchpad" });
    await user.click(tile());
    const folder = await screen.findByRole("dialog", { name: "Other" });
    await user.click(within(folder).getByRole("button", { name: "Console" }));
    expect(onLaunch).toHaveBeenCalledWith("Console");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes for an app with closeOnClick off, and leaves Launchpad open", async () => {
    const user = userEvent.setup();
    render(
      <Launchpad defaultOpen columns={2} rows={2}>
        <LaunchpadFolder label="Other" columns={2}>
          <LaunchpadItem label="Stay" closeOnClick={false} />
        </LaunchpadFolder>
      </Launchpad>,
    );
    await screen.findByRole("dialog", { name: "Launchpad" });
    await user.click(tile());
    const folder = await screen.findByRole("dialog", { name: "Other" });
    await user.click(within(folder).getByRole("button", { name: "Stay" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Other" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog", { name: "Launchpad" })).toBeInTheDocument();
  });

  it("is found by Launchpad's search under its name", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await screen.findByRole("dialog", { name: "Launchpad" });
    await user.type(screen.getByRole("searchbox"), "oth");
    expect(tile()).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notes" })).not.toBeInTheDocument();
  });
});

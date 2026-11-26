import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { PushButton } from "./index";

describe("PushButton", () => {
  it("renders a native button that does not submit forms by default", () => {
    render(<PushButton>Cancel</PushButton>);
    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });

  it("defaults to the standard variant at regular size", () => {
    render(<PushButton>OK</PushButton>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("mac-push-button");
    expect(button).toHaveAttribute("data-variant", "standard");
    expect(button).toHaveAttribute("data-size", "regular");
  });

  it("reflects variant and size as data attributes", () => {
    render(
      <PushButton variant="primary" size="mini">
        Go
      </PushButton>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "primary");
    expect(button).toHaveAttribute("data-size", "mini");
    expect(button).not.toHaveAttribute("data-compact");
  });

  it("reflects the compact and emphasised forms, which still press", async () => {
    const onClick = vi.fn();
    render(
      <>
        <PushButton compact aria-label="Compose" onClick={onClick} />
        <PushButton variant="emphasized" onClick={onClick}>
          Done
        </PushButton>
      </>,
    );
    const compose = screen.getByRole("button", { name: "Compose" });
    expect(compose).toHaveAttribute("data-compact");
    expect(compose).toHaveAttribute("data-variant", "standard");
    const done = screen.getByRole("button", { name: "Done" });
    expect(done).toHaveAttribute("data-variant", "emphasized");
    expect(done).not.toHaveAttribute("data-compact");
    await userEvent.click(compose);
    await userEvent.click(done);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("keeps its own class when className is a string or a state function", () => {
    const { rerender } = render(<PushButton className="extra">A</PushButton>);
    expect(screen.getByRole("button")).toHaveClass("mac-push-button", "extra");

    rerender(
      <PushButton disabled className={(state) => (state.disabled ? "is-off" : "is-on")}>
        A
      </PushButton>,
    );
    expect(screen.getByRole("button")).toHaveClass("mac-push-button", "is-off");
  });

  it("activates with the pointer, Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<PushButton onClick={onClick}>Go</PushButton>);

    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);

    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("is reachable with Tab", async () => {
    const user = userEvent.setup();
    render(<PushButton>Go</PushButton>);
    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
  });

  it("ignores activation and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <PushButton disabled onClick={onClick}>
        Go
      </PushButton>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-disabled");

    await user.click(button);
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(button).not.toHaveFocus();
  });

  it("stays focusable but inert with focusableWhenDisabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <PushButton disabled focusableWhenDisabled onClick={onClick}>
        Saving
      </PushButton>,
    );
    const button = screen.getByRole("button");
    await user.tab();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("submits a form only with type=submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PushButton>Cancel</PushButton>
        <PushButton type="submit" variant="primary">
          Go
        </PushButton>
      </form>,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("answers no key from elsewhere in its window by default", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <div role="dialog" aria-label="Go to the folder">
        <input aria-label="Folder" />
        <PushButton onClick={onClick}>Cancel</PushButton>
      </div>,
    );
    screen.getByRole("textbox").focus();
    await user.keyboard("{Escape}{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is activated by Escape and Command-Period with keyEquivalent escape", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <div role="dialog" aria-label="Go to the folder">
        <input aria-label="Folder" />
        <PushButton keyEquivalent="escape" onClick={onCancel}>
          Cancel
        </PushButton>
      </div>,
    );
    screen.getByRole("textbox").focus();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    // Off Apple platforms the Meta key is the operating system's: Meta-Period is not Cancel.
    await user.keyboard("{Meta>}.{/Meta}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    const platform = vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    await user.keyboard("{Meta>}.{/Meta}");
    expect(onCancel).toHaveBeenCalledTimes(2);
    // Return is not its key, and neither is a plain full stop.
    await user.keyboard("{Enter}.");
    expect(onCancel).toHaveBeenCalledTimes(2);
    platform.mockRestore();
  });

  it("leaves Escape to a control whose popup is open, not to an expanded disclosure", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <div role="dialog" aria-label="Options">
        <button type="button" aria-haspopup="menu" aria-expanded="true">
          Actions
        </button>
        <button type="button" aria-expanded="true" aria-controls="details">
          Details
        </button>
        <div id="details" />
        <PushButton keyEquivalent="escape" onClick={onCancel}>
          Cancel
        </PushButton>
      </div>,
    );
    screen.getByRole("button", { name: "Actions" }).focus();
    await user.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();

    screen.getByRole("button", { name: "Details" }).focus();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("leaves the key to a document-level handler, even one added after the button", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <div role="dialog" aria-label="Options">
        <input aria-label="Name" />
        <PushButton keyEquivalent="escape" onClick={onCancel}>
          Cancel
        </PushButton>
      </div>,
    );
    // As a popup library does: it listens on the document while its popup is open.
    const closePopup = (event: KeyboardEvent) => {
      if (event.key === "Escape") event.preventDefault();
    };
    document.addEventListener("keydown", closePopup);
    screen.getByRole("textbox").focus();
    await user.keyboard("{Escape}");
    document.removeEventListener("keydown", closePopup);
    expect(onCancel).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("answers Command-Period in a search field that holds text, which only Escape clears", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const platform = vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    render(
      <div role="dialog" aria-label="Find">
        <input type="search" aria-label="Search" defaultValue="cat" />
        <PushButton keyEquivalent="escape" onClick={onCancel}>
          Cancel
        </PushButton>
      </div>,
    );
    screen.getByRole("searchbox").focus();
    await user.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();
    await user.keyboard("{Meta>}.{/Meta}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    platform.mockRestore();
  });

  it("leaves Escape to an open popup, a handler that keeps it and another window", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <>
        <input aria-label="Outside" />
        <div data-window-state="key">
          <input role="combobox" aria-label="Open" aria-expanded="true" aria-controls="list" />
          <input
            aria-label="Keeps"
            onKeyDown={(event) => {
              if (event.key === "Escape") event.preventDefault();
            }}
          />
          <div role="dialog" aria-label="Nested">
            <input aria-label="Inner" />
          </div>
          <input aria-label="Plain" />
          <PushButton keyEquivalent="escape" onClick={onCancel}>
            Cancel
          </PushButton>
        </div>
      </>,
    );
    for (const name of ["Outside", "Open", "Keeps", "Inner"]) {
      screen.getByLabelText(name).focus();
      await user.keyboard("{Escape}");
    }
    expect(onCancel).not.toHaveBeenCalled();

    screen.getByLabelText("Plain").focus();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("answers no key when disabled or in a window that is not key", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <>
        <div role="dialog" aria-label="One">
          <input aria-label="First" />
          <PushButton keyEquivalent="escape" disabled onClick={onCancel}>
            Cancel
          </PushButton>
        </div>
        <div data-window-state="main">
          <input aria-label="Second" />
          <PushButton keyEquivalent="escape" onClick={onCancel}>
            Cancel
          </PushButton>
        </div>
      </>,
    );
    for (const name of ["First", "Second"]) {
      screen.getByLabelText(name).focus();
      await user.keyboard("{Escape}");
    }
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("forwards ref and native attributes to the element", () => {
    const ref = createRef<HTMLElement>();
    render(
      <PushButton ref={ref} id="go" aria-describedby="hint">
        Go
      </PushButton>,
    );
    expect(ref.current).toBe(screen.getByRole("button"));
    expect(ref.current).toHaveAttribute("id", "go");
    expect(ref.current).toHaveAttribute("aria-describedby", "hint");
  });

  it("can render another element through Base UI's render prop", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <PushButton render={<div />} nativeButton={false} onClick={onClick}>
        Custom
      </PushButton>,
    );
    const button = screen.getByRole("button", { name: "Custom" });
    expect(button.tagName).toBe("DIV");
    expect(button).toHaveClass("mac-push-button");
    button.focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

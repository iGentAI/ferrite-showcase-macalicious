import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { PushButton } from "../push-button";
import { DefaultButton } from "./index";

describe("DefaultButton", () => {
  it("renders a primary push button that does not submit forms by default", () => {
    render(<DefaultButton>Go</DefaultButton>);
    const button = screen.getByRole("button", { name: "Go" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("mac-push-button", "mac-default-button");
    expect(button).toHaveAttribute("data-variant", "primary");
    expect(button).toHaveAttribute("data-size", "regular");
  });

  it("reflects the control size", () => {
    render(<DefaultButton size="small">Go</DefaultButton>);
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "small");
  });

  it("activates with the pointer, Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<DefaultButton onClick={onClick}>Go</DefaultButton>);
    await user.click(screen.getByRole("button"));
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("is activated by Return from a field in the same dialog", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <div role="dialog" aria-label="Go to the folder">
        <input aria-label="Folder" />
        <DefaultButton onClick={onClick}>Go</DefaultButton>
      </div>,
    );
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is activated by Return inside an element that carries a window state", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <div data-window-state="key">
        <input aria-label="Folder" />
        <DefaultButton onClick={onClick}>Go</DefaultButton>
      </div>,
    );
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("leaves Return to a focused button, a text area and a modified key press", async () => {
    const user = userEvent.setup();
    const onDefault = vi.fn();
    const onCancel = vi.fn();
    render(
      <div role="dialog" aria-label="Go to the folder">
        <input aria-label="Folder" />
        <textarea aria-label="Notes" />
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <DefaultButton onClick={onDefault}>Go</DefaultButton>
      </div>,
    );
    screen.getByRole("button", { name: "Cancel" }).focus();
    await user.keyboard("{Enter}");
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("textbox", { name: "Notes" }));
    await user.keyboard("{Enter}");

    await user.click(screen.getByRole("textbox", { name: "Folder" }));
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onDefault).not.toHaveBeenCalled();
  });

  it("does not answer Return from outside its dialog", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <input aria-label="Elsewhere" />
        <div role="dialog" aria-label="Go to the folder">
          <DefaultButton onClick={onClick}>Go</DefaultButton>
        </div>
      </>,
    );
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not answer Return with keyEquivalent none, when disabled, or in a window that is not key", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <div role="dialog" aria-label="One">
          <input aria-label="First" />
          <DefaultButton keyEquivalent="none" onClick={onClick}>
            One
          </DefaultButton>
        </div>
        <div role="dialog" aria-label="Two">
          <input aria-label="Second" />
          <DefaultButton disabled onClick={onClick}>
            Two
          </DefaultButton>
        </div>
        <div data-window-state="inactive">
          <input aria-label="Third" />
          <DefaultButton onClick={onClick}>Three</DefaultButton>
        </div>
      </>,
    );
    for (const name of ["First", "Second", "Third"]) {
      await user.click(screen.getByRole("textbox", { name }));
      await user.keyboard("{Enter}");
    }
    expect(onClick).not.toHaveBeenCalled();
  });

  it("submits its form once when it is a submit button", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="Folder" />
        <DefaultButton type="submit" onClick={onClick}>
          Go
        </DefaultButton>
      </form>,
    );
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is the submitter even when the form has an earlier submit button", async () => {
    const user = userEvent.setup();
    const onOther = vi.fn();
    const onDefault = vi.fn();
    const submitters: (HTMLElement | null)[] = [];
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitters.push((event.nativeEvent as SubmitEvent).submitter);
        }}
      >
        <button type="submit" onClick={onOther}>
          Delete
        </button>
        <input aria-label="Folder" />
        <input type="checkbox" aria-label="Remember" />
        <DefaultButton type="submit" onClick={onDefault}>
          Go
        </DefaultButton>
      </form>,
    );
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");
    screen.getByRole("checkbox").focus();
    await user.keyboard("{Enter}");
    expect(onOther).not.toHaveBeenCalled();
    expect(onDefault).toHaveBeenCalledTimes(2);
    const go = screen.getByRole("button", { name: "Go" });
    expect(submitters).toEqual([go, go]);
  });

  it("leaves Return to a control whose own handler keeps it, and to an open combo box", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <div role="dialog" aria-label="Go to the folder">
        <input
          aria-label="Prevents"
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
        />
        <input
          aria-label="Stops"
          onKeyDown={(event) => {
            if (event.key === "Enter") event.stopPropagation();
          }}
        />
        <input role="combobox" aria-label="Open" aria-expanded="true" aria-controls="list" />
        <input role="combobox" aria-label="Closed" aria-expanded="false" aria-controls="list" />
        <DefaultButton onClick={onClick}>Go</DefaultButton>
      </div>,
    );
    for (const name of ["Prevents", "Stops", "Open"]) {
      screen.getByLabelText(name).focus();
      await user.keyboard("{Enter}");
    }
    expect(onClick).not.toHaveBeenCalled();

    screen.getByLabelText("Closed").focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not answer Return from a dialog or form nested in its window", async () => {
    const user = userEvent.setup();
    const onOuter = vi.fn();
    const onInner = vi.fn();
    render(
      <div data-window-state="key">
        <input aria-label="Window field" />
        <DefaultButton onClick={onOuter}>Save</DefaultButton>
        <div role="dialog" aria-label="No default button">
          <input aria-label="Plain" />
        </div>
        <div role="dialog" aria-label="Disabled default button">
          <input aria-label="Disabled" />
          <DefaultButton disabled onClick={onInner}>
            Replace
          </DefaultButton>
        </div>
        <form onSubmit={(event) => event.preventDefault()}>
          <input aria-label="In form" />
        </form>
      </div>,
    );
    for (const name of ["Plain", "Disabled", "In form"]) {
      screen.getByLabelText(name).focus();
      await user.keyboard("{Enter}");
    }
    expect(onOuter).not.toHaveBeenCalled();
    expect(onInner).not.toHaveBeenCalled();

    screen.getByLabelText("Window field").focus();
    await user.keyboard("{Enter}");
    expect(onOuter).toHaveBeenCalledTimes(1);
  });

  it("keeps answering Return after a render prop replaces its element", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    function Fixture({ swapped }: { swapped: boolean }) {
      return (
        <div role="dialog" aria-label="Go to the folder">
          <input aria-label="Folder" />
          <DefaultButton
            onClick={onClick}
            nativeButton={!swapped}
            render={swapped ? <span data-swapped="" /> : undefined}
          >
            Go
          </DefaultButton>
        </div>
      );
    }
    const { rerender } = render(<Fixture swapped={false} />);
    const before = screen.getByRole("button");
    rerender(<Fixture swapped />);
    const after = screen.getByRole("button");
    expect(after).not.toBe(before);
    expect(after).toHaveAttribute("data-swapped");

    screen.getByRole("textbox").focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("leaves Return to the visible step when hidden and inert steps stay mounted", async () => {
    const user = userEvent.setup();
    const onHidden = vi.fn();
    const onInert = vi.fn();
    const onVisible = vi.fn();
    render(
      <form onSubmit={(event) => event.preventDefault()}>
        <div hidden>
          <DefaultButton onClick={onHidden}>Continue</DefaultButton>
        </div>
        <div inert>
          <DefaultButton onClick={onInert}>Continue</DefaultButton>
        </div>
        <div>
          <input aria-label="Name" />
          <DefaultButton onClick={onVisible}>Finish</DefaultButton>
        </div>
      </form>,
    );
    screen.getByLabelText("Name").focus();
    await user.keyboard("{Enter}");
    expect(onHidden).not.toHaveBeenCalled();
    expect(onInert).not.toHaveBeenCalled();
    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it("leaves Escape to a search field that holds text and to a select", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <div role="dialog" aria-label="Find">
        <input type="search" aria-label="Search" />
        <select aria-label="Kind">
          <option>Any</option>
        </select>
        <PushButton keyEquivalent="escape" onClick={onCancel}>
          Cancel
        </PushButton>
      </div>,
    );
    const search = screen.getByRole("searchbox");
    await user.type(search, "cat");
    expect(fireEvent.keyDown(search, { key: "Escape" })).toBe(true);
    screen.getByRole("combobox").focus();
    await user.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();

    await user.clear(search);
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("follows its element into another document", () => {
    const frame = document.body.appendChild(document.createElement("iframe"));
    const other = frame.contentDocument as Document;
    const onClick = vi.fn();
    function Fixture({ inFrame }: { inFrame: boolean }) {
      return createPortal(
        <div role="dialog" aria-label="Go to the folder">
          <input aria-label="Folder" />
          <DefaultButton onClick={onClick}>Go</DefaultButton>
        </div>,
        inFrame ? other.body : document.body,
      );
    }
    const { rerender, unmount } = render(<Fixture inFrame={false} />);
    fireEvent.keyDown(screen.getByLabelText("Folder"), { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<Fixture inFrame />);
    const field = other.querySelector("input") as HTMLInputElement;
    expect(field).not.toBeNull();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(2);

    unmount();
    frame.remove();
  });

  it("stops listening when it is removed", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <div role="dialog" aria-label="Go to the folder">
        <input aria-label="Folder" />
        <DefaultButton onClick={onClick}>Go</DefaultButton>
      </div>,
    );
    rerender(
      <div role="dialog" aria-label="Go to the folder">
        <input aria-label="Folder" />
      </div>,
    );
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards object and callback refs, className and native attributes", () => {
    const ref = createRef<HTMLElement>();
    const { unmount } = render(
      <DefaultButton ref={ref} id="go" className="extra" aria-describedby="hint">
        Go
      </DefaultButton>,
    );
    expect(ref.current).toBe(screen.getByRole("button"));
    expect(ref.current).toHaveClass("mac-default-button", "extra");
    expect(ref.current).toHaveAttribute("id", "go");
    expect(ref.current).toHaveAttribute("aria-describedby", "hint");
    unmount();
    expect(ref.current).toBeNull();

    const callback = vi.fn();
    const second = render(<DefaultButton ref={callback}>Go</DefaultButton>);
    expect(callback).toHaveBeenLastCalledWith(screen.getByRole("button"));
    second.unmount();
    expect(callback).toHaveBeenLastCalledWith(null);
  });
});

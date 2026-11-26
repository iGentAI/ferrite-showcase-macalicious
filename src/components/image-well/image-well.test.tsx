import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, Suspense, startTransition, use, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageWell } from "./index";

const png = () => new File(["png"], "picture.png", { type: "image/png" });
const text = () => new File(["text"], "notes.txt", { type: "text/plain" });
const well = () => screen.getByRole("button");
const chooser = () => well().querySelector('input[type="file"]') as HTMLInputElement;
const dragged = (...files: File[]) => ({ dataTransfer: { files, types: ["Files"] } });

// jsdom has no object URLs. Whatever URL has is put back as it was, absent if it was absent.
const createObjectURL = vi.fn((file: Blob) => `blob:${(file as File).name}`);
const revokeObjectURL = vi.fn();
const original = {
  createObjectURL: Object.getOwnPropertyDescriptor(URL, "createObjectURL"),
  revokeObjectURL: Object.getOwnPropertyDescriptor(URL, "revokeObjectURL"),
};

beforeEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

afterEach(() => {
  for (const [name, descriptor] of Object.entries(original)) {
    if (descriptor) Object.defineProperty(URL, name, descriptor);
    else delete (URL as unknown as Record<string, unknown>)[name];
  }
});

describe("ImageWell", () => {
  it("renders an empty editable well as a focusable button with its defaults", () => {
    render(<ImageWell aria-label="Picture" />);
    expect(well()).toHaveAccessibleName("Picture");
    expect(well()).toHaveClass("mac-image-well");
    expect(well()).toHaveAttribute("tabindex", "0");
    expect(well()).toHaveAttribute("data-frame", "bezel");
    expect(well()).toHaveAttribute("data-scaling", "proportionally-down");
    expect(well()).toHaveAttribute("data-editable");
    expect(well()).toHaveAttribute("data-empty");
    expect(well()).not.toHaveAttribute("data-disabled");
    expect(well()).not.toHaveAttribute("data-drag-over");
    expect(well().querySelector("img")).toBeNull();
    expect(chooser()).toHaveAttribute("accept", "image/*");
  });

  it("shows its image and takes its name from alt", () => {
    render(<ImageWell defaultSrc="/island.jpg" alt="An island" />);
    expect(well()).toHaveAccessibleName("An island");
    expect(well()).not.toHaveAttribute("data-empty");
    expect(well().querySelector("img")).toHaveAttribute("src", "/island.jpg");
  });

  it("reflects frame and scaling as data attributes", () => {
    render(<ImageWell aria-label="Picture" frame="photo" scaling="axes-independently" />);
    expect(well()).toHaveAttribute("data-frame", "photo");
    expect(well()).toHaveAttribute("data-scaling", "axes-independently");
  });

  it("shows its children while it has no image, and is then not empty", () => {
    const { rerender } = render(
      <ImageWell aria-label="Picture">
        <span>No picture</span>
      </ImageWell>,
    );
    expect(screen.getByText("No picture")).toBeInTheDocument();
    expect(well()).not.toHaveAttribute("data-empty");

    rerender(
      <ImageWell aria-label="Picture" src="/island.jpg">
        <span>No picture</span>
      </ImageWell>,
    );
    expect(screen.queryByText("No picture")).toBeNull();
  });

  it("is only a framed image when it is not editable", () => {
    const { container } = render(<ImageWell editable={false} src="/island.jpg" alt="An island" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("img", { name: "An island" })).toBeInTheDocument();
    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toHaveAttribute("tabindex");
    expect(root.querySelector('input[type="file"]')).toBeNull();
  });

  it("takes a dropped image file, shows it and reports it, when uncontrolled", () => {
    const onImageChange = vi.fn();
    render(<ImageWell aria-label="Picture" onImageChange={onImageChange} />);
    const file = png();

    fireEvent.dragEnter(well(), dragged(file));
    expect(well()).toHaveAttribute("data-drag-over");
    fireEvent.drop(well(), dragged(file));

    expect(well()).not.toHaveAttribute("data-drag-over");
    expect(onImageChange).toHaveBeenCalledExactlyOnceWith(file);
    expect(well().querySelector("img")).toHaveAttribute("src", "blob:picture.png");
    expect(well()).not.toHaveAttribute("data-empty");
  });

  it("allows the drop of files only, and drops the highlight when the drag leaves", () => {
    render(<ImageWell aria-label="Picture" />);

    const overText = fireEvent.dragOver(well(), {
      dataTransfer: { files: [], types: ["text/plain"] },
    });
    expect(overText).toBe(true);
    expect(well()).not.toHaveAttribute("data-drag-over");

    const overFile = fireEvent.dragOver(well(), dragged(png()));
    expect(overFile).toBe(false);
    expect(well()).toHaveAttribute("data-drag-over");

    fireEvent.dragLeave(well(), { relatedTarget: document.body });
    expect(well()).not.toHaveAttribute("data-drag-over");
  });

  it("drops the highlight when it is disabled under a drag, and does not get it back", () => {
    const { rerender } = render(<ImageWell aria-label="Picture" />);
    fireEvent.dragOver(well(), dragged(png()));
    expect(well()).toHaveAttribute("data-drag-over");

    rerender(<ImageWell aria-label="Picture" disabled />);
    expect(well()).not.toHaveAttribute("data-drag-over");
    rerender(<ImageWell aria-label="Picture" />);
    expect(well()).not.toHaveAttribute("data-drag-over");
  });

  it("calls the consumer's onClick once for a click that opens the file dialog", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ImageWell aria-label="Picture" onClick={onClick} />);
    await user.click(well());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ignores a dropped file of another type, and takes the first that fits accept", () => {
    const onImageChange = vi.fn();
    const { rerender } = render(<ImageWell aria-label="Picture" onImageChange={onImageChange} />);
    fireEvent.drop(well(), dragged(text()));
    expect(onImageChange).not.toHaveBeenCalled();

    const file = png();
    fireEvent.drop(well(), dragged(text(), file));
    expect(onImageChange).toHaveBeenLastCalledWith(file);

    rerender(
      <ImageWell aria-label="Picture" accept=".txt, image/jpeg" onImageChange={onImageChange} />,
    );
    const notes = text();
    fireEvent.drop(well(), dragged(png(), notes));
    expect(onImageChange).toHaveBeenLastCalledWith(notes);
  });

  it("takes a pasted image file", () => {
    const onImageChange = vi.fn();
    render(<ImageWell aria-label="Picture" onImageChange={onImageChange} />);
    const file = png();
    fireEvent.paste(well(), { clipboardData: { files: [file] } });
    expect(onImageChange).toHaveBeenCalledExactlyOnceWith(file);
  });

  it("takes a file chosen in the file dialog", async () => {
    const user = userEvent.setup();
    const onImageChange = vi.fn();
    render(<ImageWell aria-label="Picture" onImageChange={onImageChange} />);
    const file = png();
    await user.upload(chooser(), file);
    expect(onImageChange).toHaveBeenCalledExactlyOnceWith(file);
    expect(well().querySelector("img")).toHaveAttribute("src", "blob:picture.png");
  });

  it("opens the file dialog on click, Return and Space", async () => {
    const user = userEvent.setup();
    render(<ImageWell aria-label="Picture" />);
    const open = vi.spyOn(chooser(), "click");

    await user.click(well());
    expect(open).toHaveBeenCalledTimes(1);
    expect(well()).toHaveFocus();

    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(open).toHaveBeenCalledTimes(3);
  });

  it("opens the file dialog once when Space is released, as a button does", () => {
    render(<ImageWell aria-label="Picture" />);
    const open = vi.spyOn(chooser(), "click");
    well().focus();

    fireEvent.keyDown(well(), { key: " " });
    fireEvent.keyDown(well(), { key: " ", repeat: true });
    expect(open).not.toHaveBeenCalled();
    fireEvent.keyUp(well(), { key: " " });
    expect(open).toHaveBeenCalledTimes(1);

    // Focus that leaves while Space is down takes the press with it.
    fireEvent.keyDown(well(), { key: " " });
    fireEvent.blur(well());
    fireEvent.keyUp(well(), { key: " " });
    // A release with no press on the well does nothing either.
    fireEvent.keyUp(well(), { key: " " });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("forgets a Space press when it is disabled or made read-only before the release", () => {
    const { rerender } = render(<ImageWell aria-label="Picture" />);
    const open = vi.spyOn(chooser(), "click");
    well().focus();

    // A disabled div keeps focus, so no blur clears the press.
    fireEvent.keyDown(well(), { key: " " });
    rerender(<ImageWell aria-label="Picture" disabled />);
    rerender(<ImageWell aria-label="Picture" />);
    expect(well()).toHaveFocus();
    fireEvent.keyUp(well(), { key: " " });
    expect(open).not.toHaveBeenCalled();

    fireEvent.keyDown(well(), { key: " " });
    rerender(<ImageWell aria-label="Picture" editable={false} />);
    rerender(<ImageWell aria-label="Picture" />);
    // A well that was not editable had no file input, so this one is new.
    const second = vi.spyOn(chooser(), "click");
    fireEvent.keyUp(well(), { key: " " });
    expect(second).not.toHaveBeenCalled();

    // A press made after it takes input again still acts.
    fireEvent.keyDown(well(), { key: " " });
    fireEvent.keyUp(well(), { key: " " });
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("keeps a Space press when a render that would disable it is abandoned", async () => {
    const never = new Promise<never>(() => {});
    const Waits = () => use(never);
    let disable = () => {};
    function Host() {
      const [off, setOff] = useState(false);
      disable = () => setOff(true);
      return (
        <Suspense fallback={null}>
          <ImageWell aria-label="Picture" disabled={off}>
            {off ? <Waits /> : null}
          </ImageWell>
        </Suspense>
      );
    }
    render(<Host />);
    const open = vi.spyOn(chooser(), "click");
    well().focus();
    fireEvent.keyDown(well(), { key: " " });

    // The disabled well is rendered, but its content waits, so React keeps the enabled one.
    await act(async () => startTransition(disable));
    expect(well()).not.toHaveAttribute("aria-disabled");
    fireEvent.keyUp(well(), { key: " " });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("lets a click handler keep the file dialog closed, for the keyboard as for the pointer", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(<ImageWell aria-label="Picture" onClick={onClick} />);
    const open = vi.spyOn(chooser(), "click");
    await user.click(well());
    expect(onClick).toHaveBeenCalledTimes(1);

    // Return and Space activate the well as a click, as they do a button.
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
    expect(open).not.toHaveBeenCalled();
  });

  it("clears on Delete and Backspace, and releases the object URL it made", async () => {
    const user = userEvent.setup();
    const onImageChange = vi.fn();
    render(<ImageWell aria-label="Picture" onImageChange={onImageChange} />);
    fireEvent.drop(well(), dragged(png()));

    await user.tab();
    expect(well()).toHaveFocus();
    await user.keyboard("{Delete}");
    expect(onImageChange).toHaveBeenLastCalledWith(null);
    expect(well()).toHaveAttribute("data-empty");
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:picture.png");

    // Nothing to clear: no second report.
    await user.keyboard("{Backspace}");
    expect(onImageChange).toHaveBeenCalledTimes(2);
  });

  it("releases its object URL when it unmounts", () => {
    const { unmount } = render(<ImageWell aria-label="Picture" />);
    fireEvent.drop(well(), dragged(png()));
    expect(revokeObjectURL).not.toHaveBeenCalled();
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:picture.png");
  });

  it("only reports changes when controlled", async () => {
    const user = userEvent.setup();
    const onImageChange = vi.fn();
    const { rerender } = render(
      <ImageWell aria-label="Picture" src="/island.jpg" onImageChange={onImageChange} />,
    );
    const file = png();
    fireEvent.drop(well(), dragged(file));
    expect(onImageChange).toHaveBeenLastCalledWith(file);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(well().querySelector("img")).toHaveAttribute("src", "/island.jpg");

    await user.tab();
    await user.keyboard("{Delete}");
    expect(onImageChange).toHaveBeenLastCalledWith(null);
    expect(well().querySelector("img")).toHaveAttribute("src", "/island.jpg");

    rerender(<ImageWell aria-label="Picture" src={null} onImageChange={onImageChange} />);
    expect(well()).toHaveAttribute("data-empty");
  });

  it("leaves the tab order and ignores drops, pastes, clicks and keys when disabled", async () => {
    const user = userEvent.setup();
    const onImageChange = vi.fn();
    render(
      <ImageWell
        aria-label="Picture"
        defaultSrc="/island.jpg"
        disabled
        onImageChange={onImageChange}
      />,
    );
    expect(well()).toHaveAttribute("aria-disabled", "true");
    expect(well()).toHaveAttribute("data-disabled");
    expect(well()).not.toHaveAttribute("tabindex");
    expect(chooser()).toBeDisabled();
    const open = vi.spyOn(chooser(), "click");

    await user.tab();
    expect(well()).not.toHaveFocus();
    await user.click(well());
    fireEvent.dragOver(well(), dragged(png()));
    expect(well()).not.toHaveAttribute("data-drag-over");
    fireEvent.drop(well(), dragged(png()));
    fireEvent.paste(well(), { clipboardData: { files: [png()] } });
    fireEvent.keyDown(well(), { key: "Delete" });
    expect(open).not.toHaveBeenCalled();
    expect(onImageChange).not.toHaveBeenCalled();
  });

  it("calls the consumer's handlers too", () => {
    const onDrop = vi.fn();
    const onKeyDown = vi.fn();
    const onPaste = vi.fn();
    render(
      <ImageWell aria-label="Picture" onDrop={onDrop} onKeyDown={onKeyDown} onPaste={onPaste} />,
    );
    fireEvent.drop(well(), dragged(png()));
    fireEvent.keyDown(well(), { key: "a" });
    fireEvent.paste(well(), { clipboardData: { files: [] } });
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onPaste).toHaveBeenCalledTimes(1);
  });

  it("forwards ref, className, style and native attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ImageWell
        ref={ref}
        className="extra"
        id="picture"
        aria-label="Picture"
        data-testid="subject"
        style={{ width: 138 }}
      />,
    );
    expect(ref.current).toBe(well());
    expect(ref.current).toHaveClass("mac-image-well", "extra");
    expect(ref.current).toHaveAttribute("id", "picture");
    expect(ref.current).toHaveAttribute("data-testid", "subject");
    expect(ref.current).toHaveStyle({ width: "138px" });
  });

  it("is named by alt while it is empty, unless it is labelled otherwise", () => {
    const { rerender } = render(<ImageWell alt="Desktop picture" />);
    expect(well()).toHaveAccessibleName("Desktop picture");
    rerender(<ImageWell alt="Desktop picture" aria-label="Picture" />);
    expect(well()).toHaveAccessibleName("Picture");
  });

  it("takes any file when accept is empty", () => {
    const onImageChange = vi.fn();
    render(<ImageWell aria-label="File" accept="" onImageChange={onImageChange} />);
    fireEvent.drop(well(), dragged(text()));
    expect(onImageChange).toHaveBeenCalledWith(expect.objectContaining({ name: "notes.txt" }));
  });
});

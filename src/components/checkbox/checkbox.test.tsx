import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./index";

describe("Checkbox", () => {
  it("renders an unchecked checkbox named by its title", () => {
    render(<Checkbox>Show Bluetooth in menu bar</Checkbox>);
    const checkbox = screen.getByRole("checkbox", { name: "Show Bluetooth in menu bar" });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveClass("mac-checkbox");
    expect(checkbox).toHaveAttribute("data-size", "regular");
    expect(checkbox).toHaveAttribute("data-unchecked");
  });

  it("reflects size as a data attribute", () => {
    render(<Checkbox size="mini">Mini</Checkbox>);
    expect(screen.getByRole("checkbox")).toHaveAttribute("data-size", "mini");
  });

  it("takes its name from aria-label when it has no title", () => {
    const { container } = render(<Checkbox aria-label="File Sharing" />);
    expect(screen.getByRole("checkbox", { name: "File Sharing" })).toBeInTheDocument();
    expect(container.querySelector(".mac-checkbox-title")).toBeNull();
  });

  it("toggles with the pointer, on the box or the title, and reports the change", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox onCheckedChange={onCheckedChange}>Title</Checkbox>);
    const checkbox = screen.getByRole("checkbox");

    await user.click(screen.getByText("Title"));
    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveAttribute("data-checked");
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.anything());

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(onCheckedChange).toHaveBeenLastCalledWith(false, expect.anything());
  });

  it("is reachable with Tab and toggles with Space", async () => {
    const user = userEvent.setup();
    render(<Checkbox>Title</Checkbox>);
    const checkbox = screen.getByRole("checkbox");

    await user.tab();
    expect(checkbox).toHaveFocus();
    await user.keyboard(" ");
    expect(checkbox).toBeChecked();
    await user.keyboard(" ");
    expect(checkbox).not.toBeChecked();
  });

  it("starts checked with defaultChecked", () => {
    render(<Checkbox defaultChecked>Title</Checkbox>);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("stays as its `checked` prop says when controlled", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <Checkbox checked={false} onCheckedChange={onCheckedChange}>
        Title
      </Checkbox>,
    );
    const checkbox = screen.getByRole("checkbox");

    await user.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
    expect(checkbox).not.toBeChecked();

    rerender(
      <Checkbox checked onCheckedChange={onCheckedChange}>
        Title
      </Checkbox>,
    );
    expect(checkbox).toBeChecked();
  });

  it("exposes the mixed state and draws the dash for it", () => {
    render(<Checkbox indeterminate>Title</Checkbox>);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-checked", "mixed");
    expect(checkbox).toHaveAttribute("data-indeterminate");
  });

  it("leaves the mixed state when a parent resolves it", async () => {
    const user = userEvent.setup();
    function Parent() {
      const [checked, setChecked] = useState(false);
      const [mixed, setMixed] = useState(true);
      return (
        <Checkbox
          checked={checked}
          indeterminate={mixed}
          onCheckedChange={(next) => {
            setMixed(false);
            setChecked(next);
          }}
        >
          All
        </Checkbox>
      );
    }
    render(<Parent />);
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);
    expect(checkbox).toHaveAttribute("aria-checked", "true");
    expect(checkbox).not.toHaveAttribute("data-indeterminate");
  });

  it("ignores activation when disabled", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Checkbox disabled onCheckedChange={onCheckedChange}>
        Title
      </Checkbox>,
    );
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    expect(checkbox).toHaveAttribute("data-disabled");

    await user.click(checkbox);
    await user.tab();
    await user.keyboard(" ");
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(checkbox).not.toBeChecked();
    expect(checkbox).not.toHaveFocus();
  });

  it("does not change when read-only", async () => {
    const user = userEvent.setup();
    render(
      <Checkbox readOnly defaultChecked>
        Title
      </Checkbox>,
    );
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("submits its name and value with a form", async () => {
    const user = userEvent.setup();
    let data: FormData | undefined;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <Checkbox name="sharing" value="files">
          File Sharing
        </Checkbox>
        <button type="submit">Save</button>
      </form>,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(data?.get("sharing")).toBeNull();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(data?.get("sharing")).toBe("files");
  });

  it("keeps its own class when className is a string or a state function", () => {
    const { unmount } = render(<Checkbox className="extra">Title</Checkbox>);
    expect(screen.getByRole("checkbox")).toHaveClass("mac-checkbox", "extra");
    unmount();

    render(
      <Checkbox defaultChecked className={(state) => (state.checked ? "is-on" : "is-off")}>
        Title
      </Checkbox>,
    );
    expect(screen.getByRole("checkbox")).toHaveClass("mac-checkbox", "is-on");
  });

  it("forwards ref and attributes to the element with the checkbox role", () => {
    const ref = createRef<HTMLElement>();
    render(
      <Checkbox ref={ref} aria-describedby="hint" data-testid="subject" style={{ margin: 4 }}>
        Title
      </Checkbox>,
    );
    const checkbox = screen.getByRole("checkbox");
    expect(ref.current).toBe(checkbox);
    expect(checkbox).toHaveAttribute("aria-describedby", "hint");
    expect(checkbox).toHaveAttribute("data-testid", "subject");
    expect(checkbox).toHaveStyle({ margin: "4px" });
  });
});

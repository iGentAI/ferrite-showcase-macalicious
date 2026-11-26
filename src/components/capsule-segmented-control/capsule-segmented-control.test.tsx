import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, Fragment, type ReactNode, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CapsuleSegment,
  CapsuleSegmentedControl,
  type CapsuleSegmentedControlProps,
} from "./index";

function Card(props: CapsuleSegmentedControlProps) {
  return (
    <CapsuleSegmentedControl aria-label="Card" {...props}>
      <CapsuleSegment value="info">Info</CapsuleSegment>
      <CapsuleSegment value="picture">Picture</CapsuleSegment>
    </CapsuleSegmentedControl>
  );
}

const segment = (name: string) => screen.getByRole("button", { name });

describe("CapsuleSegmentedControl", () => {
  it("renders a named group of toggle buttons with its classes", () => {
    render(<Card defaultValue={["info"]} />);
    expect(screen.getByRole("group", { name: "Card" })).toHaveClass(
      "mac-capsule-segmented-control",
    );
    expect(segment("Info")).toHaveClass("mac-capsule-segmented-control-segment");
    expect(segment("Info")).toHaveAttribute("aria-pressed", "true");
    expect(segment("Info")).toHaveAttribute("data-pressed");
    expect(segment("Picture")).toHaveAttribute("aria-pressed", "false");
  });

  it("selects the clicked segment and deselects the other", async () => {
    const onValueChange = vi.fn();
    render(<Card defaultValue={["info"]} onValueChange={onValueChange} />);
    await userEvent.click(segment("Picture"));
    expect(segment("Picture")).toHaveAttribute("aria-pressed", "true");
    expect(segment("Info")).toHaveAttribute("aria-pressed", "false");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(["picture"], expect.anything());
  });

  it("keeps the selection when the selected segment is clicked again", async () => {
    const onValueChange = vi.fn();
    render(<Card defaultValue={["info"]} onValueChange={onValueChange} />);
    await userEvent.click(segment("Info"));
    expect(segment("Info")).toHaveAttribute("aria-pressed", "true");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("stays as its `value` prop says when controlled", async () => {
    const onValueChange = vi.fn();
    render(<Card value={["info"]} onValueChange={onValueChange} />);
    await userEvent.click(segment("Picture"));
    expect(onValueChange).toHaveBeenLastCalledWith(["picture"], expect.anything());
    expect(segment("Info")).toHaveAttribute("aria-pressed", "true");
  });

  it("is one tab stop, moved through with the arrow keys and selected with Space", async () => {
    render(<Card defaultValue={["info"]} />);
    await userEvent.tab();
    expect(segment("Info")).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(segment("Picture")).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(segment("Picture")).toHaveAttribute("aria-pressed", "true");
    await userEvent.tab();
    expect(document.body).toHaveFocus();
  });

  it("does not change while disabled", async () => {
    const onValueChange = vi.fn();
    render(<Card defaultValue={["info"]} disabled onValueChange={onValueChange} />);
    expect(segment("Picture")).toBeDisabled();
    expect(segment("Picture")).toHaveAttribute("data-disabled");
    await userEvent.click(segment("Picture"));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(segment("Info")).toHaveAttribute("aria-pressed", "true");
  });

  it("forwards refs, class names and native attributes to the group and a segment", () => {
    const group = createRef<HTMLDivElement>();
    const button = createRef<HTMLButtonElement>();
    render(
      <CapsuleSegmentedControl ref={group} aria-label="Card" className="extra" id="card">
        <CapsuleSegment ref={button} value="info" className={() => "from-state"} data-kind="a">
          Info
        </CapsuleSegment>
      </CapsuleSegmentedControl>,
    );
    expect(group.current).toHaveClass("mac-capsule-segmented-control", "extra");
    expect(group.current).toHaveAttribute("id", "card");
    expect(button.current).toHaveClass("mac-capsule-segmented-control-segment", "from-state");
    expect(button.current).toHaveAttribute("data-kind", "a");
  });

  it("requires a value on every segment", () => {
    // Type check only: the element is never rendered.
    // @ts-expect-error `value` is required.
    const missing = <CapsuleSegment>Info</CapsuleSegment>;
    expect(missing).toBeDefined();
  });

  const pressed = () =>
    screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-pressed") === "true")
      .map((button) => button.textContent);

  it("selects the first segment when no value or default is given", () => {
    const onValueChange = vi.fn();
    render(<Card onValueChange={onValueChange} />);
    expect(pressed()).toEqual(["Info"]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("selects the first segment when the default names no segment", async () => {
    const onValueChange = vi.fn();
    render(<Card defaultValue={["missing"]} onValueChange={onValueChange} />);
    expect(pressed()).toEqual(["Info"]);
    expect(onValueChange).not.toHaveBeenCalled();
    await userEvent.click(segment("Picture"));
    expect(pressed()).toEqual(["Picture"]);
    expect(onValueChange).toHaveBeenLastCalledWith(["picture"], expect.anything());
  });

  it("skips a disabled first segment when it falls back", () => {
    render(
      <CapsuleSegmentedControl aria-label="Card">
        <CapsuleSegment value="info" disabled>
          Info
        </CapsuleSegment>
        <CapsuleSegment value="picture">Picture</CapsuleSegment>
      </CapsuleSegmentedControl>,
    );
    expect(pressed()).toEqual(["Picture"]);
  });

  it("shows the first segment for a controlled value that names no segment", () => {
    const onValueChange = vi.fn();
    render(<Card value={["missing"]} onValueChange={onValueChange} />);
    expect(pressed()).toEqual(["Info"]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("finds segments inside fragments and wrapper components, in document order", async () => {
    function Wrapped({ children }: { children: ReactNode }) {
      return <>{children}</>;
    }
    const onValueChange = vi.fn();
    render(
      <CapsuleSegmentedControl aria-label="Card" onValueChange={onValueChange}>
        <Fragment key="first">
          <Wrapped>
            <CapsuleSegment value="info">Info</CapsuleSegment>
          </Wrapped>
          <CapsuleSegment value="picture">Picture</CapsuleSegment>
        </Fragment>
        <Fragment key="second">
          {["notes"].map((value) => (
            <CapsuleSegment key={value} value={value}>
              Notes
            </CapsuleSegment>
          ))}
        </Fragment>
      </CapsuleSegmentedControl>,
    );
    expect(pressed()).toEqual(["Info"]);
    await userEvent.tab();
    expect(segment("Info")).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(segment("Notes")).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(pressed()).toEqual(["Notes"]);
    expect(onValueChange).toHaveBeenLastCalledWith(["notes"], expect.anything());
  });

  it("moves the selection to the first segment when the selected one is removed", () => {
    const onValueChange = vi.fn();
    const Three = ({ notes }: { notes: boolean }) => (
      <CapsuleSegmentedControl
        aria-label="Card"
        defaultValue={["notes"]}
        onValueChange={onValueChange}
      >
        <CapsuleSegment value="info">Info</CapsuleSegment>
        <CapsuleSegment value="picture">Picture</CapsuleSegment>
        {notes && <CapsuleSegment value="notes">Notes</CapsuleSegment>}
      </CapsuleSegmentedControl>
    );
    const { rerender } = render(<Three notes />);
    expect(pressed()).toEqual(["Notes"]);
    rerender(<Three notes={false} />);
    expect(pressed()).toEqual(["Info"]);
    // The fallback is kept: the segment coming back does not take the selection back.
    rerender(<Three notes />);
    expect(pressed()).toEqual(["Info"]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("selects the first segment for an empty value, controlled or not", () => {
    const { unmount } = render(<Card defaultValue={[]} />);
    expect(pressed()).toEqual(["Info"]);
    unmount();
    render(<Card value={[]} />);
    expect(pressed()).toEqual(["Info"]);
  });

  it("does not clear the selection when a controlled value becomes empty", () => {
    const { rerender } = render(<Card value={["picture"]} />);
    expect(pressed()).toEqual(["Picture"]);
    rerender(<Card value={[]} />);
    expect(pressed()).toEqual(["Info"]);
  });

  it("selects the first entry of several that names a segment, and reports one", async () => {
    const onValueChange = vi.fn();
    render(<Card defaultValue={["missing", "picture", "info"]} onValueChange={onValueChange} />);
    expect(pressed()).toEqual(["Picture"]);
    await userEvent.click(segment("Info"));
    expect(pressed()).toEqual(["Info"]);
    expect(onValueChange).toHaveBeenLastCalledWith(["info"], expect.anything());
    const { unmount } = render(<Card value={["picture", "info"]} aria-label="Second" />);
    const second = screen.getByRole("group", { name: "Second" });
    expect(
      [...second.querySelectorAll('[aria-pressed="true"]')].map((button) => button.textContent),
    ).toEqual(["Picture"]);
    unmount();
  });

  it("selects one valid segment in server-rendered HTML", () => {
    const serverPressed = (element: ReactNode) => {
      const host = document.createElement("div");
      host.innerHTML = renderToString(element);
      return [...host.querySelectorAll('[aria-pressed="true"]')].map((node) => node.textContent);
    };
    expect(serverPressed(<Card />)).toEqual(["Info"]);
    expect(serverPressed(<Card value={[]} />)).toEqual(["Info"]);
    expect(serverPressed(<Card defaultValue={["missing", "picture"]} />)).toEqual(["Picture"]);
    expect(
      serverPressed(
        <CapsuleSegmentedControl aria-label="Card">
          <Fragment key="segments">
            <CapsuleSegment value="info" disabled>
              Info
            </CapsuleSegment>
            {["picture"].map((value) => (
              <CapsuleSegment key={value} value={value}>
                Picture
              </CapsuleSegment>
            ))}
          </Fragment>
        </CapsuleSegmentedControl>,
      ),
    ).toEqual(["Picture"]);
  });

  it("forgets an uncontrolled selection when every segment is removed", () => {
    const Listed = ({ order }: { order: string[] }) => (
      <CapsuleSegmentedControl aria-label="Card" defaultValue={["notes"]}>
        {order.map((value) => (
          <CapsuleSegment key={value} value={value}>
            {value}
          </CapsuleSegment>
        ))}
      </CapsuleSegmentedControl>
    );
    const { rerender } = render(<Listed order={["info", "notes"]} />);
    expect(pressed()).toEqual(["notes"]);
    rerender(<Listed order={[]} />);
    rerender(<Listed order={["picture", "notes"]} />);
    expect(pressed()).toEqual(["picture"]);
  });

  it("follows a wrapper that reorders mounted segments without rendering the group", async () => {
    function Reorderable() {
      const [flipped, setFlipped] = useState(false);
      const order = flipped ? ["picture", "info"] : ["info", "picture"];
      return (
        <>
          <button type="button" onClick={() => setFlipped(true)}>
            Flip
          </button>
          {order.map((value) => (
            <CapsuleSegment key={value} value={value}>
              {value}
            </CapsuleSegment>
          ))}
        </>
      );
    }
    render(
      <CapsuleSegmentedControl aria-label="Card" value={["missing"]}>
        <Reorderable />
      </CapsuleSegmentedControl>,
    );
    expect(pressed()).toEqual(["info"]);
    await userEvent.click(screen.getByRole("button", { name: "Flip" }));
    await waitFor(() => expect(pressed()).toEqual(["picture"]));
  });

  it("warns in development when the first render could not see the segments", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    function Wrapped() {
      return (
        <>
          <CapsuleSegment value="info">Info</CapsuleSegment>
          <CapsuleSegment value="picture">Picture</CapsuleSegment>
        </>
      );
    }
    const { unmount } = render(
      <CapsuleSegmentedControl aria-label="Card" value={["picture"]}>
        <Wrapped />
      </CapsuleSegmentedControl>,
    );
    expect(pressed()).toEqual(["Picture"]);
    expect(warn).not.toHaveBeenCalled();
    unmount();
    render(
      <CapsuleSegmentedControl aria-label="Card">
        <Wrapped />
      </CapsuleSegmentedControl>,
    );
    expect(pressed()).toEqual(["Info"]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/only known once mounted/);
    warn.mockRestore();
  });

  it("keeps an uncontrolled selection when the selected segment's props or element change", () => {
    const Changing = ({ step }: { step: number }) => (
      <CapsuleSegmentedControl aria-label="Card" defaultValue={["info"]}>
        <CapsuleSegment
          value="info"
          disabled={step === 1}
          ref={step === 2 ? () => {} : undefined}
          render={<button type="button" key={step === 3 ? "b" : "a"} />}
        >
          Info
        </CapsuleSegment>
        <CapsuleSegment value="picture">Picture</CapsuleSegment>
      </CapsuleSegmentedControl>
    );
    const { rerender } = render(<Changing step={0} />);
    for (const step of [1, 2, 3, 0]) {
      rerender(<Changing step={step} />);
      expect(pressed()).toEqual(["Info"]);
    }
  });

  it("keeps an uncontrolled selection when a wrapper changes the selected segment alone", async () => {
    function Toggling() {
      const [disabled, setDisabled] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setDisabled(true)}>
            Disable
          </button>
          <CapsuleSegment value="info" disabled={disabled}>
            Info
          </CapsuleSegment>
          <CapsuleSegment value="picture">Picture</CapsuleSegment>
        </>
      );
    }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <CapsuleSegmentedControl aria-label="Card" defaultValue={["info"]}>
        <Toggling />
      </CapsuleSegmentedControl>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Disable" }));
    expect(pressed()).toEqual(["Info"]);
    warn.mockRestore();
  });

  it("still follows a wrapper's reorder after `render` replaces the group element", async () => {
    function Reorderable() {
      const [flipped, setFlipped] = useState(false);
      const order = flipped ? ["picture", "info"] : ["info", "picture"];
      return (
        <>
          <button type="button" onClick={() => setFlipped(true)}>
            Flip
          </button>
          {order.map((value) => (
            <CapsuleSegment key={value} value={value}>
              {value}
            </CapsuleSegment>
          ))}
        </>
      );
    }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const Group = ({ root }: { root: string }) => (
      <CapsuleSegmentedControl
        aria-label="Card"
        value={["missing"]}
        render={<div key={root} data-root={root} />}
      >
        <Reorderable />
      </CapsuleSegmentedControl>
    );
    const { rerender } = render(<Group root="a" />);
    rerender(<Group root="b" />);
    expect(document.querySelector('[data-root="b"]')).not.toBeNull();
    expect(pressed()).toEqual(["info"]);
    await userEvent.click(screen.getByRole("button", { name: "Flip" }));
    await waitFor(() => expect(pressed()).toEqual(["picture"]));
    warn.mockRestore();
  });

  it("does not warn in a production build", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    function Wrapped() {
      return <CapsuleSegment value="info">Info</CapsuleSegment>;
    }
    render(
      <CapsuleSegmentedControl aria-label="Card">
        <Wrapped />
      </CapsuleSegmentedControl>,
    );
    expect(pressed()).toEqual(["Info"]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  it("keeps the selection when a handler cancels the change", async () => {
    render(<Card defaultValue={["info"]} onValueChange={(_, details) => details.cancel()} />);
    await userEvent.click(segment("Picture"));
    expect(pressed()).toEqual(["Info"]);
  });

  it("falls back by the committed document order when segments are reordered", () => {
    const Ordered = ({ order }: { order: string[] }) => (
      <CapsuleSegmentedControl aria-label="Card" value={["missing"]}>
        {order.map((value) => (
          <CapsuleSegment key={value} value={value}>
            {value}
          </CapsuleSegment>
        ))}
      </CapsuleSegmentedControl>
    );
    const { rerender } = render(<Ordered order={["info", "picture"]} />);
    expect(pressed()).toEqual(["info"]);
    rerender(<Ordered order={["picture", "info"]} />);
    expect(pressed()).toEqual(["picture"]);
  });

  it("follows a segment whose element `render` replaces", () => {
    const Replaced = ({ swap }: { swap: string }) => (
      <CapsuleSegmentedControl aria-label="Card" value={["missing"]}>
        <CapsuleSegment value="info" render={<button type="button" key={swap} />}>
          Info
        </CapsuleSegment>
        <CapsuleSegment value="picture">Picture</CapsuleSegment>
      </CapsuleSegmentedControl>
    );
    const { rerender } = render(<Replaced swap="a" />);
    const before = segment("Info");
    rerender(<Replaced swap="b" />);
    expect(segment("Info")).not.toBe(before);
    expect(pressed()).toEqual(["Info"]);
    rerender(<Replaced swap="c" />);
    expect(pressed()).toEqual(["Info"]);
  });

  it("keeps the selection when a segment that is not selected is removed", () => {
    const Two = ({ info }: { info: boolean }) => (
      <CapsuleSegmentedControl aria-label="Card" defaultValue={["picture"]}>
        {info && <CapsuleSegment value="info">Info</CapsuleSegment>}
        <CapsuleSegment value="picture">Picture</CapsuleSegment>
      </CapsuleSegmentedControl>
    );
    const { rerender } = render(<Two info />);
    rerender(<Two info={false} />);
    expect(pressed()).toEqual(["Picture"]);
  });
});

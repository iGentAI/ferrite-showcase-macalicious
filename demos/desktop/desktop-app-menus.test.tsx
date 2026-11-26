import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { useDesktopAppMenu, useDesktopAppMenuItems } from "./desktop-app-menus";

/** A window of the application `app` that registers `label` as its File menu. */
function Window({ app, id, label }: { app: string; id: string; label: string }) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useDesktopAppMenu(app, "File", <span>{label}</span>, element);
  return (
    <div data-window-id={id} ref={setElement}>
      <button type="button">{`inside ${id}`}</button>
    </div>
  );
}

function Bar({ app }: { app: string }) {
  return <div data-testid="bar">{useDesktopAppMenuItems(app, "File")}</div>;
}

const bar = () => screen.getByTestId("bar").textContent;

describe("an application's own menu items", () => {
  it("follow the window the person used last, not the one that rendered last", () => {
    const view = render(
      <>
        <Bar app="first" />
        <Window app="first" id="a" label="Save A" />
        <Window app="first" id="b" label="Save B" />
      </>,
    );
    // The window opened last is in front.
    expect(bar()).toBe("Save B");
    // Window A renders again in the background: B's commands stay.
    view.rerender(
      <>
        <Bar app="first" />
        <Window app="first" id="a" label="Save A, edited" />
        <Window app="first" id="b" label="Save B" />
      </>,
    );
    expect(bar()).toBe("Save B");
    // The person clicks in window A: its commands show, as it renders now.
    act(() => {
      fireEvent.pointerDown(screen.getByRole("button", { name: "inside a" }));
    });
    expect(bar()).toBe("Save A, edited");
    // And focus moving into B brings B's back.
    act(() => {
      screen.getByRole("button", { name: "inside b" }).focus();
    });
    expect(bar()).toBe("Save B");
  });

  it("show the window used before when the one in front closes, and none when all have", () => {
    const view = render(
      <>
        <Bar app="second" />
        <Window app="second" id="a" label="Save A" />
        <Window app="second" id="b" label="Save B" />
      </>,
    );
    expect(bar()).toBe("Save B");
    view.rerender(
      <>
        <Bar app="second" />
        <Window app="second" id="a" label="Save A" />
      </>,
    );
    expect(bar()).toBe("Save A");
    view.rerender(<Bar app="second" />);
    expect(bar()).toBe("");
  });
});

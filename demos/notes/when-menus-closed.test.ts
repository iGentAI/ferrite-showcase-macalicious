import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { whenMenusClosed } from "./notes-menus";

const frames = async (count: number) => {
  for (let i = 0; i < count; i++) {
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }
};

describe("whenMenusClosed", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });
  const menu = () => {
    const element = document.createElement("div");
    element.setAttribute("role", "menu");
    document.body.append(element);
    return element;
  };

  it("waits for the menu, then calls back twice", async () => {
    const open = menu();
    const then = vi.fn();
    whenMenusClosed(document, then);
    await frames(3);
    expect(then).toHaveBeenCalledTimes(0);
    open.remove();
    await frames(4);
    expect(then).toHaveBeenCalledTimes(2);
  });

  it("does not call back once the person has pressed something else", async () => {
    const open = menu();
    const then = vi.fn();
    whenMenusClosed(document, then);
    fireEvent.pointerDown(document.body);
    open.remove();
    await frames(4);
    expect(then).toHaveBeenCalledTimes(0);
  });

  it("does not call back after a command key, but does after a plain one", async () => {
    const first = menu();
    const afterCommand = vi.fn();
    whenMenusClosed(document, afterCommand);
    fireEvent.keyDown(document.body, { key: "0", ctrlKey: true });
    first.remove();
    await frames(4);
    expect(afterCommand).toHaveBeenCalledTimes(0);

    const second = menu();
    const afterTyping = vi.fn();
    whenMenusClosed(document, afterTyping);
    fireEvent.keyDown(document.body, { key: "a" });
    second.remove();
    await frames(4);
    expect(afterTyping).toHaveBeenCalledTimes(2);
  });
});

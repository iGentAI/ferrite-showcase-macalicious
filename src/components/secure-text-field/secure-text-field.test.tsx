import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { SecureTextField } from "./index";

const field = () => screen.getByLabelText("Password") as HTMLInputElement;

describe("SecureTextField", () => {
  it("renders a password input in a text field bezel", () => {
    render(<SecureTextField aria-label="Password" />);
    expect(field().tagName).toBe("INPUT");
    expect(field()).toHaveAttribute("type", "password");
    expect(field()).toHaveAttribute("data-echo", "bullets");
    const root = field().parentElement as HTMLElement;
    expect(root).toHaveClass("mac-text-field", "mac-secure-text-field");
    expect(root).toHaveAttribute("data-bezel", "square");
    expect(root).toHaveAttribute("data-size", "regular");
  });

  it("keeps the password type whatever is passed", () => {
    // @ts-expect-error `type` is not a prop of the secure field
    render(<SecureTextField aria-label="Password" type="text" />);
    expect(field()).toHaveAttribute("type", "password");
  });

  it("takes typed text and reports each change", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SecureTextField aria-label="Password" onValueChange={onValueChange} />);
    await user.type(field(), "pw");
    expect(field()).toHaveValue("pw");
    expect(onValueChange).toHaveBeenLastCalledWith("pw", expect.anything());
  });

  it("reflects echo and size, and passes text field props through", () => {
    const ref = createRef<HTMLDivElement>();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <SecureTextField
        aria-label="Password"
        echo="none"
        size="small"
        ref={ref}
        inputRef={inputRef}
        className="wide"
        name="password"
      />,
    );
    expect(field()).toHaveAttribute("data-echo", "none");
    expect(field()).toHaveAttribute("name", "password");
    expect(inputRef.current).toBe(field());
    expect(ref.current).toHaveAttribute("data-size", "small");
    expect(ref.current).toHaveClass("mac-secure-text-field", "wide");
  });

  it("shows the Caps Lock indicator while Caps Lock is on and the field has the keyboard", () => {
    const onKeyDown = vi.fn();
    render(<SecureTextField aria-label="Password" onKeyDown={onKeyDown} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();

    field().focus();
    fireEvent.keyDown(field(), { key: "A", modifierCapsLock: true });
    expect(screen.getByRole("img", { name: "Caps Lock is on" })).toBeInTheDocument();
    expect(onKeyDown).toHaveBeenCalledTimes(1);

    fireEvent.keyUp(field(), { key: "CapsLock", modifierCapsLock: false });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();

    fireEvent.keyDown(field(), { key: "A", modifierCapsLock: true });
    fireEvent.blur(field());
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("names the Caps Lock indicator with capsLockLabel", () => {
    render(<SecureTextField aria-label="Password" capsLockLabel="Feststelltaste" />);
    fireEvent.keyDown(field(), { key: "A", modifierCapsLock: true });
    expect(screen.getByRole("img", { name: "Feststelltaste" })).toBeInTheDocument();
  });

  it("is really disabled", async () => {
    const user = userEvent.setup();
    render(<SecureTextField aria-label="Password" disabled />);
    expect(field()).toBeDisabled();
    expect(field().parentElement).toHaveAttribute("data-disabled");
    await user.tab();
    expect(field()).not.toHaveFocus();
  });
});

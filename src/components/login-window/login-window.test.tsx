import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { LoginWindow, LoginWindowButton, type LoginWindowProps } from "./index";

const one = [{ value: "mh", name: "mhackett" }];
const three = [
  { value: "ada", name: "Ada" },
  { value: "grace", name: "Grace", picture: <img alt="" src="data:," /> },
  { value: "guest", name: "Guest User" },
];

const field = () => screen.getByLabelText("Enter Password");

describe("LoginWindow", () => {
  it("asks the only user for the password at once", () => {
    render(<LoginWindow users={one} data-testid="root" />);
    const root = screen.getByTestId("root");
    expect(root).toHaveClass("mac-login-window");
    // The login window is light on dark in both appearances.
    expect(root).toHaveAttribute("data-appearance", "dark");
    expect(screen.getByRole("form", { name: "mhackett" })).toBeInTheDocument();
    expect(field()).toHaveAttribute("type", "password");
    expect(field()).toHaveAttribute("placeholder", "Enter Password");
    expect(field()).not.toHaveFocus();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("submits the typed password with Return", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginWindow users={one} onSubmit={onSubmit} />);
    await user.type(field(), "secret{Enter}");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("secret", "mh");
  });

  it("submits with the arrow button, by pointer and from the keyboard", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginWindow users={one} onSubmit={onSubmit} submitLabel="Go" />);
    await user.type(field(), "pw");
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(onSubmit).toHaveBeenLastCalledWith("pw", "mh");
    // The keyboard is back in the field: the arrow goes while the password is checked.
    expect(field()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Go" })).toHaveFocus();
    await user.keyboard(" ");
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("keeps the keyboard in the field when the password sent with the arrow is checked and rejected", async () => {
    const user = userEvent.setup();
    function Rejecting() {
      const [state, setState] = useState<"idle" | "busy" | "invalid">("idle");
      return (
        <>
          <LoginWindow
            users={one}
            busy={state === "busy"}
            invalid={state === "invalid"}
            onSubmit={() => setState("busy")}
          />
          <button type="button" tabIndex={-1} onMouseDown={() => setState("invalid")}>
            Answer
          </button>
        </>
      );
    }
    render(<Rejecting />);
    await user.type(field(), "wrong");
    await user.click(screen.getByRole("button", { name: "Log In" }));
    // The arrow is gone while the password is checked.
    expect(screen.queryByRole("button", { name: "Log In" })).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
    // The answer arrives without the user's doing.
    fireEvent.mouseDown(screen.getByRole("button", { name: "Answer" }));
    expect(field()).toHaveValue("");
    expect(field()).toHaveFocus();
  });

  it("throws away what was typed when another account is asked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(<LoginWindow users={three} value="ada" onSubmit={onSubmit} />);
    await user.type(field(), "for ada");
    rerender(<LoginWindow users={three} value="grace" onSubmit={onSubmit} />);
    expect(screen.getByRole("form", { name: "Grace" })).toBeInTheDocument();
    expect(field()).toHaveValue("");
    await user.type(field(), "{Enter}");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("", "grace");
  });

  it("marks a rejected password, empties the field and describes it with the hint", async () => {
    const user = userEvent.setup();
    function Rejecting() {
      const [invalid, setInvalid] = useState(false);
      return (
        <LoginWindow
          users={one}
          invalid={invalid}
          hint={invalid ? "Hint: a season" : undefined}
          onSubmit={() => setInvalid(true)}
        />
      );
    }
    render(<Rejecting />);
    expect(field()).not.toHaveAttribute("aria-invalid", "true");
    await user.type(field(), "wrong{Enter}");
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field()).toHaveValue("");
    expect(field()).toHaveAccessibleDescription("Hint: a season");
    expect(field()).toHaveFocus();
  });

  it("shows a spinner and takes no password while busy", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginWindow users={one} busy busyLabel="Checking" onSubmit={onSubmit} />);
    expect(screen.getByRole("progressbar", { name: "Checking" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log In" })).not.toBeInTheDocument();
    expect(field()).toHaveAttribute("readonly");
    await user.type(field(), "{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("lists several users and asks the chosen one", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onSubmit = vi.fn();
    render(<LoginWindow users={three} onValueChange={onValueChange} onSubmit={onSubmit} />);
    const list = screen.getByRole("group", { name: "Users" });
    expect(within(list).getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByLabelText("Enter Password")).not.toBeInTheDocument();

    await user.click(within(list).getByRole("button", { name: "Grace" }));
    expect(onValueChange).toHaveBeenLastCalledWith("grace");
    expect(screen.getByRole("form", { name: "Grace" })).toBeInTheDocument();
    // The keyboard follows the choice.
    expect(field()).toHaveFocus();
    await user.keyboard("pw{Enter}");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("pw", "grace");
  });

  it("moves between the users with the arrow keys and chooses with the keyboard", async () => {
    const user = userEvent.setup();
    render(<LoginWindow users={three} usersLabel="Accounts" />);
    const list = screen.getByRole("group", { name: "Accounts" });
    await user.tab();
    expect(within(list).getByRole("button", { name: "Ada" })).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(within(list).getByRole("button", { name: "Guest User" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(within(list).getByRole("button", { name: "Grace" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("form", { name: "Grace" })).toBeInTheDocument();
  });

  it("returns to the list with Escape, and cancels when there is none", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onValueChange = vi.fn();
    render(
      <LoginWindow
        users={three}
        defaultValue="ada"
        onCancel={onCancel}
        onValueChange={onValueChange}
      />,
    );
    await user.click(field());
    await user.keyboard("{Escape}");
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(onCancel).not.toHaveBeenCalled();
    // The user that was left has the keyboard.
    expect(screen.getByRole("button", { name: "Ada" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("cancels with Escape when there is one user, unless a handler kept the key", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { rerender } = render(<LoginWindow users={one} onCancel={onCancel} />);
    await user.type(field(), "{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
    rerender(
      <LoginWindow users={one} onCancel={onCancel} onKeyDown={(event) => event.preventDefault()} />,
    );
    await user.type(field(), "{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("can be controlled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const props: LoginWindowProps = { users: three, onValueChange };
    const { rerender } = render(<LoginWindow {...props} value={null} />);
    await user.click(screen.getByRole("button", { name: "Ada" }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("ada");
    // Nothing changes until the owner says so.
    expect(screen.getByRole("group", { name: "Users" })).toBeInTheDocument();
    rerender(<LoginWindow {...props} value="guest" />);
    expect(screen.getByRole("form", { name: "Guest User" })).toBeInTheDocument();
  });

  it("renders the status items, the actions and a custom placeholder", () => {
    render(
      <LoginWindow
        users={one}
        placeholder="Password"
        actions={<LoginWindowButton>Cancel</LoginWindowButton>}
      >
        <span>3:37 PM</span>
      </LoginWindow>,
    );
    expect(screen.getByText("3:37 PM")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("placeholder", "Password");
  });

  it("forwards ref, inputRef, className, style and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <LoginWindow
        users={one}
        ref={ref}
        inputRef={inputRef}
        className="extra"
        id="login"
        style={{ height: 400 }}
      />,
    );
    expect(ref.current).toHaveClass("mac-login-window", "extra");
    expect(ref.current).toHaveAttribute("id", "login");
    expect(ref.current?.style.height).toBe("400px");
    expect(inputRef.current).toBe(field());
  });
});

describe("LoginWindowButton", () => {
  it("is a button named by its title, with the cancel glyph by default", () => {
    render(<LoginWindowButton>Cancel</LoginWindowButton>);
    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button).toHaveClass("mac-login-window-button");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-glyph", "cancel");
  });

  it("reflects the glyph and is activated by pointer, Return and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <LoginWindowButton glyph="shut-down" onClick={onClick}>
        Shut Down
      </LoginWindowButton>,
    );
    const button = screen.getByRole("button", { name: "Shut Down" });
    expect(button).toHaveAttribute("data-glyph", "shut-down");
    await user.click(button);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("does nothing while disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <LoginWindowButton glyph="sleep" disabled onClick={onClick}>
        Sleep
      </LoginWindowButton>,
    );
    const button = screen.getByRole("button", { name: "Sleep" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLElement>();
    render(
      <LoginWindowButton ref={ref} glyph="restart" className="extra" id="restart">
        Restart
      </LoginWindowButton>,
    );
    expect(ref.current).toBe(screen.getByRole("button", { name: "Restart" }));
    expect(ref.current).toHaveClass("mac-login-window-button", "extra");
    expect(ref.current).toHaveAttribute("id", "restart");
  });
});

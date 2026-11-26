import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { NotificationAlert, NotificationAlertAction, NotificationAlertClose } from "./index";

describe("NotificationAlert", () => {
  it("is an alert named by its title and described by its message", () => {
    const { container } = render(
      <NotificationAlert title="Disk Not Ejected Properly">
        Eject “USB Key” before disconnecting or turning it off.
      </NotificationAlert>,
    );
    const alert = screen.getByRole("alert", { name: "Disk Not Ejected Properly" });
    expect(alert).toHaveClass("mac-notification-alert");
    expect(alert).toHaveAttribute("data-material", "translucent");
    expect(alert).toHaveAccessibleDescription(
      "Eject “USB Key” before disconnecting or turning it off.",
    );
    // Nothing is drawn for what was not given, and it holds nothing to focus.
    expect(container.querySelector(".mac-notification-alert-icon")).toBeNull();
    expect(container.querySelector(".mac-notification-alert-subtitle")).toBeNull();
    expect(container.querySelector(".mac-notification-alert-actions")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("has no description without a message", () => {
    render(<NotificationAlert title="Backup Complete" />);
    const alert = screen.getByRole("alert", { name: "Backup Complete" });
    expect(alert).not.toHaveAttribute("aria-describedby");
  });

  it("shows the icon, the subtitle and the buttons it is given", () => {
    render(
      <NotificationAlert
        title="Ana Ferreira"
        subtitle="Lunch on Thursday"
        icon={<img alt="Messages" src="data:," />}
        actions={
          <>
            <NotificationAlertAction>Reply</NotificationAlertAction>
            <NotificationAlertClose>Close</NotificationAlertClose>
          </>
        }
      >
        Are we still on?
      </NotificationAlert>,
    );
    const alert = screen.getByRole("alert", { name: "Ana Ferreira" });
    expect(alert).toContainElement(screen.getByRole("img", { name: "Messages" }));
    expect(alert).toHaveTextContent("Lunch on Thursday");
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Reply", "Close"]);
    for (const button of buttons) expect(alert).toContainElement(button);
  });

  it("reflects the material", () => {
    render(<NotificationAlert title="Backup Complete" material="opaque" />);
    expect(screen.getByRole("alert")).toHaveAttribute("data-material", "opaque");
  });

  it("is dismissed by Escape while the focus is inside, and not otherwise", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <>
        <button type="button">Outside</button>
        <NotificationAlert
          title="Ana Ferreira"
          onDismiss={onDismiss}
          actions={<NotificationAlertAction>Reply</NotificationAlertAction>}
        />
      </>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onDismiss).not.toHaveBeenCalled();

    await user.tab();
    expect(screen.getByRole("button", { name: "Reply" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("leaves Escape to a key handler that prevents the default", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
    render(
      <NotificationAlert
        title="Ana Ferreira"
        onDismiss={onDismiss}
        onKeyDown={onKeyDown}
        actions={<NotificationAlertAction>Reply</NotificationAlertAction>}
      />,
    );
    await user.tab();
    await user.keyboard("{Escape}");
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("accepts another role, a ref, a className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <NotificationAlert
        ref={ref}
        role="status"
        className="extra"
        id="note"
        data-app="finder"
        title="Backup Complete"
      />,
    );
    const status = screen.getByRole("status", { name: "Backup Complete" });
    expect(ref.current).toBe(status);
    expect(status).toHaveClass("mac-notification-alert", "extra");
    expect(status).toHaveAttribute("id", "note");
    expect(status).toHaveAttribute("data-app", "finder");
  });
});

describe("NotificationAlertClose", () => {
  it("dismisses the alert on click, Return and Space", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onClick = vi.fn();
    render(
      <NotificationAlert
        title="Disk Not Ejected Properly"
        onDismiss={onDismiss}
        actions={<NotificationAlertClose onClick={onClick}>Close</NotificationAlertClose>}
      />,
    );
    const close = screen.getByRole("button", { name: "Close" });
    expect(close).toHaveClass("mac-notification-alert-action");
    expect(close).toHaveAttribute("type", "button");

    await user.click(close);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });

  it("does not dismiss when its own handler prevents the default", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <NotificationAlert
        title="Disk Not Ejected Properly"
        onDismiss={onDismiss}
        actions={
          <NotificationAlertClose onClick={(event) => event.preventDefault()}>
            Close
          </NotificationAlertClose>
        }
      />,
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("does nothing when disabled, and works without an alert around it", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <NotificationAlert
        title="Disk Not Ejected Properly"
        onDismiss={onDismiss}
        actions={<NotificationAlertClose disabled>Close</NotificationAlertClose>}
      />,
    );
    const close = screen.getByRole("button", { name: "Close" });
    expect(close).toBeDisabled();
    await user.click(close);
    await user.tab();
    expect(close).not.toHaveFocus();
    expect(onDismiss).not.toHaveBeenCalled();

    const onClick = vi.fn();
    rerender(<NotificationAlertClose onClick={onClick}>Close</NotificationAlertClose>);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("NotificationAlertAction", () => {
  it("acts on click, Return and Space without dismissing the alert", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onClick = vi.fn();
    render(
      <NotificationAlert
        title="Ana Ferreira"
        onDismiss={onDismiss}
        actions={<NotificationAlertAction onClick={onClick}>Reply</NotificationAlertAction>}
      />,
    );
    const reply = screen.getByRole("button", { name: "Reply" });
    await user.click(reply);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("ignores activation and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <NotificationAlertAction disabled onClick={onClick}>
        Reply
      </NotificationAlertAction>,
    );
    const reply = screen.getByRole("button", { name: "Reply" });
    await user.click(reply);
    expect(onClick).not.toHaveBeenCalled();
    await user.tab();
    expect(reply).not.toHaveFocus();
  });

  it("forwards ref and attributes and keeps its class with a string or a state function", () => {
    const ref = createRef<HTMLElement>();
    const { rerender } = render(
      <NotificationAlertAction ref={ref} className="extra" id="reply">
        Reply
      </NotificationAlertAction>,
    );
    const reply = screen.getByRole("button", { name: "Reply" });
    expect(ref.current).toBe(reply);
    expect(reply).toHaveClass("mac-notification-alert-action", "extra");
    expect(reply).toHaveAttribute("id", "reply");

    rerender(
      <NotificationAlertAction
        disabled
        className={(state) => (state.disabled ? "is-off" : "is-on")}
      >
        Reply
      </NotificationAlertAction>,
    );
    expect(screen.getByRole("button")).toHaveClass("mac-notification-alert-action", "is-off");
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MailCompose } from "./mail-compose";
import { EMPTY_DRAFT } from "./mail-data";

const subject = () => within(screen.getByRole("region", { name: /./ })).getByLabelText("Subject:");

describe("a New Message window saving as it is written", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("tries again after a failed save, and saves on leaving what no answer has kept", async () => {
    const onAutosave = vi.fn().mockResolvedValue(false);
    const { unmount } = render(<MailCompose defaultDraft={EMPTY_DRAFT} onAutosave={onAutosave} />);
    fireEvent.change(subject(), { target: { value: "Ferry" } });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(onAutosave).toHaveBeenCalledTimes(1);
    expect(onAutosave.mock.calls[0]?.[1]).toBe("typing");
    await vi.advanceTimersByTimeAsync(15_000);
    expect(onAutosave).toHaveBeenCalledTimes(2);
    unmount();
    expect(onAutosave).toHaveBeenCalledTimes(3);
    expect(onAutosave.mock.calls[2]?.[0].subject).toBe("Ferry");
    expect(onAutosave.mock.calls[2]?.[1]).toBe("window");
  });

  it("saves after a send that fails, without another change", async () => {
    const onAutosave = vi.fn().mockResolvedValue(true);
    const { rerender } = render(<MailCompose onAutosave={onAutosave} sending />);
    rerender(<MailCompose onAutosave={onAutosave} />);
    fireEvent.change(subject(), { target: { value: "Ferry" } });
    rerender(<MailCompose onAutosave={onAutosave} sending />);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(onAutosave).not.toHaveBeenCalled();
    rerender(<MailCompose onAutosave={onAutosave} />);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(onAutosave).toHaveBeenCalledTimes(1);
  });

  it("saves nothing more once a save is kept, and a later change on the page's going away", async () => {
    const onAutosave = vi.fn().mockResolvedValue(true);
    render(<MailCompose defaultDraft={EMPTY_DRAFT} onAutosave={onAutosave} />);
    fireEvent.change(subject(), { target: { value: "Ferry" } });
    await vi.advanceTimersByTimeAsync(3_000);
    window.dispatchEvent(new Event("pagehide"));
    expect(onAutosave).toHaveBeenCalledTimes(1);

    fireEvent.change(subject(), { target: { value: "Ferry two" } });
    window.dispatchEvent(new Event("pagehide"));
    expect(onAutosave).toHaveBeenCalledTimes(2);
    expect(onAutosave.mock.calls[1]?.[0].subject).toBe("Ferry two");
    expect(onAutosave.mock.calls[1]?.[1]).toBe("page");
  });
});

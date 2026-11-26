import { useRender } from "@base-ui/react/use-render";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef, type ReactElement, type Ref } from "react";
import { describe, expect, it, vi } from "vitest";
import { ImageView, type ImageViewProps } from "./index";

const PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

describe("ImageView", () => {
  it("renders a named image as an <img> with its alternative text", () => {
    render(<ImageView src={PIXEL} alt="Printer" width={93} height={68} />);
    const image = screen.getByRole("img", { name: "Printer" });
    expect(image.tagName).toBe("IMG");
    expect(image).toHaveClass("mac-image-view");
    expect(image).toHaveAttribute("src", PIXEL);
    expect(image).toHaveAttribute("width", "93");
    expect(image).toHaveAttribute("data-scaling", "proportionally-down");
    expect(image).toHaveAttribute("data-mask", "none");
    expect(image).not.toHaveAttribute("data-disabled");
    expect(image).not.toHaveAttribute("tabindex");
  });

  it("is decorative without alternative text", () => {
    render(<ImageView src={PIXEL} data-testid="image" />);
    expect(screen.getByTestId("image")).toHaveAttribute("alt", "");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("reflects scaling, mask and disabled as data attributes", () => {
    render(
      <ImageView src={PIXEL} alt="User" scaling="axes-independently" mask="circle" disabled />,
    );
    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("data-scaling", "axes-independently");
    expect(image).toHaveAttribute("data-mask", "circle");
    expect(image).toHaveAttribute("data-disabled");
  });

  it("passes <img> attributes through", () => {
    render(<ImageView src={PIXEL} alt="Photo" loading="lazy" decoding="async" id="photo" />);
    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
    expect(image).toHaveAttribute("id", "photo");
  });

  it("shows an image that has srcSet and no src, not a monogram", () => {
    render(<ImageView srcSet={`${PIXEL} 1x, ${PIXEL} 2x`} alt="Printer" />);
    const image = screen.getByRole("img", { name: "Printer" });
    expect(image.tagName).toBe("IMG");
    expect(image).toHaveAttribute("srcset", `${PIXEL} 1x, ${PIXEL} 2x`);
    expect(image).not.toHaveAttribute("src");
    expect(image).not.toHaveAttribute("data-kind");
  });

  it("keeps srcSet beside src, and shows a template that has only srcSet as a bitmap", () => {
    const { rerender } = render(<ImageView src={PIXEL} srcSet={`${PIXEL} 2x`} alt="Printer" />);
    expect(screen.getByRole("img", { name: "Printer" })).toHaveAttribute("srcset", `${PIXEL} 2x`);

    rerender(<ImageView template srcSet={`${PIXEL} 2x`} alt="Printer" />);
    const image = screen.getByRole("img", { name: "Printer" });
    expect(image.tagName).toBe("IMG");
    expect(image).toHaveClass("mac-image-view");
  });

  it("draws a template image as a span the size of the view around a named image", () => {
    render(<ImageView src={PIXEL} template alt="Locked" width={22} height={28} loading="lazy" />);
    const image = screen.getByRole("img", { name: "Locked" });
    expect(image.tagName).toBe("IMG");
    expect(image).toHaveClass("mac-image-view-template");
    expect(image).toHaveAttribute("src", PIXEL);
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image.style.getPropertyValue("--_src")).toContain(PIXEL);
    // The <img> has no size of its own: its natural size is what lets it scale down only.
    expect(image).not.toHaveAttribute("width");
    expect(image).not.toHaveAttribute("height");

    const view = image.parentElement as HTMLElement;
    expect(view.tagName).toBe("SPAN");
    expect(view).toHaveClass("mac-image-view");
    expect(view).toHaveAttribute("data-kind", "template");
    expect(view).toHaveAttribute("data-scaling", "proportionally-down");
    expect(view.style.width).toBe("22px");
    expect(view.style.height).toBe("28px");
  });

  it("hides a decorative template image from assistive technology", () => {
    const { container } = render(<ImageView src={PIXEL} template width={16} height={16} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("gives the ref of a template image to the view", () => {
    const ref = createRef<HTMLElement>();
    render(<ImageView ref={ref} src={PIXEL} template alt="Locked" scaling="none" />);
    expect(ref.current?.tagName).toBe("SPAN");
    expect(ref.current).toHaveAttribute("data-scaling", "none");
  });

  it("shows its children as a monogram when there is no image", () => {
    render(
      <ImageView alt="Stephen Hackett" mask="circle" width={98} height={98}>
        SH
      </ImageView>,
    );
    const image = screen.getByRole("img", { name: "Stephen Hackett" });
    expect(image.tagName).toBe("SPAN");
    expect(image).toHaveAttribute("data-kind", "monogram");
    expect(image).toHaveTextContent("SH");
    expect(image.style.width).toBe("98px");
  });

  it("hides a decorative monogram from assistive technology", () => {
    render(
      <ImageView data-testid="image" width={24} height={24}>
        SH
      </ImageView>,
    );
    const image = screen.getByTestId("image");
    expect(image).toHaveAttribute("aria-hidden", "true");
    expect(image).not.toHaveAttribute("aria-label");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("gives a template's other ARIA attributes to its image too", () => {
    render(
      <>
        <span id="note">Click the lock to make changes.</span>
        <ImageView
          template
          src={PIXEL}
          alt="Locked"
          aria-describedby="note"
          aria-details="note"
          data-testid="view"
        />
      </>,
    );
    const image = screen.getByRole("img", { name: "Locked" });
    expect(image.tagName).toBe("IMG");
    expect(image).toHaveAccessibleDescription("Click the lock to make changes.");
    expect(image).toHaveAttribute("aria-details", "note");
    const view = screen.getByTestId("view");
    expect(view).not.toHaveAttribute("aria-describedby");
    expect(view).not.toHaveAttribute("aria-details");
  });

  it("gives a template's role to its image, so that there is one image role or none", () => {
    const { rerender } = render(
      <ImageView template src={PIXEL} alt="Locked" role="img" data-testid="view" />,
    );
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Locked" }).tagName).toBe("IMG");
    expect(screen.getByTestId("view")).not.toHaveAttribute("role");

    rerender(
      <ImageView template src={PIXEL} alt="Locked" role="presentation" data-testid="view" />,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("view")).not.toHaveAttribute("role");
  });

  it("calls a template's load and error handlers with its image, and the others with the view", () => {
    const targets: Record<string, string> = {};
    const note = (name: string) => (event: { currentTarget: Element }) => {
      targets[name] = event.currentTarget.tagName;
    };
    render(
      <ImageView
        template
        src={PIXEL}
        alt="Locked"
        data-testid="view"
        onLoad={note("load")}
        onError={note("error")}
        onLoadCapture={note("loadCapture")}
        onErrorCapture={note("errorCapture")}
        onClick={note("click")}
      />,
    );
    const image = screen.getByRole("img", { name: "Locked" });

    // Load and error do not bubble: a handler left on the span would never be called, and one
    // that reads `currentTarget.naturalWidth` or sets `currentTarget.src` needs the image.
    fireEvent.load(image);
    fireEvent.error(image);
    expect(targets).toEqual({
      load: "IMG",
      loadCapture: "IMG",
      error: "IMG",
      errorCapture: "IMG",
    });

    // Every other handler belongs to the view, wherever in it the event starts.
    fireEvent.click(image);
    expect(targets.click).toBe("SPAN");
    expect(screen.getByTestId("view").tagName).toBe("SPAN");
  });

  it("calls a bitmap's handlers with the image, and none of the image events for a monogram", () => {
    const onLoad = vi.fn(
      (event: { currentTarget: HTMLImageElement }) => event.currentTarget.tagName,
    );
    const { rerender } = render(<ImageView src={PIXEL} alt="Printer" onLoad={onLoad} />);
    fireEvent.load(screen.getByRole("img", { name: "Printer" }));
    expect(onLoad).toHaveReturnedWith("IMG");

    onLoad.mockClear();
    rerender(
      <ImageView alt="Stephen Hackett" onLoad={onLoad} width={24} height={24}>
        SH
      </ImageView>,
    );
    fireEvent.load(screen.getByRole("img", { name: "Stephen Hackett" }));
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("treats an empty or blank aria-label and aria-labelledby as no name", () => {
    // Given as objects: written as attributes, the linter refuses the empty values outright.
    const empty = { "aria-label": "" };
    const spaces = { "aria-label": " " };
    const emptyBy = { "aria-labelledby": "  " };
    const { container } = render(
      <>
        <ImageView src={PIXEL} {...empty} data-testid="bitmap" />
        <ImageView src={PIXEL} {...emptyBy} data-testid="bitmap-by" />
        <ImageView template src={PIXEL} {...spaces} data-testid="template" />
        <ImageView {...empty} {...emptyBy} width={24} height={24} data-testid="plain">
          SH
        </ImageView>
        <ImageView alt="Stephen Hackett" {...spaces} width={24} height={24}>
          SH
        </ImageView>
      </>,
    );
    // Decorative: the empty alt stays, and no empty naming attribute is written.
    for (const id of ["bitmap", "bitmap-by"]) {
      const image = screen.getByTestId(id);
      expect(image).toHaveAttribute("alt", "");
      expect(image).not.toHaveAttribute("aria-label");
      expect(image).not.toHaveAttribute("aria-labelledby");
    }
    const inner = screen.getByTestId("template").querySelector("img") as HTMLImageElement;
    expect(inner).toHaveAttribute("alt", "");
    expect(inner).not.toHaveAttribute("aria-label");
    // A monogram that nothing names stays hidden; one with an alt keeps the alt as its name.
    expect(screen.getByTestId("plain")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("plain")).not.toHaveAttribute("aria-label");
    expect(screen.getByRole("img", { name: "Stephen Hackett" })).toHaveTextContent("SH");
    expect(container.querySelectorAll("[aria-labelledby]")).toHaveLength(0);
    expect(container.querySelectorAll('[aria-label=""], [aria-label=" "]')).toHaveLength(0);
  });

  it("takes its name from aria-label or aria-labelledby in every form", () => {
    render(
      <>
        <span id="caption">Caption</span>
        <ImageView src={PIXEL} aria-label="Bitmap" />
        <ImageView template src={PIXEL} aria-label="Template" data-testid="template" />
        <ImageView template src={PIXEL} aria-labelledby="caption" />
        <ImageView aria-label="Monogram" width={24} height={24}>
          SH
        </ImageView>
        <ImageView aria-labelledby="caption" width={24} height={24}>
          SH
        </ImageView>
      </>,
    );
    expect(screen.getByRole("img", { name: "Bitmap" }).tagName).toBe("IMG");

    // A template's name belongs to its <img>, not to the <span> around it.
    const template = screen.getByRole("img", { name: "Template" });
    expect(template.tagName).toBe("IMG");
    expect(screen.getByTestId("template")).not.toHaveAttribute("aria-label");

    const monogram = screen.getByRole("img", { name: "Monogram" });
    expect(monogram).not.toHaveAttribute("aria-hidden");

    const captioned = screen.getAllByRole("img", { name: "Caption" });
    expect(captioned.map((image) => image.tagName)).toEqual(["IMG", "SPAN"]);
    expect(captioned[1]).not.toHaveAttribute("aria-hidden");
  });

  it("forwards ref, className and style in both forms", () => {
    const img = createRef<HTMLElement>();
    const span = createRef<HTMLElement>();
    render(
      <>
        <ImageView ref={img} src={PIXEL} alt="A" className="extra" style={{ opacity: 0.9 }} />
        <ImageView ref={span} alt="B" className="extra" width={10} style={{ height: 12 }}>
          B
        </ImageView>
      </>,
    );
    expect(img.current?.tagName).toBe("IMG");
    expect(img.current).toHaveClass("mac-image-view", "extra");
    expect(img.current?.style.opacity).toBe("0.9");
    expect(span.current?.tagName).toBe("SPAN");
    expect(span.current).toHaveClass("mac-image-view", "extra");
    expect(span.current?.style.width).toBe("10px");
    expect(span.current?.style.height).toBe("12px");
  });
});

/**
 * A slot as Base UI builds one: `useRender` renders the element given in `render` with the
 * slot's own ref, handlers and attributes merged into it. This is how a trigger or a list item
 * is composed with an ImageView.
 */
function Slot({
  render,
  ...props
}: useRender.ComponentProps<"span"> & { ref?: Ref<HTMLSpanElement> }) {
  return useRender({ defaultTagName: "span", render, props });
}

type Own = Pick<ImageViewProps, "ref" | "onClick" | "onLoad">;

/** Renders the view in a slot; both give it a ref, a click handler and a load handler. */
function compose(view: (own: Own) => ReactElement) {
  const slotRef = createRef<HTMLSpanElement>();
  const ownRef = createRef<HTMLElement>();
  const seen = { click: [] as string[], load: [] as string[] };
  const note = (kind: keyof typeof seen, who: string) => (event: { currentTarget: Element }) => {
    seen[kind].push(`${who}:${event.currentTarget.tagName}`);
    seen[kind].sort();
  };
  render(
    <>
      <span id="hint">More about it</span>
      <Slot
        ref={slotRef}
        aria-describedby="hint"
        data-testid="target"
        onClick={note("click", "slot")}
        onLoad={note("load", "slot")}
        render={view({
          ref: ownRef,
          onClick: note("click", "own"),
          onLoad: note("load", "own"),
        })}
      />
    </>,
  );
  return { slotRef, ownRef, seen, target: screen.getByTestId("target") };
}

describe("ImageView in a slot", () => {
  it("composes a bitmap: refs, handlers and attributes all meet on the image", () => {
    const { slotRef, ownRef, seen, target } = compose((own) => (
      <ImageView {...own} src={PIXEL} alt="Printer" />
    ));
    const image = screen.getByRole("img", { name: "Printer" });
    expect(target).toBe(image);
    expect(image.tagName).toBe("IMG");
    expect(image).toHaveClass("mac-image-view");
    expect(slotRef.current).toBe(image);
    expect(ownRef.current).toBe(image);
    expect(image).toHaveAccessibleDescription("More about it");

    fireEvent.click(image);
    fireEvent.load(image);
    expect(seen).toEqual({ click: ["own:IMG", "slot:IMG"], load: ["own:IMG", "slot:IMG"] });
  });

  it("composes a template: the view takes refs and handlers, its image the load and ARIA", () => {
    const { slotRef, ownRef, seen, target } = compose((own) => (
      <ImageView {...own} template src={PIXEL} alt="Locked" />
    ));
    expect(target.tagName).toBe("SPAN");
    expect(target).toHaveAttribute("data-kind", "template");
    expect(slotRef.current).toBe(target);
    expect(ownRef.current).toBe(target);

    // One image role, on the <img>, and what describes the image goes with it.
    const image = screen.getByRole("img", { name: "Locked" });
    expect(image.tagName).toBe("IMG");
    expect(target).toContainElement(image);
    expect(image).toHaveAccessibleDescription("More about it");
    expect(target).not.toHaveAttribute("aria-describedby");
    expect(target).not.toHaveAttribute("role");

    // The slot's handlers and the view's own are merged before the view sorts them: a click
    // reaches both on the span, and a load reaches both on the image.
    fireEvent.click(image);
    fireEvent.load(image);
    expect(seen).toEqual({ click: ["own:SPAN", "slot:SPAN"], load: ["own:IMG", "slot:IMG"] });
  });

  it("composes a monogram: everything meets on the span, and nothing listens for a load", () => {
    const { slotRef, ownRef, seen, target } = compose((own) => (
      <ImageView {...own} alt="Stephen Hackett" width={24} height={24}>
        SH
      </ImageView>
    ));
    const monogram = screen.getByRole("img", { name: "Stephen Hackett" });
    expect(target).toBe(monogram);
    expect(monogram.tagName).toBe("SPAN");
    expect(monogram).toHaveAttribute("data-kind", "monogram");
    expect(slotRef.current).toBe(monogram);
    expect(ownRef.current).toBe(monogram);
    expect(monogram).toHaveAccessibleDescription("More about it");

    fireEvent.click(monogram);
    fireEvent.load(monogram);
    expect(seen).toEqual({ click: ["own:SPAN", "slot:SPAN"], load: [] });
  });
});

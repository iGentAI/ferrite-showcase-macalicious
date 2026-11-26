import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  MapButton,
  MapCompass,
  MapControls,
  MapTypeControl,
  MapTypeOption,
  MapZoomControl,
} from "./index";

describe("MapControls", () => {
  it("is a named group pinned to the bottom trailing corner, in a row, by default", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <MapControls ref={ref} aria-label="Map controls" className="mine">
        <MapZoomControl />
      </MapControls>,
    );
    const group = screen.getByRole("group", { name: "Map controls" });
    expect(ref.current).toBe(group);
    expect(group).toHaveClass("mac-map-controls", "mine");
    expect(group).toHaveAttribute("data-placement", "bottom-trailing");
    expect(group).toHaveAttribute("data-orientation", "horizontal");
  });

  it("reflects placement and orientation", () => {
    render(<MapControls aria-label="Stack" placement="none" orientation="vertical" />);
    const group = screen.getByRole("group", { name: "Stack" });
    expect(group).toHaveAttribute("data-placement", "none");
    expect(group).toHaveAttribute("data-orientation", "vertical");
  });
});

describe("MapButton", () => {
  it("is a bordered button that reports clicks", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MapButton onClick={onClick}>Show</MapButton>);
    const button = screen.getByRole("button", { name: "Show" });
    expect(button).toHaveAttribute("data-variant", "bordered");
    expect(button.querySelector(".mac-map-controls-button-chevron")).toBeNull();
    await user.click(button);
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("draws a chevron that assistive technology does not see", () => {
    render(<MapButton chevron>Show</MapButton>);
    const button = screen.getByRole("button", { name: "Show" });
    expect(button.querySelector(".mac-map-controls-button-chevron")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("takes the rounded shape, a name for a glyph and a ref", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <MapButton ref={ref} variant="rounded" aria-label="Show current location">
        <svg aria-hidden="true" />
      </MapButton>,
    );
    const button = screen.getByRole("button", { name: "Show current location" });
    expect(ref.current).toBe(button);
    expect(button).toHaveAttribute("data-variant", "rounded");
  });

  it("does nothing when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <MapButton disabled onClick={onClick}>
        Show
      </MapButton>,
    );
    const button = screen.getByRole("button", { name: "Show" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("MapZoomControl", () => {
  it("is a group named Zoom with a zoom-out and a zoom-in button, in that order", () => {
    render(<MapZoomControl />);
    const group = screen.getByRole("group", { name: "Zoom" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Zoom out",
      "Zoom in",
    ]);
  });

  it("reports each half to its owner, from the pointer and the keyboard", async () => {
    const user = userEvent.setup();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    render(<MapZoomControl onZoomIn={onZoomIn} onZoomOut={onZoomOut} />);
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(onZoomIn).toHaveBeenCalledTimes(1);
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Zoom out" })).toHaveFocus();
    await user.keyboard(" ");
    await user.keyboard("{Enter}");
    expect(onZoomOut).toHaveBeenCalledTimes(2);
    expect(onZoomIn).toHaveBeenCalledTimes(1);
  });

  it("keeps a disabled half in the Tab order but does not activate it", async () => {
    const user = userEvent.setup();
    const onZoomIn = vi.fn();
    render(<MapZoomControl onZoomIn={onZoomIn} zoomInDisabled />);
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    expect(zoomIn).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Zoom out" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
    await user.tab();
    await user.tab();
    expect(zoomIn).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.click(zoomIn);
    expect(onZoomIn).not.toHaveBeenCalled();
  });

  it("takes other names", () => {
    render(
      <MapZoomControl aria-label="Massstab" zoomInLabel="Vergrössern" zoomOutLabel="Verkleinern" />,
    );
    const group = screen.getByRole("group", { name: "Massstab" });
    expect(within(group).getByRole("button", { name: "Vergrössern" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Verkleinern" })).toBeInTheDocument();
  });
});

describe("MapCompass", () => {
  it("is a group named Compass with a north button and a 3D toggle that is off", () => {
    render(<MapCompass />);
    const group = screen.getByRole("group", { name: "Compass" });
    expect(within(group).getByRole("button", { name: "Face north" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "3D" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("asks its owner for north up when the ring is activated", async () => {
    const user = userEvent.setup();
    const onNorthUp = vi.fn();
    render(<MapCompass heading={90} onNorthUp={onNorthUp} />);
    await user.click(screen.getByRole("button", { name: "Face north" }));
    expect(onNorthUp).toHaveBeenCalledTimes(1);
  });

  it("turns its rose against the map's heading", () => {
    const { container, rerender } = render(<MapCompass heading={90} />);
    const rose = container.querySelector<HTMLElement>(".mac-map-controls-compass-rose");
    expect(rose).toHaveAttribute("aria-hidden", "true");
    expect(rose?.style.rotate).toBe("-90deg");
    rerender(<MapCompass heading={Number.NaN} />);
    expect(rose?.style.rotate).toBe("0deg");
  });

  it("toggles 3D from the pointer and the keyboard", async () => {
    const user = userEvent.setup();
    const onPitchedChange = vi.fn();
    render(<MapCompass onPitchedChange={onPitchedChange} />);
    const pitch = screen.getByRole("button", { name: "3D" });
    await user.click(pitch);
    expect(pitch).toHaveAttribute("aria-pressed", "true");
    await user.keyboard(" ");
    expect(pitch).toHaveAttribute("aria-pressed", "false");
    expect(onPitchedChange.mock.calls.map((call) => call[0])).toEqual([true, false]);
  });

  it("stays as given when controlled, and follows its owner", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [pitched, setPitched] = useState(false);
      return (
        <>
          <MapCompass aria-label="Held" pitched={false} />
          <MapCompass aria-label="Owned" pitched={pitched} onPitchedChange={setPitched} />
        </>
      );
    }
    render(<Owner />);
    const held = within(screen.getByRole("group", { name: "Held" })).getByRole("button", {
      name: "3D",
    });
    const owned = within(screen.getByRole("group", { name: "Owned" })).getByRole("button", {
      name: "3D",
    });
    await user.click(held);
    expect(held).toHaveAttribute("aria-pressed", "false");
    await user.click(owned);
    expect(owned).toHaveAttribute("aria-pressed", "true");
  });

  it("disables or leaves out the 3D button", async () => {
    const user = userEvent.setup();
    const onPitchedChange = vi.fn();
    const { rerender } = render(<MapCompass pitchDisabled onPitchedChange={onPitchedChange} />);
    const pitch = screen.getByRole("button", { name: "3D" });
    expect(pitch).toBeDisabled();
    await user.click(pitch);
    expect(onPitchedChange).not.toHaveBeenCalled();
    rerender(<MapCompass hidePitch />);
    expect(screen.queryByRole("button", { name: "3D" })).toBeNull();
    expect(screen.getByRole("group", { name: "Compass" })).toHaveAttribute("data-plain", "");
  });
});

describe("MapTypeControl", () => {
  function Types(props: Parameters<typeof MapTypeControl>[0]) {
    return (
      <MapTypeControl aria-label="Map type" {...props}>
        <MapTypeOption value="map">Map</MapTypeOption>
        <MapTypeOption value="hybrid">Hybrid</MapTypeOption>
        <MapTypeOption value="satellite">Satellite</MapTypeOption>
      </MapTypeControl>
    );
  }

  it("is a radio group whose options are radios", () => {
    render(<Types defaultValue="map" />);
    const group = screen.getByRole("radiogroup", { name: "Map type" });
    expect(group).toHaveClass("mac-map-controls-type");
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Map" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Hybrid" })).not.toBeChecked();
  });

  it("selects on a click and reports the value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Types defaultValue="map" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("radio", { name: "Satellite" }));
    expect(screen.getByRole("radio", { name: "Satellite" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Map" })).not.toBeChecked();
    expect(onValueChange.mock.calls[0]?.[0]).toBe("satellite");
  });

  it("is one Tab stop in which the arrow keys move the selection", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Types defaultValue="map" />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("radio", { name: "Map" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Hybrid" })).toBeChecked();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Satellite" })).toBeChecked();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("stays as given when controlled", async () => {
    const user = userEvent.setup();
    render(<Types value="hybrid" />);
    await user.click(screen.getByRole("radio", { name: "Map" }));
    expect(screen.getByRole("radio", { name: "Hybrid" })).toBeChecked();
  });

  it("lets nothing be selected when disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Types defaultValue="map" disabled onValueChange={onValueChange} />);
    await user.click(screen.getByRole("radio", { name: "Satellite" }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "Map" })).toBeChecked();
  });
});

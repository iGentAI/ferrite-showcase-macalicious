"use client";

import { MissionControlSpace } from "macalicious/mission-control";
import { useRef } from "react";
import {
  fullScreenWindowOf,
  isDesktopSpace,
  type SpacesApi,
  splitWindowsOf,
} from "./desktop-spaces";

/** How far a press moves before it is a drag, in points. */
const DRAG_START = 5;

/** The Space under a point of the screen, if there is one. */
export const spaceAt = (x: number, y: number) =>
  document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-desktop-space]")?.dataset
    .desktopSpace ?? null;

/**
 * Follows a press until it is let go, once it has moved far enough to be a drag. Only the pointer that
 * pressed counts. `up` is `null` when the browser took the pointer away: nothing is to be done with it.
 */
export function followDrag(
  down: { clientX: number; clientY: number; pointerId: number },
  onMove: (move: PointerEvent, started: boolean) => void,
  onEnd: (up: PointerEvent | null, started: boolean) => void,
) {
  let started = false;
  const move = (event: PointerEvent) => {
    if (event.pointerId !== down.pointerId) return;
    started ||= Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) > DRAG_START;
    if (started) onMove(event, started);
  };
  const stop = () => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", cancel);
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId !== down.pointerId) return;
    stop();
    onEnd(event, started);
  };
  const cancel = (event: PointerEvent) => {
    if (event.pointerId !== down.pointerId) return;
    stop();
    onEnd(null, started);
  };
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", cancel);
}

/** Mission Control's Spaces bar: each Space shows, drags along the bar and has a button to remove it. */
export function DesktopSpacesBar({
  spaces,
  picture,
  pictureOf,
  dropOn,
  titleOf,
}: {
  spaces: SpacesApi;
  /** A window's title, for the Space of a window in full screen. */
  titleOf: (window: string) => string | undefined;
  picture: string;
  /** The picture a Space was given, if it was. */
  pictureOf: (space: string) => string | undefined;
  /** The Space a window is being dragged over. */
  dropOn: string | null;
}) {
  const { state } = spaces;
  const dragged = useRef(false);
  const latest = useRef(spaces);
  latest.current = spaces;
  let desktops = 0;
  const lastDesktop = state.spaces.filter(isDesktopSpace).length === 1;
  return state.spaces.map((space) => {
    const inFullScreen = fullScreenWindowOf(space);
    const pair = splitWindowsOf(space);
    const isDesktop = isDesktopSpace(space);
    if (isDesktop) desktops += 1;
    const label = isDesktop
      ? `Desktop ${desktops}`
      : pair
        ? pair.map((each) => titleOf(each) ?? "Window").join(" & ")
        : ((inFullScreen === undefined ? undefined : titleOf(inFullScreen)) ?? "Full Screen");
    return (
      <div
        key={space}
        className="mac-desktop-shell-space"
        data-desktop-space={space}
        data-drop-target={dropOn === space ? "" : undefined}
      >
        <MissionControlSpace
          label={label}
          current={space === state.current}
          onPointerDown={(down) => {
            if (down.button !== 0) return;
            dragged.current = false;
            const before = state.spaces.indexOf(space);
            followDrag(
              down,
              (move) => {
                dragged.current = true;
                const others = [...document.querySelectorAll<HTMLElement>("[data-desktop-space]")];
                const to = others.findIndex((each) => {
                  const { left, right } = each.getBoundingClientRect();
                  return move.clientX >= left && move.clientX <= right;
                });
                if (to >= 0) spaces.move(space, to);
              },
              (up) => {
                if (!up) latest.current.move(space, before);
              },
            );
          }}
          onClick={(event) => {
            // A click from the keyboard has no click count, and is no end of a drag.
            if (dragged.current && event.detail > 0) event.preventDefault();
            else spaces.show(space);
            dragged.current = false;
          }}
        >
          <img
            className="mac-desktop-shell-space-picture"
            src={pictureOf(space) ?? picture}
            alt=""
            draggable={false}
          />
        </MissionControlSpace>
        {!isDesktop || !lastDesktop ? (
          <button
            type="button"
            className="mac-desktop-shell-space-remove"
            aria-label={
              isDesktop
                ? `Remove ${label}`
                : pair
                  ? `Leave Split View: ${label}`
                  : `Leave Full Screen: ${label}`
            }
            onClick={() => (isDesktop ? spaces.remove(space) : spaces.leaveFullScreen(space))}
          >
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2 2l6 6M8 2l-6 6" />
            </svg>
          </button>
        ) : null}
      </div>
    );
  });
}

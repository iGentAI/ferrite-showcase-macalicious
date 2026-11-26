import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { sessionFetch } from "../desktop/desktop-server";
import { useDirections } from "./maps-directions";

const place = {
  id: "synthetic",
  name: "Synthetic",
  category: "Place",
  lat: 1,
  lon: 2,
  address: [],
};
const reply = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const route = (duration: number) => ({
  route: {
    distance_m: 1,
    duration_s: duration,
    path: [
      [1, 2],
      [1, 2],
    ],
    steps: [],
  },
});
afterEach(() => vi.unstubAllGlobals());

it("shares a pending identical lookup for rapid submissions, then routes the latest request", async () => {
  let release: ((value: ReturnType<typeof reply>) => void) | undefined;
  let searchCount = 0;
  const fetch = vi.fn((url: string) => {
    if (url === "/api/session") return Promise.resolve(reply(200, {}));
    if (url.startsWith("/api/maps/search")) {
      searchCount += 1;
      if (searchCount === 1)
        return new Promise<ReturnType<typeof reply>>((resolve) => {
          release = resolve;
        });
      return Promise.resolve(reply(200, { places: [place] }));
    }
    if (url.startsWith("/api/maps/route")) return Promise.resolve(reply(200, route(60)));
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  await sessionFetch("/api/session");
  fetch.mockClear();
  const { result } = renderHook(() => useDirections({ lat: 1, lon: 2 }, () => {}));
  act(() => {
    result.current.edit("start", "Synthetic A");
    result.current.edit("end", "Synthetic B");
  });
  act(() => {
    result.current.go();
    result.current.go();
  });
  await waitFor(() => expect(searchCount).toBe(1));
  await act(async () => {
    release?.(reply(200, { places: [place] }));
  });
  await waitFor(() => expect(result.current.state.kind).toBe("route"));
  expect(fetch.mock.calls.filter(([url]) => url.includes("q=Synthetic+A"))).toHaveLength(1);
  expect(fetch.mock.calls.filter(([url]) => url.startsWith("/api/maps/route"))).toHaveLength(1);
});

it("keeps a newer travel mode when an older route finishes late", async () => {
  let releaseDriving: ((value: ReturnType<typeof reply>) => void) | undefined;
  const fetch = vi.fn((url: string) => {
    if (url.startsWith("/api/maps/search")) return Promise.resolve(reply(200, { places: [place] }));
    if (url.includes("mode=driving"))
      return new Promise<ReturnType<typeof reply>>((resolve) => {
        releaseDriving = resolve;
      });
    if (url.includes("mode=walking")) return Promise.resolve(reply(200, route(120)));
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() => useDirections({ lat: 1, lon: 2 }, () => {}));
  act(() => {
    result.current.edit("start", "Synthetic A");
    result.current.edit("end", "Synthetic B");
  });
  act(() => result.current.go());
  await waitFor(() => expect(releaseDriving).toBeDefined());
  act(() => result.current.chooseMode("walking"));
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ kind: "route", route: { duration_s: 120 } }),
  );
  await act(async () => {
    releaseDriving?.(reply(200, route(60)));
  });
  expect(result.current.mode).toBe("walking");
  expect(result.current.state).toMatchObject({ kind: "route", route: { duration_s: 120 } });
});

it("shares an identical route in flight but does not cache the completed route", async () => {
  let releaseRoute: ((value: ReturnType<typeof reply>) => void) | undefined;
  let routeCount = 0;
  const fetch = vi.fn((url: string) => {
    if (url.startsWith("/api/maps/search")) return Promise.resolve(reply(200, { places: [place] }));
    if (url.startsWith("/api/maps/route")) {
      routeCount += 1;
      if (routeCount === 1)
        return new Promise<ReturnType<typeof reply>>((resolve) => {
          releaseRoute = resolve;
        });
      return Promise.resolve(reply(200, route(90)));
    }
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() => useDirections({ lat: 1, lon: 2 }, () => {}));
  act(() => {
    result.current.edit("start", "Synthetic A");
    result.current.edit("end", "Synthetic B");
  });
  act(() => result.current.go());
  await waitFor(() => expect(releaseRoute).toBeDefined());
  act(() => result.current.go());
  await waitFor(() =>
    expect(fetch.mock.calls.filter(([url]) => url.startsWith("/api/maps/search"))).toHaveLength(4),
  );
  expect(routeCount).toBe(1);
  await act(async () => {
    releaseRoute?.(reply(200, route(60)));
  });
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ kind: "route", route: { duration_s: 60 } }),
  );
  act(() => result.current.go());
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ kind: "route", route: { duration_s: 90 } }),
  );
  expect(routeCount).toBe(2);
});

it("forgets a failed in-flight lookup so a later submission can recover", async () => {
  let failed = false;
  const fetch = vi.fn((url: string) => {
    if (url.startsWith("/api/maps/search") && !failed) {
      failed = true;
      return Promise.reject(new Error("offline"));
    }
    if (url.startsWith("/api/maps/search")) return Promise.resolve(reply(200, { places: [place] }));
    if (url.startsWith("/api/maps/route")) return Promise.resolve(reply(200, route(75)));
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() => useDirections({ lat: 1, lon: 2 }, () => {}));
  act(() => {
    result.current.edit("start", "Synthetic A");
    result.current.edit("end", "Synthetic B");
  });
  act(() => result.current.go());
  await waitFor(() => expect(result.current.state.kind).toBe("failed"));
  act(() => result.current.go());
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ kind: "route", route: { duration_s: 75 } }),
  );
  expect(fetch.mock.calls.filter(([url]) => url.includes("q=Synthetic+A"))).toHaveLength(2);
});

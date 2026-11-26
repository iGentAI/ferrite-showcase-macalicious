import { useEffect, useState } from "react";
import { sessionFetch } from "../desktop/desktop-server";
import {
  type SessionUsage,
  STORAGE_USAGE_URL,
  usageFromServer,
} from "../storage-management/storage-management-desktop";

/**
 * What Activity Monitor's CPU, Memory, Energy and Disk views can honestly show: figures this page
 * measures of itself or that the browser reports. A page is shown no processes and no figures of the
 * computer's, so each view says that, and a figure the browser does not give says so too.
 */
export type PageView = "cpu" | "memory" | "energy" | "disk";

export const NOT_REPORTED = "Not reported by this browser";

/** One line of a view: its label, its figure, and what the figure sorts by. */
export interface PageReading {
  id: string;
  name: string;
  value: string;
  order: number;
}

export const PAGE_STATEMENTS: Readonly<Record<PageView, string>> = {
  cpu: "A web page is shown no processes and no processor figures. These are this page's own: how late its timers run, its frames, and its long tasks.",
  memory:
    "A web page is shown no memory figures of the computer or of other apps. These are what the browser reports of this page.",
  energy:
    "A web page is shown no energy use of any app. This is the battery, where the browser reports it.",
  disk: "A web page cannot see your disks. These are what your account keeps on this desktop's server, and what this browser keeps for it.",
};

export const bytesText = (bytes: number) => {
  if (bytes < 1000) return `${bytes} bytes`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = -1;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
};

/** The share of a stretch of time a repeating timer spent late: the page was busy for that long. */
export function busyPercent(lateMs: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return Math.min(100, Math.max(0, (lateMs / elapsedMs) * 100));
}

/** How the page's main thread is doing, measured every second. */
export interface MainThread {
  busy: number | null;
  frames: number | null;
  /** Tasks over 50 ms since the window opened; `null` where the browser does not report them. */
  longTasks: number | null;
}

const TIMER_MS = 100;

/** Measure the page's main thread for as long as the caller is on the page. */
export function useMainThread(onSecond?: (busy: number) => void): MainThread {
  const [thread, setThread] = useState<MainThread>({ busy: null, frames: null, longTasks: null });
  const onSecondRef = useLatest(onSecond);
  useEffect(() => {
    let late = 0;
    let frames = 0;
    let longTasks: number | null = null;
    let observer: PerformanceObserver | undefined;
    if (
      typeof PerformanceObserver !== "undefined" &&
      PerformanceObserver.supportedEntryTypes?.includes("longtask")
    ) {
      longTasks = 0;
      observer = new PerformanceObserver((list) => {
        longTasks = (longTasks ?? 0) + list.getEntries().length;
      });
      observer.observe({ type: "longtask" });
    }
    let frame = requestAnimationFrame(function count() {
      frames += 1;
      frame = requestAnimationFrame(count);
    });
    let started = performance.now();
    let expected = started + TIMER_MS;
    const timer = setInterval(() => {
      const now = performance.now();
      // A hidden tab's timers are slowed by the browser: that is not the page being busy.
      if (document.visibilityState === "hidden") {
        started = now;
        expected = now + TIMER_MS;
        late = 0;
        frames = 0;
        return;
      }
      late += Math.max(0, now - expected);
      expected = now + TIMER_MS;
      const elapsed = now - started;
      if (elapsed < 1000) return;
      const busy = busyPercent(late, elapsed);
      setThread({ busy, frames: Math.round((frames * 1000) / elapsed), longTasks });
      onSecondRef.current?.(busy);
      started = now;
      late = 0;
      frames = 0;
    }, TIMER_MS);
    return () => {
      clearInterval(timer);
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [onSecondRef]);
  return thread;
}

function useLatest<T>(value: T) {
  const [ref] = useState(() => ({ current: value }));
  ref.current = value;
  return ref;
}

export function cpuReadings(
  { busy, frames, longTasks }: MainThread,
  cores: number | undefined,
): PageReading[] {
  return [
    {
      id: "busy",
      name: "This page's main thread, busy",
      value: busy === null ? "Measuring…" : `${busy.toFixed(1)}%`,
      order: busy ?? -1,
    },
    {
      id: "frames",
      name: "This page's frames per second",
      value: frames === null ? "Measuring…" : String(frames),
      order: frames ?? -1,
    },
    {
      id: "long",
      name: "Tasks over 50 ms since this window opened",
      value: longTasks === null ? NOT_REPORTED : String(longTasks),
      order: longTasks ?? -1,
    },
    {
      id: "cores",
      name: "Processor cores the browser reports",
      value: cores ? String(cores) : NOT_REPORTED,
      order: cores ?? -1,
    },
  ];
}

interface ChromiumMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export function memoryReadings(
  heap: ChromiumMemory | undefined,
  deviceGb: number | undefined,
): PageReading[] {
  const line = (id: string, name: string, bytes: number | undefined): PageReading => ({
    id,
    name,
    value: bytes === undefined ? NOT_REPORTED : bytesText(bytes),
    order: bytes ?? -1,
  });
  return [
    line("used", "This page's JavaScript memory, in use", heap?.usedJSHeapSize),
    line("total", "This page's JavaScript memory, set aside", heap?.totalJSHeapSize),
    line("limit", "The most the browser lets it have", heap?.jsHeapSizeLimit),
    {
      id: "device",
      name: "This computer's memory, at least",
      value: deviceGb === undefined ? NOT_REPORTED : `${deviceGb} GB`,
      order: deviceGb ?? -1,
    },
  ];
}

interface BatteryState {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
}

const minutes = (seconds: number) =>
  Number.isFinite(seconds) && seconds > 0 ? `${Math.round(seconds / 60)} min` : "Calculating…";

export function energyReadings(battery: BatteryState | undefined): PageReading[] {
  if (!battery) return [{ id: "battery", name: "Battery", value: NOT_REPORTED, order: -1 }];
  return [
    {
      id: "level",
      name: "Battery level",
      value: `${Math.round(battery.level * 100)}%`,
      order: battery.level,
    },
    {
      id: "source",
      name: "Power source",
      value: battery.charging ? "Power Adapter" : "Battery",
      order: battery.charging ? 1 : 0,
    },
    battery.charging
      ? {
          id: "time",
          name: "Time until full",
          value: minutes(battery.chargingTime),
          order: battery.chargingTime,
        }
      : {
          id: "time",
          name: "Time remaining",
          value: minutes(battery.dischargingTime),
          order: battery.dischargingTime,
        },
  ];
}

export function diskReadings(
  usage: SessionUsage | undefined,
  estimate: StorageEstimate | undefined,
): PageReading[] {
  const drive = usage?.drive;
  const server: PageReading[] = usage
    ? [
        ...(drive
          ? [
              {
                id: "drive",
                name: "Your drive, in use",
                value: `${bytesText(drive.used)} of ${bytesText(drive.quota)}`,
                order: drive.used,
              },
            ]
          : []),
        ...usage.apps
          .filter((app) => app.bytes > 0)
          .map((app) => ({
            id: `app-${app.name}`,
            name: `${app.title}, kept for you`,
            value: `${app.truncated ? "at least " : ""}${bytesText(app.bytes)}`,
            order: app.bytes,
          })),
      ]
    : [{ id: "server", name: "What your account keeps", value: "Reading…", order: -1 }];
  return [
    ...server,
    {
      id: "browser",
      name: "This browser's storage for this desktop",
      value:
        estimate?.usage === undefined
          ? NOT_REPORTED
          : `${bytesText(estimate.usage)}${estimate.quota ? ` of ${bytesText(estimate.quota)}` : ""}`,
      order: estimate?.usage ?? -1,
    },
  ];
}

/** What the person keeps on the server, read while `wanted` and on a tenth of the ticks. */
export function useAccountUsage(wanted: boolean, tick: number) {
  const [usage, setUsage] = useState<SessionUsage>();
  const round = Math.floor(tick / 10);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `round` is what reads again.
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    sessionFetch(STORAGE_USAGE_URL, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    })
      .then((reply) => (reply.ok ? reply.json() : undefined))
      .then(
        (reply) => {
          const read = usageFromServer(reply);
          if (live && read) setUsage(read);
        },
        () => {},
      );
    return () => {
      live = false;
    };
  }, [wanted, round]);
  return usage;
}

/** A view's lines, kept fresh while it is showing. */
export function usePageReadings(view: PageView | null, thread: MainThread, seconds: number) {
  const [tick, setTick] = useState(0);
  const [battery, setBattery] = useState<BatteryState>();
  const [estimate, setEstimate] = useState<StorageEstimate>();

  useEffect(() => {
    if (view === null) return;
    const timer = setInterval(() => setTick((count) => count + 1), seconds * 1000);
    return () => clearInterval(timer);
  }, [view, seconds]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` is what reads the battery again.
  useEffect(() => {
    if (view !== "energy") return;
    const asked = navigator as Navigator & { getBattery?: () => Promise<BatteryState> };
    let live = true;
    asked.getBattery?.().then(
      (now) => {
        if (live)
          setBattery({
            level: now.level,
            charging: now.charging,
            chargingTime: now.chargingTime,
            dischargingTime: now.dischargingTime,
          });
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [view, tick]);

  // Disk reads what it opens on, and again on a tenth of the ticks: each read walks the account's data.
  const usage = useAccountUsage(view === "disk", tick);
  const diskTick = Math.floor(tick / 10);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `diskTick` is what reads the estimate again.
  useEffect(() => {
    if (view !== "disk") return;
    let live = true;
    navigator.storage?.estimate().then(
      (now) => {
        if (live) setEstimate(now);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [view, diskTick]);

  if (view === "cpu") return cpuReadings(thread, navigator.hardwareConcurrency);
  if (view === "memory") {
    const chromium = performance as Performance & { memory?: ChromiumMemory };
    const device = navigator as Navigator & { deviceMemory?: number };
    return memoryReadings(chromium.memory, device.deviceMemory);
  }
  if (view === "energy") return energyReadings(battery);
  if (view === "disk") return diskReadings(usage, estimate);
  return [];
}

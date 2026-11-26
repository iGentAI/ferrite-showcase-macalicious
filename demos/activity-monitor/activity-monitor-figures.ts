/**
 * The Ferrite view of the `macalicious-desktop` Ferrite application, as its Activity Monitor module
 * answers it (`ferrite-apps/desktop/src/apps/activity_monitor`): requests per second, server time,
 * store calls per request and failed requests per module over the last five minutes, and the
 * deployment serving it. Activity Monitor's window and Terminal's `top` read it.
 */
export const FERRITE_URL = "/api/activity-monitor/ferrite";

const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** One module's figures in the Ferrite view, over the module's window. */
export interface FerriteFigures {
  name: string;
  title: string;
  requests: number;
  perSecond: number;
  errors: number;
  storeOps: number;
  opsPerRequest: number | null;
  meanMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
}

/** The Ferrite view's reply. */
export interface FerriteView {
  generation: number | null;
  instance: string | null;
  windowMs: number;
  apps: FerriteFigures[];
  total: FerriteFigures;
}

const real = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const realOrNull = (value: unknown) => (real(value) ? value : null);

function figuresFrom(value: unknown, name = "", title = ""): FerriteFigures | undefined {
  const figures = value as Record<string, unknown> | null;
  if (typeof figures !== "object" || figures === null || !count(figures.requests)) return undefined;
  return {
    name: typeof figures.name === "string" ? figures.name : name,
    title: typeof figures.title === "string" ? figures.title : title,
    requests: figures.requests,
    perSecond: real(figures.per_second) ? figures.per_second : 0,
    errors: count(figures.errors) ? figures.errors : 0,
    storeOps: count(figures.store_ops) ? figures.store_ops : 0,
    opsPerRequest: realOrNull(figures.ops_per_request),
    meanMs: realOrNull(figures.mean_ms),
    p50Ms: realOrNull(figures.p50_ms),
    p95Ms: realOrNull(figures.p95_ms),
  };
}

/** The Ferrite view of a reply, or `undefined` when it is not the module's. */
export function ferriteFromServer(reply: unknown): FerriteView | undefined {
  const body = reply as Record<string, unknown> | null;
  if (typeof body !== "object" || body === null || !Array.isArray(body.apps)) return undefined;
  const total = figuresFrom(body.total, "total", "All Apps");
  if (!total) return undefined;
  return {
    generation: count(body.generation) ? body.generation : null,
    instance: typeof body.instance === "string" ? body.instance : null,
    windowMs: count(body.window_ms) ? body.window_ms : 0,
    apps: body.apps.flatMap((app) => {
      const figures = figuresFrom(app);
      return figures?.name && figures.title ? [figures] : [];
    }),
    total,
  };
}

/** Applications with shared state across windows can handle Quit as one operation. */
type QuitHandler = (finish: () => void) => void;
const handlers = new Map<string, QuitHandler>();

export function registerAppQuit(app: string, handler: QuitHandler): () => void {
  handlers.set(app, handler);
  return () => {
    if (handlers.get(app) === handler) handlers.delete(app);
  };
}

export function requestAppQuit(app: string, finish: () => void): boolean {
  const handler = handlers.get(app);
  if (!handler) return false;
  handler(finish);
  return true;
}

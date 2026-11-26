/** A finished take the drive refused, and why. */
export interface UnsavedTake {
  file: File;
  reason: string;
}

let takes: readonly UnsavedTake[] = [];
const listeners = new Set<() => void>();
const changed = (next: readonly UnsavedTake[]) => {
  takes = next;
  for (const listener of listeners) listener();
};

/**
 * The takes whose upload failed, for as long as the page lives: a recording window that closed
 * during a take, or the app's window itself, may be gone when the upload fails, and any window of
 * QuickTime Player can still offer to save the file again. A page reload ends them; the page's
 * memory is the only copy.
 */
export const unsavedTakes = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  list: () => takes,
  add: (file: File, reason: string) =>
    changed([...takes.filter((take) => take.file !== file), { file, reason }]),
  remove: (file: File) => changed(takes.filter((take) => take.file !== file)),
};

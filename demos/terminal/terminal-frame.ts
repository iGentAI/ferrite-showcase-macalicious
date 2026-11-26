/**
 * The window's frames, in a module that imports nothing. `app.ts` reads them while it loads, and the
 * desktop's scan of every `app.ts` can reach it while `terminal.tsx` is still loading.
 */

/** [provisional] Eighty columns and twenty-four rows of the Basic profile's 11 pt font. */
export const DEFAULT_FRAME = { width: 536, height: 334 };
/** The least frame: enough for the title and a few lines. */
export const MIN_FRAME = { width: 256, height: 120 };

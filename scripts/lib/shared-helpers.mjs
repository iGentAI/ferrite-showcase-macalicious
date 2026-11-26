// The helpers that are counted once.
//
// The size budget (scripts/report-size.mjs) charges a component for everything its own code
// brings with it, helpers in src/lib included: three components that import the same helper
// are each charged for it in full. That is the rule, and it is deliberately the expensive one,
// so that code cannot leave a component's budget by moving to src/lib.
//
// A helper on this list is the exception. It is measured once, under its own name, against the
// same budget as a component, and is not charged to the components that import it. Three things
// keep the exception from becoming a way round the budget:
//
// - A file is here by name, after review. Being in src/lib earns nothing.
// - The report counts, in the built package, the components whose own code reaches the helper.
//   With fewer than two it is not shared: it is charged in full to the one component that
//   uses it, as any other helper is.
// - The report prints, for every component, what it loads in total, and what the whole
//   library or a named set of components loads with each file counted once, so the saving on
//   paper is never read as the cost to a page.
//
// Decision of 2026-10-02 (product owner, for the data views): selection, type-select,
// controlled state, rendering only the visible rows, and the shared resize observer are used by
// table view, list view, outline view, column view, icon view, gallery view and the sidebar,
// and all of them are acceptance criteria there, so none can be dropped to fit a budget.
//
// Added on 2026-10-06 with the Colors panel: color-value, used by color-wheel and color-panel,
// which must agree on how a colour is written and on keeping the hue through black.
//
// Added on 2026-11-05: system-arrows, used by bordered list, column view, gallery view, icon
// view, list view and table view, which must all leave the same keys to the desktop.
//
// To add a helper: it must already be imported by the own code of two components or more, it
// must hold nothing that only one of them needs, and the pull request must say what each
// component's figures were before and after.

/** @type {{ file: string, why: string }[]} */
export const SHARED_HELPERS = [
  { file: "src/lib/selection.ts", why: "row and item selection of every data view" },
  { file: "src/lib/type-select.ts", why: "typing a name selects the row, in every data view" },
  { file: "src/lib/use-controlled.ts", why: "controlled or uncontrolled state of a prop" },
  { file: "src/lib/use-virtual-range.ts", why: "rendering only the rows that are visible" },
  { file: "src/lib/observe-resize.ts", why: "one resize observer for every instance" },
  { file: "src/lib/color-value.ts", why: "hex and HSB conversion and state of the colour pickers" },
  { file: "src/lib/system-arrows.ts", why: "the keys every data view leaves to the desktop" },
];

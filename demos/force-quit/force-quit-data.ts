/**
 * The data and the rules of the Force Quit Applications window: which applications run, which
 * one is selected, what the button and the confirmation say, and what is left once an
 * application has been quit. Nothing here touches React or the document.
 */

export interface ForceQuitApplication {
  /** Identifies the application in the list, the selection and the callbacks. */
  id: string;
  /** The application's name, as the list and the confirmation show it. */
  name: string;
  /**
   * The application has stopped responding: "(not responding)" follows its name in the list.
   * @default false
   */
  notResponding?: boolean;
  /**
   * The application starts again when it is quit, as Finder does: the button reads "Relaunch"
   * and the application stays in the list.
   * @default false
   */
  relaunches?: boolean;
}

/** What the confirmation asks, and the title of the button that agrees. */
export interface ForceQuitConfirmation {
  /** The question, in bold: it names the confirmation. */
  title: string;
  /** The consequence under the question; a relaunch has none. */
  description?: string;
  /** The title of the button that agrees. */
  action: string;
}

/** The applications of the reference screenshots, in their order. */
export const defaultApplications: readonly ForceQuitApplication[] = [
  { id: "mail", name: "Mail" },
  { id: "safari", name: "Safari" },
  { id: "finder", name: "Finder", relaunches: true },
];

/** What follows the name of an application that has stopped responding. */
export const NOT_RESPONDING = "(not responding)";

/**
 * The selected application: the one `id` names, or the first when `id` names none. The list
 * always has a selection unless it is empty.
 */
export function resolveSelection(
  applications: readonly ForceQuitApplication[],
  id: string | undefined,
): ForceQuitApplication | undefined {
  return applications.find((application) => application.id === id) ?? applications[0];
}

/** The title of the window's button for the selected application. */
export function buttonTitle(application: ForceQuitApplication | undefined): string {
  return application?.relaunches ? "Relaunch" : "Force Quit";
}

/** A row's text: the name, and the note of an application that has stopped responding. */
export function applicationLabel(application: ForceQuitApplication): string {
  return application.notResponding ? `${application.name} ${NOT_RESPONDING}` : application.name;
}

/** What the window asks before it quits or relaunches an application. */
export function confirmationFor(application: ForceQuitApplication): ForceQuitConfirmation {
  return application.relaunches
    ? { title: `Do you want to relaunch “${application.name}”?`, action: buttonTitle(application) }
    : {
        title: `Do you want to force “${application.name}” to quit?`,
        description: "You will lose any unsaved changes.",
        action: buttonTitle(application),
      };
}

/** What the window asks before it quits several applications at once. */
export function confirmationForSeveral(
  applications: readonly ForceQuitApplication[],
): ForceQuitConfirmation {
  return {
    title: `Do you want to force these ${applications.length} applications to quit?`,
    description: "You will lose any unsaved changes.",
    action: "Force Quit",
  };
}

/**
 * The list and the selection after the application `id` was force quit. An application that
 * relaunches, or an `id` that names none, leaves both as they are (`applications` is returned
 * itself). When the selected application goes, the selection moves to the row that takes its
 * place, or to the one before it when it was the last.
 */
export function forceQuit(
  applications: readonly ForceQuitApplication[],
  id: string,
  selectedId: string | undefined,
): { applications: readonly ForceQuitApplication[]; selectedId: string | undefined } {
  const index = applications.findIndex((application) => application.id === id);
  const selected = resolveSelection(applications, selectedId);
  if (index < 0 || applications[index]?.relaunches) {
    return { applications, selectedId: selected?.id };
  }
  const next = applications.filter((_, at) => at !== index);
  const neighbour = next[index] ?? next[index - 1];
  return { applications: next, selectedId: selected?.id === id ? neighbour?.id : selected?.id };
}

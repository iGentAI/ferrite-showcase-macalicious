/** The errors that end a command of the simulated shell early. */

/** Thrown out of a running command by Control-C. */
export class Interrupted extends Error {
  constructor() {
    super("interrupted");
    this.name = "Interrupted";
  }
}

/** Thrown when `exit` runs. */
export class ShellExit extends Error {
  readonly status: number;
  constructor(status: number) {
    super("exit");
    this.name = "ShellExit";
    this.status = status;
  }
}

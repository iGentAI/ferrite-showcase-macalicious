import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import type { FinderNode } from "../finder/finder-data";

/**
 * The drive keeps no permissions, so `chmod` keeps a file's mode with the desktop's settings, by
 * the file's id: it follows the file through a rename and stays after a reload.
 */

const modeKey = (id: string) => `terminal-file-mode.${id.replace(/[^A-Za-z0-9.-]/g, "_")}`;

const defaultMode = (node: FinderNode) => (node.children ? 0o755 : 0o644);

/** The mode of a file or folder: what `chmod` set, or what a Mac gives a new one. */
export function modeOf(node: FinderNode): number {
  if (!node.id) return defaultMode(node);
  const kept = desktopValues()[modeKey(node.id)];
  return typeof kept === "number" ? kept : defaultMode(node);
}

export function setMode(node: FinderNode, mode: number): void {
  if (node.id) changeDesktopValue(modeKey(node.id), mode);
}

/** `drwxr-xr-x`, as `ls -l` writes it. */
export function modeText(node: FinderNode): string {
  const mode = modeOf(node);
  const bits = "rwxrwxrwx".replace(/./g, (letter, at: number) =>
    mode & (0o400 >> at) ? letter : "-",
  );
  return `${node.children ? "d" : "-"}${bits}`;
}

/**
 * What `chmod` makes of `mode`: an octal number, or clauses like `u+x`, `go-w` and `a=r`. `null`
 * for what it cannot read.
 */
export function changedMode(mode: number, change: string): number | null {
  if (/^[0-7]{1,4}$/.test(change)) return Number.parseInt(change, 8) & 0o777;
  let made = mode;
  for (const clause of change.split(",")) {
    const found = /^([ugoa]*)([-+=])([rwx]*)$/.exec(clause);
    if (!found) return null;
    const [, who = "", operator, what = ""] = found;
    const letters = who === "" || who.includes("a") ? "ugo" : who;
    let bits = 0;
    let mask = 0;
    for (const person of letters) {
      const shift = person === "u" ? 6 : person === "g" ? 3 : 0;
      mask |= 0o7 << shift;
      for (const letter of what) {
        bits |= (letter === "r" ? 4 : letter === "w" ? 2 : 1) << shift;
      }
    }
    if (operator === "+") made |= bits;
    else if (operator === "-") made &= ~bits;
    else made = (made & ~mask) | bits;
  }
  return made;
}

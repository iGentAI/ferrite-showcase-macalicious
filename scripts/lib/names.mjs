// Names shared by the scaffolder, the convention check and the registry builder.

export const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Folder names a component cannot have, because the package and the registry already use them:
 * `macalicious/tokens.css`, `macalicious/styles.css`, `macalicious/fallback-font.css`,
 * `macalicious/lib/*`, `macalicious/package.json`, the generated root entry (index) and the
 * registry's own `tokens` and `index` items.
 */
export const RESERVED_NAMES = ["tokens", "styles", "lib", "index", "fallback-font", "package"];

/** Why `name` cannot be a component folder, or undefined when it can. */
export function componentNameProblem(name) {
  if (!KEBAB.test(name)) return "folder name must be kebab-case";
  if (RESERVED_NAMES.includes(name)) {
    return `"${name}" is reserved by the package (reserved: ${RESERVED_NAMES.join(", ")}); choose another name`;
  }
  return undefined;
}

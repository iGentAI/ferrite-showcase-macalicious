# Desktop app feature inventories

This folder holds one inventory per app on the Ferrite desktop. An inventory lists
everything the real macOS 10.15 Catalina app does, and says how much of it works here.
The scope of each file is the whole real app, not what the demo has today.

## The rule for done

An item is `done` only when it works in the running app, checked in a browser with a
screenshot. Unit tests, a passing build and reading the code do not make an item `done`.

## The inventory file

Each app has one file, `ferrite-apps/desktop/features/<app>.md`, where `<app>` is the
app's folder name under `demos/`. Start it from this template:

```markdown
# <App name> feature inventory

Real app: <App name> in macOS 10.15 Catalina.

| Kind | Item | Real app behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| Menu item | File > New Album | Creates an empty album and selects its name | missing | |
| Keyboard shortcut | Command-N | Same as File > New Album | partial | The album is created, but its name is not selected |
| Drag and drop | Finder file to the sidebar | Imports the file into the album | built-unchecked | Commit abc1234 |
| Saved state | Album list | Survives a reload | done | [Reload check](#project-artifact/<artifact id>/<version>) |
```

Write one row for each item of these kinds:

- **Menu item:** every item of every menu, submenus included.
- **View:** every window, sheet, panel, sidebar section and display mode.
- **Toolbar item:** every button and control in the toolbar.
- **Context menu:** every item of every context menu, named with what was clicked.
- **Keyboard shortcut:** every shortcut, including those with no menu item.
- **Drag and drop:** every source and destination, inside the app and between apps.
- **Multi-selection:** every action that works on several selected items.
- **Saved state:** everything the app keeps across a reload.
- **Cross-app interaction:** opening files from Finder, share sheets, the clipboard, and
  the Dock, Spotlight and Mission Control.

The status is one of these four values:

| Status | Meaning | Evidence column |
| --- | --- | --- |
| `missing` | The item does not exist in the app. | Empty |
| `partial` | Some of the real behaviour works. | What does not work yet |
| `built-unchecked` | The code has landed, but nobody has checked it in a browser. | The commit |
| `done` | It works in the running app, checked in a browser with a screenshot. | A link to the screenshot |

A `done` row must link its screenshot. Publish the screenshot to the project library and
link that version; do not commit it. If a later change breaks the item, change its status
back.

## Run the desktop and take a screenshot

This recipe takes about three minutes from a clean tree. The repository and the public
Ferrite SDK ([iGentAI/ferrite-sdk](https://github.com/iGentAI/ferrite-sdk)) must be side by
side, as `ferrite-showcase-macalicious/` and `ferrite-sdk/`.

1. Install the dependencies and a browser, from the repository root:

   ```bash
   npm ci --no-audit --no-fund
   npx playwright install --with-deps chromium
   ```

2. Install the `ferrite` CLI:

   ```bash
   curl -fsSL https://downloads.ferrite.cloud/install.sh | sh
   ferrite --version
   ```

3. Pack the desktop into the app, from `ferrite-apps/desktop`. Run this again
   after every change to the desktop, a demo or the library. Until you do, the app serves
   the build it was compiled with:

   ```bash
   node scripts/pack-site.mjs
   ```

4. Start the app in its own terminal, from the same folder. Run it with
   `--egress allow` for an app that reaches the network, such as Books or Spotlight:

   ```bash
   ferrite dev --port 8787
   ```

   Wait for `ready: http://127.0.0.1:8787`. Then check that
   `http://127.0.0.1:8787/ferrite-site.json` names the build that step 3 printed.

5. Run a journey from the same folder. It drives a real browser and writes its
   screenshots to `--out`:

   ```bash
   node e2e/desktop-journey.mjs --url http://127.0.0.1:8787 --out <scratch dir>
   ```

   The result is `all 13 steps passed with no console errors`, exit code 0, and
   `desktop.png` and `calculator.png` in `--out`.

6. For a new check, copy the closest journey in `e2e/`. Journeys built on
   `e2e/app-journey.mjs` or `e2e/journey-kit.mjs` fail on any console error, page error,
   failed request or HTTP error. "Running the app journeys" in `../README.md` lists them
   and the flags each one needs.

7. Stop `ferrite dev` when you finish. Keep a focused check under 10 minutes.

### If a step fails

- `Cannot find package 'playwright'` from a journey: run `npm ci --no-audit --no-fund` again.
- `npm warn EBADENGINE`: the installed Node is older than `package.json` asks for. With
  Node 22.23.1 it did not stop any step of this recipe.

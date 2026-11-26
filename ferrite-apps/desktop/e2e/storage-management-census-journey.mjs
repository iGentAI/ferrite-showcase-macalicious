#!/usr/bin/env node
// Storage Management's census (app `storage-management`), real input on a served desktop (r2-app-census.mjs).
//   node e2e/storage-management-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit [--out dir]

import { appCensus, changesWindow, selects } from "./r2-app-census.mjs";
import { openFromDock } from "./r2-census-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

await appCensus({
  suite: "storage-management",
  app: "storage-management",
  name: "Storage Management",
  windowId: "storage-management",
  controls: [
    {
      id: "recommendations",
      role: "treeitem",
      name: /^Recommendations/,
      expected: "selects Recommendations",
      notes: "kind: the Recommendations item",
      verify: selects,
    },
    {
      id: "trash",
      role: "treeitem",
      name: /^Trash/,
      expected: "selects Trash and shows its size",
      notes: "kind: the Trash item, with its size",
      verify: selects,
    },
    {
      id: "app-data",
      role: "treeitem",
      name: /^App Data/,
      expected: "selects App Data and shows what each app keeps",
      notes: "kind: the App Data item, with its size",
      verify: selects,
    },
    {
      id: "review-files",
      role: "button",
      name: "Review Files",
      expected:
        "shows the files to review; dimmed with its reason when there is nothing to review, until a file is on the drive",
      // The window opens on the category it was left on, which may have no recommendations.
      verify: async ({ page, win, target }) => {
        await win.getByRole("treeitem", { name: /^Recommendations/ }).click();
        const dimmed = await target.isDisabled();
        if (dimmed && (await target.getAttribute("title")) !== "There are no files to review.") {
          return [false, "dimmed without its reason"];
        }
        if (!dimmed) return changesWindow({ page, win, target });
        await uploadFile(page, {
          parent: "documents",
          name: "Census review.txt",
          type: "text/plain",
          text: "review",
        });
        await win.getByRole("button", { name: "Close" }).first().click();
        const reopened = await openFromDock(page, "Storage Management", "storage-management");
        await reopened.getByRole("treeitem", { name: /^Recommendations/ }).click();
        const [changed] = await changesWindow({
          page,
          win: reopened,
          target: reopened.getByRole("button", { name: "Review Files", exact: true }).first(),
        });
        return [changed, `dimmed with its reason; with a file on the drive it acts=${changed}`];
      },
    },
  ],
});

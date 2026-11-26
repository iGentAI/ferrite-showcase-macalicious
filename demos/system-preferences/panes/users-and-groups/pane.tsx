import { definePane } from "../../pane";
import { ServedUsers } from "../../served-pages";
import { UsersAndGroups } from "./users-and-groups";

export const pane = definePane({
  served: { component: ServedUsers, height: 460 },
  height: 486,
  component: UsersAndGroups,
  keywords: [
    "accounts",
    "password",
    "change password",
    "login items",
    "login options",
    "guest user",
    "administrator",
    "contacts card",
    "user picture",
  ],
});

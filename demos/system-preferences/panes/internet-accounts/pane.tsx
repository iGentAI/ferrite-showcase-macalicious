import { definePane } from "../../pane";
import { ServedInternetAccounts } from "../../served-pages";
import { InternetAccounts } from "./internet-accounts";

export const pane = definePane({
  served: { component: ServedInternetAccounts, height: 280 },
  height: 486,
  component: InternetAccounts,
  keywords: [
    "mail",
    "contacts",
    "calendar",
    "messages",
    "icloud",
    "game center",
    "exchange",
    "google",
    "yahoo",
    "aol",
    "add other account",
  ],
});

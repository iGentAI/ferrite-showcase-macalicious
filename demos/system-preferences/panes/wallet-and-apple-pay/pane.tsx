import { definePane } from "../../pane";
import { ServedWallet } from "../../served-pages";
import { WalletAndApplePay } from "./wallet-and-apple-pay";

export const pane = definePane({
  served: { component: ServedWallet, height: 200 },
  height: 334,
  component: WalletAndApplePay,
  keywords: ["add card", "credit card", "debit card", "store card", "payment", "purchases"],
});

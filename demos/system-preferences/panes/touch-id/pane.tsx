import { definePane } from "../../pane";
import { ServedTouchId } from "../../served-pages";
import { TouchId } from "./touch-id";

export const pane = definePane({
  served: { component: ServedTouchId, height: 240 },
  height: 338,
  component: TouchId,
  keywords: [
    "fingerprint",
    "add a fingerprint",
    "unlocking your mac",
    "apple pay",
    "password autofill",
  ],
});

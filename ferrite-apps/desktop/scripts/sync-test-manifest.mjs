import { copyFileSync, mkdirSync } from "node:fs";

const fixtures = new URL("../tests/fixtures/", import.meta.url);
mkdirSync(fixtures, { recursive: true });
copyFileSync(new URL("../ferrite.json", import.meta.url), new URL("ferrite.json", fixtures));

import { describe, expect, it } from "vitest";
import { freshItemIds, othersFromServer } from "./keychain-access-others";
import { createVault, openWithKey, sealVault } from "./keychain-access-vault";

describe("the keychains beside login", () => {
  it("reads only a reply in the module's shape", async () => {
    const { envelope } = await createVault("a long password", 100_000);
    const one = { id: "keychain-1", name: "Work", vault: envelope };
    expect(othersFromServer({ keychains: [one], rev: 3 })).toEqual({ keychains: [one], rev: 3 });
    expect(othersFromServer({ keychains: null, rev: 0 })).toEqual({ keychains: [], rev: 0 });
    expect(othersFromServer({ keychains: [{ ...one, vault: {} }], rev: 3 })).toBeUndefined();
    expect(othersFromServer({ keychains: [one] })).toBeUndefined();
  });

  it("gives new ids in a keychain, past those it holds", () => {
    const item = (id: string) => ({
      id,
      name: id,
      kind: "secure note" as const,
      keychain: "k",
      secret: "",
    });
    expect(freshItemIds("k", [item("k-2"), item("k-3")], 2)).toEqual(["k-4", "k-5"]);
    expect(freshItemIds("k", [item("k-1")], 1)).toEqual(["k-2"]);
  });

  it("seals an item of another keychain, which comes back with its keychain's id", async () => {
    const { vault } = await createVault("a long password", 100_000);
    const item = {
      id: "keychain-1-1",
      name: "Hidden Name",
      kind: "secure note" as const,
      keychain: "keychain-1",
      secret: "Hidden Words",
    };
    const sealed = await sealVault({ ...vault, items: [item] });
    expect(JSON.stringify(sealed)).not.toContain("Hidden");
    expect(await openWithKey(sealed, vault.key)).toEqual([item]);
  });
});

import { AccountId, TokenId, TopicId } from "@hiero-ledger/sdk";
import { describe, expect, it } from "vitest";
import { buildAnchor, buildAnchorTransaction, sameAnchor } from "~~/lib/anchor";
import { hashBytes } from "~~/lib/hash";

const bytes = new TextEncoder().encode('{"kind":"parcel"}\n');

describe("anchor", () => {
  it("anchors the hash of exactly the given bytes", async () => {
    const anchor = await buildAnchor("IND-2026-0041", "parcel", bytes);

    expect(anchor).toEqual({ v: 1, parcelId: "IND-2026-0041", kind: "parcel", hash: await hashBytes(bytes) });
  });

  it("puts only the four permitted fields in the topic message", async () => {
    const anchor = await buildAnchor("IND-2026-0041", "parcel", bytes);
    const transaction = buildAnchorTransaction(
      TopicId.fromString("0.0.7"),
      TokenId.fromString("0.0.5"),
      AccountId.fromString("0.0.9"),
      3,
      anchor,
    );

    const message = JSON.parse(new TextDecoder().decode(transaction.getMessage() ?? new Uint8Array()));

    expect(Object.keys(message).sort()).toEqual(["hash", "kind", "parcelId", "v"]);
  });

  it("caps the payer's custom fee at maxFee Freight", async () => {
    const anchor = await buildAnchor("IND-2026-0041", "parcel", bytes);
    const [limit] = buildAnchorTransaction(
      TopicId.fromString("0.0.7"),
      TokenId.fromString("0.0.5"),
      AccountId.fromString("0.0.9"),
      3,
      anchor,
    ).getCustomFeeLimits();

    expect(limit.getAccountId()?.toString()).toBe("0.0.9");
    expect(limit.getFees()?.[0].denominatingTokenId?.toString()).toBe("0.0.5");
    expect(limit.getFees()?.[0].amount?.toNumber()).toBe(3);
  });

  it("compares anchors field by field", async () => {
    const anchor = await buildAnchor("IND-2026-0041", "parcel", bytes);

    expect(sameAnchor(anchor, { ...anchor })).toBe(true);
    expect(sameAnchor(anchor, { ...anchor, kind: "event" })).toBe(false);
  });
});

import { AccountId, KeyList, PrivateKey, TokenId } from "@hiero-ledger/sdk";
import { describe, expect, it } from "vitest";
import { buildCustomFees, feeExemptKey, feeScheduleKey } from "~~/lib/topic";

const committee = Array.from({ length: 4 }, () => PrivateKey.generateED25519().publicKey);

const fees = {
  tokenId: TokenId.fromString("0.0.5005"),
  treasuryId: AccountId.fromString("0.0.1001"),
  treasuryFee: 2,
  infraId: AccountId.fromString("0.0.2002"),
  infraFee: 1,
};

describe("topic configuration", () => {
  it("charges one Freight-denominated fee to each collector", () => {
    const [treasury, infra] = buildCustomFees(fees);

    expect(treasury.denominatingTokenId?.toString()).toBe("0.0.5005");
    expect(treasury.feeCollectorAccountId?.toString()).toBe("0.0.1001");
    expect(treasury.amount?.toNumber()).toBe(2);
    expect(infra.denominatingTokenId?.toString()).toBe("0.0.5005");
    expect(infra.feeCollectorAccountId?.toString()).toBe("0.0.2002");
    expect(infra.amount?.toNumber()).toBe(1);
  });

  it("makes the fee schedule key a threshold of the whole committee", () => {
    const key = feeScheduleKey(committee, 3);

    expect(key).toBeInstanceOf(KeyList);
    expect(key.threshold).toBe(3);
    expect(key.toArray()).toHaveLength(4);
  });

  it("makes the exempt key a 1-of-4 committee key so each representative is exempt alone", () => {
    const key = feeExemptKey(committee);

    expect(key.threshold).toBe(1);
    expect(key.toArray().map(String)).toEqual(committee.map(String));
  });
});

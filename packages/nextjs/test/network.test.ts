import { describe, expect, it } from "vitest";
import { hashscanTransactionUrl, readMirrorUrl, readNetwork } from "~~/lib/network";

describe("network", () => {
  it("defaults to testnet when HEDERA_NETWORK is unset or blank", () => {
    expect(readNetwork({})).toBe("testnet");
    expect(readNetwork({ HEDERA_NETWORK: "  " })).toBe("testnet");
  });

  it("rejects an unknown network and names the value", () => {
    expect(() => readNetwork({ HEDERA_NETWORK: "devnet" })).toThrow('got "devnet"');
    expect(() => readNetwork({ HEDERA_NETWORK: "toString" })).toThrow('got "toString"');
  });

  it("uses the public mirror node unless MIRROR_NODE_URL overrides it", () => {
    expect(readMirrorUrl("testnet", {})).toBe("https://testnet.mirrornode.hedera.com");
    expect(readMirrorUrl("testnet", { MIRROR_NODE_URL: "http://localhost:5551/" })).toBe("http://localhost:5551");
  });

  it("links a transaction on HashScan by its consensus timestamp", () => {
    expect(hashscanTransactionUrl("testnet", "1790854209.829935921")).toBe(
      "https://hashscan.io/testnet/transaction/1790854209.829935921",
    );
  });
});

import { PrivateKey } from "@hiero-ledger/sdk";
import { describe, expect, it } from "vitest";
import {
  createClient,
  parsePrivateKey,
  readCommitteeKeys,
  readCommitteeThreshold,
  readMirrorUrl,
  readNetwork,
  readOperator,
  readWholeNumber,
} from "~~/lib/client";

const captureMessage = (action: () => unknown) => {
  try {
    action();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected the action to throw");
};

describe("client", () => {
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

  it("names the missing operator variable", () => {
    expect(() => readOperator({ OPERATOR_KEY: "x" })).toThrow("OPERATOR_ID is not set");
    expect(() => readOperator({ OPERATOR_ID: "0.0.1234" })).toThrow("OPERATOR_KEY is not set");
  });

  it("names an invalid account id", () => {
    const key = PrivateKey.generateED25519().toStringDer();

    expect(() => readOperator({ OPERATOR_ID: "not-an-account", OPERATOR_KEY: key })).toThrow('"not-an-account"');
  });

  it("parses DER keys of both types and 0x-prefixed ECDSA hex", () => {
    const ed25519 = PrivateKey.generateED25519();
    const ecdsa = PrivateKey.generateECDSA();

    expect(parsePrivateKey(ed25519.toStringDer(), "KEY").toStringDer()).toBe(ed25519.toStringDer());
    expect(parsePrivateKey(ecdsa.toStringDer(), "KEY").toStringDer()).toBe(ecdsa.toStringDer());
    expect(parsePrivateKey(`0x${ecdsa.toStringRaw()}`, "KEY").toStringDer()).toBe(ecdsa.toStringDer());
  });

  it("rejects a malformed key without echoing it", () => {
    const secret = "deadbeef-not-a-key";
    const message = captureMessage(() => parsePrivateKey(secret, "OPERATOR_KEY"));

    expect(message).toContain("OPERATOR_KEY is not a valid private key");
    expect(message).not.toContain(secret);
  });

  it("builds a client for a network with the given account as operator", () => {
    const key = PrivateKey.generateECDSA();
    const client = createClient(readOperator({ OPERATOR_ID: "0.0.1234", OPERATOR_KEY: key.toStringDer() }), "testnet");

    expect(client.operatorAccountId?.toString()).toBe("0.0.1234");
    expect(client.operatorPublicKey?.toStringDer()).toBe(key.publicKey.toStringDer());
    client.close();
  });

  it("reads exactly four comma-separated committee keys", () => {
    const keys = Array.from({ length: 4 }, () => PrivateKey.generateED25519().toStringDer());

    expect(readCommitteeKeys({ COMMITTEE_KEYS: keys.join(", ") })).toHaveLength(4);
    expect(() => readCommitteeKeys({ COMMITTEE_KEYS: keys.slice(0, 3).join(",") })).toThrow("got 3");
    expect(() => readCommitteeKeys({ COMMITTEE_KEYS: `${keys[0]},nonsense` })).toThrow("COMMITTEE_KEYS entry 2");
  });

  it("defaults the committee threshold to 3 and refuses one representative acting alone", () => {
    expect(readCommitteeThreshold({})).toBe(3);
    expect(() => readCommitteeThreshold({ COMMITTEE_THRESHOLD: "1" })).toThrow("between 2 and 4");
    expect(() => readCommitteeThreshold({ COMMITTEE_THRESHOLD: "5" })).toThrow("between 2 and 4");
  });

  it("names a fee that is not a whole number", () => {
    expect(readWholeNumber("TREASURY_FEE", 2, {})).toBe(2);
    expect(() => readWholeNumber("TREASURY_FEE", 2, { TREASURY_FEE: "1.5" })).toThrow('got "1.5"');
    expect(() => readWholeNumber("TREASURY_FEE", 2, { TREASURY_FEE: "-1" })).toThrow('got "-1"');
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAnchors, fetchTokenBalance } from "~~/lib/mirror";

const MIRROR = "https://mirror.test";

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64");

const stubFetch = (pages: Record<string, unknown>) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = pages[url];
      return body === undefined ? { ok: false, status: 404 } : { ok: true, json: async () => body };
    }),
  );

const anchor = { v: 1, parcelId: "IND-2026-0041", kind: "parcel", hash: "ab".repeat(32) };

describe("mirror", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows pagination and keeps only well-formed anchors", async () => {
    stubFetch({
      [`${MIRROR}/api/v1/topics/0.0.7/messages?limit=100&order=asc`]: {
        messages: [
          { consensus_timestamp: "1.1", sequence_number: 1, message: encode(anchor) },
          { consensus_timestamp: "1.2", sequence_number: 2, message: Buffer.from("not json").toString("base64") },
        ],
        links: { next: "/api/v1/topics/0.0.7/messages?page=2" },
      },
      [`${MIRROR}/api/v1/topics/0.0.7/messages?page=2`]: {
        messages: [
          { consensus_timestamp: "1.3", sequence_number: 3, message: encode({ ...anchor, extra: "detail" }) },
          { consensus_timestamp: "1.4", sequence_number: 4, message: encode({ ...anchor, kind: "event" }) },
        ],
        links: { next: null },
      },
    });

    const anchors = await fetchAnchors(MIRROR, "0.0.7");

    expect(anchors.map(({ sequenceNumber }) => sequenceNumber)).toEqual([1, 4]);
  });

  it("names the URL and status when the mirror node fails", async () => {
    stubFetch({});

    await expect(fetchAnchors(MIRROR, "0.0.7")).rejects.toThrow("failed with HTTP 404");
  });

  it("reads a token balance, treating an unassociated token as zero", async () => {
    stubFetch({
      [`${MIRROR}/api/v1/accounts/0.0.9/tokens?token.id=0.0.5`]: { tokens: [{ token_id: "0.0.5", balance: 97 }] },
      [`${MIRROR}/api/v1/accounts/0.0.8/tokens?token.id=0.0.5`]: { tokens: [] },
    });

    expect(await fetchTokenBalance(MIRROR, "0.0.9", "0.0.5")).toBe(97);
    expect(await fetchTokenBalance(MIRROR, "0.0.8", "0.0.5")).toBe(0);
  });
});

describe("mirrorTransactionId", () => {
  it("converts an SDK transaction id to the mirror node's form", async () => {
    const { mirrorTransactionId } = await import("~~/lib/mirror");

    expect(mirrorTransactionId("0.0.10807565@1790865367.103654647")).toBe("0.0.10807565-1790865367-103654647");
    expect(() => mirrorTransactionId("nonsense")).toThrow('got "nonsense"');
  });
});

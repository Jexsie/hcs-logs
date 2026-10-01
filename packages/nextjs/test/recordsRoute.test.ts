import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "~~/app/api/parcels/[parcelId]/records/route";
import { buildAnchor } from "~~/lib/anchor";
import { formatRecord, generateEvent, generateParcel } from "~~/lib/records";
import { recordExists } from "~~/lib/store";
import { Anchor } from "~~/lib/types";

const PARCEL_ID = "IND-2026-0041";
const TX = "0.0.9@1700000000.000000001";
const TOPIC = "0.0.7";

const post = (body: unknown) =>
  POST(new Request("http://test", { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ parcelId: PARCEL_ID }),
  });

// Stubs the mirror node's answer for TX: its result, the topic it went to, and the anchor it carried.
const mirrorReturns = (result: string, topicId: string, anchor?: Anchor) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/api/v1/transactions/0.0.9-1700000000-000000001")) {
        const transactions = [{ name: "CONSENSUSSUBMITMESSAGE", result, consensus_timestamp: "1700000005.000000001" }];
        return { ok: true, status: 200, json: async () => ({ transactions }) };
      }
      const message = Buffer.from(JSON.stringify(anchor ?? {})).toString("base64");
      return { ok: true, status: 200, json: async () => ({ topic_id: topicId, message }) };
    }),
  );

describe("POST /api/parcels/[parcelId]/records", () => {
  const cwd = process.cwd();
  let dir: string;
  const parcelText = formatRecord(generateParcel(PARCEL_ID, "0.0.9"));
  const anchorOf = (text: string, kind: Anchor["kind"]) => buildAnchor(PARCEL_ID, kind, new TextEncoder().encode(text));

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hcs-logs-records-"));
    process.chdir(dir);
    vi.stubEnv("TOPIC_ID", TOPIC);
    vi.stubEnv("HEDERA_NETWORK", "testnet");
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("saves the exact record text once its anchor is confirmed on the topic", async () => {
    mirrorReturns("SUCCESS", TOPIC, await anchorOf(parcelText, "parcel"));

    const response = await post({ record: parcelText, transactionId: TX });

    expect(response.status).toBe(201);
    expect(fs.readFileSync(path.join("data", PARCEL_ID, "parcel.json"), "utf8")).toBe(parcelText);
  });

  it("refuses a record whose bytes differ from what was anchored", async () => {
    mirrorReturns("SUCCESS", TOPIC, await anchorOf(parcelText, "parcel"));

    const response = await post({ record: parcelText.replace("}\n", "} \n"), transactionId: TX });

    expect(response.status).toBe(422);
    expect(recordExists(PARCEL_ID, "parcel.json")).toBe(false);
  });

  it("refuses when the submission failed, for example over the fee cap", async () => {
    mirrorReturns("MAX_CUSTOM_FEE_LIMIT_EXCEEDED", TOPIC);

    const response = await post({ record: parcelText, transactionId: TX });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain("MAX_CUSTOM_FEE_LIMIT_EXCEEDED");
    expect(recordExists(PARCEL_ID, "parcel.json")).toBe(false);
  });

  it("refuses an anchor posted to another topic", async () => {
    mirrorReturns("SUCCESS", "0.0.8", await anchorOf(parcelText, "parcel"));

    expect((await post({ record: parcelText, transactionId: TX })).status).toBe(422);
  });

  it("refuses an event before its parcel without asking the mirror node", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const eventText = formatRecord(generateEvent(PARCEL_ID, "shipped"));

    expect((await post({ record: eventText, transactionId: TX })).status).toBe(409);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses to save the same anchored record twice", async () => {
    mirrorReturns("SUCCESS", TOPIC, await anchorOf(parcelText, "parcel"));
    await post({ record: parcelText, transactionId: TX });

    expect((await post({ record: parcelText, transactionId: TX })).status).toBe(409);
  });

  it("rejects a body without a record for this parcel", async () => {
    expect((await post({})).status).toBe(400);
    expect(
      (await post({ record: formatRecord({ kind: "parcel", parcelId: "IND-2026-9999" }), transactionId: TX })).status,
    ).toBe(400);
  });
});

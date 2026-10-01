import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashBytes } from "~~/lib/hash";
import { listRecordFiles } from "~~/lib/store";
import { anchorRecord, generateEvent, generateParcel, serializeRecord } from "~~/lib/submit";

const PARCEL_ID = "IND-2026-0041";

describe("anchorRecord", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hcs-logs-submit-"));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("writes no file when the submission fails", async () => {
    const publish = vi.fn().mockRejectedValue(new Error("MAX_CUSTOM_FEE_LIMIT_EXCEEDED"));
    const bytes = serializeRecord(generateParcel(PARCEL_ID, "Lakeside Haulage"));

    await expect(anchorRecord(publish, PARCEL_ID, "parcel", bytes, dataDir)).rejects.toThrow(
      "MAX_CUSTOM_FEE_LIMIT_EXCEEDED",
    );
    expect(publish).toHaveBeenCalledOnce();
    expect(fs.existsSync(path.join(dataDir, PARCEL_ID))).toBe(false);
  });

  it("puts only v, parcelId, kind and hash in the message", async () => {
    const publish = vi.fn().mockResolvedValue("0.0.1001@1700000000.000000000");
    await anchorRecord(
      publish,
      PARCEL_ID,
      "parcel",
      serializeRecord(generateParcel(PARCEL_ID, "Lakeside Haulage")),
      dataDir,
    );

    const message = JSON.parse(publish.mock.calls[0][0]);

    expect(Object.keys(message).sort()).toEqual(["hash", "kind", "parcelId", "v"]);
    expect(message).toMatchObject({ v: 1, parcelId: PARCEL_ID, kind: "parcel" });
  });

  it("anchors the hash of exactly the bytes it writes to disk", async () => {
    const publish = vi.fn().mockResolvedValue("0.0.1001@1700000000.000000000");
    const bytes = serializeRecord(generateParcel(PARCEL_ID, "Lakeside Haulage"));

    const { anchor, filePath } = await anchorRecord(publish, PARCEL_ID, "parcel", bytes, dataDir);
    const written = fs.readFileSync(filePath);

    expect(written.equals(bytes)).toBe(true);
    expect(anchor.hash).toBe(hashBytes(written));
    expect(JSON.parse(publish.mock.calls[0][0]).hash).toBe(hashBytes(written));
  });

  it("publishes before it writes", async () => {
    const order: string[] = [];
    const publish = vi.fn(async () => {
      order.push(fs.existsSync(path.join(dataDir, PARCEL_ID, "parcel.json")) ? "file existed" : "published");
      return "0.0.1001@1700000000.000000000";
    });

    await anchorRecord(
      publish,
      PARCEL_ID,
      "parcel",
      serializeRecord(generateParcel(PARCEL_ID, "Lakeside Haulage")),
      dataDir,
    );

    expect(order).toEqual(["published"]);
  });

  it("numbers events in submission order", async () => {
    const publish = vi.fn().mockResolvedValue("0.0.1001@1700000000.000000000");
    await anchorRecord(
      publish,
      PARCEL_ID,
      "parcel",
      serializeRecord(generateParcel(PARCEL_ID, "Lakeside Haulage")),
      dataDir,
    );
    await anchorRecord(publish, PARCEL_ID, "event", serializeRecord(generateEvent(PARCEL_ID, "picked-up")), dataDir);
    await anchorRecord(publish, PARCEL_ID, "event", serializeRecord(generateEvent(PARCEL_ID, "delivered")), dataDir);

    expect(listRecordFiles(PARCEL_ID, dataDir)).toEqual(["event-0001.json", "event-0002.json", "parcel.json"]);
  });

  it("refuses, without publishing, an event for an unregistered parcel or a second parcel record", async () => {
    const publish = vi.fn().mockResolvedValue("0.0.1001@1700000000.000000000");
    const event = serializeRecord(generateEvent(PARCEL_ID, "picked-up"));

    await expect(anchorRecord(publish, PARCEL_ID, "event", event, dataDir)).rejects.toThrow("submit the parcel");
    await anchorRecord(
      publish,
      PARCEL_ID,
      "parcel",
      serializeRecord(generateParcel(PARCEL_ID, "Lakeside Haulage")),
      dataDir,
    );
    await expect(
      anchorRecord(
        publish,
        PARCEL_ID,
        "parcel",
        serializeRecord(generateParcel(PARCEL_ID, "Lakeside Haulage")),
        dataDir,
      ),
    ).rejects.toThrow("already exists");
    expect(publish).toHaveBeenCalledOnce();
  });
});

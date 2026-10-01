import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readRecords, recordPath } from "~~/lib/store";
import { anchorRecord, generateEvent, generateParcel, serializeRecord } from "~~/lib/submit";
import { AnchoredMessage, anchorsForParcel, compareRecord, compareRecords } from "~~/lib/verify";

const PARCEL_ID = "IND-2026-0041";

describe("verification", () => {
  let dataDir: string;
  let published: AnchoredMessage[];

  beforeEach(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hcs-logs-verify-"));
    published = [];
    const publish = vi.fn(async (message: string) => {
      published.push({
        ...JSON.parse(message),
        consensusTimestamp: `1700000000.${published.length}`,
        sequenceNumber: published.length + 1,
      });
      return `0.0.1001@1700000000.${published.length}`;
    });
    await anchorRecord(
      publish,
      PARCEL_ID,
      "parcel",
      serializeRecord(generateParcel(PARCEL_ID, "Lakeside Haulage")),
      dataDir,
    );
    await anchorRecord(publish, PARCEL_ID, "event", serializeRecord(generateEvent(PARCEL_ID, "shipped")), dataDir);
    await anchorRecord(publish, PARCEL_ID, "event", serializeRecord(generateEvent(PARCEL_ID, "delivered")), dataDir);
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("verifies every untouched record", async () => {
    const results = await compareRecords(PARCEL_ID, readRecords(PARCEL_ID, dataDir), published);

    expect(results.map(({ status }) => status)).toEqual(["verified", "verified", "verified"]);
  });

  it("flips only the edited record to changed", async () => {
    const filePath = recordPath(PARCEL_ID, "event-0001.json", dataDir);
    fs.writeFileSync(filePath, fs.readFileSync(filePath, "utf8").replace("Kampala, UG", "Entebbe, UG"));

    const results = await compareRecords(PARCEL_ID, readRecords(PARCEL_ID, dataDir), published);

    expect(results.map(({ fileName, status }) => [fileName, status])).toEqual([
      ["event-0001.json", "changed"],
      ["event-0002.json", "verified"],
      ["parcel.json", "verified"],
    ]);
  });

  it("treats a whitespace-only edit as a change", async () => {
    fs.appendFileSync(recordPath(PARCEL_ID, "parcel.json", dataDir), "\n");

    const [, , parcel] = await compareRecords(PARCEL_ID, readRecords(PARCEL_ID, dataDir), published);

    expect(parcel.status).toBe("changed");
  });

  it("does not accept an anchor from another parcel, or of another kind when the kind is known", async () => {
    const records = readRecords(PARCEL_ID, dataDir);
    const elsewhere = published.map(anchor => ({ ...anchor, parcelId: "IND-2026-9999" }));
    const wrongKind = published.map(anchor => ({
      ...anchor,
      kind: anchor.kind === "parcel" ? ("event" as const) : ("parcel" as const),
    }));

    expect((await compareRecords(PARCEL_ID, records, elsewhere)).every(({ status }) => status === "changed")).toBe(
      true,
    );
    expect((await compareRecords(PARCEL_ID, records, wrongKind)).every(({ status }) => status === "changed")).toBe(
      true,
    );
  });

  it("verifies a renamed file of unknown kind, as the page does with dropped files", async () => {
    const [, , parcel] = readRecords(PARCEL_ID, dataDir);

    const result = await compareRecord(PARCEL_ID, { fileName: "download (3).json", bytes: parcel.bytes }, published);

    expect(result.status).toBe("verified");
    expect(result.anchor?.kind).toBe("parcel");
  });

  it("lists a parcel's anchors in topic order", () => {
    const shuffled = [published[2], { ...published[0], parcelId: "IND-2026-9999" }, published[1], published[0]];

    expect(anchorsForParcel(PARCEL_ID, shuffled).map(({ sequenceNumber }) => sequenceNumber)).toEqual([1, 2, 3]);
  });
});

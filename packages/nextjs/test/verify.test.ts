import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readRecords, recordPath } from "~~/lib/store";
import { anchorRecord, generateEvent, generateParcel, serializeRecord } from "~~/lib/submit";
import { compareRecords } from "~~/lib/verify";

const PARCEL_ID = "IND-2026-0041";

describe("compareRecords", () => {
  let dataDir: string;
  let published: { consensusTimestamp: string; v: 1; parcelId: string; kind: "parcel" | "event"; hash: string }[];

  beforeEach(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hcs-logs-verify-"));
    published = [];
    const publish = vi.fn(async (message: string) => {
      published.push({ ...JSON.parse(message), consensusTimestamp: `1700000000.${published.length}` });
      return `0.0.1001@1700000000.${published.length}`;
    });
    await anchorRecord(
      publish,
      PARCEL_ID,
      "parcel",
      serializeRecord(generateParcel(PARCEL_ID, "Lakeside Haulage")),
      dataDir,
    );
    await anchorRecord(publish, PARCEL_ID, "event", serializeRecord(generateEvent(PARCEL_ID, "picked-up")), dataDir);
    await anchorRecord(publish, PARCEL_ID, "event", serializeRecord(generateEvent(PARCEL_ID, "delivered")), dataDir);
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("verifies every untouched record", () => {
    const results = compareRecords(PARCEL_ID, readRecords(PARCEL_ID, dataDir), published);

    expect(results.map(({ status }) => status)).toEqual(["verified", "verified", "verified"]);
  });

  it("flips only the edited record to changed", () => {
    const filePath = recordPath(PARCEL_ID, "event-0001.json", dataDir);
    fs.writeFileSync(filePath, fs.readFileSync(filePath, "utf8").replace("Malaba border post", "Busia border post"));

    const results = compareRecords(PARCEL_ID, readRecords(PARCEL_ID, dataDir), published);

    expect(results.map(({ fileName, status }) => [fileName, status])).toEqual([
      ["event-0001.json", "changed"],
      ["event-0002.json", "verified"],
      ["parcel.json", "verified"],
    ]);
  });

  it("treats a whitespace-only edit as a change", () => {
    const filePath = recordPath(PARCEL_ID, "parcel.json", dataDir);
    fs.appendFileSync(filePath, "\n");

    const [, , parcel] = compareRecords(PARCEL_ID, readRecords(PARCEL_ID, dataDir), published);

    expect(parcel.status).toBe("changed");
  });

  it("does not accept an anchor from another parcel or kind", () => {
    const records = readRecords(PARCEL_ID, dataDir);
    const elsewhere = published.map(anchor => ({ ...anchor, parcelId: "IND-2026-9999" }));
    const wrongKind = published.map(anchor => ({ ...anchor, kind: anchor.kind === "parcel" ? "event" : "parcel" }));

    expect(compareRecords(PARCEL_ID, records, elsewhere).every(({ status }) => status === "changed")).toBe(true);
    expect(
      compareRecords(PARCEL_ID, records, wrongKind as typeof published).every(({ status }) => status === "changed"),
    ).toBe(true);
  });
});

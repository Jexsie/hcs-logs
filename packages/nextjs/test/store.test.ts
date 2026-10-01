import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashBytes } from "~~/lib/hash";
import { assertParcelId, listRecordFiles, readRecords, recordPath, writeRecord } from "~~/lib/store";

const PARCEL_ID = "IND-2026-0041";

describe("store", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hcs-logs-store-"));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("writes data/<parcelId>/<fileName> with the exact bytes given", () => {
    const bytes = Buffer.from('{"parcelId":"IND-2026-0041"}', "utf8");
    const filePath = writeRecord(PARCEL_ID, "parcel.json", bytes, dataDir);

    expect(filePath).toBe(path.join(dataDir, PARCEL_ID, "parcel.json"));
    expect(fs.readFileSync(filePath).equals(bytes)).toBe(true);
  });

  it("reads back bytes whose hash matches the hash of the bytes written", () => {
    const bytes = Buffer.from('{"kind":"event","note":"picked up"}', "utf8");
    writeRecord(PARCEL_ID, "event-0001.json", bytes, dataDir);

    const [record] = readRecords(PARCEL_ID, dataDir);

    expect(record.fileName).toBe("event-0001.json");
    expect(hashBytes(record.bytes)).toBe(hashBytes(bytes));
  });

  it("refuses to overwrite an existing record and leaves it untouched", () => {
    const original = Buffer.from('{"v":1}');
    writeRecord(PARCEL_ID, "parcel.json", original, dataDir);

    expect(() => writeRecord(PARCEL_ID, "parcel.json", Buffer.from('{"v":2}'), dataDir)).toThrow("already exists");
    expect(fs.readFileSync(recordPath(PARCEL_ID, "parcel.json", dataDir)).equals(original)).toBe(true);
  });

  it("lists only .json files, in name order", () => {
    writeRecord(PARCEL_ID, "event-0002.json", Buffer.from("{}"), dataDir);
    writeRecord(PARCEL_ID, "parcel.json", Buffer.from("{}"), dataDir);
    writeRecord(PARCEL_ID, "event-0001.json", Buffer.from("{}"), dataDir);
    fs.writeFileSync(path.join(dataDir, PARCEL_ID, "notes.txt"), "ignored");

    expect(listRecordFiles(PARCEL_ID, dataDir)).toEqual(["event-0001.json", "event-0002.json", "parcel.json"]);
  });

  it("names the parcel when it has no records", () => {
    expect(() => readRecords("IND-2026-9999", dataDir)).toThrow('No records for parcel "IND-2026-9999"');
  });

  it("accepts readable parcel ids", () => {
    expect(() => assertParcelId(PARCEL_ID)).not.toThrow();
  });

  it.each(["", "../etc", "IND/2026", "ind-2026-0041", "IND 2026"])("rejects the parcel id %j", parcelId => {
    expect(() => assertParcelId(parcelId)).toThrow("Parcel id");
  });

  it("rejects file names that carry a path or are not .json", () => {
    expect(() => recordPath(PARCEL_ID, "../parcel.json", dataDir)).toThrow("path");
    expect(() => recordPath(PARCEL_ID, "parcel.txt", dataDir)).toThrow(".json");
  });
});

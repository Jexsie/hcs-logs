import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashBytes } from "~~/lib/hash";

describe("hashBytes", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hcs-logs-hash-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("matches the SHA-256 test vector", () => {
    expect(hashBytes(Buffer.from("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("hashes the raw bytes of a file as read from disk", () => {
    const json = '{"parcelId":"IND-2026-0041","weightKg":12.5}';
    const filePath = path.join(dir, "parcel.json");
    fs.writeFileSync(filePath, json);

    expect(hashBytes(fs.readFileSync(filePath))).toBe(hashBytes(Buffer.from(json, "utf8")));
  });

  it("changes when a single byte of the file changes", () => {
    const filePath = path.join(dir, "parcel.json");
    fs.writeFileSync(filePath, '{"parcelId":"IND-2026-0041","weightKg":12.5}');
    const original = fs.readFileSync(filePath);
    const edited = Buffer.from(original);
    edited[edited.length - 3] += 1;
    fs.writeFileSync(filePath, edited);

    expect(hashBytes(fs.readFileSync(filePath))).not.toBe(hashBytes(original));
  });

  it("does not canonicalize: key order and whitespace change the hash", () => {
    const base = hashBytes(Buffer.from('{"a":1,"b":2}'));

    expect(hashBytes(Buffer.from('{"b":2,"a":1}'))).not.toBe(base);
    expect(hashBytes(Buffer.from('{"a": 1, "b": 2}'))).not.toBe(base);
    expect(hashBytes(Buffer.from('{"a":1,"b":2}\n'))).not.toBe(base);
  });
});

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "~~/app/api/parcels/[parcelId]/route";
import { base64ToBytes } from "~~/lib/mirror";
import { writeRecord } from "~~/lib/store";

const call = (parcelId: string) => GET(new Request("http://test"), { params: Promise.resolve({ parcelId }) });

describe("GET /api/parcels/[parcelId]", () => {
  const cwd = process.cwd();
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hcs-logs-route-"));
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("serves each record byte for byte, with its kind", async () => {
    const bytes = Buffer.from('{"kind":"parcel"}\n');
    writeRecord("IND-2026-0041", "parcel.json", bytes);

    const { records } = await (await call("IND-2026-0041")).json();

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ fileName: "parcel.json", kind: "parcel" });
    expect(Buffer.from(base64ToBytes(records[0].content)).equals(bytes)).toBe(true);
  });

  it("returns no records for a parcel this site does not hold", async () => {
    expect(await (await call("IND-2026-9999")).json()).toEqual({ records: [] });
  });

  it("rejects a parcel id that could reach outside the data folder", async () => {
    const response = await call("..");

    expect(response.status).toBe(400);
  });
});

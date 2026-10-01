import { describe, expect, it } from "vitest";
import { formatRecord, generateParcel } from "~~/lib/records";
import { readDraft } from "~~/utils/portalSubmit";

describe("readDraft", () => {
  it("reads the kind and parcel ID of a generated record", () => {
    expect(readDraft(formatRecord(generateParcel("IND-2026-0041", "0.0.9")))).toEqual({
      kind: "parcel",
      parcelId: "IND-2026-0041",
    });
  });

  it("explains what is wrong with a draft it cannot submit", () => {
    expect(() => readDraft("{ not json")).toThrow("not valid JSON");
    expect(() => readDraft('{"kind":"note","parcelId":"IND-2026-0041"}')).toThrow('"kind"');
    expect(() => readDraft('{"kind":"event"}')).toThrow('"parcelId"');
  });
});

import { describe, expect, it } from "vitest";
import {
  EVENT_TYPES,
  formatRecord,
  generateEvent,
  generateParcel,
  nextEventType,
  randomParcelId,
  serializeRecord,
} from "~~/lib/records";

describe("records", () => {
  it("generates parcel ids in the association's format", () => {
    expect(randomParcelId(new Date("2026-10-01T12:00:00Z"), () => 0.0041)).toBe("IND-2026-0041");
  });

  it("stamps each generated record with the time it was generated", () => {
    const now = new Date("2026-10-01T12:34:56.000Z");

    expect(generateParcel("IND-2026-0041", "Nile Cargo Services", now).registeredAt).toBe(now.toISOString());
    expect(generateEvent("IND-2026-0041", "shipped", {}, now).recordedAt).toBe(now.toISOString());
  });

  it("places each event along the parcel's own route", () => {
    const parcel = generateParcel("IND-2026-0041", "Rift Valley Logistics", new Date(), () => 0.5);
    const at = (type: (typeof EVENT_TYPES)[number]) => generateEvent(parcel.parcelId, type, parcel).location;

    expect([at("shipped"), at("customs"), at("delivered")]).toEqual([parcel.origin, parcel.via, parcel.destination]);
    expect(parcel.origin).not.toBe(parcel.destination);
  });

  it("walks a parcel through shipped, customs and delivered, then stops", () => {
    expect(nextEventType([])).toBe("shipped");
    expect(nextEventType(["shipped"])).toBe("customs");
    expect(nextEventType(["shipped", "customs"])).toBe("delivered");
    expect(nextEventType(["shipped", "customs", "delivered"])).toBeUndefined();
  });

  it("serializes a record once, as the exact UTF-8 bytes of its formatted text", () => {
    const record = generateParcel("IND-2026-0041", "Lakeside Haulage");

    expect(formatRecord(record).endsWith("}\n")).toBe(true);
    expect(serializeRecord(record)).toEqual(new TextEncoder().encode(formatRecord(record)));
  });
});

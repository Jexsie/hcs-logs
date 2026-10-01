import { describe, expect, it } from "vitest";
import { generateEvent, generateParcel, serializeRecord } from "~~/lib/records";
import { asEvent, asParcel, formatEventType, readRecord } from "~~/utils/recordDetails";

describe("record details for the page", () => {
  it("reads a parcel record's details from its exact bytes", () => {
    const parcel = asParcel(
      readRecord(serializeRecord(generateParcel("IND-2026-0041", "Lakeside Haulage", new Date(), () => 0))),
    );

    expect(parcel).toMatchObject({ handler: "Lakeside Haulage", origin: "Kampala, UG", destination: "Mombasa, KE" });
    expect(asEvent(readRecord(serializeRecord(generateParcel("IND-2026-0041", "x"))))).toBeUndefined();
  });

  it("reads an event record and labels its type", () => {
    const event = asEvent(
      readRecord(serializeRecord(generateEvent("IND-2026-0041", "customs", { via: "Malaba border post" }))),
    );

    expect(formatEventType(event?.type)).toBe("Customs");
    expect(event?.location).toBe("Malaba border post");
    expect(formatEventType("out-for-delivery")).toBe("Out for delivery");
    expect(formatEventType(undefined)).toBe("Updated");
  });

  it("treats bytes that are not JSON as no record", () => {
    expect(readRecord(new TextEncoder().encode("not json"))).toBeUndefined();
    expect(asParcel(readRecord(new TextEncoder().encode("[1, 2]")))).toBeUndefined();
  });
});

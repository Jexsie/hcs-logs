import { describe, expect, it } from "vitest";
import { generateEvent, generateParcel, serializeRecord } from "~~/lib/submit";
import { asEvent, asParcel, formatEventType, readRecord } from "~~/utils/recordDetails";

describe("record details for the page", () => {
  it("reads a parcel record's details from its exact bytes", () => {
    const parcel = asParcel(readRecord(serializeRecord(generateParcel("IND-2026-0041", "Lakeside Haulage"))));

    expect(parcel).toMatchObject({ handler: "Lakeside Haulage", origin: "Kampala, UG", destination: "Mombasa, KE" });
    expect(asEvent(readRecord(serializeRecord(generateParcel("IND-2026-0041", "x"))))).toBeUndefined();
  });

  it("reads an event record and labels its type", () => {
    const event = asEvent(readRecord(serializeRecord(generateEvent("IND-2026-0041", "out-for-delivery"))));

    expect(formatEventType(event?.type)).toBe("Out for delivery");
    expect(formatEventType(undefined)).toBe("Event recorded");
  });

  it("treats bytes that are not JSON as no record", () => {
    expect(readRecord(new TextEncoder().encode("not json"))).toBeUndefined();
    expect(asParcel(readRecord(new TextEncoder().encode("[1, 2]")))).toBeUndefined();
  });
});

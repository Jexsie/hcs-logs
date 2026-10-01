import type { generateEvent, generateParcel } from "~~/lib/submit";

type ParcelDetails = Partial<ReturnType<typeof generateParcel>>;
type EventDetails = Partial<ReturnType<typeof generateEvent>>;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

// Records are read for display only after their raw bytes were hashed and matched to an anchor, never before.
export const readRecord = (bytes: Uint8Array): unknown => {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
};

export const asParcel = (record: unknown) =>
  isObject(record) && record.kind === "parcel" ? (record as ParcelDetails) : undefined;

export const asEvent = (record: unknown) =>
  isObject(record) && record.kind === "event" ? (record as EventDetails) : undefined;

// "out-for-delivery" -> "Out for delivery"
export const formatEventType = (type?: string) => {
  if (!type) {
    return "Event recorded";
  }
  const words = type.split("-").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// Mirror node timestamps are "seconds.nanoseconds" since the epoch.
export const formatConsensusTime = (timestamp: string) =>
  new Date(Number(timestamp.split(".")[0]) * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

// Record generation, shared by the CLI and the member portal, so it uses no Node or SDK APIs.

// A parcel's life after it is registered, in order.
export const EVENT_TYPES = ["shipped", "customs", "delivered"] as const;

export type EventType = (typeof EVENT_TYPES)[number];

type Random = () => number;

const ROUTES = [
  { origin: "Kampala, UG", via: "Malaba border post", destination: "Mombasa, KE" },
  { origin: "Nairobi, KE", via: "Namanga border post", destination: "Arusha, TZ" },
  { origin: "Kigali, RW", via: "Rusumo border post", destination: "Dar es Salaam, TZ" },
  { origin: "Juba, SS", via: "Nimule border post", destination: "Kampala, UG" },
  { origin: "Dar es Salaam, TZ", via: "Tunduma border post", destination: "Lusaka, ZM" },
];

const SHIPPERS = ["Lakeside Exporters Ltd", "Highland Coffee Co", "Savannah Textiles", "Great Rift Agro"];

const CONSIGNEES = ["Coastline Imports", "Indiana Group Member Depot", "Harbour Wholesale", "Kilimanjaro Traders"];

const pick = <T>(items: readonly T[], random: Random) => items[Math.floor(random() * items.length)];

export const randomParcelId = (now = new Date(), random: Random = Math.random) =>
  `IND-${now.getFullYear()}-${String(Math.floor(random() * 10_000)).padStart(4, "0")}`;

export const generateParcel = (parcelId: string, handler: string, now = new Date(), random: Random = Math.random) => ({
  parcelId,
  kind: "parcel",
  handler,
  shipper: pick(SHIPPERS, random),
  consignee: pick(CONSIGNEES, random),
  ...pick(ROUTES, random),
  weightKg: Math.round((1 + random() * 49) * 10) / 10,
  pieces: 1 + Math.floor(random() * 10),
  registeredAt: now.toISOString(),
});

// Where each event happens along the parcel's route. Records from before routes carried `via` fall back to a label.
const locationOf = (type: EventType, route: { origin?: string; via?: string; destination?: string }) =>
  ({ shipped: route.origin, customs: route.via, delivered: route.destination })[type] ?? "On route";

export const generateEvent = (
  parcelId: string,
  type: EventType,
  route: { origin?: string; via?: string; destination?: string } = {},
  now = new Date(),
) => ({
  parcelId,
  kind: "event",
  type,
  location: locationOf(type, route),
  recordedAt: now.toISOString(),
});

// The next step in a parcel's life, or undefined once it has been delivered.
export const nextEventType = (recordedTypes: string[]) => EVENT_TYPES.find(type => !recordedTypes.includes(type));

// The record is stringified exactly once. These bytes are hashed, anchored and written; nothing re-serializes them.
export const formatRecord = (record: object) => `${JSON.stringify(record, null, 2)}\n`;

export const serializeRecord = (record: object) => new TextEncoder().encode(formatRecord(record));

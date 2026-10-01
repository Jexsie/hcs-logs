import {
  Client,
  CustomFeeLimit,
  CustomFixedFee,
  PrivateKey,
  TokenId,
  TopicId,
  TopicMessageSubmitTransaction,
} from "@hiero-ledger/sdk";
import { executeTransaction, signWith } from "~~/lib/client";
import { hashBytes } from "~~/lib/hash";
import { PARCEL_FILE, nextEventFileName, recordExists, writeRecord } from "~~/lib/store";
import { Anchor } from "~~/lib/types";

// Sends one anchor message, resolving with its transaction id once it has reached consensus.
type Publish = (message: string) => Promise<string>;

// A parcel's life after it is registered, in order.
export const EVENT_TYPES = ["shipped", "customs", "delivered"] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const generateParcel = (parcelId: string, handler: string, now = new Date()) => ({
  parcelId,
  kind: "parcel",
  handler,
  shipper: "Lakeside Exporters Ltd",
  consignee: "Indiana Group Member Depot",
  origin: "Kampala, UG",
  destination: "Mombasa, KE",
  weightKg: 12.5,
  pieces: 3,
  registeredAt: now.toISOString(),
});

const EVENT_LOCATIONS: Record<EventType, string> = {
  shipped: "Kampala, UG",
  customs: "Malaba border post",
  delivered: "Mombasa, KE",
};

export const generateEvent = (parcelId: string, type: EventType, now = new Date()) => ({
  parcelId,
  kind: "event",
  type,
  location: EVENT_LOCATIONS[type],
  recordedAt: now.toISOString(),
});

// The record is stringified exactly once. These bytes are hashed, anchored and written; nothing re-serializes them.
export const serializeRecord = (record: object) => Buffer.from(`${JSON.stringify(record, null, 2)}\n`, "utf8");

const buildAnchor = async (parcelId: string, kind: Anchor["kind"], bytes: Uint8Array): Promise<Anchor> => ({
  v: 1,
  parcelId,
  kind,
  hash: await hashBytes(bytes),
});

const chooseFileName = (parcelId: string, kind: Anchor["kind"], dataDir?: string) => {
  if (kind === "parcel") {
    return PARCEL_FILE;
  }
  if (!recordExists(parcelId, PARCEL_FILE, dataDir)) {
    throw new Error(`Parcel "${parcelId}" has no anchored parcel record yet; submit the parcel before its events`);
  }
  return nextEventFileName(parcelId, dataDir);
};

// Ledger first, file second: the file is written only after its anchor reached consensus, so every file on disk
// has an anchor behind it. If publishing fails, nothing is written. The target is checked first so a member never
// pays for an anchor whose file could not then be written.
export const anchorRecord = async (
  publish: Publish,
  parcelId: string,
  kind: Anchor["kind"],
  bytes: Uint8Array,
  dataDir?: string,
) => {
  const fileName = chooseFileName(parcelId, kind, dataDir);
  if (recordExists(parcelId, fileName, dataDir)) {
    throw new Error(`Record ${parcelId}/${fileName} already exists; a parcel is registered once`);
  }
  const anchor = await buildAnchor(parcelId, kind, bytes);
  const transactionId = await publish(JSON.stringify(anchor));
  const filePath = writeRecord(parcelId, fileName, bytes, dataDir);
  return { anchor, filePath, transactionId };
};

// max_custom_fee: the submission fails rather than charge more than maxFee Freight, even if the committee raised the
// fee between signing and execution. Extra signers are committee keys, whose signature makes the message fee-exempt.
export const publishToTopic =
  (client: Client, topicId: TopicId, tokenId: TokenId, maxFee: number, signers: PrivateKey[] = []): Publish =>
  async message => {
    const payerId = client.operatorAccountId;
    if (!payerId) {
      throw new Error("The client has no operator set to pay for the submission");
    }
    const limit = new CustomFeeLimit()
      .setAccountId(payerId)
      .setFees([new CustomFixedFee().setDenominatingTokenId(tokenId).setAmount(maxFee)]);
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(message)
      .setCustomFeeLimits([limit])
      .freezeWith(client);
    await signWith(transaction, signers);
    const { transactionId } = await executeTransaction(client, transaction, `Anchoring on topic ${topicId}`);
    return transactionId;
  };

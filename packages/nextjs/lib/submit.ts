import { Client, PrivateKey, TokenId, TopicId } from "@hiero-ledger/sdk";
import { buildAnchor, buildAnchorTransaction } from "~~/lib/anchor";
import { executeTransaction, signWith } from "~~/lib/client";
import { PARCEL_FILE, nextEventFileName, recordExists, writeRecord } from "~~/lib/store";
import { Anchor } from "~~/lib/types";

// Sends one anchor, resolving with its transaction id once it has reached consensus.
type Publish = (anchor: Anchor) => Promise<string>;

// Where a new record goes, refusing up front what could never be written, so nobody pays for a stranded anchor.
export const chooseFileName = (parcelId: string, kind: Anchor["kind"], dataDir?: string) => {
  if (kind === "parcel" && recordExists(parcelId, PARCEL_FILE, dataDir)) {
    throw new Error(`Record ${parcelId}/${PARCEL_FILE} already exists; a parcel is registered once`);
  }
  if (kind === "parcel") {
    return PARCEL_FILE;
  }
  if (!recordExists(parcelId, PARCEL_FILE, dataDir)) {
    throw new Error(`Parcel "${parcelId}" has no anchored parcel record yet; submit the parcel before its events`);
  }
  return nextEventFileName(parcelId, dataDir);
};

// Ledger first, file second: the file is written only after its anchor reached consensus, so every file on disk
// has an anchor behind it. If publishing fails, nothing is written.
export const anchorRecord = async (
  publish: Publish,
  parcelId: string,
  kind: Anchor["kind"],
  bytes: Uint8Array,
  dataDir?: string,
) => {
  const fileName = chooseFileName(parcelId, kind, dataDir);
  const anchor = await buildAnchor(parcelId, kind, bytes);
  const transactionId = await publish(anchor);
  const filePath = writeRecord(parcelId, fileName, bytes, dataDir);
  return { anchor, filePath, transactionId };
};

// Extra signers are committee keys, whose signature makes the message fee-exempt.
export const publishToTopic =
  (client: Client, topicId: TopicId, tokenId: TokenId, maxFee: number, signers: PrivateKey[] = []): Publish =>
  async anchor => {
    const payerId = client.operatorAccountId;
    if (!payerId) {
      throw new Error("The client has no operator set to pay for the submission");
    }
    const transaction = buildAnchorTransaction(topicId, tokenId, payerId, maxFee, anchor).freezeWith(client);
    await signWith(transaction, signers);
    const { transactionId } = await executeTransaction(client, transaction, `Anchoring on topic ${topicId}`);
    return transactionId;
  };

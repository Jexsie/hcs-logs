import { AccountId, TokenId, TopicId, Transaction } from "@hiero-ledger/sdk";
import { buildAnchor, buildAnchorTransaction } from "~~/lib/anchor";
import { Anchor } from "~~/lib/types";
import { fetchParcelRecords } from "~~/utils/parcelRecords";
import { parcelHistory } from "~~/utils/recordDetails";

type SubmitStep = "checking" | "approving" | "saving";

// The draft's own parcel ID and kind. The text itself is what gets hashed and saved, exactly as typed.
export const readDraft = (text: string) => {
  let draft: unknown;
  try {
    draft = JSON.parse(text);
  } catch {
    throw new Error("The record is not valid JSON");
  }
  const { kind, parcelId } = (typeof draft === "object" && draft !== null ? draft : {}) as Record<string, unknown>;
  if (kind !== "parcel" && kind !== "event") {
    throw new Error('The record needs "kind" set to "parcel" or "event"');
  }
  if (typeof parcelId !== "string" || !parcelId) {
    throw new Error('The record needs a "parcelId"');
  }
  return { kind: kind as Anchor["kind"], parcelId };
};

// Catches what the server would refuse before the member approves, and pays for, a submission it cannot save.
const checkParcel = async (parcelId: string, kind: Anchor["kind"]) => {
  const { parcel } = parcelHistory(await fetchParcelRecords(parcelId));
  if (kind === "parcel" && parcel) {
    throw new Error(`${parcelId} is already registered`);
  }
  if (kind === "event" && !parcel) {
    throw new Error(`${parcelId} is not registered yet; add the parcel first`);
  }
};

const saveRecord = async (parcelId: string, record: string, transactionId: string) => {
  const response = await fetch(`/api/parcels/${encodeURIComponent(parcelId)}/records`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record, transactionId }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? `Saving the record failed with HTTP ${response.status}`);
  }
  return body as { fileName: string; consensusTimestamp: string };
};

// Ledger first: the wallet anchors the record's hash with a max_custom_fee cap, and only then does the server save the
// record, after confirming that anchor on the network.
export const submitRecord = async ({
  text,
  maxFee,
  accountId,
  topicId,
  tokenId,
  signAndExecute,
  onStep,
}: {
  text: string;
  maxFee: number;
  accountId: string;
  topicId: string;
  tokenId: string;
  signAndExecute: (transaction: Transaction) => Promise<string>;
  onStep: (step: SubmitStep) => void;
}) => {
  const { kind, parcelId } = readDraft(text);
  onStep("checking");
  await checkParcel(parcelId, kind);
  const anchor = await buildAnchor(parcelId, kind, new TextEncoder().encode(text));
  const transaction = buildAnchorTransaction(
    TopicId.fromString(topicId),
    TokenId.fromString(tokenId),
    AccountId.fromString(accountId),
    maxFee,
    anchor,
  );
  onStep("approving");
  const transactionId = await signAndExecute(transaction);
  onStep("saving");
  const saved = await saveRecord(parcelId, text, transactionId);
  return { parcelId, kind, transactionId, ...saved };
};

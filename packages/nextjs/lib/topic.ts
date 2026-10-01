import {
  AccountId,
  Client,
  CustomFixedFee,
  Key,
  KeyList,
  PrivateKey,
  PublicKey,
  TokenId,
  TopicCreateTransaction,
  TopicId,
  TopicInfoQuery,
  TopicUpdateTransaction,
} from "@hiero-ledger/sdk";
import { executeTransaction, signWith } from "~~/lib/client";

// What a member pays per submission: one Freight-denominated fee to each collector.
type FeeSchedule = {
  tokenId: TokenId;
  treasuryId: AccountId;
  treasuryFee: number;
  infraId: AccountId;
  infraFee: number;
};

const TOPIC_MEMO = "Indiana Group cargo records";

const freightFee = (tokenId: TokenId, collectorId: AccountId, amount: number) =>
  new CustomFixedFee().setDenominatingTokenId(tokenId).setAmount(amount).setFeeCollectorAccountId(collectorId);

export const buildCustomFees = ({ tokenId, treasuryId, treasuryFee, infraId, infraFee }: FeeSchedule) => [
  freightFee(tokenId, treasuryId, treasuryFee),
  freightFee(tokenId, infraId, infraFee),
];

// The topic's admin key and fee schedule key. Either kind of change needs `threshold` of the representatives, so one
// representative, or the treasury, acting alone is rejected by the network.
export const committeeKey = (committee: PublicKey[], threshold: number) => new KeyList(committee, threshold);

// HIP-991 exempts a message only when an exempt key's threshold is met. A 1-of-4 threshold lets any single
// representative submit for free, while the list still holds the committee as one key.
export const feeExemptKey = (committee: PublicKey[]) => new KeyList(committee, 1);

// The network requires the admin key to sign the creation, so a threshold of the committee signs it.
export const createRecordsTopic = async (
  client: Client,
  committee: PublicKey[],
  threshold: number,
  fees: FeeSchedule,
  signers: PrivateKey[],
) => {
  const transaction = new TopicCreateTransaction()
    .setTopicMemo(TOPIC_MEMO)
    .setAdminKey(committeeKey(committee, threshold))
    .setFeeScheduleKey(committeeKey(committee, threshold))
    .setFeeExemptKeys([feeExemptKey(committee)])
    .setCustomFees(buildCustomFees(fees))
    .freezeWith(client);
  await signWith(transaction, signers);
  const { receipt, transactionId } = await executeTransaction(client, transaction, "Creating the records topic");
  if (!receipt.topicId) {
    throw new Error("Creating the records topic returned no topic id");
  }
  return { topicId: receipt.topicId, transactionId };
};

// A fees-only update needs just the fee schedule key; setting any other field would also need the admin key.
export const updateFees = async (client: Client, topicId: TopicId, fees: FeeSchedule, signers: PrivateKey[]) => {
  const transaction = new TopicUpdateTransaction()
    .setTopicId(topicId)
    .setCustomFees(buildCustomFees(fees))
    .freezeWith(client);
  await signWith(transaction, signers);
  const signed = `${signers.length} committee signature${signers.length === 1 ? "" : "s"}`;
  const { transactionId } = await executeTransaction(
    client,
    transaction,
    `Updating the fees on ${topicId} with ${signed}`,
  );
  return transactionId;
};

export const getTopicInfo = (client: Client, topicId: TopicId) =>
  new TopicInfoQuery().setTopicId(topicId).execute(client);

const sameKey = (actual: Key | null | undefined, expected: Key) => actual?.toString() === expected.toString();

const hasFee = (actual: CustomFixedFee[], expected: CustomFixedFee) =>
  actual.some(
    fee =>
      fee.amount?.toString() === expected.amount?.toString() &&
      fee.denominatingTokenId?.toString() === expected.denominatingTokenId?.toString() &&
      fee.feeCollectorAccountId?.toString() === expected.feeCollectorAccountId?.toString(),
  );

// Compares what the network reports against what was requested, one line per HIP-991 setting.
export const checkTopicConfig = async (
  client: Client,
  topicId: TopicId,
  committee: PublicKey[],
  threshold: number,
  fees: FeeSchedule,
) => {
  const info = await getTopicInfo(client, topicId);
  const customFees = info.customFees ?? [];
  const [treasuryFee, infraFee] = buildCustomFees(fees);
  const governance = committeeKey(committee, threshold);

  return [
    {
      setting: `Fee of ${fees.treasuryFee} Freight to treasury ${fees.treasuryId}`,
      ok: hasFee(customFees, treasuryFee),
    },
    { setting: `Fee of ${fees.infraFee} Freight to infrastructure ${fees.infraId}`, ok: hasFee(customFees, infraFee) },
    { setting: "Exactly two fee collectors", ok: customFees.length === 2 },
    { setting: "Committee 1-of-4 key is fee-exempt", ok: sameKey(info.feeExemptKeys?.[0], feeExemptKey(committee)) },
    { setting: `Fee schedule key is a ${threshold}-of-4 committee key`, ok: sameKey(info.feeScheduleKey, governance) },
    { setting: `Admin key is a ${threshold}-of-4 committee key`, ok: sameKey(info.adminKey, governance) },
  ];
};

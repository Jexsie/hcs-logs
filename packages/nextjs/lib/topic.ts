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
import { executeTransaction } from "~~/lib/client";

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

// Changing the fee needs `threshold` of the representatives; one acting alone is rejected by the network.
export const feeScheduleKey = (committee: PublicKey[], threshold: number) => new KeyList(committee, threshold);

// HIP-991 exempts a message only when an exempt key's threshold is met. A 1-of-4 threshold lets any single
// representative submit for free, while the list still holds the committee as one key.
export const feeExemptKey = (committee: PublicKey[]) => new KeyList(committee, 1);

// No admin key: the topic's keys and collectors are fixed at creation, and only the committee can change fees.
export const createRecordsTopic = async (
  client: Client,
  committee: PublicKey[],
  threshold: number,
  fees: FeeSchedule,
) => {
  const transaction = new TopicCreateTransaction()
    .setTopicMemo(TOPIC_MEMO)
    .setFeeScheduleKey(feeScheduleKey(committee, threshold))
    .setFeeExemptKeys([feeExemptKey(committee)])
    .setCustomFees(buildCustomFees(fees));
  const { topicId } = await executeTransaction(client, transaction, "Creating the records topic");
  if (!topicId) {
    throw new Error("Creating the records topic returned no topic id");
  }
  return topicId;
};

export const updateFees = async (client: Client, topicId: TopicId, fees: FeeSchedule, signers: PrivateKey[]) => {
  const transaction = new TopicUpdateTransaction()
    .setTopicId(topicId)
    .setCustomFees(buildCustomFees(fees))
    .freezeWith(client);
  for (const signer of signers) {
    await transaction.sign(signer);
  }
  const signed = `${signers.length} committee signature${signers.length === 1 ? "" : "s"}`;
  await executeTransaction(client, transaction, `Updating the fees on ${topicId} with ${signed}`);
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

  return [
    {
      setting: `Fee of ${fees.treasuryFee} Freight to treasury ${fees.treasuryId}`,
      ok: hasFee(customFees, treasuryFee),
    },
    { setting: `Fee of ${fees.infraFee} Freight to infrastructure ${fees.infraId}`, ok: hasFee(customFees, infraFee) },
    { setting: "Exactly two fee collectors", ok: customFees.length === 2 },
    { setting: "Committee 1-of-4 key is fee-exempt", ok: sameKey(info.feeExemptKeys?.[0], feeExemptKey(committee)) },
    {
      setting: `Fee schedule key is a ${threshold}-of-4 committee key`,
      ok: sameKey(info.feeScheduleKey, feeScheduleKey(committee, threshold)),
    },
    { setting: "No admin key", ok: info.adminKey === null },
  ];
};

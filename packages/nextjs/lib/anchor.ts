import {
  AccountId,
  CustomFeeLimit,
  CustomFixedFee,
  TokenId,
  TopicId,
  TopicMessageSubmitTransaction,
} from "@hiero-ledger/sdk";
import { hashBytes } from "~~/lib/hash";
import { Anchor } from "~~/lib/types";

// Shared by the CLI and the member portal's wallet signing, so it uses the SDK but no Node APIs.

export const buildAnchor = async (parcelId: string, kind: Anchor["kind"], bytes: Uint8Array): Promise<Anchor> => ({
  v: 1,
  parcelId,
  kind,
  hash: await hashBytes(bytes),
});

export const sameAnchor = (a: Anchor, b: Anchor) =>
  a.v === b.v && a.parcelId === b.parcelId && a.kind === b.kind && a.hash === b.hash;

// max_custom_fee: the submission fails rather than charge the payer more than maxFee Freight, even if the committee
// raised the fee between signing and execution.
export const buildAnchorTransaction = (
  topicId: TopicId,
  tokenId: TokenId,
  payerId: AccountId,
  maxFee: number,
  anchor: Anchor,
) =>
  new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(anchor))
    .setCustomFeeLimits([
      new CustomFeeLimit()
        .setAccountId(payerId)
        .setFees([new CustomFixedFee().setDenominatingTokenId(tokenId).setAmount(maxFee)]),
    ]);

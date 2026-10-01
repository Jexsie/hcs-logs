import {
  AccountId,
  Client,
  PrivateKey,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenId,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  TransferTransaction,
} from "@hiero-ledger/sdk";
import { executeTransaction } from "~~/lib/client";

// Whole tokens only: a submission fee is a count of Freight, never a fraction.
const FREIGHT_DECIMALS = 0;

const requireOperator = (client: Client) => {
  const accountId = client.operatorAccountId;
  const publicKey = client.operatorPublicKey;
  if (!accountId || !publicKey) {
    throw new Error("The client has no operator set; the operator is the association treasury");
  }
  return { accountId, publicKey };
};

// The operator is the association treasury: it holds the supply, and its key administers and mints Freight.
export const createFreightToken = async (client: Client, initialSupply: number) => {
  const treasury = requireOperator(client);
  const transaction = new TokenCreateTransaction()
    .setTokenName("Freight")
    .setTokenSymbol("FRT")
    .setDecimals(FREIGHT_DECIMALS)
    .setInitialSupply(initialSupply)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(treasury.accountId)
    .setAdminKey(treasury.publicKey)
    .setSupplyKey(treasury.publicKey);
  const { tokenId } = await executeTransaction(client, transaction, "Creating the Freight token");
  if (!tokenId) {
    throw new Error("Creating the Freight token returned no token id");
  }
  return tokenId;
};

export const mintFreight = async (client: Client, tokenId: TokenId, amount: number) => {
  const transaction = new TokenMintTransaction().setTokenId(tokenId).setAmount(amount);
  const { totalSupply } = await executeTransaction(client, transaction, `Minting ${amount} Freight`);
  return totalSupply;
};

// An account must associate with Freight before it can hold it, and only the account's own key can do that.
export const associateFreight = async (
  client: Client,
  tokenId: TokenId,
  accountId: AccountId,
  accountKey: PrivateKey,
) => {
  const transaction = new TokenAssociateTransaction().setAccountId(accountId).setTokenIds([tokenId]).freezeWith(client);
  await transaction.sign(accountKey);
  await executeTransaction(client, transaction, `Associating ${accountId} with Freight ${tokenId}`);
};

// Moves Freight out of the treasury, which is how a member company buys it.
export const sendFreight = async (client: Client, tokenId: TokenId, recipientId: AccountId, amount: number) => {
  const treasury = requireOperator(client);
  const transaction = new TransferTransaction()
    .addTokenTransfer(tokenId, treasury.accountId, -amount)
    .addTokenTransfer(tokenId, recipientId, amount);
  await executeTransaction(client, transaction, `Sending ${amount} Freight to ${recipientId}`);
};

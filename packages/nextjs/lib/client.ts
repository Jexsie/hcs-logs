import {
  AccountCreateTransaction,
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  TokenId,
  TopicId,
  Transaction,
} from "@hiero-ledger/sdk";
import { config } from "dotenv";
import * as path from "path";
import { Env, readEnv, readNetwork } from "~~/lib/network";

const requireEnv = (env: Env, name: string) => {
  const value = readEnv(env, name);
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  }
  return value;
};

const parseAccountId = (text: string, label: string) => {
  try {
    return AccountId.fromString(text);
  } catch {
    throw new Error(`${label} is not a valid account id: "${text}"`);
  }
};

/**
 * Accepts DER keys of either type, or 0x-prefixed ECDSA hex as the Hedera Portal shows it. Unprefixed raw hex is
 * rejected because it does not say which key type it is. The error never includes the key itself.
 */
export const parsePrivateKey = (text: string, label: string) => {
  try {
    return text.startsWith("0x") ? PrivateKey.fromStringECDSA(text) : PrivateKey.fromStringDer(text);
  } catch {
    throw new Error(`${label} is not a valid private key. Use DER, or 0x-prefixed hex for ECDSA.`);
  }
};

// Scripts run from packages/nextjs, but the template keeps .env at the repository root.
export const ENV_FILE = path.resolve(__dirname, "../../../.env");

// A missing .env is fine: CI and shells can supply the variables directly. Any other read failure is not.
// Variables already set in the environment win over the file.
export const loadEnvFile = (file = ENV_FILE, target: Env = process.env) => {
  const { error } = config({ path: file, processEnv: target, quiet: true });
  if (error && (error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw new Error(`Could not read ${file}: ${error.message}`);
  }
};

// Reads <PREFIX>_ID and <PREFIX>_KEY, e.g. OPERATOR_ID and OPERATOR_KEY.
export const readAccount = (prefix: string, env: Env = process.env) => ({
  accountId: parseAccountId(requireEnv(env, `${prefix}_ID`), `${prefix}_ID`),
  privateKey: parsePrivateKey(requireEnv(env, `${prefix}_KEY`), `${prefix}_KEY`),
});

export const readOperator = (env: Env = process.env) => readAccount("OPERATOR", env);

// The association's member companies in this demo. Each reads MEMBER_<SLUG>_ID and MEMBER_<SLUG>_KEY.
export const MEMBERS = {
  lakeside: "Lakeside Haulage",
  nile: "Nile Cargo Services",
  rift: "Rift Valley Logistics",
};

export type MemberSlug = keyof typeof MEMBERS;

export const MEMBER_SLUGS = Object.keys(MEMBERS) as MemberSlug[];

export const isMemberSlug = (value: string): value is MemberSlug => Object.hasOwn(MEMBERS, value);

export const memberPrefix = (slug: MemberSlug) => `MEMBER_${slug.toUpperCase()}`;

export const readMember = (slug: MemberSlug, env: Env = process.env) => ({
  slug,
  name: MEMBERS[slug],
  ...readAccount(memberPrefix(slug), env),
});

const readAccountId = (name: string, env: Env = process.env) => parseAccountId(requireEnv(env, name), name);

export const parseWholeNumber = (text: string, label: string) => {
  const value = Number(text);
  if (!text || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a whole number, got "${text}"`);
  }
  return value;
};

export const readWholeNumber = (name: string, fallback: number, env: Env = process.env) => {
  const text = readEnv(env, name);
  return text === undefined ? fallback : parseWholeNumber(text, name);
};

export const readTokenId = (env: Env = process.env) => {
  const text = requireEnv(env, "FREIGHT_TOKEN_ID");
  try {
    return TokenId.fromString(text);
  } catch {
    throw new Error(`FREIGHT_TOKEN_ID is not a valid token id: "${text}"`);
  }
};

export const readTopicId = (env: Env = process.env) => {
  const text = requireEnv(env, "TOPIC_ID");
  try {
    return TopicId.fromString(text);
  } catch {
    throw new Error(`TOPIC_ID is not a valid topic id: "${text}"`);
  }
};

// The treasury is the operator; each collector's share comes from TREASURY_FEE and INFRA_FEE.
export const readFeeSchedule = (env: Env = process.env) => ({
  tokenId: readTokenId(env),
  treasuryId: readAccountId("OPERATOR_ID", env),
  treasuryFee: readWholeNumber("TREASURY_FEE", 2, env),
  infraId: readAccountId("INFRA_ID", env),
  infraFee: readWholeNumber("INFRA_FEE", 1, env),
});

const COMMITTEE_SIZE = 4;

// Locally all four keys sit in one .env for testing. In production each representative holds only their own.
export const readCommitteeKeys = (env: Env = process.env) => {
  const keys = requireEnv(env, "COMMITTEE_KEYS")
    .split(",")
    .map((text, index) => parsePrivateKey(text.trim(), `COMMITTEE_KEYS entry ${index + 1}`));
  if (keys.length !== COMMITTEE_SIZE) {
    throw new Error(`COMMITTEE_KEYS must hold ${COMMITTEE_SIZE} comma-separated keys, got ${keys.length}`);
  }
  return keys;
};

// A threshold of 1 would let one representative change the fee alone, which is exactly what the committee prevents.
export const readCommitteeThreshold = (env: Env = process.env) => {
  const threshold = readWholeNumber("COMMITTEE_THRESHOLD", 3, env);
  if (threshold < 2 || threshold > COMMITTEE_SIZE) {
    throw new Error(`COMMITTEE_THRESHOLD must be between 2 and ${COMMITTEE_SIZE}, got ${threshold}`);
  }
  return threshold;
};

// The caller owns the client and must close it. The account pays for, and signs, every transaction it executes.
export const createClient = (account = readOperator(), network = readNetwork()) =>
  Client.forName(network).setOperator(account.accountId, account.privateKey);

// Adds each signature to a frozen transaction, e.g. a threshold of committee keys.
export const signWith = async <T extends Transaction>(transaction: T, signers: PrivateKey[]) => {
  for (const signer of signers) {
    await transaction.sign(signer);
  }
  return transaction;
};

// Waits for consensus and returns the receipt with the transaction id, so callers can point at it on HashScan.
export const executeTransaction = async (client: Client, transaction: Transaction, action: string) => {
  try {
    const response = await transaction.execute(client);
    return { receipt: await response.getReceipt(client), transactionId: response.transactionId.toString() };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${action} failed (transaction ${transaction.transactionId ?? "not frozen"}): ${reason}`);
  }
};

// For local testing: the client's operator funds a new account controlled by `key`.
export const createAccount = async (client: Client, key: PrivateKey, initialHbar: number) => {
  const transaction = new AccountCreateTransaction()
    .setKeyWithoutAlias(key.publicKey)
    .setInitialBalance(new Hbar(initialHbar));
  const { accountId } = (await executeTransaction(client, transaction, "Creating an account")).receipt;
  if (!accountId) {
    throw new Error("Creating an account returned no account id");
  }
  return accountId;
};

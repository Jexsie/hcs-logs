import { AccountId, Client, PrivateKey, Transaction } from "@hiero-ledger/sdk";
import { config } from "dotenv";
import * as path from "path";

const MIRROR_URLS = {
  testnet: "https://testnet.mirrornode.hedera.com",
  mainnet: "https://mainnet.mirrornode.hedera.com",
  previewnet: "https://previewnet.mirrornode.hedera.com",
};

export type HederaNetwork = keyof typeof MIRROR_URLS;

// Not NodeJS.ProcessEnv: Next.js makes NODE_ENV required on it, which callers and tests should not have to supply.
type Env = Record<string, string | undefined>;

const isHederaNetwork = (value: string): value is HederaNetwork => Object.hasOwn(MIRROR_URLS, value);

// Blank values copied from .env.example count as unset.
const readEnv = (env: Env, name: string) => env[name]?.trim() || undefined;

const requireEnv = (env: Env, name: string) => {
  const value = readEnv(env, name);
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  }
  return value;
};

export const readNetwork = (env: Env = process.env) => {
  const network = readEnv(env, "HEDERA_NETWORK") ?? "testnet";
  if (!isHederaNetwork(network)) {
    throw new Error(`HEDERA_NETWORK must be one of ${Object.keys(MIRROR_URLS).join(", ")}, got "${network}"`);
  }
  return network;
};

export const readMirrorUrl = (network: HederaNetwork, env: Env = process.env) => {
  const url = readEnv(env, "MIRROR_NODE_URL") ?? MIRROR_URLS[network];
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

export const parseAccountId = (text: string, label: string) => {
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
export const loadEnvFile = () => config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

// Reads <PREFIX>_ID and <PREFIX>_KEY, e.g. OPERATOR_ID and OPERATOR_KEY.
export const readAccount = (prefix: string, env: Env = process.env) => ({
  accountId: parseAccountId(requireEnv(env, `${prefix}_ID`), `${prefix}_ID`),
  privateKey: parsePrivateKey(requireEnv(env, `${prefix}_KEY`), `${prefix}_KEY`),
});

export const readOperator = (env: Env = process.env) => readAccount("OPERATOR", env);

// The caller owns the client and must close it.
export const createClient = (env: Env = process.env) => {
  const { accountId, privateKey } = readOperator(env);
  return Client.forName(readNetwork(env)).setOperator(accountId, privateKey);
};

export const executeTransaction = async (client: Client, transaction: Transaction, action: string) => {
  try {
    const response = await transaction.execute(client);
    return await response.getReceipt(client);
  } catch (error) {
    throw new Error(`${action} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Network and mirror node settings. No SDK import, so the verification page can use this in the browser.
const MIRROR_URLS = {
  testnet: "https://testnet.mirrornode.hedera.com",
  mainnet: "https://mainnet.mirrornode.hedera.com",
  previewnet: "https://previewnet.mirrornode.hedera.com",
};

export type HederaNetwork = keyof typeof MIRROR_URLS;

// Not NodeJS.ProcessEnv: Next.js makes NODE_ENV required on it, which callers and tests should not have to supply.
export type Env = Record<string, string | undefined>;

const isHederaNetwork = (value: string): value is HederaNetwork => Object.hasOwn(MIRROR_URLS, value);

// Blank values copied from .env.example count as unset.
export const readEnv = (env: Env, name: string) => env[name]?.trim() || undefined;

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

// HashScan finds a transaction by its consensus timestamp.
export const hashscanTransactionUrl = (network: HederaNetwork, consensusTimestamp: string) =>
  `https://hashscan.io/${network}/transaction/${consensusTimestamp}`;

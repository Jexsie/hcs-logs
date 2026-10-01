import { readMirrorUrl, readNetwork } from "~~/lib/network";

// Inlined at build time by next.config.ts. Each value is referenced literally so Next.js can replace it. These are
// public identifiers only; no key ever reaches the browser.
const PUBLIC_ENV = {
  HEDERA_NETWORK: process.env.HEDERA_NETWORK,
  MIRROR_NODE_URL: process.env.MIRROR_NODE_URL,
  TOPIC_ID: process.env.TOPIC_ID,
  FREIGHT_TOKEN_ID: process.env.FREIGHT_TOKEN_ID,
  WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID,
};

const present = (value?: string) => value?.trim() || undefined;

export const readPublicConfig = () => {
  const network = readNetwork(PUBLIC_ENV);
  return {
    network,
    mirrorUrl: readMirrorUrl(network, PUBLIC_ENV),
    topicId: present(PUBLIC_ENV.TOPIC_ID),
    tokenId: present(PUBLIC_ENV.FREIGHT_TOKEN_ID),
    walletConnectProjectId: present(PUBLIC_ENV.WALLETCONNECT_PROJECT_ID),
  };
};

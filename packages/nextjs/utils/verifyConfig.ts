import { readMirrorUrl, readNetwork } from "~~/lib/network";

// Inlined at build time by next.config.ts. Each value is referenced literally so Next.js can replace it.
const PUBLIC_ENV = {
  HEDERA_NETWORK: process.env.HEDERA_NETWORK,
  MIRROR_NODE_URL: process.env.MIRROR_NODE_URL,
  TOPIC_ID: process.env.TOPIC_ID,
};

export const readVerifyConfig = () => {
  const network = readNetwork(PUBLIC_ENV);
  return { network, mirrorUrl: readMirrorUrl(network, PUBLIC_ENV), topicId: PUBLIC_ENV.TOPIC_ID?.trim() || undefined };
};

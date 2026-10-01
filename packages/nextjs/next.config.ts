import { config } from "dotenv";
import type { NextConfig } from "next";
import path from "path";

// The pages read which network, topic and token to use from the repository-root .env. Only these public identifiers
// are inlined into the browser bundle; no key is ever exposed.
config({ path: path.join(__dirname, "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  reactStrictMode: true,
  devIndicators: false,
  env: {
    HEDERA_NETWORK: process.env.HEDERA_NETWORK ?? "",
    MIRROR_NODE_URL: process.env.MIRROR_NODE_URL ?? "",
    TOPIC_ID: process.env.TOPIC_ID ?? "",
    FREIGHT_TOKEN_ID: process.env.FREIGHT_TOKEN_ID ?? "",
    WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID ?? "",
  },
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  eslint: {
    dirs: ["app", "components", "hooks", "lib", "scripts", "test", "utils"],
    ignoreDuringBuilds: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  webpack: (config, { dev }) => {
    // WalletConnect's dependencies reference these optional Node packages; the browser never needs them.
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    if (dev) {
      config.watchOptions = {
        followSymlinks: true,
      };
      config.snapshot = { ...(config.snapshot as object), managedPaths: [] };
    }
    return config;
  },
};

module.exports = nextConfig;

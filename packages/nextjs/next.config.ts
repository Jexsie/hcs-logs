import { config } from "dotenv";
import type { NextConfig } from "next";
import path from "path";

// The verification page reads which network and topic to check from the repository-root .env. Only these three public
// values are inlined into the page; no key or account id is ever exposed to the browser.
config({ path: path.join(__dirname, "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  reactStrictMode: true,
  devIndicators: false,
  env: {
    HEDERA_NETWORK: process.env.HEDERA_NETWORK ?? "",
    MIRROR_NODE_URL: process.env.MIRROR_NODE_URL ?? "",
    TOPIC_ID: process.env.TOPIC_ID ?? "",
  },
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  eslint: {
    dirs: ["app", "components", "hooks", "lib", "scripts", "test", "utils"],
    ignoreDuringBuilds: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  webpack: (config, { dev }) => {
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

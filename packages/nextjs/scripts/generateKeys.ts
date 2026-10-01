import { PrivateKey } from "@hiero-ledger/sdk";
import { parseArgs } from "util";
import { createAccount, createClient, loadEnvFile } from "~~/lib/client";

const MEMBER_HBAR = 10;
const INFRA_HBAR = 1;

// Throwaway keys for local testing only. Never reuse them for real funds.
async function main() {
  loadEnvFile();
  const { values } = parseArgs({ options: { "create-accounts": { type: "boolean", default: false } } });
  const committee = Array.from({ length: 4 }, () => PrivateKey.generateECDSA());
  const infraKey = PrivateKey.generateECDSA();
  const memberKey = PrivateKey.generateECDSA();

  console.log("# Paste into .env. Throwaway keys for local testing only.\n");
  console.log(`COMMITTEE_KEYS=${committee.map(key => key.toStringDer()).join(",")}`);
  console.log(`INFRA_KEY=${infraKey.toStringDer()}`);
  console.log(`MEMBER_KEY=${memberKey.toStringDer()}`);

  if (!values["create-accounts"]) {
    console.log("\n# Run with -- --create-accounts to have the operator create INFRA_ID and MEMBER_ID for these keys.");
    return;
  }

  const client = createClient();
  try {
    console.log(`INFRA_ID=${await createAccount(client, infraKey, INFRA_HBAR)}`);
    console.log(`MEMBER_ID=${await createAccount(client, memberKey, MEMBER_HBAR)}`);
  } finally {
    client.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

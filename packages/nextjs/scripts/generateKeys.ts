import { PrivateKey } from "@hiero-ledger/sdk";
import { parseArgs } from "util";
import { MEMBERS, MEMBER_SLUGS, createAccount, createClient, loadEnvFile, memberPrefix } from "~~/lib/client";

const MEMBER_HBAR = 10;
const INFRA_HBAR = 1;

// Throwaway keys for local testing only. Never reuse them for real funds.
async function main() {
  loadEnvFile();
  const { values } = parseArgs({ options: { "create-accounts": { type: "boolean", default: false } } });
  const committee = Array.from({ length: 4 }, () => PrivateKey.generateECDSA());
  const infraKey = PrivateKey.generateECDSA();
  const members = MEMBER_SLUGS.map(slug => ({ slug, prefix: memberPrefix(slug), key: PrivateKey.generateECDSA() }));

  console.log("# Paste into .env. Throwaway keys for local testing only.\n");
  console.log(`COMMITTEE_KEYS=${committee.map(key => key.toStringDer()).join(",")}`);
  console.log(`INFRA_KEY=${infraKey.toStringDer()}`);
  members.forEach(({ slug, prefix, key }) => console.log(`# ${MEMBERS[slug]}\n${prefix}_KEY=${key.toStringDer()}`));

  if (!values["create-accounts"]) {
    console.log(
      "\n# Run with -- --create-accounts to have the operator create the infrastructure and member accounts.",
    );
    return;
  }

  const client = createClient();
  try {
    console.log(`INFRA_ID=${await createAccount(client, infraKey, INFRA_HBAR)}`);
    for (const { prefix, key } of members) {
      console.log(`${prefix}_ID=${await createAccount(client, key, MEMBER_HBAR)}`);
    }
  } finally {
    client.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

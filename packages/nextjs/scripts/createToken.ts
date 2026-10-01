import { createClient, loadEnvFile, readAccount } from "~~/lib/client";
import { associateFreight, createFreightToken, sendFreight } from "~~/lib/token";

const INITIAL_SUPPLY = 1_000_000;
const MEMBER_PURCHASE = 100;

async function main() {
  loadEnvFile();
  const infra = readAccount("INFRA");
  const member = readAccount("MEMBER");
  const client = createClient();

  try {
    const tokenId = await createFreightToken(client, INITIAL_SUPPLY);
    console.log(`🪙 Freight token created: ${tokenId}`);

    await associateFreight(client, tokenId, infra.accountId, infra.privateKey);
    console.log(`🔗 Infrastructure operator ${infra.accountId} can now collect Freight`);

    await associateFreight(client, tokenId, member.accountId, member.privateKey);
    await sendFreight(client, tokenId, member.accountId, MEMBER_PURCHASE);
    console.log(`📦 Member ${member.accountId} bought ${MEMBER_PURCHASE} Freight`);

    console.log(`\nSet FREIGHT_TOKEN_ID=${tokenId} in .env`);
  } finally {
    client.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

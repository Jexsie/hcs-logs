import { MEMBER_SLUGS, createClient, loadEnvFile, readAccount, readMember } from "~~/lib/client";
import { associateFreight, createFreightToken, sendFreight } from "~~/lib/token";

const INITIAL_SUPPLY = 1_000_000;
const MEMBER_PURCHASE = 100;

async function main() {
  loadEnvFile();
  const infra = readAccount("INFRA");
  const members = MEMBER_SLUGS.map(slug => readMember(slug));
  const client = createClient();

  try {
    const { tokenId, transactionId } = await createFreightToken(client, INITIAL_SUPPLY);
    console.log(`🪙 Freight token created: ${tokenId} (${transactionId})`);

    const infraAssociation = await associateFreight(client, tokenId, infra.accountId, infra.privateKey);
    console.log(`🔗 Infrastructure operator ${infra.accountId} can now collect Freight (${infraAssociation})`);

    for (const member of members) {
      await associateFreight(client, tokenId, member.accountId, member.privateKey);
      const purchase = await sendFreight(client, tokenId, member.accountId, MEMBER_PURCHASE);
      console.log(`📦 ${member.name} (${member.accountId}) bought ${MEMBER_PURCHASE} Freight (${purchase})`);
    }

    console.log(`\nSet FREIGHT_TOKEN_ID=${tokenId} in .env`);
  } finally {
    client.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

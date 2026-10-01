import { createClient, loadEnvFile, readCommitteeKeys, readCommitteeThreshold, readFeeSchedule } from "~~/lib/client";
import { checkTopicConfig, createRecordsTopic } from "~~/lib/topic";

async function main() {
  loadEnvFile();
  const committeeKeys = readCommitteeKeys();
  const committee = committeeKeys.map(key => key.publicKey);
  const threshold = readCommitteeThreshold();
  const fees = readFeeSchedule();
  const client = createClient();

  try {
    // Locally every committee key is at hand; in production the representatives sign the creation in turn.
    const signers = committeeKeys.slice(0, threshold);
    const { topicId, transactionId } = await createRecordsTopic(client, committee, threshold, fees, signers);
    console.log(`📮 Records topic created: ${topicId} (${transactionId})\n`);

    const checks = await checkTopicConfig(client, topicId, committee, threshold, fees);
    checks.forEach(({ setting, ok }) => console.log(`${ok ? "✅" : "❌"} ${setting}`));
    if (checks.some(({ ok }) => !ok)) {
      throw new Error(`Topic ${topicId} does not match the requested configuration`);
    }

    console.log(`\nSet TOPIC_ID=${topicId} in .env`);
  } finally {
    client.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

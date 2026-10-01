import { parseArgs } from "util";
import {
  createClient,
  loadEnvFile,
  parseWholeNumber,
  readCommitteeKeys,
  readCommitteeThreshold,
  readFeeSchedule,
  readTopicId,
} from "~~/lib/client";
import { updateFees } from "~~/lib/topic";

const USAGE = "Usage: npm run fee:update -- <treasuryFee> <infraFee> [--signers <count>]";

async function main() {
  loadEnvFile();
  const { positionals, values } = parseArgs({ allowPositionals: true, options: { signers: { type: "string" } } });
  if (positionals.length !== 2) {
    throw new Error(USAGE);
  }

  const committee = readCommitteeKeys();
  const signerCount = values.signers ? parseWholeNumber(values.signers, "--signers") : readCommitteeThreshold();
  const fees = {
    ...readFeeSchedule(),
    treasuryFee: parseWholeNumber(positionals[0], "treasuryFee"),
    infraFee: parseWholeNumber(positionals[1], "infraFee"),
  };
  const topicId = readTopicId();
  const client = createClient();

  try {
    await updateFees(client, topicId, fees, committee.slice(0, signerCount));
    console.log(`💸 Fees on ${topicId} are now ${fees.treasuryFee} + ${fees.infraFee} Freight per submission`);
  } finally {
    client.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

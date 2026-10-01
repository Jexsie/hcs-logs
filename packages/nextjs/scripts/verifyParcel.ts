import { loadEnvFile, readTopicId } from "~~/lib/client";
import { fetchAnchors } from "~~/lib/mirror";
import { readMirrorUrl, readNetwork } from "~~/lib/network";
import { readRecords } from "~~/lib/store";
import { compareRecords } from "~~/lib/verify";

// Verification is free: it reads files from disk and anchors from the public mirror node, with no operator account.
async function main() {
  loadEnvFile();
  const [parcelId] = process.argv.slice(2);
  if (!parcelId) {
    throw new Error("Usage: npm run verify -- <parcelId>");
  }
  const records = readRecords(parcelId);
  const anchors = await fetchAnchors(readMirrorUrl(readNetwork()), readTopicId().toString());

  const results = await compareRecords(parcelId, records, anchors);
  results.forEach(({ fileName, status, anchor }) =>
    console.log(
      status === "verified"
        ? `✅ ${fileName} verified, anchored at ${anchor?.consensusTimestamp}`
        : `❌ ${fileName} changed`,
    ),
  );

  const changed = results.filter(({ status }) => status === "changed").length;
  console.log(`\n${parcelId}: ${results.length - changed} verified, ${changed} changed`);
  if (changed > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

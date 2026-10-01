import { loadEnvFile, readMirrorUrl, readNetwork, readTopicId } from "~~/lib/client";
import { verifyParcel } from "~~/lib/verify";

// Verification is free: it reads files from disk and anchors from the public mirror node, with no operator account.
async function main() {
  loadEnvFile();
  const [parcelId] = process.argv.slice(2);
  if (!parcelId) {
    throw new Error("Usage: npm run verify -- <parcelId>");
  }
  const mirrorUrl = readMirrorUrl(readNetwork());
  const topicId = readTopicId().toString();

  const results = await verifyParcel(parcelId, mirrorUrl, topicId);
  results.forEach(({ fileName, status, anchoredAt }) =>
    console.log(
      status === "verified" ? `✅ ${fileName} verified, anchored at ${anchoredAt}` : `❌ ${fileName} changed`,
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

import { parseArgs } from "util";
import {
  createClient,
  loadEnvFile,
  parseWholeNumber,
  readAccount,
  readCommitteeKeys,
  readOperator,
  readTokenId,
  readTopicId,
  readWholeNumber,
} from "~~/lib/client";
import { assertParcelId } from "~~/lib/store";
import {
  EVENT_TYPES,
  EventType,
  anchorRecord,
  generateEvent,
  generateParcel,
  publishToTopic,
  serializeRecord,
} from "~~/lib/submit";
import { Anchor } from "~~/lib/types";

const USAGE = `Usage: npm run submit -- <parcel|event> <parcelId> [--type <${EVENT_TYPES.join("|")}>] [--committee <1-4>]`;

const isEventType = (value: string): value is EventType => EVENT_TYPES.some(type => type === value);

const isKind = (value?: string): value is Anchor["kind"] => value === "parcel" || value === "event";

const readArgs = () => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { type: { type: "string", default: "in-transit" }, committee: { type: "string" } },
  });
  const [kind, parcelId] = positionals;
  if (positionals.length !== 2 || !isKind(kind)) {
    throw new Error(USAGE);
  }
  if (!isEventType(values.type)) {
    throw new Error(`--type must be one of ${EVENT_TYPES.join(", ")}, got "${values.type}"`);
  }
  assertParcelId(parcelId);
  return { kind, parcelId, type: values.type, committee: values.committee };
};

// A member pays the fee from its own account. A representative signs a treasury-paid submission instead: their
// signature satisfies the fee-exempt key, so no custom fee is charged.
const readSubmitter = (committee?: string) => {
  if (committee === undefined) {
    return { account: readAccount("MEMBER"), signers: [], label: "member" };
  }
  const index = parseWholeNumber(committee, "--committee");
  const key = readCommitteeKeys()[index - 1];
  if (!key) {
    throw new Error(`--committee must be between 1 and 4, got ${committee}`);
  }
  return { account: readOperator(), signers: [key], label: `committee representative ${index}` };
};

async function main() {
  loadEnvFile();
  const { kind, parcelId, type, committee } = readArgs();
  const submitter = readSubmitter(committee);
  const topicId = readTopicId();
  const tokenId = readTokenId();
  const maxFee = readWholeNumber("MAX_CUSTOM_FEE", 3);
  const client = createClient(submitter.account);

  try {
    const record = kind === "parcel" ? generateParcel(parcelId) : generateEvent(parcelId, type);
    const publish = publishToTopic(client, topicId, tokenId, maxFee, submitter.signers);
    const { anchor, filePath } = await anchorRecord(publish, parcelId, kind, serializeRecord(record));

    console.log(`⚓ Anchored ${kind} ${parcelId} on ${topicId} as ${submitter.label} (max fee ${maxFee} Freight)`);
    console.log(`   sha256 ${anchor.hash}`);
    console.log(`📄 Written ${filePath}`);
  } finally {
    client.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

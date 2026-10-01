import { parseArgs } from "util";
import {
  MEMBER_SLUGS,
  createClient,
  isMemberSlug,
  loadEnvFile,
  parseWholeNumber,
  readCommitteeKeys,
  readMember,
  readOperator,
  readTokenId,
  readTopicId,
  readWholeNumber,
} from "~~/lib/client";
import { EVENT_TYPES, EventType, generateEvent, generateParcel, nextEventType, serializeRecord } from "~~/lib/records";
import { assertParcelId, parcelExists, readRecords } from "~~/lib/store";
import { anchorRecord, publishToTopic } from "~~/lib/submit";
import { Anchor } from "~~/lib/types";
import { parcelHistory } from "~~/utils/recordDetails";

const USAGE = [
  "Usage: npm run submit -- <parcel|event> <parcelId> (--member <name> | --committee <1-4>) [--type <type>]",
  "  --type defaults to the parcel's next step",
  `  members: ${MEMBER_SLUGS.join(", ")}`,
  `  event types: ${EVENT_TYPES.join(", ")}`,
].join("\n");

const isEventType = (value: string): value is EventType => EVENT_TYPES.some(type => type === value);

const isKind = (value?: string): value is Anchor["kind"] => value === "parcel" || value === "event";

const readArgs = () => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      type: { type: "string" },
      member: { type: "string" },
      committee: { type: "string" },
    },
  });
  const [kind, parcelId] = positionals;
  if (positionals.length !== 2 || !isKind(kind)) {
    throw new Error(USAGE);
  }
  if ((values.member === undefined) === (values.committee === undefined)) {
    throw new Error(`Pass exactly one of --member or --committee\n${USAGE}`);
  }
  if (values.type !== undefined && !isEventType(values.type)) {
    throw new Error(`--type must be one of ${EVENT_TYPES.join(", ")}, got "${values.type}"`);
  }
  assertParcelId(parcelId);
  return { kind, parcelId, type: values.type, member: values.member, committee: values.committee };
};

// A member pays the fee from its own account.
const readMemberSubmitter = (slug: string) => {
  if (!isMemberSlug(slug)) {
    throw new Error(`--member must be one of ${MEMBER_SLUGS.join(", ")}, got "${slug}"`);
  }
  const member = readMember(slug);
  return { account: member, signers: [], label: member.name };
};

// A representative signs a treasury-paid submission: their signature meets the fee-exempt key, so no fee is charged.
const readCommitteeSubmitter = (position: string) => {
  const index = parseWholeNumber(position, "--committee");
  const key = readCommitteeKeys()[index - 1];
  if (!key) {
    throw new Error(`--committee must be between 1 and 4, got ${position}`);
  }
  return { account: readOperator(), signers: [key], label: `committee representative ${index}` };
};

// An event follows the parcel's route, and without --type it is the parcel's next step.
const buildEvent = (parcelId: string, type?: EventType) => {
  const { parcel, eventTypes } = parcelHistory(parcelExists(parcelId) ? readRecords(parcelId) : []);
  const next = type ?? nextEventType(eventTypes);
  if (!next) {
    throw new Error(`Parcel "${parcelId}" has already been delivered; pass --type to record another event`);
  }
  return generateEvent(parcelId, next, parcel);
};

async function main() {
  loadEnvFile();
  const { kind, parcelId, type, member, committee } = readArgs();
  const submitter = member === undefined ? readCommitteeSubmitter(committee ?? "") : readMemberSubmitter(member);
  const topicId = readTopicId();
  const tokenId = readTokenId();
  const maxFee = readWholeNumber("MAX_CUSTOM_FEE", 3);
  const client = createClient(submitter.account);

  try {
    const record = kind === "parcel" ? generateParcel(parcelId, submitter.label) : buildEvent(parcelId, type);
    const publish = publishToTopic(client, topicId, tokenId, maxFee, submitter.signers);
    const { anchor, filePath, transactionId } = await anchorRecord(publish, parcelId, kind, serializeRecord(record));

    console.log(`⚓ Anchored ${kind} ${parcelId} on ${topicId} as ${submitter.label} (max fee ${maxFee} Freight)`);
    console.log(`   sha256 ${anchor.hash}`);
    console.log(`   transaction ${transactionId}`);
    console.log(`📄 Written ${filePath}`);
  } finally {
    client.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

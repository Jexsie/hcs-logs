import { NextResponse } from "next/server";
import { buildAnchor, sameAnchor } from "~~/lib/anchor";
import { hashBytes } from "~~/lib/hash";
import { waitForSubmission } from "~~/lib/mirror";
import { readMirrorUrl, readNetwork } from "~~/lib/network";
import { assertParcelId, parcelExists, readRecords, writeRecord } from "~~/lib/store";
import { chooseFileName } from "~~/lib/submit";
import { Anchor } from "~~/lib/types";

// Saves a record the member portal anchored through a member's wallet. Ledger first: the record is written only once
// the mirror node shows a successful submission to this topic carrying exactly this record's anchor. Nothing the
// browser says is taken on trust.
export const dynamic = "force-dynamic";

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

const readKind = (record: string, parcelId: string): Anchor["kind"] | undefined => {
  try {
    const { kind, parcelId: recordParcelId } = JSON.parse(record);
    return (kind === "parcel" || kind === "event") && recordParcelId === parcelId ? kind : undefined;
  } catch {
    return undefined;
  }
};

const alreadySaved = async (parcelId: string, hash: string) => {
  if (!parcelExists(parcelId)) {
    return false;
  }
  const hashes = await Promise.all(readRecords(parcelId).map(({ bytes }) => hashBytes(bytes)));
  return hashes.includes(hash);
};

export async function POST(req: Request, { params }: { params: Promise<{ parcelId: string }> }) {
  const { parcelId } = await params;
  const { record, transactionId } = await req.json().catch(() => ({}));
  if (typeof record !== "string" || typeof transactionId !== "string") {
    return fail(400, "Send the record text and the transaction id that anchored it");
  }
  try {
    assertParcelId(parcelId);
  } catch (error) {
    return fail(400, error instanceof Error ? error.message : String(error));
  }
  const kind = readKind(record, parcelId);
  if (!kind) {
    return fail(400, `The record must be JSON with "kind" set to parcel or event and "parcelId" set to ${parcelId}`);
  }

  const bytes = new TextEncoder().encode(record);
  const expected = await buildAnchor(parcelId, kind, bytes);
  if (await alreadySaved(parcelId, expected.hash)) {
    return fail(409, "This record has already been saved");
  }
  let fileName: string;
  try {
    fileName = chooseFileName(parcelId, kind);
  } catch (error) {
    return fail(409, error instanceof Error ? error.message : String(error));
  }

  const network = readNetwork(process.env);
  const submission = await waitForSubmission(readMirrorUrl(network, process.env), transactionId);
  if (!submission) {
    return fail(504, `Transaction ${transactionId} has not appeared on the network yet; nothing was saved`);
  }
  if (submission.result !== "SUCCESS") {
    return fail(422, `Transaction ${transactionId} did not succeed (${submission.result}); nothing was saved`);
  }
  if (submission.topicId !== process.env.TOPIC_ID || !submission.anchor || !sameAnchor(submission.anchor, expected)) {
    return fail(422, `Transaction ${transactionId} did not anchor this record on topic ${process.env.TOPIC_ID}`);
  }

  writeRecord(parcelId, fileName, bytes);
  return NextResponse.json({ fileName, consensusTimestamp: submission.consensusTimestamp }, { status: 201 });
}

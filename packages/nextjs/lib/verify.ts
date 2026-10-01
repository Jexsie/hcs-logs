import { hashBytes } from "~~/lib/hash";
import { fetchAnchors } from "~~/lib/mirror";
import { PARCEL_FILE, readRecords } from "~~/lib/store";
import { Anchor } from "~~/lib/types";

type AnchoredMessage = Anchor & { consensusTimestamp: string };

// A file is verified when an anchor for the same parcel and kind carries the hash of its bytes as they are now.
export const compareRecords = (
  parcelId: string,
  records: { fileName: string; bytes: Uint8Array }[],
  anchors: AnchoredMessage[],
) =>
  records.map(({ fileName, bytes }) => {
    const hash = hashBytes(bytes);
    const kind = fileName === PARCEL_FILE ? "parcel" : "event";
    const anchor = anchors.find(
      candidate => candidate.parcelId === parcelId && candidate.kind === kind && candidate.hash === hash,
    );
    return { fileName, hash, status: anchor ? "verified" : "changed", anchoredAt: anchor?.consensusTimestamp };
  });

export const verifyParcel = async (parcelId: string, mirrorUrl: string, topicId: string, dataDir?: string) => {
  const records = readRecords(parcelId, dataDir);
  const anchors = await fetchAnchors(mirrorUrl, topicId);
  return compareRecords(parcelId, records, anchors);
};

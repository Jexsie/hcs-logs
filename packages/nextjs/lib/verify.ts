import { hashBytes } from "~~/lib/hash";
import { Anchor } from "~~/lib/types";

export type AnchoredMessage = Anchor & { consensusTimestamp: string; sequenceNumber: number };

// A record is verified when an anchor for the same parcel carries the hash of its bytes as they are now. The CLI knows
// each file's kind from its name and requires the anchor to match it; the page takes files of any name, so it does not.
export const compareRecord = async (
  parcelId: string,
  record: { fileName: string; bytes: Uint8Array; kind?: Anchor["kind"] },
  anchors: AnchoredMessage[],
) => {
  const hash = await hashBytes(record.bytes);
  const anchor = anchors.find(
    candidate =>
      candidate.parcelId === parcelId &&
      candidate.hash === hash &&
      (record.kind === undefined || candidate.kind === record.kind),
  );
  return { fileName: record.fileName, hash, anchor, status: anchor ? ("verified" as const) : ("changed" as const) };
};

export const compareRecords = (
  parcelId: string,
  records: { fileName: string; bytes: Uint8Array; kind?: Anchor["kind"] }[],
  anchors: AnchoredMessage[],
) => Promise.all(records.map(record => compareRecord(parcelId, record, anchors)));

export const anchorsForParcel = (parcelId: string, anchors: AnchoredMessage[]) =>
  anchors.filter(anchor => anchor.parcelId === parcelId).sort((a, b) => a.sequenceNumber - b.sequenceNumber);

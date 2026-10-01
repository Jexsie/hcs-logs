"use client";

import { useState } from "react";
import { FileCheck } from "~~/components/verify/FileCheck";
import { ParcelDetails } from "~~/components/verify/ParcelDetails";
import { ParcelTimeline } from "~~/components/verify/ParcelTimeline";
import { HederaNetwork } from "~~/lib/network";
import { AnchoredMessage, compareRecord } from "~~/lib/verify";
import { readRecord } from "~~/utils/recordDetails";

// A file's content is read only after its raw bytes matched an anchor. Files that do not match are never displayed,
// because unverified content must not look trustworthy.
const checkFile = async (parcelId: string, anchors: AnchoredMessage[], file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { anchor } = await compareRecord(parcelId, { fileName: file.name, bytes }, anchors);
  return { fileName: file.name, anchor, record: anchor ? readRecord(bytes) : undefined };
};

export const ParcelView = ({
  parcelId,
  network,
  anchors,
}: {
  parcelId: string;
  network: HederaNetwork;
  anchors: AnchoredMessage[];
}) => {
  const [verifiedRecords, setVerifiedRecords] = useState(new Map<number, unknown>());
  const [unmatched, setUnmatched] = useState<string[]>([]);

  const handleFiles = async (files: File[]) => {
    const checked = await Promise.all(files.map(file => checkFile(parcelId, anchors, file)));
    setVerifiedRecords(current => {
      const next = new Map(current);
      checked.forEach(({ anchor, record }) => anchor && next.set(anchor.sequenceNumber, record));
      return next;
    });
    setUnmatched(checked.filter(({ anchor }) => !anchor).map(({ fileName }) => fileName));
  };

  const parcelAnchor = anchors.find(anchor => anchor.kind === "parcel");

  return (
    <>
      <ParcelDetails
        parcelId={parcelId}
        network={network}
        anchor={parcelAnchor}
        record={parcelAnchor && verifiedRecords.get(parcelAnchor.sequenceNumber)}
      />
      <ParcelTimeline network={network} anchors={anchors} verifiedRecords={verifiedRecords} />
      <section className="bg-base-100 rounded-2xl shadow-md p-6 sm:p-8 flex flex-col gap-4">
        <FileCheck onFiles={files => void handleFiles(files)} />
        {unmatched.length > 0 && (
          <div className="alert alert-error" role="alert" aria-live="polite">
            <span>
              {unmatched.join(", ")} {unmatched.length === 1 ? "does" : "do"} not match this parcel&apos;s records. A
              file changed after it was anchored, or from another parcel, cannot be verified.
            </span>
          </div>
        )}
      </section>
    </>
  );
};

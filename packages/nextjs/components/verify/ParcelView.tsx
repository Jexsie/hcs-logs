"use client";

import { useState } from "react";
import { FileCheck } from "~~/components/verify/FileCheck";
import { ParcelDetails } from "~~/components/verify/ParcelDetails";
import { ParcelTimeline, describeUpdate } from "~~/components/verify/ParcelTimeline";
import { HederaNetwork } from "~~/lib/network";
import { AnchoredMessage, compareRecord } from "~~/lib/verify";
import { readRecord } from "~~/utils/recordDetails";

// A document is read only after its exact bytes matched this shipment's records. Documents that do not match are
// never displayed, because altered content must not look genuine.
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
  const [records, setRecords] = useState(new Map<number, unknown>());
  const [unmatched, setUnmatched] = useState<string[]>([]);

  const handleFiles = async (files: File[]) => {
    const checked = await Promise.all(files.map(file => checkFile(parcelId, anchors, file)));
    setRecords(current => {
      const next = new Map(current);
      checked.forEach(({ anchor, record }) => anchor && next.set(anchor.sequenceNumber, record));
      return next;
    });
    setUnmatched(checked.filter(({ anchor }) => !anchor).map(({ fileName }) => fileName));
  };

  const registered = anchors.find(anchor => anchor.kind === "parcel");
  const latest = anchors[anchors.length - 1];

  return (
    <>
      <ParcelDetails
        parcelId={parcelId}
        network={network}
        registered={registered}
        latest={latest}
        latestLabel={describeUpdate(latest, records.get(latest.sequenceNumber)).title}
        record={registered && records.get(registered.sequenceNumber)}
      />
      <ParcelTimeline network={network} anchors={anchors} records={records} />
      <section className="bg-base-100 rounded-2xl shadow-md p-6 sm:p-8 flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold m-0">Have your shipping documents?</h2>
          <p className="m-0 mt-2 text-sm text-base-content/70">
            Add the documents you received for this shipment to see the full details of each update. We check that they
            are genuine and unchanged.
          </p>
        </div>
        <FileCheck onFiles={files => void handleFiles(files)} />
        {unmatched.length > 0 && (
          <div className="alert alert-error" role="alert" aria-live="polite">
            <span>
              {unmatched.join(", ")} {unmatched.length === 1 ? "doesn't" : "don't"} match this shipment&apos;s records,
              so we can&apos;t show {unmatched.length === 1 ? "it" : "them"}. It may have been changed after it was
              issued, or belong to another shipment.
            </span>
          </div>
        )}
      </section>
    </>
  );
};

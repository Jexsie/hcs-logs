import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { HederaNetwork, hashscanTransactionUrl } from "~~/lib/network";
import { AnchoredMessage } from "~~/lib/verify";

// Mirror node timestamps are "seconds.nanoseconds" since the epoch.
const formatConsensusTime = (timestamp: string) =>
  new Date(Number(timestamp.split(".")[0]) * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });

export const ParcelTrail = ({
  parcelId,
  topicId,
  network,
  anchors,
}: {
  parcelId: string;
  topicId: string;
  network: HederaNetwork;
  anchors: AnchoredMessage[];
}) => {
  if (anchors.length === 0) {
    return (
      <div className="alert">
        <span>
          Nothing is anchored for <strong className="font-mono">{parcelId}</strong> on topic {topicId}. Check the parcel
          ID, or try again in a few seconds if the record was submitted just now.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-base-content/70">
        {anchors.length} record{anchors.length === 1 ? "" : "s"} anchored for{" "}
        <strong className="font-mono">{parcelId}</strong>. The ledger holds only each record&apos;s fingerprint; the
        record itself stays with the member company.
      </p>
      <ol className="flex flex-col gap-3 list-none p-0 m-0">
        {anchors.map(anchor => (
          <li key={anchor.sequenceNumber} className="border border-base-300 rounded-box p-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`badge ${anchor.kind === "parcel" ? "badge-primary" : "badge-secondary"}`}>
                {anchor.kind === "parcel" ? "Parcel record" : "Event record"}
              </span>
              <span className="text-sm text-base-content/70">
                Anchored {formatConsensusTime(anchor.consensusTimestamp)} · message #{anchor.sequenceNumber}
              </span>
            </div>
            <code className="text-xs break-all bg-base-200 rounded px-2 py-1">sha256 {anchor.hash}</code>
            <a
              href={hashscanTransactionUrl(network, anchor.consensusTimestamp)}
              target="_blank"
              rel="noreferrer"
              className="link link-primary text-sm inline-flex items-center gap-1 self-start"
            >
              View on HashScan <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
};

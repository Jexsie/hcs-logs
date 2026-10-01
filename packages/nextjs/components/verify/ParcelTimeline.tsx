import { LedgerLink } from "~~/components/verify/LedgerLink";
import { HederaNetwork } from "~~/lib/network";
import { AnchoredMessage } from "~~/lib/verify";
import { asEvent, asParcel, formatConsensusTime, formatEventType } from "~~/utils/recordDetails";

const describeEntry = (anchor: AnchoredMessage, record: unknown) => {
  if (anchor.kind === "parcel") {
    const handler = asParcel(record)?.handler;
    return { title: "Parcel registered", detail: handler && `by ${handler}` };
  }
  const event = asEvent(record);
  return { title: formatEventType(event?.type), detail: event?.location };
};

export const ParcelTimeline = ({
  network,
  anchors,
  verifiedRecords,
}: {
  network: HederaNetwork;
  anchors: AnchoredMessage[];
  verifiedRecords: Map<number, unknown>;
}) => (
  <section className="bg-base-100 rounded-2xl shadow-md p-6 sm:p-8 flex flex-col gap-4">
    <h2 className="text-xl font-bold m-0">Timeline</h2>
    <ol className="list-none p-0 m-0 border-l-2 border-base-300 ml-2 flex flex-col gap-6">
      {anchors.map(anchor => {
        const verified = verifiedRecords.has(anchor.sequenceNumber);
        const { title, detail } = describeEntry(anchor, verifiedRecords.get(anchor.sequenceNumber));
        return (
          <li key={anchor.sequenceNumber} className="relative pl-6">
            <span
              className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-base-100 ${
                verified ? "bg-success" : "bg-base-300"
              }`}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="flex flex-col">
                <span className="font-semibold">{title}</span>
                {detail && <span className="text-sm text-base-content/70">{detail}</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-base-content/60">{formatConsensusTime(anchor.consensusTimestamp)}</span>
                <LedgerLink network={network} consensusTimestamp={anchor.consensusTimestamp} verified={verified} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  </section>
);

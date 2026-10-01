import { LedgerLink } from "~~/components/verify/LedgerLink";
import { HederaNetwork } from "~~/lib/network";
import { AnchoredMessage } from "~~/lib/verify";
import { asEvent, formatConsensusTime, formatEventType } from "~~/utils/recordDetails";

// A step is named from its verified record. Without one, only the fact and time of the update are known.
export const describeUpdate = (anchor: AnchoredMessage, record: unknown) => {
  if (anchor.kind === "parcel") {
    return { title: "Registered", detail: undefined };
  }
  const event = asEvent(record);
  return { title: formatEventType(event?.type), detail: event?.location };
};

export const ParcelTimeline = ({
  network,
  anchors,
  details,
}: {
  network: HederaNetwork;
  anchors: AnchoredMessage[];
  details: Map<number, unknown>;
}) => (
  <section className="bg-base-100 rounded-2xl shadow-md p-6 sm:p-8 flex flex-col gap-4">
    <h2 className="text-xl font-bold m-0">Timeline</h2>
    <ol className="list-none p-0 m-0 border-l-2 border-base-300 ml-2 flex flex-col gap-6">
      {anchors.map((anchor, index) => {
        const verified = details.has(anchor.sequenceNumber);
        const { title, detail } = describeUpdate(anchor, details.get(anchor.sequenceNumber));
        const current = index === anchors.length - 1;
        return (
          <li key={anchor.sequenceNumber} className="relative pl-6">
            <span
              className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-base-100 ${
                current ? "bg-primary" : "bg-success"
              }`}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="flex flex-col">
                <span className="font-semibold">{title}</span>
                {detail && <span className="text-sm text-base-content/70">{detail}</span>}
                <span className="text-sm text-base-content/60">{formatConsensusTime(anchor.consensusTimestamp)}</span>
              </div>
              {verified ? (
                <LedgerLink network={network} consensusTimestamp={anchor.consensusTimestamp} />
              ) : (
                <span className="text-sm text-base-content/50">Details unavailable</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  </section>
);

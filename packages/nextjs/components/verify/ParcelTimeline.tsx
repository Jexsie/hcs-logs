import { LedgerLink } from "~~/components/verify/LedgerLink";
import { HederaNetwork } from "~~/lib/network";
import { AnchoredMessage } from "~~/lib/verify";
import { asEvent, formatConsensusTime, formatEventType } from "~~/utils/recordDetails";

// What a step is called: from the shipping document when the customer added it, otherwise only what is known for sure.
export const describeUpdate = (anchor: AnchoredMessage, record: unknown) => {
  if (anchor.kind === "parcel") {
    return { title: "Shipment registered", detail: undefined };
  }
  const event = asEvent(record);
  return { title: event ? formatEventType(event.type) : "Shipment updated", detail: event?.location };
};

export const ParcelTimeline = ({
  network,
  anchors,
  records,
}: {
  network: HederaNetwork;
  anchors: AnchoredMessage[];
  records: Map<number, unknown>;
}) => (
  <section className="bg-base-100 rounded-2xl shadow-md p-6 sm:p-8 flex flex-col gap-4">
    <h2 className="text-xl font-bold m-0">Shipment history</h2>
    <ol className="list-none p-0 m-0 border-l-2 border-base-300 ml-2 flex flex-col gap-6">
      {[...anchors].reverse().map((anchor, index) => {
        const { title, detail } = describeUpdate(anchor, records.get(anchor.sequenceNumber));
        return (
          <li key={anchor.sequenceNumber} className="relative pl-6">
            <span
              className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-base-100 ${
                index === 0 ? "bg-primary" : "bg-base-300"
              }`}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="flex flex-col">
                <span className="font-semibold">{title}</span>
                {detail && <span className="text-sm text-base-content/70">{detail}</span>}
                <span className="text-sm text-base-content/60">{formatConsensusTime(anchor.consensusTimestamp)}</span>
              </div>
              <LedgerLink network={network} consensusTimestamp={anchor.consensusTimestamp} />
            </div>
          </li>
        );
      })}
    </ol>
  </section>
);

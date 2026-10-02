import { LedgerLink } from "~~/components/verify/LedgerLink";
import { RouteProgress } from "~~/components/verify/RouteProgress";
import { HederaNetwork } from "~~/lib/network";
import { AnchoredMessage } from "~~/lib/verify";
import { asParcel, formatConsensusTime } from "~~/utils/recordDetails";

const Detail = ({ label, value }: { label: string; value?: string | number }) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-xs uppercase tracking-wide text-base-content/60">{label}</dt>
    <dd className="m-0 font-medium">{value ?? "—"}</dd>
  </div>
);

export const ParcelDetails = ({
  parcelId,
  network,
  status,
  latest,
  registered,
  anchors,
  details,
}: {
  parcelId: string;
  network: HederaNetwork;
  status: string;
  latest: AnchoredMessage;
  registered?: AnchoredMessage;
  anchors: AnchoredMessage[];
  details: Map<number, unknown>;
}) => {
  const parcel = asParcel(registered && details.get(registered.sequenceNumber));

  return (
    <section className="bg-base-100 rounded-box shadow-sm border border-base-300 p-6 sm:p-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-base-content/60 font-mono">{parcelId}</span>
          <h2 className="text-3xl sm:text-4xl font-bold m-0 text-primary">{status}</h2>
          <span className="text-sm text-base-content/70 tabular">
            Since {formatConsensusTime(latest.consensusTimestamp)}
          </span>
        </div>
        {parcel && registered && <LedgerLink network={network} consensusTimestamp={registered.consensusTimestamp} />}
      </div>

      <RouteProgress anchors={anchors} details={details} />

      {parcel && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 m-0 pt-6 border-t border-base-300">
          <Detail
            label="Package"
            value={parcel.weightKg !== undefined ? `${parcel.pieces ?? "?"} pieces · ${parcel.weightKg} kg` : undefined}
          />
          <Detail label="Shipper" value={parcel.shipper} />
          <Detail label="Consignee" value={parcel.consignee} />
          <Detail label="Handled by" value={parcel.handler} />
        </dl>
      )}
    </section>
  );
};

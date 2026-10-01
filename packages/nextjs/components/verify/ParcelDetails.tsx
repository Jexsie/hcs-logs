import { LedgerLink } from "~~/components/verify/LedgerLink";
import { HederaNetwork } from "~~/lib/network";
import { AnchoredMessage } from "~~/lib/verify";
import { asParcel, formatConsensusTime } from "~~/utils/recordDetails";

const Detail = ({ label, value }: { label: string; value?: string | number }) => (
  <div className="flex flex-col">
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
  record,
}: {
  parcelId: string;
  network: HederaNetwork;
  status: string;
  latest: AnchoredMessage;
  registered?: AnchoredMessage;
  record?: unknown;
}) => {
  const parcel = asParcel(record);

  return (
    <section className="bg-base-100 rounded-2xl shadow-md p-6 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-base-content/60">Shipment</span>
          <h2 className="text-2xl font-bold m-0 font-mono">{parcelId}</h2>
        </div>
        {parcel && registered && <LedgerLink network={network} consensusTimestamp={registered.consensusTimestamp} />}
      </div>

      <div className="rounded-box bg-base-200 p-4 flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-base-content/60">Status</span>
        <span className="text-2xl font-bold text-primary">{status}</span>
        <span className="text-sm text-base-content/70">Since {formatConsensusTime(latest.consensusTimestamp)}</span>
      </div>

      {parcel && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 m-0">
          <Detail label="From" value={parcel.origin} />
          <Detail label="To" value={parcel.destination} />
          <Detail label="Shipper" value={parcel.shipper} />
          <Detail label="Consignee" value={parcel.consignee} />
          <Detail
            label="Package"
            value={parcel.weightKg !== undefined ? `${parcel.pieces ?? "?"} pieces · ${parcel.weightKg} kg` : undefined}
          />
          <Detail label="Handled by" value={parcel.handler} />
        </dl>
      )}
    </section>
  );
};

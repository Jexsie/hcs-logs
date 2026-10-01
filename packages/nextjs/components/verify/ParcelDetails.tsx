import { LedgerLink } from "~~/components/verify/LedgerLink";
import { HederaNetwork } from "~~/lib/network";
import { AnchoredMessage } from "~~/lib/verify";
import { asParcel } from "~~/utils/recordDetails";

const Detail = ({ label, value }: { label: string; value?: string | number }) => (
  <div className="flex flex-col">
    <dt className="text-xs uppercase tracking-wide text-base-content/60">{label}</dt>
    <dd className="m-0 font-medium">{value ?? "—"}</dd>
  </div>
);

export const ParcelDetails = ({
  parcelId,
  network,
  anchor,
  record,
}: {
  parcelId: string;
  network: HederaNetwork;
  anchor?: AnchoredMessage;
  record?: unknown;
}) => {
  const parcel = asParcel(record);

  return (
    <section className="bg-base-100 rounded-2xl shadow-md p-6 sm:p-8 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold m-0 font-mono">{parcelId}</h2>
        {anchor && <LedgerLink network={network} consensusTimestamp={anchor.consensusTimestamp} verified={!!parcel} />}
      </div>
      {parcel ? (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 m-0">
          <Detail label="Shipper" value={parcel.shipper} />
          <Detail label="Consignee" value={parcel.consignee} />
          <Detail
            label="Route"
            value={parcel.origin && parcel.destination && `${parcel.origin} → ${parcel.destination}`}
          />
          <Detail
            label="Weight"
            value={parcel.weightKg !== undefined ? `${parcel.weightKg} kg · ${parcel.pieces ?? "?"} pieces` : undefined}
          />
          <Detail label="Handled by" value={parcel.handler} />
        </dl>
      ) : (
        <p className="m-0 text-sm text-base-content/70">
          The ledger holds only each record&apos;s fingerprint, so the parcel&apos;s details appear once you add its
          record files below.
        </p>
      )}
    </section>
  );
};

import { ParcelDetails } from "~~/components/verify/ParcelDetails";
import { ParcelTimeline, describeUpdate } from "~~/components/verify/ParcelTimeline";
import { HederaNetwork } from "~~/lib/network";
import { AnchoredMessage } from "~~/lib/verify";

export const ParcelView = ({
  parcelId,
  network,
  anchors,
  details,
  changed,
}: {
  parcelId: string;
  network: HederaNetwork;
  anchors: AnchoredMessage[];
  details: Map<number, unknown>;
  changed: number;
}) => {
  const registered = anchors.find(anchor => anchor.kind === "parcel");
  const latest = anchors[anchors.length - 1];

  return (
    <>
      <ParcelDetails
        parcelId={parcelId}
        network={network}
        status={describeUpdate(latest, details.get(latest.sequenceNumber)).title}
        latest={latest}
        registered={registered}
        anchors={anchors}
        details={details}
      />
      {changed > 0 && (
        <div className="alert alert-warning" role="alert">
          <span>
            {changed === 1 ? "One update" : `${changed} updates`} for this shipment could not be confirmed as genuine,
            so {changed === 1 ? "it is" : "they are"} not shown.
          </span>
        </div>
      )}
      <ParcelTimeline network={network} anchors={anchors} details={details} />
    </>
  );
};

import { base64ToBytes } from "~~/lib/mirror";
import { Anchor } from "~~/lib/types";

type ParcelRecordsResponse = { records: { fileName: string; kind: Anchor["kind"]; content: string }[] };

// Fetches the raw bytes of a parcel's records from this site's server. They are verified against Hedera by the caller.
export const fetchParcelRecords = async (parcelId: string) => {
  const response = await fetch(`/api/parcels/${encodeURIComponent(parcelId)}`);
  if (response.status === 400) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Loading the records of ${parcelId} failed with HTTP ${response.status}`);
  }
  const { records } = (await response.json()) as ParcelRecordsResponse;
  return records.map(({ fileName, kind, content }) => ({ fileName, kind, bytes: base64ToBytes(content) }));
};

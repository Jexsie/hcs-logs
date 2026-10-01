import { useCallback, useRef, useState } from "react";
import { fetchAnchors } from "~~/lib/mirror";
import { AnchoredMessage, anchorsForParcel, compareRecords } from "~~/lib/verify";
import { fetchParcelRecords } from "~~/utils/parcelRecords";
import { readRecord } from "~~/utils/recordDetails";

type SearchState =
  | { status: "idle" }
  | { status: "loading"; parcelId: string }
  | { status: "found"; parcelId: string; anchors: AnchoredMessage[]; details: Map<number, unknown>; changed: number }
  | { status: "error"; parcelId: string; message: string };

// Anchors come from the public mirror node and records from this site; each record is hashed in the browser and its
// content kept only if it matches an anchor. A changed record is counted, never shown.
const lookUp = async (mirrorUrl: string, topicId: string, parcelId: string) => {
  const [anchors, records] = await Promise.all([
    fetchAnchors(mirrorUrl, topicId).then(all => anchorsForParcel(parcelId, all)),
    fetchParcelRecords(parcelId),
  ]);
  const results = await compareRecords(parcelId, records, anchors);
  const details = new Map(
    results.flatMap(({ anchor }, index) =>
      anchor ? [[anchor.sequenceNumber, readRecord(records[index].bytes)] as const] : [],
    ),
  );
  return { anchors, details, changed: results.filter(({ status }) => status === "changed").length };
};

// A slow earlier search never overwrites the result of a newer one.
export const useParcelSearch = (mirrorUrl: string, topicId: string) => {
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const latest = useRef(0);

  const search = useCallback(
    async (input: string) => {
      const parcelId = input.trim().toUpperCase();
      if (!parcelId) {
        return;
      }
      const request = ++latest.current;
      setState({ status: "loading", parcelId });
      try {
        const result = await lookUp(mirrorUrl, topicId, parcelId);
        if (request === latest.current) {
          setState({ status: "found", parcelId, ...result });
        }
      } catch (error) {
        if (request === latest.current) {
          setState({ status: "error", parcelId, message: error instanceof Error ? error.message : String(error) });
        }
      }
    },
    [mirrorUrl, topicId],
  );

  return { state, search };
};

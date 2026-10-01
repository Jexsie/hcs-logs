import { useCallback, useRef, useState } from "react";
import { fetchAnchors } from "~~/lib/mirror";
import { AnchoredMessage, anchorsForParcel } from "~~/lib/verify";

type SearchState =
  | { status: "idle" }
  | { status: "loading"; parcelId: string }
  | { status: "found"; parcelId: string; anchors: AnchoredMessage[] }
  | { status: "error"; parcelId: string; message: string };

// Looks a parcel up on the public mirror node. A slow earlier search never overwrites the result of a newer one.
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
        const anchors = anchorsForParcel(parcelId, await fetchAnchors(mirrorUrl, topicId));
        if (request === latest.current) {
          setState({ status: "found", parcelId, anchors });
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

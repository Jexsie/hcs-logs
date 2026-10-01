// The message written to the topic for every record. It carries no business detail.
export type Anchor = {
  v: 1;
  parcelId: string;
  kind: "parcel" | "event";
  hash: string;
};

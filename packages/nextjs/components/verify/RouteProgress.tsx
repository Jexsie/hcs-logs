import { CheckIcon } from "@heroicons/react/24/solid";
import { AnchoredMessage } from "~~/lib/verify";
import { asEvent, asParcel } from "~~/utils/recordDetails";

const STEPS = [
  { key: "registered", label: "Registered" },
  { key: "shipped", label: "Shipped" },
  { key: "customs", label: "Customs" },
  { key: "delivered", label: "Delivered" },
] as const;

type Step = (typeof STEPS)[number]["key"];

// Where each step happens: the verified event's own location when recorded, otherwise the parcel's planned route.
const placesFor = (anchors: AnchoredMessage[], details: Map<number, unknown>) => {
  const parcel = asParcel(details.get(anchors.find(anchor => anchor.kind === "parcel")?.sequenceNumber ?? -1));
  const recorded = new Map(
    anchors.flatMap(anchor => {
      const event = asEvent(details.get(anchor.sequenceNumber));
      return event?.type ? [[event.type, event.location] as const] : [];
    }),
  );
  return {
    registered: parcel?.origin,
    shipped: recorded.get("shipped") ?? parcel?.origin,
    customs: recorded.get("customs") ?? parcel?.via,
    delivered: recorded.get("delivered") ?? parcel?.destination,
  } satisfies Record<Step, string | undefined>;
};

// The current position is the furthest step that has been recorded; events of unknown type do not move it.
const reachedIndex = (anchors: AnchoredMessage[], details: Map<number, unknown>) => {
  const types = anchors.map(anchor =>
    anchor.kind === "parcel" ? "registered" : asEvent(details.get(anchor.sequenceNumber))?.type,
  );
  return Math.max(...STEPS.map((step, index) => (types.includes(step.key) ? index : -1)), 0);
};

export const RouteProgress = ({ anchors, details }: { anchors: AnchoredMessage[]; details: Map<number, unknown> }) => {
  const places = placesFor(anchors, details);
  const reached = reachedIndex(anchors, details);

  return (
    <ol className="grid grid-cols-4 list-none p-0 m-0" aria-label="Shipment progress">
      {STEPS.map((step, index) => {
        const done = index < reached || (index === reached && step.key === "delivered");
        const current = index === reached && !done;
        return (
          <li
            key={step.key}
            className="relative flex flex-col items-center text-center gap-2 px-1"
            aria-current={current ? "step" : undefined}
          >
            {index > 0 && (
              <span
                aria-hidden
                className={`absolute top-3.5 right-1/2 w-full h-1 -translate-y-1/2 ${
                  index <= reached ? "bg-primary" : "bg-base-300"
                }`}
              />
            )}
            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                done
                  ? "bg-primary border-primary text-primary-content"
                  : current
                    ? "bg-base-100 border-accent ring-4 ring-accent/25"
                    : "bg-base-100 border-base-300"
              }`}
            >
              {done && <CheckIcon className="h-4 w-4" />}
              {current && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
            </span>
            <span className={`text-xs sm:text-sm font-semibold ${index > reached ? "text-base-content/50" : ""}`}>
              {step.label}
            </span>
            <span className="text-[11px] sm:text-xs text-base-content/60 leading-tight">{places[step.key] ?? " "}</span>
          </li>
        );
      })}
    </ol>
  );
};

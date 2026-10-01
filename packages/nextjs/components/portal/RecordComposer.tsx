"use client";

import { useState } from "react";
import Link from "next/link";
import type { Transaction } from "@hiero-ledger/sdk";
import { ArrowTopRightOnSquareIcon, PlusIcon } from "@heroicons/react/24/outline";
import { HederaNetwork, hashscanTransactionUrl } from "~~/lib/network";
import { formatRecord, generateEvent, generateParcel, nextEventType, randomParcelId } from "~~/lib/records";
import { fetchParcelRecords } from "~~/utils/parcelRecords";
import { readDraft, submitRecord } from "~~/utils/portalSubmit";
import { parcelHistory } from "~~/utils/recordDetails";

// The fee the committee agreed members cap their submissions at.
const AGREED_MAX_FEE = 3;

const STEP_LABELS = {
  checking: "Checking the parcel…",
  approving: "Approve the submission in your wallet…",
  saving: "Recording on Hedera and saving…",
};

type Status =
  | { state: "idle" }
  | { state: "busy"; label: string }
  | { state: "done"; parcelId: string; kind: string; consensusTimestamp: string }
  | { state: "error"; message: string };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const RecordComposer = ({
  network,
  topicId,
  tokenId,
  accountId,
  topicFee,
  signAndExecute,
  onSubmitted,
}: {
  network: HederaNetwork;
  topicId: string;
  tokenId: string;
  accountId?: string;
  topicFee?: number;
  signAndExecute: (transaction: Transaction) => Promise<string>;
  onSubmitted: () => void;
}) => {
  const [text, setText] = useState("");
  const [eventParcelId, setEventParcelId] = useState("");
  const [maxFee, setMaxFee] = useState(String(AGREED_MAX_FEE));
  const [status, setStatus] = useState<Status>({ state: "idle" });

  // Each click stamps the record with the current time, so an event can never be dated before the record it follows.
  const addParcel = () => {
    const parcelId = randomParcelId();
    setText(formatRecord(generateParcel(parcelId, accountId ?? "Member company")));
    setEventParcelId(parcelId);
    setStatus({ state: "idle" });
  };

  const addEvent = async () => {
    const parcelId = eventParcelId.trim().toUpperCase();
    if (!parcelId) {
      setStatus({ state: "error", message: "Enter the parcel ID to add an event to" });
      return;
    }
    try {
      const { parcel, eventTypes } = parcelHistory(await fetchParcelRecords(parcelId));
      const next = nextEventType(eventTypes);
      if (!parcel) {
        throw new Error(`${parcelId} is not registered yet; add and submit the parcel first`);
      }
      if (!next) {
        throw new Error(`${parcelId} has already been delivered`);
      }
      setText(formatRecord(generateEvent(parcelId, next, parcel)));
      setStatus({ state: "idle" });
    } catch (error) {
      setStatus({ state: "error", message: messageOf(error) });
    }
  };

  const submit = async () => {
    const fee = Number(maxFee);
    if (!accountId) {
      setStatus({ state: "error", message: "Connect your wallet first" });
      return;
    }
    if (!Number.isInteger(fee) || fee < 0) {
      setStatus({ state: "error", message: "The maximum fee must be a whole number of FRT" });
      return;
    }
    try {
      const saved = await submitRecord({
        text,
        maxFee: fee,
        accountId,
        topicId,
        tokenId,
        signAndExecute,
        onStep: step => setStatus({ state: "busy", label: STEP_LABELS[step] }),
      });
      setStatus({ state: "done", ...saved });
      setEventParcelId(saved.parcelId);
      setText("");
      onSubmitted();
    } catch (error) {
      setStatus({ state: "error", message: messageOf(error) });
    }
  };

  const draftKind = (() => {
    try {
      return readDraft(text).kind;
    } catch {
      return undefined;
    }
  })();
  const feeTooLow = topicFee !== undefined && Number(maxFee) < topicFee;
  const busy = status.state === "busy";

  return (
    <section className="bg-base-100 rounded-2xl shadow-md p-6 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <button type="button" className="btn btn-outline" onClick={addParcel} disabled={busy}>
          <PlusIcon className="h-5 w-5" />
          Add parcel
        </button>
        <div className="join">
          <input
            className="input input-bordered join-item font-mono uppercase w-44"
            placeholder="IND-2026-0041"
            aria-label="Parcel ID for the event"
            value={eventParcelId}
            onChange={event => setEventParcelId(event.target.value)}
          />
          <button type="button" className="btn btn-outline join-item" onClick={() => void addEvent()} disabled={busy}>
            <PlusIcon className="h-5 w-5" />
            Add event
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-medium">Record</span>
        <textarea
          className="textarea textarea-bordered font-mono text-sm min-h-72 w-full"
          placeholder="Press Add parcel or Add event to fill in a record, then edit it if you need to."
          value={text}
          onChange={event => setText(event.target.value)}
          spellCheck={false}
        />
        <span className="text-xs text-base-content/60">
          This exact text is what gets recorded. Its fingerprint goes on Hedera; the text stays with the association.
        </span>
      </label>

      <label className="flex flex-col gap-2 max-w-xs">
        <span className="font-medium">Maximum fee you will pay (FRT)</span>
        <input
          type="number"
          min={0}
          step={1}
          className={`input input-bordered w-32 ${feeTooLow ? "input-warning" : ""}`}
          value={maxFee}
          onChange={event => setMaxFee(event.target.value)}
        />
        <span className="text-xs text-base-content/60">
          Agreed by the committee: {AGREED_MAX_FEE} FRT.
          {topicFee !== undefined && ` The fee right now is ${topicFee} FRT.`} If the fee is higher than your maximum
          when the submission runs, it is refused and nothing is charged.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void submit()}
          disabled={busy || !text.trim() || !accountId}
        >
          {busy && <span className="loading loading-spinner loading-sm" />}
          {draftKind === "event" ? "Submit event" : draftKind === "parcel" ? "Submit parcel" : "Submit"}
        </button>
        {!accountId && <span className="text-sm text-base-content/60">Connect your wallet to submit.</span>}
        {status.state === "busy" && <span className="text-sm">{status.label}</span>}
      </div>

      {status.state === "error" && (
        <div className="alert alert-error" role="alert">
          <span>{status.message}</span>
        </div>
      )}
      {status.state === "done" && (
        <div className="alert alert-success" role="status">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {status.kind === "parcel" ? "Parcel registered" : "Event recorded"} for{" "}
            <span className="font-mono">{status.parcelId}</span>.
            <a
              href={hashscanTransactionUrl(network, status.consensusTimestamp)}
              target="_blank"
              rel="noreferrer"
              className="link inline-flex items-center gap-1"
            >
              Verified <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            </a>
            <Link href={`/?parcel=${status.parcelId}`} className="link">
              View timeline
            </Link>
          </span>
        </div>
      )}
    </section>
  );
};

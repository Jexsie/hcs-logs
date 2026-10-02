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
  wallet,
}: {
  network: HederaNetwork;
  topicId: string;
  tokenId: string;
  accountId?: string;
  topicFee?: number;
  signAndExecute: (transaction: Transaction) => Promise<string>;
  onSubmitted: () => void;
  wallet: React.ReactNode;
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

  const surface = "bg-base-100 rounded-box shadow-sm border border-base-300";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
      <section className={`${surface} p-5 sm:p-6 flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary btn-outline" onClick={addParcel} disabled={busy}>
            <PlusIcon className="h-5 w-5" />
            New parcel
          </button>
          <span className="text-sm text-base-content/50">or</span>
          <div className="join w-full sm:w-auto">
            <label className="join-item flex flex-1 min-w-0 items-center gap-2 input input-bordered sm:w-auto pr-1">
              <span className="text-sm text-base-content/60 whitespace-nowrap">Next event for</span>
              <input
                className="font-mono uppercase w-full min-w-0 sm:w-36 bg-transparent outline-none"
                placeholder="IND-2026-0041"
                aria-label="Parcel ID for the next event"
                value={eventParcelId}
                onChange={event => setEventParcelId(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary btn-outline join-item"
              onClick={() => void addEvent()}
              disabled={busy}
            >
              <PlusIcon className="h-5 w-5" />
              Add event
            </button>
          </div>
        </div>

        <textarea
          className="textarea textarea-bordered rounded-xl py-2 font-mono text-sm min-h-80 lg:min-h-[30rem] w-full"
          aria-label="Record"
          placeholder="Start a new parcel, or add the next event to an existing one. Edit the record here if you need to."
          value={text}
          onChange={event => setText(event.target.value)}
          spellCheck={false}
        />
        <p className="m-0 text-xs text-base-content/60">
          This exact text is recorded. Its fingerprint goes on Hedera; the text stays with the association.
        </p>
      </section>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
        {wallet}

        <section className={`${surface} p-5 flex flex-col gap-3`}>
          <label htmlFor="max-fee" className="font-medium">
            Maximum fee
          </label>
          <div className="flex items-center gap-2">
            <input
              id="max-fee"
              type="number"
              min={0}
              step={1}
              className={`input input-bordered w-24 text-lg font-semibold tabular ${feeTooLow ? "input-warning" : ""}`}
              value={maxFee}
              onChange={event => setMaxFee(event.target.value)}
            />
            <span className="font-medium">FRT</span>
          </div>
          <dl className="grid grid-cols-2 gap-2 m-0 text-sm">
            <div className="rounded-field bg-base-200 px-3 py-2">
              <dt className="text-xs text-base-content/60">Committee limit</dt>
              <dd className="m-0 font-semibold tabular">{AGREED_MAX_FEE} FRT</dd>
            </div>
            <div className="rounded-field bg-base-200 px-3 py-2">
              <dt className="text-xs text-base-content/60">Current fee</dt>
              <dd className="m-0 font-semibold tabular">{topicFee === undefined ? "…" : `${topicFee} FRT`}</dd>
            </div>
          </dl>
          <p className={`m-0 text-xs ${feeTooLow ? "text-warning font-medium" : "text-base-content/60"}`}>
            {feeTooLow
              ? "Below the current fee: the network will refuse this submission."
              : "If the fee is above your maximum when it runs, the submission is refused and nothing is charged."}
          </p>
        </section>

        <button
          type="button"
          className="btn btn-primary btn-lg w-full"
          onClick={() => void submit()}
          disabled={busy || !text.trim() || !accountId}
        >
          {busy && <span className="loading loading-spinner loading-sm" />}
          {draftKind === "event" ? "Submit event" : draftKind === "parcel" ? "Submit parcel" : "Submit"}
        </button>
        {!accountId && (
          <p className="m-0 -mt-2 text-sm text-center text-base-content/60">Connect a wallet to submit.</p>
        )}
        {status.state === "busy" && (
          <p className="m-0 -mt-2 text-sm text-center" role="status">
            {status.label}
          </p>
        )}

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
      </aside>
    </div>
  );
};

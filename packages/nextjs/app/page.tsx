"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { ParcelView } from "~~/components/verify/ParcelView";
import { SearchForm } from "~~/components/verify/SearchForm";
import { useParcelSearch } from "~~/hooks/useParcelSearch";
import { HederaNetwork } from "~~/lib/network";
import { readVerifyConfig } from "~~/utils/verifyConfig";

const readConfig = () => {
  try {
    const config = readVerifyConfig();
    return config.topicId
      ? { ...config, topicId: config.topicId }
      : { error: "TOPIC_ID is not set for this deployment." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

const CONFIG = readConfig();

const Verifier = ({ network, mirrorUrl, topicId }: { network: HederaNetwork; mirrorUrl: string; topicId: string }) => {
  const { state, search } = useParcelSearch(mirrorUrl, topicId);
  const [initialParcel, setInitialParcel] = useState("");

  // A link such as /?parcel=IND-2026-0041 opens straight on that parcel, so a member can share a verification link.
  useEffect(() => {
    const parcel = new URLSearchParams(window.location.search).get("parcel") ?? "";
    setInitialParcel(parcel);
    void search(parcel);
  }, [search]);

  const handleSearch = (parcelId: string) => {
    window.history.replaceState(null, "", `?parcel=${encodeURIComponent(parcelId.trim().toUpperCase())}`);
    void search(parcelId);
  };

  return (
    <>
      <div className="bg-base-100 rounded-2xl shadow-lg p-6 sm:p-8 flex flex-col gap-3">
        <SearchForm initialValue={initialParcel} busy={state.status === "loading"} onSearch={handleSearch} />
        <p className="m-0 text-xs text-base-content/60">
          Checking topic{" "}
          <a
            href={`https://hashscan.io/${network}/topic/${topicId}`}
            target="_blank"
            rel="noreferrer"
            className="link font-mono"
          >
            {topicId}
          </a>{" "}
          on Hedera {network}. No wallet or account needed.
        </p>
      </div>

      {state.status === "error" && (
        <div className="alert alert-error" role="alert">
          <span>
            Could not reach the mirror node to look up {state.parcelId}: {state.message}
          </span>
        </div>
      )}

      {state.status === "found" && state.anchors.length === 0 && (
        <div className="alert" role="status">
          <span>
            Nothing is anchored for <strong className="font-mono">{state.parcelId}</strong> on topic {topicId}. Check
            the parcel ID, or try again in a few seconds if it was submitted just now.
          </span>
        </div>
      )}

      {state.status === "found" && state.anchors.length > 0 && (
        <ParcelView key={state.parcelId} parcelId={state.parcelId} network={network} anchors={state.anchors} />
      )}
    </>
  );
};

const Home: NextPage = () => {
  return (
    <div className="flex flex-col grow items-center px-4 pt-12 pb-16">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold">Verify a cargo record</h1>
          <p className="text-base-content/70 m-0">
            Look up any Indiana Group parcel on the public Hedera ledger, then check that its records have not been
            altered.
          </p>
        </div>
        {"error" in CONFIG ? (
          <div className="alert alert-warning" role="alert">
            <span>This verifier is not configured: {CONFIG.error}</span>
          </div>
        ) : (
          <Verifier network={CONFIG.network} mirrorUrl={CONFIG.mirrorUrl} topicId={CONFIG.topicId} />
        )}
      </div>
    </div>
  );
};

export default Home;

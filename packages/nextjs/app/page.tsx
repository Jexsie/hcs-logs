"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { ParcelView } from "~~/components/verify/ParcelView";
import { SearchForm } from "~~/components/verify/SearchForm";
import { useParcelSearch } from "~~/hooks/useParcelSearch";
import { HederaNetwork } from "~~/lib/network";
import { readPublicConfig } from "~~/utils/publicConfig";

const readConfig = () => {
  try {
    const config = readPublicConfig();
    return config.topicId
      ? { ...config, topicId: config.topicId }
      : { error: "TOPIC_ID is not set for this deployment." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

const CONFIG = readConfig();

// Customers see a plain message; whoever runs the site sees the actual configuration problem in the console.
if ("error" in CONFIG) {
  console.error(`Shipment tracking is not configured: ${CONFIG.error}`);
}

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
      <div className="bg-base-100 rounded-2xl shadow-lg p-6 sm:p-8">
        <SearchForm initialValue={initialParcel} busy={state.status === "loading"} onSearch={handleSearch} />
      </div>

      {state.status === "error" && (
        <div className="alert alert-error" role="alert">
          <span>We couldn&apos;t load shipment {state.parcelId} just now. Please try again in a moment.</span>
        </div>
      )}

      {state.status === "found" && state.anchors.length === 0 && (
        <div className="alert" role="status">
          <span>
            We couldn&apos;t find a shipment with the ID <strong className="font-mono">{state.parcelId}</strong>. Check
            the ID and try again. A shipment registered in the last minute may not appear yet.
          </span>
        </div>
      )}

      {state.status === "found" && state.anchors.length > 0 && (
        <ParcelView
          parcelId={state.parcelId}
          network={network}
          anchors={state.anchors}
          details={state.details}
          changed={state.changed}
        />
      )}
    </>
  );
};

const Home: NextPage = () => {
  return (
    <div className="flex flex-col grow items-center px-4 pt-12 pb-16">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold">Track your shipment</h1>
          <p className="text-base-content/70 m-0">Enter the parcel ID you were given to see where your shipment is.</p>
        </div>
        {"error" in CONFIG ? (
          <div className="alert alert-warning" role="alert">
            <span>Shipment tracking is unavailable right now. Please try again later.</span>
          </div>
        ) : (
          <Verifier network={CONFIG.network} mirrorUrl={CONFIG.mirrorUrl} topicId={CONFIG.topicId} />
        )}
      </div>
    </div>
  );
};

export default Home;

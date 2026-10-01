"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { FileCheck } from "~~/components/verify/FileCheck";
import { ParcelTrail } from "~~/components/verify/ParcelTrail";
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

      {state.status === "found" && (
        <>
          <section className="bg-base-100 rounded-2xl shadow-md p-6 sm:p-8 flex flex-col gap-4">
            <h2 className="text-xl font-bold m-0">Anchored records</h2>
            <ParcelTrail parcelId={state.parcelId} topicId={topicId} network={network} anchors={state.anchors} />
          </section>

          {state.anchors.length > 0 && (
            <section className="bg-base-100 rounded-2xl shadow-md p-6 sm:p-8 flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-bold m-0">Check your copies</h2>
                <p className="m-0 mt-2 text-sm text-base-content/70">
                  Have this parcel&apos;s record files? Check that they are exactly the files that were anchored. A
                  single changed character makes a file fail.
                </p>
              </div>
              <FileCheck key={state.parcelId} parcelId={state.parcelId} anchors={state.anchors} />
            </section>
          )}
        </>
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

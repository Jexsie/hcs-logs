"use client";

import { useCallback, useEffect, useState } from "react";
import type { NextPage } from "next";
import { RecordComposer } from "~~/components/portal/RecordComposer";
import { WalletPanel } from "~~/components/portal/WalletPanel";
import { useHederaWallet } from "~~/hooks/useHederaWallet";
import { fetchTokenBalance, fetchTopicFee } from "~~/lib/mirror";
import { readPublicConfig } from "~~/utils/publicConfig";

const readConfig = () => {
  try {
    const { network, mirrorUrl, topicId, tokenId, walletConnectProjectId } = readPublicConfig();
    const missing = [
      !topicId && "TOPIC_ID",
      !tokenId && "FREIGHT_TOKEN_ID",
      !walletConnectProjectId && "WALLETCONNECT_PROJECT_ID",
    ].filter(Boolean);
    if (!topicId || !tokenId || !walletConnectProjectId) {
      return { error: `Set ${missing.join(", ")} in the root .env and rebuild.` };
    }
    return { network, mirrorUrl, topicId, tokenId, walletConnectProjectId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

const CONFIG = readConfig();

const Portal = ({ config }: { config: Exclude<typeof CONFIG, { error: string }> }) => {
  const { network, mirrorUrl, topicId, tokenId, walletConnectProjectId } = config;
  const wallet = useHederaWallet(walletConnectProjectId, network);
  const [balance, setBalance] = useState<number>();
  const [topicFee, setTopicFee] = useState<number>();

  const refreshBalance = useCallback(() => {
    setBalance(undefined);
    if (wallet.accountId) {
      void fetchTokenBalance(mirrorUrl, wallet.accountId, tokenId).then(setBalance);
    }
  }, [mirrorUrl, tokenId, wallet.accountId]);

  useEffect(refreshBalance, [refreshBalance]);

  useEffect(() => {
    void fetchTopicFee(mirrorUrl, topicId, tokenId).then(setTopicFee);
  }, [mirrorUrl, topicId, tokenId]);

  // The mirror node shows the fee a few seconds after consensus, so the balance is refreshed with a short delay.
  const handleSubmitted = () => setTimeout(refreshBalance, 5_000);

  return (
    <>
      {wallet.error && (
        <div className="alert alert-error" role="alert">
          <span>The wallet connection could not start: {wallet.error}</span>
        </div>
      )}
      <RecordComposer
        wallet={
          <WalletPanel
            accountId={wallet.accountId}
            ready={wallet.ready}
            balance={balance}
            onConnect={() => void wallet.connect()}
            onDisconnect={() => void wallet.disconnect()}
            onRefresh={refreshBalance}
          />
        }
        network={network}
        topicId={topicId}
        tokenId={tokenId}
        accountId={wallet.accountId}
        topicFee={topicFee}
        signAndExecute={wallet.signAndExecute}
        onSubmitted={handleSubmitted}
      />
    </>
  );
};

const PortalPage: NextPage = () => (
  <div className="flex flex-col grow items-center px-4 pt-8 pb-16">
    <div className="w-full max-w-6xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold m-0">Member portal</h1>
        <p className="text-base-content/70 m-0 mt-1">
          Register parcels and record their events. You approve each submission in your wallet and pay in Freight.
        </p>
      </div>
      {"error" in CONFIG ? (
        <div className="alert alert-warning" role="alert">
          <span>The member portal is not configured. {CONFIG.error}</span>
        </div>
      ) : (
        <Portal config={CONFIG} />
      )}
    </div>
  </div>
);

export default PortalPage;

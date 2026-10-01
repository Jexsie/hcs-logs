import { useCallback, useEffect, useState } from "react";
import type { Transaction } from "@hiero-ledger/sdk";
import type UniversalProvider from "@walletconnect/universal-provider";
import { HederaNetwork } from "~~/lib/network";

// One WalletConnect session per page load. React runs effects twice in development, and AppKit must be created once.
let session: ReturnType<typeof startSession> | undefined;

const startSession = async (projectId: string, network: HederaNetwork) => {
  if (network === "previewnet") {
    throw new Error("Wallet signing supports testnet and mainnet only");
  }
  const { HederaAdapter, HederaChainDefinition, HederaProvider, hederaNamespace, transactionToBase64String } =
    await import("@hashgraph/hedera-wallet-connect");
  const { createAppKit } = await import("@reown/appkit");
  const chain = network === "mainnet" ? HederaChainDefinition.Native.Mainnet : HederaChainDefinition.Native.Testnet;
  const metadata = {
    name: "Indiana Group member portal",
    description: "Submit parcel and event records",
    url: window.location.origin,
    icons: [`${window.location.origin}/indiana-group-logo.svg`],
  };
  const provider = await HederaProvider.init({ projectId, metadata });
  const appKit = createAppKit({
    adapters: [new HederaAdapter({ projectId, networks: [chain], namespace: hederaNamespace })],
    universalProvider: provider as unknown as UniversalProvider,
    projectId,
    metadata,
    networks: [chain],
    features: { analytics: false, email: false, socials: false },
  });
  return { appKit, provider, transactionToBase64String, namespace: hederaNamespace };
};

// The connected account as 0.0.1234, from a CAIP address such as hedera:testnet:0.0.1234.
const accountFrom = (caipAddress?: string) => caipAddress?.split(":").pop();

export const useHederaWallet = (projectId: string | undefined, network: HederaNetwork) => {
  const [accountId, setAccountId] = useState<string>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!projectId) {
      return;
    }
    session ??= startSession(projectId, network);
    let unsubscribe: (() => void) | undefined;
    session
      .then(({ appKit, namespace }) => {
        unsubscribe = appKit.subscribeAccount(
          account => setAccountId(account.isConnected ? accountFrom(account.caipAddress) : undefined),
          namespace,
        );
        setReady(true);
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
    return () => unsubscribe?.();
  }, [projectId, network]);

  const connect = useCallback(async () => (await session)?.appKit.open(), []);

  const disconnect = useCallback(async () => (await session)?.appKit.disconnect(), []);

  // The wallet shows the transaction to its owner, who approves it; the wallet then signs, pays and submits it.
  const signAndExecute = useCallback(
    async (transaction: Transaction) => {
      const active = await session;
      if (!active || !accountId) {
        throw new Error("Connect a wallet first");
      }
      const result = await active.provider.hedera_signAndExecuteTransaction({
        signerAccountId: `hedera:${network}:${accountId}`,
        transactionList: active.transactionToBase64String(transaction),
      });
      return result.transactionId;
    },
    [accountId, network],
  );

  return { accountId, ready, error, connect, disconnect, signAndExecute };
};

import { ArrowPathIcon } from "@heroicons/react/24/outline";

export const WalletPanel = ({
  accountId,
  ready,
  balance,
  onConnect,
  onDisconnect,
  onRefresh,
}: {
  accountId?: string;
  ready: boolean;
  balance?: number;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
}) => (
  <section className="bg-base-100 rounded-2xl shadow-md p-6 flex flex-wrap items-center justify-between gap-4">
    {accountId ? (
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-base-content/60">Connected account</span>
        <span className="font-mono font-semibold">{accountId}</span>
        <span className="text-sm text-base-content/70 inline-flex items-center gap-2">
          {balance === undefined ? "Loading Freight balance…" : `${balance} FRT available`}
          <button type="button" className="btn btn-ghost btn-xs" onClick={onRefresh} aria-label="Refresh balance">
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        </span>
      </div>
    ) : (
      <div className="flex flex-col gap-1">
        <span className="font-semibold">Connect your company wallet</span>
        <span className="text-sm text-base-content/70">
          Every submission is approved in your wallet and paid from your Freight balance.
        </span>
      </div>
    )}
    {accountId ? (
      <button type="button" className="btn btn-outline btn-sm" onClick={onDisconnect}>
        Disconnect
      </button>
    ) : (
      <button type="button" className="btn btn-primary" onClick={onConnect} disabled={!ready}>
        {ready ? "Connect wallet" : <span className="loading loading-spinner loading-sm" />}
      </button>
    )}
  </section>
);

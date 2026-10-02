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
  <section className="bg-base-100 rounded-box shadow-sm border border-base-300 p-5 flex flex-col gap-3">
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
        <span className="font-medium">Wallet</span>
        <span className="text-sm text-base-content/60">Not connected</span>
      </div>
    )}
    {accountId ? (
      <button type="button" className="btn btn-ghost btn-sm self-start" onClick={onDisconnect}>
        Disconnect
      </button>
    ) : (
      <button type="button" className="btn btn-primary w-full" onClick={onConnect} disabled={!ready}>
        {ready ? "Connect wallet" : <span className="loading loading-spinner loading-sm" />}
      </button>
    )}
  </section>
);

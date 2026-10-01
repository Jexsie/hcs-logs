import { ArrowTopRightOnSquareIcon, CheckBadgeIcon } from "@heroicons/react/24/outline";
import { HederaNetwork, hashscanTransactionUrl } from "~~/lib/network";

// "Verified" once a file matching this anchor has been checked; until then the ledger only shows it was anchored.
export const LedgerLink = ({
  network,
  consensusTimestamp,
  verified,
}: {
  network: HederaNetwork;
  consensusTimestamp: string;
  verified: boolean;
}) => (
  <a
    href={hashscanTransactionUrl(network, consensusTimestamp)}
    target="_blank"
    rel="noreferrer"
    title="View the anchoring transaction on HashScan"
    className={`inline-flex items-center gap-1 text-sm font-semibold link link-hover ${
      verified ? "text-success" : "text-base-content/60"
    }`}
  >
    {verified && <CheckBadgeIcon className="h-5 w-5" />}
    {verified ? "Verified" : "Anchored"}
    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
  </a>
);

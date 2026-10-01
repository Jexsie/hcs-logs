import { ArrowTopRightOnSquareIcon, CheckBadgeIcon } from "@heroicons/react/24/outline";
import { HederaNetwork, hashscanTransactionUrl } from "~~/lib/network";

// Every update shown was recorded on Hedera; the link opens that independent record on HashScan.
export const LedgerLink = ({ network, consensusTimestamp }: { network: HederaNetwork; consensusTimestamp: string }) => (
  <a
    href={hashscanTransactionUrl(network, consensusTimestamp)}
    target="_blank"
    rel="noreferrer"
    title="See the independent record of this update"
    className="inline-flex items-center gap-1 text-sm font-semibold text-success link link-hover"
  >
    <CheckBadgeIcon className="h-5 w-5" />
    Verified
    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
  </a>
);

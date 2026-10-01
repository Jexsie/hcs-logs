import { Anchor } from "~~/lib/types";

// The parts of the mirror node REST responses this template reads.
type MessagesPage = {
  messages: { consensus_timestamp: string; sequence_number: number; message: string }[];
  links: { next: string | null };
};

type TokenBalancesPage = {
  tokens: { token_id: string; balance: number }[];
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Mirror node request ${url} failed with HTTP ${response.status}`);
  }
  return (await response.json()) as T;
};

const fetchTopicMessages = async (mirrorUrl: string, topicId: string) => {
  const messages: MessagesPage["messages"] = [];
  let next: string | null = `/api/v1/topics/${topicId}/messages?limit=100&order=asc`;
  while (next) {
    const page: MessagesPage = await fetchJson(`${mirrorUrl}${next}`);
    messages.push(...page.messages);
    next = page.links.next;
  }
  return messages;
};

// atob and TextDecoder rather than Buffer, so this runs in the browser as well as in Node.
const decodeJson = (base64: string): unknown => {
  try {
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), character => character.charCodeAt(0))));
  } catch {
    return undefined;
  }
};

const isAnchor = (value: unknown): value is Anchor => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { v, parcelId, kind, hash } = value as Record<string, unknown>;
  return (
    v === 1 &&
    typeof parcelId === "string" &&
    (kind === "parcel" || kind === "event") &&
    typeof hash === "string" &&
    Object.keys(value).length === 4
  );
};

// The topic is public, so anything can be posted to it. Messages that are not well-formed anchors are skipped.
export const fetchAnchors = async (mirrorUrl: string, topicId: string) => {
  const messages = await fetchTopicMessages(mirrorUrl, topicId);
  return messages.flatMap(({ message, consensus_timestamp, sequence_number }) => {
    const anchor = decodeJson(message);
    return isAnchor(anchor)
      ? [{ ...anchor, consensusTimestamp: consensus_timestamp, sequenceNumber: sequence_number }]
      : [];
  });
};

// Account token balances come from the mirror node: consensus nodes no longer answer balance queries.
export const fetchTokenBalance = async (mirrorUrl: string, accountId: string, tokenId: string) => {
  const page: TokenBalancesPage = await fetchJson(
    `${mirrorUrl}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`,
  );
  return page.tokens.find(token => token.token_id === tokenId)?.balance ?? 0;
};

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

// atob rather than Buffer, so this runs in the browser as well as in Node.
export const base64ToBytes = (base64: string) => Uint8Array.from(atob(base64), character => character.charCodeAt(0));

const decodeJson = (base64: string): unknown => {
  try {
    return JSON.parse(new TextDecoder().decode(base64ToBytes(base64)));
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

type TransactionsPage = {
  transactions: { name: string; result: string; consensus_timestamp: string }[];
};

type MessageByTimestamp = { topic_id: string; message: string };

// "0.0.9@1700000000.000000123" -> "0.0.9-1700000000-000000123", the form the mirror node's REST API takes.
export const mirrorTransactionId = (transactionId: string) => {
  const [account, validStart] = transactionId.split("@");
  if (!account || !validStart) {
    throw new Error(`Transaction id must look like 0.0.1234@1700000000.000000000, got "${transactionId}"`);
  }
  return `${account}-${validStart.split(".").join("-")}`;
};

// What a topic submission did on the network, or undefined while the mirror node has not indexed it yet.
export const fetchSubmission = async (mirrorUrl: string, transactionId: string) => {
  const response = await fetch(`${mirrorUrl}/api/v1/transactions/${mirrorTransactionId(transactionId)}`);
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`Mirror node lookup of transaction ${transactionId} failed with HTTP ${response.status}`);
  }
  const [transaction] = ((await response.json()) as TransactionsPage).transactions;
  if (!transaction || transaction.result !== "SUCCESS" || transaction.name !== "CONSENSUSSUBMITMESSAGE") {
    return transaction && { result: transaction.result, name: transaction.name, topicId: undefined, anchor: undefined };
  }
  const message: MessageByTimestamp = await fetchJson(
    `${mirrorUrl}/api/v1/topics/messages/${transaction.consensus_timestamp}`,
  );
  const decoded = decodeJson(message.message);
  return {
    result: transaction.result,
    name: transaction.name,
    topicId: message.topic_id,
    consensusTimestamp: transaction.consensus_timestamp,
    anchor: isAnchor(decoded) ? decoded : undefined,
  };
};

// The mirror node trails consensus by a few seconds, so a fresh submission is polled for until it appears.
export const waitForSubmission = async (mirrorUrl: string, transactionId: string, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const submission = await fetchSubmission(mirrorUrl, transactionId);
    if (submission) {
      return submission;
    }
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
  return undefined;
};

type TopicInfo = {
  custom_fees?: { fixed_fees?: { amount: number; denominating_token_id: string | null }[] };
};

// The total per-message fee the topic charges in one token right now, summed across its collectors.
export const fetchTopicFee = async (mirrorUrl: string, topicId: string, tokenId: string) => {
  const info: TopicInfo = await fetchJson(`${mirrorUrl}/api/v1/topics/${topicId}`);
  return (info.custom_fees?.fixed_fees ?? [])
    .filter(fee => fee.denominating_token_id === tokenId)
    .reduce((total, fee) => total + fee.amount, 0);
};

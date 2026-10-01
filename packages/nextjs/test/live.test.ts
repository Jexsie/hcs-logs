import { AccountId, Client, PrivateKey, TokenId, TopicId, TopicUpdateTransaction } from "@hiero-ledger/sdk";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MEMBERS,
  MEMBER_SLUGS,
  MemberSlug,
  createAccount,
  createClient,
  executeTransaction,
  loadEnvFile,
  readOperator,
  signWith,
} from "~~/lib/client";
import { fetchAnchors, fetchTokenBalance } from "~~/lib/mirror";
import { readMirrorUrl, readNetwork } from "~~/lib/network";
import { generateEvent, generateParcel, serializeRecord } from "~~/lib/records";
import { recordExists } from "~~/lib/store";
import { anchorRecord, publishToTopic } from "~~/lib/submit";
import { associateFreight, createFreightToken, sendFreight } from "~~/lib/token";
import { createRecordsTopic, getTopicInfo, updateFees } from "~~/lib/topic";

// These run against a real network and spend testnet HBAR. Enable with HCS_LOGS_NETWORK_TESTS=1 and an operator
// in the root .env. Setup builds a fresh association: four committee keys, an infrastructure account, three member
// companies holding 100 Freight each, and a records topic charging 2 + 1 Freight whose admin and fee schedule keys
// are 3-of-4 committee keys. Every transaction id is logged so the run can be checked on HashScan.
const enabled = process.env.HCS_LOGS_NETWORK_TESTS === "1";
const PARCEL_ID = "IND-2026-0041";
const MIRROR_TIMEOUT_MS = 60_000;

const waitFor = async (description: string, check: () => Promise<boolean>) => {
  const deadline = Date.now() + MIRROR_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out after ${MIRROR_TIMEOUT_MS} ms waiting for ${description}`);
};

const messageOf = (promise: Promise<unknown>) =>
  promise.then(
    () => "did not fail",
    error => (error instanceof Error ? error.message : String(error)),
  );

describe.skipIf(!enabled)("on the network", () => {
  let operatorClient: Client;
  const memberClients: Partial<Record<MemberSlug, Client>> = {};
  const memberIds: Partial<Record<MemberSlug, AccountId>> = {};
  let mirrorUrl: string;
  let tokenId: TokenId;
  let topicId: TopicId;
  let operatorId: AccountId;
  let infraId: AccountId;
  let committee: PrivateKey[];
  let dataDir: string;

  const balanceOf = (accountId?: AccountId) => fetchTokenBalance(mirrorUrl, String(accountId), tokenId.toString());

  const anchoredOnMirror = async (hash: string) =>
    (await fetchAnchors(mirrorUrl, topicId.toString())).some(anchor => anchor.hash === hash);

  const memberClient = (slug: MemberSlug) => {
    const client = memberClients[slug];
    if (!client) {
      throw new Error(`No client for member ${slug}`);
    }
    return client;
  };

  beforeAll(async () => {
    loadEnvFile();
    const operator = readOperator();
    operatorId = operator.accountId;
    operatorClient = createClient(operator);
    mirrorUrl = readMirrorUrl(readNetwork());
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hcs-logs-network-"));
    committee = Array.from({ length: 4 }, () => PrivateKey.generateECDSA());

    const token = await createFreightToken(operatorClient, 1_000);
    tokenId = token.tokenId;
    console.log(`Freight token ${tokenId} created in ${token.transactionId}; treasury ${operatorId}`);

    const infraKey = PrivateKey.generateECDSA();
    infraId = await createAccount(operatorClient, infraKey, 1);
    await associateFreight(operatorClient, tokenId, infraId, infraKey);
    console.log(`Infrastructure operator: ${infraId}`);

    for (const slug of MEMBER_SLUGS) {
      const key = PrivateKey.generateECDSA();
      const accountId = await createAccount(operatorClient, key, 10);
      await associateFreight(operatorClient, tokenId, accountId, key);
      const purchase = await sendFreight(operatorClient, tokenId, accountId, 100);
      console.log(`${MEMBERS[slug]}: ${accountId}, bought 100 Freight in ${purchase}`);
      memberIds[slug] = accountId;
      memberClients[slug] = createClient({ accountId, privateKey: key });
    }

    const fees = { tokenId, treasuryId: operatorId, treasuryFee: 2, infraId, infraFee: 1 };
    const committeePublic = committee.map(key => key.publicKey);
    const topic = await createRecordsTopic(operatorClient, committeePublic, 3, fees, committee.slice(0, 3));
    topicId = topic.topicId;
    console.log(`Records topic ${topicId} created in ${topic.transactionId}`);

    await waitFor("every member's Freight on the mirror node", async () => {
      const balances = await Promise.all(MEMBER_SLUGS.map(slug => balanceOf(memberIds[slug])));
      return balances.every(balance => balance === 100);
    });
  }, 300_000);

  afterAll(() => {
    operatorClient?.close();
    Object.values(memberClients).forEach(client => client?.close());
    if (dataDir) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("charges a member 3 Freight, 2 to the treasury and 1 to infrastructure, and nobody else", async () => {
    const treasuryBefore = await balanceOf(operatorId);
    const publish = publishToTopic(memberClient("lakeside"), topicId, tokenId, 3);
    const bytes = serializeRecord(generateParcel(PARCEL_ID, MEMBERS.lakeside));

    const { transactionId } = await anchorRecord(publish, PARCEL_ID, "parcel", bytes, dataDir);
    console.log(`Member submission by ${MEMBERS.lakeside}: ${transactionId}`);
    await waitFor("the member's fee on the mirror node", async () => (await balanceOf(memberIds.lakeside)) === 97);

    expect(await balanceOf(operatorId)).toBe(treasuryBefore + 2);
    expect(await balanceOf(infraId)).toBe(1);
    expect(await balanceOf(memberIds.nile)).toBe(100);
    expect(await balanceOf(memberIds.rift)).toBe(100);
  }, 120_000);

  it("lets a committee key submit without paying any fee", async () => {
    const treasuryBefore = await balanceOf(operatorId);
    const infraBefore = await balanceOf(infraId);
    const publish = publishToTopic(operatorClient, topicId, tokenId, 3, [committee[1]]);
    const bytes = serializeRecord(generateEvent(PARCEL_ID, "shipped"));

    const { anchor, transactionId } = await anchorRecord(publish, PARCEL_ID, "event", bytes, dataDir);
    console.log(`Committee submission by representative 2: ${transactionId}`);
    await waitFor("the committee anchor on the mirror node", () => anchoredOnMirror(anchor.hash));

    expect(await balanceOf(operatorId)).toBe(treasuryBefore);
    expect(await balanceOf(infraId)).toBe(infraBefore);
  }, 120_000);

  it("rejects a submission whose max_custom_fee is below the topic fee, and writes no file", async () => {
    const publish = publishToTopic(memberClient("nile"), topicId, tokenId, 2);
    const bytes = serializeRecord(generateEvent(PARCEL_ID, "customs"));

    const message = await messageOf(anchorRecord(publish, PARCEL_ID, "event", bytes, dataDir));
    console.log(`max_custom_fee rejection: ${message}`);

    expect(message).toContain("MAX_CUSTOM_FEE_LIMIT_EXCEEDED");
    expect(recordExists(PARCEL_ID, "event-0002.json", dataDir)).toBe(false);
  }, 120_000);

  it("rejects a fee update signed by fewer than the threshold, and accepts one that meets it", async () => {
    const fees = { tokenId, treasuryId: operatorId, treasuryFee: 5, infraId, infraFee: 1 };

    const message = await messageOf(updateFees(operatorClient, topicId, fees, committee.slice(0, 2)));
    console.log(`Below-threshold fee update: ${message}`);

    expect(message).toContain("INVALID_SIGNATURE");
    expect((await getTopicInfo(operatorClient, topicId)).customFees?.[0].amount?.toNumber()).toBe(2);

    console.log(`Threshold fee update: ${await updateFees(operatorClient, topicId, fees, committee.slice(0, 3))}`);
    expect((await getTopicInfo(operatorClient, topicId)).customFees?.[0].amount?.toNumber()).toBe(5);
  }, 120_000);

  it("rejects a topic change by the treasury alone, and accepts it from a committee threshold", async () => {
    const memoUpdate = () =>
      new TopicUpdateTransaction()
        .setTopicId(topicId)
        .setTopicMemo("Indiana Group, renamed")
        .freezeWith(operatorClient);

    const message = await messageOf(executeTransaction(operatorClient, memoUpdate(), "Treasury memo update"));
    console.log(`Treasury-only admin update: ${message}`);
    expect(message).toContain("INVALID_SIGNATURE");

    const signed = await signWith(memoUpdate(), committee.slice(1, 4));
    const { transactionId } = await executeTransaction(operatorClient, signed, "Committee memo update");
    console.log(`Committee admin update: ${transactionId}`);
    expect((await getTopicInfo(operatorClient, topicId)).topicMemo).toBe("Indiana Group, renamed");
  }, 120_000);
});

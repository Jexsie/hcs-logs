import { AccountId, Client, PrivateKey, TokenId, TopicId } from "@hiero-ledger/sdk";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAccount, createClient, loadEnvFile, readMirrorUrl, readNetwork, readOperator } from "~~/lib/client";
import { fetchAnchors, fetchTokenBalance } from "~~/lib/mirror";
import { recordExists } from "~~/lib/store";
import { anchorRecord, generateEvent, generateParcel, publishToTopic, serializeRecord } from "~~/lib/submit";
import { associateFreight, createFreightToken, sendFreight } from "~~/lib/token";
import { createRecordsTopic, getTopicInfo, updateFees } from "~~/lib/topic";

// These run against a real network and spend testnet HBAR. Enable with HCS_LOGS_NETWORK_TESTS=1 and an operator
// in the root .env. Setup builds a fresh association: four committee keys, an infrastructure account, a member
// account, a Freight token and a records topic charging 2 + 1 Freight with a 3-of-4 fee schedule key.
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

describe.skipIf(!enabled)("on the network", () => {
  let operatorClient: Client;
  let memberClient: Client;
  let mirrorUrl: string;
  let tokenId: TokenId;
  let topicId: TopicId;
  let operatorId: AccountId;
  let infraId: AccountId;
  let memberId: AccountId;
  let committee: PrivateKey[];
  let dataDir: string;

  const balanceOf = (accountId: AccountId) => fetchTokenBalance(mirrorUrl, accountId.toString(), tokenId.toString());

  const anchoredOnMirror = async (hash: string) =>
    (await fetchAnchors(mirrorUrl, topicId.toString())).some(anchor => anchor.hash === hash);

  beforeAll(async () => {
    loadEnvFile();
    const operator = readOperator();
    operatorId = operator.accountId;
    operatorClient = createClient(operator);
    mirrorUrl = readMirrorUrl(readNetwork());
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hcs-logs-network-"));
    committee = Array.from({ length: 4 }, () => PrivateKey.generateECDSA());

    const infraKey = PrivateKey.generateECDSA();
    const memberKey = PrivateKey.generateECDSA();
    infraId = await createAccount(operatorClient, infraKey, 1);
    memberId = await createAccount(operatorClient, memberKey, 10);
    memberClient = createClient({ accountId: memberId, privateKey: memberKey });

    tokenId = await createFreightToken(operatorClient, 1_000);
    await associateFreight(operatorClient, tokenId, infraId, infraKey);
    await associateFreight(operatorClient, tokenId, memberId, memberKey);
    await sendFreight(operatorClient, tokenId, memberId, 100);

    const fees = { tokenId, treasuryId: operatorId, treasuryFee: 2, infraId, infraFee: 1 };
    topicId = await createRecordsTopic(
      operatorClient,
      committee.map(key => key.publicKey),
      3,
      fees,
    );
    await waitFor("the member's Freight on the mirror node", async () => (await balanceOf(memberId)) === 100);
  }, 300_000);

  afterAll(() => {
    operatorClient?.close();
    memberClient?.close();
    if (dataDir) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("charges a member key 3 Freight, split between treasury and infrastructure", async () => {
    const treasuryBefore = await balanceOf(operatorId);
    const publish = publishToTopic(memberClient, topicId, tokenId, 3);

    await anchorRecord(publish, PARCEL_ID, "parcel", serializeRecord(generateParcel(PARCEL_ID)), dataDir);
    await waitFor("the member's fee on the mirror node", async () => (await balanceOf(memberId)) === 97);

    expect(await balanceOf(infraId)).toBe(1);
    expect(await balanceOf(operatorId)).toBe(treasuryBefore + 2);
  }, 120_000);

  it("lets a committee key submit without paying any fee", async () => {
    const treasuryBefore = await balanceOf(operatorId);
    const infraBefore = await balanceOf(infraId);
    const publish = publishToTopic(operatorClient, topicId, tokenId, 3, [committee[1]]);

    const { anchor } = await anchorRecord(
      publish,
      PARCEL_ID,
      "event",
      serializeRecord(generateEvent(PARCEL_ID, "picked-up")),
      dataDir,
    );
    await waitFor("the committee anchor on the mirror node", () => anchoredOnMirror(anchor.hash));

    expect(await balanceOf(operatorId)).toBe(treasuryBefore);
    expect(await balanceOf(infraId)).toBe(infraBefore);
  }, 120_000);

  it("rejects a submission whose max_custom_fee is below the topic fee, and writes no file", async () => {
    const publish = publishToTopic(memberClient, topicId, tokenId, 2);
    const bytes = serializeRecord(generateEvent(PARCEL_ID, "in-transit"));

    await expect(anchorRecord(publish, PARCEL_ID, "event", bytes, dataDir)).rejects.toThrow(
      "MAX_CUSTOM_FEE_LIMIT_EXCEEDED",
    );
    expect(recordExists(PARCEL_ID, "event-0002.json", dataDir)).toBe(false);
  }, 120_000);

  it("rejects a fee update signed by fewer than the threshold, and accepts one that meets it", async () => {
    const fees = { tokenId, treasuryId: operatorId, treasuryFee: 5, infraId, infraFee: 1 };

    await expect(updateFees(operatorClient, topicId, fees, committee.slice(0, 2))).rejects.toThrow("INVALID_SIGNATURE");
    expect((await getTopicInfo(operatorClient, topicId)).customFees?.[0].amount?.toNumber()).toBe(2);

    await updateFees(operatorClient, topicId, fees, committee.slice(0, 3));
    expect((await getTopicInfo(operatorClient, topicId)).customFees?.[0].amount?.toNumber()).toBe(5);
  }, 120_000);
});

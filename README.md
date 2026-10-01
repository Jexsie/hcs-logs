# hcs-logs

A Scaffold-HBAR template for tamper-evident records on the Hedera Consensus Service, built around every lever of
[HIP-991](https://hips.hedera.com/hip/hip-991) permissionless revenue-generating topics.

## The scenario

The Indiana Group is a cargo handlers' association. Member companies keep their own parcel and event records as JSON
files on their own machines, but every record is first anchored on a shared HCS topic.

- **Members pay to anchor.** Each submission costs a fee in the association's HTS token, **Freight**. The demo has
  three member companies: Lakeside Haulage, Nile Cargo Services and Rift Valley Logistics.
- **The committee anchors for free.** The four committee representatives are fee-exempt.
- **Anyone verifies for free.** Verification reads only local files and the public mirror node.

Membership itself is an outside commercial agreement and is not built here: a company buys Freight from the
association and holds a seat on the committee.

## HIP-991, lever by lever

| Lever                        | How this template uses it                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Token-denominated fees       | Submission fees are charged in Freight, not HBAR.                                                           |
| Multiple fee collectors      | Each submission pays the association treasury (`TREASURY_FEE`) and the infrastructure operator (`INFRA_FEE`). |
| Fee-exempt key list          | Holds the committee as one 1-of-4 threshold key, so any single representative submits without paying.      |
| Fee schedule key             | A 3-of-4 committee threshold key. One representative acting alone is rejected with `INVALID_SIGNATURE`.     |
| Admin key                    | The same 3-of-4 committee key, so only the committee acting together can reconfigure or delete the topic.  |
| `max_custom_fee`             | Set on every submission. If the fee rose above it, the network fails the message with `MAX_CUSTOM_FEE_LIMIT_EXCEEDED`. |

Two details from the HIP shape the keys:

- **Exempt keys must have their threshold met.** HIP-991 exempts a message only when an exempt key's threshold is
  satisfied. A 3-of-4 key in the exempt list would therefore charge a lone representative. The exempt key is 1-of-4,
  and the fee schedule key is the one that needs three signatures.
- **The committee holds the admin key.** See below.

## Governance: who can change the topic

The topic's admin key and fee schedule key are both a 3-of-4 threshold of the committee's keys. Concretely:

- **Changing fees** needs three representatives' signatures. One representative or the treasury alone is rejected.
- **Changing anything else** also needs three representatives. That covers the memo, the exempt list (for example to
  add a fifth representative), the admin and fee schedule keys themselves (to rotate the committee), and the
  collectors' fees.
- **Deleting the topic** also needs three representatives. The committee can do it; nobody else can. A deleted topic
  accepts no new anchors. Whether a mirror node keeps serving a deleted topic's past messages, and so whether existing
  records stay verifiable, depends on that mirror node; this template does not test it.
- **Creating the topic** is signed by three representatives as well, because the network requires the admin key to
  sign. In production that is a signing ceremony; locally all four keys sit in one `.env`.

So this topic is **not permanent and not immutable.** It is exactly as durable as the committee's willingness to keep
it, and the network enforces that no smaller group can change it. A template that wanted the opposite guarantee would
omit the admin key, at the cost of never being able to rotate the committee or delete the topic.

## The record model

Records live under `packages/nextjs/data/`, one folder per parcel, keyed by a readable id such as `IND-2026-0041`:

```
data/IND-2026-0041/
  parcel.json
  event-0001.json
  event-0002.json
```

**The file is the artifact.** SHA-256 runs over the file's exact bytes. Nothing is parsed, sorted or normalized first,
so adding a space changes the hash. The record is stringified once, and that one byte buffer is hashed, anchored and
written to disk.

**Ledger first, file second.** A submission generates the record, hashes it, submits the anchor and waits for consensus.
Only then is the file written, so every file on disk has an anchor behind it. If the submission fails, nothing is
written.

**Only the anchor reaches the topic.** The message is `{ v, parcelId, kind, hash }`, where `kind` is `parcel` or `event`.
No business detail is ever published.

**Verification needs no account.** It reads a parcel's files, hashes each one, fetches anchors from the mirror node, and
reports every record as verified or changed. Edit one file in a text editor and that record flips to changed, while
the others stay verified.

## The tracking page

`npm run next:dev` (or `next:build` then `next:start`) serves a public shipment tracker at `/`, branded for the Indiana Group and written for customers: no ledger
vocabulary, just a parcel ID and the shipment's progress. It needs no wallet, account or
login, and has no server side of its own: the browser talks straight to the public mirror node.

Search a parcel ID and the page shows the shipment's **status**, its details (route, shipper, consignee, package,
handler) and a **timeline** that grows as events are appended: Registered, then Shipped, Customs and Delivered. Each
step is marked **Verified** and links to its transaction on HashScan.

How the details stay trustworthy:

- The site's server serves the hosting member's record files from `data/`, byte for byte, at `/api/parcels/<id>`.
- The browser fetches that parcel's anchors from the public mirror node, hashes each file with Web Crypto, and shows a
  record only if its hash matches an anchor. The server can supply details but cannot make an edited record look
  genuine: a changed record is reported and left out, and its step reads "Updated · Details unavailable".
- Hedera still holds only `{ v, parcelId, kind, hash }`. No business detail is ever put on the ledger.

**Hosting this page publishes your records.** Anyone who knows a parcel ID can read that parcel's details from the
site, and only parcels in the host's own `data/` show details. A parcel anchored by another member shows its timeline
steps without details.

Links such as `/?parcel=IND-2026-0041` open straight on a parcel, so a member can send a customer a verification link.

The page reads `HEDERA_NETWORK`, `MIRROR_NODE_URL` and `TOPIC_ID` from the root `.env` **at build time**, and only those
three public values reach the browser. Rebuild after changing the topic.

## The member portal

`/portal` is where member companies register parcels and record their events, each submission approved in the
member's own wallet and paid from its Freight balance.

1. **Connect a wallet.** HashPack, Kabila or another Hedera wallet connects through WalletConnect (Reown AppKit,
   Hedera native namespace). Set `WALLETCONNECT_PROJECT_ID` in `.env` first; a project id is free at
   [cloud.reown.com](https://cloud.reown.com). The account must be associated with Freight and hold some.
2. **Add parcel** or **Add event.** Each button puts a freshly randomized record in the text box, stamped with the
   current time. Add parcel picks a new parcel ID and route; Add event reads the parcel's records and drafts its next
   step (shipped, then customs, then delivered) at the right place along that route. Edit the text if you need to.
3. **Set the maximum fee.** It defaults to the 3 FRT the committee agreed, and the portal shows the topic's current
   fee beside it. If the fee is higher when the submission runs, the network refuses it and nothing is charged.
4. **Submit and approve.** The browser hashes the exact text, builds the anchor transaction with `max_custom_fee`, and
   the wallet asks the member to approve it. After consensus the server saves the record, but only once the mirror
   node shows a successful submission to this topic carrying exactly that record's anchor. Nothing the browser says is
   taken on trust, and the same record is never saved twice.

## Quick start

Prerequisites:

- [Node.js](https://nodejs.org/) 24 LTS (`24.21.0`, pinned in `.nvmrc`; run `nvm use`). Node 25 is not supported: its
  built-in `localStorage` global breaks the Next.js build during prerendering.
- A [Hedera testnet account](https://portal.hedera.com/faucet) with HBAR, to act as the association treasury.

```bash
npm install
cp .env.example .env               # put the treasury account in OPERATOR_ID and OPERATOR_KEY
npm run keys:generate -- --create-accounts   # paste the output into .env
npm run token:create               # then set FREIGHT_TOKEN_ID in .env
npm run topic:create               # then set TOPIC_ID in .env
npm run submit -- parcel IND-2026-0041 --member lakeside
npm run submit -- event IND-2026-0041 --member lakeside --type shipped
npm run submit -- event IND-2026-0041 --committee 2 --type customs
npm run submit -- event IND-2026-0041 --member lakeside --type delivered
npm run verify -- IND-2026-0041
npm run next:dev                   # then open http://localhost:3000/?parcel=IND-2026-0041
```

The mirror node trails consensus by a few seconds, so verifying straight after a submission can briefly report a new
record as changed.

## Scripts

| Script                                   | What it does                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `keys:generate [-- --create-accounts]`   | Prints throwaway committee, infrastructure and member company keys. With the flag, the operator creates the infrastructure and three member accounts. |
| `token:create`                           | Creates Freight with the treasury as operator, associates the infrastructure account and all three members, and sells each member 100 Freight. |
| `topic:create`                           | Creates the topic with every HIP-991 setting, then reads it back and checks each one on-chain.  |
| `fee:update -- <treasury> <infra> [--signers n]` | Changes the fee, signed by `n` committee keys (default: the threshold).                |
| `submit -- <parcel\|event> <parcelId> (--member m \| --committee n) [--type t]` | Anchors a record, then writes it. `--member lakeside\|nile\|rift` pays the fee; `--committee n` submits as representative `n`, fee-exempt. |
| `verify -- <parcelId>`                   | Verifies each of a parcel's records against the mirror node. Exits non-zero if any changed.    |
| `test`                                   | Unit tests. No network needed.                                                                  |
| `test:network`                           | On-network HIP-991 tests. Builds a fresh token and topic and spends testnet HBAR.               |

## Layout

```
packages/nextjs/
  lib/
    types.ts    the anchor envelope
    network.ts  network and mirror node settings, without the SDK so the page can use them
    client.ts   operator, member and committee config, client construction, transaction execution
    hash.ts     SHA-256 over raw bytes with Web Crypto, shared by the CLI and the page
    store.ts    reading and writing record files under data/
    token.ts    Freight creation, association and transfer
    topic.ts    the HIP-991 topic, fee updates and the on-chain configuration check
    records.ts  randomized parcel and event generation, shared by the CLI and the portal
    anchor.ts   the anchor and its max_custom_fee submission transaction, shared by the CLI and the portal
    submit.ts   ledger-first submission from the CLI
    mirror.ts   mirror node reads for topic messages and token balances
    verify.ts   hashing records and comparing them against mirror node anchors
  scripts/      one file per root script
  test/         Vitest suites; live.test.ts runs only with test:network
  app/          the public verification page
  components/verify/  search form, status card and timeline
  app/api/parcels/   serves a parcel's record files; records/ saves a portal submission after checking its anchor
  app/portal/, components/portal/  the member portal
  hooks/useHederaWallet.ts  the WalletConnect session and wallet signing
  utils/portalSubmit.ts     the portal's ledger-first submission
  hooks/useParcelSearch.ts  mirror node lookup for the page
```

## Limitations

- **A hash proves a file existed, not who wrote it.** Anyone who pays the fee can post an anchor to this public topic.
  Verify reports when each matching anchor reached consensus. An anchor much later than the original points to a file
  that was edited and then re-anchored.
- **Freight is never minted after creation.** The treasury keeps the supply key, so the association can issue more
  later, but the 1,000,000 created up front is far more than the demo sells, so the template ships no mint path.
- **Committee keys sit in one `.env` locally.** That is fine for testing; in production each representative holds
  only their own key.

## Links

- [Scaffold HBAR docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index)
- [HIP-991](https://hips.hedera.com/hip/hip-991)
- [Hedera Portal faucet](https://portal.hedera.com/faucet)
- [HashScan](https://hashscan.io/)

## License

MIT

# hcs-logs

A Scaffold-HBAR template for tamper-evident records on the Hedera Consensus Service, built around every lever of
[HIP-991](https://hips.hedera.com/hip/hip-991) permissionless revenue-generating topics.

## The scenario

The Indiana Group is a cargo handlers' association. Member companies keep their own parcel and event records as JSON
files on their own machines, but every record is first anchored on a shared HCS topic.

- **Members pay to anchor.** Each submission costs a fee in the association's HTS token, **Freight**.
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
| `max_custom_fee`             | Set on every submission. If the fee rose above it, the network fails the message with `MAX_CUSTOM_FEE_LIMIT_EXCEEDED`. |

Two details from the HIP shape the keys:

- **Exempt keys must have their threshold met.** HIP-991 exempts a message only when an exempt key's threshold is
  satisfied. A 3-of-4 key in the exempt list would therefore charge a lone representative. The exempt key is 1-of-4,
  and the fee schedule key is the one that needs three signatures.
- **The topic has no admin key.** Its collectors and exempt list are fixed at creation, and only the committee can
  change fees. Nobody can route around the committee by updating the topic another way.

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
npm run submit -- parcel IND-2026-0041
npm run submit -- event IND-2026-0041 --type picked-up
npm run submit -- event IND-2026-0041 --type at-hub --committee 2
npm run verify -- IND-2026-0041
```

The mirror node trails consensus by a few seconds, so verifying straight after a submission can briefly report a new
record as changed.

## Scripts

| Script                                   | What it does                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `keys:generate [-- --create-accounts]`   | Prints throwaway committee, infrastructure and member keys. With the flag, the operator creates the two accounts. |
| `token:create`                           | Creates Freight with the treasury as operator, associates both accounts, and sells the member 100 Freight. |
| `topic:create`                           | Creates the topic with every HIP-991 setting, then reads it back and checks each one on-chain.  |
| `fee:update -- <treasury> <infra> [--signers n]` | Changes the fee, signed by `n` committee keys (default: the threshold).                |
| `submit -- <parcel\|event> <parcelId> [--type t] [--committee n]` | Anchors a record, then writes it. `--committee n` submits as representative `n`, fee-exempt. |
| `verify -- <parcelId>`                   | Verifies each of a parcel's records against the mirror node. Exits non-zero if any changed.    |
| `test`                                   | Unit tests. No network needed.                                                                  |
| `test:network`                           | On-network HIP-991 tests. Builds a fresh token and topic and spends testnet HBAR.               |

## Layout

```
packages/nextjs/
  lib/
    types.ts    the anchor envelope
    client.ts   network, operator and committee config, client construction, transaction execution
    hash.ts     SHA-256 over raw bytes
    store.ts    reading and writing record files under data/
    token.ts    Freight creation, minting, association and transfer
    topic.ts    the HIP-991 topic, fee updates and the on-chain configuration check
    submit.ts   record generation and ledger-first submission with max_custom_fee
    mirror.ts   mirror node reads for topic messages and token balances
    verify.ts   hashing files and comparing them against mirror node anchors
  scripts/      one file per root script
  test/         Vitest suites; network.test.ts runs only with test:network
  app/          Next.js shell for the verification UI that comes next
```

## Limitations

- **A hash proves a file existed, not who wrote it.** Anyone who pays the fee can post an anchor to this public topic.
  Verify reports when each matching anchor reached consensus. An anchor much later than the original points to a file
  that was edited and then re-anchored.
- **Committee keys sit in one `.env` locally.** That is fine for testing; in production each representative holds
  only their own key.

## Links

- [Scaffold HBAR docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index)
- [HIP-991](https://hips.hedera.com/hip/hip-991)
- [Hedera Portal faucet](https://portal.hedera.com/faucet)
- [HashScan](https://hashscan.io/)

## License

MIT

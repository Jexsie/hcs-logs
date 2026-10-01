# Agent instructions

Briefing for coding agents in this app (Cursor, Claude Code, Codex). Claude Code loads it through `CLAUDE.md`.

This is the `hcs-logs` Scaffold-HBAR template: parcel and event records anchored on a HIP-991 Hedera Consensus Service
topic, with fees paid in the Freight HTS token. It has no Solidity and no smart contracts. All Hedera code uses
`@hiero-ledger/sdk`.

npm only, Node 24 LTS (`.nvmrc`). Root scripts delegate into the workspace with `-w @sh/nextjs`.

## Commands

```bash
npm run lint
npm run test             # unit tests, no network
npm run test:network     # on-network HIP-991 tests, needs an operator in .env
npm run next:check-types
npm run next:build
npm run keys:generate | token:create | topic:create | fee:update | submit | verify
```

## Layout

- `packages/nextjs/lib/`: the library, one job per file (see README)
- `packages/nextjs/scripts/`: thin entry points for root scripts
- `packages/nextjs/test/`: Vitest suites
- `.env` lives at the repository root; `loadEnvFile()` reads it from there
- `packages/nextjs/data/`: local records, gitignored

## Invariants

Do not break these:

- **Hash raw bytes.** Never parse, canonicalize or re-stringify a record before hashing. Serialize once with
  `serializeRecord`, then hash, anchor and write that same buffer.
- **Ledger first.** Only `anchorRecord` writes a record, and only after the anchor reached consensus.
- **Four-field envelope.** The topic message is exactly `{ v, parcelId, kind, hash }`.
- **`max_custom_fee` on every submission.** It is set in `publishToTopic`.
- **The committee governs the topic.** The admin and fee schedule keys are the same 3-of-4 committee key, and the
  exempt key is 1-of-4.
- **Balances come from the mirror node.** `AccountBalanceQuery` is deprecated.

## Style

Follow the skeleton:

- 2-space indent, `printWidth` 120, `arrowParens: "avoid"`, trailing commas
- imports through `~~/`
- `type` rather than `interface`
- let TypeScript infer; annotate only where inference cannot reach or a reader needs the shape
- comment only what the code cannot say
- guard clauses, flat control flow, no regular expressions
- errors name what failed and the offending value, but never a key

Commit with `git commit -s`.

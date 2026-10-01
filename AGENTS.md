# Agent instructions

Briefing for coding agents in this app (Cursor, Claude Code, Codex). Claude Code loads it through `CLAUDE.md`.

This is the `hcs-logs` Scaffold-HBAR template. It has no Solidity and no smart contracts. Records are anchored on a Hedera Consensus Service topic through `@hiero-ledger/sdk`.

npm only. Root scripts are package-prefixed and delegate into the workspace with `-w @sh/<package>`.

## Commands

```bash
npm run lint
npm run format
npm run next:build
npm run next:check-types
```

## Layout

- `packages/nextjs` — Next.js App Router frontend (`scaffold.config.ts` holds target networks)

## Style

| Style | Use |
| --- | --- |
| `UpperCamelCase` | types, components |
| `lowerCamelCase` | variables, functions |
| `CONSTANT_CASE` | constants |

Prefer `type` over `interface`. No `T` prefix on types. Let TypeScript infer when it can. Comments should add information.

# hcs-logs

Scaffold-HBAR template: tamper-evident parcel and event records anchored on a Hedera Consensus Service topic with HIP-991 custom fees paid in an HTS token.

Work in progress. The full guide lands with the library layer.

## Prerequisites

- [Node.js](https://nodejs.org/) 24 LTS (`24.21.0`, pinned in `.nvmrc`; run `nvm use`). Node 25 is not supported: its built-in `localStorage` global breaks the Next.js build during prerendering.
- [Git](https://git-scm.com/) with `user.name` and `user.email` configured
- npm

## Quick start

```bash
npm install
npm run lint
npm run next:build
```

## Links

- [Scaffold HBAR docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index)
- [create-scaffold-hbar](https://github.com/hedera-dev/create-scaffold-hbar)
- [Hedera Portal faucet](https://portal.hedera.com/faucet)
- [HashScan](https://hashscan.io/)

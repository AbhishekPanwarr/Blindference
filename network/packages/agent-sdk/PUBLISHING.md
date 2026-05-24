# Agent SDK Publishing Checklist

**Package**: `@blindference/agent-sdk` v0.1.0
**Location**: `network/packages/agent-sdk/`
**Status**: Built and ready for publishing

---

## Pre-Publish Checklist

### 1. Build Verification

```bash
cd network/packages/agent-sdk
npm run build
```

**Expected result**: `dist/index.js` and `dist/index.d.ts` exist with no TypeScript errors.

### 2. Files Review

Ensure `files` array in `package.json` only includes what should be published:

```json
"files": ["dist"]
```

Verify `.npmignore` or `files` field excludes:
- [ ] `src/` (source TypeScript — optional, can include)
- [ ] `node_modules/`
- [ ] `.env`
- [ ] Test files

### 3. Version Check

Current version in `package.json`: **0.1.0**

For first publish: 0.1.0 is fine.
For updates: bump according to semver (patch/minor/major).

### 4. npm Organization Access

The package is scoped under `@blindference`. You need:

1. **npm account** at https://www.npmjs.com/
2. **Organization** `@blindference` created (or your username as scope)
3. **Login locally**:
   ```bash
   npm login
   ```

### 5. Publish Command

```bash
cd network/packages/agent-sdk
npm publish --access public
```

**Note**: First publish of a scoped package requires `--access public`. Subsequent publishes don't need it.

---

## Post-Publish Verification

### 1. npm Registry Check

```bash
npm view @blindference/agent-sdk
```

Should show version, description, and dist tarball URL.

### 2. Installation Test

```bash
mkdir /tmp/sdk-test && cd /tmp/sdk-test
npm init -y
npm install @blindference/agent-sdk
node -e "const sdk = require('@blindference/agent-sdk'); console.log('OK:', Object.keys(sdk))"
```

### 3. TypeScript Import Test

```typescript
// test.ts
import { InferenceClient } from '@blindference/agent-sdk';
const client = new InferenceClient({
  iclBaseUrl: 'https://icl.blindference.xyz',
  cofheEndpoint: 'https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY',
});
console.log('SDK loaded:', client.constructor.name);
```

Compile:
```bash
npx tsc test.ts --module commonjs --esModuleInterop --skipLibCheck
```

---

## Publishing Automation (Optional)

### GitHub Actions Workflow

Create `.github/workflows/publish-sdk.yml`:

```yaml
name: Publish Agent SDK

on:
  push:
    tags:
      - 'sdk-v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: cd network/packages/agent-sdk && npm ci
      - run: cd network/packages/agent-sdk && npm run build
      - run: cd network/packages/agent-sdk && npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Required secret**: `NPM_TOKEN` — create at https://www.npmjs.com/settings/tokens

### Version Bump + Tag

```bash
cd network/packages/agent-sdk
npm version patch  # or minor, major
# This bumps package.json and creates git tag
git push --follow-tags
```

---

## SDK API Summary

### `InferenceClient`

```typescript
class InferenceClient {
  constructor(config: {
    iclBaseUrl: string;         // e.g. https://icl.blindference.xyz
    cofheEndpoint: string;      // Arbitrum Sepolia RPC
    chainId?: number;           // default 421614
    wallet?: Wallet;            // ethers Wallet for on-chain txs
  });

  // Credit system
  async getBalance(address: string): Promise<{ balance_cusdc: number; balance_blind: number }>;
  async getPackages(): Promise<CreditPackage[]>;
  async depositBLIND(amountWei: bigint): Promise<string>;  // tx hash
  async purchasePackage(packageId: string): Promise<string>;  // tx hash

  // Inference
  async submitEncryptedInference(params: {
    prompt: string;
    modelId: string;
    encryptedPromptKey: { high: string; low: string };
    promptCid: string;
  }): Promise<{ requestId: string; taskId: string }>;
}
```

### Encryption Helpers

```typescript
// AES-GCM encryption
async function encryptPrompt(prompt: string): Promise<{
  ciphertext: Uint8Array;
  key: CryptoKey;
  iv: Uint8Array;
}>;

// Key splitting for CoFHE
function splitKeyForCofhe(keyBytes: Uint8Array): [bigint, bigint];

// IPFS upload/download
async function uploadToIPFS(data: Uint8Array): Promise<string>;
async function downloadFromIPFS(cid: string): Promise<Uint8Array>;
```

---

## Notes

- The SDK depends on `@cofhe/sdk` (Fhenix browser SDK) which may require special handling for Node.js environments.
- `viem` and `ethers` are both included for maximum compatibility.
- For browser use, ensure the bundler handles the CoFHE WASM assets correctly.
- The SDK is **MIT licensed** — safe for commercial use.

---

**Ready to publish?** Run:
```bash
cd network/packages/agent-sdk
npm run build && npm publish --access public
```

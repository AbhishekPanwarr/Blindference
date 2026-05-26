export { Encryptable, FheTypes } from '@cofhe/sdk'
export type { CofheClient, EncryptedItemInput } from '@cofhe/sdk'
export { createCofheConfig } from '@cofhe/sdk/web'
export { chains } from '@cofhe/sdk/chains'

// Re-export createCofheClient from the web bundle, but also provide a
// no-worker variant so Vite dev mode never tries to spawn zkProve.worker.js
// (which fails with "Worker error event" because the module URL can't be
// resolved in the dev server).
export { createCofheClient, createCofheClientWithCustomWorker } from '@cofhe/sdk/web'

import { createCofheClientWithCustomWorker as _createCofheClientWithCustomWorker } from '@cofhe/sdk/web'

/**
 * Create a CoFHE client that never instantiates a Web Worker.
 * Use this in Vite dev mode or when `useWorkers: false` to avoid
 * the "Worker error event" console spam from zkProve.worker.js.
 */
export function createCofheClientNoWorker(config: any): any {
  return _createCofheClientWithCustomWorker(config, undefined)
}

/**
 * TFHE WASM Wrapper
 *
 * This module re-exports the tfhe ESM package while providing a custom init()
 * that points Vite to the bundled WASM file via ?url import.
 *
 * IMPORTANT: tfhe is excluded from Vite's optimizeDeps (see vite.config.ts).
 * Pre-bundling tfhe breaks WASM URL resolution because the relative
 * ../../node_modules/tfhe/tfhe_bg.wasm path becomes invalid once the JS
 * is hoisted into node_modules/.vite/deps/. Keeping it unbundled lets Vite
 * serve the WASM directly from the original location.
 */
import rawInit, * as tfheModule from '../../node_modules/tfhe/tfhe.js'
// Absolute path so the URL stays valid whether this module is served from
// src/lib/ or .vite/deps/ after pre-bundling.
import wasmUrl from '/node_modules/tfhe/tfhe_bg.wasm?url'

export * from '../../node_modules/tfhe/tfhe.js'

type InitArgument =
  | {
      module_or_path?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module | Promise<unknown>
      memory?: WebAssembly.Memory
      thread_stack_size?: number
    }
  | RequestInfo
  | URL
  | Response
  | BufferSource
  | WebAssembly.Module
  | Promise<unknown>
  | undefined

export default async function init(moduleOrPath?: InitArgument) {
  if (moduleOrPath && Object.getPrototypeOf(moduleOrPath) === Object.prototype) {
    const typedArg = moduleOrPath as {
      module_or_path?: unknown
      memory?: WebAssembly.Memory
      thread_stack_size?: number
    }
    return rawInit({
      module_or_path: typedArg.module_or_path ?? wasmUrl,
      memory: typedArg.memory,
      thread_stack_size: typedArg.thread_stack_size,
    })
  }

  return rawInit({
    module_or_path: moduleOrPath ?? wasmUrl,
  })
}

export const __tfheModule = tfheModule

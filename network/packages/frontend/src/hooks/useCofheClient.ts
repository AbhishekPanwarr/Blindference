import { useCallback, useEffect, useState } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'

import { chains, createCofheClient, createCofheClientNoWorker, createCofheConfig, type CofheClient } from '../lib/cofhe'
import { createMockCofheClient } from '../utils/textPromptKey'

const USE_MOCK_COFHE = import.meta.env.VITE_COFHE_MOCK === 'true'

export function useCofheClient() {
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const [client, setClient] = useState<CofheClient | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const initCofhe = useCallback(async () => {
    if (!walletClient || !publicClient) {
      setClient(null)
      setIsReady(false)
      setError('Wallet not connected')
      return
    }

    setError(null)
    setIsReady(false)

    try {
      if (USE_MOCK_COFHE) {
        console.log('[CoFHE] Using mock client (VITE_COFHE_MOCK=true)')
        const mockClient = createMockCofheClient()
        setClient(mockClient)
        setIsReady(true)
        setError(null)
        return
      }

      // fheKeyStorage: null prevents stale/corrupted FHE public keys from
      // being cached in IndexedDB, which causes serialization errors that
      // cascade into "Failed to fetch" on subsequent ZK proof verification.
      const config = createCofheConfig({
        supportedChains: [chains.arbSepolia, chains.hardhat],
        useWorkers: false,
        fheKeyStorage: null,
      })
      // Use the no-worker variant so Vite dev mode never tries to load
      // zkProve.worker.js (which fails with a "Worker error event").
      const cofheClient = createCofheClientNoWorker(config)
      // @ts-ignore — viem version mismatch between project and @cofhe/sdk
      await cofheClient.connect(publicClient, walletClient)

      setClient(cofheClient)
      setIsReady(true)
      setError(null)
    } catch (initError) {
      setClient(null)
      setIsReady(false)
      setError(
        initError instanceof Error
          ? initError.message
          : 'Failed to initialize CoFHE. Ensure your wallet is on Arbitrum Sepolia.',
      )
    }
  }, [publicClient, walletClient])

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (cancelled) return
      await initCofhe()
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [initCofhe, retryCount])

  return { client, isReady, error, retry }
}

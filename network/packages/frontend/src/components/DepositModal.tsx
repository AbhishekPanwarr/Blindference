import { useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { arbitrumSepolia } from 'wagmi/chains'
import { Hex, parseUnits } from 'viem'
import { X, ArrowDownLeft, Loader2, Info } from 'lucide-react'
import { creditsApi } from '../api/creditsApi'

const ICL_WALLET_ADDRESS = (import.meta.env.VITE_ICL_WALLET_ADDRESS || '') as Hex
const CUSDC_ADDRESS = (import.meta.env.VITE_CUSDC_TOKEN_ADDRESS || '0x42E47f9bA89712C317f60A72C81A610A2b68c48a') as Hex
const BLIND_ADDRESS = (import.meta.env.VITE_BLIND_TOKEN_ADDRESS || '') as Hex

type Token = 'cusdc' | 'blind'

export function DepositModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [token, setToken] = useState<Token>('blind')
  const [amount, setAmount] = useState('100')
  const [status, setStatus] = useState<'idle' | 'sending' | 'confirming' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleDeposit = async () => {
    if (!address || !walletClient) {
      setError('Connect your wallet first')
      return
    }
    if (!ICL_WALLET_ADDRESS) {
      setError('ICL wallet address not configured')
      return
    }
    if (token === 'cusdc') {
      setError('cUSDC is a confidential token and cannot be deposited via standard transfer. Please use the CLI wrap script (wrap_usdc.ts) to convert USDC to cUSDC.')
      setStatus('error')
      return
    }
    setStatus('sending')
    setError(null)

    try {
      // token is guaranteed to be 'blind' here (cusdc is rejected above)
      const value = parseUnits(amount, 18)
      const tokenAddress = BLIND_ADDRESS
      if (!tokenAddress) {
        setError('BLIND token address not configured')
        setStatus('error')
        return
      }

      if (!publicClient) {
        setError('Public client not available')
        setStatus('error')
        return
      }

      // Dynamic EIP-1559 gas estimation (same pattern as promptKeyStore.ts).
      const latestBlock = await publicClient.getBlock({ blockTag: 'latest' })
      const fallbackPriorityFeePerGas = 2_000_000n
      const maxPriorityFeePerGas = await publicClient
        .estimateMaxPriorityFeePerGas()
        .catch(() => fallbackPriorityFeePerGas)
      const priorityFeePerGas = maxPriorityFeePerGas > 0n ? maxPriorityFeePerGas : fallbackPriorityFeePerGas
      const baseFeePerGas = latestBlock.baseFeePerGas
      const feeParams =
        baseFeePerGas != null
          ? {
              maxPriorityFeePerGas: priorityFeePerGas,
              maxFeePerGas: baseFeePerGas * 2n + priorityFeePerGas + 1_000_000n,
            }
          : {
              gasPrice: await publicClient.getGasPrice(),
            }

      // For ERC-20 tokens, we need to call transfer
      const txHash = await walletClient.writeContract({
        account: address,
        chain: arbitrumSepolia,
        address: tokenAddress,
        abi: [
          {
            name: 'transfer',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'bool' }],
          },
        ],
        functionName: 'transfer',
        args: [ICL_WALLET_ADDRESS, value],
        ...feeParams,
      })

      setStatus('confirming')
      // Wait for Arbitrum Sepolia indexing (7s initial + retries)
      await new Promise((resolve) => setTimeout(resolve, 7000))

      // Retry up to 5 times — RPC indexing can lag on testnet
      let lastErr: unknown
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const resp = await creditsApi.notifyDeposit(txHash)
          console.log('[Deposit] notifyDeposit success:', resp.data)
          setStatus('done')
          onSuccess?.()
          setTimeout(() => onClose(), 1500)
          return
        } catch (err: any) {
          lastErr = err
          console.error(`[Deposit] notifyDeposit attempt ${attempt} failed:`, err.response?.data || err.message)
          if (attempt < 5) {
            await new Promise((resolve) => setTimeout(resolve, 3000))
          }
        }
      }
      throw lastErr
    } catch (err: any) {
      setStatus('error')
      const detail = err.response?.data?.detail || (err instanceof Error ? err.message : 'Deposit failed')
      setError(detail)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Deposit Credits</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          {(['blind', 'cusdc'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setToken(t)}
              disabled={t === 'cusdc'}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                t === 'cusdc'
                  ? 'cursor-not-allowed opacity-40 border-zinc-800 bg-zinc-800 text-zinc-600'
                  : token === t
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}
              title={t === 'cusdc' ? 'cUSDC is a confidential token — use CLI wrap script' : ''}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {token === 'cusdc' && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              cUSDC is a confidential FHERC20 token. It cannot be deposited via MetaMask.
              Use the CLI wrap script to obtain cUSDC, or deposit BLIND instead.
            </span>
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Amount
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
            min="0.001"
            step="0.001"
          />
        </div>

        <div className="mb-4 text-[10px] text-zinc-500">
          ICL wallet: {ICL_WALLET_ADDRESS ? `${ICL_WALLET_ADDRESS.slice(0, 18)}…` : 'Not configured'}
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={handleDeposit}
          disabled={status === 'sending' || status === 'confirming' || token === 'cusdc'}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
        >
          {status === 'sending' || status === 'confirming' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {status === 'sending' ? 'Sending…' : 'Confirming…'}
            </>
          ) : status === 'done' ? (
            'Done!'
          ) : (
            <>
              <ArrowDownLeft className="w-4 h-4" />
              Deposit {token.toUpperCase()}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

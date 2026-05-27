import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { paymentApiClient } from '../api/client'

export function useIsNodeOperator() {
  const { address } = useAccount()
  const [isOperator, setIsOperator] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)

  const checkOperator = useCallback(async () => {
    if (!address) {
      setIsOperator(false)
      return
    }
    setLoading(true)
    try {
      const resp = await paymentApiClient.get(`/v1/nodes/${address.toLowerCase()}/exists`)
      setIsOperator(resp.data.is_operator as boolean)
    } catch {
      setIsOperator(false)
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    checkOperator()
  }, [checkOperator])

  return { isOperator, loading, refetch: checkOperator }
}

import { paymentApiClient } from './client'

export type CreditBalance = {
  user_address: string
  balance_cusdc: number
  balance_blind: number
  total_deposited_cusdc: number
  total_deposited_blind: number
  total_spent_cusdc: number
  total_spent_blind: number
}

export type CreditPackage = {
  id: string
  name: string
  base_calls: number
  bonus_percent: number
  total_calls: number
  price_blind: number
  price_blind_wei: number
}

export type PurchasePackageResponse = CreditBalance & {
  status: string
  package_id: string
  credits_awarded_cusdc: number
  tx_hash: string
}

export const creditsApi = {
  getBalance(address: string) {
    return paymentApiClient.get<CreditBalance>(`/v1/balance/${address}`)
  },
  notifyDeposit(txHash: string) {
    return paymentApiClient.post<CreditBalance & { status: string; tx_hash: string }>('/v1/deposit', {
      tx_hash: txHash,
    })
  },
  getPackages() {
    return paymentApiClient.get<{ packages: CreditPackage[] }>('/v1/credits/packages')
  },
  purchasePackage(packageId: string, txHash: string) {
    return paymentApiClient.post<PurchasePackageResponse>('/v1/credits/purchase-package', {
      package_id: packageId,
      tx_hash: txHash,
    })
  },
}

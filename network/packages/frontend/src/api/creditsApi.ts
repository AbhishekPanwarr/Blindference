import { paymentApiClient } from './client'

export type CreditBalance = {
  user_address: string
  balance_cusdc: string
  balance_blind: string
  total_deposited_cusdc: string
  total_deposited_blind: string
  total_spent_cusdc: string
  total_spent_blind: string
}

export type CreditPackage = {
  id: string
  name: string
  base_calls: number
  bonus_percent: number
  total_calls: number
  price_blind: number
  price_blind_wei: string
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

function getPinataJwt(): string {
  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    throw new Error('PINATA_JWT is not set')
  }
  return jwt
}

function getGatewayBaseUrl(): string {
  return (process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs').replace(/\/$/, '')
}

export async function uploadToIPFS(data: Buffer): Promise<string> {
  const formData = new FormData()
  formData.append('file', new Blob([data]), 'blindference.bin')
  formData.append('network', 'public')
  formData.append('name', 'blindference.bin')

  const response = await fetch('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getPinataJwt()}`,
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json()
  const cid = payload?.data?.cid

  if (!cid) {
    throw new Error(`IPFS upload failed: ${JSON.stringify(payload)}`)
  }

  return cid
}

export async function downloadFromIPFS(cid: string): Promise<Buffer> {
  const url = `${getGatewayBaseUrl()}/${cid}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`IPFS download failed: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ICL_API_URL?: string
  readonly VITE_PROMPT_KEY_STORE_ADDRESS?: string
  readonly VITE_TEXT_MODEL_DEFAULT?: string
  readonly VITE_PROMPT_UPLOAD_TIMEOUT_MS?: string
  readonly VITE_IPFS_GATEWAY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

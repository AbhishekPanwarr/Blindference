export interface TutorialStep {
  step: number
  title: string
  description: string
  targetSelector: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

export const INFERENCE_TUTORIAL_STEPS: TutorialStep[] = [
  {
    step: 1,
    title: 'Choose Your Mode',
    description: 'Switch between Chat (text inference) and Risk Scoring (financial analysis). Each mode uses the same encrypted pipeline but with different input types.',
    targetSelector: '[data-tutorial="mode-toggle"]',
    placement: 'bottom',
  },
  {
    step: 2,
    title: 'Select a Model',
    description: 'Pick from Groq Llama 70B, Gemini 2.5 Flash, or local OPT-125M. Each model has different speed, accuracy, and cost characteristics.',
    targetSelector: '[data-tutorial="model-picker"]',
    placement: 'top',
  },
  {
    step: 3,
    title: 'Write Your Prompt',
    description: 'Type anything you want to infer privately. Your prompt is encrypted with FHE before leaving your browser — not even our servers can read it.',
    targetSelector: '[data-tutorial="prompt-input"]',
    placement: 'top',
  },
  {
    step: 4,
    title: 'Payment Mode',
    description: 'Credits: deduct from your pre-purchased balance instantly. Escrow: lock USDC in a smart contract until inference completes.',
    targetSelector: '[data-tutorial="payment-mode"]',
    placement: 'top',
  },
  {
    step: 5,
    title: 'Choose Currency',
    description: 'Pay with cUSDC (stable) or BLIND tokens (20% discount). BLIND is the native token of the Blindference network.',
    targetSelector: '[data-tutorial="currency-toggle"]',
    placement: 'top',
  },
  {
    step: 6,
    title: 'Hallucination Insurance',
    description: 'Add +2% fee for coverage. If the result is disputed and settled in your favor, you receive up to 500 USDC payout.',
    targetSelector: '[data-tutorial="insurance-toggle"]',
    placement: 'top',
  },
  {
    step: 7,
    title: 'Estimated Fee',
    description: 'This shows the total cost including model fee, insurance (if enabled), and network overhead. Fees are deducted after successful inference.',
    targetSelector: '[data-tutorial="fee-display"]',
    placement: 'top',
  },
  {
    step: 8,
    title: 'Send Your Request',
    description: 'Click to encrypt, dispatch to the quorum network, and wait for consensus. The process typically takes 10-30 seconds.',
    targetSelector: '[data-tutorial="send-button"]',
    placement: 'top',
  },
  {
    step: 9,
    title: 'Execution Trace',
    description: 'Watch your request flow through encryption, dispatch, leader execution, verifier consensus, and final commitment on-chain.',
    targetSelector: '[data-tutorial="execution-trace"]',
    placement: 'left',
  },
]

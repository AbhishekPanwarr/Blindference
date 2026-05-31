import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'blindference_tutorial_v1'

interface TutorialState {
  enabled: boolean
  inferenceSeen: boolean
}

function loadState(): TutorialState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as TutorialState
      return parsed
    }
  } catch {
    // ignore
  }
  return { enabled: true, inferenceSeen: false }
}

function saveState(state: TutorialState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

interface TutorialContextValue {
  enabled: boolean
  inferenceSeen: boolean
  setEnabled: (enabled: boolean) => void
  markInferenceSeen: () => void
  resetTutorial: () => void
}

const TutorialContext = createContext<TutorialContextValue | null>(null)

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TutorialState>(loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  const setEnabled = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, enabled }))
  }, [])

  const markInferenceSeen = useCallback(() => {
    setState((s) => ({ ...s, inferenceSeen: true, enabled: false }))
  }, [])

  const resetTutorial = useCallback(() => {
    setState({ enabled: true, inferenceSeen: false })
  }, [])

  return (
    <TutorialContext.Provider
      value={{
        enabled: state.enabled,
        inferenceSeen: state.inferenceSeen,
        setEnabled,
        markInferenceSeen,
        resetTutorial,
      }}
    >
      {children}
    </TutorialContext.Provider>
  )
}

export function useTutorialContext() {
  const ctx = useContext(TutorialContext)
  if (!ctx) {
    throw new Error('useTutorialContext must be used within TutorialProvider')
  }
  return ctx
}

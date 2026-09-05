import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

type Theme = 'dark' | 'light' | 'system'

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

interface ThemeProviderState {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined,
)

function readStoredTheme(storageKey: string, fallback: Theme): Theme {
  const stored = localStorage.getItem(storageKey)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return fallback
}

function subscribeSystemTheme(onStoreChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onStoreChange)
  return () => {
    media.removeEventListener('change', onStoreChange)
  }
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() =>
    readStoredTheme(storageKey, defaultTheme),
  )
  const systemTheme = useSyncExternalStore<'light' | 'dark'>(
    subscribeSystemTheme,
    getSystemTheme,
    (): 'light' => 'light',
  )
  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? systemTheme : theme

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
  }, [resolvedTheme])

  const value: ThemeProviderState = {
    theme,
    resolvedTheme,
    setTheme: (next) => {
      localStorage.setItem(storageKey, next)
      setThemeState(next)
    },
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeProviderContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

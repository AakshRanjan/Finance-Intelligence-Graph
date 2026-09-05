import { CheckIcon, Moon, Sun } from 'lucide-react'

import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const THEMES = ['light', 'dark', 'system'] as const

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="relative"
            aria-label={`Theme: ${theme}`}
          />
        }
      >
        <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        <span className="sr-only">Theme: {theme}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEMES.map((option) => (
          <DropdownMenuItem
            key={option}
            onClick={() => setTheme(option)}
            className="capitalize"
          >
            {option}
            {theme === option ? (
              <CheckIcon className="ml-auto" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

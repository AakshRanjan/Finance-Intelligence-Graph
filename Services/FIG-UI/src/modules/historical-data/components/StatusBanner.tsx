import { AlertCircleIcon, InfoIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'

interface StatusBannerProps {
  message: string
  tone?: 'info' | 'error'
}

export function StatusBanner({ message, tone = 'info' }: StatusBannerProps) {
  const isError = tone === 'error'
  return (
    <Alert
      variant={isError ? 'destructive' : 'default'}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      {isError ? <AlertCircleIcon /> : <InfoIcon />}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

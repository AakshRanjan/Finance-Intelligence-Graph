interface StatusBannerProps {
  message: string
  tone?: 'info' | 'error'
}

export function StatusBanner({ message, tone = 'info' }: StatusBannerProps) {
  return (
    <p className={`status status-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {message}
    </p>
  )
}

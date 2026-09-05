import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-lg font-semibold tracking-tight">Page not found</h2>
      <p className="text-sm text-muted-foreground">
        That page is not a registered FIG route.
      </p>
      <Button render={<Link to="/" />}>Go home</Button>
    </div>
  )
}
